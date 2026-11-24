import type {
  CabinetThemePreference,
  KomariMeInfo,
  KomariPublicInfo,
  KomariThemeSettings,
  NodeInfo,
  NodeTelemetryBundle,
  PingProbeSample,
  PingProbeSeries,
  RackViewAngle,
  RecordHours,
  RoomAtmosphere,
  StageViewMode,
  TelemetryPoint,
} from '@/types/rack';

interface ApiEnvelope<T> {
  status?: string;
  message?: string;
  data?: T;
}

export type KomariErrorCode = 'auth' | 'cors' | 'mixed_content' | 'http' | 'network' | 'invalid';

export class KomariApiError extends Error {
  readonly code: KomariErrorCode;
  readonly status?: number;

  constructor(message: string, code: KomariErrorCode, status?: number) {
    super(message);
    this.name = 'KomariApiError';
    this.code = code;
    this.status = status;
  }
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
  traffic_limit?: number;
  traffic_limit_type?: string;
  expired_at?: string;
  weight?: number;
}

export interface KomariLiveEntry {
  cpu?: { usage?: number } | number;
  ram?: { total?: number; used?: number };
  swap?: { total?: number; used?: number };
  load?: { load1?: number; load5?: number; load15?: number } | number;
  disk?: { total?: number; used?: number };
  network?: {
    up?: number;
    down?: number;
    up_speed?: number;
    down_speed?: number;
    tx?: number;
    rx?: number;
    out?: number;
    in?: number;
    upload?: number;
    download?: number;
    totalUp?: number;
    totalDown?: number;
    total_up?: number;
    total_down?: number;
    total_tx?: number;
    total_rx?: number;
  };
  net_in?: number;
  net_out?: number;
  net_down?: number;
  net_up?: number;
  net_total_down?: number;
  net_total_up?: number;
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
  swap?: number;
  swap_total?: number;
  load?: number;
  disk?: number;
  net_in?: number;
  net_out?: number;
  net_down?: number;
  net_up?: number;
  connections?: number;
  connections_udp?: number;
  process?: number;
}

interface RawPingRecord {
  time?: string | number;
  updated_at?: string | number;
  value?: number;
  ping?: number;
  latency?: number;
  task_id?: number;
}

interface RawPingTask {
  id?: number;
  name?: string;
  interval?: number;
  min?: number;
  max?: number;
  avg?: number;
  loss?: number;
  latest?: number;
  total?: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

function isLocalOrIpHost(hostPort: string): boolean {
  const host = hostPort.split('/')[0].split(':')[0].toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || host.endsWith('.local')) {
    return true;
  }
  // Private IPv4 ranges & raw IPv4 addresses
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return true;
  }
  return false;
}

/**
 * Normalizes a user-supplied Komari server URL:
 * - Empty string -> '' (same-origin /api)
 * - Relative proxy prefix like '/komari' -> '/komari'
 * - ws:// / wss:// -> http:// / https://
 * - Bare hostname like 'status.example.com' -> 'https://status.example.com'
 * - Bare local/IP host like '192.168.1.5:25774' -> 'http://192.168.1.5:25774'
 * - Strips trailing slashes and trailing '/api'
 */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  let normalized = trimmed.replace(/\/+$/, '');
  normalized = normalized.replace(/\/api(?:\/(?:clients|nodes|public))?$/i, '').replace(/\/+$/, '');
  if (!normalized || normalized === '/') return '';

  // Relative proxy path (e.g. '/komari')
  if (normalized.startsWith('/') && !normalized.startsWith('//')) {
    return normalized;
  }

  // Protocol-relative URL (e.g. '//status.example.com')
  if (normalized.startsWith('//')) {
    const proto = typeof window !== 'undefined' && window.location.protocol === 'http:' ? 'http:' : 'https:';
    normalized = `${proto}${normalized}`;
  } else if (/^wss:\/\//i.test(normalized)) {
    normalized = `https://${normalized.slice(6)}`;
  } else if (/^ws:\/\//i.test(normalized)) {
    normalized = `http://${normalized.slice(5)}`;
  } else if (!/^https?:\/\//i.test(normalized)) {
    const scheme = isLocalOrIpHost(normalized) ? 'http://' : 'https://';
    normalized = `${scheme}${normalized}`;
  }

  return normalized.replace(/\/+$/, '');
}

