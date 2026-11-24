import { memo, useEffect, useId, useMemo, useState } from 'react';
import type { AppConfig, NodeInfo, RackViewAngle } from '@/types/rack';

interface StudioStatusSignageProps {
  nodes: NodeInfo[];
  viewAngle?: RackViewAngle;
  scale?: AppConfig['scale'];
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

const CHAR_X = 114;
const CHAR_START_Y = 74;
const CHAR_STEP_Y = 108;
const PERIOD_CY = 496;
const PERIOD_R = 19;

// 12 horological dial ticks around the hollow rotary status ring (0..330 deg)
const DIAL_TICKS = Array.from({ length: 12 }, (_, idx) => {
  const deg = idx * 30;
  const rad = (deg * Math.PI) / 180;
  const isCardinal = idx % 3 === 0;
  const rInner = isCardinal ? 25.4 : 26.2;
  const rOuter = isCardinal ? 28.4 : 27.6;
  return {
    key: deg,
    isCardinal,
    x1: Math.round(Math.cos(rad) * rInner * 100) / 100,
    y1: Math.round(Math.sin(rad) * rInner * 100) / 100,
    x2: Math.round(Math.cos(rad) * rOuter * 100) / 100,
    y2: Math.round(Math.sin(rad) * rOuter * 100) / 100,
  };
});

export const StudioStatusSignage = memo(function StudioStatusSignage({
  nodes,
  viewAngle = 'side',
  scale = 'standard',
  hudVisible = false,
  drawerOpen = false,
}: StudioStatusSignageProps) {
  const uid = useId().replace(/:/g, '');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
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

  const isFront = viewAngle === 'front';
  const extrude1X = isFront ? 0 : 1.7;
  const extrude1Y = isFront ? 1.5 : 1.3;
  const extrude2X = isFront ? 0 : 3.4;
  const extrude2Y = isFront ? 3.0 : 2.6;
  const shadowX = isFront ? 0 : 11;
  const shadowY = isFront ? 12 : 14;

  const faceGradId = `ssig-face-${uid}`;
  const rimGradId = `ssig-rim-${uid}`;
  const bevelGradId = `ssig-bevel-${uid}`;
  const ringSweepId = `ssig-sweep-${uid}`;
  const shadowFilterId = `ssig-shadow-${uid}`;

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
      <div className="ssig-plane">
        <svg
          className="ssig-svg"
          viewBox="0 0 184 548"
          fill="none"
          overflow="visible"
          role="img"
          aria-hidden="true"
        >
          <defs>
            {/* Satin anodized metallic vertical gradient for glyph front face */}
            <linearGradient id={faceGradId} x1="0%" y1="0%" x2="18%" y2="100%">
              <stop offset="0%" className="ssig-stop-face-top" />
              <stop offset="48%" className="ssig-stop-face-mid" />
              <stop offset="100%" className="ssig-stop-face-bot" />
            </linearGradient>

            {/* Razor-thin specular top-left chamfer rim catching studio softbox light */}
            <linearGradient id={rimGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="ssig-stop-rim-hi" />
              <stop offset="46%" className="ssig-stop-rim-mid" />
              <stop offset="100%" className="ssig-stop-rim-lo" />
            </linearGradient>

            {/* Milled CNC extrusion side wall gradient (clean physical thickness, no blur) */}
            <linearGradient id={bevelGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="ssig-stop-bevel-top" />
              <stop offset="100%" className="ssig-stop-bevel-bot" />
            </linearGradient>

            {/* Tapered rotary status arc gradient aligned to leading head (19, 0) & tail (-16.45, 9.5) */}
            <linearGradient
              id={ringSweepId}
              gradientUnits="userSpaceOnUse"
              x1="-17"
              y1="10"
              x2="19"
              y2="0"
            >
              <stop offset="0%" className="ssig-stop-tone-lo" stopOpacity="0.06" />
              <stop offset="46%" className="ssig-stop-tone-mid" stopOpacity="0.78" />
              <stop offset="100%" className="ssig-stop-tone-hi" stopOpacity="1" />
            </linearGradient>

            {/* Soft architectural studio backdrop shadow — crisp dispersion, zero glow */}
            <filter id={shadowFilterId} x="-40%" y="-20%" width="190%" height="150%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="6.5" result="blur" />
              <feOffset dx="0" dy="0" result="shifted" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.48" />
              </feComponentTransfer>
            </filter>
          </defs>

          {/* Left Swiss Calibration Rail: Date · Precision Hairline Spine · Time · Online Ratio */}
          <g className="ssig-rail-group">
            {/* Top micro-crosshair registration mark */}
            <path d="M22 24h8M26 20v8" className="ssig-rail-mark" strokeWidth="1" strokeLinecap="round" />

            <text x="26" y="48" textAnchor="middle" className="ssig-rail-text ssig-rail-date">
              {clock.date}
            </text>

            {/* Vertical precision scale hairline with subtle glyph-aligned ticks */}
            <line x1="26" y1="62" x2="26" y2="394" className="ssig-rail-line" strokeWidth="1" />
            {chars.map((ch, idx) => {
              const tickY = CHAR_START_Y + idx * CHAR_STEP_Y;
              return (
                <line
                  key={`tick-${idx}-${ch}`}
                  x1="21"
                  y1={tickY}
                  x2="31"
                  y2={tickY}
                  className="ssig-rail-tick"
                  strokeWidth="1"
                />
              );
            })}

            <text x="26" y="420" textAnchor="middle" className="ssig-rail-text ssig-rail-time">
              {clock.time}
            </text>

            <line x1="18" y1="432" x2="34" y2="432" className="ssig-rail-tick" strokeWidth="1" />

            <text x="26" y="450" textAnchor="middle" className="ssig-rail-text ssig-rail-ratio">
              {status.onlineCount}/{status.total}
            </text>

            {/* Subtle alignment leader dot pointing to the hollow status ring */}
            <line x1="26" y1="464" x2="26" y2="496" className="ssig-rail-line" strokeWidth="1" strokeDasharray="2 3" />
            <line x1="26" y1="496" x2="62" y2="496" className="ssig-rail-line" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx="26" cy="496" r="2" className="ssig-rail-dot" />
          </g>

          {/* Layer 1: Clean architectural wall cast shadow */}
          <g
            className="ssig-svg-shadow"
            transform={`translate(${shadowX}, ${shadowY})`}
            filter={`url(#${shadowFilterId})`}
          >
            {chars.map((ch, idx) => (
              <text
                key={`sh-${idx}-${ch}`}
                x={CHAR_X}
                y={CHAR_START_Y + idx * CHAR_STEP_Y}
                textAnchor="middle"
                dominantBaseline="central"
                className="ssig-svg-glyph"
              >
                {ch}
              </text>
            ))}
            <circle cx={CHAR_X} cy={PERIOD_CY} r={PERIOD_R} strokeWidth="4.6" className="ssig-svg-shadow-ring" />
          </g>

          {/* Layer 2: Precision CNC milled extrusion wall (2 tight analytical vector steps, zero stair-step blur) */}
          <g className="ssig-svg-bevel-deep" transform={`translate(${extrude2X}, ${extrude2Y})`}>
            {chars.map((ch, idx) => (
              <text
                key={`bv2-${idx}-${ch}`}
                x={CHAR_X}
                y={CHAR_START_Y + idx * CHAR_STEP_Y}
                textAnchor="middle"
                dominantBaseline="central"
                className="ssig-svg-glyph"
                fill={`url(#${bevelGradId})`}
              >
                {ch}
              </text>
            ))}
            <circle
              cx={CHAR_X}
              cy={PERIOD_CY}
              r={PERIOD_R}
              strokeWidth="4.6"
              stroke={`url(#${bevelGradId})`}
              fill="none"
            />
          </g>

          <g className="ssig-svg-bevel-mid" transform={`translate(${extrude1X}, ${extrude1Y})`}>
            {chars.map((ch, idx) => (
              <text
                key={`bv1-${idx}-${ch}`}
                x={CHAR_X}
                y={CHAR_START_Y + idx * CHAR_STEP_Y}
                textAnchor="middle"
                dominantBaseline="central"
                className="ssig-svg-glyph"
                fill={`url(#${bevelGradId})`}
              >
                {ch}
              </text>
            ))}
            <circle
              cx={CHAR_X}
              cy={PERIOD_CY}
              r={PERIOD_R}
              strokeWidth="4.6"
              stroke={`url(#${bevelGradId})`}
              fill="none"
            />
          </g>

          {/* Layer 3: Sculpted satin front face with razor-thin anodized bevel stroke */}
          <g className="ssig-svg-front">
            {chars.map((ch, idx) => (
              <text
                key={`fg-${idx}-${ch}`}
                x={CHAR_X}
                y={CHAR_START_Y + idx * CHAR_STEP_Y}
                textAnchor="middle"
                dominantBaseline="central"
                className="ssig-svg-glyph"
                fill={`url(#${faceGradId})`}
                stroke={`url(#${rimGradId})`}
                strokeWidth="0.85"
                paintOrder="stroke fill"
              >
                {ch}
              </text>
            ))}
          </g>

          {/* Precision Horological Hollow Rotary Status Ring (。): machined channel + smooth orbital sweep */}
          <g className="ssig-svg-period" transform={`translate(${CHAR_X}, ${PERIOD_CY})`}>
            {/* 12 precision radial calibration ticks */}
            <g className="ssig-svg-dial-ticks">
              {DIAL_TICKS.map((t) => (
                <line
                  key={t.key}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  strokeWidth={t.isCardinal ? '1.15' : '0.8'}
                  strokeLinecap="round"
                  className={t.isCardinal ? 'ssig-svg-tick-major' : 'ssig-svg-tick-minor'}
                />
              ))}
            </g>

            {/* Slow counter-rotating outer vernier hairline */}
            <g className="ssig-svg-vernier">
              <circle
                cx="0"
                cy="0"
                r={PERIOD_R + 4.9}
                stroke={`url(#${rimGradId})`}
                strokeWidth="0.85"
                strokeDasharray="11 22 3 22"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* Machined recessed circular bezel channel + razor inner/outer metallic chamfers */}
            <circle cx="0" cy="0" r={PERIOD_R} strokeWidth="4.6" fill="none" className="ssig-svg-ring-track" />
            <circle
              cx="0"
              cy="0"
              r={PERIOD_R + 2.4}
              stroke={`url(#${rimGradId})`}
              strokeWidth="0.7"
              fill="none"
              className="ssig-svg-ring-rim-outer"
            />
            <circle
              cx="0"
              cy="0"
              r={PERIOD_R - 2.4}
              stroke={`url(#${rimGradId})`}
              strokeWidth="0.65"
              fill="none"
              className="ssig-svg-ring-rim-inner"
            />

            {/* Primary smooth clockwise rotary sweep arc + leading jewel bead */}
            <g className="ssig-svg-rotor">
              <path
                d="M -16.45 9.5 A 19 19 0 1 1 19 0"
                stroke={`url(#${ringSweepId})`}
                strokeWidth="4.3"
                strokeLinecap="round"
                fill="none"
                className="ssig-svg-rotor-arc"
              />
              {/* Subtle counterweight micro-arc for horological balance */}
              <path
                d="M 15.56 10.9 A 19 19 0 0 1 5.87 18.07"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
                className="ssig-svg-rotor-counter"
              />
              {/* Crisp machined leading tip bead */}
              <circle cx="19" cy="0" r="2.2" className="ssig-svg-rotor-head" />
              <circle cx="19" cy="0" r="0.85" className="ssig-svg-rotor-spec" />
            </g>
          </g>
        </svg>
      </div>
    </aside>
  );
});
