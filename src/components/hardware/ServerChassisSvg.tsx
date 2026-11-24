import { useId } from 'react';
import { ACCENTS, FINISHES, OLEDS, type FinishPalette, type AccentSpec } from '@/data/fleet';
import { formatNetSpeed } from '@/lib/formatters';
import type { EffectiveNodeStyle, NodeInfo } from '@/types/rack';

function CommonDefs({
  gId,
  fin,
  acc,
}: {
  gId: string;
  fin: FinishPalette;
  acc: AccentSpec;
}) {
  return (
    <defs>
      <linearGradient id={`${gId}-body`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={fin.top} />
        <stop offset="16%" stopColor={fin.mid} />
        <stop offset="86%" stopColor={fin.bot} />
        <stop offset="100%" stopColor={fin.deep} />
      </linearGradient>
      <linearGradient id={`${gId}-ear`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={fin.earTop} />
        <stop offset="50%" stopColor={fin.earMid} />
        <stop offset="100%" stopColor={fin.earBot} />
      </linearGradient>
      <linearGradient id={`${gId}-acc`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={acc.hex} />
        <stop offset="100%" stopColor={acc.dark} />
      </linearGradient>
      <linearGradient id={`${gId}-fin`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={fin.finTop} />
        <stop offset="55%" stopColor={fin.finMid} />
        <stop offset="100%" stopColor={fin.finBot} />
      </linearGradient>
      <linearGradient id={`${gId}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
        <stop offset="38%" stopColor="rgba(255,255,255,0.02)" />
        <stop offset="42%" stopColor="rgba(255,255,255,0)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
      </linearGradient>
    </defs>
  );
}

function Screw({ cx, cy, fin }: { cx: number; cy: number; fin: FinishPalette }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.2} fill="rgba(0,0,0,0.45)" />
      <circle cx={cx} cy={cy} r={2.6} fill={fin.screwFace} stroke={fin.stroke} strokeWidth={0.55} />
      <line x1={cx - 1.35} y1={cy} x2={cx + 1.35} y2={cy} stroke={fin.screwSlot} strokeWidth={0.75} strokeLinecap="round" />
      <line x1={cx} y1={cy - 1.35} x2={cx} y2={cy + 1.35} stroke={fin.screwSlot} strokeWidth={0.75} strokeLinecap="round" />
    </g>
  );
}

function RackEars({ h, fin, gId }: { h: number; fin: FinishPalette; gId: string }) {
  const topScrew = Math.min(13.5, h * 0.24);
  const botScrew = h - topScrew;
  const midY = h / 2;
  return (
    <g>
      <rect x={0.5} y={1} width={21.5} height={h - 2} rx={1.8} fill={`url(#${gId}-ear)`} stroke={fin.stroke} strokeWidth={0.8} />
      <line x1={2} y1={2} x2={20.5} y2={2} stroke={fin.bevel} strokeWidth={0.65} />
      <rect x={518} y={1} width={21.5} height={h - 2} rx={1.8} fill={`url(#${gId}-ear)`} stroke={fin.stroke} strokeWidth={0.8} />
      <line x1={519.5} y1={2} x2={538} y2={2} stroke={fin.bevel} strokeWidth={0.65} />
      <Screw cx={11.25} cy={topScrew} fin={fin} />
      <Screw cx={11.25} cy={botScrew} fin={fin} />
      <Screw cx={528.75} cy={topScrew} fin={fin} />
      <Screw cx={528.75} cy={botScrew} fin={fin} />
      {h >= 110 && (
        <>
          <rect x={7.75} y={midY - 14} width={7} height={28} rx={2} fill={fin.deep} stroke={fin.stroke} strokeWidth={0.6} />
          <line x1={9.4} y1={midY - 10} x2={9.4} y2={midY + 10} stroke={fin.bevel} strokeWidth={0.6} />
          <rect x={525.25} y={midY - 14} width={7} height={28} rx={2} fill={fin.deep} stroke={fin.stroke} strokeWidth={0.6} />
          <line x1={526.9} y1={midY - 10} x2={526.9} y2={midY + 10} stroke={fin.bevel} strokeWidth={0.6} />
        </>
      )}
    </g>
  );
}

/* ============================================================================
   B1: 1U High-Density Fiber & Patch Edge Server (540 x 58 — True 1U Ratio)
   ============================================================================ */
function B1Svg({
  node,
  style,
  gId,
  uidBlinking,
}: {
  node: NodeInfo;
  style: EffectiveNodeStyle;
  gId: string;
  uidBlinking: boolean;
}) {
  const fin = FINISHES[style.finish] ?? FINISHES.gunmetal;
  const acc = ACCENTS.find((a) => a.id === style.accent) ?? ACCENTS[0];
  const oled = OLEDS.find((o) => o.id === style.oled) ?? OLEDS[0];
  const isOff = !node.online;
  const isHot = node.online && node.cpu >= 80;
  const statColor = isOff ? '#64748B' : isHot ? '#FB923C' : oled.main;
  const healthColor = isOff ? '#475569' : isHot ? '#F97316' : '#22C55E';
  const barW = isOff ? 0 : Math.max(4, Math.round((node.cpu / 100) * 102));

  return (
    <svg viewBox="0 0 540 58" xmlns="http://www.w3.org/2000/svg" className="chassis-svg">
      <CommonDefs gId={gId} fin={fin} acc={acc} />
      <RackEars h={58} fin={fin} gId={gId} />
      <rect x={23} y={1} width={494} height={56} rx={2} fill={`url(#${gId}-body)`} stroke={fin.stroke} strokeWidth={0.8} />
      <line x1={25} y1={2.1} x2={515} y2={2.1} stroke={fin.bevel} strokeWidth={0.65} />

      {/* Left Recessed OLED Telemetry Display */}
      <g transform="translate(34, 7)">
        <rect x={0} y={0} width={120} height={44} rx={3} fill="#0A0D12" stroke={fin.bayBorder} strokeWidth={0.65} />
        <rect x={2} y={2} width={116} height={40} rx={2.2} fill={oled.bg} />
        <text x={8} y={13} fill={oled.title} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={7.2} fontWeight={700}>
          {node.name.slice(0, 14)}
        </text>
        <text x={8} y={27} fill={statColor} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={10.2} fontWeight={800}>
          {isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`}
        </text>
        <text x={112} y={27} textAnchor="end" fill="#8B98AA" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.8}>
          {isOff ? 'STBY' : `↓${formatNetSpeed(node.netDown, true)}`}
        </text>
        <rect x={8} y={33.5} width={102} height={3.5} rx={1.75} fill="rgba(255,255,255,0.09)" />
        <rect x={8} y={33.5} width={barW} height={3.5} rx={1.75} fill={isHot ? '#F97316' : oled.bar} />
        <rect x={2} y={2} width={116} height={40} rx={2.2} fill={`url(#${gId}-glass)`} />
      </g>

      {/* Center: 6x RJ45 + 2x SFP+ Transceiver Bank */}
      <g transform="translate(164, 7)">
        <rect x={0} y={0} width={236} height={44} rx={2.8} fill="#0D1016" stroke={fin.bayBorder} strokeWidth={0.65} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const px = 10 + i * 26.5;
          return (
            <g key={i}>
              <rect x={px} y={11} width={20} height={16} rx={1.2} fill="#06080B" stroke="#475161" strokeWidth={0.6} />
              <rect x={px + 2.8} y={13.5} width={14.4} height={9.8} rx={0.7} fill="#0E1219" />
              <line x1={px + 5} y1={15.5} x2={px + 15} y2={15.5} stroke="#B5892E" strokeWidth={0.85} strokeDasharray="1.2 1.2" />
              <circle cx={px + 4.8} cy={6.5} r={1.5} fill={isOff ? '#334155' : i === 4 ? '#38BDF8' : '#22C55E'} className={isOff ? undefined : `led-${(i % 3) + 1}`} />
              <circle cx={px + 14.5} cy={6.5} r={1.3} fill={isOff ? '#334155' : '#F59E0B'} className={isOff ? undefined : `led-${((i + 1) % 3) + 1}`} />
            </g>
          );
        })}

        {/* Dual SFP+ 10G Cages */}
        <rect x={176} y={11} width={22} height={16} rx={1.2} fill="#171E28" stroke="#6E7B8C" strokeWidth={0.65} />
        <rect x={204} y={11} width={22} height={16} rx={1.2} fill="#171E28" stroke="#6E7B8C" strokeWidth={0.65} />
        <line x1={179} y1={13.8} x2={195} y2={13.8} stroke="#94A3B8" strokeWidth={0.7} />
        <line x1={207} y1={13.8} x2={223} y2={13.8} stroke="#94A3B8" strokeWidth={0.7} />
        <text x={201} y={37.5} textAnchor="middle" fill="#64748B" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6} fontWeight={700}>
          10G SFP+
        </text>

        {/* Patch Cables */}
        <g>
          <rect x={40} y={16} width={12} height={10} rx={1.5} fill={acc.hex} stroke={acc.dark} strokeWidth={0.6} />
          <rect x={120} y={16} width={12} height={10} rx={1.5} fill={acc.hex} stroke={acc.dark} strokeWidth={0.6} />
          <path d="M46 26 C46 44, 126 44, 126 26" fill="none" stroke="rgba(0,0,0,0.42)" strokeWidth={3.6} strokeLinecap="round" />
          <path d="M46 26 C46 43, 126 43, 126 26" fill="none" stroke={acc.hex} strokeWidth={2.4} strokeLinecap="round" />

          <rect x={181} y={16} width={12} height={10} rx={1.5} fill={acc.cable2} stroke="#0F172A" strokeWidth={0.6} />
          <path d="M187 26 C187 40, 222 40, 231 32" fill="none" stroke={acc.cable2} strokeWidth={2.0} strokeLinecap="round" />
        </g>
      </g>

      {/* Right: Asset Tag + Power Ring + Status LEDs */}
      <g transform="translate(410, 8)">
        <rect x={0} y={1.5} width={60} height={14} rx={2.2} fill={`url(#${gId}-acc)`} />
        <text x={30} y={11} textAnchor="middle" fill="#FFFDF9" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.8} fontWeight={800}>
          {style.tag.slice(0, 10)}
        </text>

        <circle cx={81} cy={21} r={11.5} fill="#14181F" stroke={fin.bayBorder} strokeWidth={0.65} />
        <circle cx={81} cy={21} r={8.8} fill="#0C0F14" />
        <circle cx={81} cy={21} r={5.8} fill="none" stroke={healthColor} strokeWidth={1.6} />

        <circle cx={8} cy={31.5} r={2.6} fill={healthColor} />
        <text x={15} y={33.8} fill={fin.textMute} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.2} fontWeight={600}>
          PWR
        </text>
        <circle cx={40} cy={31.5} r={2.6} fill={uidBlinking ? '#38BDF8' : '#64748B'} className={uidBlinking ? 'uid-active' : undefined} />
        <text x={47} y={33.8} fill={fin.textMute} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.2} fontWeight={600}>
          UID
        </text>
      </g>
    </svg>
  );
}

/* ============================================================================
   B2: 2U 8-Bay Hot-Swap NVMe/SAS Storage Array (540 x 116 — Exact 2 x 1U)
   ============================================================================ */
function B2Svg({
  node,
  style,
  gId,
  uidBlinking,
}: {
  node: NodeInfo;
  style: EffectiveNodeStyle;
  gId: string;
  uidBlinking: boolean;
}) {
  const fin = FINISHES[style.finish] ?? FINISHES.gunmetal;
  const acc = ACCENTS.find((a) => a.id === style.accent) ?? ACCENTS[0];
  const oled = OLEDS.find((o) => o.id === style.oled) ?? OLEDS[0];
  const isOff = !node.online;
  const isHot = node.online && node.cpu >= 80;
  const statColor = isOff ? '#64748B' : isHot ? '#FB923C' : oled.main;
  const healthColor = isOff ? '#475569' : isHot ? '#F97316' : '#22C55E';
  const barW = isOff ? 0 : Math.max(4, Math.round((node.cpu / 100) * 86));

  return (
    <svg viewBox="0 0 540 116" xmlns="http://www.w3.org/2000/svg" className="chassis-svg">
      <CommonDefs gId={gId} fin={fin} acc={acc} />
      <RackEars h={116} fin={fin} gId={gId} />
      <rect x={23} y={1} width={494} height={114} rx={2} fill={`url(#${gId}-body)`} stroke={fin.stroke} strokeWidth={0.8} />
      <line x1={25} y1={2.1} x2={515} y2={2.1} stroke={fin.bevel} strokeWidth={0.65} />

      {/* 2 x 4 Hot-Swap NVMe Drive Bays */}
      {[0, 1].map((r) =>
        [0, 1, 2, 3].map((c) => {
          const bx = 34 + c * 91;
          const by = 11 + r * 49;
          const num = r * 4 + c + 1;
          return (
            <g key={num} transform={`translate(${bx}, ${by})`}>
              <rect x={0} y={0} width={85} height={43} rx={2.2} fill={fin.bayBg} stroke={fin.bayBorder} strokeWidth={0.65} />
              <rect x={4} y={5.5} width={8.5} height={32} rx={1.6} fill={`url(#${gId}-acc)`} />
              <line x1={6.4} y1={9.5} x2={6.4} y2={33.5} stroke="rgba(255,255,255,0.28)" strokeWidth={0.6} />
              {[0, 1, 2, 3, 4].map((v) => (
                <rect key={v} x={19 + v * 9.2} y={12} width={5.6} height={18} rx={1.1} fill="#090C10" stroke="rgba(255,255,255,0.05)" strokeWidth={0.45} />
              ))}
              <circle cx={75} cy={13.5} r={2} fill={isOff ? '#334155' : '#22C55E'} className={isOff ? undefined : `led-${(num % 3) + 1}`} />
              <circle cx={75} cy={23} r={2} fill={isOff ? '#334155' : '#38BDF8'} className={isOff ? undefined : `led-${((num + 1) % 3) + 1}`} />
              <text x={75} y={36.5} textAnchor="middle" fill={fin.textMute} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.2} fontWeight={700}>
                0{num}
              </text>
            </g>
          );
        }),
      )}

      {/* Right Control Bay + OLED */}
      <g transform="translate(402, 11)">
        <rect x={0} y={0} width={104} height={92} rx={2.8} fill="#0D1016" stroke={fin.bayBorder} strokeWidth={0.65} />
        <rect x={5} y={5} width={94} height={44} rx={2.2} fill={oled.bg} stroke="#283140" strokeWidth={0.55} />
        <text x={10} y={16} fill={oled.title} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={7} fontWeight={700}>
          {node.name.slice(0, 13)}
        </text>
        <text x={10} y={30.5} fill={statColor} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={10} fontWeight={800}>
          {isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`}
        </text>
        <text x={94} y={30.5} textAnchor="end" fill="#8B98AA" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.6}>
          {isOff ? 'STBY' : `D${node.disk}%`}
        </text>
        <rect x={10} y={38.5} width={84} height={3.5} rx={1.75} fill="rgba(255,255,255,0.09)" />
        <rect x={10} y={38.5} width={Math.min(84, barW)} height={3.5} rx={1.75} fill={isHot ? '#F97316' : oled.bar} />
        <rect x={5} y={5} width={94} height={44} rx={2.2} fill={`url(#${gId}-glass)`} />

        <rect x={6} y={55} width={54} height={13.5} rx={2} fill={`url(#${gId}-acc)`} />
        <text x={33} y={64} textAnchor="middle" fill="#FFFDF9" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.5} fontWeight={800}>
          {style.tag.slice(0, 9)}
        </text>

        <circle cx={82} cy={71} r={11} fill="#151A22" stroke={fin.bayBorder} strokeWidth={0.65} />
        <circle cx={82} cy={71} r={6.2} fill="none" stroke={healthColor} strokeWidth={1.6} />

        <circle cx={12} cy={80} r={2.5} fill={healthColor} />
        <text x={18.5} y={82.3} fill="#8B98AA" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.2}>
          OK
        </text>
        <circle cx={40} cy={80} r={2.5} fill={uidBlinking ? '#38BDF8' : '#64748B'} className={uidBlinking ? 'uid-active' : undefined} />
        <text x={46.5} y={82.3} fill="#8B98AA" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.2}>
          UID
        </text>
      </g>
    </svg>
  );
}

