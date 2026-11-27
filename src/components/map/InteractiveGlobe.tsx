import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Button } from '@ui-sdk/react/button';
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { RegionFlag } from '@/components/ui/RegionFlag';
import type { DataLinkArc, RegionCluster } from '@/lib/geoRegions';
import {
  DEG_TO_RAD,
  GLOBE_LAND_GROUPS,
  buildGlobeArcGeometries,
  computeGlobePlacardAnchors,
  computeInitialGlobeView,
  rotateForView,
  shortestLonDeltaDeg,
  wrapLonDeg,
  type GlobeArcGeometry,
  type GlobePlacardAnchor,
} from '@/lib/globeMath';

interface InteractiveGlobeProps {
  clusters: RegionCluster[];
  arcs: DataLinkArc[];
  activeCode: string;
  hoveredCode: string | null;
  focusSeq: number;
  topologyKey: string;
  ariaLabel: string;
  onSelectRegion: (code: string) => void;
  onHoverRegion: (code: string | null) => void;
}

interface GlobePalette {
  sphereHi: string;
  sphereMid: string;
  sphereEdge: string;
  rim: string;
  rimSpec: string;
  halo: string;
  shadow: string;
  dotBase: string;
  dotActive: string;
  dotFocus: string;
  arcBase: string;
  arcActive: string;
  arcPulse: string;
  arcHead: string;
  arcReturn: string;
}

interface CameraState {
  lon: number;
  lat: number;
  zoom: number;
  targetZoom: number;
  velLon: number;
  velLat: number;
  lastInteractMs: number;
  fly: {
    startLon: number;
    startLat: number;
    deltaLon: number;
    deltaLat: number;
    startMs: number;
    durationMs: number;
  } | null;
}

interface PointerSlot {
  posX: number;
  posY: number;
}

interface ProjectedFlag {
  cluster: RegionCluster;
  pinX: number;
  pinY: number;
  depthZ: number;
  vis: number;
  cardX: number;
  cardY: number;
  halfW: number;
  halfH: number;
  fallbackDirX: number;
  fallbackDirY: number;
  inViewport: boolean;
  isSelected: boolean;
  isHovered: boolean;
}

const MIN_ZOOM = 0.84;
const MAX_ZOOM = 1.92;
const MAX_LAT = 64;
const AUTO_ROTATE_DEG_PER_SEC = 4.6;
const IDLE_RESUME_MS = 2600;

function clampVal(val: number, minVal: number, maxVal: number): number {
  return val < minVal ? minVal : val > maxVal ? maxVal : val;
}

function smoothstep(edge0: number, edge1: number, val: number): number {
  const ratio = clampVal((val - edge0) / (edge1 - edge0), 0, 1);
  return ratio * ratio * (3 - 2 * ratio);
}

function readGlobePalette(hostEl: HTMLElement | null): GlobePalette {
  const computed = hostEl ? getComputedStyle(hostEl) : null;
  const token = (prop: string, fallback: string) => {
    const raw = computed?.getPropertyValue(prop).trim();
    return raw || fallback;
  };
  return {
    sphereHi: token('--globe-sphere-hi', '#222733'),
    sphereMid: token('--globe-sphere-mid', '#141720'),
    sphereEdge: token('--globe-sphere-edge', '#0a0c12'),
    rim: token('--globe-rim', 'rgba(239, 238, 233, 0.16)'),
    rimSpec: token('--globe-rim-spec', 'rgba(255, 255, 255, 0.24)'),
    halo: token('--globe-halo', 'rgba(239, 238, 233, 0.055)'),
    shadow: token('--globe-shadow', 'rgba(0, 0, 0, 0.48)'),
    dotBase: token('--globe-dot-base', 'rgba(239, 238, 233, 0.27)'),
    dotActive: token('--globe-dot-active', 'rgba(239, 238, 233, 0.72)'),
    dotFocus: token('--globe-dot-focus', 'rgba(247, 246, 241, 0.96)'),
    arcBase: token('--map-arc', 'rgba(239, 238, 233, 0.14)'),
    arcActive: token('--map-arc-active', 'rgba(239, 238, 233, 0.48)'),
    arcPulse: token('--map-arc-pulse', '#8ec5f4'),
    arcHead: token('--map-arc-head', '#f7f6f1'),
    arcReturn: token('--map-arc-return', '#52c99b'),
  };
}

function sampleArcPoint(
  buf: Float32Array,
  segments: number,
  ratio: number,
): { rx: number; ry: number; rz: number } {
  const clamped = clampVal(ratio, 0, 1);
  const exact = clamped * segments;
  const idx0 = Math.min(segments - 1, Math.floor(exact));
  const frac = exact - idx0;
  const off0 = idx0 * 3;
  const off1 = (idx0 + 1) * 3;
  return {
    rx: buf[off0] + (buf[off1] - buf[off0]) * frac,
    ry: buf[off0 + 1] + (buf[off1 + 1] - buf[off0 + 1]) * frac,
    rz: buf[off0 + 2] + (buf[off1 + 2] - buf[off0 + 2]) * frac,
  };
}

function isElevatedPointVisible(rx: number, ry: number, rz: number): boolean {
  return rz >= 0 || rx * rx + ry * ry >= 1;
}

