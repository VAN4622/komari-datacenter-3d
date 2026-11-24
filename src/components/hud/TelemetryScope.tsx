import { useEffect, useMemo, useState } from 'react';
import { formatNetSpeed } from '@/lib/formatters';
import type { PingProbeSeries, RecordHours, TelemetryPoint } from '@/types/rack';

interface TelemetryScopeProps {
  points: TelemetryPoint[];
  pingProbes: PingProbeSeries[];
  nodeName: string;
  online: boolean;
  recordHours: RecordHours;
  isLiveMode: boolean;
  liveNetDown: number;
  liveNetUp: number;
}

const SLOT_COLORS = [
  'var(--chart-s1, #3987E5)',
  'var(--chart-s2, #D95926)',
  'var(--chart-s3, #199E70)',
  'var(--chart-s4, #9085E9)',
] as const;

const SLOT_DASHES: Array<string | undefined> = [undefined, '5 2.5', '2.2 2', '6 2 1.5 2'];

function niceCeiling(rawMax: number, minFloor = 10): number {
  const safe = Math.max(minFloor, rawMax);
  const exp = Math.pow(10, Math.floor(Math.log10(safe)));
  const frac = safe / exp;
  const niceFrac = frac <= 1 ? 1 : frac <= 1.5 ? 1.5 : frac <= 2 ? 2 : frac <= 3 ? 3 : frac <= 5 ? 5 : frac <= 8 ? 8 : 10;
  return niceFrac * exp;
}

function formatMs(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val) || val <= 0) return '--';
  return val >= 100 ? `${Math.round(val)}ms` : `${Math.round(val * 10) / 10}ms`;
}

function buildSegmentedPath(
  values: Array<number | null>,
  xFor: (idx: number) => number,
  yFor: (val: number) => number,
): string {
  const parts: string[] = [];
  let penDown = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || !Number.isFinite(v) || v <= 0) {
      penDown = false;
      continue;
    }
    const cmd = penDown ? 'L' : 'M';
    parts.push(`${cmd}${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`);
    penDown = true;
  }
  return parts.join(' ');
}

