import { memo, useEffect, useMemo, useState } from 'react';
import type { AppConfig, NodeInfo, RackViewAngle } from '@/types/rack';

interface StudioStatusSignageProps {
  nodes: NodeInfo[];
  viewAngle?: RackViewAngle;
  scale?: AppConfig['scale'];
  hudVisible?: boolean;
  drawerOpen?: boolean;
}

type SignageTone = 'ok' | 'warn' | 'crit' | 'idle';

interface SegmentItem {
  key: string;
  tone: SignageTone;
  weight: number;
}

interface SignageStatus {
  text: string;
  summary: string;
  code: string;
  tone: SignageTone;
  onlineCount: number;
  total: number;
  avgCpu: number | null;
  avgPing: number | null;
  segments: SegmentItem[];
}

function formatClock(now: Date): string {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export const StudioStatusSignage = memo(function StudioStatusSignage({
  nodes,
  viewAngle = 'side',
  scale = 'standard',
  hudVisible = false,
  drawerOpen = false,
}: StudioStatusSignageProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const status = useMemo((): SignageStatus => {
    const total = nodes.length;
    if (total === 0) {
      return {
        text: '等待接入',
        summary: '尚未接入监控探针',
        code: 'STANDBY',
        tone: 'idle',
        onlineCount: 0,
        total: 0,
        avgCpu: null,
        avgPing: null,
        segments: [],
      };
    }

    const onlineNodes = nodes.filter((item) => item.online);
    const onlineCount = onlineNodes.length;
    const offlineCount = total - onlineCount;
    const elevatedNodes = onlineNodes.filter((item) => item.cpu >= 85 || item.ram >= 90);
    const elevatedCount = elevatedNodes.length;
    const healthyCount = onlineCount - elevatedCount;

    const avgCpu =
      onlineCount > 0
        ? Math.round(onlineNodes.reduce((sum, item) => sum + item.cpu, 0) / onlineCount)
        : null;
    const pingValues = onlineNodes.filter((item) => item.ping > 0).map((item) => item.ping);
    const avgPing =
      pingValues.length > 0
        ? Math.round(pingValues.reduce((sum, val) => sum + val, 0) / pingValues.length)
        : null;

    const segments: SegmentItem[] = [];
    if (total <= 24) {
      for (let idx = 0; idx < healthyCount; idx++) {
        segments.push({ key: `ok-${idx}`, tone: 'ok', weight: 1 });
      }
      for (let idx = 0; idx < elevatedCount; idx++) {
        segments.push({ key: `warn-${idx}`, tone: 'warn', weight: 1 });
      }
      for (let idx = 0; idx < offlineCount; idx++) {
        segments.push({ key: `crit-${idx}`, tone: 'crit', weight: 1 });
      }
    } else {
      if (healthyCount > 0) segments.push({ key: 'ok-all', tone: 'ok', weight: healthyCount });
      if (elevatedCount > 0) segments.push({ key: 'warn-all', tone: 'warn', weight: elevatedCount });
      if (offlineCount > 0) segments.push({ key: 'crit-all', tone: 'crit', weight: offlineCount });
    }

    if (onlineCount === 0) {
      return {
        text: '节点离线',
        summary: `全部 ${total} 台探针当前离线`,
        code: 'OFFLINE',
        tone: 'crit',
        onlineCount: 0,
        total,
        avgCpu,
        avgPing,
        segments,
      };
    }
    if (onlineCount < total) {
      return {
        text: '部分离线',
        summary: `${offlineCount} 台节点离线，其余平稳`,
        code: 'DEGRADED',
        tone: 'crit',
        onlineCount,
        total,
        avgCpu,
        avgPing,
        segments,
      };
    }
    if (elevatedCount > 0) {
      return {
        text: '高负载运行',
        summary: `${elevatedCount} 台节点负载偏高`,
        code: 'ELEVATED',
        tone: 'warn',
        onlineCount,
        total,
        avgCpu,
        avgPing,
        segments,
      };
    }
    return {
      text: '运行正常',
      summary: `全部 ${total} 台节点在线，负载平稳`,
      code: 'NOMINAL',
      tone: 'ok',
      onlineCount,
      total,
      avgCpu,
      avgPing,
      segments,
    };
  }, [nodes]);

  const clock = useMemo(() => formatClock(now), [now]);

  const stateClasses = [
    'studio-signage',
    'is-rack',
    `tone-${status.tone}`,
    `angle-${viewAngle}`,
    `scale-${scale}`,
    hudVisible ? 'has-hud' : '',
    drawerOpen ? 'has-drawer' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside
      className={stateClasses}
      aria-label={`全局状态：${status.text}（${status.onlineCount}/${status.total} 在线）`}
    >
      <div className="ssig-sheet">
        <div className="ssig-eyebrow">
          <span className="ssig-status-tag">
            <span className="ssig-dot" aria-hidden="true" />
            <span>{status.code}</span>
          </span>
          <span className="ssig-clock">{clock}</span>
        </div>

        <div className="ssig-hero">
          <p className="ssig-title">{status.text}</p>
          <p className="ssig-summary">{status.summary}</p>
        </div>

        <div className="ssig-bar" aria-hidden="true">
          {status.segments.length === 0 ? (
            <span className="ssig-seg is-idle" style={{ flex: 1 }} />
          ) : (
            status.segments.map((seg) => (
              <span
                key={seg.key}
                className={`ssig-seg is-${seg.tone}`}
                style={{ flex: seg.weight }}
              />
            ))
          )}
        </div>

        <dl className="ssig-specs">
          <div className="ssig-spec-row">
            <dt>在线节点</dt>
            <dd className={status.tone === 'crit' ? 'is-accent' : undefined}>
              {String(status.onlineCount).padStart(2, '0')}/{String(status.total).padStart(2, '0')}
            </dd>
          </div>
          <div className="ssig-spec-row">
            <dt>平均负载</dt>
            <dd>{status.avgCpu !== null ? `CPU ${status.avgCpu}%` : '—'}</dd>
          </div>
          <div className="ssig-spec-row">
            <dt>平均延迟</dt>
            <dd>{status.avgPing !== null ? `${status.avgPing} ms` : '—'}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
});