export function InteractiveGlobe({
  clusters,
  arcs,
  activeCode,
  hoveredCode,
  focusSeq,
  topologyKey,
  ariaLabel,
  onSelectRegion,
  onHoverRegion,
}: InteractiveGlobeProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const placardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const placardSizesRef = useRef<Map<string, { halfW: number; halfH: number }>>(new Map());

  const [reducedMotion] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [autoRotate, setAutoRotate] = useState(() => !reducedMotion);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const initialView = useMemo(
    () => computeInitialGlobeView(clusters, activeCode !== 'ALL' ? activeCode : null),
    [topologyKey],
  );

  const cameraRef = useRef<CameraState>({
    lon: initialView.lon,
    lat: initialView.lat,
    zoom: 1,
    targetZoom: 1,
    velLon: 0,
    velLat: 0,
    lastInteractMs: -10000,
    fly: null,
  });

  const stageMetricsRef = useRef({ width: 0, height: 0, dpr: 1, radius: 160 });
  const paletteRef = useRef<GlobePalette>(readGlobePalette(null));
  const clustersRef = useRef(clusters);
  clustersRef.current = clusters;
  const activeCodeRef = useRef(activeCode);
  activeCodeRef.current = activeCode;
  const hoveredCodeRef = useRef(hoveredCode);
  hoveredCodeRef.current = hoveredCode;

  const activeIsoSet = useMemo(() => new Set(clusters.map((item) => item.hub.code)), [topologyKey]);
  const activeIsoSetRef = useRef(activeIsoSet);
  activeIsoSetRef.current = activeIsoSet;

  const anchorCacheRef = useRef<{ key: string; map: Map<string, GlobePlacardAnchor> }>({
    key: '',
    map: new Map(),
  });
  if (anchorCacheRef.current.key !== topologyKey) {
    anchorCacheRef.current = {
      key: topologyKey,
      map: computeGlobePlacardAnchors(clusters),
    };
  }
  const anchorsRef = useRef(anchorCacheRef.current.map);
  anchorsRef.current = anchorCacheRef.current.map;

  const arcGeomCacheRef = useRef<{ key: string; list: GlobeArcGeometry[] }>({
    key: '',
    list: [],
  });
  const arcKey = `${topologyKey}|${arcs.map((item) => `${item.id}:${item.active ? 1 : 0}`).join(',')}`;
  if (arcGeomCacheRef.current.key !== arcKey) {
    arcGeomCacheRef.current = {
      key: arcKey,
      list: buildGlobeArcGeometries(arcs),
    };
  }
  const arcGeomsRef = useRef(arcGeomCacheRef.current.list);
  arcGeomsRef.current = arcGeomCacheRef.current.list;

  const activePointersRef = useRef<Map<number, PointerSlot>>(new Map());
  const dragStateRef = useRef({
    primaryId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastMoveMs: 0,
    moved: false,
    captured: false,
    pinchDist: 0,
    pinchMidX: 0,
    pinchMidY: 0,
    suppressClickUntil: 0,
  });

  const flyToLatLon = useCallback((targetLat: number, targetLon: number, durationMs = 620) => {
    const cam = cameraRef.current;
    const clampedLat = clampVal(targetLat, -MAX_LAT, MAX_LAT);
    const wrappedLon = wrapLonDeg(targetLon);
    const deltaLon = shortestLonDeltaDeg(cam.lon, wrappedLon);
    const deltaLat = clampedLat - cam.lat;
    cam.velLon = 0;
    cam.velLat = 0;
    if (Math.abs(deltaLon) < 0.25 && Math.abs(deltaLat) < 0.25) {
      cam.lon = wrappedLon;
      cam.lat = clampedLat;
      cam.fly = null;
      return;
    }
    cam.fly = {
      startLon: cam.lon,
      startLat: cam.lat,
      deltaLon,
      deltaLat,
      startMs: performance.now(),
      durationMs,
    };
  }, []);

  const handleResetView = useCallback(() => {
    const overview = computeInitialGlobeView(clustersRef.current, null);
    cameraRef.current.targetZoom = 1;
    cameraRef.current.lastInteractMs = performance.now() - IDLE_RESUME_MS;
    flyToLatLon(overview.lat, overview.lon, 640);
    if (activeCodeRef.current !== 'ALL') {
      onSelectRegion('ALL');
    }
  }, [flyToLatLon, onSelectRegion]);

  const handleAdjustZoom = useCallback((factor: number) => {
    const cam = cameraRef.current;
    cam.targetZoom = clampVal(cam.targetZoom * factor, MIN_ZOOM, MAX_ZOOM);
    cam.lastInteractMs = performance.now();
  }, []);

  const prevActiveRef = useRef<string>(activeCode);
  useEffect(() => {
    if (activeCode !== 'ALL') {
      const target = clustersRef.current.find((item) => item.hub.code === activeCode);
      if (target) {
        flyToLatLon(target.hub.lat * 0.72, target.hub.lon, 640);
      }
    } else if (prevActiveRef.current !== 'ALL') {
      cameraRef.current.lastInteractMs = performance.now() - IDLE_RESUME_MS + 900;
    }
    prevActiveRef.current = activeCode;
  }, [activeCode, focusSeq, flyToLatLon]);

  useEffect(() => {
    const measurePlacards = () => {
      const map = placardSizesRef.current;
      placardRefs.current.forEach((btn, code) => {
        const width = btn.offsetWidth;
        const height = btn.offsetHeight;
        if (width > 8 && height > 6) {
          map.set(code, { halfW: width / 2, halfH: height / 2 });
        }
      });
    };
    measurePlacards();
    const rafId = window.requestAnimationFrame(measurePlacards);
    return () => window.cancelAnimationFrame(rafId);
  }, [topologyKey]);

  useEffect(() => {
    const stageEl = stageRef.current;
    const canvasEl = canvasRef.current;
    if (!stageEl || !canvasEl) return;

    const updatePalette = () => {
      paletteRef.current = readGlobePalette(stageEl);
    };
    updatePalette();

    const themeObserver = new MutationObserver(updatePalette);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-atmo', 'data-ui-style', 'class', 'style'],
    });

    const updateSize = () => {
      const rect = stageEl.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const backingW = Math.round(width * dpr);
      const backingH = Math.round(height * dpr);
      if (canvasEl.width !== backingW || canvasEl.height !== backingH) {
        canvasEl.width = backingW;
        canvasEl.height = backingH;
      }
      stageMetricsRef.current = {
        width,
        height,
        dpr,
        radius: stageMetricsRef.current.radius,
      };
      placardRefs.current.forEach((btn, code) => {
        if (btn.offsetWidth > 8 && btn.offsetHeight > 6) {
          placardSizesRef.current.set(code, {
            halfW: btn.offsetWidth / 2,
            halfH: btn.offsetHeight / 2,
          });
        }
      });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(stageEl);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const cam = cameraRef.current;
      const scaleStep = Math.exp(-event.deltaY * 0.0012);
      cam.targetZoom = clampVal(cam.targetZoom * scaleStep, MIN_ZOOM, MAX_ZOOM);
      cam.lastInteractMs = performance.now();
    };
    stageEl.addEventListener('wheel', onWheel, { passive: false });

    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      return () => {
        themeObserver.disconnect();
        resizeObserver.disconnect();
        stageEl.removeEventListener('wheel', onWheel);
      };
    }

    const arcBufPool: Float32Array[] = [];
    let prevFrameMs = performance.now();
    let rafHandle = 0;

    const drawArcPortion = (
      buf: Float32Array,
      segments: number,
      centerX: number,
      centerY: number,
      radius: number,
      drawBack: boolean,
    ) => {
      ctx.beginPath();
      let penDown = false;
      for (let step = 0; step <= segments; step++) {
        const off = step * 3;
        const rx = buf[off];
        const ry = buf[off + 1];
        const rz = buf[off + 2];
        const includePoint = drawBack ? rz < 0.02 : rz >= -0.02;
        if (!includePoint) {
          penDown = false;
          continue;
        }
        const sx = centerX + rx * radius;
        const sy = centerY - ry * radius;
        if (!penDown) {
          ctx.moveTo(sx, sy);
          penDown = true;
        } else {
          ctx.lineTo(sx, sy);
        }
      }
      ctx.stroke();
    };

    const renderFrame = (nowMs: number) => {
      const dtSec = Math.min(0.05, Math.max(0.001, (nowMs - prevFrameMs) / 1000));
      prevFrameMs = nowMs;

      const cam = cameraRef.current;
      const drag = dragStateRef.current;
      const isDragging = drag.moved && activePointersRef.current.size > 0;
      const activeRegion = activeCodeRef.current;
      const hoveredRegion = hoveredCodeRef.current;
      const spotlightRegion = hoveredRegion ?? (activeRegion !== 'ALL' ? activeRegion : null);

      if (cam.fly) {
        const progress = clampVal((nowMs - cam.fly.startMs) / cam.fly.durationMs, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        cam.lon = wrapLonDeg(cam.fly.startLon + cam.fly.deltaLon * eased);
        cam.lat = clampVal(cam.fly.startLat + cam.fly.deltaLat * eased, -MAX_LAT, MAX_LAT);
        if (progress >= 1) {
          cam.fly = null;
        }
      } else if (!isDragging) {
        if (Math.abs(cam.velLon) > 0.04 || Math.abs(cam.velLat) > 0.04) {
          cam.lon = wrapLonDeg(cam.lon + cam.velLon * dtSec);
          cam.lat = clampVal(cam.lat + cam.velLat * dtSec, -MAX_LAT, MAX_LAT);
          const damping = Math.pow(0.915, dtSec * 60);
          cam.velLon *= damping;
          cam.velLat *= damping;
        } else {
          cam.velLon = 0;
          cam.velLat = 0;
          const canAutoSpin =
            autoRotateRef.current &&
            activeRegion === 'ALL' &&
            hoveredRegion === null &&
            nowMs - cam.lastInteractMs > IDLE_RESUME_MS;
          if (canAutoSpin) {
            cam.lon = wrapLonDeg(cam.lon + AUTO_ROTATE_DEG_PER_SEC * dtSec);
          }
        }
      }

      cam.zoom += (cam.targetZoom - cam.zoom) * Math.min(1, dtSec * 12);

      const { width, height, dpr } = stageMetricsRef.current;
      if (width <= 1 || height <= 1) {
        rafHandle = window.requestAnimationFrame(renderFrame);
        return;
      }

      const palette = paletteRef.current;
      const minDim = Math.min(width, height);
      const isCompact = minDim < 410;
      const baseRadius = Math.min(
        width * (isCompact ? 0.39 : 0.405),
        height * (isCompact ? 0.41 : 0.425),
      );
      const radius = Math.max(72, baseRadius * cam.zoom);
      stageMetricsRef.current.radius = radius;

      const centerX = width / 2;
      const centerY = height / 2 - (isCompact ? 6 : 8);

      const lonRad = cam.lon * DEG_TO_RAD;
      const latRad = cam.lat * DEG_TO_RAD;
      const cosLon = Math.cos(lonRad);
      const sinLon = Math.sin(lonRad);
      const cosLat = Math.cos(latRad);
      const sinLat = Math.sin(latRad);
      const elapsedSec = nowMs * 0.001;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      const shadowY = centerY + radius * 1.025;
      const shadowRx = radius * 0.72;
      const shadowRy = Math.max(7, radius * 0.095);
      ctx.translate(centerX, shadowY);
      ctx.scale(1, shadowRy / shadowRx);
      const shadowGrad = ctx.createRadialGradient(0, 0, shadowRx * 0.05, 0, 0, shadowRx);
      shadowGrad.addColorStop(0, palette.shadow);
      shadowGrad.addColorStop(0.55, palette.shadow);
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, shadowRx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const haloGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.94,
        centerX,
        centerY,
        radius * 1.13,
      );
      haloGrad.addColorStop(0, palette.halo);
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.13, 0, Math.PI * 2);
      ctx.fill();

      const arcGeoms = arcGeomsRef.current;
      while (arcBufPool.length < arcGeoms.length) {
        arcBufPool.push(new Float32Array((48 + 1) * 3));
      }

      const rotatedArcs: { geom: GlobeArcGeometry; buf: Float32Array }[] = [];
      for (let idx = 0; idx < arcGeoms.length; idx++) {
        const geom = arcGeoms[idx];
        const needed = (geom.segments + 1) * 3;
        let copyBuf = arcBufPool[idx];
        if (copyBuf.length < needed) {
          copyBuf = new Float32Array(needed);
          arcBufPool[idx] = copyBuf;
        }
        const src = geom.coords;
        for (let step = 0; step <= geom.segments; step++) {
          const off = step * 3;
          const rot = rotateForView(
            src[off],
            src[off + 1],
            src[off + 2],
            cosLon,
            sinLon,
            cosLat,
            sinLat,
          );
          copyBuf[off] = rot.x;
          copyBuf[off + 1] = rot.y;
          copyBuf[off + 2] = rot.z;
        }
        rotatedArcs.push({ geom, buf: copyBuf });
      }

      for (let idx = 0; idx < rotatedArcs.length; idx++) {
        const { geom, buf } = rotatedArcs[idx];
        const isRel =
          spotlightRegion !== null &&
          (geom.arc.from.hub.code === spotlightRegion || geom.arc.to.hub.code === spotlightRegion);
        const isDim = spotlightRegion !== null && !isRel;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = isRel ? 1.25 : 0.85;
        ctx.strokeStyle = isRel ? palette.arcActive : palette.arcBase;
        ctx.globalAlpha = isDim ? 0.16 : geom.arc.active ? 0.62 : 0.34;
        drawArcPortion(buf, geom.segments, centerX, centerY, radius, true);
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.clip();

      const sphereGrad = ctx.createRadialGradient(
        centerX - radius * 0.34,
        centerY - radius * 0.36,
        radius * 0.08,
        centerX,
        centerY,
        radius * 1.04,
      );
      sphereGrad.addColorStop(0, palette.sphereHi);
      sphereGrad.addColorStop(0.56, palette.sphereMid);
      sphereGrad.addColorStop(1, palette.sphereEdge);
      ctx.fillStyle = sphereGrad;
      ctx.fillRect(centerX - radius - 1, centerY - radius - 1, radius * 2 + 2, radius * 2 + 2);

      const dotBaseR = clampVal(radius / 145, 0.95, 1.65);
      const isoSet = activeIsoSetRef.current;
      const baseBandNear: number[] = [];
      const baseBandMid: number[] = [];
      const baseBandRim: number[] = [];
      const activeBandNear: number[] = [];
      const activeBandRim: number[] = [];
      const focusPoints: number[] = [];

      for (let gIdx = 0; gIdx < GLOBE_LAND_GROUPS.length; gIdx++) {
        const group = GLOBE_LAND_GROUPS[gIdx];
        const isFocus = spotlightRegion !== null && group.iso === spotlightRegion;
        const isActive = isoSet.has(group.iso);
        const coords = group.coords;

        for (let pt = 0; pt < group.count; pt++) {
          const off = pt * 3;
          const rot = rotateForView(
            coords[off],
            coords[off + 1],
            coords[off + 2],
            cosLon,
            sinLon,
            cosLat,
            sinLat,
          );
          if (rot.z <= 0.02) continue;
          const sx = centerX + rot.x * radius;
          const sy = centerY - rot.y * radius;

          if (isFocus) {
            focusPoints.push(sx, sy);
          } else if (isActive) {
            if (rot.z > 0.34) {
              activeBandNear.push(sx, sy);
            } else {
              activeBandRim.push(sx, sy);
            }
          } else if (rot.z > 0.56) {
            baseBandNear.push(sx, sy);
          } else if (rot.z > 0.24) {
            baseBandMid.push(sx, sy);
          } else {
            baseBandRim.push(sx, sy);
          }
        }
      }

      const drawDotBatch = (points: number[], dotR: number, color: string, alpha: number) => {
        if (points.length === 0) return;
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (let idx = 0; idx < points.length; idx += 2) {
          const px = points[idx];
          const py = points[idx + 1];
          ctx.moveTo(px + dotR, py);
          ctx.arc(px, py, dotR, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      };

      drawDotBatch(baseBandRim, dotBaseR * 0.72, palette.dotBase, 0.38);
      drawDotBatch(baseBandMid, dotBaseR * 0.88, palette.dotBase, 0.72);
      drawDotBatch(baseBandNear, dotBaseR, palette.dotBase, 1);
      drawDotBatch(activeBandRim, dotBaseR * 0.9, palette.dotActive, 0.52);
      drawDotBatch(activeBandNear, dotBaseR * 1.12, palette.dotActive, 0.88);
      drawDotBatch(focusPoints, dotBaseR * 1.24, palette.dotFocus, 1);

      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = palette.rim;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 0.8, -Math.PI * 0.88, -Math.PI * 0.36);
      ctx.strokeStyle = palette.rimSpec;
      ctx.lineWidth = 1.1;
      ctx.globalAlpha = 0.55;
      ctx.stroke();
      ctx.restore();

      for (let idx = 0; idx < rotatedArcs.length; idx++) {
        const { geom, buf } = rotatedArcs[idx];
        const isRel =
          spotlightRegion !== null &&
          (geom.arc.from.hub.code === spotlightRegion || geom.arc.to.hub.code === spotlightRegion);
        const isDim = spotlightRegion !== null && !isRel;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = isRel ? 1.45 : 0.95;
        ctx.strokeStyle = isRel ? palette.arcActive : palette.arcBase;
        ctx.globalAlpha = isDim ? 0.18 : geom.arc.active ? 0.92 : 0.42;
        drawArcPortion(buf, geom.segments, centerX, centerY, radius, false);
        ctx.restore();

        if (!geom.arc.active || reducedMotion) continue;

        const arcAlphaScale = isDim ? 0.2 : isRel ? 1 : 0.86;
        const headPhase = ((elapsedSec / geom.arc.durationSec) + geom.phaseOffset) % 1;
        const tailSteps = 10;
        const tailSpan = 0.15;

        ctx.save();
        ctx.lineCap = 'round';
        for (let step = 0; step < tailSteps; step++) {
          const frac0 = step / tailSteps;
          const frac1 = (step + 1) / tailSteps;
          const t0 = headPhase - (1 - frac0) * tailSpan;
          const t1 = headPhase - (1 - frac1) * tailSpan;
          if (t1 <= 0 || t0 >= 1) continue;
          const pt0 = sampleArcPoint(buf, geom.segments, Math.max(0, t0));
          const pt1 = sampleArcPoint(buf, geom.segments, Math.min(1, t1));
          if (
            !isElevatedPointVisible(pt0.rx, pt0.ry, pt0.rz) ||
            !isElevatedPointVisible(pt1.rx, pt1.ry, pt1.rz)
          ) {
            continue;
          }
          ctx.beginPath();
          ctx.moveTo(centerX + pt0.rx * radius, centerY - pt0.ry * radius);
          ctx.lineTo(centerX + pt1.rx * radius, centerY - pt1.ry * radius);
          ctx.strokeStyle = palette.arcPulse;
          ctx.lineWidth = 0.75 + frac1 * (isRel ? 1.75 : 1.35);
          ctx.globalAlpha = Math.pow(frac1, 1.55) * 0.85 * arcAlphaScale;
          ctx.stroke();
        }

        const headPt = sampleArcPoint(buf, geom.segments, headPhase);
        if (isElevatedPointVisible(headPt.rx, headPt.ry, headPt.rz)) {
          const hx = centerX + headPt.rx * radius;
          const hy = centerY - headPt.ry * radius;
          ctx.globalAlpha = 0.3 * arcAlphaScale;
          ctx.fillStyle = palette.arcPulse;
          ctx.beginPath();
          ctx.arc(hx, hy, isRel ? 5.6 : 4.6, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = 0.96 * arcAlphaScale;
          ctx.fillStyle = palette.arcHead;
          ctx.beginPath();
          ctx.arc(hx, hy, isRel ? 2.2 : 1.85, 0, Math.PI * 2);
          ctx.fill();
        }

        const retPhase =
          1 - (((elapsedSec / (geom.arc.durationSec * 1.32)) + geom.phaseOffset * 1.37) % 1);
        const retPt = sampleArcPoint(buf, geom.segments, retPhase);
        if (isElevatedPointVisible(retPt.rx, retPt.ry, retPt.rz)) {
          const rxPos = centerX + retPt.rx * radius;
          const ryPos = centerY - retPt.ry * radius;
          const retTail = sampleArcPoint(buf, geom.segments, Math.min(1, retPhase + 0.055));
          if (isElevatedPointVisible(retTail.rx, retTail.ry, retTail.rz)) {
            ctx.beginPath();
            ctx.moveTo(centerX + retTail.rx * radius, centerY - retTail.ry * radius);
            ctx.lineTo(rxPos, ryPos);
            ctx.strokeStyle = palette.arcReturn;
            ctx.lineWidth = 1.15;
            ctx.globalAlpha = 0.55 * arcAlphaScale;
            ctx.stroke();
          }
          ctx.globalAlpha = 0.85 * arcAlphaScale;
          ctx.fillStyle = palette.arcReturn;
          ctx.beginPath();
          ctx.arc(rxPos, ryPos, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const curClusters = clustersRef.current;
      const anchors = anchorsRef.current;
      const projectedFlags: ProjectedFlag[] = [];
      const defaultHalfW = isCompact ? 9 : 10.5;
      const defaultHalfH = isCompact ? 6 : 7;

      for (let idx = 0; idx < curClusters.length; idx++) {
        const cluster = curClusters[idx];
        const code = cluster.hub.code;
        const anchor = anchors.get(code);
        if (!anchor) continue;

        const rotPos = rotateForView(
          anchor.pos.x,
          anchor.pos.y,
          anchor.pos.z,
          cosLon,
          sinLon,
          cosLat,
          sinLat,
        );
        const vis = smoothstep(-0.02, 0.16, rotPos.z);
        const pinX = centerX + rotPos.x * radius;
        const pinY = centerY - rotPos.y * radius;

        const rotTan = rotateForView(
          anchor.tangentDir.x,
          anchor.tangentDir.y,
          anchor.tangentDir.z,
          cosLon,
          sinLon,
          cosLat,
          sinLat,
        );
        let fallbackDirX = rotTan.x;
        let fallbackDirY = -rotTan.y;
        const tanLen = Math.hypot(fallbackDirX, fallbackDirY);
        if (tanLen > 0.001) {
          fallbackDirX /= tanLen;
          fallbackDirY /= tanLen;
        } else {
          fallbackDirX = 0;
          fallbackDirY = -1;
        }

        const measured = placardSizesRef.current.get(code);
        const halfW = measured?.halfW ?? defaultHalfW;
        const halfH = measured?.halfH ?? defaultHalfH;
        const inViewport =
          pinX >= -halfW - 14 &&
          pinX <= width + halfW + 14 &&
          pinY >= -halfH - 14 &&
          pinY <= height + halfH + 14;

        projectedFlags.push({
          cluster,
          pinX,
          pinY,
          depthZ: rotPos.z,
          vis,
          cardX: pinX,
          cardY: pinY,
          halfW,
          halfH,
          fallbackDirX,
          fallbackDirY,
          inViewport,
          isSelected: activeRegion === code,
          isHovered: hoveredRegion === code,
        });
      }

      const visibleForRelax = projectedFlags.filter((item) => item.vis > 0.04 && item.inViewport);
      const maxDrift = isCompact ? 26 : 36;
      for (let pass = 0; pass < 6; pass++) {
        const relaxFactor = pass === 5 ? 1 : 0.78;
        for (let first = 0; first < visibleForRelax.length; first++) {
          const itemA = visibleForRelax[first];
          for (let second = first + 1; second < visibleForRelax.length; second++) {
            const itemB = visibleForRelax[second];
            const diffX = itemB.cardX - itemA.cardX;
            const diffY = itemB.cardY - itemA.cardY;
            const reqX = itemA.halfW + itemB.halfW + 4;
            const reqY = itemA.halfH + itemB.halfH + 4;
            const overlapX = reqX - Math.abs(diffX);
            const overlapY = reqY - Math.abs(diffY);
            if (overlapX <= 0 || overlapY <= 0) continue;

            let dirX = diffX;
            let dirY = diffY;
            let dirLen = Math.hypot(dirX, dirY);
            if (dirLen < 0.5) {
              dirX = itemB.pinX - itemA.pinX;
              dirY = itemB.pinY - itemA.pinY;
              dirLen = Math.hypot(dirX, dirY);
            }
            if (dirLen < 0.5) {
              dirX = itemB.fallbackDirX - itemA.fallbackDirX;
              dirY = itemB.fallbackDirY - itemA.fallbackDirY;
              dirLen = Math.hypot(dirX, dirY);
            }
            if (dirLen < 0.001) {
              dirX = 1;
              dirY = 0;
              dirLen = 1;
            }

            const ux = dirX / dirLen;
            const uy = dirY / dirLen;
            const absUx = Math.abs(ux);
            const absUy = Math.abs(uy);
            const clearX = absUx > 1e-4 ? (reqX - Math.abs(diffX)) / absUx : Infinity;
            const clearY = absUy > 1e-4 ? (reqY - Math.abs(diffY)) / absUy : Infinity;
            const pushDist = Math.min(clearX, clearY) * relaxFactor;

            const weightA = itemA.isHovered || itemA.isSelected ? 0.2 : 0.5;
            const weightB = itemB.isHovered || itemB.isSelected ? 0.2 : 0.5;
            const sumW = weightA + weightB;
            const shareA = weightA / sumW;
            const shareB = weightB / sumW;

            itemA.cardX -= ux * pushDist * shareA;
            itemA.cardY -= uy * pushDist * shareA;
            itemB.cardX += ux * pushDist * shareB;
            itemB.cardY += uy * pushDist * shareB;

            const driftA = Math.hypot(itemA.cardX - itemA.pinX, itemA.cardY - itemA.pinY);
            if (driftA > maxDrift) {
              const scaleA = maxDrift / driftA;
              itemA.cardX = itemA.pinX + (itemA.cardX - itemA.pinX) * scaleA;
              itemA.cardY = itemA.pinY + (itemA.cardY - itemA.pinY) * scaleA;
            }
            const driftB = Math.hypot(itemB.cardX - itemB.pinX, itemB.cardY - itemB.pinY);
            if (driftB > maxDrift) {
              const scaleB = maxDrift / driftB;
              itemB.cardX = itemB.pinX + (itemB.cardX - itemB.pinX) * scaleB;
              itemB.cardY = itemB.pinY + (itemB.cardY - itemB.pinY) * scaleB;
            }
          }
        }
      }

      for (let idx = 0; idx < projectedFlags.length; idx++) {
        const item = projectedFlags[idx];
        const code = item.cluster.hub.code;
        const btn = placardRefs.current.get(code);
        if (!btn) continue;

        if (item.vis <= 0.01 || !item.inViewport) {
          btn.style.visibility = 'hidden';
          btn.style.opacity = '0';
          btn.style.pointerEvents = 'none';
          continue;
        }

        const isDimmed = spotlightRegion !== null && spotlightRegion !== code;
        const flagAlpha = item.vis * (isDimmed ? 0.44 : 1);
        const depthScale = 0.82 + 0.18 * Math.sqrt(clampVal(item.depthZ, 0, 1));
        const zOrder = item.isHovered
          ? 50
          : item.isSelected
            ? 40
            : Math.round(10 + item.depthZ * 20);
        btn.style.visibility = 'visible';
        btn.style.opacity = String(Number(flagAlpha.toFixed(3)));
        btn.style.pointerEvents = item.depthZ > 0.05 && !isDragging ? 'auto' : 'none';
        btn.style.zIndex = String(zOrder);
        btn.style.transform = `translate3d(${item.cardX.toFixed(1)}px, ${item.cardY.toFixed(1)}px, 0) translate(-50%, -50%) scale(${depthScale.toFixed(3)})`;
      }

      rafHandle = window.requestAnimationFrame(renderFrame);
    };

    rafHandle = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(rafHandle);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      stageEl.removeEventListener('wheel', onWheel);
    };
  }, [reducedMotion]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const targetEl = event.target as HTMLElement | null;
    if (targetEl?.closest('.kdc-globe-controls')) return;

    const pointers = activePointersRef.current;
    pointers.set(event.pointerId, { posX: event.clientX, posY: event.clientY });
    const drag = dragStateRef.current;
    const nowMs = performance.now();

    if (pointers.size === 1) {
      drag.primaryId = event.pointerId;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      drag.lastMoveMs = nowMs;
      drag.moved = false;
      drag.captured = false;
      drag.pinchDist = 0;

      if (!targetEl?.closest('.kdc-globe-placard')) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.captured = true;
        } catch {
          drag.captured = false;
        }
      }
    } else if (pointers.size === 2) {
      const list = Array.from(pointers.values());
      drag.pinchDist = Math.hypot(list[1].posX - list[0].posX, list[1].posY - list[0].posY);
      drag.pinchMidX = (list[0].posX + list[1].posX) / 2;
      drag.pinchMidY = (list[0].posY + list[1].posY) / 2;
      drag.moved = true;
      drag.suppressClickUntil = nowMs + 320;
      cameraRef.current.fly = null;
      cameraRef.current.velLon = 0;
      cameraRef.current.velLat = 0;
      event.currentTarget.dataset.dragging = 'true';
    }
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pointers = activePointersRef.current;
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { posX: event.clientX, posY: event.clientY });

    const drag = dragStateRef.current;
    const cam = cameraRef.current;
    const nowMs = performance.now();

    if (pointers.size >= 2) {
      const list = Array.from(pointers.values());
      const nextDist = Math.hypot(list[1].posX - list[0].posX, list[1].posY - list[0].posY);
      const nextMidX = (list[0].posX + list[1].posX) / 2;
      const nextMidY = (list[0].posY + list[1].posY) / 2;
      if (drag.pinchDist > 12 && nextDist > 12) {
        cam.targetZoom = clampVal(cam.targetZoom * (nextDist / drag.pinchDist), MIN_ZOOM, MAX_ZOOM);
      }
      const degPerPx = (180 / Math.PI) / Math.max(80, stageMetricsRef.current.radius);
      const latCos = Math.max(0.42, Math.cos(cam.lat * DEG_TO_RAD));
      cam.lon = wrapLonDeg(cam.lon - ((nextMidX - drag.pinchMidX) * degPerPx) / latCos);
      cam.lat = clampVal(cam.lat + (nextMidY - drag.pinchMidY) * degPerPx, -MAX_LAT, MAX_LAT);
      drag.pinchDist = nextDist;
      drag.pinchMidX = nextMidX;
      drag.pinchMidY = nextMidY;
      cam.lastInteractMs = nowMs;
      return;
    }

    if (event.pointerId !== drag.primaryId) return;

    const totalMove = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moved && totalMove > 4.5) {
      drag.moved = true;
      drag.suppressClickUntil = nowMs + 280;
      cam.fly = null;
      cam.velLon = 0;
      cam.velLat = 0;
      event.currentTarget.dataset.dragging = 'true';
      if (!drag.captured) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.captured = true;
        } catch {
          drag.captured = false;
        }
      }
    }

    if (!drag.moved) return;

    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    const dtSec = Math.max(0.008, (nowMs - drag.lastMoveMs) / 1000);
    const degPerPx = (180 / Math.PI) / Math.max(80, stageMetricsRef.current.radius);
    const latCos = Math.max(0.42, Math.cos(cam.lat * DEG_TO_RAD));
    const stepLon = (-deltaX * degPerPx) / latCos;
    const stepLat = deltaY * degPerPx;

    cam.lon = wrapLonDeg(cam.lon + stepLon);
    cam.lat = clampVal(cam.lat + stepLat, -MAX_LAT, MAX_LAT);

    const instVelLon = clampVal(stepLon / dtSec, -220, 220);
    const instVelLat = clampVal(stepLat / dtSec, -150, 150);
    cam.velLon = cam.velLon * 0.45 + instVelLon * 0.55;
    cam.velLat = cam.velLat * 0.45 + instVelLat * 0.55;

    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastMoveMs = nowMs;
    cam.lastInteractMs = nowMs;
  }, []);

  const finishPointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const pointers = activePointersRef.current;
    pointers.delete(event.pointerId);
    const drag = dragStateRef.current;
    const nowMs = performance.now();

    if (drag.captured && event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        drag.captured = false;
      }
      drag.captured = false;
    }

    if (pointers.size === 1) {
      const remainingEntry = pointers.entries().next().value;
      if (remainingEntry) {
        drag.primaryId = remainingEntry[0];
        drag.lastX = remainingEntry[1].posX;
        drag.lastY = remainingEntry[1].posY;
        drag.lastMoveMs = nowMs;
        drag.pinchDist = 0;
      }
      return;
    }

    if (pointers.size === 0) {
      if (drag.moved) {
        drag.suppressClickUntil = nowMs + 240;
        cameraRef.current.lastInteractMs = nowMs;
        if (nowMs - drag.lastMoveMs > 90) {
          cameraRef.current.velLon = 0;
          cameraRef.current.velLat = 0;
        }
      }
      drag.moved = false;
      drag.primaryId = -1;
      drag.pinchDist = 0;
      delete event.currentTarget.dataset.dragging;
    }
  }, []);

  const handleStageKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const cam = cameraRef.current;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        flyToLatLon(cam.lat, cam.lon - 24, 340);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        flyToLatLon(cam.lat, cam.lon + 24, 340);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        flyToLatLon(cam.lat + 16, cam.lon, 340);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        flyToLatLon(cam.lat - 16, cam.lon, 340);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        handleAdjustZoom(1.18);
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        handleAdjustZoom(1 / 1.18);
      } else if (event.key === '0') {
        event.preventDefault();
        handleResetView();
      }
    },
    [flyToLatLon, handleAdjustZoom, handleResetView],
  );

  const handlePlacardClick = useCallback(
    (code: string) => {
      if (performance.now() < dragStateRef.current.suppressClickUntil) return;
      onSelectRegion(activeCodeRef.current === code ? 'ALL' : code);
    },
    [onSelectRegion],
  );

  return (
    <div
      ref={stageRef}
      className="kdc-globe-stage"
      role="application"
      tabIndex={0}
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onKeyDown={handleStageKeyDown}
    >
      <canvas ref={canvasRef} className="kdc-globe-canvas" aria-hidden="true" />

      <div className="kdc-globe-placards" aria-label="全球区域国旗">
        {clusters.map((cluster) => {
          const code = cluster.hub.code;
          const isSelected = activeCode === code;
          const isHovered = hoveredCode === code;
          const isOffline = cluster.onlineCount === 0;

          return (
            <button
              key={code}
              ref={(el) => {
                if (el) {
                  placardRefs.current.set(code, el);
                } else {
                  placardRefs.current.delete(code);
                }
              }}
              type="button"
              className={`kdc-globe-placard${isSelected ? ' is-selected' : ''}${isHovered ? ' is-hovered' : ''}${isOffline ? ' is-off' : ''}`}
              aria-pressed={isSelected}
              aria-label={`${cluster.hub.name}，在线 ${cluster.onlineCount}/${cluster.nodes.length}`}
              onClick={() => handlePlacardClick(code)}
              onMouseEnter={() => onHoverRegion(code)}
              onMouseLeave={() => onHoverRegion(null)}
              onFocus={() => onHoverRegion(code)}
              onBlur={() => onHoverRegion(null)}
            >
              <RegionFlag code={code} size="md" className="kdc-globe-placard-flag" />
            </button>
          );
        })}
      </div>

      <div className="kdc-globe-hud-bar">
        <div className="kdc-globe-cue" aria-hidden="true">
          <span className="kdc-globe-cue-hint">拖拽旋转地球</span>
        </div>

        <div className="kdc-globe-controls">
          <Button
            className="kdc-globe-ctrl-btn"
            onClick={() => setAutoRotate((prev) => !prev)}
            aria-label={autoRotate ? '暂停地球自转' : '开启地球自转'}
            title={autoRotate ? '暂停自转' : '开启自转'}
          >
            {autoRotate ? (
              <Pause size={12} aria-hidden="true" />
            ) : (
              <Play size={12} aria-hidden="true" />
            )}
          </Button>
          <Button
            className="kdc-globe-ctrl-btn"
            onClick={() => handleAdjustZoom(1.18)}
            aria-label="放大地球仪"
            title="放大"
          >
            <Plus size={12} aria-hidden="true" />
          </Button>
          <Button
            className="kdc-globe-ctrl-btn"
            onClick={() => handleAdjustZoom(1 / 1.18)}
            aria-label="缩小地球仪"
            title="缩小"
          >
            <Minus size={12} aria-hidden="true" />
          </Button>
          <Button
            className="kdc-globe-ctrl-btn"
            onClick={handleResetView}
            aria-label="重置地球视角"
            title="复位视角"
          >
            <RotateCcw size={12} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
