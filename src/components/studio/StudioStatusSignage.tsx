import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { AppConfig, NodeInfo, RackViewAngle } from '@/types/rack';

interface StudioStatusSignageProps {
  nodes: NodeInfo[];
  viewAngle?: RackViewAngle;
  scale?: AppConfig['scale'];
  hudVisible?: boolean;
  drawerOpen?: boolean;
}

type SignageTone = 'ok' | 'warn' | 'crit' | 'idle';

interface SignageStatus {
  text: string;
  caption: string;
  tone: SignageTone;
  onlineCount: number;
  total: number;
  ratioPct: number;
}

function formatClock(now: Date): { time: string; date: string } {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const mon = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return {
    time: `${hh}:${mm}`,
    date: `${mon}.${day}`,
  };
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
      return { text: '等待接入', caption: 'Standby', tone: 'idle', onlineCount: 0, total: 0, ratioPct: 0 };
    }
    const onlineNodes = nodes.filter((n) => n.online);
    const onlineCount = onlineNodes.length;
    const ratioPct = Math.round((onlineCount / total) * 100);
    if (onlineCount === 0) {
      return { text: '节点离线', caption: 'Offline', tone: 'crit', onlineCount: 0, total, ratioPct: 0 };
    }
    if (onlineCount < total) {
      return { text: '部分离线', caption: 'Degraded', tone: 'crit', onlineCount, total, ratioPct };
    }
    const hasHighLoad = onlineNodes.some((n) => n.cpu >= 85 || n.ram >= 90);
    if (hasHighLoad) {
      return { text: '高负载中', caption: 'Elevated', tone: 'warn', onlineCount, total, ratioPct: 100 };
    }
    return { text: '运行正常', caption: 'Operational', tone: 'ok', onlineCount, total, ratioPct: 100 };
  }, [nodes]);

  const clock = useMemo(() => formatClock(now), [now]);
  const gaugeStyle = {
    '--ssig-fill': `${Math.max(status.total > 0 ? 12 : 0, status.ratioPct)}%`,
  } as CSSProperties;

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
      <div className="ssig-plaque" style={gaugeStyle}>
        <div className="ssig-col-rail" aria-hidden="true">
          <span className="ssig-rail-date">{clock.date}</span>
          <span className="ssig-hairline-track">
            <span className="ssig-hairline-fill" />
          </span>
          <span className="ssig-rail-time">{clock.time}</span>
        </div>

        <div className="ssig-col-title">
          <p className="ssig-vertical-text">{status.text}</p>
          <span className="ssig-colophon-rule" aria-hidden="true" />
          <div className="ssig-colophon">
            <span className="ssig-caption">{status.caption}</span>
            <span className="ssig-ratio">
              {String(status.onlineCount).padStart(2, '0')}/{String(status.total).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
});
