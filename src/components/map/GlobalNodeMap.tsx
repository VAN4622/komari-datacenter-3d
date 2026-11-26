import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@ui-sdk/react/button';
import { Input } from '@ui-sdk/react/input';
import { Meter, MeterIndicator, MeterTrack } from '@ui-sdk/react/meter';
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';
import {
  ArrowLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Search,
  X,
} from 'lucide-react';
import { RegionFlag, RegionFlagGlyph } from '@/components/ui/RegionFlag';
import {
  WORLD_COUNTRY_DOTS,
  WORLD_DOT_STEP,
  WORLD_DOT_X0,
  WORLD_DOT_Y0,
} from '@/data/worldMapDots';
import { formatNetSpeed } from '@/lib/formatters';
import {
  buildInterRegionLinks,
  buildRegionClusters,
  projectLatLon,
  resolveNodeGeo,
  type DataLinkArc,
  type RegionCluster,
} from '@/lib/geoRegions';
import type { NodeInfo } from '@/types/rack';

interface GlobalNodeMapProps {
  nodes: NodeInfo[];
  selectedNodeId: string | null;
  focusedRegionCode?: string | null;
  onJumpToNode: (nodeId: string) => void;
  onClose: () => void;
}

type StatusFilter = 'all' | 'online' | 'offline';

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

const ALL_DECODED_BY_ISO: { iso: string; coords: [number, number][] }[] = Object.entries(
  WORLD_COUNTRY_DOTS,
).map(([iso, packed]) => ({
  iso,
  coords: packed.map(decodeDot),
}));

const ALL_LAND_PATH = dotsToPath(ALL_DECODED_BY_ISO.flatMap((g) => g.coords));

const VIEW_MIN_X = 36;
const VIEW_MIN_Y = 8;
const VIEW_WIDTH = 928;
const VIEW_HEIGHT = 456;
const VIEW_MAX_X = VIEW_MIN_X + VIEW_WIDTH;
const VIEW_MAX_Y = VIEW_MIN_Y + VIEW_HEIGHT;

const GRATICULE_PARALLELS = [
  { lat: 60, label: '60°N', isEq: false },
  { lat: 30, label: '30°N', isEq: false },
  { lat: 0, label: '0°', isEq: true },
  { lat: -30, label: '30°S', isEq: false },
].map((spec) => {
  const left = projectLatLon(spec.lat, -160);
  const right = projectLatLon(spec.lat, 178);
  return { ...spec, x1: left.x, x2: right.x, y: left.y };
});

const GRATICULE_MERIDIANS = [
  { lon: -120, label: '120°W', isPrime: false },
  { lon: -60, label: '60°W', isPrime: false },
  { lon: 0, label: '0°', isPrime: true },
  { lon: 60, label: '60°E', isPrime: false },
  { lon: 120, label: '120°E', isPrime: false },
].map((spec) => {
  const lats = [72, 54, 36, 18, 0, -18, -36, -50];
  const pts = lats.map((lat) => projectLatLon(lat, spec.lon));
  const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const bottom = pts[pts.length - 1];
  return { ...spec, d, labelX: bottom.x, labelY: bottom.y + 13 };
});

