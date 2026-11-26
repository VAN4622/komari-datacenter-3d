import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { InteractiveGlobe } from '@/components/map/InteractiveGlobe';
import { RegionFlag } from '@/components/ui/RegionFlag';
import { formatNetSpeed } from '@/lib/formatters';
import {
  buildInterRegionLinks,
  buildRegionClusters,
  resolveNodeGeo,
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

function formatUtcClock(now: Date): string {
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
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
  const clusters = useMemo(() => buildRegionClusters(nodes), [nodes]);
  const arcs = useMemo(() => buildInterRegionLinks(clusters), [clusters]);
  const topologyKey = clusters.map((item) => `${item.hub.code}:${item.nodes.length}`).join('|');

  const [activeCode, setActiveCode] = useState<string>(focusedRegionCode || 'ALL');
  const [focusSeq, setFocusSeq] = useState(0);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [mapExpandedMobile, setMapExpandedMobile] = useState(false);
  const [utcNow, setUtcNow] = useState(() => new Date());
  const regionStripRef = useRef<HTMLDivElement | null>(null);

  const handleSelectRegion = useCallback((code: string) => {
    setActiveCode(code);
    setFocusSeq((seq) => seq + 1);
  }, []);

  useEffect(() => {
    if (focusedRegionCode && clusters.some((item) => item.hub.code === focusedRegionCode)) {
      setActiveCode(focusedRegionCode);
      setFocusSeq((seq) => seq + 1);
    }
  }, [focusedRegionCode, clusters]);

  useEffect(() => {
    if (activeCode !== 'ALL' && !clusters.some((item) => item.hub.code === activeCode)) {
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
    () => (activeCode === 'ALL' ? null : clusters.find((item) => item.hub.code === activeCode) ?? null),
    [clusters, activeCode],
  );

  const spotlightCode = hoveredCode ?? (activeCode !== 'ALL' ? activeCode : null);
  const spotlightCluster = useMemo(
    () => (spotlightCode ? clusters.find((item) => item.hub.code === spotlightCode) ?? null : null),
    [clusters, spotlightCode],
  );

  const fleetSummary = useMemo(() => {
    const online = nodes.filter((item) => item.online);
    const totalDown = online.reduce((sum, item) => sum + item.netDown, 0);
    const totalUp = online.reduce((sum, item) => sum + item.netUp, 0);
    const pings = online.filter((item) => item.ping > 0).map((item) => item.ping);
    const avgPing = pings.length > 0 ? Math.round(pings.reduce((acc, val) => acc + val, 0) / pings.length) : 0;
    const avgCpu =
      online.length > 0 ? Math.round(online.reduce((sum, item) => sum + item.cpu, 0) / online.length) : 0;
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
    const query = searchQuery.trim().toLowerCase();
    return base.filter((node) => {
      if (statusFilter === 'online' && !node.online) return false;
      if (statusFilter === 'offline' && node.online) return false;
      if (!query) return true;
      const geo = resolveNodeGeo(node);
      return (
        node.name.toLowerCase().includes(query) ||
        geo.name.toLowerCase().includes(query) ||
        geo.code.toLowerCase().includes(query) ||
        (node.group ?? '').toLowerCase().includes(query)
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
                ? `${spotlightCluster.hub.name} (${spotlightCluster.hub.code}) · 在线 ${spotlightCluster.onlineCount}/${spotlightCluster.nodes.length}${spotlightCluster.avgPing > 0 ? ` · ${spotlightCluster.avgPing}ms` : ''}`
                : `${clusters.length} 区域 · 在线 ${fleetSummary.onlineCount}/${fleetSummary.totalCount} · ↓${formatNetSpeed(fleetSummary.totalDown, true)} ↑${formatNetSpeed(fleetSummary.totalUp, true)}${fleetSummary.avgPing > 0 ? ` · 均值 ${fleetSummary.avgPing}ms` : ''} · ${formatUtcClock(utcNow)}`}
            </span>
          </div>

          <div className="kdc-map-top-actions">
            <Button
              className="kdc-map-mobile-expand"
              onClick={() => setMapExpandedMobile((prev) => !prev)}
              aria-label={mapExpandedMobile ? '收起地球仪高度' : '放大地球仪视野'}
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

        <div className="kdc-map-globe-wrap">
          <InteractiveGlobe
            clusters={clusters}
            arcs={arcs}
            activeCode={activeCode}
            hoveredCode={hoveredCode}
            focusSeq={focusSeq}
            topologyKey={topologyKey}
            ariaLabel={`可旋转全球节点地球仪，共 ${clusters.length} 个地区，${fleetSummary.onlineCount}/${fleetSummary.totalCount} 在线`}
            onSelectRegion={handleSelectRegion}
            onHoverRegion={setHoveredCode}
          />
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
                onChange={(event) => setSearchQuery(event.target.value)}
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
              onClick={() => handleSelectRegion('ALL')}
            >
              <span>全部</span>
              <em>{nodes.length}</em>
            </button>
            {clusters.map((cluster) => {
              const isAct = activeCode === cluster.hub.code;
              return (
                <button
                  key={cluster.hub.code}
                  type="button"
                  role="tab"
                  aria-selected={isAct}
                  data-region-code={cluster.hub.code}
                  className={`kdc-map-region-tab${isAct ? ' is-active' : ''}${cluster.onlineCount === 0 ? ' is-off' : ''}`}
                  onClick={() => handleSelectRegion(cluster.hub.code)}
                >
                  <RegionFlag code={cluster.hub.code} size="xs" />
                  <span>{cluster.hub.name}</span>
                  <em>
                    {cluster.onlineCount}/{cluster.nodes.length}
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