export function isSameOriginTarget(baseUrl: string): boolean {
  const cleanBase = normalizeBaseUrl(baseUrl);
  if (!cleanBase || cleanBase.startsWith('/')) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URL(cleanBase).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function buildApiUrl(baseUrl: string, path: string): string {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return cleanBase ? `${cleanBase}${cleanPath}` : cleanPath;
}

export function buildAdminUrl(baseUrl: string): string {
  const cleanBase = normalizeBaseUrl(baseUrl);
  return cleanBase ? `${cleanBase}/admin` : '/admin';
}

export function buildWsUrl(baseUrl: string, path = '/api/clients'): string {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (cleanBase && !cleanBase.startsWith('/')) {
    if (/^https:\/\//i.test(cleanBase)) {
      return `wss://${cleanBase.slice('https://'.length)}${cleanPath}`;
    }
    if (/^http:\/\//i.test(cleanBase)) {
      return `ws://${cleanBase.slice('http://'.length)}${cleanPath}`;
    }
  }

  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : '127.0.0.1:5174';
  const prefix = cleanBase.startsWith('/') ? cleanBase : '';
  return `${proto}//${host}${prefix}${cleanPath}`;
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
      const msg = env.message || `Komari API 返回异常状态: ${env.status}`;
      if (/unauthor|forbidden|login|private|auth/i.test(msg)) {
        throw new KomariApiError(msg, 'auth');
      }
      throw new KomariApiError(msg, 'http');
    }
    if (env.data !== undefined) {
      return env.data;
    }
  }
  return payload as T;
}

function isMixedContentUrl(url: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:' && /^http:\/\//i.test(url);
}

async function fetchJson<T>(url: string, baseUrl: string, signal?: AbortSignal): Promise<T> {
  const sameOrigin = isSameOriginTarget(baseUrl);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // Same-origin requests include Komari session cookies so logged-in private_site works;
      // cross-origin requests omit credentials so Komari's `Access-Control-Allow-Origin: *` succeeds.
      credentials: sameOrigin ? 'same-origin' : 'omit',
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    if (isMixedContentUrl(url)) {
      throw new KomariApiError(
        '混合内容受阻：当前页面为 HTTPS，浏览器禁止直接请求 HTTP 接口，请改为 HTTPS 地址。',
        'mixed_content',
      );
    }
    if (!sameOrigin) {
      throw new KomariApiError(
        '跨域或网络受限：请确认目标 Komari 后台已开启 allow_cors（允许跨域），或将其作为同源主题部署。',
        'cors',
      );
    }
    throw new KomariApiError(
      err instanceof Error ? err.message : '网络请求失败，请检查服务端连通性。',
      'network',
    );
  }

  if (res.status === 401 || res.status === 403) {
    let backendMsg = '';
    try {
      const body = (await res.json()) as { message?: string };
      backendMsg = body?.message || '';
    } catch {
      // ignore non-json error body
    }
    throw new KomariApiError(
      backendMsg ||
        (sameOrigin
          ? `HTTP ${res.status}：站点已开启私密模式，请先前往 /admin 登录管理员账号。`
          : `HTTP ${res.status}：目标站点已开启私密模式（private_site），跨域访客无法拉取节点。`),
      'auth',
      res.status,
    );
  }

  if (!res.ok) {
    throw new KomariApiError(`HTTP ${res.status} ${res.statusText || ''}`.trim(), 'http', res.status);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType && !/json/i.test(contentType)) {
    throw new KomariApiError(
      '接口返回了非 JSON 内容（可能地址填写有误，或当前非 Komari 后端环境）。',
      'invalid',
      res.status,
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new KomariApiError('响应 JSON 解析失败，请确认填写的是 Komari 站点根地址。', 'invalid', res.status);
  }

  return unwrapEnvelope<T>(json);
}