function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} · ${Math.abs(lon).toFixed(1)}°${ew}`;
}

function formatUtcClock(now: Date): string {
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

const PLACARD_HEIGHT = 22;
const PLACARD_HALF_H = PLACARD_HEIGHT / 2;
const PLACARD_FLAG_W = 16;
const PLACARD_FLAG_H = 10.6;

interface PlacardLayout {
  dx: number;
  dy: number;
  width: number;
  nameText: string;
  nameWidth: number;
  maxCountWidth: number;
}

interface SampledArcPoint {
  x: number;
  y: number;
  fromCode: string;
  toCode: string;
}

function estimateTextWidth(text: string, cjkUnit: number, asciiUnit: number): number {
  let total = 0;
  for (const ch of text) {
    total += ch.charCodeAt(0) > 127 ? cjkUnit : asciiUnit;
  }
  return total;
}

function formatClusterLabel(name: string): string {
  return name.length > 4 ? `${name.slice(0, 4)}…` : name;
}

function measureClusterPlacard(cluster: RegionCluster): Omit<PlacardLayout, 'dx' | 'dy'> {
  const nameText = formatClusterLabel(cluster.hub.name);
  const maxCountText = `${cluster.nodes.length}/${cluster.nodes.length}`;
  const nameWidth = estimateTextWidth(nameText, 9.8, 5.7);
  const maxCountWidth = estimateTextWidth(maxCountText, 8.6, 5.4);
  const width = Math.ceil(5.5 + PLACARD_FLAG_W + 5 + nameWidth + 5 + 5 + maxCountWidth + 5.5);
  return { width, nameText, nameWidth, maxCountWidth };
}

function sampleArcPoints(arcs: DataLinkArc[]): SampledArcPoint[] {
  const pts: SampledArcPoint[] = [];
  for (const arc of arcs) {
    const dist = Math.hypot(arc.to.x - arc.from.x, arc.to.y - arc.from.y);
    const steps = Math.max(24, Math.ceil(dist / 6));
    for (let step = 1; step < steps; step++) {
      const t = step / steps;
      const inv = 1 - t;
      const x = inv * inv * arc.from.x + 2 * inv * t * arc.ctrlX + t * t * arc.to.x;
      const y = inv * inv * arc.from.y + 2 * inv * t * arc.ctrlY + t * t * arc.to.y;
      pts.push({ x, y, fromCode: arc.from.hub.code, toCode: arc.to.hub.code });
    }
  }
  return pts;
}

function stableCodeDelay(code: string, periodSec: number): number {
  let hash = 0;
  for (let idx = 0; idx < code.length; idx++) {
    hash = (hash * 31 + code.charCodeAt(idx)) % 997;
  }
  return -((hash / 997) * periodSec);
}

function stemHitsBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  box: { left: number; right: number; top: number; bottom: number },
): boolean {
  const samples = 8;
  for (let idx = 1; idx < samples; idx++) {
    const t = idx / samples;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    if (px >= box.left - 2 && px <= box.right + 2 && py >= box.top - 2 && py <= box.bottom + 2) {
      return true;
    }
  }
  return false;
}

function computePlacardLayouts(
  clusters: RegionCluster[],
  arcs: DataLinkArc[],
): Map<string, PlacardLayout> {
  const map = new Map<string, PlacardLayout>();
  const placedBoxes: { left: number; right: number; top: number; bottom: number }[] = [];
  const placedStems: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const arcPoints = sampleArcPoints(arcs);

  const neighborCounts = new Map<string, number>();
  for (const c of clusters) {
    let near = 0;
    for (const other of clusters) {
      if (other.hub.code === c.hub.code) continue;
      if (Math.hypot(other.x - c.x, other.y - c.y) < 140) near++;
    }
    neighborCounts.set(c.hub.code, near);
  }
  const placementOrder = [...clusters].sort(
    (a, b) =>
      (neighborCounts.get(b.hub.code) ?? 0) - (neighborCounts.get(a.hub.code) ?? 0) ||
      b.nodes.length - a.nodes.length ||
      a.hub.code.localeCompare(b.hub.code),
  );

  const boundLeft = VIEW_MIN_X + 8;
  const boundRight = VIEW_MAX_X - 8;
  const boundTop = VIEW_MIN_Y + 8;
  const boundBottom = VIEW_MAX_Y - 12;

  for (const cluster of placementOrder) {
    const metrics = measureClusterPlacard(cluster);
    const halfW = metrics.width / 2;
    const halfH = PLACARD_HALF_H;

    const candidates = [
      { dx: 0, dy: 25 },
      { dx: 0, dy: -25 },
      { dx: halfW + 14, dy: 16 },
      { dx: -(halfW + 14), dy: 16 },
      { dx: halfW + 14, dy: -16 },
      { dx: -(halfW + 14), dy: -16 },
      { dx: halfW + 16, dy: 0 },
      { dx: -(halfW + 16), dy: 0 },
      { dx: halfW + 16, dy: -26 },
      { dx: -(halfW + 16), dy: -26 },
      { dx: 0, dy: 42 },
      { dx: 0, dy: -42 },
      { dx: halfW + 20, dy: 34 },
      { dx: -(halfW + 20), dy: 34 },
      { dx: halfW + 20, dy: -34 },
      { dx: -(halfW + 20), dy: -34 },
      { dx: halfW + 38, dy: 20 },
      { dx: -(halfW + 38), dy: 20 },
      { dx: halfW + 38, dy: -20 },
      { dx: -(halfW + 38), dy: -20 },
      { dx: 0, dy: 58 },
      { dx: 0, dy: -58 },
    ];

    let best = candidates[0];
    let bestPenalty = Number.POSITIVE_INFINITY;

    for (const cand of candidates) {
      const cx = cluster.x + cand.dx;
      const cy = cluster.y + cand.dy;
      const left = cx - halfW;
      const right = cx + halfW;
      const top = cy - halfH;
      const bottom = cy + halfH;

      if (left < boundLeft || right > boundRight || top < boundTop || bottom > boundBottom) {
        continue;
      }

      let penalty = Math.hypot(cand.dx, cand.dy) * 0.16;
      const candEdgeX = Math.max(left, Math.min(right, cluster.x));
      const candEdgeY = Math.max(top, Math.min(bottom, cluster.y));
      for (const box of placedBoxes) {
        const overlapX = Math.min(right + 5, box.right) - Math.max(left - 5, box.left);
        const overlapY = Math.min(bottom + 5, box.bottom) - Math.max(top - 5, box.top);
        if (overlapX > 0 && overlapY > 0) {
          penalty += overlapX * overlapY + 420;
        }
        if (stemHitsBox(cluster.x, cluster.y, candEdgeX, candEdgeY, box)) {
          penalty += 180;
        }
      }

      const candBox = { left, right, top, bottom };
      for (const stem of placedStems) {
        if (stemHitsBox(stem.x0, stem.y0, stem.x1, stem.y1, candBox)) {
          penalty += 180;
        }
      }

      for (const other of clusters) {
        if (other.hub.code === cluster.hub.code) continue;
        if (
          other.x >= left - 10 &&
          other.x <= right + 10 &&
          other.y >= top - 10 &&
          other.y <= bottom + 10
        ) {
          penalty += 260;
        }
      }

      for (const pt of arcPoints) {
        if (
          (pt.fromCode === cluster.hub.code || pt.toCode === cluster.hub.code) &&
          Math.hypot(pt.x - cluster.x, pt.y - cluster.y) < 15
        ) {
          continue;
        }
        if (
          pt.x >= left - 4 &&
          pt.x <= right + 4 &&
          pt.y >= top - 4 &&
          pt.y <= bottom + 4
        ) {
          penalty += 52;
        }
      }

      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = cand;
      }
    }

    const finalCx = Math.max(boundLeft + halfW, Math.min(boundRight - halfW, cluster.x + best.dx));
    const finalCy = Math.max(boundTop + halfH, Math.min(boundBottom - halfH, cluster.y + best.dy));
    const dx = Math.round((finalCx - cluster.x) * 10) / 10;
    const dy = Math.round((finalCy - cluster.y) * 10) / 10;

    const placedBox = {
      left: finalCx - halfW,
      right: finalCx + halfW,
      top: finalCy - halfH,
      bottom: finalCy + halfH,
    };
    placedBoxes.push(placedBox);
    placedStems.push({
      x0: cluster.x,
      y0: cluster.y,
      x1: Math.max(placedBox.left, Math.min(placedBox.right, cluster.x)),
      y1: Math.max(placedBox.top, Math.min(placedBox.bottom, cluster.y)),
    });

    map.set(cluster.hub.code, { dx, dy, ...metrics });
  }

  return map;
}

function getLoadTone(pct: number, warnAt = 78, critAt = 92): 'normal' | 'warn' | 'crit' {
  if (pct >= critAt) return 'crit';
  if (pct >= warnAt) return 'warn';
  return 'normal';
}

export function GlobalNodeMap({
  nodes,
  selectedNodeId,
  focusedRegionCode,
  onJumpToNode,
  onClose,
}: GlobalNodeMapProps) {
  const svgUid = useId().replace(/:/g, '');
  const clusters = useMemo(() => buildRegionClusters(nodes), [nodes]);
  const arcs = useMemo(() => buildInterRegionLinks(clusters), [clusters]);

  const topologyKey = useMemo(
    () => clusters.map((c) => `${c.hub.code}:${c.nodes.length}`).join('|'),
    [clusters],
  );
  const placardCacheRef = useRef<{ key: string; map: Map<string, PlacardLayout> }>({
    key: '',
    map: new Map(),
  });
  if (placardCacheRef.current.key !== topologyKey) {
    placardCacheRef.current = {
      key: topologyKey,
      map: computePlacardLayouts(clusters, arcs),
    };
  }
  const placardLayouts = placardCacheRef.current.map;

  const [activeCode, setActiveCode] = useState<string>(focusedRegionCode || 'ALL');
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [mapExpandedMobile, setMapExpandedMobile] = useState(false);
  const [utcNow, setUtcNow] = useState(() => new Date());
  const regionStripRef = useRef<HTMLDivElement | null>(null);
  const mapScrollRef = useRef<HTMLDivElement | null>(null);
  const mapInitialCenteredRef = useRef(false);

  useEffect(() => {
    if (focusedRegionCode && clusters.some((c) => c.hub.code === focusedRegionCode)) {
      setActiveCode(focusedRegionCode);
    }
  }, [focusedRegionCode, clusters]);

  useEffect(() => {
    if (activeCode !== 'ALL' && !clusters.some((c) => c.hub.code === activeCode)) {
      setActiveCode('ALL');
    }
  }, [activeCode, clusters]);

  useEffect(() => {
    const timer = window.setInterval(() => setUtcNow(new Date()), 20000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const strip = regionStripRef.current;
    if (!strip) return;
    const activeEl = strip.querySelector<HTMLElement>(`[data-region-code="${activeCode}"]`);
    activeEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeCode]);

  const activeCluster = useMemo(
    () => (activeCode === 'ALL' ? null : clusters.find((c) => c.hub.code === activeCode) ?? null),
    [clusters, activeCode],
  );

  useEffect(() => {
    const wrap = mapScrollRef.current;
    if (!wrap) return;
    if (wrap.scrollWidth <= wrap.clientWidth + 4) return;

    let targetX = VIEW_MIN_X + VIEW_WIDTH * 0.56;
    if (activeCluster) {
      targetX = activeCluster.x;
    } else if (clusters.length > 0) {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const c of clusters) {
        const weight = Math.max(1, c.nodes.length);
        weightedSum += c.x * weight;
        totalWeight += weight;
      }
      targetX = weightedSum / totalWeight;
    }

    const ratio = Math.max(0, Math.min(1, (targetX - VIEW_MIN_X) / VIEW_WIDTH));
    const scrollLeft = Math.max(
      0,
      Math.min(wrap.scrollWidth - wrap.clientWidth, ratio * wrap.scrollWidth - wrap.clientWidth / 2),
    );
    const smooth = mapInitialCenteredRef.current;
    mapInitialCenteredRef.current = true;
    wrap.scrollTo({ left: scrollLeft, behavior: smooth ? 'smooth' : 'auto' });
  }, [activeCluster?.hub.code, mapExpandedMobile, topologyKey]);

  const spotlightCode = hoveredCode ?? (activeCode !== 'ALL' ? activeCode : null);
  const spotlightCluster = useMemo(
    () => (spotlightCode ? clusters.find((c) => c.hub.code === spotlightCode) ?? null : null),
    [clusters, spotlightCode],
  );

  const orderedClusters = useMemo(() => {
    return [...clusters].sort((a, b) => {
      const rank = (code: string) => {
        if (code === hoveredCode) return 3;
        if (code === activeCode) return 2;
        return 1;
      };
      return rank(a.hub.code) - rank(b.hub.code);
    });
  }, [clusters, activeCode, hoveredCode]);

  const activeCountryPath = useMemo(() => {
    const activeIsos = new Set<string>(clusters.map((c) => c.hub.code));
    if (activeIsos.size === 0) return '';
    const coords: [number, number][] = [];
    for (const g of ALL_DECODED_BY_ISO) {
      if (activeIsos.has(g.iso)) {
        coords.push(...g.coords);
      }
    }
    return dotsToPath(coords);
  }, [clusters]);

  const spotlightCountryPath = useMemo(() => {
    if (!spotlightCode) return '';
    const entry = ALL_DECODED_BY_ISO.find((g) => g.iso === spotlightCode);
    return entry ? dotsToPath(entry.coords) : '';
  }, [spotlightCode]);

  const fleetSummary = useMemo(() => {
    const online = nodes.filter((n) => n.online);
    const totalDown = online.reduce((s, n) => s + n.netDown, 0);
    const totalUp = online.reduce((s, n) => s + n.netUp, 0);
    const pings = online.filter((n) => n.ping > 0).map((n) => n.ping);
    const avgPing = pings.length > 0 ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : 0;
    const avgCpu =
      online.length > 0 ? Math.round(online.reduce((s, n) => s + n.cpu, 0) / online.length) : 0;
    return {
      onlineCount: online.length,
      totalCount: nodes.length,
      totalDown,
      totalUp,
      avgPing,
      avgCpu,
    };
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    const base = activeCluster ? activeCluster.nodes : nodes;
    const q = searchQuery.trim().toLowerCase();
    return base.filter((node) => {
      if (statusFilter === 'online' && !node.online) return false;
      if (statusFilter === 'offline' && node.online) return false;
      if (!q) return true;
      const geo = resolveNodeGeo(node);
      return (
        node.name.toLowerCase().includes(q) ||
        geo.name.toLowerCase().includes(q) ||
        geo.code.toLowerCase().includes(q) ||
        (node.group ?? '').toLowerCase().includes(q)
      );
    });
  }, [activeCluster, nodes, searchQuery, statusFilter]);

  return (
    <section className="kdc-map-stage" aria-label="全球节点分布与网络态势">
      <div className={`kdc-map-canvas-pane${mapExpandedMobile ? ' is-expanded' : ''}`}>
        <div className="kdc-map-canvas-top">
          <div className="kdc-map-heading">
            <h1 className="kdc-map-title">全球节点</h1>
            <span className="kdc-map-coords">
              {spotlightCluster
                ? `${spotlightCluster.hub.name} (${spotlightCluster.hub.code}) · ${formatLatLon(spotlightCluster.hub.lat, spotlightCluster.hub.lon)} · 在线 ${spotlightCluster.onlineCount}/${spotlightCluster.nodes.length}${spotlightCluster.avgPing > 0 ? ` · ${spotlightCluster.avgPing}ms` : ''}`
                : `${clusters.length} 区域 · 在线 ${fleetSummary.onlineCount}/${fleetSummary.totalCount} · ↓${formatNetSpeed(fleetSummary.totalDown, true)} ↑${formatNetSpeed(fleetSummary.totalUp, true)}${fleetSummary.avgPing > 0 ? ` · 均值 ${fleetSummary.avgPing}ms` : ''} · ${formatUtcClock(utcNow)}`}
            </span>
          </div>

          <div className="kdc-map-top-actions">
            <Button
              className="kdc-map-mobile-expand"
              onClick={() => setMapExpandedMobile((v) => !v)}
              aria-label={mapExpandedMobile ? '收起地图高度' : '放大地图视野'}
            >
              {mapExpandedMobile ? (
                <Minimize2 size={12} aria-hidden="true" />
              ) : (
                <Maximize2 size={12} aria-hidden="true" />
              )}
              <span>{mapExpandedMobile ? '收起' : '放大'}</span>
            </Button>
            <Button className="kdc-map-back-btn" onClick={onClose}>
              <ArrowLeft size={12} aria-hidden="true" />
              <span>返回机柜</span>
            </Button>
          </div>
        </div>

        <div className="kdc-map-svg-wrap" ref={mapScrollRef}>
          <svg
            className="kdc-map-svg"
            viewBox={`${VIEW_MIN_X} ${VIEW_MIN_Y} ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            role="img"
            aria-label={`全球节点分布地图，共 ${clusters.length} 个地区，${fleetSummary.onlineCount}/${fleetSummary.totalCount} 在线`}
          >
            <defs>
              <linearGradient id={`${svgUid}-pin-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="kdc-map-stop-top" />
                <stop offset="100%" className="kdc-map-stop-bot" />
              </linearGradient>
              <linearGradient id={`${svgUid}-pin-hover`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="kdc-map-stop-hover-top" />
                <stop offset="100%" className="kdc-map-stop-hover-bot" />
              </linearGradient>
              <linearGradient id={`${svgUid}-pin-sel`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="kdc-map-stop-sel-top" />
                <stop offset="100%" className="kdc-map-stop-sel-bot" />
              </linearGradient>
              <filter id={`${svgUid}-pin-shadow`} x="-18%" y="-28%" width="136%" height="170%">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="2.2"
                  floodColor="#080a0f"
                  className="kdc-map-drop-shadow"
                />
              </filter>
            </defs>

            <g className="kdc-map-graticule" aria-hidden="true">
              {GRATICULE_PARALLELS.map((p) => (
                <g key={p.label}>
                  <line
                    x1={p.x1}
                    y1={p.y}
                    x2={p.x2}
                    y2={p.y}
                    className={`kdc-map-grat-line${p.isEq ? ' is-major' : ''}`}
                  />
                  <text x={p.x1 + 4} y={p.y - 4} className="kdc-map-grat-label">
                    {p.label}
                  </text>
                </g>
              ))}
              {GRATICULE_MERIDIANS.map((m) => (
                <g key={m.label}>
                  <path
                    d={m.d}
                    className={`kdc-map-grat-line${m.isPrime ? ' is-major' : ''}`}
                    fill="none"
                  />
                  <text x={m.labelX} y={m.labelY} textAnchor="middle" className="kdc-map-grat-label">
                    {m.label}
                  </text>
                </g>
              ))}
            </g>

            <path d={ALL_LAND_PATH} className="kdc-map-land-dots" />
            {activeCountryPath && (
              <path d={activeCountryPath} className="kdc-map-land-active" />
            )}
            {spotlightCountryPath && (
              <path d={spotlightCountryPath} className="kdc-map-land-focus" />
            )}

            <g className="kdc-map-arcs" aria-hidden="true">
              {arcs.map((arc, idx) => {
                const isHighlighted =
                  spotlightCode !== null &&
                  (arc.from.hub.code === spotlightCode || arc.to.hub.code === spotlightCode);
                const isDimmed = spotlightCode !== null && !isHighlighted;
                const dur = Math.max(2.8, Math.min(5.2, arc.durationSec));
                const delay = -((idx * 1.13) % dur);
                const arcStyle = {
                  '--arc-dur': `${dur.toFixed(1)}s`,
                  '--arc-delay': `${delay.toFixed(2)}s`,
                } as CSSProperties;

                return (
                  <g
                    key={arc.id}
                    style={arcStyle}
                    className={`kdc-map-arc-group${isHighlighted ? ' is-active' : ''}${isDimmed ? ' is-dim' : ''}${arc.active ? '' : ' is-idle'}`}
                  >
                    <path d={arc.pathD} fill="none" className="kdc-map-arc-base" />
                    <path d={arc.pathD} fill="none" className="kdc-map-arc-flow" />
                    {arc.active && (
                      <>
                        <path d={arc.pathD} pathLength={100} fill="none" className="kdc-map-arc-wake" />
                        <path d={arc.pathD} pathLength={100} fill="none" className="kdc-map-arc-core" />
                        <path d={arc.pathD} pathLength={100} fill="none" className="kdc-map-arc-head" />
                        {isHighlighted && (
                          <path d={arc.pathD} pathLength={100} fill="none" className="kdc-map-arc-return" />
                        )}
                      </>
                    )}
                  </g>
                );
              })}
            </g>

            {spotlightCluster && (
              <g
                className="kdc-map-crosshair"
                transform={`translate(${spotlightCluster.x} ${spotlightCluster.y})`}
                aria-hidden="true"
              >
                <circle r="11" className="kdc-map-crosshair-ring" />
                <line x1="-17" y1="0" x2="-10" y2="0" />
                <line x1="10" y1="0" x2="17" y2="0" />
                <line x1="0" y1="-17" x2="0" y2="-10" />
                <line x1="0" y1="10" x2="0" y2="17" />
              </g>
            )}

            <g className="kdc-map-hubs">
              {orderedClusters.map((cluster) => {
                const isSelected = activeCode === cluster.hub.code;
                const isHovered = hoveredCode === cluster.hub.code;
                const isActivePin = isSelected || isHovered;
                const isOnline = cluster.onlineCount > 0;
                const isPartial = cluster.onlineCount > 0 && cluster.onlineCount < cluster.nodes.length;
                const layout = placardLayouts.get(cluster.hub.code) ?? {
                  dx: 0,
                  dy: -25,
                  ...measureClusterPlacard(cluster),
                };
                const toneClass = !isOnline ? 'is-off' : isPartial ? 'is-warn' : 'is-ok';
                const halfW = layout.width / 2;
                const flagX = -halfW + 5.5;
                const nameX = flagX + PLACARD_FLAG_W + 5;
                const dividerX = nameX + layout.nameWidth + 5;
                const countCenterX = dividerX + 5 + layout.maxCountWidth / 2;
                const countText = `${cluster.onlineCount}/${cluster.nodes.length}`;

                const edgeX = Math.max(layout.dx - halfW, Math.min(layout.dx + halfW, 0));
                const edgeY = Math.max(layout.dy - PLACARD_HALF_H, Math.min(layout.dy + PLACARD_HALF_H, 0));
                const stemDist = Math.hypot(edgeX, edgeY);
                const stemStartR = isActivePin ? 6.4 : 5.2;
                const hasStem = stemDist > stemStartR + 1.5;
                const stemStartX = hasStem ? (edgeX / stemDist) * stemStartR : 0;
                const stemStartY = hasStem ? (edgeY / stemDist) * stemStartR : 0;
                const fillUrl = isSelected
                  ? `url(#${svgUid}-pin-sel)`
                  : isHovered
                    ? `url(#${svgUid}-pin-hover)`
                    : `url(#${svgUid}-pin-fill)`;

                return (
                  <g
                    key={cluster.hub.code}
                    transform={`translate(${cluster.x} ${cluster.y})`}
                    className={`kdc-map-pin ${toneClass}${isSelected ? ' is-selected' : ''}${isHovered ? ' is-hovered' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${cluster.hub.name}，${cluster.onlineCount}/${cluster.nodes.length} 台节点在线`}
                    onClick={() =>
                      setActiveCode((cur) => (cur === cluster.hub.code ? 'ALL' : cluster.hub.code))
                    }
                    onMouseEnter={() => setHoveredCode(cluster.hub.code)}
                    onMouseLeave={() => setHoveredCode((cur) => (cur === cluster.hub.code ? null : cur))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveCode((cur) => (cur === cluster.hub.code ? 'ALL' : cluster.hub.code));
                      }
                    }}
                  >
                    <circle r="18" fill="transparent" />

                    {isOnline && (
                      <circle
                        r="5.5"
                        className="kdc-map-pin-pulse"
                        style={{ animationDelay: `${stableCodeDelay(cluster.hub.code, 3.6).toFixed(2)}s` }}
                      />
                    )}

                    {hasStem && (
                      <>
                        <line
                          x1={stemStartX}
                          y1={stemStartY}
                          x2={edgeX}
                          y2={edgeY}
                          className="kdc-map-pin-stem"
                        />
                        <circle cx={edgeX} cy={edgeY} r="1.25" className="kdc-map-pin-joint" />
                      </>
                    )}

                    <circle r={isActivePin ? 6.2 : 4.9} className="kdc-map-pin-ring" />
                    <circle r={isActivePin ? 2.8 : 2.2} className="kdc-map-pin-core" />

                    <g transform={`translate(${layout.dx} ${layout.dy})`} className="kdc-map-pin-tag">
                      <g className="kdc-map-pin-card" filter={`url(#${svgUid}-pin-shadow)`}>
                        {isSelected && (
                          <rect
                            x={-halfW - 2.2}
                            y={-PLACARD_HALF_H - 2.2}
                            width={layout.width + 4.4}
                            height={PLACARD_HEIGHT + 4.4}
                            rx="7.5"
                            className="kdc-map-pin-focus-ring"
                          />
                        )}
                        <rect
                          x={-halfW}
                          y={-PLACARD_HALF_H}
                          width={layout.width}
                          height={PLACARD_HEIGHT}
                          rx="5.5"
                          fill={fillUrl}
                          className="kdc-map-pin-bg"
                        />
                        <line
                          x1={-halfW + 4.5}
                          y1={-PLACARD_HALF_H + 0.9}
                          x2={halfW - 4.5}
                          y2={-PLACARD_HALF_H + 0.9}
                          className="kdc-map-pin-bevel"
                        />
                        <RegionFlagGlyph
                          code={cluster.hub.code}
                          x={flagX}
                          y={-PLACARD_FLAG_H / 2}
                          width={PLACARD_FLAG_W}
                          height={PLACARD_FLAG_H}
                        />
                        <rect
                          x={flagX}
                          y={-PLACARD_FLAG_H / 2}
                          width={PLACARD_FLAG_W}
                          height={PLACARD_FLAG_H}
                          rx="2"
                          className="kdc-map-pin-flag-frame"
                        />
                        <text
                          x={nameX}
                          y="3.65"
                          textAnchor="start"
                          dominantBaseline="alphabetic"
                          className="kdc-map-pin-name"
                        >
                          {layout.nameText}
                        </text>
                        <line
                          x1={dividerX}
                          y1="-5.2"
                          x2={dividerX}
                          y2="5.2"
                          className="kdc-map-pin-div"
                        />
                        <text
                          x={countCenterX}
                          y="3.1"
                          textAnchor="middle"
                          dominantBaseline="alphabetic"
                          className="kdc-map-pin-count"
                        >
                          {countText}
                        </text>
                      </g>
                      {/* Generous invisible hit area around placard for reliable touch/click */}
                      <rect
                        x={-halfW - 4}
                        y={-PLACARD_HALF_H - 4}
                        width={layout.width + 8}
                        height={PLACARD_HEIGHT + 8}
                        rx="8"
                        fill="transparent"
                      />
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      <aside className="kdc-map-rail" aria-label="区域与节点目录">
        <div className="kdc-map-rail-head">
          <div className="kdc-map-rail-controls">
            <div className="kdc-map-search-wrap">
              <Search size={13} className="kdc-map-search-ico" aria-hidden="true" />
              <Input
                className="kdc-map-search"
                placeholder="搜索节点或地区…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="筛选全球节点"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="kdc-map-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="清空搜索"
                >
                  <X size={11} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="kdc-map-status-tabs" role="group" aria-label="按在线状态筛选">
              {(
                [
                  ['all', '全部'],
                  ['online', '在线'],
                  ['offline', '离线'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`kdc-map-status-tab${statusFilter === key ? ' is-active' : ''}`}
                  aria-pressed={statusFilter === key}
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div ref={regionStripRef} className="kdc-map-region-strip" role="tablist" aria-label="按区域筛选">
            <button
              type="button"
              role="tab"
              aria-selected={activeCode === 'ALL'}
              data-region-code="ALL"
              className={`kdc-map-region-tab${activeCode === 'ALL' ? ' is-active' : ''}`}
              onClick={() => setActiveCode('ALL')}
            >
              <span>全部</span>
              <em>{nodes.length}</em>
            </button>
            {clusters.map((c) => {
              const isAct = activeCode === c.hub.code;
              return (
                <button
                  key={c.hub.code}
                  type="button"
                  role="tab"
                  aria-selected={isAct}
                  data-region-code={c.hub.code}
                  className={`kdc-map-region-tab${isAct ? ' is-active' : ''}${c.onlineCount === 0 ? ' is-off' : ''}`}
                  onClick={() => setActiveCode(c.hub.code)}
                >
                  <RegionFlag code={c.hub.code} size="xs" />
                  <span>{c.hub.name}</span>
                  <em>
                    {c.onlineCount}/{c.nodes.length}
                  </em>
                </button>
              );
            })}
          </div>
        </div>

        <ScrollArea className="kdc-map-list-scroll">
          <ScrollAreaViewport className="kdc-map-list-viewport">
            <ScrollAreaContent className="kdc-map-node-list">
              {filteredNodes.length === 0 ? (
                <div className="kdc-map-empty">
                  <strong>无匹配节点</strong>
                  <span>调整搜索关键词或状态筛选条件后重试</span>
                </div>
              ) : (
                filteredNodes.map((node) => {
                  const geo = resolveNodeGeo(node);
                  const cpuPct = Math.max(0, Math.min(100, Math.round(node.cpu)));
                  const ramPct = Math.max(0, Math.min(100, Math.round(node.ram)));
                  const isSelected = node.uuid === selectedNodeId;

                  return (
                    <button
                      key={node.uuid}
                      type="button"
                      className={`kdc-map-node-row${isSelected ? ' is-selected' : ''}${node.online ? '' : ' is-offline'}`}
                      onClick={() => onJumpToNode(node.uuid)}
                      onMouseEnter={() => setHoveredCode(geo.code)}
                      onMouseLeave={() => setHoveredCode((cur) => (cur === geo.code ? null : cur))}
                    >
                      <div className="kdc-map-node-head">
                        <div className="kdc-map-node-id">
                          <span className={`kdc-sig-dot ${node.online ? 'is-live' : 'is-err'}`} />
                          <RegionFlag code={geo.code} size="xs" />
                          <span className="kdc-map-node-name">{node.name}</span>
                        </div>
                        <div className="kdc-map-node-right">
                          {node.online && node.ping > 0 && (
                            <span className="kdc-map-node-ping">{Math.round(node.ping)}ms</span>
                          )}
                          <ChevronRight size={13} className="kdc-map-node-chev" aria-hidden="true" />
                        </div>
                      </div>

                      {node.online ? (
                        <div className="kdc-map-node-body">
                          <div className="kdc-map-mini-meters">
                            <div className="kdc-map-mini-m">
                              <span>CPU</span>
                              <Meter
                                value={cpuPct}
                                min={0}
                                max={100}
                                className={`kdc-map-meter tone-${getLoadTone(cpuPct)}`}
                                aria-label={`${node.name} CPU ${cpuPct}%`}
                              >
                                <MeterTrack className="kdc-meter-track">
                                  <MeterIndicator className="kdc-meter-ind" />
                                </MeterTrack>
                              </Meter>
                              <b>{cpuPct}%</b>
                            </div>
                            <div className="kdc-map-mini-m">
                              <span>MEM</span>
                              <Meter
                                value={ramPct}
                                min={0}
                                max={100}
                                className={`kdc-map-meter tone-${getLoadTone(ramPct, 82, 92)}`}
                                aria-label={`${node.name} 内存 ${ramPct}%`}
                              >
                                <MeterTrack className="kdc-meter-track">
                                  <MeterIndicator className="kdc-meter-ind" />
                                </MeterTrack>
                              </Meter>
                              <b>{ramPct}%</b>
                            </div>
                          </div>
                          <div className="kdc-map-node-net">
                            <span>↓{formatNetSpeed(node.netDown, true)}</span>
                            <span>↑{formatNetSpeed(node.netUp, true)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="kdc-map-node-off">节点离线 · 点击前往机柜定位排查</div>
                      )}
                    </button>
                  );
                })
              )}
            </ScrollAreaContent>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar className="kdc-scrollbar">
            <ScrollAreaThumb className="kdc-scrollbar-thumb" />
          </ScrollAreaScrollbar>
        </ScrollArea>
      </aside>
    </section>
  );
}
