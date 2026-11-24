import { useEffect, useMemo, useRef, useState } from 'react';
import { RegionFlag, RegionFlagGlyph } from '@/components/ui/RegionFlag';
import {
  WORLD_COUNTRY_DOTS,
  WORLD_DOT_STEP,
  WORLD_DOT_X0,
  WORLD_DOT_Y0,
} from '@/data/worldMapDots';
import {
  buildInterRegionLinks,
  buildRegionClusters,
  MAP_HEIGHT,
  MAP_WIDTH,
  projectLatLon,
  type RegionCluster,
} from '@/lib/geoRegions';
import { formatNetSpeed } from '@/lib/formatters';
import type { NodeInfo } from '@/types/rack';

interface GlobalNodeMapProps {
  nodes: NodeInfo[];
  selectedNodeId: string | null;
  focusedRegionCode?: string | null;
  onJumpToNode: (nodeId: string) => void;
  onClose: () => void;
}

function decodeDot(packed: number): [number, number] {
  const col = packed >> 7;
  const row = packed & 127;
  return [
    Math.round((WORLD_DOT_X0 + col * WORLD_DOT_STEP) * 10) / 10,
    Math.round((WORLD_DOT_Y0 + row * WORLD_DOT_STEP) * 10) / 10,
  ];
}

function dotsToPath(coords: [number, number][]): string {
  if (coords.length === 0) return '';
  let out = '';
  for (let i = 0; i < coords.length; i++) {
    out += `M${coords[i][0]} ${coords[i][1]}h.01`;
  }
  return out;
}

// Pre-decode all land dots once at module load for instant renders
const ALL_DECODED_BY_ISO: { iso: string; coords: [number, number][] }[] = Object.entries(
  WORLD_COUNTRY_DOTS,
).map(([iso, packed]) => ({
  iso,
  coords: packed.map(decodeDot),
}));

const ALL_LAND_COORDS: [number, number][] = ALL_DECODED_BY_ISO.flatMap((g) => g.coords);

// Pre-computed architectural cartographic graticule lines matching projectLatLon exactly
const GRATICULE_PARALLELS = [
  { lat: 60, label: '60°N', isEq: false },
  { lat: 30, label: '30°N', isEq: false },
  { lat: 0, label: '0° EQ', isEq: true },
  { lat: -30, label: '30°S', isEq: false },
].map((spec) => {
  const left = projectLatLon(spec.lat, -169);
  const right = projectLatLon(spec.lat, 189);
  return { ...spec, x1: left.x, x2: right.x, y: left.y };
});

const GRATICULE_MERIDIANS = [
  { lon: -120, label: '120°W', isPrime: false },
  { lon: -60, label: '60°W', isPrime: false },
  { lon: 0, label: '0° UTC', isPrime: true },
  { lon: 60, label: '60°E', isPrime: false },
  { lon: 120, label: '120°E', isPrime: false },
].map((spec) => {
  const lats = [72, 54, 36, 18, 0, -18, -36, -50];
  const pts = lats.map((lat) => projectLatLon(lat, spec.lon));
  const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const bottom = pts[pts.length - 1];
  return { ...spec, d, labelX: bottom.x, labelY: bottom.y + 14 };
});