export function parseKomariThemeSettings(raw?: Record<string, unknown>): KomariThemeSettings {
  if (!raw || typeof raw !== 'object') return {};

  const out: KomariThemeSettings = {};

  const atmo = raw.defaultAtmosphere;
  if (atmo === 'studio-dark' || atmo === 'studio-light') {
    out.defaultAtmosphere = atmo as RoomAtmosphere;
  } else if (atmo === 'cleanroom') {
    out.defaultAtmosphere = 'studio-light';
  } else if (atmo === 'cold-aisle' || atmo === 'obsidian-noc' || atmo === 'showroom') {
    out.defaultAtmosphere = 'studio-dark';
  }

  const angle = raw.defaultViewAngle;
  if (angle === 'side' || angle === 'front') {
    out.defaultViewAngle = angle as RackViewAngle;
  } else if (raw.defaultCameraPreset === 'front') {
    out.defaultViewAngle = 'front';
  }

  const stageView = raw.defaultStageView;
  if (stageView === 'rack' || stageView === 'map') {
    out.defaultStageView = stageView as StageViewMode;
  }

  const cabTheme = raw.defaultCabinetTheme;
  if (cabTheme === 'auto' || cabTheme === 'obsidian' || cabTheme === 'titanium' || cabTheme === 'silver') {
    out.defaultCabinetTheme = cabTheme as CabinetThemePreference;
  }

  if (typeof raw.showStatusStrip === 'boolean') {
    out.showStatusStrip = raw.showStatusStrip;
  } else if (raw.showStatusStrip === 'true' || raw.showStatusStrip === 'false') {
    out.showStatusStrip = raw.showStatusStrip === 'true';
  }

  if (typeof raw.compactRackWidth === 'boolean') {
    out.compactRackWidth = raw.compactRackWidth;
  } else if (raw.compactRackWidth === 'true' || raw.compactRackWidth === 'false') {
    out.compactRackWidth = raw.compactRackWidth === 'true';
  }

  if (typeof raw.enablePingPolling === 'boolean') {
    out.enablePingPolling = raw.enablePingPolling;
  } else if (raw.enablePingPolling === 'true' || raw.enablePingPolling === 'false') {
    out.enablePingPolling = raw.enablePingPolling === 'true';
  }

  const hoursNum = Number(raw.recordHours);
  if (hoursNum === 1 || hoursNum === 6 || hoursNum === 24) {
    out.recordHours = hoursNum as RecordHours;
  }

  if (typeof raw.showAdminLink === 'boolean') {
    out.showAdminLink = raw.showAdminLink;
  } else if (raw.showAdminLink === 'true' || raw.showAdminLink === 'false') {
    out.showAdminLink = raw.showAdminLink === 'true';
  }

  if (typeof raw.customHallTitle === 'string' && raw.customHallTitle.trim()) {
    out.customHallTitle = raw.customHallTitle.trim();
  }

  if (typeof raw.rackLayoutJson === 'string' && raw.rackLayoutJson.trim()) {
    out.rackLayoutJson = raw.rackLayoutJson.trim();
  }

  return out;
}

/**
 * Verifies whether the current browser session is logged into Komari as an administrator.
 * Only works on same-origin deployments (cross-origin requests cannot carry HttpOnly session cookies).
 */
export async function fetchKomariMe(baseUrl: string, signal?: AbortSignal): Promise<KomariMeInfo> {
  if (!isSameOriginTarget(baseUrl)) {
    return { loggedIn: false };
  }
  try {
    const res = await fetch(buildApiUrl(baseUrl, '/api/me'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal,
    });
    if (!res.ok) {
      return { loggedIn: false };
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType && !/json/i.test(contentType)) {
      return { loggedIn: false };
    }
    const raw = (await res.json()) as Record<string, unknown>;
    const unwrapped =
      raw && typeof raw === 'object' && 'data' in raw && raw.data && typeof raw.data === 'object'
        ? (raw.data as Record<string, unknown>)
        : raw;

    const loggedInFlag = unwrapped.logged_in ?? unwrapped.loggedIn ?? unwrapped.authenticated;
    const username = typeof unwrapped.username === 'string' ? unwrapped.username.trim() : '';
    const uuid = typeof unwrapped.uuid === 'string' ? unwrapped.uuid : undefined;
    const ssoType = typeof unwrapped.sso_type === 'string' ? unwrapped.sso_type : undefined;

    if (loggedInFlag === false) {
      return { loggedIn: false };
    }
    if (loggedInFlag === true || username.length > 0) {
      return {
        loggedIn: true,
        username: username || 'Admin',
        uuid,
        ssoType,
      };
    }
    return { loggedIn: false };
  } catch {
    return { loggedIn: false };
  }
}

export interface SaveThemeLayoutResult {
  ok: boolean;
  error?: string;
}

/**
 * Persists the serialized rack layout JSON to Komari's managed theme settings on the server
 * so every visitor sees the exact layout published by the administrator.
 * Requires an authenticated same-origin Komari admin session.
 */
