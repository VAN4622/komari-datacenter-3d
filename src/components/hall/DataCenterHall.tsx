import { useRef, useState, type DragEvent, type PointerEvent, type WheelEvent } from 'react';
import { RackCabinet3D } from '@/components/hall/RackCabinet3D';
import type { AppConfig, NodeInfo, RackCabinetData } from '@/types/rack';

export interface CameraState {
  pitch: number; // degrees, positive looks down from above
  yaw: number; // degrees, negative shows right side of racks
  zoom: number; // 0.65 .. 1.25
  panX: number; // horizontal shift in px
}

interface DataCenterHallProps {
  racks: RackCabinetData[];
  nodesMap: Map<string, NodeInfo>;
  nodeStyles: AppConfig['nodeStyles'];
  activeRackId: string;
  selectedNodeId: string | null;
  uidBlinkingIds: Set<string>;
  showStrip: boolean;
  scale: AppConfig['scale'];
  camera: CameraState;
  isOrbiting: boolean;
  drawerOpen: boolean;
  dragOverUid: string | null;
  dragOverRackId: string | null;
  onCameraChange: (updater: (prev: CameraState) => CameraState) => void;
  onOrbitStateChange: (orbiting: boolean) => void;
  onActivateRack: (rackId: string) => void;
  onRenameRack: (rackId: string, name: string) => void;
  onSelectNode: (nodeId: string, rackId: string) => void;
  onAddRack: () => void;
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

export function DataCenterHall({
  racks,
  nodesMap,
  nodeStyles,
  activeRackId,
  selectedNodeId,
  uidBlinkingIds,
  showStrip,
  scale,
  camera,
  isOrbiting,
  drawerOpen,
  dragOverUid,
  dragOverRackId,
  onCameraChange,
  onOrbitStateChange,
  onActivateRack,
  onRenameRack,
  onSelectNode,
  onAddRack,
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
}: DataCenterHallProps) {
  const dragOriginRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    yaw: number;
    pitch: number;
    panX: number;
    isPan: boolean;
  } | null>(null);
  const [draggingScene, setDraggingScene] = useState(false);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Only orbit/pan when dragging the hall background / floor, not interactive buttons or draggable servers
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('.rack-unit3d') ||
      target.closest('.cab3d-ghost-bay')
    ) {
      return;
    }
    dragOriginRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      yaw: camera.yaw,
      pitch: camera.pitch,
      panX: camera.panX,
      isPan: e.shiftKey || e.button === 1,
    };
    setDraggingScene(true);
    onOrbitStateChange(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current;
    if (!origin || origin.pointerId !== e.pointerId) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (origin.isPan) {
      onCameraChange((prev) => ({
        ...prev,
        panX: Math.max(-360, Math.min(360, origin.panX + dx)),
      }));
    } else {
      onCameraChange((prev) => ({
        ...prev,
        yaw: Math.max(-44, Math.min(44, origin.yaw + dx * 0.16)),
        pitch: Math.max(0, Math.min(38, origin.pitch + dy * 0.12)),
      }));
    }
  };

  const endOrbit = (e: PointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current;
    if (!origin || origin.pointerId !== e.pointerId) return;
    dragOriginRef.current = null;
    setDraggingScene(false);
    onOrbitStateChange(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    onCameraChange((prev) => ({
      ...prev,
      zoom: Math.max(0.65, Math.min(1.22, Number((prev.zoom + delta).toFixed(3)))),
    }));
  };

  // Shift scene gently left when the right inspector drawer is open on desktop
  const drawerOffset = drawerOpen ? -140 : 0;

  return (
    <main
      className={`hall-viewport scale-${scale}${draggingScene ? ' is-dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endOrbit}
      onPointerCancel={endOrbit}
      onWheel={handleWheel}
      aria-label="三维透视数据中心机房视图"
    >
      {/* Ambient architectural hall atmosphere layers */}
      <div className="hall-ceiling-glow" aria-hidden="true" />
      <div className="hall-vignette" aria-hidden="true" />

      <div className="hall-perspective-rig">
        <div
          className={`hall-world${isOrbiting ? ' is-instant' : ''}`}
          style={{
            transform: `translate3d(${camera.panX + drawerOffset}px, 14px, 0px) scale(${camera.zoom}) rotateX(${-camera.pitch}deg) rotateY(${camera.yaw}deg)`,
          }}
        >
          {/* Architectural Raised-Floor Plane with 600mm perforated tiles & cold-aisle illumination */}
          <div className="hall-floor" aria-hidden="true">
            <div className="hall-floor-tiles" />
            <div className="hall-floor-aisle-strip" />
            <div className="hall-floor-marking">
              <span>ZONE A // COLD AISLE CONTAINMENT</span>
              <span>21.4°C · RH 46% · TIER-IV</span>
            </div>
          </div>

          {/* Rear Architectural Hall Wall (subtle depth backdrop) */}
          <div className="hall-backwall" aria-hidden="true">
            <div className="hall-backwall-rib" />
            <div className="hall-backwall-rib" />
            <div className="hall-backwall-rib" />
          </div>

          {/* Overhead Cable Ladder & Linear Architectural LED Luminaires */}
          <div className="hall-overhead-truss" aria-hidden="true">
            <div className="hall-cable-ladder" />
            <div className="hall-ceiling-light" />
          </div>

          {/* Volumetric 3D Rack Row */}
          <div className="hall-rack-row">
            {racks.map((rack, idx) => (
              <RackCabinet3D
                key={rack.id}
                rack={rack}
                rackIndex={idx}
                nodesMap={nodesMap}
                nodeStyles={nodeStyles}
                isActive={rack.id === activeRackId}
                selectedNodeId={selectedNodeId}
                uidBlinkingIds={uidBlinkingIds}
                showStrip={showStrip}
                dragOverUid={dragOverUid}
                dragOverRackId={dragOverRackId}
                onActivateRack={onActivateRack}
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
            ))}

            {/* Subtle architectural floor expansion bay at end of row */}
            {racks.length < 5 && (
              <button
                type="button"
                className="cab3d-ghost-bay"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddRack();
                }}
                title="在机房冷通道末尾扩展新机柜"
              >
                <span className="ghost-plus">+</span>
                <span className="ghost-label">BAY A-0{racks.length + 1}</span>
                <span className="ghost-sub">扩展机柜位</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
