import type { KomariPublicInfo, NodeInfo, RecordHours, TelemetryPoint } from '@/types/rack';

interface ApiEnvelope<T> {
  status?: string;
  message?: string;
  data?: T;
}

export interface KomariRawNode {
  uuid: string;
  name?: string;
  region?: string;
  group?: string;
  tags?: string;
  os?: string;
  kernel_version?: string;
  arch?: string;
  virtualization?: string;
  cpu_name?: string;
  cpu_cores?: number;
  gpu_name?: string;
  mem_total?: number;
  swap_total?: number;
  disk_total?: number;
  weight?: number;
}

export interface KomariLiveEntry {
  cpu?: { usage?: number };
  ram?: { total?: number; used?: number };
  swap?: { total?: number; used?: number };
  load?: { load1?: number; load5?: number; load15?: number };
  disk?: { total?: number; used?: number };
  network?: { up?: number; down?: number; totalUp?: number; totalDown?: number };
  connections?: { tcp?: number; udp?: number };
  uptime?: number;
  process?: number;
  message?: string;
  updated_at?: string;
}

export interface KomariClientsSnapshot {
  online: string[];
  data: Record<string, KomariLiveEntry>;
}

interface RawLoadRecord {
  time?: string | number;
  updated_at?: string | number;
  cpu?: number;
  ram?: number;
  ram_total?: number;
  load?: number;
}

interface RawPingRecord {
  time?: string | number;
  updated_at?: string | number;
  value?: number;
  ping?: number;
  latency?: number;
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let normalized = trimmed.replace(/\/+$/, '');
  if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, -4);
  }
  return normalized;
}

export function buildApiUrl(baseUrl: string, path: string): string {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return cleanBase ? `${cleanBase}${cleanPath}` : cleanPath;
}

export function buildWsUrl(baseUrl: string, path = '/api/clients'): string {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanBase) {
    if (cleanBase.startsWith('https://')) {
      return `wss://${cleanBase.slice('https://'.length)}${cleanPath}`;
    }
    if (cleanBase.startsWith('http://')) {
      return `ws://${cleanBase.slice('http://'.length)}${cleanPath}`;
    }
    if (cleanBase.startsWith('ws://') || cleanBase.startsWith('wss://')) {
      return `${cleanBase}${cleanPath}`;
    }
    return `https://${cleanBase}${cleanPath}`.replace(/^https:\/\//, 'wss://');
  }
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : '127.0.0.1:5173';
  return `${proto}//${host}${cleanPath}`;
}

export function regionToFlag(region?: string): string {
  const raw = (region ?? '').trim();
  if (!raw) return '🌐';
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const upper = raw.toUpperCase();
    const codePoints = [...upper].map((ch) => 127397 + ch.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
  return raw;
}

export function formatUptimeSeconds(seconds?: number): string {
  if (!seconds || seconds <= 0) return 'OFFLINE';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  return `${Math.max(1, mins)}m`;
}

function unwrapEnvelope<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const env = payload as ApiEnvelope<T>;
    if (env.status && env.status !== 'success' && env.status !== 'ok') {
      throw new Error(env.message || `Komari API returned status: ${env.status}`);
    }
    if (env.data !== undefined) {
      return env.data;
    }
  }
  return payload as T;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    signal,
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`HTTP ${res.status}（目标站点可能已开启私密模式或未开放跨域读取）`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as unknown;
  return unwrapEnvelope<T>(json);
}

export async function fetchKomariPublic(baseUrl: string, signal?: AbortSignal): Promise<KomariPublicInfo> {
  const data = await fetchJson<Partial<KomariPublicInfo>>(buildApiUrl(baseUrl, '/api/public'), signal);
  return {
    sitename: data?.sitename || 'Komari Monitor',
    description: data?.description || '',
    allow_cors: Boolean(data?.allow_cors),
    private_site: Boolean(data?.private_site),
    record_enabled: data?.record_enabled !== false,
    record_preserve_time: data?.record_preserve_time,
    ping_record_preserve_time: data?.ping_record_preserve_time,
    theme: data?.theme,
    theme_settings: data?.theme_settings,
  };
}