export async function saveKomariThemeLayout(
  baseUrl: string,
  themeShort: string,
  existingThemeSettings: Record<string, unknown> | undefined,
  rackLayoutJson: string,
): Promise<SaveThemeLayoutResult> {
  if (!isSameOriginTarget(baseUrl)) {
    return { ok: false, error: '跨域远程连接无法写入服务端设置，请同源部署后登录后台保存。' };
  }

  const mergedSettings: Record<string, unknown> = {
    ...(existingThemeSettings ?? {}),
    rackLayoutJson,
  };

  // Komari official managed theme settings endpoints (across 0.x / 1.x releases)
  const candidates: Array<{ url: string; method: 'POST' | 'PUT'; body: unknown }> = [
    {
      url: buildApiUrl(baseUrl, `/api/admin/theme/settings?theme=${encodeURIComponent(themeShort)}`),
      method: 'POST',
      body: mergedSettings,
    },
    {
      url: buildApiUrl(baseUrl, '/api/admin/theme/settings'),
      method: 'POST',
      body: { theme: themeShort, settings: mergedSettings, ...mergedSettings },
    },
    {
      url: buildApiUrl(baseUrl, '/api/admin/settings'),
      method: 'POST',
      body: { theme_settings: mergedSettings },
    },
  ];

  let lastErr = '服务端未接受主题配置写入';
  for (const cand of candidates) {
    try {
      const res = await fetch(cand.url, {
        method: cand.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(cand.body),
      });

      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: '管理员登录状态已失效，请重新登录 /admin 后保存。' };
      }

      if (res.ok) {
        const text = await res.text();
        if (!text) return { ok: true };
        try {
          const parsed = JSON.parse(text) as { status?: string; message?: string };
          if (!parsed.status || parsed.status === 'success' || parsed.status === 'ok') {
            return { ok: true };
          }
          lastErr = parsed.message || `状态 ${parsed.status}`;
        } catch {
          return { ok: true };
        }
      } else {
        lastErr = `HTTP ${res.status}`;
      }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : '网络请求异常';
    }
  }

  return { ok: false, error: lastErr };
}

export async function fetchKomariPublic(baseUrl: string, signal?: AbortSignal): Promise<KomariPublicInfo> {
  const data = await fetchJson<Partial<KomariPublicInfo>>(buildApiUrl(baseUrl, '/api/public'), baseUrl, signal);
  if (!data || typeof data !== 'object') {
    throw new KomariApiError('/api/public 返回数据结构异常', 'invalid');
  }
  return {
    sitename: data.sitename || 'Komari Monitor',
    description: data.description || '',
    allow_cors: Boolean(data.allow_cors),
    private_site: Boolean(data.private_site),
    record_enabled: data.record_enabled !== false,
    record_preserve_time: data.record_preserve_time,
    ping_record_preserve_time: data.ping_record_preserve_time,
    theme: data.theme,
    theme_settings: data.theme_settings && typeof data.theme_settings === 'object' ? data.theme_settings : undefined,
    custom_head: typeof data.custom_head === 'string' ? data.custom_head : undefined,
    custom_body: typeof data.custom_body === 'string' ? data.custom_body : undefined,
  };
}

/**
 * Silently probes whether the current origin is a real Komari backend.
 * Returns KomariPublicInfo when deployed as a Komari theme / same-origin proxy,
 * or null on standalone dev servers (which return HTML or 404 for /api/public).
 */
