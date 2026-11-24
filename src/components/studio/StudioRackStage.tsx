import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type TouchEvent,
} from 'react';
import { StudioRackCabinet } from '@/components/studio/StudioRackCabinet';
import type { AppConfig, NodeInfo, RackCabinetData, RackViewAngle } from '@/types/rack';

interface StudioRackStageProps {
  racks: RackCabinetData[];
  activeRackId: string;
  rackNavHint?: { seq: number; dir: 'next' | 'prev' } | null;
  nodesMap: Map<string, NodeInfo>;
  nodeStyles: AppConfig['nodeStyles'];
  selectedNodeId: string | null;
  uidBlinkingIds: Set<string>;
  showStrip: boolean;
  scale: AppConfig['scale'];
  viewAngle: RackViewAngle;
  hudVisible: boolean;
  drawerOpen: boolean;
  editMode: boolean;
  dragOverUid: string | null;
  dragOverRackId: string | null;
  onSelectRack: (rackId: string, dir?: 'next' | 'prev') => void;
  onRenameRack: (rackId: string, name: string) => void;
  onSelectNode: (nodeId: string, rackId: string) => void;
  onMoveItem: (rackId: string, index: number, delta: -1 | 1) => void;
  onToggleUid: (nodeId: string) => void;
  onRemoveItem: (rackId: string, uid: string) => void;
  onDragStartItem: (e: DragEvent<HTMLDivElement>, rackId: string, uid: string) => void;
  onDragOverItem: (e: DragEvent<HTMLDivElement>, uid: string) => void;
  onDragLeaveItem: () => void;
  onDropOnItem: (e: DragEvent<HTMLDivElement>, targetRackId: string, targetUid: string) => void;
  onDragOverRack: (e: DragEvent<HTMLDivElement>, rackId: string) => void;
  onDragLeaveRack: () => void;
  onDropOnRack: (e: DragEvent<HTMLDivElement>, targetRackId: string) => void;
}

type SlideDir = 'next' | 'prev';

const WHEEL_COOLDOWN_MS = 780;

