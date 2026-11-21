import { useState, type DragEvent } from 'react';
import { RackUnit3D } from '@/components/hall/RackUnit3D';
import { estimateRackWatts, getEffectiveStyle, getUnitHeightU } from '@/data/fleet';
import type { AppConfig, NodeInfo, RackCabinetData } from '@/types/rack';

interface RackCabinet3DProps {
  rack: RackCabinetData;
  rackIndex: number;
  nodesMap: Map<string, NodeInfo>;
  nodeStyles: AppConfig['nodeStyles'];
  isActive: boolean;
  selectedNodeId: string | null;
  uidBlinkingIds: Set<string>;
  showStrip: boolean;
  dragOverUid: string | null;
  dragOverRackId: string | null;
  onActivateRack: (rackId: string) => void;
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

export function RackCabinet3D({
  rack,
  rackIndex,
  nodesMap,
  nodeStyles,
  isActive,
  selectedNodeId,
  uidBlinkingIds,
  showStrip,
  dragOverUid,
  dragOverRackId,
  onActivateRack,
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
}: RackCabinet3DProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(rack.name);

  const bayCode = `A-${String(rackIndex + 1).padStart(2, '0')}`;
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

  // Compute U range numbers top-down from 42U standard data center numbering
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

  const beaconClass = totalNodes === 0 ? 'is-idle' : hasHotNode ? 'is-warn' : onlineCount > 0 ? 'is-ok' : 'is-off';

  return (
    <section
      className={`cab3d-enclosure theme-${rack.theme}${isActive ? ' is-active' : ''}`}
      data-rack-id={rack.id}
      onClick={(e) => {
        e.stopPropagation();
        onActivateRack(rack.id);
      }}
    >
      {/* Floor Contact Shadow & Painted Aisle Bay Marker (flat on floor plane) */}
      <div className="cab3d-floor-shadow" aria-hidden="true">
        <div className="cab3d-floor-bay-tag">
          <span className="bay-code">{bayCode}</span>
          <span className="bay-sep" />
          <span className="bay-meta">{watts}W</span>
        </div>
      </div>

      {/* True 3D Top Roof Panel (extruded backward along -Z) */}
      <div className="cab3d-face cab3d-top" aria-hidden="true">
        <div className={`cab3d-roof-beacon ${beaconClass}`} />
        <div className="cab3d-roof-grid">
          <div className="cab3d-roof-vent">
            <span className="cab3d-fan-ring" />
            <span className="cab3d-fan-ring" />
          </div>
          <div className="cab3d-roof-grommets">
            <span className="cab3d-grommet" />
            <span className="cab3d-grommet" />
          </div>
        </div>
        <div className="cab3d-roof-stencil">{bayCode} // 42U-EIA</div>
      </div>

      {/* True 3D Right Side Wall (perforated industrial enclosure panel) */}
      <div className="cab3d-face cab3d-right" aria-hidden="true">
        <div className="cab3d-side-frame">
          <div className="cab3d-side-louver-top" />
          <div className="cab3d-side-latch" />
          <div className="cab3d-side-louver-bot" />
          <div className="cab3d-side-exhaust-glow" />
        </div>
      </div>

      {/* True 3D Left Side Wall */}
      <div className="cab3d-face cab3d-left" aria-hidden="true">
        <div className="cab3d-side-frame">
          <div className="cab3d-side-louver-top" />
          <div className="cab3d-side-latch" />
          <div className="cab3d-side-louver-bot" />
        </div>
      </div>

      {/* True 3D Rear Wall */}
      <div className="cab3d-face cab3d-back" aria-hidden="true" />

      {/* Front Faceplate (at z = 0 for razor-sharp SVG & typography) */}
      <div className="cab3d-face cab3d-front">
        <header className="cab3d-header">
          <div className="cab3d-head-left">
            <span className={`cab3d-beacon-dot ${beaconClass}`} />
            {editingName ? (
              <input
                className="cab3d-name-input"
                value={nameDraft}
                autoFocus
                maxLength={28}
                onClick={(e) => e.stopPropagation()}
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
            ) : (
              <button
                type="button"
                className="cab3d-name-btn"
                title="点击重命名机柜"
                onClick={(e) => {
                  e.stopPropagation();
                  onActivateRack(rack.id);
                  setNameDraft(rack.name);
                  setEditingName(true);
                }}
              >
                {rack.name}
              </button>
            )}
          </div>

          <div className="cab3d-head-right">
            <span className="cab3d-stat">{totalU}U</span>
            <span className="cab3d-stat">{watts}W</span>
          </div>
        </header>

        <div className="cab3d-body">
          <div className="cab3d-post cab3d-post-left" aria-hidden="true" />

          <div
            className={`cab3d-bay${dragOverRackId === rack.id ? ' is-drop-target' : ''}`}
            onDragOver={(e) => onDragOverRack(e, rack.id)}
            onDragLeave={onDragLeaveRack}
            onDrop={(e) => onDropOnRack(e, rack.id)}
          >
            <div className="cab3d-rail cab3d-rail-left" aria-hidden="true" />
            <div className="cab3d-rail cab3d-rail-right" aria-hidden="true" />

            {rack.items.length === 0 ? (
              <div className="cab3d-empty">
                <p className="cab3d-empty-title">空置机柜槽位</p>
                <p className="cab3d-empty-hint">拖入设备或打开右侧面板上架</p>
              </div>
            ) : (
              <div className="cab3d-stack">
                {rack.items.map((item, idx) => {
                  const node = item.type === 'node' ? nodesMap.get(item.nodeId) : undefined;
                  const style = node ? getEffectiveStyle(node, nodeStyles) : undefined;
                  return (
                    <RackUnit3D
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
                      isDragOver={dragOverUid === item.uid}
                      onSelect={() => {
                        onActivateRack(rack.id);
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

            {/* Open dark lower rail cavity so every cabinet feels full-height & architectural */}
            <div className="cab3d-lower-cavity" aria-hidden="true">
              <div className="cab3d-cavity-rail-l" />
              <div className="cab3d-cavity-rail-r" />
              <span className="cab3d-cavity-mark">EIA-310D // COLD INTAKE</span>
            </div>
          </div>

          <div className="cab3d-post cab3d-post-right" aria-hidden="true" />
        </div>

        <footer className="cab3d-plinth">
          <span className="cab3d-plinth-vent" aria-hidden="true" />
          <span className="cab3d-plinth-label">
            {bayCode} · {onlineCount}/{totalNodes} ONLINE
          </span>
          <span className="cab3d-plinth-vent" aria-hidden="true" />
        </footer>
      </div>
    </section>
  );
}
