import { memo, type DragEvent } from 'react';
import { Button } from '@ui-sdk/react/button';
import { Toggle } from '@ui-sdk/react/toggle';
import { BlankSvg, PduSvg, ServerUnitSvg } from '@/components/hardware/ServerChassisSvg';
import { RegionFlag } from '@/components/ui/RegionFlag';
import { formatNetSpeed } from '@/lib/formatters';
import { resolveNodeGeo } from '@/lib/geoRegions';
import type { EffectiveNodeStyle, NodeInfo, RackItem } from '@/types/rack';

interface StudioRackUnitProps {
  rackId: string;
  item: RackItem;
  index: number;
  totalItems: number;
  uRangeLabel: string;
  node?: NodeInfo;
  nodeStyle?: EffectiveNodeStyle;
  rackWatts: number;
  onlineCount: number;
  isSelected: boolean;
  uidBlinking: boolean;
  showStrip: boolean;
  editMode: boolean;
  isDragOver: boolean;
  onSelectNode: (nodeId: string, rackId: string) => void;
  onMoveItem: (rackId: string, index: number, delta: -1 | 1) => void;
  onToggleUid: (nodeId: string) => void;
  onRemoveItem: (rackId: string, uid: string) => void;
  onDragStartItem: (e: DragEvent<HTMLDivElement>, rackId: string, uid: string) => void;
  onDragOverItem: (e: DragEvent<HTMLDivElement>, uid: string) => void;
  onDragLeaveItem: () => void;
  onDropOnItem: (e: DragEvent<HTMLDivElement>, targetRackId: string, targetUid: string) => void;
}

export const StudioRackUnit = memo(function StudioRackUnit({
  rackId,
  item,
  index,
  totalItems,
  uRangeLabel,
  node,
  nodeStyle,
  rackWatts,
  onlineCount,
  isSelected,
  uidBlinking,
  showStrip,
  editMode,
  isDragOver,
  onSelectNode,
  onMoveItem,
  onToggleUid,
  onRemoveItem,
  onDragStartItem,
  onDragOverItem,
  onDragLeaveItem,
  onDropOnItem,
}: StudioRackUnitProps) {
  const isNode = item.type === 'node' && Boolean(node) && Boolean(nodeStyle);
  const isOff = isNode && !node!.online;
  const isHot = isNode && node!.online && node!.cpu >= 80;

  const handleSelect = () => {
    if (item.type === 'node') {
      onSelectNode(item.nodeId, rackId);
    }
  };

  return (
    <div
      className={`srack-unit${isSelected ? ' is-selected' : ''}${isDragOver ? ' is-drag-over' : ''}${isNode ? ' is-node' : ''}`}
      data-uid={item.uid}
      data-rack-id={rackId}
      data-selected-unit={isSelected ? 'true' : undefined}
      draggable={editMode}
      onDragStart={editMode ? (e) => onDragStartItem(e, rackId, item.uid) : undefined}
      onDragOver={editMode ? (e) => onDragOverItem(e, item.uid) : undefined}
      onDragLeave={editMode ? onDragLeaveItem : undefined}
      onDrop={editMode ? (e) => onDropOnItem(e, rackId, item.uid) : undefined}
      onClick={(e) => {
        e.stopPropagation();
        handleSelect();
      }}
      role={isNode ? 'button' : undefined}
      tabIndex={isNode ? 0 : undefined}
      aria-pressed={isNode ? isSelected : undefined}
      onKeyDown={(e) => {
        if (isNode && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleSelect();
        }
      }}
    >
      {/* Extruded 3D chassis cheek & top lip revealed when pulled out along rails */}
      <div className="srack-unit-top-lip" aria-hidden="true" />
      <div className="srack-unit-side-rail" aria-hidden="true">
        <span className="srack-rail-slot" />
        <span className="srack-rail-slot" />
      </div>

      {/* Left EIA U-number tick */}
      <div className="srack-unit-u" aria-hidden="true">
        <span>{uRangeLabel}</span>
      </div>

      {/* Ultra-crisp Retina SVG hardware faceplate */}
      <div className="srack-unit-face">
        {item.type === 'pdu' && (
          <PduSvg
            label={item.label}
            watts={rackWatts}
            activeSockets={Math.min(6, Math.max(1, onlineCount))}
          />
        )}
        {item.type === 'blank' && <BlankSvg label={item.label} />}
        {isNode && node && nodeStyle && (
          <ServerUnitSvg node={node} style={nodeStyle} uidBlinking={uidBlinking} />
        )}

        {/* Optical Telemetry Anchor Point for the Sci-Fi Virtual Data-Link Tether */}
        {isSelected && (
          <span
            className="srack-tether-port"
            data-hud-anchor="selected-server"
            aria-hidden="true"
          />
        )}

        {/* Admin-only Rail Controls (hidden completely in read-only monitoring mode) */}
        {editMode && (
          <div className="srack-unit-actions" onClick={(e) => e.stopPropagation()}>
            <Button
              className="srack-act-btn"
              title="上移槽位"
              disabled={index === 0}
              onClick={() => onMoveItem(rackId, index, -1)}
            >
              ↑
            </Button>
            <Button
              className="srack-act-btn"
              title="下移槽位"
              disabled={index === totalItems - 1}
              onClick={() => onMoveItem(rackId, index, 1)}
            >
              ↓
            </Button>
            {isNode && item.type === 'node' && (
              <Toggle
                pressed={uidBlinking}
                onPressedChange={() => onToggleUid(item.nodeId)}
                className={`srack-act-btn${uidBlinking ? ' is-active' : ''}`}
                title="切换物理定位灯 UID"
              >
                UID
              </Toggle>
            )}
            <Button
              className="srack-act-btn is-danger"
              title="从机柜卸载"
              onClick={() => onRemoveItem(rackId, item.uid)}
            >
              ×
            </Button>
          </div>
        )}

        {/* Optional sleek under-chassis telemetry strip */}
        {showStrip && isNode && node && (
          <div className="srack-unit-strip">
            <span className="srack-strip-name">
              <i className={`srack-dot ${isOff ? 'is-off' : isHot ? 'is-warm' : 'is-online'}`} />
              <span className="srack-strip-flag">
                <RegionFlag code={resolveNodeGeo(node).code} size="xs" />
              </span>
              <span className="srack-strip-label">{node.name}</span>
            </span>
            <span className="srack-strip-metrics">
              {node.online ? (
                <>
                  <span>CPU {Math.round(node.cpu)}%</span>
                  <span>RAM {Math.round(node.ram)}%</span>
                  <span className="srack-strip-net">↓{formatNetSpeed(node.netDown, true)}</span>
                  {node.ping > 0 && <span>{node.ping}ms</span>}
                </>
              ) : (
                <span className="is-off-label">OFFLINE</span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