export async function probeSameOriginKomari(signal?: AbortSignal): Promise<KomariPublicInfo | null> {
  try {
    const res = await fetch('/api/public', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal,
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!/json/i.test(contentType)) return null;
    const raw = (await res.json()) as unknown;
    const data = unwrapEnvelope<Partial<KomariPublicInfo>>(raw);
    if (!data || typeof data !== 'object') return null;
    // Confirm genuine Komari payload keys
    const looksLikeKomari =
      typeof data.sitename === 'string' ||
      typeof data.allow_cors === 'boolean' ||
      typeof data.private_site === 'boolean' ||
      typeof data.record_enabled === 'boolean';
    if (!looksLikeKomari) return null;

    return {
      sitename: data.sitename || 'Komari Monitor',
      description: data.description || '',
      allow_cors: Boolean(data.allow_cors),
      private_site: Boolean(data.private_site),
      record_enabled: data.record_enabled !== false,
      record_preserve_time: data.record_preserve_time,
      ping_record_preserve_time: data.ping_record_preserve_time,
      theme: data.theme,
      theme_settings: data.theme_settings && typeof data.theme_settings === 'object' ? data.theme_settings : undefined,
      custom_head: typeof data.custom_head === 'string' ? data.custom_head : undefined,
      custom_body: typeof data.custom_body === 'string' ? data.custom_body : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchKomariNodes(baseUrl: string, signal?: AbortSignal): Promise<NodeInfo[]> {
  const raw = await fetchJson<KomariRawNode[]>(buildApiUrl(baseUrl, '/api/nodes'), baseUrl, signal);
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
        swap_total: Number(n.swap_total) > 0 ? Number(n.swap_total) : 0,
        disk_total: Math.max(1024 ** 3, Number(n.disk_total) || 20 * 1024 ** 3),
        os: n.os || 'Linux',
        kernel_version: n.kernel_version || undefined,
        cpu_name: n.cpu_name || 'Unknown CPU',
        gpu_name: n.gpu_name && n.gpu_name.toLowerCase() !== 'none' ? n.gpu_name : undefined,
        arch: n.arch,
        virtualization: n.virtualization,
        trafficLimit: Number(n.traffic_limit) > 0 ? Number(n.traffic_limit) : undefined,
        trafficLimitType: n.traffic_limit_type || undefined,
        expiredAt: n.expired_at || undefined,
        tag: firstTag || (n.group ? n.group.slice(0, 12) : 'KOMARI-NODE'),
        online: false,
        cpu: 0,
        ram: 0,
        swap: 0,
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
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
    const online = Array.isArray(payload.online)
      ? payload.online.map(String)
      : payload.online === undefined
        ? Object.keys(data)
        : [];
    return { online, data };
  } catch {
    return null;
  }
}

const lastSampleAtByUuid = new Map<string, number>();

function firstFiniteNonNegative(...values: unknown[]): number | undefined {
  for (const v of values) {
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

export function applyClientsSnapshot(nodes: NodeInfo[], snapshot: KomariClientsSnapshot): NodeInfo[] {
  const onlineSet = new Set(snapshot.online);
  const nowMs = Date.now();
  return nodes.map((node) => {
    const entry = snapshot.data[node.uuid];
    const isOnline = onlineSet.has(node.uuid);
    if (!entry) {
      return isOnline
        ? { ...node, online: true }
        : { ...node, online: false, cpu: 0, ram: 0, netUp: 0, netDown: 0, uptime: 'OFFLINE' };
    }

    const cpuRaw =
      typeof entry.cpu === 'number' ? entry.cpu : Number(entry.cpu?.usage ?? 0);
    const cpu = isOnline ? Math.max(0, Math.min(100, Math.round(cpuRaw))) : 0;

    const ramTotal = Number(entry.ram?.total || node.mem_total || 1);
    const ramUsed = Number(entry.ram?.used ?? 0);
    const ram = isOnline && ramTotal > 0 ? Math.max(0, Math.min(100, Math.round((ramUsed / ramTotal) * 100))) : 0;

    const swapTotal = Number(entry.swap?.total ?? node.swap_total ?? 0);
    const swapUsed = Number(entry.swap?.used ?? 0);
    const swap =
      isOnline && swapTotal > 0 ? Math.max(0, Math.min(100, Math.round((swapUsed / swapTotal) * 100))) : 0;

    const diskTotal = Number(entry.disk?.total || node.disk_total || 1);
    const diskUsed = Number(entry.disk?.used ?? 0);
    const disk = diskTotal > 0 ? Math.max(0, Math.min(100, Math.round((diskUsed / diskTotal) * 100))) : node.disk;

    // Extract native Bytes/sec without premature Mbps truncation
    const netObj = entry.network;
    let rawUpBps =
      firstFiniteNonNegative(
        netObj?.up,
        netObj?.up_speed,
        netObj?.tx,
        netObj?.out,
        netObj?.upload,
        entry.net_out,
        entry.net_up,
      ) ?? 0;

    let rawDownBps =
      firstFiniteNonNegative(
        netObj?.down,
        netObj?.down_speed,
        netObj?.rx,
        netObj?.in,
        netObj?.download,
        entry.net_in,
        entry.net_down,
      ) ?? 0;

    const nextTotalUp = firstFiniteNonNegative(
      netObj?.totalUp,
      netObj?.total_up,
      netObj?.total_tx,
      entry.net_total_up,
    );
    const nextTotalDown = firstFiniteNonNegative(
      netObj?.totalDown,
      netObj?.total_down,
      netObj?.total_rx,
      entry.net_total_down,
    );

    // Fallback: if instant speed reported as 0 while cumulative traffic counters advanced, derive B/s from delta
    const prevSampleMs = lastSampleAtByUuid.get(node.uuid);
    let deltaSec = 0;
    if (entry.updated_at && node.updatedAt && entry.updated_at !== node.updatedAt) {
      const prevTs = Date.parse(node.updatedAt);
      const nextTs = Date.parse(entry.updated_at);
      if (Number.isFinite(prevTs) && Number.isFinite(nextTs) && nextTs > prevTs) {
        deltaSec = (nextTs - prevTs) / 1000;
      }
    }
    if (deltaSec <= 0 && prevSampleMs !== undefined && nowMs > prevSampleMs) {
      deltaSec = (nowMs - prevSampleMs) / 1000;
    }
    lastSampleAtByUuid.set(node.uuid, nowMs);

    if (isOnline && Number.isFinite(deltaSec) && deltaSec >= 0.5 && deltaSec <= 30) {
      if (rawUpBps === 0 && nextTotalUp !== undefined && node.totalUp !== undefined && nextTotalUp > node.totalUp) {
        rawUpBps = (nextTotalUp - node.totalUp) / deltaSec;
      }
      if (
        rawDownBps === 0 &&
        nextTotalDown !== undefined &&
        node.totalDown !== undefined &&
        nextTotalDown > node.totalDown
      ) {
        rawDownBps = (nextTotalDown - node.totalDown) / deltaSec;
      }
    }

    const load1Val = typeof entry.load === 'number' ? entry.load : entry.load?.load1;
    const load5Val = typeof entry.load === 'object' ? entry.load?.load5 : undefined;
    const load15Val = typeof entry.load === 'object' ? entry.load?.load15 : undefined;

    return {
      ...node,
      online: isOnline,
      cpu,
      ram,
      ramUsed: isOnline ? Math.max(0, ramUsed) : 0,
      mem_total: ramTotal > 0 ? ramTotal : node.mem_total,
      swap_total: swapTotal >= 0 ? swapTotal : node.swap_total,
      swap,
      swapUsed: isOnline ? Math.max(0, swapUsed) : 0,
      disk,
      diskUsed: diskUsed > 0 ? diskUsed : node.diskUsed,
      disk_total: diskTotal > 0 ? diskTotal : node.disk_total,
      netUp: isOnline ? Math.max(0, rawUpBps) : 0,
      netDown: isOnline ? Math.max(0, rawDownBps) : 0,
      totalUp: nextTotalUp ?? node.totalUp,
      totalDown: nextTotalDown ?? node.totalDown,
      load1: load1Val,
      load5: load5Val,
      load15: load15Val,
      tcp: entry.connections?.tcp,
      udp: entry.connections?.udp,
      process: typeof entry.process === 'number' && Number.isFinite(entry.process) ? entry.process : node.process,
      message: typeof entry.message === 'string' && entry.message.trim() ? entry.message.trim() : undefined,
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

function extractLatestPing(rawPings: RawPingRecord[]): number | null {
  let latestTs = -Infinity;
  let latestVal: number | null = null;
  let fallbackLast: number | null = null;

  for (const p of rawPings) {
    const val = Number(p.value ?? p.ping ?? p.latency ?? -1);
    if (!Number.isFinite(val) || val <= 0) continue;
    fallbackLast = val;
    const rawTime = p.time ?? p.updated_at;
    if (rawTime !== undefined) {
      const ts = typeof rawTime === 'number' ? rawTime : Date.parse(String(rawTime));
      if (Number.isFinite(ts) && ts >= latestTs) {
        latestTs = ts;
        latestVal = val;
      }
    }
  }

  const chosen = latestVal ?? fallbackLast;
  return chosen !== null ? Math.round(chosen) : null;
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

export async function fetchNodeLatestPing(
  baseUrl: string,
  uuid: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const pingUrl = buildApiUrl(baseUrl, `/api/records/ping?uuid=${encodeURIComponent(uuid)}&hours=1`);
  const payload = await fetchJson<unknown>(pingUrl, baseUrl, signal);
  const rawPings = extractArray<RawPingRecord>(payload);
  return extractLatestPing(rawPings);
}

/**
 * Gently fetches the latest valid ping latency for a list of node UUIDs
 * using a small concurrency limit so Komari servers are never flooded.
 */
export async function fetchBatchLatestPings(
  baseUrl: string,
  uuids: string[],
  signal?: AbortSignal,
  concurrency = 3,
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  if (uuids.length === 0) return results;

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, uuids.length) }, async () => {
    while (cursor < uuids.length && !signal?.aborted) {
      const idx = cursor++;
      const uuid = uuids[idx];
      try {
        const ping = await fetchNodeLatestPing(baseUrl, uuid, signal);
        if (ping !== null && ping > 0) {
          results[uuid] = ping;
        }
      } catch {
        // Ignore individual node ping errors (ping tasks may be disabled)
      }
    }
  });

  await Promise.all(workers);
  return results;
}

function extractPingTasks(payload: unknown): RawPingTask[] {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.tasks)) return obj.tasks as RawPingTask[];
  }
  return [];
}

function computePercentile(sortedAsc: number[], pct: number): number | null {
  if (sortedAsc.length === 0) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((pct / 100) * sortedAsc.length) - 1));
  return Math.round(sortedAsc[idx] * 10) / 10;
}

function buildPingProbes(rawPings: RawPingRecord[], rawTasks: RawPingTask[]): PingProbeSeries[] {
  if (rawPings.length === 0 && rawTasks.length === 0) return [];

  const taskMetaById = new Map<string, RawPingTask>();
  for (const t of rawTasks) {
    if (t.id !== undefined) {
      taskMetaById.set(String(t.id), t);
    }
  }

  const grouped = new Map<string, RawPingRecord[]>();
  for (const rec of rawPings) {
    const key = rec.task_id !== undefined ? String(rec.task_id) : 'default';
    const arr = grouped.get(key) ?? [];
    arr.push(rec);
    grouped.set(key, arr);
  }

  // Ensure tasks returned with metadata also appear even if records are sparse
  for (const t of rawTasks) {
    if (t.id !== undefined && !grouped.has(String(t.id))) {
      grouped.set(String(t.id), []);
    }
  }

  const seriesList: PingProbeSeries[] = [];
  let fallbackIndex = 1;

  for (const [taskKey, recs] of grouped.entries()) {
    const meta = taskMetaById.get(taskKey);
    const sortedRecs = recs.slice().sort((a, b) => {
      const ta = Date.parse(String(a.time ?? a.updated_at ?? 0));
      const tb = Date.parse(String(b.time ?? b.updated_at ?? 0));
      return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
    });

    const validVals: number[] = [];
    let droppedCount = 0;
    let latestValid: number | null = null;
    let jitterSum = 0;
    let jitterPairs = 0;
    let prevValid: number | null = null;

    for (const r of sortedRecs) {
      const val = Number(r.value ?? r.ping ?? r.latency ?? -1);
      if (Number.isFinite(val) && val > 0) {
        validVals.push(val);
        latestValid = val;
        if (prevValid !== null) {
          jitterSum += Math.abs(val - prevValid);
          jitterPairs += 1;
        }
        prevValid = val;
      } else {
        droppedCount += 1;
      }
    }

    const totalSamples = sortedRecs.length || Number(meta?.total ?? 0);
    const sortedValid = validVals.slice().sort((a, b) => a - b);
    const computedMin = sortedValid.length > 0 ? Math.round(sortedValid[0] * 10) / 10 : null;
    const computedMax = sortedValid.length > 0 ? Math.round(sortedValid[sortedValid.length - 1] * 10) / 10 : null;
    const computedAvg =
      validVals.length > 0 ? Math.round((validVals.reduce((s, v) => s + v, 0) / validVals.length) * 10) / 10 : null;
    const computedP95 = computePercentile(sortedValid, 95);
    const computedJitter = jitterPairs > 0 ? Math.round((jitterSum / jitterPairs) * 10) / 10 : null;
    const computedLoss =
      sortedRecs.length > 0
        ? Math.round((droppedCount / sortedRecs.length) * 1000) / 10
        : typeof meta?.loss === 'number' && Number.isFinite(meta.loss)
          ? Math.round(meta.loss * 10) / 10
          : 0;

    const sampledRecs = downsample(sortedRecs, 28);
    const points: PingProbeSample[] = sampledRecs.map((r) => {
      const val = Number(r.value ?? r.ping ?? r.latency ?? -1);
      return {
        time: formatShortTime(r.time ?? r.updated_at),
        value: Number.isFinite(val) && val > 0 ? Math.round(val * 10) / 10 : null,
      };
    });

    const probeName =
      meta?.name?.trim() || (taskKey === 'default' ? '默认探针' : `探针 #${fallbackIndex}`);
    fallbackIndex += 1;

    seriesList.push({
      id: taskKey,
      name: probeName,
      latest:
        latestValid !== null
          ? Math.round(latestValid * 10) / 10
          : typeof meta?.latest === 'number' && meta.latest > 0
            ? Math.round(meta.latest * 10) / 10
            : null,
      min: computedMin ?? (typeof meta?.min === 'number' && meta.min > 0 ? Math.round(meta.min * 10) / 10 : null),
      avg: computedAvg ?? (typeof meta?.avg === 'number' && meta.avg > 0 ? Math.round(meta.avg * 10) / 10 : null),
      p95: computedP95 ?? (typeof meta?.p95 === 'number' && meta.p95 > 0 ? Math.round(meta.p95 * 10) / 10 : null),
      max: computedMax ?? (typeof meta?.max === 'number' && meta.max > 0 ? Math.round(meta.max * 10) / 10 : null),
      jitter: computedJitter,
      loss: Math.max(0, Math.min(100, computedLoss)),
      totalSamples,
      points,
    });
  }

  // Cap to 4 probes to stay strictly within the 4-color validated categorical palette
  return seriesList.slice(0, 4);
}

export async function fetchNodeTelemetryRecords(
  baseUrl: string,
  node: NodeInfo,
  hours: RecordHours,
  signal?: AbortSignal,
): Promise<NodeTelemetryBundle> {
  const loadUrl = buildApiUrl(baseUrl, `/api/records/load?uuid=${encodeURIComponent(node.uuid)}&hours=${hours}`);
  const pingUrl = buildApiUrl(baseUrl, `/api/records/ping?uuid=${encodeURIComponent(node.uuid)}&hours=${hours}`);

  const [loadRes, pingRes] = await Promise.allSettled([
    fetchJson<unknown>(loadUrl, baseUrl, signal),
    fetchJson<unknown>(pingUrl, baseUrl, signal),
  ]);

  const rawLoads = loadRes.status === 'fulfilled' ? extractArray<RawLoadRecord>(loadRes.value) : [];
  const rawPings = pingRes.status === 'fulfilled' ? extractArray<RawPingRecord>(pingRes.value) : [];
  const rawPingTasks = pingRes.status === 'fulfilled' ? extractPingTasks(pingRes.value) : [];

  const validPings = rawPings
    .map((p) => Number(p.value ?? p.ping ?? p.latency ?? -1))
    .filter((v) => Number.isFinite(v) && v > 0);
  const latestPing = extractLatestPing(rawPings);
  const pingProbes = buildPingProbes(rawPings, rawPingTasks);

  if (rawLoads.length === 0) {
    return { points: [], pingProbes, latestPing };
  }

  const sampledLoads = downsample(rawLoads, 28);
  const sampledPings = downsample(validPings, sampledLoads.length);

  const points: TelemetryPoint[] = sampledLoads.map((rec, i) => {
    const cpu = Math.max(0, Math.min(100, Math.round(Number(rec.cpu ?? 0))));
    const rawRam = Number(rec.ram ?? 0);
    const totalMem = Number(rec.ram_total || node.mem_total || 1);
    const ramPct = rawRam > 100 && totalMem > 0 ? (rawRam / totalMem) * 100 : rawRam;
    const ram = Math.max(0, Math.min(100, Math.round(ramPct)));
    const ping = sampledPings[i] !== undefined ? Math.round(sampledPings[i]) : latestPing ?? node.ping;
    const netDown = firstFiniteNonNegative(rec.net_in, rec.net_down);
    const netUp = firstFiniteNonNegative(rec.net_out, rec.net_up);
    const load1 =
      typeof rec.load === 'number' && Number.isFinite(rec.load) && rec.load >= 0
        ? Math.round(rec.load * 100) / 100
        : undefined;
    return {
      time: formatShortTime(rec.time ?? rec.updated_at),
      cpu,
      ram,
      ping,
      netDown,
      netUp,
      load1,
    };
  });

  return { points, pingProbes, latestPing };
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
