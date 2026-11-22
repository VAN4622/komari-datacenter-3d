/**
 * Adaptive telemetry formatting utilities.
 * Canonical network speed unit across the app is Bytes/sec (B/s),
 * matching Komari's native `network.up` / `network.down` WebSocket fields.
 */

export function formatNetSpeed(bytesPerSec: number, compact = false): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) {
    return compact ? '0B' : '0 B/s';
  }

  const v = bytesPerSec;
  if (v < 1024) {
    const rounded = Math.max(1, Math.round(v));
    return compact ? `${rounded}B` : `${rounded} B/s`;
  }

  const kb = v / 1024;
  if (kb < 1024) {
    const str = kb < 10 ? kb.toFixed(1) : kb < 100 ? kb.toFixed(1) : String(Math.round(kb));
    return compact ? `${str}K` : `${str} KB/s`;
  }

  const mb = kb / 1024;
  if (mb < 1024) {
    const str = mb < 10 ? mb.toFixed(compact ? 1 : 2) : mb < 100 ? mb.toFixed(1) : String(Math.round(mb));
    return compact ? `${str}M` : `${str} MB/s`;
  }

  const gb = mb / 1024;
  const str = gb < 10 ? gb.toFixed(compact ? 1 : 2) : gb.toFixed(1);
  return compact ? `${str}G` : `${str} GB/s`;
}

export function formatTrafficBytes(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '--';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  const decimals = idx === 0 ? 0 : val < 10 ? 2 : val < 100 ? 1 : 0;
  return `${val.toFixed(decimals)} ${units[idx]}`;
}