export async function fetchKomariNodes(baseUrl: string, signal?: AbortSignal): Promise<NodeInfo[]> {
  const raw = await fetchJson<KomariRawNode[]>(buildApiUrl(baseUrl, '/api/nodes'), signal);
  const list = Array.isArray(raw) ? raw : [];
  return list
    .slice()
    .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0))
    .map((n): NodeInfo => {
      const firstTag = (n.tags ?? '')
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean)[0];
      return {
        uuid: n.uuid,
        name: n.name || n.uuid.slice(0, 8),
        region: regionToFlag(n.region),
        group: n.group || '默认分组',
        tags: n.tags || '',
        cpu_cores: Math.max(1, Number(n.cpu_cores) || 1),
        mem_total: Math.max(256 * 1024 ** 2, Number(n.mem_total) || 1024 ** 3),
        disk_total: Math.max(1024 ** 3, Number(n.disk_total) || 20 * 1024 ** 3),
        os: n.os || 'Linux',
        cpu_name: n.cpu_name || 'Unknown CPU',
        arch: n.arch,
        virtualization: n.virtualization,
        tag: firstTag || (n.group ? n.group.slice(0, 12) : 'KOMARI-NODE'),
        online: false,
        cpu: 0,
        ram: 0,
        disk: 0,
        netUp: 0,
        netDown: 0,
        ping: 0,
        uptime: 'WAITING',
      };
    });
}

export function parseClientsMessage(raw: unknown): KomariClientsSnapshot | null {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const payload = unwrapEnvelope<Partial<KomariClientsSnapshot>>(parsed);
    if (!payload || typeof payload !== 'object') return null;
    const online = Array.isArray(payload.online) ? payload.online.map(String) : [];
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
    return { online, data };
  } catch {
    return null;
  }
}

export function applyClientsSnapshot(nodes: NodeInfo[], snapshot: KomariClientsSnapshot): NodeInfo[] {
  const onlineSet = new Set(snapshot.online);
  return nodes.map((node) => {
    const entry = snapshot.data[node.uuid];
    const isOnline = onlineSet.has(node.uuid);
    if (!entry) {
      return isOnline
        ? { ...node, online: true }
        : { ...node, online: false, cpu: 0, ram: 0, netUp: 0, netDown: 0, uptime: 'OFFLINE' };
    }

    const cpuRaw = Number(entry.cpu?.usage ?? 0);
    const cpu = isOnline ? Math.max(0, Math.min(100, Math.round(cpuRaw))) : 0;

    const ramTotal = Number(entry.ram?.total || node.mem_total || 1);
    const ramUsed = Number(entry.ram?.used ?? 0);
    const ram = isOnline && ramTotal > 0 ? Math.max(0, Math.min(100, Math.round((ramUsed / ramTotal) * 100))) : 0;

    const diskTotal = Number(entry.disk?.total || node.disk_total || 1);
    const diskUsed = Number(entry.disk?.used ?? 0);
    const disk = diskTotal > 0 ? Math.max(0, Math.min(100, Math.round((diskUsed / diskTotal) * 100))) : node.disk;

    // Komari network.up / network.down are reported in bytes/sec -> convert to Mbps
    const netUpMbps = isOnline ? Number((((Number(entry.network?.up ?? 0) * 8) / 1_000_000)).toFixed(1)) : 0;
    const netDownMbps = isOnline ? Number((((Number(entry.network?.down ?? 0) * 8) / 1_000_000)).toFixed(1)) : 0;

    return {
      ...node,
      online: isOnline,
      cpu,
      ram,
      disk,
      netUp: netUpMbps,
      netDown: netDownMbps,
      totalUp: entry.network?.totalUp,
      totalDown: entry.network?.totalDown,
      load1: entry.load?.load1,
      tcp: entry.connections?.tcp,
      udp: entry.connections?.udp,
      uptime: isOnline ? formatUptimeSeconds(entry.uptime) : 'OFFLINE',
      updatedAt: entry.updated_at,
    };
  });
}

function formatShortTime(ts: string | number | undefined): string {
  if (!ts) return '--:--';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts).slice(-5);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function extractArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.records)) return obj.records as T[];
    if (Array.isArray(obj.list)) return obj.list as T[];
  }
  return [];
}