function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} · ${Math.abs(lon).toFixed(1)}°${ew}`;
}

function formatUtcClock(now: Date): string {
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Light collision avoidance for hub flag pills so nearby regions (e.g. HK/TW, GB/NL/DE, JP/KR)
 * stay crisp and legible without overlapping.
 */
function computeLabelOffsets(clusters: RegionCluster[]): Map<string, { dx: number; dy: number }> {
  const map = new Map<string, { dx: number; dy: number }>();
  const placed: { x: number; y: number }[] = [];

  // Prefer placing active/larger hubs first in their natural spot above the pin
  for (const c of clusters) {
    const candidates = [
      { dx: 0, dy: -22 },
      { dx: 0, dy: 24 },
      { dx: 38, dy: -16 },
      { dx: -38, dy: -16 },
      { dx: 42, dy: 16 },
      { dx: -42, dy: 16 },
      { dx: 0, dy: -38 },
      { dx: 0, dy: 38 },
    ];

    let chosen = candidates[0];
    for (const cand of candidates) {
      const cx = c.x + cand.dx;
      const cy = c.y + cand.dy;
      if (cx < 44 || cx > MAP_WIDTH - 44 || cy < 22 || cy > MAP_HEIGHT - 22) continue;
      const collides = placed.some((p) => Math.abs(p.x - cx) < 62 && Math.abs(p.y - cy) < 22);
      if (!collides) {
        chosen = cand;
        break;
      }
    }
    placed.push({ x: c.x + chosen.dx, y: c.y + chosen.dy });
    map.set(c.hub.code, chosen);
  }
  return map;
}

export function GlobalNodeMap({
  nodes,
  selectedNodeId,
  focusedRegionCode,
  onJumpToNode,
  onClose,
}: GlobalNodeMapProps) {
  const clusters = useMemo(() => buildRegionClusters(nodes), [nodes]);
  const arcs = useMemo(() => buildInterRegionLinks(clusters), [clusters]);
  const labelOffsets = useMemo(() => computeLabelOffsets(clusters), [clusters]);

  const [activeCode, setActiveCode] = useState<string | null>(
    focusedRegionCode ?? clusters[0]?.hub.code ?? null,
  );
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (focusedRegionCode && clusters.some((c) => c.hub.code === focusedRegionCode)) {
      setActiveCode(focusedRegionCode);
      setSheetCollapsed(false);
    }
  }, [focusedRegionCode, clusters]);

  const activeClusterIndex = useMemo(() => {
    if (clusters.length === 0) return -1;
    if (activeCode) {
      const idx = clusters.findIndex((c) => c.hub.code === activeCode);
      if (idx >= 0) return idx;
    }
    if (focusedRegionCode) {
      const idx = clusters.findIndex((c) => c.hub.code === focusedRegionCode);
      if (idx >= 0) return idx;
    }
    return 0;
  }, [clusters, activeCode, focusedRegionCode]);

  const activeCluster: RegionCluster | null =
    activeClusterIndex >= 0 ? clusters[activeClusterIndex] : null;
  const flagStripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const strip = flagStripRef.current;
    if (!strip || !activeCluster) return;
    const activeBtn = strip.querySelector<HTMLButtonElement>(
      `[data-region-code="${activeCluster.hub.code}"]`,
    );
    activeBtn?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeCluster?.hub.code]);

  const stepRegion = (delta: -1 | 1) => {
    if (clusters.length <= 1) return;
    const nextIdx = (activeClusterIndex + delta + clusters.length) % clusters.length;
    setActiveCode(clusters[nextIdx].hub.code);
  };

  const focusCode = hoveredCode ?? activeCluster?.hub.code ?? null;

  // Partition Natural Earth dot matrix into: base landmasses, illuminated deployed regions, and focused region
  const dotPaths = useMemo(() => {
    const deployedCodes = new Set(clusters.filter((c) => c.onlineCount > 0).map((c) => c.hub.code));
    // Also light regions that have nodes even if currently offline, slightly softer via deployed set
    for (const c of clusters) deployedCodes.add(c.hub.code);

    const baseCoords: [number, number][] = [];
    const litCoords: [number, number][] = [];
    const focusCoords: [number, number][] = [];

    for (const group of ALL_DECODED_BY_ISO) {
      if (group.iso !== '_' && group.iso === focusCode) {
        focusCoords.push(...group.coords);
      } else if (group.iso !== '_' && deployedCodes.has(group.iso)) {
        litCoords.push(...group.coords);
      } else {
        baseCoords.push(...group.coords);
      }
    }

    // For regions/city-states without dedicated 110m dot polygons (e.g. HK, SG, MO, MA), illuminate nearby land dots
    for (const c of clusters) {
      const existing = WORLD_COUNTRY_DOTS[c.hub.code];
      if (!existing || existing.length < 4) {
        const radius = Math.min(26, Math.max(17, (c.hub.radius ?? 20) * 0.88));
        const radiusSq = radius * radius;
        const targetArr = c.hub.code === focusCode ? focusCoords : litCoords;
        for (let i = 0; i < ALL_LAND_COORDS.length; i++) {
          const pt = ALL_LAND_COORDS[i];
          const dx = pt[0] - c.x;
          const dy = pt[1] - c.y;
          if (dx * dx + dy * dy <= radiusSq) {
            targetArr.push(pt);
          }
        }
      }
    }

    return {
      base: dotsToPath(baseCoords),
      lit: dotsToPath(litCoords),
      focus: dotsToPath(focusCoords),
    };
  }, [clusters, focusCode]);

  const fleetSummary = useMemo(() => {
    const onlineNodes = nodes.filter((n) => n.online);
    const totalOnline = onlineNodes.length;
    const totalNetDown = onlineNodes.reduce((sum, n) => sum + n.netDown, 0);
    const totalNetUp = onlineNodes.reduce((sum, n) => sum + n.netUp, 0);
    const avgCpu =
      totalOnline > 0
        ? Math.round(onlineNodes.reduce((sum, n) => sum + n.cpu, 0) / totalOnline)
        : 0;
    const avgRam =
      totalOnline > 0
        ? Math.round(onlineNodes.reduce((sum, n) => sum + n.ram, 0) / totalOnline)
        : 0;
    const pingNodes = onlineNodes.filter((n) => n.ping > 0);
    const avgPing =
      pingNodes.length > 0
        ? Math.round(pingNodes.reduce((sum, n) => sum + n.ping, 0) / pingNodes.length)
        : 0;
    const healthTone: 'ok' | 'warn' | 'crit' =
      totalOnline === 0
        ? 'crit'
        : totalOnline < nodes.length
          ? 'warn'
          : avgCpu >= 85 || avgRam >= 90
            ? 'warn'
            : 'ok';
    return { totalOnline, totalNetDown, totalNetUp, avgCpu, avgRam, avgPing, healthTone };
  }, [nodes]);

  const utcClock = useMemo(() => formatUtcClock(now), [now]);

  return (
    <section className="wmap-stage" aria-label="全球节点分布与互联视图">
      {/* Unified Minimalist Studio Ambient Backdrop */}
      <div className="wmap-backdrop" aria-hidden="true">
        <div className="wmap-soft-glow" />
      </div>

      {/* Top-Center Floating Global Fleet Telemetry Ribbon */}
      <div className="wmap-top-ribbon" role="status" aria-label="全球集群实时态势">
        <div className="wmap-ribbon-item">
          <span className={`wmap-ribbon-dot is-${fleetSummary.healthTone}`} aria-hidden="true" />
          <span className="wmap-ribbon-label">全球节点</span>
          <b className="wmap-ribbon-val">
            {fleetSummary.totalOnline}/{nodes.length}
          </b>
          <span className="wmap-ribbon-sub">{clusters.length} 区</span>
        </div>

        <span className="wmap-ribbon-sep" aria-hidden="true" />

        <div className="wmap-ribbon-item">
          <span className="wmap-ribbon-label">实时吞吐</span>
          <b className="wmap-ribbon-val">↓{formatNetSpeed(fleetSummary.totalNetDown, true)}</b>
          <span className="wmap-ribbon-sub wmap-hide-xs">
            ↑{formatNetSpeed(fleetSummary.totalNetUp, true)}
          </span>
        </div>

        <span className="wmap-ribbon-sep wmap-hide-sm" aria-hidden="true" />

        <div className="wmap-ribbon-item wmap-hide-sm">
          <span className="wmap-ribbon-label">集群均载</span>
          <b className="wmap-ribbon-val">CPU {fleetSummary.avgCpu}%</b>
          <span className="wmap-ribbon-sub">MEM {fleetSummary.avgRam}%</span>
        </div>

        <span className="wmap-ribbon-sep wmap-hide-md" aria-hidden="true" />

        <div className="wmap-ribbon-item wmap-hide-md">
          <span className="wmap-ribbon-label">均延迟</span>
          <b className="wmap-ribbon-val">
            {fleetSummary.avgPing > 0 ? `${fleetSummary.avgPing} ms` : '—'}
          </b>
        </div>

        <span className="wmap-ribbon-sep wmap-hide-md" aria-hidden="true" />

        <div className="wmap-ribbon-item wmap-hide-md">
          <span className="wmap-ribbon-label">UTC</span>
          <b className="wmap-ribbon-val">{utcClock}</b>
        </div>
      </div>

      {/* Main Precision Dot-Matrix World Canvas */}
      <div className={`wmap-canvas-wrap${sheetCollapsed ? ' is-expanded' : ''}`}>
        <svg
          className="wmap-svg"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="全球服务器节点点阵世界地图"
        >
          <defs>
            <radialGradient id="wmapAuraActive" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--wmap-aura)" stopOpacity="0.34" />
              <stop offset="55%" stopColor="var(--wmap-aura)" stopOpacity="0.09" />
              <stop offset="100%" stopColor="var(--wmap-aura)" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="wmapAuraFocus" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--wmap-aura-focus)" stopOpacity="0.46" />
              <stop offset="50%" stopColor="var(--wmap-aura-focus)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--wmap-aura-focus)" stopOpacity="0" />
            </radialGradient>

            <filter id="wmapSoftBlur" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>

          {/* 0. Precision Cartographic Graticule & Studio Corner Brackets */}
          <g className="wmap-graticule" aria-hidden="true">
            {GRATICULE_PARALLELS.map((p) => (
              <g key={`lat-${p.lat}`}>
                <line
                  x1={p.x1}
                  y1={p.y}
                  x2={p.x2}
                  y2={p.y}
                  className={`wmap-grat-line${p.isEq ? ' is-major' : ''}`}
                />
                <text x={p.x1 - 8} y={p.y + 3} textAnchor="end" className="wmap-grat-label">
                  {p.label}
                </text>
              </g>
            ))}
            {GRATICULE_MERIDIANS.map((m) => (
              <g key={`lon-${m.lon}`}>
                <path
                  d={m.d}
                  className={`wmap-grat-line${m.isPrime ? ' is-major' : ''}`}
                />
                <text x={m.labelX} y={m.labelY} textAnchor="middle" className="wmap-grat-label">
                  {m.label}
                </text>
              </g>
            ))}
            {/* Four subtle architectural studio registration brackets */}
            <path
              d="M14 26V14H26 M986 26V14H974 M14 454V466H26 M986 454V466H974"
              className="wmap-frame-bracket"
            />
          </g>

          {/* 1. Whisper-Soft Regional Illumination Halos under Deployed Countries */}
          <g className="wmap-auras">
            {clusters.map((cluster) => {
              const isFocus = cluster.hub.code === focusCode;
              const r = (cluster.hub.radius ?? 24) * (isFocus ? 2.15 : 1.55);
              return (
                <circle
                  key={`aura-${cluster.hub.code}`}
                  cx={cluster.x}
                  cy={cluster.y}
                  r={r}
                  fill={isFocus ? 'url(#wmapAuraFocus)' : 'url(#wmapAuraActive)'}
                  opacity={cluster.onlineCount > 0 ? 1 : 0.35}
                />
              );
            })}
          </g>

          {/* 2. Natural Earth 110m Precision Dot-Matrix Continents (just 3 crisp SVG paths) */}
          <g className="wmap-dots-layer">
            <path d={dotPaths.base} className="wmap-dots-base" />
            {dotPaths.lit && <path d={dotPaths.lit} className="wmap-dots-lit" />}
            {dotPaths.focus && <path d={dotPaths.focus} className="wmap-dots-focus" />}
          </g>

          {/* 3. Delicate Inter-Region Optical Exchange Arcs */}
          <g className="wmap-arcs">
            {arcs.map((arc, idx) => {
              const isRelated =
                focusCode != null &&
                (arc.from.hub.code === focusCode || arc.to.hub.code === focusCode);
              return (
                <g
                  key={arc.id}
                  className={`wmap-arc-group${isRelated ? ' is-related' : ''}${arc.active ? '' : ' is-dim'}`}
                >
                  <path d={arc.pathD} className="wmap-arc-line" />

                  {arc.active && (
                    <>
                      <circle
                        r={isRelated ? 2.2 : 1.65}
                        className="wmap-arc-photon"
                        filter="url(#wmapSoftBlur)"
                      >
                        <animateMotion
                          dur={`${arc.durationSec}s`}
                          begin={`${(idx * 0.48) % 2.4}s`}
                          repeatCount="indefinite"
                          path={arc.pathD}
                          calcMode="spline"
                          keyTimes="0;1"
                          keySplines="0.4 0 0.2 1"
                        />
                      </circle>
                      {isRelated && (
                        <circle r="1.5" className="wmap-arc-photon-return">
                          <animateMotion
                            dur={`${(arc.durationSec * 1.18).toFixed(1)}s`}
                            begin={`${(idx * 0.65 + 0.9) % 2.8}s`}
                            repeatCount="indefinite"
                            keyPoints="1;0"
                            keyTimes="0;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1"
                            path={arc.pathD}
                          />
                        </circle>
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </g>

          {/* 4. Refined Hub Pinpoints & Minimal Glass Flag Pills */}
          <g className="wmap-hubs">
            {clusters.map((cluster) => {
              const isSelected = activeCluster?.hub.code === cluster.hub.code;
              const isOnline = cluster.onlineCount > 0;
              const offset = labelOffsets.get(cluster.hub.code) ?? { dx: 0, dy: -22 };
              const hasMulti = cluster.nodes.length > 1;
              const pillW = hasMulti ? 64 : 48;
              const flagW = 13.5;
              const flagH = 9;
              const flagX = -pillW / 2 + (hasMulti ? 8 : 7.5);
              const textX = flagX + flagW + 4.5;

              return (
                <g
                  key={cluster.hub.code}
                  className={`wmap-hub${isSelected ? ' is-selected' : ''}${isOnline ? '' : ' is-offline'}`}
                  transform={`translate(${cluster.x}, ${cluster.y})`}
                  onClick={() => setActiveCode(cluster.hub.code)}
                  onMouseEnter={() => setHoveredCode(cluster.hub.code)}
                  onMouseLeave={() => setHoveredCode(null)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${cluster.hub.name}，${cluster.onlineCount}/${cluster.nodes.length} 在线`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveCode(cluster.hub.code);
                    }
                  }}
                >
                  {/* Generous invisible touch hit target for reliable mobile tapping */}
                  <circle r="30" fill="transparent" className="wmap-pin-hit" />

                  {/* Quiet breathing pulse ring on selected or primary online hub */}
                  {isOnline && (
                    <circle
                      r={isSelected ? 10 : 7}
                      className={`wmap-pin-halo${isSelected ? ' is-breathing' : ''}`}
                    />
                  )}

                  {/* Precision Pin Core + Subtle Selected Reticle */}
                  {isSelected && (
                    <g className="wmap-pin-reticle" aria-hidden="true">
                      <circle r="13.5" className="wmap-pin-reticle-ring" />
                      <path
                        d="M0 -17.5v3M0 14.5v3M-17.5 0h3M14.5 0h3"
                        className="wmap-pin-reticle-tick"
                      />
                    </g>
                  )}
                  <circle r={isSelected ? 4.2 : 3.2} className="wmap-pin-core" />

                  {/* Delicate hair-line stem when pill is nudged away */}
                  {(Math.abs(offset.dx) > 12 || Math.abs(offset.dy) > 26) && (
                    <line
                      x1="0"
                      y1="0"
                      x2={offset.dx * 0.72}
                      y2={offset.dy * 0.68}
                      className="wmap-pin-stem"
                    />
                  )}

                  {/* Ultra-Clean Minimal Glass Flag Pill with Crisp Flat Vector Flag */}
                  <g
                    className="wmap-pin-pill"
                    transform={`translate(${offset.dx}, ${offset.dy})`}
                  >
                    <rect
                      x={-pillW / 2 - 8}
                      y={-18}
                      width={pillW + 16}
                      height="36"
                      rx="18"
                      fill="transparent"
                    />
                    <rect
                      x={-pillW / 2}
                      y={-10.5}
                      width={pillW}
                      height="21"
                      rx="10.5"
                      className="wmap-pill-bg"
                    />
                    <RegionFlagGlyph
                      code={cluster.hub.code}
                      x={flagX}
                      y={-flagH / 2}
                      width={flagW}
                      height={flagH}
                    />
                    <text
                      x={textX}
                      y="3.6"
                      textAnchor="start"
                      className="wmap-pill-text"
                    >
                      {cluster.hub.code}
                      {hasMulti ? ` · ${cluster.onlineCount}` : ''}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Centered Bottom Floating Region & Node Console HUD */}
      {activeCluster && (
        <aside
          className={`wmap-sheet${sheetCollapsed ? ' is-collapsed' : ''}`}
          aria-label="全球区域与节点控制台"
        >
          <header className="wmap-sheet-head">
            <div className="wmap-region-id">
              <span className="wmap-region-flag">
                <RegionFlag code={activeCluster.hub.code} size="lg" />
              </span>
              <div className="wmap-region-meta">
                <div className="wmap-region-title-row">
                  <strong>
                    {activeCluster.hub.name}
                    <em>{activeCluster.hub.code}</em>
                  </strong>
                  <span className="wmap-region-coord wmap-hide-xs">
                    {formatLatLon(activeCluster.hub.lat, activeCluster.hub.lon)}
                  </span>
                </div>
                <span className="wmap-region-sub">
                  {activeCluster.onlineCount}/{activeCluster.nodes.length} 在线 · CPU{' '}
                  {Math.round(activeCluster.avgCpu)}% · ↓
                  {formatNetSpeed(activeCluster.totalNetDown, true)} · ↑
                  {formatNetSpeed(activeCluster.totalNetUp, true)}
                  {activeCluster.avgPing > 0 ? ` · ${activeCluster.avgPing} ms` : ''}
                </span>
              </div>
            </div>

            <div className="wmap-head-actions">
              {clusters.length > 1 && (
                <div className="wmap-region-stepper" role="group" aria-label="切换区域">
                  <button
                    type="button"
                    className="wmap-step-btn"
                    onClick={() => stepRegion(-1)}
                    title="上一区域"
                    aria-label="上一区域"
                  >
                    ‹
                  </button>
                  <span className="wmap-step-idx">
                    {activeClusterIndex + 1}/{clusters.length}
                  </span>
                  <button
                    type="button"
                    className="wmap-step-btn"
                    onClick={() => stepRegion(1)}
                    title="下一区域"
                    aria-label="下一区域"
                  >
                    ›
                  </button>
                </div>
              )}

              <button
                type="button"
                className="wmap-back-btn wmap-collapse-btn"
                onClick={() => setSheetCollapsed((v) => !v)}
                aria-expanded={!sheetCollapsed}
                title={sheetCollapsed ? '展开节点明细' : '收起节点明细'}
              >
                {sheetCollapsed ? '展开' : '收起'}
              </button>

              <button type="button" className="wmap-back-btn is-primary" onClick={onClose}>
                返回机柜
              </button>
            </div>
          </header>

          {/* Horizontal Region Flag Pills with Live Node Counts */}
          <div ref={flagStripRef} className="wmap-flag-strip" role="tablist" aria-label="按地区切换">
            {clusters.map((c) => {
              const isAct = c.hub.code === activeCluster.hub.code;
              return (
                <button
                  key={c.hub.code}
                  type="button"
                  role="tab"
                  data-region-code={c.hub.code}
                  aria-selected={isAct}
                  className={`wmap-flag-tab${isAct ? ' is-active' : ''}${c.onlineCount === 0 ? ' is-off' : ''}`}
                  onClick={() => setActiveCode(c.hub.code)}
                >
                  <RegionFlag code={c.hub.code} size="xs" />
                  <span>{c.hub.name}</span>
                  <em className="wmap-flag-count">
                    {c.onlineCount}/{c.nodes.length}
                  </em>
                </button>
              );
            })}
          </div>

          {/* Multi-Column Hardware Node Cards inside Selected Region */}
          {!sheetCollapsed && (
            <div
              className={`wmap-node-list${activeCluster.nodes.length === 1 ? ' is-single' : ''}`}
            >
              {activeCluster.nodes.map((node) => {
                const cpuPct = Math.max(0, Math.min(100, Math.round(node.cpu)));
                const ramPct = Math.max(0, Math.min(100, Math.round(node.ram)));
                return (
                  <button
                    key={node.uuid}
                    type="button"
                    className={`wmap-node-row${node.uuid === selectedNodeId ? ' is-selected' : ''}${node.online ? '' : ' is-offline'}`}
                    onClick={() => onJumpToNode(node.uuid)}
                    title="切回机柜并定位该服务器"
                  >
                    <div className="wmap-node-top">
                      <div className="wmap-node-main">
                        <span className={`lg-status-dot ${node.online ? 'is-on' : 'is-off'}`} />
                        <span className="wmap-node-name">{node.name}</span>
                      </div>
                      <div className="wmap-node-top-right">
                        {node.online && node.ping > 0 && (
                          <span className="wmap-node-ping">{Math.round(node.ping)} ms</span>
                        )}
                        <span className="wmap-node-chevron" aria-hidden="true">
                          ›
                        </span>
                      </div>
                    </div>

                    {node.online ? (
                      <div className="wmap-node-bottom">
                        <div className="wmap-node-bars">
                          <span className="wmap-mini-metric">
                            <em>CPU</em>
                            <i className="wmap-mini-track">
                              <b style={{ width: `${cpuPct}%` }} />
                            </i>
                            <b>{cpuPct}%</b>
                          </span>
                          <span className="wmap-mini-metric">
                            <em>MEM</em>
                            <i className="wmap-mini-track">
                              <b style={{ width: `${ramPct}%` }} />
                            </i>
                            <b>{ramPct}%</b>
                          </span>
                        </div>
                        <div className="wmap-node-net">
                          <span>↓{formatNetSpeed(node.netDown, true)}</span>
                          <span>↑{formatNetSpeed(node.netUp, true)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="wmap-node-bottom">
                        <span className="is-off-txt">节点当前离线 · 点击前往机柜排查</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      )}
    </section>
  );
}