export function StudioRackStage({
  racks,
  activeRackId,
  nodesMap,
  nodeStyles,
  selectedNodeId,
  uidBlinkingIds,
  showStrip,
  scale,
  viewAngle,
  hudVisible,
  drawerOpen,
  editMode,
  dragOverUid,
  dragOverRackId,
  onSelectRack,
  onRenameRack,
  onSelectNode,
  onMoveItem,
  onToggleUid,
  onRemoveItem,
  onDragStartItem,
  onDragOverItem,
  onDragLeaveItem,
  onDropOnItem,
  onDragOverRack,
  onDragLeaveRack,
  onDropOnRack,
}: StudioRackStageProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const touchRef = useRef<{
    x: number;
    y: number;
    t: number;
    locked: 'h' | 'v' | null;
    dx: number;
  } | null>(null);
  const wheelLockUntilRef = useRef<number>(0);

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const prevRackIdRef = useRef<string>(activeRackId);

  useEffect(() => {
    if (prevRackIdRef.current === activeRackId) return;
    prevRackIdRef.current = activeRackId;
    setIsSwitching(true);
    const timer = window.setTimeout(() => {
      setIsSwitching(false);
    }, 880);
    return () => window.clearTimeout(timer);
  }, [activeRackId]);

  const activeIdx = Math.max(
    0,
    racks.findIndex((r) => r.id === activeRackId),
  );
  const activeRack = racks[activeIdx] ?? racks[0];

  const stepRack = useCallback(
    (delta: -1 | 1) => {
      if (racks.length <= 1) return;
      const dir: SlideDir = delta > 0 ? 'next' : 'prev';
      const nextIdx = (activeIdx + delta + racks.length) % racks.length;
      onSelectRack(racks[nextIdx].id, dir);
    },
    [racks, activeIdx, onSelectRack],
  );

  // Keyboard Left/Right arrow navigation along the horizontal cold aisle
  useEffect(() => {
    if (racks.length <= 1) return;
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepRack(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepRack(1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [racks.length, stepRack]);

  // Smooth horizontal trackpad two-finger swipe along the aisle (desktop)
  useEffect(() => {
    const el = stageRef.current;
    if (!el || racks.length <= 1) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < 28 || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.6) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.inspector-drawer, .hud-popover, .lg-hud-card')) return;

      const now = performance.now();
      if (now < wheelLockUntilRef.current) return;

      if (e.deltaX > 0 && activeIdx < racks.length - 1) {
        wheelLockUntilRef.current = now + WHEEL_COOLDOWN_MS;
        stepRack(1);
      } else if (e.deltaX < 0 && activeIdx > 0) {
        wheelLockUntilRef.current = now + WHEEL_COOLDOWN_MS;
        stepRack(-1);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: true });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [racks.length, activeIdx, stepRack]);

  // Live 1:1 touch drag with gentle elastic edge damping & velocity flick
  const handleTouchStart = (e: TouchEvent<HTMLElement>) => {
    if (racks.length <= 1 || e.touches.length !== 1) return;
    touchRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: performance.now(),
      locked: null,
      dx: 0,
    };
  };

  const handleTouchMove = (e: TouchEvent<HTMLElement>) => {
    const st = touchRef.current;
    if (!st || e.touches.length !== 1) return;
    const rawDx = e.touches[0].clientX - st.x;
    const rawDy = e.touches[0].clientY - st.y;

    if (!st.locked) {
      if (Math.abs(rawDx) < 10 && Math.abs(rawDy) < 10) return;
      st.locked = Math.abs(rawDx) > Math.abs(rawDy) * 1.2 ? 'h' : 'v';
    }
    if (st.locked !== 'h') return;

    // Apply elastic resistance when dragging past the first or last rack
    const atLeadingEdge = activeIdx === 0 && rawDx > 0;
    const atTrailingEdge = activeIdx === racks.length - 1 && rawDx < 0;
    const dampedDx = atLeadingEdge || atTrailingEdge ? rawDx * 0.28 : rawDx;

    st.dx = rawDx;
    setIsDragging(true);
    setDragOffset(dampedDx);
  };

  const handleTouchEnd = () => {
    const st = touchRef.current;
    touchRef.current = null;
    setIsDragging(false);
    setDragOffset(0);

    if (!st || st.locked !== 'h' || racks.length <= 1) return;
    const elapsed = Math.max(1, performance.now() - st.t);
    const isQuickFlick = elapsed < 280 && Math.abs(st.dx) > 28;
    const threshold = isQuickFlick ? 28 : 52;
    if (st.dx < -threshold && activeIdx < racks.length - 1) {
      stepRack(1);
    } else if (st.dx > threshold && activeIdx > 0) {
      stepRack(-1);
    }
  };

  if (!activeRack) return null;

  const prevRack = racks.length > 1 ? racks[(activeIdx - 1 + racks.length) % racks.length] : null;
  const nextRack = racks.length > 1 ? racks[(activeIdx + 1) % racks.length] : null;

  const trackStyle: CSSProperties = {
    transform:
      dragOffset !== 0
        ? `translate3d(calc(${-activeIdx * 100}% + ${dragOffset.toFixed(1)}px), 0, 0)`
        : `translate3d(${-activeIdx * 100}%, 0, 0)`,
  };

  return (
    <main
      ref={stageRef}
      className={`studio-stage scale-${scale} angle-${viewAngle}${hudVisible ? ' has-hud' : ''}${drawerOpen ? ' has-drawer' : ''}${isDragging ? ' is-dragging' : ''}${isSwitching ? ' is-switching' : ''}`}
      aria-label="极简影棚拟物机柜舞台"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Pure Minimalist Studio Lighting Backdrop (static GPU layer so Liquid Glass chrome avoids full-screen re-blur) */}
      <div className="studio-backdrop" aria-hidden="true">
        <div className="studio-softbox" />
        <div className="studio-floor-horizon" />
        <div className="studio-vignette" />
      </div>

      {/* Subtle Liquid Glass Stage Side Arrows for Multi-Rack Camera Pan */}
      {racks.length > 1 && (
        <>
          <button
            type="button"
            className="studio-side-nav is-prev"
            onClick={() => stepRack(-1)}
            aria-label={`切换到上一座机柜：${prevRack?.name || ''}`}
            title={`上一座机柜 · ${prevRack?.name || ''} (←)`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10.25 3.25L5.5 8l4.75 4.75"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className="studio-side-nav is-next"
            onClick={() => stepRack(1)}
            aria-label={`切换到下一座机柜：${nextRack?.name || ''}`}
            title={`下一座机柜 · ${nextRack?.name || ''} (→)`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M5.75 3.25L10.5 8l-4.75 4.75"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      )}

      {/* Persistent Horizontal Cold-Aisle Camera Track (zero DOM remount on rack switch) */}
      <div className="studio-aisle-viewport">
        <div className="studio-aisle-track" style={trackStyle}>
          {racks.map((rack, idx) => {
            const isActive = idx === activeIdx;
            const posClass = isActive ? 'is-active' : idx < activeIdx ? 'is-before' : 'is-after';

            return (
              <div
                key={rack.id}
                className={`studio-aisle-slot ${posClass}`}
                aria-hidden={!isActive}
              >
                <div className="studio-viewport-scroll">
                  <div className="studio-camera-frame">
                    <div className="studio-slot-motion">
                      <div className="studio-rack-scene">
                        <div className={`studio-pivot angle-${viewAngle}`}>
                          <StudioRackCabinet
                            rack={rack}
                            rackIndex={idx}
                            nodesMap={nodesMap}
                            nodeStyles={nodeStyles}
                            selectedNodeId={isActive && !isSwitching ? selectedNodeId : null}
                            uidBlinkingIds={uidBlinkingIds}
                            showStrip={showStrip}
                            editMode={isActive ? editMode : false}
                            dragOverUid={isActive ? dragOverUid : null}
                            dragOverRackId={isActive ? dragOverRackId : null}
                            onRenameRack={onRenameRack}
                            onSelectNode={onSelectNode}
                            onMoveItem={onMoveItem}
                            onToggleUid={onToggleUid}
                            onRemoveItem={onRemoveItem}
                            onDragStartItem={onDragStartItem}
                            onDragOverItem={onDragOverItem}
                            onDragLeaveItem={onDragLeaveItem}
                            onDropOnItem={onDropOnItem}
                            onDragOverRack={onDragOverRack}
                            onDragLeaveRack={onDragLeaveRack}
                            onDropOnRack={onDropOnRack}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