function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const result: T[] = [];
  const step = (arr.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  return result;
}

export async function fetchNodeTelemetryRecords(
  baseUrl: string,
  node: NodeInfo,
  hours: RecordHours,
  signal?: AbortSignal,
): Promise<{ points: TelemetryPoint[]; latestPing: number | null }> {
  const loadUrl = buildApiUrl(baseUrl, `/api/records/load?uuid=${encodeURIComponent(node.uuid)}&hours=${hours}`);
  const pingUrl = buildApiUrl(baseUrl, `/api/records/ping?uuid=${encodeURIComponent(node.uuid)}&hours=${hours}`);

  const [loadRes, pingRes] = await Promise.allSettled([
    fetchJson<unknown>(loadUrl, signal),
    fetchJson<unknown>(pingUrl, signal),
  ]);

  const rawLoads = loadRes.status === 'fulfilled' ? extractArray<RawLoadRecord>(loadRes.value) : [];
  const rawPings = pingRes.status === 'fulfilled' ? extractArray<RawPingRecord>(pingRes.value) : [];

  const validPings = rawPings
    .map((p) => Number(p.value ?? p.ping ?? p.latency ?? -1))
    .filter((v) => Number.isFinite(v) && v > 0);
  const latestPing = validPings.length > 0 ? Math.round(validPings[validPings.length - 1]) : null;

  if (rawLoads.length === 0) {
    return { points: [], latestPing };
  }

  const sampledLoads = downsample(rawLoads, 24);
  const sampledPings = downsample(validPings, sampledLoads.length);

  const points: TelemetryPoint[] = sampledLoads.map((rec, i) => {
    const cpu = Math.max(0, Math.min(100, Math.round(Number(rec.cpu ?? 0))));
    const rawRam = Number(rec.ram ?? 0);
    const totalMem = Number(rec.ram_total || node.mem_total || 1);
    const ramPct = rawRam > 100 && totalMem > 0 ? (rawRam / totalMem) * 100 : rawRam;
    const ram = Math.max(0, Math.min(100, Math.round(ramPct)));
    const ping = sampledPings[i] !== undefined ? Math.round(sampledPings[i]) : latestPing ?? node.ping;
    return {
      time: formatShortTime(rec.time ?? rec.updated_at),
      cpu,
      ram,
      ping,
    };
  });

  return { points, latestPing };
}

export interface KomariWsHandle {
  close: () => void;
  requestNow: () => void;
}

export function openKomariClientsSocket(
  baseUrl: string,
  callbacks: {
    onOpen?: () => void;
    onSnapshot: (snap: KomariClientsSnapshot) => void;
    onError?: (reason: string) => void;
    onClose?: () => void;
  },
): KomariWsHandle {
  let closed = false;
  let ws: WebSocket | null = null;
  let pollTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let attempt = 0;

  const clearTimers = () => {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const sendGet = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send('get');
      } catch {
        // ignore transient send errors
      }
    }
  };

  const connect = () => {
    if (closed) return;
    clearTimers();
    try {
      ws = new WebSocket(buildWsUrl(baseUrl, '/api/clients'));
    } catch (err) {
      callbacks.onError?.(err instanceof Error ? err.message : 'WebSocket 初始化失败');
      return;
    }

    ws.onopen = () => {
      attempt = 0;
      callbacks.onOpen?.();
      sendGet();
      pollTimer = window.setInterval(sendGet, 2500);
    };

    ws.onmessage = (event) => {
      const snap = parseClientsMessage(event.data);
      if (snap) {
        callbacks.onSnapshot(snap);
      }
    };

    ws.onerror = () => {
      callbacks.onError?.('WebSocket /api/clients 连接异常，正在尝试重连');
    };

    ws.onclose = () => {
      clearTimers();
      callbacks.onClose?.();
      if (!closed) {
        attempt += 1;
        const delay = Math.min(15000, 1500 * Math.pow(1.6, Math.min(attempt, 5)));
        reconnectTimer = window.setTimeout(connect, delay);
      }
    };
  };

  connect();

  return {
    close: () => {
      closed = true;
      clearTimers();
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          // ignore
        }
        ws = null;
      }
    },
    requestNow: sendGet,
  };
}
