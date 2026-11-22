import { formatBytesGiB } from '@/data/fleet';
import { formatNetSpeed } from '@/lib/formatters';
import type { NodeInfo } from '@/types/rack';

interface ServerStatusHudProps {
  node: NodeInfo | null;
  nodeIndex: number;
  totalNodes: number;
  rackName?: string;
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
}

function getLoadTone(pct: number, warnAt = 75, critAt = 90): 'normal' | 'warn' | 'crit' {
  if (pct >= critAt) return 'crit';
  if (pct >= warnAt) return 'warn';
  return 'normal';
}

export function ServerStatusHud({
  node,
  nodeIndex,
  totalNodes,
  rackName,
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
}: ServerStatusHudProps) {
  if (!node) return null;

  if (!visible) {
    return (
      <button
        type="button"
        className="hud-pill hud-server-restore"
        onClick={onShow}
        title="展开服务器悬浮状态 HUD"
      >
        <span className={`hud-srv-dot ${node.online ? 'is-on' : 'is-off'}`} aria-hidden="true" />
        <span className="hud-srv-restore-name">{node.name}</span>
        <span className="hud-srv-restore-stat">{node.online ? `CPU ${node.cpu}%` : 'OFF'}</span>
      </button>
    );
  }

  const cpuPct = node.online ? Math.min(100, Math.max(0, Math.round(node.cpu))) : 0;
  const ramPct = node.online ? Math.min(100, Math.max(0, Math.round(node.ram))) : 0;
  const diskPct = node.online ? Math.min(100, Math.max(0, Math.round(node.disk))) : 0;
  const canSwitch = totalNodes > 1;
  const specLine = [
    rackName,
    node.region && node.region !== 'GLOBAL' ? node.region : null,
    `${node.cpu_cores}C / ${formatBytesGiB(node.mem_total)}G`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <aside
      className={`hud-server-card${collapsed ? ' is-collapsed' : ''}${node.online ? '' : ' is-offline'}`}
      aria-label="服务器实时状态悬浮面板"
    >
      <div className="hud-srv-head">
        <button
          type="button"
          className="hud-srv-identity"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          title={collapsed ? '展开详细遥测' : '折叠为精简状态条'}
        >
          <span className={`hud-srv-dot ${node.online ? 'is-on' : 'is-off'}`} aria-hidden="true" />
          <div className="hud-srv-title-wrap">
            <div className="hud-srv-name-row">
              <strong className="hud-srv-name">{node.name}</strong>
              {node.tag && <span className="hud-srv-tag">{node.tag}</span>}
            </div>
            <span className="hud-srv-meta">{specLine}</span>
          </div>
        </button>

        <div className="hud-srv-head-actions">
          {canSwitch && (
            <div className="hud-srv-nav" role="group" aria-label="切换节点">
              <button type="button" className="hud-srv-icon" onClick={onPrevNode} aria-label="上一台服务器" title="上一台">
                ‹
              </button>
              <span className="hud-srv-idx">
                {nodeIndex + 1}/{totalNodes}
              </span>
              <button type="button" className="hud-srv-icon" onClick={onNextNode} aria-label="下一台服务器" title="下一台">
                ›
              </button>
            </div>
          )}

          <button
            type="button"
            className="hud-srv-icon"
            onClick={onToggleCollapse}
            aria-label={collapsed ? '展开状态 HUD' : '收起状态 HUD'}
            title={collapsed ? '展开' : '折叠'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              {collapsed ? (
                <path d="M2.5 7.5L6 4L9.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>

          <button
            type="button"
            className="hud-srv-icon"
            onClick={onHide}
            aria-label="隐藏状态 HUD"
            title="隐藏"
          >
            ×
          </button>
        </div>
      </div>

      {collapsed ? (
        <div className="hud-srv-compact-strip" onClick={onToggleCollapse} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleCollapse(); }}>
          <span>CPU <b>{cpuPct}%</b></span>
          <span>MEM <b>{ramPct}%</b></span>
          <span>↓ <b>{node.online ? formatNetSpeed(node.netDown) : '0 B/s'}</b></span>
          <span>PING <b>{node.online ? `${node.ping}ms` : '—'}</b></span>
        </div>
      ) : (
        <>
          <div className="hud-srv-bars">
            <div className="hud-srv-bar-row">
              <span className="hud-srv-bar-label">CPU</span>
              <div className="hud-srv-bar-track">
                <span
                  className={`hud-srv-bar-fill is-cpu tone-${getLoadTone(cpuPct)}`}
                  style={{ width: `${cpuPct}%` }}
                />
              </div>
              <span className="hud-srv-bar-val">{cpuPct}%</span>
            </div>

            <div className="hud-srv-bar-row">
              <span className="hud-srv-bar-label">MEM</span>
              <div className="hud-srv-bar-track">
                <span
                  className={`hud-srv-bar-fill is-ram tone-${getLoadTone(ramPct, 80, 92)}`}
                  style={{ width: `${ramPct}%` }}
                />
              </div>
              <span className="hud-srv-bar-val">{ramPct}%</span>
            </div>

            <div className="hud-srv-bar-row">
              <span className="hud-srv-bar-label">DISK</span>
              <div className="hud-srv-bar-track">
                <span
                  className={`hud-srv-bar-fill is-disk tone-${getLoadTone(diskPct, 82, 94)}`}
                  style={{ width: `${diskPct}%` }}
                />
              </div>
              <span className="hud-srv-bar-val">{diskPct}%</span>
            </div>
          </div>

          <div className="hud-srv-stats">
            <div className="hud-srv-stat">
              <span>下行</span>
              <b>{node.online ? formatNetSpeed(node.netDown) : '0 B/s'}</b>
            </div>
            <div className="hud-srv-stat">
              <span>上行</span>
              <b>{node.online ? formatNetSpeed(node.netUp) : '0 B/s'}</b>
            </div>
            <div className="hud-srv-stat">
              <span>延迟</span>
              <b>{node.online ? `${node.ping}ms` : '—'}</b>
            </div>
            <div className="hud-srv-stat">
              <span>运行</span>
              <b>{node.online ? node.uptime : 'OFF'}</b>
            </div>
          </div>

          <div className="hud-srv-footer">
            <button
              type="button"
              className={`hud-srv-action${uidBlinking ? ' is-active' : ''}`}
              onClick={onToggleUid}
              title="点亮该服务器前面板蓝色 UID 定位灯"
            >
              {uidBlinking ? 'UID 闪烁中' : 'UID 定位'}
            </button>

            <button
              type="button"
              className="hud-srv-action is-primary"
              onClick={onOpenTelemetry}
            >
              遥测详情
            </button>

            {canEdit && (
              <button
                type="button"
                className="hud-srv-action"
                onClick={onOpenStyle}
              >
                涂装
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
