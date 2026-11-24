import { useState, type DragEvent } from 'react';
import { StudioRackUnit } from '@/components/studio/StudioRackUnit';
import { estimateRackWatts, getEffectiveStyle, getUnitHeightU } from '@/data/fleet';
import type { AppConfig, NodeInfo, RackCabinetData } from '@/types/rack';

interface StudioRackCabinetProps {
  rack: RackCabinetData;
  rackIndex: number;
  nodesMap: Map<string, NodeInfo>;
  nodeStyles: AppConfig['nodeStyles'];
  selectedNodeId: string | null;
  uidBlinkingIds: Set<string>;
  showStrip: boolean;
  editMode: boolean;
  dragOverUid: string | null;
  dragOverRackId: string | null;
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

export function StudioRackCabinet({
  rack,
  rackIndex,
  nodesMap,
  nodeStyles,
  selectedNodeId,
  uidBlinkingIds,
  showStrip,
  editMode,
  dragOverUid,
  dragOverRackId,
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
}: StudioRackCabinetProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(rack.name);

  const bayCode = `R-${String(rackIndex + 1).padStart(2, '0')}`;
  const totalU = rack.items.reduce((sum, item) => sum + getUnitHeightU(item, nodesMap, nodeStyles), 0);
  const watts = estimateRackWatts(rack, nodesMap, nodeStyles);
  const onlineCount = rack.items.reduce((count, item) => {
    if (item.type !== 'node') return count;
    return count + (nodesMap.get(item.nodeId)?.online ? 1 : 0);
  }, 0);
  const totalNodes = rack.items.filter((i) => i.type === 'node').length;
  const hasHotNode = rack.items.some((item) => {
    if (item.type !== 'node') return false;
    const n = nodesMap.get(item.nodeId);
    return n?.online && n.cpu >= 80;
  });

  // Top-down EIA-310D U numbering
  let uCursor = Math.max(12, totalU + 2);
  const uLabels = rack.items.map((item) => {
    const h = getUnitHeightU(item, nodesMap, nodeStyles);
    const topU = uCursor;
    const botU = uCursor - h + 1;
    uCursor -= h;
    return h === 1 ? `${topU}U` : `${botU}-${topU}U`;
  });

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== rack.name) {
      onRenameRack(rack.id, trimmed);
    } else {
      setNameDraft(rack.name);
    }
    setEditingName(false);
  };

  const beaconClass =
    totalNodes === 0 ? 'is-idle' : hasHotNode ? 'is-warn' : onlineCount > 0 ? 'is-ok' : 'is-off';

  // Render subtle realistic matte blanking baffles when rack has fewer U units
  const blankBaffleCount = Math.max(1, Math.min(3, 7 - Math.min(7, totalU)));

  return (
    <section
      className={`srack-cabinet theme-${rack.theme}`}
      data-rack-id={rack.id}
      aria-label={`机柜 ${rack.name}`}
    >
      {/* Grounded Photographic Studio Shadow */}
      <div className="srack-studio-shadow" aria-hidden="true" />
      <div className="srack-studio-reflection" aria-hidden="true" />

      {/* True 3D Extruded Top Roof Cap */}
      <div className="srack-face srack-face-top" aria-hidden="true">
        <div className={`srack-roof-led ${beaconClass}`} />
        <div className="srack-roof-vents">
          <span className="srack-roof-fan" />
          <span className="srack-roof-fan" />
        </div>
      </div>

      {/* True 3D Extruded Right Side Chassis Wall (Visible in Fixed Side Perspective) */}
      <div className="srack-face srack-face-right" aria-hidden="true">
        <div className="srack-side-chamfer" />
        <div className="srack-side-panel">
          <div className="srack-side-rivets top">
            <span />
            <span />
          </div>
          <div className="srack-side-louver" />
          <div className="srack-side-handle" />
          <div className="srack-side-louver is-lower" />
          <div className="srack-side-rivets bottom">
            <span />
            <span />
          </div>
        </div>
      </div>

      {/* Left Edge Thickness */}
      <div className="srack-face srack-face-left" aria-hidden="true" />

      {/* Main Front Precision Hardware Enclosure */}
      <div className="srack-face srack-face-front">
        <header className="srack-header">
          <div className="srack-header-left">
            <span className={`srack-beacon ${beaconClass}`} />
            <span className="srack-bay-code">{bayCode}</span>
            {editMode && editingName ? (
              <input
                type="text"
                className="srack-name-input"
                value={nameDraft}
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') {
                    setNameDraft(rack.name);
                    setEditingName(false);
                  }
                }}
              />
            ) : editMode ? (
              <button
                type="button"
                className="srack-name-btn"
                title="点击重命名机柜"
                onClick={(e) => {
                  e.stopPropagation();
                  setNameDraft(rack.name);
                  setEditingName(true);
                }}
              >
                {rack.name}
              </button>
            ) : (
              <span className="srack-name-text">{rack.name}</span>
            )}
          </div>

          <div className="srack-header-right">
            <span className="srack-head-pill">{totalU}U</span>
            <span className="srack-head-pill">{watts}W</span>
          </div>
        </header>

        <div className="srack-body">
          <div className="srack-post left" aria-hidden="true" />

          <div
            className={`srack-bay${dragOverRackId === rack.id ? ' is-drop-target' : ''}`}
            onDragOver={editMode ? (e) => onDragOverRack(e, rack.id) : undefined}
            onDragLeave={editMode ? onDragLeaveRack : undefined}
            onDrop={editMode ? (e) => onDropOnRack(e, rack.id) : undefined}
          >
            <div className="srack-rail left" aria-hidden="true" />
            <div className="srack-rail right" aria-hidden="true" />

            {rack.items.length === 0 ? (
              <div className="srack-empty">
                <p>空置机柜槽位</p>
                <span>{editMode ? '打开右侧面板即可上架设备' : '暂无已上架节点'}</span>
              </div>
            ) : (
              <div className="srack-stack">
                {rack.items.map((item, idx) => {
                  const node = item.type === 'node' ? nodesMap.get(item.nodeId) : undefined;
                  const style = node ? getEffectiveStyle(node, nodeStyles) : undefined;
                  return (
                    <StudioRackUnit
                      key={item.uid}
                      rackId={rack.id}
                      item={item}
                      index={idx}
                      totalItems={rack.items.length}
                      uRangeLabel={uLabels[idx]}
                      node={node}
                      nodeStyle={style}
                      rackWatts={watts}
                      onlineCount={onlineCount}
                      isSelected={item.type === 'node' && selectedNodeId === item.nodeId}
                      uidBlinking={item.type === 'node' && uidBlinkingIds.has(item.nodeId)}
                      showStrip={showStrip}
                      editMode={editMode}
                      isDragOver={dragOverUid === item.uid}
                      onSelect={() => {
                        if (item.type === 'node') {
                          onSelectNode(item.nodeId, rack.id);
                        }
                      }}
                      onMoveUp={() => onMoveItem(rack.id, idx, -1)}
                      onMoveDown={() => onMoveItem(rack.id, idx, 1)}
                      onToggleUid={() => {
                        if (item.type === 'node') onToggleUid(item.nodeId);
                      }}
                      onRemove={() => onRemoveItem(rack.id, item.uid)}
                      onDragStart={(e) => onDragStartItem(e, rack.id, item.uid)}
                      onDragOver={(e) => onDragOverItem(e, item.uid)}
                      onDragLeave={onDragLeaveItem}
                      onDrop={(e) => onDropOnItem(e, rack.id, item.uid)}
                    />
                  );
                })}
              </div>
            )}

            {/* Realistic Dark Blanking Plates & Recessed Lower Cold Intake */}
            <div className="srack-lower-baffles" aria-hidden="true">
              {Array.from({ length: blankBaffleCount }).map((_, i) => (
                <div key={i} className="srack-baffle-plate">
                  <span className="srack-baffle-screw" />
                  <span className="srack-baffle-mesh" />
                  <span className="srack-baffle-screw" />
                </div>
              ))}
              <div className="srack-intake-footer">EIA-310D // STUDIO CHASSIS</div>
            </div>
          </div>

          <div className="srack-post right" aria-hidden="true" />
        </div>

        <footer className="srack-plinth">
          <span className="srack-plinth-vent" aria-hidden="true" />
          <span className="srack-plinth-text">
            {bayCode} · {onlineCount}/{totalNodes} ONLINE
          </span>
          <span className="srack-plinth-vent" aria-hidden="true" />
        </footer>
      </div>
    </section>
  );
}
