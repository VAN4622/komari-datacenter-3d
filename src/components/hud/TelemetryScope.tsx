import { useState } from 'react';
import type { RecordHours, TelemetryPoint } from '@/types/rack';

interface TelemetryScopeProps {
  points: TelemetryPoint[];
  nodeName: string;
  online: boolean;
  recordHours: RecordHours;
  onChangeRecordHours: (hours: RecordHours) => void;
  isLiveMode: boolean;
}

const CPU_COLOR = 'var(--chart-cpu, #268ED4)';
const RAM_COLOR = 'var(--chart-ram, #DC6B20)';
const HOUR_OPTIONS: RecordHours[] = [1, 6, 24];

export function TelemetryScope({
  points,
  nodeName,
  online,
  recordHours,
  onChangeRecordHours,
  isLiveMode,
}: TelemetryScopeProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const w = 310;
  const h = 148;
  const pad = { top: 14, right: 36, bottom: 22, left: 26 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const count = Math.max(2, points.length);
  const xFor = (i: number) => pad.left + (i / (count - 1)) * plotW;
  const yFor = (val: number) => pad.top + plotH - (Math.max(0, Math.min(100, val)) / 100) * plotH;

  const buildPath = (key: 'cpu' | 'ram') =>
    points
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yFor(pt[key]).toFixed(1)}`)
      .join(' ');

  const cpuPath = buildPath('cpu');
  const ramPath = buildPath('ram');
  const last = points[points.length - 1];
  const activePt = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="scope-card">
      <div className="scope-top">
        <div>
          <h4 className="scope-title">CPU / RAM 负载曲线</h4>
          <p className="scope-sub">
            {nodeName} · {isLiveMode ? `Live ${recordHours}H` : '0–100%'}
          </p>
        </div>
        <div className="scope-tools">
          <div className="scope-range-row" role="group" aria-label="采样窗口">
            {HOUR_OPTIONS.map((hr) => (
              <button
                key={hr}
                type="button"
                className={`scope-btn${recordHours === hr ? ' is-active' : ''}`}
                onClick={() => onChangeRecordHours(hr)}
              >
                {hr}H
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`scope-btn${showTable ? ' is-active' : ''}`}
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? '图' : '表'}
          </button>
        </div>
      </div>

      <div className="scope-legend">
        <span className="scope-leg-item">
          <i className="scope-swatch" style={{ background: CPU_COLOR }} />
          <span>CPU</span>
          <strong>{online && last ? `${last.cpu}%` : '--'}</strong>
        </span>
        <span className="scope-leg-item">
          <i className="scope-swatch is-dashed" style={{ color: RAM_COLOR }} />
          <span>RAM</span>
          <strong>{online && last ? `${last.ram}%` : '--'}</strong>
        </span>
        <span className="scope-leg-item scope-leg-right">
          <span>RTT</span>
          <strong>{online && last && last.ping > 0 ? `${last.ping}ms` : '--'}</strong>
        </span>
      </div>

      {showTable ? (
        <div className="scope-table-wrap">
          <table className="scope-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>CPU</th>
                <th>RAM</th>
                <th>延迟</th>
              </tr>
            </thead>
            <tbody>
              {points.slice(-6).reverse().map((pt, idx) => (
                <tr key={`${pt.time}-${idx}`}>
                  <td>{pt.time}</td>
                  <td>{pt.cpu}%</td>
                  <td>{pt.ram}%</td>
                  <td>{pt.ping > 0 ? `${pt.ping}ms` : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-svg-wrap" onMouseLeave={() => setHoverIdx(null)}>
          <svg viewBox={`0 0 ${w} ${h}`} className="scope-svg" role="img" aria-label={`${nodeName} 负载历史`}>
            {[0, 50, 100].map((tick) => {
              const y = yFor(tick);
              return (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={w - pad.right}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={tick === 50 ? 0.14 : 0.09}
                    strokeWidth={1}
                    strokeDasharray={tick === 50 ? '2 3' : undefined}
                  />
                  <text
                    x={pad.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity={0.45}
                    fontSize={9}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {points.length > 0 && (
              <>
                <path
                  d={ramPath}
                  fill="none"
                  stroke={RAM_COLOR}
                  strokeWidth={1.75}
                  strokeDasharray="4 2.5"
                  strokeLinejoin="round"
                />
                <path d={cpuPath} fill="none" stroke={CPU_COLOR} strokeWidth={1.9} strokeLinejoin="round" />

                {last && (
                  <>
                    <circle cx={xFor(points.length - 1)} cy={yFor(last.cpu)} r={3.5} fill={CPU_COLOR} />
                    <circle cx={xFor(points.length - 1)} cy={yFor(last.ram)} r={3.5} fill={RAM_COLOR} />
                    <text
                      x={w - pad.right + 6}
                      y={yFor(last.cpu) + 3}
                      fill="currentColor"
                      fillOpacity={0.88}
                      fontSize={9}
                      fontWeight={600}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    >
                      {last.cpu}%
                    </text>
                    {Math.abs(yFor(last.ram) - yFor(last.cpu)) > 11 && (
                      <text
                        x={w - pad.right + 6}
                        y={yFor(last.ram) + 3}
                        fill="currentColor"
                        fillOpacity={0.68}
                        fontSize={9}
                        fontWeight={600}
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      >
                        {last.ram}%
                      </text>
                    )}
                  </>
                )}

                {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((idx) => (
                  <text
                    key={idx}
                    x={xFor(idx)}
                    y={h - 5}
                    textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
                    fill="currentColor"
                    fillOpacity={0.45}
                    fontSize={9}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {points[idx]?.time}
                  </text>
                ))}

                {hoverIdx !== null && activePt && (
                  <g>
                    <line
                      x1={xFor(hoverIdx)}
                      y1={pad.top}
                      x2={xFor(hoverIdx)}
                      y2={pad.top + plotH}
                      stroke="currentColor"
                      strokeOpacity={0.28}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <circle cx={xFor(hoverIdx)} cy={yFor(activePt.cpu)} r={3.6} fill={CPU_COLOR} />
                    <circle cx={xFor(hoverIdx)} cy={yFor(activePt.ram)} r={3.6} fill={RAM_COLOR} />
                  </g>
                )}

                {points.map((pt, i) => {
                  const bandW = plotW / points.length;
                  const bx = Math.max(pad.left, xFor(i) - bandW / 2);
                  return (
                    <rect
                      key={`${pt.time}-${i}`}
                      x={bx}
                      y={pad.top}
                      width={bandW}
                      height={plotH}
                      fill="transparent"
                      onMouseEnter={() => setHoverIdx(i)}
                    />
                  );
                })}
              </>
            )}
          </svg>

          {activePt && (
            <div className="scope-tooltip">
              <span>{activePt.time}</span>
              <span>CPU {activePt.cpu}%</span>
              <span>RAM {activePt.ram}%</span>
              <span>{activePt.ping > 0 ? `${activePt.ping}ms` : '--'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