/* ============================================================================
   B3: 4U Vertical Blade Enclosure + Dual Turbines (540 x 216)
   ============================================================================ */
function B3Svg({
  node,
  style,
  gId,
  uidBlinking,
}: {
  node: NodeInfo;
  style: EffectiveNodeStyle;
  gId: string;
  uidBlinking: boolean;
}) {
  const fin = FINISHES[style.finish] ?? FINISHES.gunmetal;
  const acc = ACCENTS.find((a) => a.id === style.accent) ?? ACCENTS[0];
  const oled = OLEDS.find((o) => o.id === style.oled) ?? OLEDS[0];
  const isOff = !node.online;
  const isHot = node.online && node.cpu >= 80;
  const statColor = isOff ? '#64748B' : isHot ? '#FB923C' : oled.main;
  const healthColor = isOff ? '#475569' : isHot ? '#F97316' : '#22C55E';
  const barW = isOff ? 0 : Math.max(5, Math.round((node.cpu / 100) * 114));

  const fanDur = isOff ? 0 : Math.max(0.38, Number((1.18 - (node.cpu / 100) * 0.76).toFixed(2)));

  const renderTurbine = (cx: number, cy: number, phaseOffsetSec: number) => (
    <g>
      <circle cx={cx} cy={cy} r={27} fill="#080B0F" stroke="#475161" strokeWidth={0.8} />
      <g
        className={isOff ? undefined : 'fan-rotor'}
        style={
          isOff
            ? undefined
            : {
                animationDuration: `${fanDur}s`,
                animationDelay: `${phaseOffsetSec}s`,
              }
        }
      >
        {/* Symmetric invisible bounds circle guarantees exact (cx, cy) fill-box pivot across all browsers */}
        <circle cx={cx} cy={cy} r={23} fill="none" />
        <path d={`M${cx} ${cy} C${cx} ${cy - 17}, ${cx + 13} ${cy - 21}, ${cx + 17} ${cy - 11} C${cx + 10} ${cy - 5}, ${cx + 5} ${cy - 3}, ${cx} ${cy} Z`} fill="#64748B" />
        <path d={`M${cx} ${cy} C${cx + 17} ${cy}, ${cx + 21} ${cy + 13}, ${cx + 11} ${cy + 17} C${cx + 5} ${cy + 10}, ${cx + 3} ${cy + 5}, ${cx} ${cy} Z`} fill="#64748B" />
        <path d={`M${cx} ${cy} C${cx} ${cy + 17}, ${cx - 13} ${cy + 21}, ${cx - 17} ${cy + 11} C${cx - 10} ${cy + 5}, ${cx - 5} ${cy + 3}, ${cx} ${cy} Z`} fill="#64748B" />
        <path d={`M${cx} ${cy} C${cx - 17} ${cy}, ${cx - 21} ${cy - 13}, ${cx - 11} ${cy - 17} C${cx - 5} ${cy - 10}, ${cx - 3} ${cy - 5}, ${cx} ${cy} Z`} fill="#64748B" />
        <circle cx={cx} cy={cy} r={6.4} fill={acc.hex} />
        <circle cx={cx} cy={cy} r={2.3} fill="#101318" />
      </g>
      <circle cx={cx} cy={cy} r={19} fill="none" stroke="rgba(148,163,184,0.24)" strokeWidth={0.65} />
      <circle cx={cx} cy={cy} r={11.5} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth={0.6} />
    </g>
  );

  return (
    <svg viewBox="0 0 540 216" xmlns="http://www.w3.org/2000/svg" className="chassis-svg">
      <CommonDefs gId={gId} fin={fin} acc={acc} />
      <RackEars h={216} fin={fin} gId={gId} />
      <rect x={23} y={1} width={494} height={214} rx={2} fill={`url(#${gId}-body)`} stroke={fin.stroke} strokeWidth={0.8} />
      <line x1={25} y1={2.1} x2={515} y2={2.1} stroke={fin.bevel} strokeWidth={0.65} />

      {/* 4x Vertical Compute Blades */}
      {[0, 1, 2, 3].map((i) => {
        const bx = 34 + i * 81;
        return (
          <g key={i} transform={`translate(${bx}, 13)`}>
            <rect x={0} y={0} width={74} height={190} rx={2.5} fill={fin.bayBg} stroke={fin.bayBorder} strokeWidth={0.65} />
            <rect x={8} y={8} width={58} height={12.5} rx={2} fill={`url(#${gId}-acc)`} />
            <text x={37} y={16.5} textAnchor="middle" fill="#FFFDF9" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.4} fontWeight={800}>
              BLADE 0{i + 1}
            </text>
            <circle cx={14.5} cy={30} r={2.1} fill={isOff ? '#334155' : '#22C55E'} className={isOff ? undefined : `led-${(i % 3) + 1}`} />
            <circle cx={24} cy={30} r={2.1} fill={isOff ? '#334155' : '#38BDF8'} className={isOff ? undefined : `led-${((i + 1) % 3) + 1}`} />
            <text x={63} y={32.2} textAnchor="end" fill={fin.textMute} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.2}>
              EPYC
            </text>
            {Array.from({ length: 11 }).map((_, row) => (
              <rect key={row} x={11} y={42 + row * 10.8} width={52} height={5.6} rx={1.1} fill="#090C10" stroke="rgba(255,255,255,0.04)" strokeWidth={0.45} />
            ))}
            <rect x={14} y={168} width={46} height={12} rx={2} fill="#0B0E13" stroke="#3E4754" strokeWidth={0.6} />
            <line x1={21} y1={174} x2={53} y2={174} stroke={acc.hex} strokeWidth={1.5} strokeLinecap="round" />
          </g>
        );
      })}

      {/* Right Telemetry + Dual High-CFM Turbines */}
      <g transform="translate(364, 13)">
        <rect x={0} y={0} width={142} height={190} rx={3} fill="#0D1016" stroke={fin.bayBorder} strokeWidth={0.65} />
        <rect x={7} y={7} width={128} height={46} rx={2.2} fill={oled.bg} stroke="#283140" strokeWidth={0.6} />
        <text x={13} y={18.5} fill={oled.title} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={7.2} fontWeight={700}>
          {node.name.slice(0, 14)}
        </text>
        <text x={13} y={33} fill={statColor} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={10.4} fontWeight={800}>
          {isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`}
        </text>
        <text x={128} y={33} textAnchor="end" fill="#8B98AA" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.8}>
          {isOff ? '0 RPM' : `${Math.round(1800 + node.cpu * 34)} RPM`}
        </text>
        <rect x={13} y={41.5} width={114} height={3.6} rx={1.8} fill="rgba(255,255,255,0.09)" />
        <rect x={13} y={41.5} width={Math.min(114, barW)} height={3.6} rx={1.8} fill={isHot ? '#F97316' : oled.bar} />
        <rect x={7} y={7} width={128} height={46} rx={2.2} fill={`url(#${gId}-glass)`} />

        <rect x={7} y={59} width={56} height={14} rx={2.2} fill={`url(#${gId}-acc)`} />
        <text x={35} y={68.5} textAnchor="middle" fill="#FFFDF9" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.6} fontWeight={800}>
          {style.tag.slice(0, 9)}
        </text>
        <circle cx={90} cy={66} r={2.8} fill={healthColor} />
        <circle cx={105} cy={66} r={2.8} fill={uidBlinking ? '#38BDF8' : '#64748B'} className={uidBlinking ? 'uid-active' : undefined} />
        <circle cx={123} cy={66} r={5.8} fill="#14181F" stroke={healthColor} strokeWidth={1.5} />

        {renderTurbine(40, 116, 0)}
        {renderTurbine(102, 116, -0.34)}

        <rect x={9} y={158} width={124} height={22} rx={2.5} fill="#090C10" stroke="#2B3340" strokeWidth={0.6} />
        <text x={71} y={171.8} textAnchor="middle" fill="#7D8899" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.5} fontWeight={600}>
          DUAL REDUNDANT PSU · 1600W
        </text>
      </g>
    </svg>
  );
}

