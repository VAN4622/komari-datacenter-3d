import type { NodeInfo } from '@/types/rack';

export interface GeoHubSpec {
  code: string;
  name: string;
  en: string;
  flag: string;
  lat: number;
  lon: number;
  /** Regional glow radius in map SVG units */
  radius?: number;
}

export interface RegionCluster {
  hub: GeoHubSpec;
  x: number;
  y: number;
  nodes: NodeInfo[];
  onlineCount: number;
  totalNetDown: number;
  totalNetUp: number;
  avgCpu: number;
  avgPing: number;
}

export interface DataLinkArc {
  id: string;
  from: RegionCluster;
  to: RegionCluster;
  pathD: string;
  midX: number;
  midY: number;
  trafficBps: number;
  durationSec: number;
  active: boolean;
}

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 480;

/**
 * Projects geographic coordinates (lat/lon) with a smooth Robinson-inspired pseudocylindrical curve
 * centered on lon = 10° (matching worldMapDots.ts sub-pixel for sub-pixel).
 */
export function projectLatLon(lat: number, lon: number): { x: number; y: number } {
  let dLon = lon - 10;
  if (dLon < -180) dLon += 360;
  if (dLon > 180) dLon -= 360;
  const latClamped = Math.max(-56, Math.min(78, lat));
  const latFrac = latClamped / 90;
  const xScale = 1 - 0.16 * latFrac * latFrac - 0.12 * Math.pow(latFrac, 4);
  const x = 500 + (dLon / 180) * 480 * xScale;
  const yNorm = (78 - latClamped) / (78 - -56);
  const y = 20 + yNorm * 440;
  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

export function isoToFlagEmoji(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '🌐';
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function flagEmojiToIso(text: string): string | null {
  const chars = [...text.trim()];
  for (let i = 0; i < chars.length - 1; i++) {
    const c1 = chars[i].codePointAt(0) ?? 0;
    const c2 = chars[i + 1].codePointAt(0) ?? 0;
    if (c1 >= 0x1f1e6 && c1 <= 0x1f1ff && c2 >= 0x1f1e6 && c2 <= 0x1f1ff) {
      return String.fromCharCode(65 + (c1 - 0x1f1e6), 65 + (c2 - 0x1f1e6));
    }
  }
  return null;
}

const RAW_HUBS: Record<string, Omit<GeoHubSpec, 'flag'>> = {
  // East & Southeast Asia
  HK: { code: 'HK', name: '香港', en: 'Hong Kong', lat: 21.8, lon: 114.2, radius: 22 },
  CN: { code: 'CN', name: '中国大陆', en: 'China', lat: 32.5, lon: 112.0, radius: 36 },
  TW: { code: 'TW', name: '台湾', en: 'Taiwan', lat: 24.4, lon: 121.6, radius: 20 },
  MO: { code: 'MO', name: '澳门', en: 'Macau', lat: 21.6, lon: 113.0, radius: 18 },
  JP: { code: 'JP', name: '日本', en: 'Japan', lat: 36.0, lon: 139.2, radius: 26 },
  KR: { code: 'KR', name: '韩国', en: 'South Korea', lat: 37.5, lon: 127.4, radius: 22 },
  SG: { code: 'SG', name: '新加坡', en: 'Singapore', lat: 1.4, lon: 103.8, radius: 24 },
  MY: { code: 'MY', name: '马来西亚', en: 'Malaysia', lat: 4.2, lon: 101.9, radius: 22 },
  TH: { code: 'TH', name: '泰国', en: 'Thailand', lat: 14.0, lon: 100.6, radius: 22 },
  VN: { code: 'VN', name: '越南', en: 'Vietnam', lat: 16.0, lon: 107.8, radius: 22 },
  PH: { code: 'PH', name: '菲律宾', en: 'Philippines', lat: 13.8, lon: 121.8, radius: 22 },
  ID: { code: 'ID', name: '印度尼西亚', en: 'Indonesia', lat: -5.8, lon: 108.0, radius: 26 },
  IN: { code: 'IN', name: '印度', en: 'India', lat: 20.5, lon: 78.9, radius: 30 },
  AU: { code: 'AU', name: '澳大利亚', en: 'Australia', lat: -31.5, lon: 147.0, radius: 34 },
  NZ: { code: 'NZ', name: '新西兰', en: 'New Zealand', lat: -41.0, lon: 174.0, radius: 22 },

  // Europe
  GB: { code: 'GB', name: '英国', en: 'United Kingdom', lat: 53.5, lon: -2.2, radius: 24 },
  IE: { code: 'IE', name: '爱尔兰', en: 'Ireland', lat: 53.3, lon: -7.6, radius: 20 },
  NL: { code: 'NL', name: '荷兰', en: 'Netherlands', lat: 52.8, lon: 5.2, radius: 22 },
  DE: { code: 'DE', name: '德国', en: 'Germany', lat: 50.6, lon: 10.4, radius: 26 },
  FR: { code: 'FR', name: '法国', en: 'France', lat: 46.8, lon: 2.3, radius: 24 },
  BE: { code: 'BE', name: '比利时', en: 'Belgium', lat: 50.6, lon: 4.4, radius: 20 },
  LU: { code: 'LU', name: '卢森堡', en: 'Luxembourg', lat: 49.7, lon: 6.1, radius: 18 },
  CH: { code: 'CH', name: '瑞士', en: 'Switzerland', lat: 46.8, lon: 8.2, radius: 20 },
  AT: { code: 'AT', name: '奥地利', en: 'Austria', lat: 47.6, lon: 14.5, radius: 20 },
  IT: { code: 'IT', name: '意大利', en: 'Italy', lat: 42.8, lon: 12.6, radius: 24 },
  ES: { code: 'ES', name: '西班牙', en: 'Spain', lat: 40.4, lon: -3.7, radius: 24 },
  PT: { code: 'PT', name: '葡萄牙', en: 'Portugal', lat: 39.4, lon: -8.2, radius: 20 },
  PL: { code: 'PL', name: '波兰', en: 'Poland', lat: 52.2, lon: 19.5, radius: 24 },
  CZ: { code: 'CZ', name: '捷克', en: 'Czechia', lat: 49.8, lon: 15.5, radius: 20 },
  SE: { code: 'SE', name: '瑞典', en: 'Sweden', lat: 60.1, lon: 18.0, radius: 24 },
  NO: { code: 'NO', name: '挪威', en: 'Norway', lat: 60.5, lon: 8.5, radius: 24 },
  FI: { code: 'FI', name: '芬兰', en: 'Finland', lat: 62.5, lon: 25.7, radius: 24 },
  DK: { code: 'DK', name: '丹麦', en: 'Denmark', lat: 56.0, lon: 10.0, radius: 20 },
  RO: { code: 'RO', name: '罗马尼亚', en: 'Romania', lat: 45.9, lon: 25.0, radius: 22 },
  BG: { code: 'BG', name: '保加利亚', en: 'Bulgaria', lat: 42.7, lon: 25.4, radius: 20 },
  UA: { code: 'UA', name: '乌克兰', en: 'Ukraine', lat: 49.0, lon: 31.4, radius: 24 },
  RU: { code: 'RU', name: '俄罗斯', en: 'Russia', lat: 58.0, lon: 62.0, radius: 38 },
  TR: { code: 'TR', name: '土耳其', en: 'Turkey', lat: 39.2, lon: 34.5, radius: 24 },

  // Americas
  US: { code: 'US', name: '美国', en: 'United States', lat: 38.2, lon: -102.0, radius: 38 },
  CA: { code: 'CA', name: '加拿大', en: 'Canada', lat: 53.5, lon: -104.0, radius: 34 },
  MX: { code: 'MX', name: '墨西哥', en: 'Mexico', lat: 23.0, lon: -102.0, radius: 24 },
  BR: { code: 'BR', name: '巴西', en: 'Brazil', lat: -14.0, lon: -51.0, radius: 32 },
  AR: { code: 'AR', name: '阿根廷', en: 'Argentina', lat: -35.0, lon: -64.0, radius: 26 },
  CL: { code: 'CL', name: '智利', en: 'Chile', lat: -33.4, lon: -70.6, radius: 22 },
  CO: { code: 'CO', name: '哥伦比亚', en: 'Colombia', lat: 4.6, lon: -74.1, radius: 22 },

  // Middle East & Africa
  AE: { code: 'AE', name: '阿联酋', en: 'UAE', lat: 24.5, lon: 54.4, radius: 22 },
  SA: { code: 'SA', name: '沙特', en: 'Saudi Arabia', lat: 24.0, lon: 45.0, radius: 24 },
  IL: { code: 'IL', name: '以色列', en: 'Israel', lat: 31.8, lon: 35.2, radius: 20 },
  ZA: { code: 'ZA', name: '南非', en: 'South Africa', lat: -29.0, lon: 24.0, radius: 26 },
  EG: { code: 'EG', name: '埃及', en: 'Egypt', lat: 27.0, lon: 30.8, radius: 24 },
};

const CITY_OR_ALIAS_HINTS: [RegExp, string][] = [
  [/\b(HK|HKG|HONG\s?KONG)\b|香港/i, 'HK'],
  [/\b(JP|TYO|NRT|OSA|KIX|TOKYO|OSAKA|JAPAN)\b|日本|东京|大阪/i, 'JP'],
  [/\b(SG|SIN|SINGAPORE)\b|新加坡/i, 'SG'],
  [/\b(KR|SEL|ICN|SEOUL|KOREA)\b|韩国|首尔/i, 'KR'],
  [/\b(TW|TPE|TAIWAN|TAIPEI)\b|台湾|台北/i, 'TW'],
  [/\b(US|USA|LAX|SJC|SFO|SEA|NYC|EWR|IAD|DFW|ORD|MIA|ATL|ASHBURN|DALLAS|SAN\s?JOSE|LOS\s?ANGELES)\b|美国|美西|美东|洛杉矶|圣何塞/i, 'US'],
  [/\b(CA|YVR|YYZ|YUL|CANADA|TORONTO|VANCOUVER)\b|加拿大/i, 'CA'],
  [/\b(DE|FRA|BER|MUC|GERMANY|FRANKFURT|FALKENSTEIN|NUREMBERG)\b|德国|法兰克福/i, 'DE'],
  [/\b(GB|UK|LON|LHR|LONDON|MANCHESTER)\b|英国|伦敦/i, 'GB'],
  [/\b(NL|AMS|AMSTERDAM|NETHERLANDS)\b|荷兰|阿姆斯特丹/i, 'NL'],
  [/\b(FR|PAR|CDG|PARIS|FRANCE)\b|法国|巴黎/i, 'FR'],
  [/\b(CH|ZRH|ZURICH|SWISS)\b|瑞士/i, 'CH'],
  [/\b(SE|STO|ARN|SWEDEN)\b|瑞典/i, 'SE'],
  [/\b(FI|HEL|FINLAND|HELSINKI)\b|芬兰/i, 'FI'],
  [/\b(PL|WAW|POLAND)\b|波兰/i, 'PL'],
  [/\b(RU|MOW|SVO|LED|RUSSIA|MOSCOW)\b|俄罗斯/i, 'RU'],
  [/\b(AU|SYD|MEL|AUSTRALIA|SYDNEY)\b|澳大利亚|悉尼/i, 'AU'],
  [/\b(CN|BJS|PEK|SHA|PVG|CAN|SZX|HGH|CHINA)\b|中国|北京|上海|广州|深圳|杭州/i, 'CN'],
  [/\b(BR|GRU|SAO|BRAZIL)\b|巴西/i, 'BR'],
  [/\b(IN|BOM|MAA|DEL|INDIA|MUMBAI)\b|印度/i, 'IN'],
  [/\b(TR|IST|TURKEY)\b|土耳其/i, 'TR'],
  [/\b(AE|DXB|DUBAI|UAE)\b|迪拜|阿联酋/i, 'AE'],
  [/\b(ZA|JNB|CPT)\b|南非/i, 'ZA'],
];

export function resolveNodeGeo(node: Pick<NodeInfo, 'region' | 'name' | 'group' | 'tag'>): GeoHubSpec {
  const rawRegion = (node.region || '').trim();

  // 1. Flag emoji directly inside region
  let code = flagEmojiToIso(rawRegion);

  // 2. Direct 2-letter ISO code inside region
  if (!code && /^[a-zA-Z]{2}$/.test(rawRegion)) {
    code = rawRegion.toUpperCase();
  }
  if (code === 'UK') code = 'GB';

  // 3. Infer from region/name/group/tag keywords
  if (!code || !RAW_HUBS[code]) {
    const searchPool = `${rawRegion} ${node.name} ${node.group ?? ''} ${node.tag ?? ''}`;
    for (const [pattern, mapped] of CITY_OR_ALIAS_HINTS) {
      if (pattern.test(searchPool)) {
        code = mapped;
        break;
      }
    }
  }

  if (code && RAW_HUBS[code]) {
    const spec = RAW_HUBS[code];
    return {
      ...spec,
      flag: isoToFlagEmoji(spec.code),
    };
  }

  // Fallback global hub
  return {
    code: 'GL',
    name: '全球节点',
    en: 'Global',
    flag: '🌐',
    lat: 26,
    lon: 18,
    radius: 24,
  };
}

/**
 * Groups all Komari nodes into geographic clusters and applies subtle visual de-collision
 * for dense nearby hubs (like NL / DE / GB or HK / TW) so tags stay crisp.
 */
export function buildRegionClusters(nodes: NodeInfo[]): RegionCluster[] {
  const map = new Map<string, { hub: GeoHubSpec; nodes: NodeInfo[] }>();

  for (const node of nodes) {
    const hub = resolveNodeGeo(node);
    const entry = map.get(hub.code);
    if (entry) {
      entry.nodes.push(node);
    } else {
      map.set(hub.code, { hub, nodes: [node] });
    }
  }

  const clusters: RegionCluster[] = [];
  for (const { hub, nodes: list } of map.values()) {
    const { x, y } = projectLatLon(hub.lat, hub.lon);
    const onlineNodes = list.filter((n) => n.online);
    const totalNetDown = onlineNodes.reduce((s, n) => s + (n.netDown || 0), 0);
    const totalNetUp = onlineNodes.reduce((s, n) => s + (n.netUp || 0), 0);
    const avgCpu =
      onlineNodes.length > 0
        ? Math.round(onlineNodes.reduce((s, n) => s + (n.cpu || 0), 0) / onlineNodes.length)
        : 0;
    const pingNodes = onlineNodes.filter((n) => n.ping > 0);
    const avgPing =
      pingNodes.length > 0
        ? Math.round(pingNodes.reduce((s, n) => s + n.ping, 0) / pingNodes.length)
        : 0;

    clusters.push({
      hub,
      x,
      y,
      nodes: list,
      onlineCount: onlineNodes.length,
      totalNetDown,
      totalNetUp,
      avgCpu,
      avgPing,
    });
  }

  // Sort by traffic & node count descending so main backbone hubs sit cleanly
  clusters.sort(
    (a, b) =>
      b.onlineCount - a.onlineCount ||
      b.totalNetDown + b.totalNetUp - (a.totalNetDown + a.totalNetUp) ||
      a.hub.code.localeCompare(b.hub.code),
  );

  return clusters;
}

/**
 * Generates clean curved SVG Bezier inter-region data exchange arcs between active clusters.
 * Uses a smart backbone + nearest-neighbor topology so links look like a living global mesh
 * without turning into visual spaghetti.
 */
export function buildInterRegionLinks(clusters: RegionCluster[]): DataLinkArc[] {
  if (clusters.length < 2) return [];

  const activeClusters = clusters.filter((c) => c.onlineCount > 0);
  const pool = activeClusters.length >= 2 ? activeClusters : clusters;
  if (pool.length < 2) return [];

  const pairs = new Map<string, [RegionCluster, RegionCluster]>();
  const addPair = (a: RegionCluster, b: RegionCluster) => {
    if (a.hub.code === b.hub.code) return;
    const key = [a.hub.code, b.hub.code].sort().join('--');
    if (!pairs.has(key)) {
      pairs.set(key, [a, b]);
    }
  };

  // 1. Connect primary hub to top 2 other regions
  const primary = pool[0];
  for (let i = 1; i < Math.min(pool.length, 3); i++) {
    addPair(primary, pool[i]);
  }

  // 2. Connect each cluster to its closest neighbor for clean regional & inter-continental relays
  for (const src of pool) {
    const sorted = pool
      .filter((c) => c.hub.code !== src.hub.code)
      .sort((a, b) => {
        const da = Math.hypot(a.x - src.x, a.y - src.y);
        const db = Math.hypot(b.x - src.x, b.y - src.y);
        return da - db;
      });
    if (sorted[0]) addPair(src, sorted[0]);
  }

  // 3. Ensure one clean trans-oceanic / cross-continental trunk
  const sortedByX = [...pool].sort((a, b) => a.x - b.x);
  if (sortedByX.length >= 2) {
    addPair(sortedByX[0], sortedByX[sortedByX.length - 1]);
  }

  const arcs: DataLinkArc[] = [];
  for (const [key, [from, to]] of pairs.entries()) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);

    // Gentle parabolic arch (subtle, refined, never exaggerated)
    const archLift = Math.min(92, Math.max(20, dist * 0.21));
    const ctrlX = (from.x + to.x) / 2;
    const ctrlY = Math.max(20, (from.y + to.y) / 2 - archLift);

    // Midpoint on quadratic Bezier at t = 0.5
    const midX = 0.25 * from.x + 0.5 * ctrlX + 0.25 * to.x;
    const midY = 0.25 * from.y + 0.5 * ctrlY + 0.25 * to.y;

    const trafficBps =
      from.totalNetDown + from.totalNetUp + to.totalNetDown + to.totalNetUp;
    // Calm, fluid optical transit speed (between 3.0s and 5.8s)
    const speedFactor = Math.min(1, Math.log10(Math.max(1, trafficBps / 1024 + 1)) / 5.5);
    const durationSec = Math.round((5.8 - speedFactor * 2.6) * 10) / 10;

    arcs.push({
      id: key,
      from,
      to,
      pathD: `M ${from.x} ${from.y} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${to.x} ${to.y}`,
      midX,
      midY,
      trafficBps,
      durationSec,
      active: from.onlineCount > 0 && to.onlineCount > 0,
    });
  }

  return arcs.slice(0, 10);
}
