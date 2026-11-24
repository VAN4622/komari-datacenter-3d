import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { RegionFlag } from '@/components/ui/RegionFlag';
import { formatBytesGiB } from '@/data/fleet';
import { formatNetSpeed } from '@/lib/formatters';
import { resolveNodeGeo } from '@/lib/geoRegions';
import type { NodeInfo, RackViewAngle } from '@/types/rack';

interface ServerStatusHudProps {
  node: NodeInfo | null;
  nodeIndex: number;
  totalNodes: number;
  activeRackId?: string;
  rackName?: string;
  viewAngle: RackViewAngle;
  drawerOpen: boolean;
  visible: boolean;
  collapsed: boolean;
  uidBlinking: boolean;
  canEdit: boolean;
  onPrevNode: () => void;
  onNextNode: () => void;
  onToggleCollapse: () => void;
  onHide: () => void;
  onShow: () => void;
  onToggleUid: () => void;
  onOpenTelemetry: () => void;
  onOpenStyle: () => void;
  onLocateOnMap: (regionCode: string) => void;
}

interface AnchorGeom {
  anchorX: number;
  anchorY: number;
  rackLeft: number;
  rackRight: number;
  vw: number;
  vh: number;
  valid: boolean;
}

interface TetherGeometry {
  pathD: string;
  anchorX: number;
  anchorY: number;
  portX: number;
  portY: number;
  visible: boolean;
}

function getLoadTone(pct: number, warnAt = 78, critAt = 92): 'normal' | 'warn' | 'crit' {
  if (pct >= critAt) return 'crit';
  if (pct >= warnAt) return 'warn';
  return 'normal';
}

const DESKTOP_BREAKPOINT = 900;
const HUD_DEFAULT_W = 312;
const HUD_EST_H_EXPANDED = 264;
const HUD_EST_H_COLLAPSED = 88;

