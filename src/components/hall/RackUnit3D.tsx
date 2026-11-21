import type { DragEvent } from 'react';
import { BlankSvg, PduSvg, ServerUnitSvg } from '@/components/hardware/ServerChassisSvg';
import type { EffectiveNodeStyle, NodeInfo, RackItem } from '@/types/rack';

interface RackUnit3DProps {
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
  isDragOver: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleUid: () => void;
  onRemove: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
}

export function RackUnit3D({
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
  isDragOver,
  onSelect,
  onMoveUp,
  onMoveDown,
  onToggleUid,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: RackUnit3DProps) {
  const isNode = item.type === 'node' && node && nodeStyle;
  const isOff = isNode && !node.online;
  const isHot = isNode && node.online && node.cpu >= 80;

  return (
    <div
      className={`rack-unit3d${isSelected ? ' is-selected' : ''}${isDragOver ? ' is-drag-over' : ''}`}
      data-uid={item.uid}
      data-rack-id={rackId}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="rack-unit3d-rail" aria-hidden="true">
        <span>{uRangeLabel}</span>
      </div>

      <div className="rack-unit3d-face">
        {item.type === 'pdu' && (
          <PduSvg label={item.label} watts={rackWatts} activeSockets={Math.min(6, Math.max(1, onlineCount))} />
        )}
        {item.type === 'blank' && <BlankSvg label={item.label} />}
        {isNode && <ServerUnitSvg node={node} style={nodeStyle} uidBlinking={uidBlinking} />}

        <div className="rack-unit3d-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="u3d-btn"
            title="上移槽位"
            disabled={index === 0}
            onClick={onMoveUp}
          >
            ↑
          </button>
          <button
            type="button"
            className="u3d-btn"
            title="下移槽位"
            disabled={index === totalItems - 1}
            onClick={onMoveDown}
          >
            ↓
          </button>
          {isNode && (
            <button
              type="button"
              className={`u3d-btn${uidBlinking ? ' is-active' : ''}`}
              title="切换物理定位灯 UID"
              onClick={onToggleUid}
            >
              UID
            </button>
          )}
          <button
            type="button"
            className="u3d-btn is-danger"
            title="从机柜卸载"
            onClick={onRemove}
          >
            ×
          </button>
        </div>

        {showStrip && isNode && (
          <div className="rack-unit3d-strip">
            <span className="u3d-strip-name">
              <i className={`u3d-dot ${isOff ? 'is-off' : isHot ? 'is-warm' : 'is-online'}`} />
              {node.region} {node.name}
            </span>
            <span className="u3d-strip-metrics">
              {node.online ? (
                <>
                  <span>CPU {Math.round(node.cpu)}%</span>
                  <span>RAM {Math.round(node.ram)}%</span>
                  <span>{node.ping > 0 ? `${node.ping}ms` : '--'}</span>
                </>
              ) : (
                <span className="is-muted">OFFLINE</span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