/* ============================================================================
   B4: 1U Cantilever Shelf + CNC Finned Fanless Edge Box (540 x 58 — True 1U)
   ============================================================================ */
function B4Svg({
  node,
  style,
  gId,
  uidBlinking,
}: {
  node: NodeInfo;
  style: EffectiveNodeStyle;
  gId: string;
  uidBlinking: boolean;
}) {
  const fin = FINISHES[style.finish] ?? FINISHES.gunmetal;
  const acc = ACCENTS.find((a) => a.id === style.accent) ?? ACCENTS[0];
  const oled = OLEDS.find((o) => o.id === style.oled) ?? OLEDS[0];
  const isOff = !node.online;
  const isHot = node.online && node.cpu >= 80;
  const statColor = isOff ? '#64748B' : isHot ? '#FB923C' : oled.main;
  const healthColor = isOff ? '#475569' : isHot ? '#F97316' : '#22C55E';
  const finTemp = isOff ? '--' : `${Math.round(28 + node.cpu * 0.44)}°C`;

  return (
    <svg viewBox="0 0 540 58" xmlns="http://www.w3.org/2000/svg" className="chassis-svg">
      <CommonDefs gId={gId} fin={fin} acc={acc} />
      <rect x={23} y={1} width={494} height={56} rx={2} fill="#0B0E13" />
      <RackEars h={58} fin={fin} gId={gId} />

      {/* 1U Cantilever Shelf Lip */}
      <rect x={23} y={46} width={494} height={11} rx={1.6} fill="#252B34" stroke="#0E1116" strokeWidth={0.75} />
      <line x1={25} y1={47.2} x2={515} y2={47.2} stroke="rgba(255,255,255,0.18)" strokeWidth={0.6} />
      <text x={36} y={53.8} fill="#8893A3" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6} fontWeight={700}>
        1U CANTILEVER SHELF · NANO IPC
      </text>
      <text x={504} y={53.8} textAnchor="end" fill={acc.hex} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6} fontWeight={800}>
        {style.tag.slice(0, 12)}
      </text>

      {/* Mini 12V Power Brick + Coiled Cable */}
      <g transform="translate(396, 15)">
        <rect x={22} y={8} width={72} height={21} rx={3} fill="#181D24" stroke="#3F4958" strokeWidth={0.65} />
        <circle cx={32} cy={18.5} r={2} fill={healthColor} />
        <text x={40} y={20.8} fill="#94A3B8" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.3} fontWeight={700}>
          12V · 3A
        </text>
        <path d="M-24 19 C-10 19, -8 9, 6 9 C15 9, 14 19, 22 19" fill="none" stroke={acc.hex} strokeWidth={2.2} strokeLinecap="round" />
      </g>

      {/* CNC Finned Fanless Edge Chassis */}
      <g>
        {Array.from({ length: 12 }).map((_, i) => {
          const x1 = 92 + i * 21.5;
          return (
            <polygon
              key={i}
              points={`${x1},13 ${x1 + 4},4.5 ${x1 + 13},4.5 ${x1 + 9.5},13`}
              fill={`url(#${gId}-fin)`}
              stroke={fin.stroke}
              strokeWidth={0.55}
            />
          );
        })}
        <rect x={80} y={12} width={292} height={35} rx={3.4} fill={`url(#${gId}-body)`} stroke={fin.stroke} strokeWidth={0.8} />
        <line x1={84} y1={13.2} x2={368} y2={13.2} stroke={fin.bevel} strokeWidth={0.65} />

        {/* Dual 2.5GbE + USB-C */}
        <g transform="translate(91, 17)">
          <rect x={0} y={0} width={11} height={13} rx={1.3} fill="#090C10" stroke="#4D5766" strokeWidth={0.6} />
          <rect x={15} y={0} width={15} height={13} rx={1.3} fill="#090C10" stroke="#4D5766" strokeWidth={0.6} />
          <rect x={34} y={0} width={15} height={13} rx={1.3} fill="#090C10" stroke="#4D5766" strokeWidth={0.6} />
          <rect x={20} y={1.8} width={3.4} height={1.8} fill={isOff ? '#334155' : '#22C55E'} className={isOff ? undefined : 'led-2'} />
          <rect x={39} y={1.8} width={3.4} height={1.8} fill={isOff ? '#334155' : '#38BDF8'} className={isOff ? undefined : 'led-1'} />
          <rect x={13} y={17.5} width={22} height={4.8} rx={2.4} fill={`url(#${gId}-acc)`} />
        </g>

        {/* Mini OLED */}
        <g transform="translate(154, 15.5)">
          <rect x={0} y={0} width={142} height={28} rx={2.6} fill={oled.bg} stroke={fin.bayBorder} strokeWidth={0.65} />
          <text x={7} y={10.5} fill={oled.title} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={7} fontWeight={700}>
            {node.name.slice(0, 14)}
          </text>
          <text x={7} y={22.5} fill={statColor} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={9.8} fontWeight={800}>
            {isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`}
          </text>
          <text x={135} y={21.8} textAnchor="end" fill="#8B98AA" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.8}>
            {isOff ? 'STBY' : finTemp}
          </text>
          <rect x={0} y={0} width={142} height={28} rx={2.6} fill={`url(#${gId}-glass)`} />
        </g>

        {/* Power Ring + Status */}
        <g transform="translate(308, 17)">
          <circle cx={13} cy={12.5} r={8.8} fill="#14181F" stroke={fin.bayBorder} strokeWidth={0.65} />
          <circle cx={13} cy={12.5} r={5.2} fill="none" stroke={healthColor} strokeWidth={1.6} />
          <circle cx={35} cy={8} r={2.3} fill={healthColor} />
          <circle cx={35} cy={17.5} r={2.3} fill={uidBlinking ? '#38BDF8' : '#64748B'} className={uidBlinking ? 'uid-active' : undefined} />
        </g>
      </g>
    </svg>
  );
}