export function ServerStatusHud({
  node,
  nodeIndex,
  totalNodes,
  activeRackId,
  rackName,
  viewAngle,
  drawerOpen,
  visible,
  collapsed,
  uidBlinking,
  canEdit,
  onPrevNode,
  onNextNode,
  onToggleCollapse,
  onHide,
  onShow,
  onToggleUid,
  onOpenTelemetry,
  onOpenStyle,
  onLocateOnMap,
}: ServerStatusHudProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= DESKTOP_BREAKPOINT : false,
  );
  const [geom, setGeom] = useState<AnchorGeom>({
    anchorX: 0,
    anchorY: 0,
    rackLeft: 0,
    rackRight: 0,
    vw: typeof window !== 'undefined' ? window.innerWidth : 1280,
    vh: typeof window !== 'undefined' ? window.innerHeight : 800,
    valid: false,
  });
  const [cardSize, setCardSize] = useState({ w: HUD_DEFAULT_W, h: HUD_EST_H_EXPANDED });
  const [manualPos, setManualPos] = useState<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const prevRackIdRef = useRef<string | undefined>(activeRackId);
  const rackSwitchingRef = useRef(false);
  const [rackSwitching, setRackSwitching] = useState(false);

  const measureGeometry = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setIsMobile(vw <= DESKTOP_BREAKPOINT);

    if (rackSwitchingRef.current) return;

    const anchorEl =
      document.querySelector<HTMLElement>('.studio-aisle-slot.is-active [data-hud-anchor="selected-server"]') ??
      document.querySelector<HTMLElement>('[data-hud-anchor="selected-server"]');
    const frameEl =
      document.querySelector<HTMLElement>('.studio-aisle-slot.is-active .srack-cabinet') ??
      document.querySelector<HTMLElement>('.srack-cabinet');

    if (cardRef.current) {
      const cr = cardRef.current.getBoundingClientRect();
      if (cr.width > 40 && cr.height > 30) {
        setCardSize((prev) =>
          Math.abs(prev.w - cr.width) > 1 || Math.abs(prev.h - cr.height) > 1
            ? { w: cr.width, h: cr.height }
            : prev,
        );
      }
    }

    if (!anchorEl) {
      setGeom((prev) => (prev.valid ? { ...prev, vw, vh, valid: false } : prev));
      return;
    }

    const ar = anchorEl.getBoundingClientRect();
    const cabRect = frameEl?.getBoundingClientRect();
    const anchorX = ar.left + ar.width / 2;
    const anchorY = ar.top + ar.height / 2;
    const rackLeft = cabRect ? cabRect.left : ar.left - 340;
    const rackRight = cabRect ? cabRect.right : ar.right;

    setGeom({
      anchorX,
      anchorY,
      rackLeft,
      rackRight,
      vw,
      vh,
      valid: ar.width > 0 || ar.height > 0,
    });
  }, []);

  // Pause layout measurements and softly fade the optical tether while the cold-aisle
  // camera glides to another rack, keeping the slide 100% GPU-composited with zero reflows.
  useLayoutEffect(() => {
    if (!activeRackId || prevRackIdRef.current === activeRackId) return;
    prevRackIdRef.current = activeRackId;

    const reducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      rackSwitchingRef.current = false;
      setRackSwitching(false);
      measureGeometry();
      return;
    }

    rackSwitchingRef.current = true;
    setRackSwitching(true);

    let settleRaf = 0;
    const settleTimer = window.setTimeout(() => {
      rackSwitchingRef.current = false;
      measureGeometry();
      setRackSwitching(false);

      // Brief gentle follow-up to lock onto the final deceleration + rail pull-out
      const start = performance.now();
      const tick = (now: number) => {
        measureGeometry();
        if (now - start < 220) {
          settleRaf = requestAnimationFrame(tick);
        }
      };
      settleRaf = requestAnimationFrame(tick);
    }, 760);

    return () => {
      window.clearTimeout(settleTimer);
      cancelAnimationFrame(settleRaf);
    };
  }, [activeRackId, measureGeometry]);

  // Track anchor smoothly during same-rack 3D rail pull-out, perspective change, or drawer shift
  useLayoutEffect(() => {
    if (!visible || !node || rackSwitchingRef.current) return;
    measureGeometry();

    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (rackSwitchingRef.current) return;
      measureGeometry();
      if (now - start < 440) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [visible, node?.uuid, viewAngle, collapsed, drawerOpen, measureGeometry]);

  useEffect(() => {
    if (!visible || !node) return;
    const onUpdate = () => measureGeometry();
    window.addEventListener('resize', onUpdate);
    const scrollHost = document.querySelector('.studio-aisle-slot.is-active .studio-viewport-scroll');
    scrollHost?.addEventListener('scroll', onUpdate, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onUpdate) : null;
    const stageEl = document.querySelector('.studio-stage');
    const cabEl = document.querySelector('.studio-aisle-slot.is-active .srack-cabinet');
    if (stageEl && ro) ro.observe(stageEl);
    if (cabEl && ro) ro.observe(cabEl);

    return () => {
      window.removeEventListener('resize', onUpdate);
      scrollHost?.removeEventListener('scroll', onUpdate);
      ro?.disconnect();
    };
  }, [visible, node, activeRackId, measureGeometry]);

  // Reset manual drag if viewport shrinks below desktop breakpoint
  useEffect(() => {
    if (isMobile && manualPos) {
      setManualPos(null);
    }
  }, [isMobile, manualPos]);

  if (!node) return null;

  if (!visible) {
    return (
      <button
        type="button"
        className="lg-pill lg-hud-restore"
        onClick={onShow}
        title="显示节点浮窗"
      >
        <span className={`lg-status-dot ${node.online ? 'is-on' : 'is-off'}`} />
        <span>{node.name}</span>
      </button>
    );
  }

  const cpuPct = Math.min(100, Math.max(0, Math.round(node.cpu)));
  const ramPct = Math.min(100, Math.max(0, Math.round(node.ram)));
  const diskPct = Math.min(100, Math.max(0, Math.round(node.disk)));
  const geo = resolveNodeGeo(node);

  // Dynamically compute free-floating Liquid Glass HUD coordinates relative to the selected server & viewport
  const cardW = cardSize.w || HUD_DEFAULT_W;
  const cardH = cardSize.h || (collapsed ? HUD_EST_H_COLLAPSED : HUD_EST_H_EXPANDED);
  const topBound = 72;
  const bottomBound = geom.vh - 82;
  const rightSafeLimit = drawerOpen ? geom.vw - 414 : geom.vw - 22;
  const leftSafeLimit = 22;
  const gap = 58;

  let autoX = Math.max(leftSafeLimit, rightSafeLimit - cardW);
  let autoY = Math.max(topBound, Math.min(bottomBound - cardH, geom.vh * 0.5 - cardH * 0.5));

  if (!isMobile && geom.valid) {
    const rightSpace = rightSafeLimit - (geom.rackRight + gap);
    const leftSpace = geom.rackLeft - gap - leftSafeLimit;

    if (rightSpace >= cardW) {
      autoX = geom.rackRight + gap + Math.min(28, (rightSpace - cardW) * 0.25);
    } else if (leftSpace >= cardW) {
      autoX = geom.rackLeft - gap - cardW - Math.min(28, (leftSpace - cardW) * 0.25);
    } else if (rightSpace >= leftSpace) {
      autoX = Math.max(leftSafeLimit, rightSafeLimit - cardW);
    } else {
      autoX = leftSafeLimit;
    }

    // Align the card's vertical center naturally with the pulled-out server's optical port
    const targetY = geom.anchorY - cardH * 0.5;
    autoY = Math.max(topBound, Math.min(bottomBound - cardH, targetY));
  }

  const hudX = manualPos
    ? Math.max(12, Math.min(geom.vw - cardW - 12, manualPos.x))
    : autoX;
  const hudY = manualPos
    ? Math.max(60, Math.min(geom.vh - cardH - 12, manualPos.y))
    : autoY;

  // Build silky horizontal-tangent optical Bézier filament anchored dead-center vertically on the HUD card edge
  const tether: TetherGeometry = (() => {
    if (isMobile || !geom.valid) {
      return {
        pathD: '',
        anchorX: 0,
        anchorY: 0,
        portX: 0,
        portY: 0,
        visible: false,
      };
    }

    const ax = geom.anchorX;
    const ay = geom.anchorY;
    const hudCenterX = hudX + cardW / 2;
    const hudCenterY = hudY + cardH * 0.5;

    if (hudCenterX >= ax + 18) {
      // Card sits to the right of the server unit — always dock at card's left vertical midpoint
      const px = hudX;
      const py = hudCenterY;
      const dx = Math.max(44, px - ax);
      const cp1x = ax + dx * 0.52;
      const cp2x = px - dx * 0.48;
      return {
        pathD: `M ${ax.toFixed(1)} ${ay.toFixed(1)} C ${cp1x.toFixed(1)} ${ay.toFixed(1)}, ${cp2x.toFixed(1)} ${py.toFixed(1)}, ${px.toFixed(1)} ${py.toFixed(1)}`,
        anchorX: ax,
        anchorY: ay,
        portX: px,
        portY: py,
        visible: true,
      };
    }

    if (hudCenterX <= ax - 18) {
      // Card sits to the left of the server unit — always dock at card's right vertical midpoint
      const px = hudX + cardW;
      const py = hudCenterY;
      const dx = Math.max(44, ax - px);
      const cp1x = ax - dx * 0.52;
      const cp2x = px + dx * 0.48;
      return {
        pathD: `M ${ax.toFixed(1)} ${ay.toFixed(1)} C ${cp1x.toFixed(1)} ${ay.toFixed(1)}, ${cp2x.toFixed(1)} ${py.toFixed(1)}, ${px.toFixed(1)} ${py.toFixed(1)}`,
        anchorX: ax,
        anchorY: ay,
        portX: px,
        portY: py,
        visible: true,
      };
    }

    // Fallback when card overlaps server column horizontally: connect cleanly to top/bottom center
    const px = hudCenterX;
    const py = hudY >= ay ? hudY : hudY + cardH;
    const dy = (py - ay) * 0.5;
    return {
      pathD: `M ${ax.toFixed(1)} ${ay.toFixed(1)} C ${ax.toFixed(1)} ${(ay + dy).toFixed(1)}, ${px.toFixed(1)} ${(py - dy).toFixed(1)}, ${px.toFixed(1)} ${py.toFixed(1)}`,
      anchorX: ax,
      anchorY: ay,
      portX: px,
      portY: py,
      visible: true,
    };
  })();

  const handleDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isMobile) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: hudX,
      originY: hudY,
    };
    setDragging(true);
  };

  const handleDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    setManualPos({
      x: st.originX + (e.clientX - st.startX),
      y: st.originY + (e.clientY - st.startY),
    });
  };

  const handleDragEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    dragStateRef.current = null;
    setDragging(false);
  };

  const shortRack = rackName ? rackName.split('·')[0]?.trim() : '';

  return (
    <>
      {/* Full-Viewport Minimal Optical Glass Filament Tether */}
      {tether.visible && (
        <svg
          className={`lg-tether-layer${node.online ? '' : ' is-offline'}${rackSwitching ? ' is-rack-switching' : ''}`}
          viewBox={`0 0 ${geom.vw} ${geom.vh}`}
          width={geom.vw}
          height={geom.vh}
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="lgTetherGrad"
              gradientUnits="userSpaceOnUse"
              x1={tether.anchorX}
              y1={tether.anchorY}
              x2={tether.portX}
              y2={tether.portY}
            >
              <stop offset="0%" stopColor="var(--tether-start)" stopOpacity="0.88" />
              <stop offset="52%" stopColor="var(--tether-mid)" stopOpacity="0.46" />
              <stop offset="100%" stopColor="var(--tether-end)" stopOpacity="0.72" />
            </linearGradient>

            <filter id="lgTetherBloom" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>

          {/* Soft refractive aura behind the filament */}
          <path
            d={tether.pathD}
            fill="none"
            stroke="url(#lgTetherGrad)"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.22"
            filter="url(#lgTetherBloom)"
          />

          {/* Razor-thin continuous optical hair-line */}
          <path
            d={tether.pathD}
            fill="none"
            stroke="url(#lgTetherGrad)"
            strokeWidth="1.25"
            strokeLinecap="round"
          />

          {/* Single subtle light pulse gliding smoothly from hardware to glass panel */}
          {node.online && (
            <circle r="2.3" className="lg-tether-pulse" filter="url(#lgTetherBloom)">
              <animateMotion
                dur="3.4s"
                repeatCount="indefinite"
                path={tether.pathD}
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.42 0 0.22 1"
              />
            </circle>
          )}

          {/* Minimal Hardware Anchor Pin */}
          <g transform={`translate(${tether.anchorX}, ${tether.anchorY})`}>
            <circle r="5.5" className="lg-anchor-halo" />
            <circle r="2.4" className="lg-anchor-core" />
          </g>

          {/* Minimal Glass Card Edge Bead */}
          <circle cx={tether.portX} cy={tether.portY} r="2.3" className="lg-dock-bead" />
        </svg>
      )}

      {/* Apple Liquid Glass Floating Inspector Panel */}
      <aside
        ref={cardRef}
        className={`lg-hud-card${collapsed ? ' is-collapsed' : ''}${node.online ? '' : ' is-offline'}${isMobile ? ' is-mobile' : ' is-floating'}${dragging ? ' is-dragging' : ''}`}
        style={
          isMobile
            ? undefined
            : {
                transform: `translate3d(${Math.round(hudX)}px, ${Math.round(hudY)}px, 0)`,
              }
        }
        aria-label="当前节点实时状态"
      >
        {/* Draggable Liquid Glass Header */}
        <div
          className="lg-hud-head"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          title={isMobile ? undefined : '拖动以自由摆放浮窗位置'}
        >
          <div className="lg-head-row">
            <button
              type="button"
              className="lg-hud-identity"
              onClick={onToggleCollapse}
              title={collapsed ? '展开详情' : '收起详情'}
            >
              <span className={`lg-status-dot ${node.online ? 'is-on' : 'is-off'}`} />
              <div className="lg-title-col">
                <div className="lg-name-line">
                  <span className="lg-flag">
                    <RegionFlag code={geo.code} size="sm" />
                  </span>
                  <span className="lg-name">{node.name}</span>
                </div>
                <span className="lg-sub">
                  {geo.name}
                  {shortRack ? ` · ${shortRack}` : ''}
                  {` · ${node.cpu_cores}C ${formatBytesGiB(node.mem_total)}`}
                </span>
              </div>
            </button>

            <div className="lg-head-controls">
              {totalNodes > 1 && (
                <div className="lg-nav-group">
                  <button
                    type="button"
                    className="lg-icon-btn"
                    onClick={onPrevNode}
                    aria-label="上一台服务器"
                    title="上一台"
                  >
                    ‹
                  </button>
                  <span className="lg-idx">
                    {nodeIndex + 1}/{totalNodes}
                  </span>
                  <button
                    type="button"
                    className="lg-icon-btn"
                    onClick={onNextNode}
                    aria-label="下一台服务器"
                    title="下一台"
                  >
                    ›
                  </button>
                </div>
              )}

              {!isMobile && manualPos && (
                <button
                  type="button"
                  className="lg-icon-btn is-tinted"
                  onClick={() => setManualPos(null)}
                  title="恢复自动跟随"
                  aria-label="恢复自动跟随"
                >
                  ↺
                </button>
              )}

              <button
                type="button"
                className="lg-icon-btn"
                onClick={onToggleCollapse}
                aria-label={collapsed ? '展开浮窗' : '收起浮窗'}
                title={collapsed ? '展开' : '收起'}
              >
                {collapsed ? '＋' : '−'}
              </button>

              <button
                type="button"
                className="lg-icon-btn"
                onClick={onHide}
                aria-label="关闭浮窗"
                title="关闭"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {collapsed ? (
          <div
            className="lg-compact-strip"
            onClick={onToggleCollapse}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onToggleCollapse();
            }}
          >
            <span>CPU <b>{cpuPct}%</b></span>
            <span>内存 <b>{ramPct}%</b></span>
            <span>↓ <b>{node.online ? formatNetSpeed(node.netDown, true) : '0 B/s'}</b></span>
            <span><b>{node.online && node.ping > 0 ? `${node.ping}ms` : '—'}</b></span>
          </div>
        ) : (
          <div className="lg-hud-body">
            {/* Precision Minimal Resource Meters */}
            <div className="lg-meters">
              <div className="lg-meter-row">
                <span className="lg-meter-lbl">CPU</span>
                <div className="lg-meter-track">
                  <span
                    className={`lg-meter-fill tone-${getLoadTone(cpuPct)}`}
                    style={{ width: `${cpuPct}%` }}
                  />
                </div>
                <span className="lg-meter-val">{cpuPct}%</span>
              </div>

              <div className="lg-meter-row">
                <span className="lg-meter-lbl">内存</span>
                <div className="lg-meter-track">
                  <span
                    className={`lg-meter-fill tone-${getLoadTone(ramPct, 82, 93)}`}
                    style={{ width: `${ramPct}%` }}
                  />
                </div>
                <span className="lg-meter-val">{ramPct}%</span>
              </div>

              <div className="lg-meter-row">
                <span className="lg-meter-lbl">存储</span>
                <div className="lg-meter-track">
                  <span
                    className={`lg-meter-fill tone-${getLoadTone(diskPct, 85, 95)}`}
                    style={{ width: `${diskPct}%` }}
                  />
                </div>
                <span className="lg-meter-val">{diskPct}%</span>
              </div>
            </div>

            {/* Clean Frosted Glass Telemetry Well */}
            <div className="lg-metrics-well">
              <div className="lg-metric-cell">
                <span>下行</span>
                <b>{node.online ? formatNetSpeed(node.netDown) : '0 B/s'}</b>
              </div>
              <div className="lg-metric-cell">
                <span>上行</span>
                <b>{node.online ? formatNetSpeed(node.netUp) : '0 B/s'}</b>
              </div>
              <div className="lg-metric-cell">
                <span>延迟</span>
                <b>{node.online && node.ping > 0 ? `${node.ping} ms` : '—'}</b>
              </div>
              <div className="lg-metric-cell">
                <span>运行</span>
                <b>{node.online ? node.uptime : '离线'}</b>
              </div>
            </div>

            {/* Refined Action Pills */}
            <div className="lg-actions">
              <button
                type="button"
                className={`lg-act-btn${uidBlinking ? ' is-active' : ''}`}
                onClick={onToggleUid}
                title="点亮服务器前面板蓝色 UID 定位灯"
              >
                {uidBlinking ? 'UID 闪烁' : 'UID'}
              </button>

              <button
                type="button"
                className="lg-act-btn"
                onClick={() => onLocateOnMap(geo.code)}
                title="在世界地图中定位该区域"
              >
                地图
              </button>

              <button
                type="button"
                className="lg-act-btn is-primary"
                onClick={onOpenTelemetry}
              >
                遥测
              </button>

              {canEdit && (
                <button
                  type="button"
                  className="lg-act-btn"
                  onClick={onOpenStyle}
                >
                  涂装
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
