import { memo, useEffect, useMemo, useState } from 'react';
import type { AppConfig, NodeInfo, RackViewAngle } from '@/types/rack';

interface StudioStatusSignageProps {
  nodes: NodeInfo[];
  viewAngle?: RackViewAngle;
  scale?: AppConfig['scale'];
  variant: 'rack' | 'map';
  hudVisible?: boolean;
  drawerOpen?: boolean;
}

type SignageTone = 'ok' | 'warn' | 'crit' | 'idle';

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
  variant,
  hudVisible = false,
  drawerOpen = false,
}: StudioStatusSignageProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Update every 15s so the minimal gallery clock stays accurate with negligible CPU cost
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const status = useMemo((): { text: string; tone: SignageTone; onlineCount: number; total: number } => {
    const total = nodes.length;
    if (total === 0) {
      return { text: '等待接入', tone: 'idle', onlineCount: 0, total: 0 };
    }
    const onlineNodes = nodes.filter((n) => n.online);
    const onlineCount = onlineNodes.length;
    if (onlineCount === 0) {
      return { text: '节点离线', tone: 'crit', onlineCount: 0, total };
    }
    if (onlineCount < total) {
      return { text: '部分离线', tone: 'crit', onlineCount, total };
    }
    const hasHighLoad = onlineNodes.some((n) => n.cpu >= 85 || n.ram >= 90);
    if (hasHighLoad) {
      return { text: '高负载中', tone: 'warn', onlineCount, total };
    }
    return { text: '运行正常', tone: 'ok', onlineCount, total };
  }, [nodes]);

  const clock = useMemo(() => formatClock(now), [now]);
  const chars = useMemo(() => Array.from(status.text), [status.text]);

  const stateClasses = [
    'studio-signage',
    `is-${variant}`,
    `tone-${status.tone}`,
    `angle-${viewAngle}`,
    `scale-${scale}`,
    hudVisible ? 'has-hud' : '',
    drawerOpen ? 'has-drawer' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const renderVerticalChars = (layerKey: string) => (
    <div className="ssig-chars">
      {chars.map((ch, idx) => (
        <span key={`${layerKey}-${idx}-${ch}`} className="ssig-char">
          {ch}
        </span>
      ))}
    </div>
  );

  return (
    <aside
      className={stateClasses}
      aria-label={`全局状态：${status.text}（${status.onlineCount}/${status.total} 在线）`}
    >
      <div className="ssig-plane">
        {/* Layer 1: Deep studio wall cast shadow floating behind the monolith */}
        <div className="ssig-shadow-layer" aria-hidden="true">
          <div className="ssig-vertical-col">
            {renderVerticalChars('shadow')}
            <span className="ssig-period-shadow" />
          </div>
        </div>

        {/* Layer 2: Physical 3D milled extrusion core sitting in Z-depth */}
        <div className="ssig-depth-layer" aria-hidden="true">
          <div className="ssig-vertical-col">
            {renderVerticalChars('depth')}
            <span className="ssig-period-depth" />
          </div>
        </div>

        {/* Layer 3: Sculpted front face + gallery calendar-clock precision rail */}
        <div className="ssig-front-layer">
          <div className="ssig-clock-rail" aria-hidden="true">
            <span className="ssig-clock-date">{clock.date}</span>
            <span className="ssig-clock-rule" />
            <span className="ssig-clock-time">{clock.time}</span>
            <span className="ssig-clock-ratio">
              {status.onlineCount}/{status.total}
            </span>
          </div>

          <div className="ssig-vertical-col">
            {renderVerticalChars('front')}
            <span className="ssig-period" aria-hidden="true">
              <span className="ssig-period-pulse" />
              <span className="ssig-period-ring" />
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
});