/* ============================================================================
   Accessory 1: 1U Metered Rack PDU (540 x 58 — Unified 1U Pitch)
   ============================================================================ */
export function PduSvg({
  label,
  watts,
  activeSockets,
}: {
  label?: string;
  watts: number;
  activeSockets: number;
}) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gId = `pdu-${rawId}`;
  const fin = FINISHES.obsidian;
  const acc = ACCENTS[0];
  const amps = (watts / 220).toFixed(1);

  return (
    <svg viewBox="0 0 540 58" xmlns="http://www.w3.org/2000/svg" className="chassis-svg">
      <CommonDefs gId={gId} fin={fin} acc={acc} />
      <RackEars h={58} fin={fin} gId={gId} />
      <rect x={23} y={1} width={494} height={56} rx={2} fill={`url(#${gId}-body)`} stroke={fin.stroke} strokeWidth={0.8} />
      <line x1={25} y1={2.1} x2={515} y2={2.1} stroke={fin.bevel} strokeWidth={0.65} />

      {/* Main Breaker Rocker */}
      <rect x={38} y={13} width={22} height={32} rx={2.5} fill="#B91C1C" stroke="#7F1D1D" strokeWidth={0.7} />
      <line x1={49} y1={21} x2={49} y2={37} stroke="#FEE2E2" strokeWidth={1.6} strokeLinecap="round" />

      {/* Digital Ammeter / Wattmeter */}
      <rect x={70} y={11.5} width={104} height={35} rx={2.8} fill="#140907" stroke="#3D4654" strokeWidth={0.65} />
      <text x={78} y={23} fill="#FB923C" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.8} fontWeight={700}>
        {(label || 'APC-PDU-16A').slice(0, 14)}
      </text>
      <text x={78} y={38.5} fill="#F87171" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={10.8} fontWeight={800}>
        {watts}W · {amps}A
      </text>
      <rect x={70} y={11.5} width={104} height={35} rx={2.8} fill={`url(#${gId}-glass)`} />

      {/* 6x IEC C13 Sockets */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const sx = 188 + i * 44;
        return (
          <g key={i} transform={`translate(${sx}, 13)`}>
            <rect x={0} y={0} width={32} height={32} rx={2.8} fill="#080A0E" stroke="#363E4B" strokeWidth={0.65} />
            <rect x={8} y={8} width={3.4} height={7} rx={0.7} fill="#475569" />
            <rect x={20.5} y={8} width={3.4} height={7} rx={0.7} fill="#475569" />
            <rect x={14.2} y={19} width={3.4} height={6} rx={0.7} fill="#475569" />
            <circle cx={26.5} cy={5.2} r={1.5} fill={i < activeSockets ? '#22C55E' : '#334155'} />
          </g>
        );
      })}
      <text x={502} y={32} textAnchor="end" fill="#64748B" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={7.2} fontWeight={700}>
        220V~
      </text>
    </svg>
  );
}