function LatencyScopeCard({
  pingProbes,
  fallbackPoints,
  nodeName,
  online,
  recordHours,
  isLiveMode,
}: {
  pingProbes: PingProbeSeries[];
  fallbackPoints: TelemetryPoint[];
  nodeName: string;
  online: boolean;
  recordHours: RecordHours;
  isLiveMode: boolean;
}) {
  const [selectedProbeId, setSelectedProbeId] = useState<string>('all');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const effectiveProbes = useMemo<PingProbeSeries[]>(() => {
    if (pingProbes.length > 0) return pingProbes;
    const valid = fallbackPoints.filter((p) => p.ping > 0);
    if (valid.length === 0) return [];
    const vals = valid.map((p) => p.ping);
    const sorted = vals.slice().sort((a, b) => a - b);
    const avg = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
    const p95 = sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1))];
    let jitterSum = 0;
    for (let i = 1; i < vals.length; i++) jitterSum += Math.abs(vals[i] - vals[i - 1]);
    return [
      {
        id: 'fallback',
        name: 'ICMP 延迟',
        latest: vals[vals.length - 1] ?? null,
        min: sorted[0] ?? null,
        avg,
        p95: p95 ?? null,
        max: sorted[sorted.length - 1] ?? null,
        jitter: vals.length > 1 ? Math.round((jitterSum / (vals.length - 1)) * 10) / 10 : null,
        loss: 0,
        totalSamples: fallbackPoints.length,
        points: fallbackPoints.map((p) => ({ time: p.time, value: p.ping > 0 ? p.ping : null })),
      },
    ];
  }, [pingProbes, fallbackPoints]);

  useEffect(() => {
    if (selectedProbeId !== 'all' && !effectiveProbes.some((p) => p.id === selectedProbeId)) {
      setSelectedProbeId('all');
    }
    setHoverIdx(null);
  }, [effectiveProbes, selectedProbeId, nodeName]);

  // Preserve original index so color always follows the entity, never its rank
  const indexedVisible = useMemo(
    () =>
      effectiveProbes
        .map((probe, origIdx) => ({ probe, origIdx }))
        .filter(({ probe }) => selectedProbeId === 'all' || probe.id === selectedProbeId),
    [effectiveProbes, selectedProbeId],
  );

  // Aggregate summary metrics for active selection
  const summary = useMemo(() => {
    if (indexedVisible.length === 0) {
      return { latest: null, avg: null, p95: null, jitter: null, loss: 0 };
    }
    if (indexedVisible.length === 1) {
      const p = indexedVisible[0].probe;
      return { latest: p.latest, avg: p.avg, p95: p.p95, jitter: p.jitter, loss: p.loss };
    }
    const latestVals = indexedVisible.map((x) => x.probe.latest).filter((v): v is number => v !== null && v > 0);
    const avgVals = indexedVisible.map((x) => x.probe.avg).filter((v): v is number => v !== null && v > 0);
    const p95Vals = indexedVisible.map((x) => x.probe.p95).filter((v): v is number => v !== null && v > 0);
    const jitterVals = indexedVisible.map((x) => x.probe.jitter).filter((v): v is number => v !== null && v >= 0);
    const lossAvg =
      indexedVisible.reduce((s, x) => s + x.probe.loss, 0) / Math.max(1, indexedVisible.length);
    return {
      latest:
        latestVals.length > 0
          ? Math.round((latestVals.reduce((s, v) => s + v, 0) / latestVals.length) * 10) / 10
          : null,
      avg:
        avgVals.length > 0 ? Math.round((avgVals.reduce((s, v) => s + v, 0) / avgVals.length) * 10) / 10 : null,
      p95: p95Vals.length > 0 ? Math.max(...p95Vals) : null,
      jitter:
        jitterVals.length > 0
          ? Math.round((jitterVals.reduce((s, v) => s + v, 0) / jitterVals.length) * 10) / 10
          : null,
      loss: Math.round(lossAvg * 10) / 10,
    };
  }, [indexedVisible]);

  const maxLen = Math.max(0, ...indexedVisible.map((x) => x.probe.points.length));
  const rawMaxMs = Math.max(
    10,
    ...indexedVisible.flatMap((x) =>
      x.probe.points.map((pt) => (pt.value !== null && pt.value > 0 ? pt.value : 0)),
    ),
  );
  const yMax = niceCeiling(rawMaxMs * 1.15, 20);
  const yTicks = [0, Math.round(yMax / 2), Math.round(yMax)];

  const w = 340;
  const h = 144;
  const pad = { top: 12, right: 14, bottom: 22, left: 36 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const count = Math.max(2, maxLen);
  const xFor = (i: number) => pad.left + (i / (count - 1)) * plotW;
  const yFor = (val: number) => pad.top + plotH - (Math.max(0, Math.min(yMax, val)) / yMax) * plotH;

  const refTimeline = indexedVisible[0]?.probe.points ?? [];
  const hoverTime = hoverIdx !== null ? refTimeline[hoverIdx]?.time : undefined;

  return (
    <div className="scope-card">
      <div className="scope-top">
        <div>
          <h4 className="scope-title">延迟与丢包监控</h4>
          <p className="scope-sub">
            {effectiveProbes.length > 1
              ? `${effectiveProbes.length} 路探针 · ${isLiveMode ? `Live ${recordHours}H` : `Demo ${recordHours}H`} · ms`
              : `${isLiveMode ? `Live ${recordHours}H` : `Demo ${recordHours}H`} · 往返延迟 (ms)`}
          </p>
        </div>
        <div className="scope-tools">
          <button
            type="button"
            className={`scope-btn${showTable ? ' is-active' : ''}`}
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? '图' : '表'}
          </button>
        </div>
      </div>

      {effectiveProbes.length === 0 ? (
        <div className="scope-empty">
          <strong>暂无延迟探测记录</strong>
          <span>
            {isLiveMode
              ? '当前节点未配置 Ping 探针任务或暂未采集到数据，可在 Komari 后台添加 Ping 任务。'
              : '节点离线，暂无法采集往返延迟样本。'}
          </span>
        </div>
      ) : (
        <>
          {effectiveProbes.length > 1 && (
            <div className="scope-probe-row" role="group" aria-label="筛选延迟探针">
              <button
                type="button"
                className={`scope-probe-chip${selectedProbeId === 'all' ? ' is-active' : ''}`}
                onClick={() => setSelectedProbeId('all')}
              >
                全部 ({effectiveProbes.length})
              </button>
              {effectiveProbes.map((probe, idx) => (
                <button
                  key={probe.id}
                  type="button"
                  className={`scope-probe-chip${selectedProbeId === probe.id ? ' is-active' : ''}`}
                  onClick={() => setSelectedProbeId((cur) => (cur === probe.id ? 'all' : probe.id))}
                >
                  <i className="scope-probe-dot" style={{ background: SLOT_COLORS[idx % SLOT_COLORS.length] }} />
                  <span>{probe.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* 5-stat ink summary bar */}
          <div className="scope-kpi-strip" aria-label="延迟统计摘要">
            <div className="scope-kpi">
              <span>当前</span>
              <strong>{online ? formatMs(summary.latest) : '--'}</strong>
            </div>
            <div className="scope-kpi">
              <span>均值</span>
              <strong>{online ? formatMs(summary.avg) : '--'}</strong>
            </div>
            <div className="scope-kpi">
              <span>P95</span>
              <strong>{online ? formatMs(summary.p95) : '--'}</strong>
            </div>
            <div className="scope-kpi">
              <span>抖动</span>
              <strong>{online && summary.jitter !== null ? `±${summary.jitter}ms` : '--'}</strong>
            </div>
            <div className="scope-kpi">
              <span>丢包</span>
              <strong>
                {summary.loss > 0 && <i className={`scope-loss-dot${summary.loss >= 5 ? ' is-high' : ''}`} />}
                {online ? `${summary.loss}%` : '--'}
              </strong>
            </div>
          </div>

          {/* Series legend only when >= 2 visible series */}
          {indexedVisible.length >= 2 && (
            <div className="scope-legend is-wrap">
              {indexedVisible.map(({ probe, origIdx }) => {
                const color = SLOT_COLORS[origIdx % SLOT_COLORS.length];
                const isDashed = origIdx > 0;
                return (
                  <span key={probe.id} className="scope-leg-item">
                    <i
                      className={`scope-swatch${isDashed ? ' is-dashed' : ''}`}
                      style={isDashed ? { color } : { background: color }}
                    />
                    <span>{probe.name}</span>
                    <strong>{online ? formatMs(probe.latest) : '--'}</strong>
                  </span>
                );
              })}
            </div>
          )}

          {showTable ? (
            <div className="scope-table-wrap">
              <table className="scope-table">
                <thead>
                  <tr>
                    <th>探针</th>
                    <th>当前</th>
                    <th>均值</th>
                    <th>P95</th>
                    <th>抖动</th>
                    <th>丢包</th>
                  </tr>
                </thead>
                <tbody>
                  {indexedVisible.map(({ probe, origIdx }) => (
                    <tr key={probe.id}>
                      <td>
                        <span className="scope-tbl-probe">
                          <i className="scope-probe-dot" style={{ background: SLOT_COLORS[origIdx % SLOT_COLORS.length] }} />
                          {probe.name}
                        </span>
                      </td>
                      <td>{online ? formatMs(probe.latest) : '--'}</td>
                      <td>{online ? formatMs(probe.avg) : '--'}</td>
                      <td>{online ? formatMs(probe.p95) : '--'}</td>
                      <td>{online && probe.jitter !== null ? `±${probe.jitter}` : '--'}</td>
                      <td>{online ? `${probe.loss}%` : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="scope-svg-wrap" onMouseLeave={() => setHoverIdx(null)}>
              <svg viewBox={`0 0 ${w} ${h}`} className="scope-svg" role="img" aria-label={`${nodeName} 延迟历史曲线`}>
                {yTicks.map((tick) => {
                  const y = yFor(tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={pad.left}
                        y1={y}
                        x2={w - pad.right}
                        y2={y}
                        stroke="currentColor"
                        strokeOpacity={tick === 0 ? 0.16 : 0.08}
                        strokeWidth={1}
                        strokeDasharray={tick === 0 ? undefined : '2 3'}
                      />
                      <text
                        x={pad.left - 6}
                        y={y + 3}
                        textAnchor="end"
                        fill="currentColor"
                        fillOpacity={0.48}
                        fontSize={9}
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      >
                        {tick}
                      </text>
                    </g>
                  );
                })}

                {maxLen > 0 && (
                  <>
                    {indexedVisible.map(({ probe, origIdx }) => {
                      const color = SLOT_COLORS[origIdx % SLOT_COLORS.length];
                      const dash = SLOT_DASHES[origIdx % SLOT_DASHES.length];
                      const vals = probe.points.map((pt) => pt.value);
                      const pathD = buildSegmentedPath(vals, xFor, yFor);
                      const lastValidIdx = vals.reduce<number>((acc, v, idx) => (v !== null && v > 0 ? idx : acc), -1);

                      return (
                        <g key={probe.id}>
                          {pathD && (
                            <path
                              d={pathD}
                              fill="none"
                              stroke={color}
                              strokeWidth={origIdx === 0 ? 2 : 1.75}
                              strokeDasharray={dash}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                          )}
                          {/* Packet loss baseline markers */}
                          {online &&
                            probe.points.map((pt, i) =>
                              pt.value === null ? (
                                <circle
                                  key={`loss-${probe.id}-${i}`}
                                  cx={xFor(i)}
                                  cy={pad.top + plotH - 2}
                                  r={2.6}
                                  fill="var(--studio-bg, #0c1017)"
                                  stroke="#ef4444"
                                  strokeWidth={1.4}
                                />
                              ) : null,
                            )}
                          {lastValidIdx >= 0 && vals[lastValidIdx] !== null && (
                            <circle
                              cx={xFor(lastValidIdx)}
                              cy={yFor(vals[lastValidIdx]!)}
                              r={3.2}
                              fill={color}
                              stroke="var(--studio-bg, #0c1017)"
                              strokeWidth={1.2}
                            />
                          )}
                        </g>
                      );
                    })}

                    {/* X-axis timestamps */}
                    {[0, Math.floor((maxLen - 1) / 2), maxLen - 1].map((idx) => (
                      <text
                        key={idx}
                        x={xFor(idx)}
                        y={h - 5}
                        textAnchor={idx === 0 ? 'start' : idx === maxLen - 1 ? 'end' : 'middle'}
                        fill="currentColor"
                        fillOpacity={0.48}
                        fontSize={9}
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      >
                        {refTimeline[idx]?.time ?? ''}
                      </text>
                    ))}

                    {/* Hover crosshair */}
                    {hoverIdx !== null && (
                      <g>
                        <line
                          x1={xFor(hoverIdx)}
                          y1={pad.top}
                          x2={xFor(hoverIdx)}
                          y2={pad.top + plotH}
                          stroke="currentColor"
                          strokeOpacity={0.3}
                          strokeWidth={1}
                          strokeDasharray="2 2"
                        />
                        {indexedVisible.map(({ probe, origIdx }) => {
                          const v = probe.points[hoverIdx]?.value;
                          if (v === null || v === undefined || v <= 0) return null;
                          return (
                            <circle
                              key={`hov-${probe.id}`}
                              cx={xFor(hoverIdx)}
                              cy={yFor(v)}
                              r={4}
                              fill={SLOT_COLORS[origIdx % SLOT_COLORS.length]}
                              stroke="var(--studio-bg, #0c1017)"
                              strokeWidth={1.5}
                            />
                          );
                        })}
                      </g>
                    )}

                    {/* Wide interactive hover hit bands */}
                    {Array.from({ length: maxLen }).map((_, i) => {
                      const bandW = plotW / maxLen;
                      const bx = Math.max(pad.left, xFor(i) - bandW / 2);
                      return (
                        <rect
                          key={`hit-${i}`}
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

              {hoverIdx !== null && (
                <div className="scope-tooltip is-multi">
                  <span className="scope-tip-time">{hoverTime ?? '--'}</span>
                  <div className="scope-tip-vals">
                    {indexedVisible.map(({ probe, origIdx }) => {
                      const val = probe.points[hoverIdx]?.value;
                      const shortName = probe.name.length > 7 ? probe.name.slice(0, 7) : probe.name;
                      return (
                        <span key={probe.id} className="scope-tip-item">
                          <i
                            className="scope-probe-dot"
                            style={{ background: SLOT_COLORS[origIdx % SLOT_COLORS.length] }}
                          />
                          <span>{shortName}</span>
                          <strong>{val !== null && val !== undefined && val > 0 ? formatMs(val) : '丢包'}</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LoadScopeCard({
  points,
  nodeName,
  online,
  recordHours,
  isLiveMode,
}: {
  points: TelemetryPoint[];
  nodeName: string;
  online: boolean;
  recordHours: RecordHours;
  isLiveMode: boolean;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const w = 340;
  const h = 138;
  const pad = { top: 12, right: 34, bottom: 22, left: 30 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const count = Math.max(2, points.length);
  const xFor = (i: number) => pad.left + (i / (count - 1)) * plotW;
  const yFor = (val: number) => pad.top + plotH - (Math.max(0, Math.min(100, val)) / 100) * plotH;

  const cpuPath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yFor(pt.cpu).toFixed(1)}`)
    .join(' ');
  const ramPath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yFor(pt.ram).toFixed(1)}`)
    .join(' ');

  const last = points[points.length - 1];
  const activePt = hoverIdx !== null ? points[hoverIdx] : null;
  const cpuColor = SLOT_COLORS[0];
  const ramColor = SLOT_COLORS[1];

  return (
    <div className="scope-card">
      <div className="scope-top">
        <div>
          <h4 className="scope-title">CPU 与内存负载</h4>
          <p className="scope-sub">
            {isLiveMode ? `Live ${recordHours}H` : `Demo ${recordHours}H`} · 0–100%
          </p>
        </div>
        <div className="scope-tools">
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
          <i className="scope-swatch" style={{ background: cpuColor }} />
          <span>CPU</span>
          <strong>{online && last ? `${last.cpu}%` : '--'}</strong>
        </span>
        <span className="scope-leg-item">
          <i className="scope-swatch is-dashed" style={{ color: ramColor }} />
          <span>RAM</span>
          <strong>{online && last ? `${last.ram}%` : '--'}</strong>
        </span>
        {last?.load1 !== undefined && online && (
          <span className="scope-leg-item scope-leg-right">
            <span>Load</span>
            <strong>{last.load1.toFixed(2)}</strong>
          </span>
        )}
      </div>

      {showTable ? (
        <div className="scope-table-wrap">
          <table className="scope-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>CPU</th>
                <th>RAM</th>
                <th>1m 负载</th>
              </tr>
            </thead>
            <tbody>
              {points.slice(-6).reverse().map((pt, idx) => (
                <tr key={`${pt.time}-${idx}`}>
                  <td>{pt.time}</td>
                  <td>{pt.cpu}%</td>
                  <td>{pt.ram}%</td>
                  <td>{pt.load1 !== undefined ? pt.load1.toFixed(2) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-svg-wrap" onMouseLeave={() => setHoverIdx(null)}>
          <svg viewBox={`0 0 ${w} ${h}`} className="scope-svg" role="img" aria-label={`${nodeName} CPU 与内存负载曲线`}>
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
                    strokeOpacity={tick === 0 ? 0.16 : 0.08}
                    strokeWidth={1}
                    strokeDasharray={tick === 0 ? undefined : '2 3'}
                  />
                  <text
                    x={pad.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity={0.48}
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
                  stroke={ramColor}
                  strokeWidth={1.8}
                  strokeDasharray="5 2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <path
                  d={cpuPath}
                  fill="none"
                  stroke={cpuColor}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {last && (
                  <>
                    <circle
                      cx={xFor(points.length - 1)}
                      cy={yFor(last.cpu)}
                      r={3.4}
                      fill={cpuColor}
                      stroke="var(--studio-bg, #0c1017)"
                      strokeWidth={1.2}
                    />
                    <circle
                      cx={xFor(points.length - 1)}
                      cy={yFor(last.ram)}
                      r={3.4}
                      fill={ramColor}
                      stroke="var(--studio-bg, #0c1017)"
                      strokeWidth={1.2}
                    />
                    <text
                      x={w - pad.right + 5}
                      y={yFor(last.cpu) + 3}
                      fill="currentColor"
                      fillOpacity={0.9}
                      fontSize={9}
                      fontWeight={600}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    >
                      {last.cpu}%
                    </text>
                    {Math.abs(yFor(last.ram) - yFor(last.cpu)) > 12 && (
                      <text
                        x={w - pad.right + 5}
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
                    fillOpacity={0.48}
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
                      strokeOpacity={0.3}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={xFor(hoverIdx)}
                      cy={yFor(activePt.cpu)}
                      r={4}
                      fill={cpuColor}
                      stroke="var(--studio-bg, #0c1017)"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={xFor(hoverIdx)}
                      cy={yFor(activePt.ram)}
                      r={4}
                      fill={ramColor}
                      stroke="var(--studio-bg, #0c1017)"
                      strokeWidth={1.5}
                    />
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
              {activePt.load1 !== undefined && <span>Load {activePt.load1.toFixed(2)}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThroughputScopeCard({
  points,
  nodeName,
  online,
  recordHours,
  isLiveMode,
  liveNetDown,
  liveNetUp,
}: {
  points: TelemetryPoint[];
  nodeName: string;
  online: boolean;
  recordHours: RecordHours;
  isLiveMode: boolean;
  liveNetDown: number;
  liveNetUp: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const hasNetData = useMemo(
    () => points.some((p) => (p.netDown ?? 0) > 0 || (p.netUp ?? 0) > 0),
    [points],
  );

  const rawMaxBps = useMemo(() => {
    const peak = Math.max(
      1024,
      liveNetDown,
      liveNetUp,
      ...points.map((p) => Math.max(p.netDown ?? 0, p.netUp ?? 0)),
    );
    return peak;
  }, [points, liveNetDown, liveNetUp]);

  // Single adaptive throughput unit for the entire Y-axis
  const unitInfo = useMemo(() => {
    if (rawMaxBps >= 1024 * 1024 * 1024) {
      return { div: 1024 * 1024 * 1024, unit: 'GB/s' };
    }
    if (rawMaxBps >= 1024 * 1024) {
      return { div: 1024 * 1024, unit: 'MB/s' };
    }
    return { div: 1024, unit: 'KB/s' };
  }, [rawMaxBps]);

  const yMaxUnit = niceCeiling((rawMaxBps / unitInfo.div) * 1.15, 1);
  const yMaxBps = yMaxUnit * unitInfo.div;
  const yTicks = [0, yMaxUnit / 2, yMaxUnit];

  const formatTick = (v: number) => (v === 0 ? '0' : v >= 10 ? String(Math.round(v)) : v.toFixed(1));

  const w = 340;
  const h = 134;
  const pad = { top: 12, right: 14, bottom: 22, left: 38 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const count = Math.max(2, points.length);
  const xFor = (i: number) => pad.left + (i / (count - 1)) * plotW;
  const yForBps = (bps: number) =>
    pad.top + plotH - (Math.max(0, Math.min(yMaxBps, bps)) / yMaxBps) * plotH;

  const rxPath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yForBps(pt.netDown ?? 0).toFixed(1)}`)
    .join(' ');
  const txPath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yForBps(pt.netUp ?? 0).toFixed(1)}`)
    .join(' ');

  const rxColor = SLOT_COLORS[2];
  const txColor = SLOT_COLORS[3];
  const activePt = hoverIdx !== null ? points[hoverIdx] : null;
  const peakDown = Math.max(liveNetDown, ...points.map((p) => p.netDown ?? 0));

  return (
    <div className="scope-card">
      <div className="scope-top">
        <div>
          <h4 className="scope-title">网络吞吐曲线</h4>
          <p className="scope-sub">
            {isLiveMode ? `Live ${recordHours}H` : `Demo ${recordHours}H`} · {unitInfo.unit}
          </p>
        </div>
        <div className="scope-tools">
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
          <i className="scope-swatch" style={{ background: rxColor }} />
          <span>下行</span>
          <strong>{online ? formatNetSpeed(liveNetDown) : '0 B/s'}</strong>
        </span>
        <span className="scope-leg-item">
          <i className="scope-swatch is-dashed" style={{ color: txColor }} />
          <span>上行</span>
          <strong>{online ? formatNetSpeed(liveNetUp) : '0 B/s'}</strong>
        </span>
        <span className="scope-leg-item scope-leg-right">
          <span>峰值</span>
          <strong>{online ? formatNetSpeed(peakDown, true) : '--'}</strong>
        </span>
      </div>

      {!hasNetData && !online ? (
        <div className="scope-empty">
          <strong>暂无吞吐历史</strong>
          <span>节点处于离线状态，恢复上线后自动记录实时带宽。</span>
        </div>
      ) : showTable ? (
        <div className="scope-table-wrap">
          <table className="scope-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>下行 Rx</th>
                <th>上行 Tx</th>
              </tr>
            </thead>
            <tbody>
              {points.slice(-6).reverse().map((pt, idx) => (
                <tr key={`${pt.time}-${idx}`}>
                  <td>{pt.time}</td>
                  <td>{formatNetSpeed(pt.netDown ?? 0)}</td>
                  <td>{formatNetSpeed(pt.netUp ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-svg-wrap" onMouseLeave={() => setHoverIdx(null)}>
          <svg viewBox={`0 0 ${w} ${h}`} className="scope-svg" role="img" aria-label={`${nodeName} 网络吞吐曲线`}>
            {yTicks.map((tick) => {
              const y = yForBps(tick * unitInfo.div);
              return (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={w - pad.right}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={tick === 0 ? 0.16 : 0.08}
                    strokeWidth={1}
                    strokeDasharray={tick === 0 ? undefined : '2 3'}
                  />
                  <text
                    x={pad.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="currentColor"
                    fillOpacity={0.48}
                    fontSize={9}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {formatTick(tick)}
                  </text>
                </g>
              );
            })}

            {points.length > 0 && (
              <>
                <path
                  d={txPath}
                  fill="none"
                  stroke={txColor}
                  strokeWidth={1.75}
                  strokeDasharray="5 2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <path
                  d={rxPath}
                  fill="none"
                  stroke={rxColor}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                <circle
                  cx={xFor(points.length - 1)}
                  cy={yForBps(points[points.length - 1].netDown ?? 0)}
                  r={3.2}
                  fill={rxColor}
                  stroke="var(--studio-bg, #0c1017)"
                  strokeWidth={1.2}
                />
                <circle
                  cx={xFor(points.length - 1)}
                  cy={yForBps(points[points.length - 1].netUp ?? 0)}
                  r={3.2}
                  fill={txColor}
                  stroke="var(--studio-bg, #0c1017)"
                  strokeWidth={1.2}
                />

                {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((idx) => (
                  <text
                    key={idx}
                    x={xFor(idx)}
                    y={h - 5}
                    textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
                    fill="currentColor"
                    fillOpacity={0.48}
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
                      strokeOpacity={0.3}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={xFor(hoverIdx)}
                      cy={yForBps(activePt.netDown ?? 0)}
                      r={4}
                      fill={rxColor}
                      stroke="var(--studio-bg, #0c1017)"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={xFor(hoverIdx)}
                      cy={yForBps(activePt.netUp ?? 0)}
                      r={4}
                      fill={txColor}
                      stroke="var(--studio-bg, #0c1017)"
                      strokeWidth={1.5}
                    />
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
              <span>↓ {formatNetSpeed(activePt.netDown ?? 0)}</span>
              <span>↑ {formatNetSpeed(activePt.netUp ?? 0)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TelemetryScope({
  points,
  pingProbes,
  nodeName,
  online,
  recordHours,
  isLiveMode,
  liveNetDown,
  liveNetUp,
}: TelemetryScopeProps) {
  return (
    <div className="scope-stack">
      <LatencyScopeCard
        pingProbes={pingProbes}
        fallbackPoints={points}
        nodeName={nodeName}
        online={online}
        recordHours={recordHours}
        isLiveMode={isLiveMode}
      />
      <LoadScopeCard
        points={points}
        nodeName={nodeName}
        online={online}
        recordHours={recordHours}
        isLiveMode={isLiveMode}
      />
      <ThroughputScopeCard
        points={points}
        nodeName={nodeName}
        online={online}
        recordHours={recordHours}
        isLiveMode={isLiveMode}
        liveNetDown={liveNetDown}
        liveNetUp={liveNetUp}
      />
    </div>
  );
}
