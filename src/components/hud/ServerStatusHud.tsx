import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button } from '@ui-sdk/react/button';
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from '@ui-sdk/react/collapsible';
import {
  Meter,
  MeterIndicator,
  MeterLabel,
  MeterTrack,
  MeterValue,
} from '@ui-sdk/react/meter';
import { Separator } from '@ui-sdk/react/separator';
import { Toggle } from '@ui-sdk/react/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui-sdk/react/tooltip';
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  MapPin,
  Palette,
  Radio,
  RotateCcw,
  X,
} from 'lucide-react';
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
const HUD_DEFAULT_W = 320;
const HUD_EST_H_EXPANDED = 286;
const HUD_EST_H_COLLAPSED = 90;

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
    const sideFaceEl =
      document.querySelector<HTMLElement>('.studio-aisle-slot.is-active .srack-face-right') ??
      document.querySelector<HTMLElement>('.srack-face-right');

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
    const isSideView = Boolean(frameEl?.closest('.studio-pivot.angle-side'));
    const sideRect = isSideView ? sideFaceEl?.getBoundingClientRect() : null;
    const anchorX = ar.left + ar.width / 2;
    const anchorY = ar.top + ar.height / 2;
    const rackLeft = cabRect ? cabRect.left : ar.left - 340;
    const baseRight = cabRect ? cabRect.right : ar.right;
    const rackRight =
      sideRect && sideRect.width > 4 ? Math.max(baseRight, sideRect.right) : baseRight;

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

  if (drawerOpen) {
    return null;
  }

  if (!visible) {
    return (
      <Button
        className="kdc-hud-restore"
        onClick={onShow}
        aria-label={`恢复节点 ${node.name} 悬浮状态卡`}
      >
        <span className={`kdc-sig-dot ${node.online ? 'is-live' : 'is-err'}`} aria-hidden="true" />
        <span>{node.name}</span>
      </Button>
    );
  }

  const cpuPct = Math.min(100, Math.max(0, Math.round(node.cpu)));
  const ramPct = Math.min(100, Math.max(0, Math.round(node.ram)));
  const diskPct = Math.min(100, Math.max(0, Math.round(node.disk)));
  const geo = resolveNodeGeo(node);

  const cardW = cardSize.w || HUD_DEFAULT_W;
  const cardH = cardSize.h || (collapsed ? HUD_EST_H_COLLAPSED : HUD_EST_H_EXPANDED);
  const topBound = 66;
  const bottomBound = geom.vh - 78;
  const rightSafeLimit = drawerOpen ? geom.vw - 434 : geom.vw - 20;
  const leftSafeLimit = 20;
  const gap = 56;

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
      {tether.visible && (
        <svg
          className={`kdc-tether-layer${node.online ? '' : ' is-offline'}${rackSwitching ? ' is-rack-switching' : ''}`}
          viewBox={`0 0 ${geom.vw} ${geom.vh}`}
          width={geom.vw}
          height={geom.vh}
          aria-hidden="true"
        >
          <path
            d={tether.pathD}
            fill="none"
            className="kdc-tether-line"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {node.online && (
            <circle r="2" className="kdc-tether-pulse">
              <animateMotion
                dur="3.2s"
                repeatCount="indefinite"
                path={tether.pathD}
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.42 0 0.22 1"
              />
            </circle>
          )}

          <g transform={`translate(${tether.anchorX}, ${tether.anchorY})`}>
            <circle r="5.5" className="kdc-anchor-ring" />
            <circle r="2" className="kdc-anchor-core" />
          </g>

          <rect
            x={tether.portX - 2.5}
            y={tether.portY - 2.5}
            width="5"
            height="5"
            className="kdc-dock-node"
          />
        </svg>
      )}

      <aside
        ref={cardRef}
        className={`kdc-hud-card${collapsed ? ' is-collapsed' : ''}${node.online ? '' : ' is-offline'}${isMobile ? ' is-mobile' : ' is-floating'}${dragging ? ' is-dragging' : ''}`}
        style={
          isMobile
            ? undefined
            : {
                transform: `translate3d(${Math.round(hudX)}px, ${Math.round(hudY)}px, 0)`,
              }
        }
        aria-label="当前节点实时状态"
      >
        <Collapsible
          open={!collapsed}
          onOpenChange={(nextOpen) => {
            if (nextOpen === collapsed) onToggleCollapse();
          }}
        >
          {isMobile && (
            <CollapsibleTrigger
              className="kdc-mobile-grab"
              aria-label={collapsed ? '展开节点详情' : '收起节点详情'}
            >
              <span />
            </CollapsibleTrigger>
          )}

          <div
            className="kdc-hud-head"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <div className="kdc-hud-head-left">
              {!isMobile && (
                <GripVertical size={13} className="kdc-drag-grip" aria-hidden="true" />
              )}
              <span className={`kdc-sig-dot ${node.online ? 'is-live' : 'is-err'}`} aria-hidden="true" />
              <div className="kdc-hud-identity">
                <div className="kdc-hud-name-line">
                  <span className="kdc-hud-flag">
                    <RegionFlag code={geo.code} size="sm" />
                  </span>
                  <span className="kdc-hud-name">{node.name}</span>
                </div>
                <span className="kdc-hud-sub">
                  {geo.name}
                  {shortRack ? ` · ${shortRack}` : ''}
                  {` · ${node.cpu_cores}C ${formatBytesGiB(node.mem_total)}`}
                </span>
              </div>
            </div>

            <div className="kdc-hud-controls">
              {totalNodes > 1 && (
                <div className="kdc-hud-stepper">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          className="kdc-icon-btn"
                          onClick={onPrevNode}
                          aria-label="上一台服务器"
                        />
                      }
                    >
                      <ChevronLeft size={13} aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent side="top">上一台节点</TooltipContent>
                  </Tooltip>
                  <span className="kdc-hud-idx">
                    {nodeIndex + 1}/{totalNodes}
                  </span>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          className="kdc-icon-btn"
                          onClick={onNextNode}
                          aria-label="下一台服务器"
                        />
                      }
                    >
                      <ChevronRight size={13} aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent side="top">下一台节点</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {!isMobile && manualPos && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        className="kdc-icon-btn"
                        onClick={() => setManualPos(null)}
                        aria-label="恢复自动跟随位置"
                      />
                    }
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent side="top">恢复自动跟随</TooltipContent>
                </Tooltip>
              )}

              <CollapsibleTrigger
                className="kdc-icon-btn"
                aria-label={collapsed ? '展开浮窗' : '收起浮窗'}
              >
                {collapsed ? (
                  <ChevronUp size={13} aria-hidden="true" />
                ) : (
                  <ChevronDown size={13} aria-hidden="true" />
                )}
              </CollapsibleTrigger>

              <Button
                className="kdc-icon-btn"
                onClick={onHide}
                aria-label="关闭浮窗"
              >
                <X size={13} aria-hidden="true" />
              </Button>
            </div>
          </div>

          {collapsed && (
            <Button className="kdc-compact-strip" onClick={onToggleCollapse}>
              <span>
                CPU <b>{cpuPct}%</b>
              </span>
              <span>
                RAM <b>{ramPct}%</b>
              </span>
              <span>
                ↓ <b>{node.online ? formatNetSpeed(node.netDown, true) : '0 B/s'}</b>
              </span>
              <span>
                <b>{node.online && node.ping > 0 ? `${node.ping}ms` : '—'}</b>
              </span>
            </Button>
          )}

          <CollapsiblePanel className="kdc-hud-panel">
            <Separator className="kdc-hud-sep" />
            <div className="kdc-hud-body">
              <div className="kdc-meters-col">
                <Meter
                  value={cpuPct}
                  min={0}
                  max={100}
                  className={`kdc-meter tone-${getLoadTone(cpuPct)}`}
                >
                  <MeterLabel className="kdc-meter-lbl">CPU</MeterLabel>
                  <MeterTrack className="kdc-meter-track">
                    <MeterIndicator className="kdc-meter-ind" />
                  </MeterTrack>
                  <MeterValue className="kdc-meter-val" />
                </Meter>

                <Meter
                  value={ramPct}
                  min={0}
                  max={100}
                  className={`kdc-meter tone-${getLoadTone(ramPct, 82, 93)}`}
                >
                  <MeterLabel className="kdc-meter-lbl">内存</MeterLabel>
                  <MeterTrack className="kdc-meter-track">
                    <MeterIndicator className="kdc-meter-ind" />
                  </MeterTrack>
                  <MeterValue className="kdc-meter-val" />
                </Meter>

                <Meter
                  value={diskPct}
                  min={0}
                  max={100}
                  className={`kdc-meter tone-${getLoadTone(diskPct, 85, 95)}`}
                >
                  <MeterLabel className="kdc-meter-lbl">存储</MeterLabel>
                  <MeterTrack className="kdc-meter-track">
                    <MeterIndicator className="kdc-meter-ind" />
                  </MeterTrack>
                  <MeterValue className="kdc-meter-val" />
                </Meter>
              </div>

              <div className="kdc-kv-grid">
                <div className="kdc-kv-cell">
                  <span>下行</span>
                  <b>{node.online ? formatNetSpeed(node.netDown) : '0 B/s'}</b>
                </div>
                <div className="kdc-kv-cell">
                  <span>上行</span>
                  <b>{node.online ? formatNetSpeed(node.netUp) : '0 B/s'}</b>
                </div>
                <div className="kdc-kv-cell">
                  <span>延迟</span>
                  <b>{node.online && node.ping > 0 ? `${node.ping} ms` : '—'}</b>
                </div>
                <div className="kdc-kv-cell">
                  <span>运行</span>
                  <b>{node.online ? node.uptime : '离线'}</b>
                </div>
              </div>

              <div className="kdc-hud-actions">
                <Toggle
                  pressed={uidBlinking}
                  onPressedChange={() => onToggleUid()}
                  className="kdc-hud-act"
                  aria-label="切换物理定位灯 UID"
                >
                  <Radio size={12} aria-hidden="true" />
                  <span>{uidBlinking ? 'UID 亮' : 'UID'}</span>
                </Toggle>

                <Button
                  className="kdc-hud-act"
                  onClick={() => onLocateOnMap(geo.code)}
                >
                  <MapPin size={12} aria-hidden="true" />
                  <span>地图</span>
                </Button>

                <Button
                  data-variant="solid"
                  className="kdc-hud-act is-primary"
                  onClick={onOpenTelemetry}
                >
                  <Activity size={12} aria-hidden="true" />
                  <span>遥测</span>
                </Button>

                {canEdit && (
                  <Button className="kdc-hud-act" onClick={onOpenStyle}>
                    <Palette size={12} aria-hidden="true" />
                    <span>涂装</span>
                  </Button>
                )}
              </div>
            </div>
          </CollapsiblePanel>
        </Collapsible>
      </aside>
    </>
  );
}