/* ============================================================================
   Accessory 2: 1U Vented Airflow Blanking Plate (540 x 58 — Unified 1U Pitch)
   ============================================================================ */
export function BlankSvg({ label }: { label?: string }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gId = `blank-${rawId}`;
  const fin = FINISHES.gunmetal;
  const acc = ACCENTS[0];
  const slots = Array.from({ length: 22 }, (_, i) => 42 + i * 20.5);

  return (
    <svg viewBox="0 0 540 58" xmlns="http://www.w3.org/2000/svg" className="chassis-svg">
      <CommonDefs gId={gId} fin={fin} acc={acc} />
      <RackEars h={58} fin={fin} gId={gId} />
      <rect x={23} y={1} width={494} height={56} rx={2} fill={`url(#${gId}-body)`} stroke={fin.stroke} strokeWidth={0.8} />
      <line x1={25} y1={2.1} x2={515} y2={2.1} stroke={fin.bevel} strokeWidth={0.65} />

      {slots.map((x) => (
        <rect key={x} x={x} y={15} width={11.5} height={28} rx={2.2} fill="#0A0D11" stroke="#363E4A" strokeWidth={0.55} />
      ))}

      <rect x={200} y={20} width={140} height={18} rx={2.4} fill="#1A1F27" stroke="#444E5D" strokeWidth={0.65} />
      <text x={270} y={31.2} textAnchor="middle" fill="#9AA4B3" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={6.8} fontWeight={700}>
        {(label || 'AIRFLOW-BAFFLE-1U').slice(0, 20)}
      </text>
    </svg>
  );
}

export function ServerUnitSvg({
  node,
  style,
  uidBlinking,
}: {
  node: NodeInfo;
  style: EffectiveNodeStyle;
  uidBlinking: boolean;
}) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gId = `u-${rawId}`;

  if (style.model === 'B2') {
    return <B2Svg node={node} style={style} gId={gId} uidBlinking={uidBlinking} />;
  }
  if (style.model === 'B3') {
    return <B3Svg node={node} style={style} gId={gId} uidBlinking={uidBlinking} />;
  }
  if (style.model === 'B4') {
    return <B4Svg node={node} style={style} gId={gId} uidBlinking={uidBlinking} />;
  }
  return <B1Svg node={node} style={style} gId={gId} uidBlinking={uidBlinking} />;
}
