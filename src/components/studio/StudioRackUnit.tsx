import type { DragEvent } from 'react';
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

export function StudioRackUnit({
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
  onSelect,
  onMoveUp,
  onMoveDown,
  onToggleUid,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: StudioRackUnitProps) {
  const isNode = item.type === 'node' && Boolean(node) && Boolean(nodeStyle);
  const isOff = isNode && !node!.online;
  const isHot = isNode && node!.online && node!.cpu >= 80;

  return (
    <div
      className={`srack-unit${isSelected ? ' is-selected' : ''}${isDragOver ? ' is-drag-over' : ''}${isNode ? ' is-node' : ''}`}
      data-uid={item.uid}
      data-rack-id={rackId}
      data-selected-unit={isSelected ? 'true' : undefined}
      draggable={editMode}
      onDragStart={editMode ? onDragStart : undefined}
      onDragOver={editMode ? onDragOver : undefined}
      onDragLeave={editMode ? onDragLeave : undefined}
      onDrop={editMode ? onDrop : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      role={isNode ? 'button' : undefined}
      tabIndex={isNode ? 0 : undefined}
      aria-pressed={isNode ? isSelected : undefined}
      onKeyDown={(e) => {
        if (isNode && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
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
            <button
              type="button"
              className="srack-act-btn"
              title="上移槽位"
              disabled={index === 0}
              onClick={onMoveUp}
            >
              ↑
            </button>
            <button
              type="button"
              className="srack-act-btn"
              title="下移槽位"
              disabled={index === totalItems - 1}
              onClick={onMoveDown}
            >
              ↓
            </button>
            {isNode && (
              <button
                type="button"
                className={`srack-act-btn${uidBlinking ? ' is-active' : ''}`}
                title="切换物理定位灯 UID"
                onClick={onToggleUid}
              >
                UID
              </button>
            )}
            <button
              type="button"
              className="srack-act-btn is-danger"
              title="从机柜卸载"
              onClick={onRemove}
            >
              ×
            </button>
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
                  <span>↓{formatNetSpeed(node.netDown, true)}</span>
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
}
