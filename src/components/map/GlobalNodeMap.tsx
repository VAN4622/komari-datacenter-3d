import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    if (focusedRegionCode && clusters.some((c) => c.hub.code === focusedRegionCode)) {
      setActiveCode(focusedRegionCode);
    }
  }, [focusedRegionCode, clusters]);

  const activeCluster: RegionCluster | null = useMemo(() => {
    if (clusters.length === 0) return null;
    if (activeCode) {
      const found = clusters.find((c) => c.hub.code === activeCode);
      if (found) return found;
    }
    if (focusedRegionCode) {
      const found = clusters.find((c) => c.hub.code === focusedRegionCode);
      if (found) return found;
    }
    return clusters[0];
  }, [clusters, activeCode, focusedRegionCode]);

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

    // For compact city-states (HK, SG, MO, LU, TW) with few/no 110m dots, illuminate nearby land dots
    for (const c of clusters) {
      const existing = WORLD_COUNTRY_DOTS[c.hub.code];
      if (!existing || existing.length < 4) {
        const radiusSq = 18 * 18;
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

  const totalOnline = useMemo(() => nodes.filter((n) => n.online).length, [nodes]);
  const totalNetDown = useMemo(
    () => nodes.reduce((sum, n) => sum + (n.online ? n.netDown : 0), 0),
    [nodes],
  );
  const totalNetUp = useMemo(
    () => nodes.reduce((sum, n) => sum + (n.online ? n.netUp : 0), 0),
    [nodes],
  );

  return (
    <section className="wmap-stage" aria-label="全球节点分布与互联视图">
      {/* Unified Minimalist Studio Ambient Backdrop */}
      <div className="wmap-backdrop" aria-hidden="true">
        <div className="wmap-soft-glow" />
      </div>

      {/* Main Precision Dot-Matrix World Canvas */}
      <div className="wmap-canvas-wrap">
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
                  {/* Quiet breathing pulse ring on selected or primary online hub */}
                  {isOnline && (
                    <circle
                      r={isSelected ? 10 : 7}
                      className={`wmap-pin-halo${isSelected ? ' is-breathing' : ''}`}
                    />
                  )}

                  {/* Precision Pin Core */}
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

      {/* Apple Liquid Glass Floating Region Sheet */}
      {activeCluster && (
        <aside className="wmap-sheet" aria-label="全球区域与节点明细">
          {/* Calm Integrated Global Summary Bar */}
          <div className="wmap-sheet-summary">
            <span>
              <b>{clusters.length}</b> 区域
            </span>
            <span className="wmap-sum-dot" aria-hidden="true" />
            <span>
              <b>
                {totalOnline}/{nodes.length}
              </b>{' '}
              在线
            </span>
            <span className="wmap-sum-dot" aria-hidden="true" />
            <span>
              ↓ <b>{formatNetSpeed(totalNetDown, true)}</b>
            </span>
            <span className="wmap-sum-dot wmap-hide-xs" aria-hidden="true" />
            <span className="wmap-hide-xs">
              ↑ <b>{formatNetSpeed(totalNetUp, true)}</b>
            </span>
          </div>

          <header className="wmap-sheet-head">
            <div className="wmap-region-id">
              <span className="wmap-region-flag">
                <RegionFlag code={activeCluster.hub.code} size="lg" />
              </span>
              <div>
                <strong>
                  {activeCluster.hub.name}
                  <em>{activeCluster.hub.code}</em>
                </strong>
                <span>
                  {activeCluster.onlineCount}/{activeCluster.nodes.length} 在线 · ↓
                  {formatNetSpeed(activeCluster.totalNetDown, true)}
                  {activeCluster.avgPing > 0 ? ` · ${activeCluster.avgPing} ms` : ''}
                </span>
              </div>
            </div>

            <button type="button" className="wmap-back-btn" onClick={onClose}>
              返回机柜
            </button>
          </header>

          {/* Minimal Region Flag Pills */}
          <div className="wmap-flag-strip" role="tablist" aria-label="按地区切换">
            {clusters.map((c) => (
              <button
                key={c.hub.code}
                type="button"
                role="tab"
                aria-selected={c.hub.code === activeCluster.hub.code}
                className={`wmap-flag-tab${c.hub.code === activeCluster.hub.code ? ' is-active' : ''}${c.onlineCount === 0 ? ' is-off' : ''}`}
                onClick={() => setActiveCode(c.hub.code)}
              >
                <RegionFlag code={c.hub.code} size="xs" />
                <span>{c.hub.name}</span>
              </button>
            ))}
          </div>

          {/* Nodes inside Selected Region */}
          <div className="wmap-node-list">
            {activeCluster.nodes.map((node) => (
              <button
                key={node.uuid}
                type="button"
                className={`wmap-node-row${node.uuid === selectedNodeId ? ' is-selected' : ''}${node.online ? '' : ' is-offline'}`}
                onClick={() => onJumpToNode(node.uuid)}
                title="切回机柜并定位该服务器"
              >
                <div className="wmap-node-main">
                  <span className={`lg-status-dot ${node.online ? 'is-on' : 'is-off'}`} />
                  <span className="wmap-node-name">{node.name}</span>
                </div>
                <div className="wmap-node-metrics">
                  {node.online ? (
                    <>
                      <span>CPU {Math.round(node.cpu)}%</span>
                      <span>↓{formatNetSpeed(node.netDown, true)}</span>
                      <span className="wmap-node-chevron" aria-hidden="true">
                        ›
                      </span>
                    </>
                  ) : (
                    <span className="is-off-txt">离线</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>
      )}
    </section>
  );
}
