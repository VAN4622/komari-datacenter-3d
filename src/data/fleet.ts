import type {
  AccentId,
  AppConfig,
  CabinetTheme,
  ChassisFinish,
  ChassisModel,
  EffectiveNodeStyle,
  NodeInfo,
  NodeStyleOverride,
  OledId,
  PersistedRackLayoutPayload,
  PingProbeSample,
  PingProbeSeries,
  RackCabinetData,
  RackItem,
  RackViewAngle,
  RecordHours,
  RoomAtmosphere,
  TelemetryPoint,
  UiStyle,
} from '@/types/rack';

const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export const DEMO_NODES: NodeInfo[] = [
  {
    uuid: 'node-hk-nano',
    name: 'HK-NAT-Nano',
    region: '🇭🇰',
    group: '亚太线路',
    tags: 'NAT-LITE;BGP',
    cpu_cores: 1,
    mem_total: 1024 ** 3,
    swap_total: 512 * MB,
    disk_total: 20 * 1024 ** 3,
    os: 'Debian 12',
    kernel_version: '6.1.0-26-amd64',
    cpu_name: 'Intel Xeon E5-2680 v4',
    arch: 'x86_64',
    virtualization: 'KVM',
    tag: 'NAT-LITE',
    online: true,
    cpu: 24,
    ram: 42,
    ramUsed: Math.round(0.42 * 1024 ** 3),
    swap: 12,
    swapUsed: Math.round(0.12 * 512 * MB),
    disk: 31,
    diskUsed: Math.round(0.31 * 20 * 1024 ** 3),
    netUp: 240 * KB,
    netDown: 815 * KB,
    totalUp: 412 * GB,
    totalDown: 1.28 * 1024 * GB,
    load1: 0.28,
    load5: 0.31,
    load15: 0.24,
    tcp: 64,
    udp: 18,
    process: 88,
    ping: 19,
    uptime: '64d 11h',
  },
  {
    uuid: 'node-jp-edge',
    name: 'JP-TYO-CN2',
    region: '🇯🇵',
    group: '核心算力',
    tags: 'CN2-GIA;Edge',
    cpu_cores: 2,
    mem_total: 2 * 1024 ** 3,
    swap_total: 1024 ** 3,
    disk_total: 40 * 1024 ** 3,
    os: 'Ubuntu 24.04',
    kernel_version: '6.8.0-49-generic',
    cpu_name: 'AMD EPYC 7763',
    arch: 'x86_64',
    virtualization: 'KVM',
    tag: 'CN2-GIA',
    online: true,
    cpu: 46,
    ram: 53,
    ramUsed: Math.round(0.53 * 2 * 1024 ** 3),
    swap: 8,
    swapUsed: Math.round(0.08 * 1024 ** 3),
    disk: 44,
    diskUsed: Math.round(0.44 * 40 * 1024 ** 3),
    netUp: 4.2 * MB,
    netDown: 11.8 * MB,
    totalUp: 2.1 * 1024 * GB,
    totalDown: 5.4 * 1024 * GB,
    load1: 0.94,
    load5: 0.86,
    load15: 0.79,
    tcp: 248,
    udp: 41,
    process: 142,
    ping: 34,
    uptime: '112d 05h',
  },
  {
    uuid: 'node-de-sto',
    name: 'DE-FRA-Storage',
    region: '🇩🇪',
    group: '核心算力',
    tags: 'RAID10-NAS;NVMe',
    cpu_cores: 8,
    mem_total: 16 * 1024 ** 3,
    swap_total: 4 * 1024 ** 3,
    disk_total: 4000 * 1024 ** 3,
    os: 'Debian 12',
    kernel_version: '6.1.0-28-amd64',
    cpu_name: 'AMD Ryzen 9 5950X',
    arch: 'x86_64',
    virtualization: 'Dedicated',
    tag: 'RAID10-NAS',
    online: true,
    cpu: 58,
    ram: 67,
    ramUsed: Math.round(0.67 * 16 * 1024 ** 3),
    swap: 4,
    swapUsed: Math.round(0.04 * 4 * 1024 ** 3),
    disk: 71,
    diskUsed: Math.round(0.71 * 4000 * 1024 ** 3),
    netUp: 8.6 * MB,
    netDown: 19.4 * MB,
    totalUp: 9.8 * 1024 * GB,
    totalDown: 18.2 * 1024 * GB,
    load1: 3.12,
    load5: 2.84,
    load15: 2.51,
    tcp: 412,
    udp: 67,
    process: 236,
    ping: 138,
    uptime: '204d 19h',
  },
  {
    uuid: 'node-us-blade',
    name: 'US-LAX-Compute',
    region: '🇺🇸',
    group: '核心算力',
    tags: 'K8S-NODE01;GPU',
    cpu_cores: 32,
    mem_total: 128 * 1024 ** 3,
    swap_total: 16 * 1024 ** 3,
    disk_total: 2000 * 1024 ** 3,
    os: 'Rocky Linux 9',
    kernel_version: '5.14.0-427.el9',
    cpu_name: 'AMD EPYC 9654 96C',
    gpu_name: 'NVIDIA L40S 48GB',
    arch: 'x86_64',
    virtualization: 'Dedicated',
    tag: 'K8S-NODE01',
    online: true,
    cpu: 72,
    ram: 78,
    ramUsed: Math.round(0.78 * 128 * 1024 ** 3),
    swap: 11,
    swapUsed: Math.round(0.11 * 16 * 1024 ** 3),
    disk: 54,
    diskUsed: Math.round(0.54 * 2000 * 1024 ** 3),
    netUp: 26.5 * MB,
    netDown: 54.2 * MB,
    totalUp: 31.4 * 1024 * GB,
    totalDown: 64.9 * 1024 * GB,
    load1: 18.4,
    load5: 16.9,
    load15: 15.2,
    tcp: 1184,
    udp: 192,
    process: 518,
    ping: 142,
    uptime: '89d 03h',
  },
  {
    uuid: 'node-sg-edge',
    name: 'SG-SIN-IEPL',
    region: '🇸🇬',
    group: '亚太线路',
    tags: 'IEPL-10G;LowLat',
    cpu_cores: 2,
    mem_total: 4 * 1024 ** 3,
    swap_total: 2 * 1024 ** 3,
    disk_total: 60 * 1024 ** 3,
    os: 'Debian 12',
    kernel_version: '6.1.0-26-amd64',
    cpu_name: 'AMD EPYC 7R13',
    arch: 'x86_64',
    virtualization: 'KVM',
    tag: 'IEPL-10G',
    online: true,
    cpu: 33,
    ram: 48,
    ramUsed: Math.round(0.48 * 4 * 1024 ** 3),
    swap: 5,
    swapUsed: Math.round(0.05 * 2 * 1024 ** 3),
    disk: 39,
    diskUsed: Math.round(0.39 * 60 * 1024 ** 3),
    netUp: 6.9 * MB,
    netDown: 14.3 * MB,
    totalUp: 4.5 * 1024 * GB,
    totalDown: 8.7 * 1024 * GB,
    load1: 0.62,
    load5: 0.58,
    load15: 0.54,
    tcp: 316,
    udp: 52,
    process: 129,
    ping: 41,
    uptime: '178d 17h',
  },
  {
    uuid: 'node-kr-db',
    name: 'KR-SEL-DB01',
    region: '🇰🇷',
    group: '亚太线路',
    tags: 'PG-PRIMARY;NVMe',
    cpu_cores: 4,
    mem_total: 8 * 1024 ** 3,
    swap_total: 2 * 1024 ** 3,
    disk_total: 320 * 1024 ** 3,
    os: 'Ubuntu 22.04',
    kernel_version: '5.15.0-125-generic',
    cpu_name: 'Intel Xeon Gold 6338',
    arch: 'x86_64',
    virtualization: 'KVM',
    tag: 'PG-PRIMARY',
    online: true,
    cpu: 41,
    ram: 61,
    ramUsed: Math.round(0.61 * 8 * 1024 ** 3),
    swap: 14,
    swapUsed: Math.round(0.14 * 2 * 1024 ** 3),
    disk: 58,
    diskUsed: Math.round(0.58 * 320 * 1024 ** 3),
    netUp: 2.4 * MB,
    netDown: 5.8 * MB,
    totalUp: 1.9 * 1024 * GB,
    totalDown: 4.2 * 1024 * GB,
    load1: 1.48,
    load5: 1.32,
    load15: 1.24,
    tcp: 194,
    udp: 23,
    process: 176,
    ping: 38,
    uptime: '152d 08h',
  },
  {
    uuid: 'node-uk-mini',
    name: 'UK-LON-Probe',
    region: '🇬🇧',
    group: '边缘探针',
    tags: 'ARM-NANO;Probe',
    cpu_cores: 1,
    mem_total: 1024 ** 3,
    swap_total: 0,
    disk_total: 15 * 1024 ** 3,
    os: 'Debian 12',
    kernel_version: '6.1.0-26-arm64',
    cpu_name: 'ARM Neoverse N1',
    arch: 'aarch64',
    virtualization: 'KVM',
    tag: 'ARM-NANO',
    online: true,
    cpu: 14,
    ram: 29,
    ramUsed: Math.round(0.29 * 1024 ** 3),
    swap: 0,
    swapUsed: 0,
    disk: 22,
    diskUsed: Math.round(0.22 * 15 * 1024 ** 3),
    netUp: 96 * KB,
    netDown: 285 * KB,
    totalUp: 185 * GB,
    totalDown: 420 * GB,
    load1: 0.14,
    load5: 0.12,
    load15: 0.11,
    tcp: 32,
    udp: 9,
    process: 64,
    ping: 162,
    uptime: '310d 04h',
  },
  {
    uuid: 'node-nl-backup',
    name: 'NL-AMS-Cold',
    region: '🇳🇱',
    group: '边缘探针',
    tags: 'OFFLINE-DR',
    cpu_cores: 4,
    mem_total: 8 * 1024 ** 3,
    swap_total: 2 * 1024 ** 3,
    disk_total: 1000 * 1024 ** 3,
    os: 'Debian 12',
    kernel_version: '6.1.0-22-amd64',
    cpu_name: 'Intel Xeon E-2388G',
    arch: 'x86_64',
    virtualization: 'KVM',
    tag: 'OFFLINE-DR',
    online: false,
    cpu: 0,
    ram: 0,
    ramUsed: 0,
    swap: 0,
    swapUsed: 0,
    disk: 64,
    diskUsed: Math.round(0.64 * 1000 * 1024 ** 3),
    netUp: 0,
    netDown: 0,
    totalUp: 620 * GB,
    totalDown: 2.3 * 1024 * GB,
    load1: 0,
    load5: 0,
    load15: 0,
    tcp: 0,
    udp: 0,
    process: 0,
    ping: 0,
    uptime: 'OFFLINE',
  },
];

export interface FinishPalette {
  id: ChassisFinish;
  name: string;
  en: string;
  top: string;
  mid: string;
  bot: string;
  deep: string;
  earTop: string;
  earMid: string;
  earBot: string;
  stroke: string;
  bevel: string;
  bayBg: string;
  bayBorder: string;
  textMute: string;
  finTop: string;
  finMid: string;
  finBot: string;
  screwFace: string;
  screwSlot: string;
}

export const FINISHES: Record<ChassisFinish, FinishPalette> = {
  gunmetal: {
    id: 'gunmetal',
    name: '枪灰阳极铝',
    en: 'Gunmetal',
    top: '#3E4550',
    mid: '#2E343D',
    bot: '#22272F',
    deep: '#181C22',
    earTop: '#6B7482',
    earMid: '#4C5460',
    earBot: '#323842',
    stroke: '#12161C',
    bevel: 'rgba(255,255,255,0.20)',
    bayBg: '#20252D',
    bayBorder: '#3F4855',
    textMute: '#9AA4B3',
    finTop: '#66707E',
    finMid: '#3C434E',
    finBot: '#21262E',
    screwFace: '#A7B1BF',
    screwSlot: '#232933',
  },
  obsidian: {
    id: 'obsidian',
    name: '哑光曜石黑',
    en: 'Obsidian',
    top: '#282C33',
    mid: '#1C1F25',
    bot: '#14171C',
    deep: '#0D0F13',
    earTop: '#454C56',
    earMid: '#2E333B',
    earBot: '#1D2127',
    stroke: '#090B0E',
    bevel: 'rgba(255,255,255,0.12)',
    bayBg: '#14171C',
    bayBorder: '#2D343F',
    textMute: '#838D9D',
    finTop: '#434954',
    finMid: '#262B32',
    finBot: '#14171C',
    screwFace: '#7E8794',
    screwSlot: '#181C22',
  },
  silver: {
    id: 'silver',
    name: '原色 CNC 银',
    en: 'Bead Silver',
    top: '#E7EBF0',
    mid: '#D3D9E2',
    bot: '#BEC6D2',
    deep: '#A4AEBC',
    earTop: '#EEF2F6',
    earMid: '#CFD6E0',
    earBot: '#AAB3C1',
    stroke: '#7A8594',
    bevel: 'rgba(255,255,255,0.85)',
    bayBg: '#C3CBD6',
    bayBorder: '#8E98A7',
    textMute: '#424D5C',
    finTop: '#EDF1F5',
    finMid: '#C8D0DB',
    finBot: '#9DA7B5',
    screwFace: '#DDE3EB',
    screwSlot: '#545F6E',
  },
  cream: {
    id: 'cream',
    name: '博朗暖灰白',
    en: 'Braun Warm',
    top: '#F1EDE4',
    mid: '#E2DCD0',
    bot: '#CFC8BA',
    deep: '#B8B0A1',
    earTop: '#EDE8DE',
    earMid: '#D6CFC2',
    earBot: '#B4ACA0',
    stroke: '#8F887A',
    bevel: 'rgba(255,255,255,0.88)',
    bayBg: '#D8D1C4',
    bayBorder: '#A39C8E',
    textMute: '#59534A',
    finTop: '#EFEAE0',
    finMid: '#D5CEC0',
    finBot: '#ACA496',
    screwFace: '#E4DEC2',
    screwSlot: '#5B554B',
  },
};

export interface AccentSpec {
  id: AccentId;
  name: string;
  hex: string;
  dark: string;
  cable2: string;
}

export const ACCENTS: AccentSpec[] = [
  { id: 'orange', name: '国际橙', hex: '#E05A1E', dark: '#A33E10', cable2: '#38BDF8' },
  { id: 'cyan', name: '光纤青', hex: '#28A9E0', dark: '#0B6B99', cable2: '#E05A1E' },
  { id: 'green', name: '状态绿', hex: '#22B563', dark: '#157D43', cable2: '#38BDF8' },
  { id: 'amber', name: '警戒黄', hex: '#D9A016', dark: '#946B0B', cable2: '#E05A1E' },
  { id: 'purple', name: '电光紫', hex: '#9455E8', dark: '#6730B3', cable2: '#38BDF8' },
  { id: 'red', name: '绯红', hex: '#DC3B3B', dark: '#9B2121', cable2: '#EAB308' },
];

export interface OledSpec {
  id: OledId;
  name: string;
  bg: string;
  title: string;
  main: string;
  bar: string;
}

export const OLEDS: OledSpec[] = [
  { id: 'cyan', name: '冷青', bg: '#07121A', title: '#86D5FA', main: '#38D9A9', bar: '#38BDF8' },
  { id: 'amber', name: '琥珀', bg: '#161007', title: '#FDE49B', main: '#FBBF24', bar: '#F59E0B' },
  { id: 'green', name: '翠绿', bg: '#07140D', title: '#96F2B8', main: '#4ADE80', bar: '#22C55E' },
  { id: 'ice', name: '冰蓝', bg: '#090F1E', title: '#C7D2FE', main: '#6CA8FF', bar: '#818CF8' },
];

export const CABINET_THEMES: { id: CabinetTheme; label: string }[] = [
  { id: 'obsidian', label: '曜石黑' },
  { id: 'titanium', label: '钛金灰' },
  { id: 'silver', label: '阳极银' },
];

export interface ViewAngleSpec {
  id: RackViewAngle;
  label: string;
  short: string;
}

export const VIEW_ANGLES: Record<RackViewAngle, ViewAngleSpec> = {
  side: {
    id: 'side',
    label: '固定微侧透视（展现机柜厚度与拉出导轨）',
    short: '微侧 15°',
  },
  front: {
    id: 'front',
    label: '正面平视（1:1 硬件面板正立面）',
    short: '正视',
  },
};

export interface SceneMeta {
  id: RoomAtmosphere;
  label: string;
  subtitle: string;
  swatch: string;
  isLight: boolean;
}

export const ATMOSPHERES: SceneMeta[] = [
  { id: 'studio-dark', label: '深石墨影棚', subtitle: '低干扰碳灰金属柔光棚拍', swatch: '#141923', isLight: false },
  { id: 'studio-light', label: '浅银画廊', subtitle: '瑞士极简工业展台白昼光', swatch: '#e6ebf2', isLight: true },
];

export interface UiStyleMeta {
  id: UiStyle;
  label: string;
  subtitle: string;
}

export const UI_STYLES: UiStyleMeta[] = [
  { id: 'tactile', label: '精致轻拟物', subtitle: '阳极铝与微实体键帽，贴合机柜质感' },
  { id: 'glass', label: '液态玻璃', subtitle: 'Apple Liquid Glass 光学折射通透界面' },
];

export const STORAGE_KEY = 'komari_datacenter_hall_v2';

export function normalizeAtmosphere(value: unknown): RoomAtmosphere {
  if (value === 'studio-light' || value === 'cleanroom') return 'studio-light';
  return 'studio-dark';
}

export function normalizeUiStyle(value: unknown): UiStyle {
  if (value === 'glass') return 'glass';
  return 'tactile';
}

export function normalizeViewAngle(value: unknown, legacyPreset?: unknown): RackViewAngle {
  if (value === 'front' || value === 'side') return value;
  if (legacyPreset === 'front') return 'front';
  return 'side';
}

export function getDefaultConfig(): AppConfig {
  return {
    viewAngle: 'side',
    atmosphere: 'studio-dark',
    uiStyle: 'tactile',
    scale: 'standard',
    activeRackId: 'rack-a1',
    showStrip: true,
    racks: [
      {
        id: 'rack-a1',
        name: 'A-01 · 核心算力柜',
        theme: 'obsidian',
        items: [
          { uid: 'item-pdu-1', type: 'pdu', label: 'APC-PDU-32A' },
          { uid: 'item-jp', type: 'node', nodeId: 'node-jp-edge' },
          { uid: 'item-de', type: 'node', nodeId: 'node-de-sto' },
          { uid: 'item-us', type: 'node', nodeId: 'node-us-blade' },
        ],
      },
      {
        id: 'rack-a2',
        name: 'A-02 · 亚太线路柜',
        theme: 'titanium',
        items: [
          { uid: 'item-sg', type: 'node', nodeId: 'node-sg-edge' },
          { uid: 'item-kr', type: 'node', nodeId: 'node-kr-db' },
          { uid: 'item-blank-1', type: 'blank', label: 'COLD-AISLE-BAFFLE' },
          { uid: 'item-hk', type: 'node', nodeId: 'node-hk-nano' },
          { uid: 'item-blank-2', type: 'blank', label: 'THERMAL-SEAL-1U' },
        ],
      },
      {
        id: 'rack-a3',
        name: 'A-03 · 边缘探针柜',
        theme: 'silver',
        items: [
          { uid: 'item-pdu-2', type: 'pdu', label: 'MET-PDU-16A' },
          { uid: 'item-uk', type: 'node', nodeId: 'node-uk-mini' },
          { uid: 'item-blank-3', type: 'blank', label: 'SPARE-BAY-1U' },
        ],
      },
    ],
    nodeStyles: {
      'node-sg-edge': { model: 'B1', finish: 'silver', accent: 'cyan', oled: 'ice', tag: 'IEPL-10G' },
      'node-uk-mini': { model: 'B4', finish: 'cream', accent: 'orange', oled: 'amber', tag: 'ARM-NANO' },
      'node-us-blade': { model: 'B3', finish: 'obsidian', accent: 'cyan', oled: 'cyan', tag: 'K8S-CORE' },
    },
    api: {
      mode: 'demo',
      baseUrl: '',
      recordHours: 1,
    },
  };
}

export function hasSavedConfig(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppConfig> & { cameraPreset?: string };
      if (parsed && Array.isArray(parsed.racks) && parsed.racks.length > 0) {
        const fallback = getDefaultConfig();
        return {
          ...fallback,
          ...parsed,
          viewAngle: normalizeViewAngle(parsed.viewAngle, parsed.cameraPreset),
          atmosphere: normalizeAtmosphere(parsed.atmosphere),
          uiStyle: normalizeUiStyle(parsed.uiStyle),
          nodeStyles: parsed.nodeStyles ?? fallback.nodeStyles,
          liveRacks: Array.isArray(parsed.liveRacks) && parsed.liveRacks.length > 0 ? parsed.liveRacks : undefined,
          api: {
            ...fallback.api,
            ...(parsed.api ?? {}),
          },
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return getDefaultConfig();
}

export function saveConfig(cfg: AppConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore storage errors
  }
}

export function buildAutoRacksFromNodes(
  nodes: NodeInfo[],
  preferredTheme: 'auto' | CabinetTheme = 'auto',
): RackCabinetData[] {
  const resolveTheme = (idx: number): CabinetTheme => {
    if (preferredTheme !== 'auto') return preferredTheme;
    const themes: CabinetTheme[] = ['obsidian', 'titanium', 'silver'];
    return themes[idx % themes.length];
  };

  if (nodes.length === 0) {
    return [
      {
        id: 'live-rack-1',
        name: 'A-01 · Komari 机柜',
        theme: resolveTheme(0),
        items: [{ uid: 'live-pdu-1', type: 'pdu', label: 'KOMARI-PDU-16A' }],
      },
    ];
  }

  const groupMap = new Map<string, NodeInfo[]>();
  for (const node of nodes) {
    const g = (node.group || '默认集群').trim() || '默认集群';
    const arr = groupMap.get(g) ?? [];
    arr.push(node);
    groupMap.set(g, arr);
  }

  const groups = Array.from(groupMap.entries());

  if (groups.length >= 2 && groups.length <= 4) {
    return groups.map(([groupName, list], idx) => {
      const items: RackItem[] = [];
      if (idx === 0) {
        items.push({ uid: `live-pdu-${idx + 1}`, type: 'pdu', label: 'KOMARI-PDU-16A' });
      }
      for (const n of list) {
        items.push({ uid: `live-node-${n.uuid}`, type: 'node', nodeId: n.uuid });
      }
      return {
        id: `live-rack-${idx + 1}`,
        name: `A-0${idx + 1} · ${groupName}`,
        theme: resolveTheme(idx),
        items,
      };
    });
  }

  const chunkSize = nodes.length > 6 ? Math.ceil(nodes.length / 2) : nodes.length;
  const racks: RackCabinetData[] = [];
  for (let i = 0; i < nodes.length; i += chunkSize) {
    const slice = nodes.slice(i, i + chunkSize);
    const idx = racks.length;
    const items: RackItem[] = [];
    if (idx === 0) {
      items.push({ uid: 'live-pdu-1', type: 'pdu', label: 'KOMARI-PDU-16A' });
    }
    for (const n of slice) {
      items.push({ uid: `live-node-${n.uuid}`, type: 'node', nodeId: n.uuid });
    }
    racks.push({
      id: `live-rack-${idx + 1}`,
      name: `A-0${idx + 1} · ${idx === 0 ? '主力生产柜' : '扩展节点柜'}`,
      theme: resolveTheme(idx),
      items,
    });
  }
  return racks;
}

export function serializePersistedLayout(
  racks: RackCabinetData[],
  nodeStyles: Record<string, NodeStyleOverride>,
  updatedBy?: string,
): string {
  const payload: PersistedRackLayoutPayload = {
    version: 1,
    racks,
    nodeStyles,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  return JSON.stringify(payload);
}

export function parsePersistedLayoutJson(raw?: string): PersistedRackLayoutPayload | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<PersistedRackLayoutPayload>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.racks) || parsed.racks.length === 0) return null;
    const validRacks: RackCabinetData[] = parsed.racks
      .filter((r): r is RackCabinetData => Boolean(r && typeof r.id === 'string' && Array.isArray(r.items)))
      .map((r) => ({
        id: r.id,
        name: typeof r.name === 'string' && r.name.trim() ? r.name : r.id,
        theme: r.theme === 'silver' || r.theme === 'obsidian' || r.theme === 'titanium' ? r.theme : 'obsidian',
        items: r.items.filter((item): item is RackItem => Boolean(item && typeof item.uid === 'string' && item.type)),
      }));
    if (validRacks.length === 0) return null;
    return {
      version: 1,
      racks: validRacks,
      nodeStyles:
        parsed.nodeStyles && typeof parsed.nodeStyles === 'object' ? parsed.nodeStyles : {},
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
      updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : undefined,
    };
  } catch {
    return null;
  }
}

export function parseImportedConfig(rawJson: string, current: AppConfig): AppConfig {
  const parsed = JSON.parse(rawJson) as Partial<AppConfig>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON 根结构无效');
  }
  const hasRacks = Array.isArray(parsed.racks) && parsed.racks.length > 0;
  const hasLiveRacks = Array.isArray(parsed.liveRacks) && parsed.liveRacks.length > 0;
  if (!hasRacks && !hasLiveRacks && !parsed.nodeStyles) {
    throw new Error('缺少 racks / liveRacks / nodeStyles 字段');
  }
  const nextRacks = hasRacks ? parsed.racks! : current.racks;
  const nextLiveRacks = hasLiveRacks ? parsed.liveRacks! : current.liveRacks;
  const nextApi = parsed.api ? { ...current.api, ...parsed.api } : current.api;
  const activePool = nextApi.mode === 'live' && nextLiveRacks ? nextLiveRacks : nextRacks;
  const activeRackId =
    parsed.activeRackId && activePool.some((r) => r.id === parsed.activeRackId)
      ? parsed.activeRackId
      : activePool[0]?.id ?? current.activeRackId;

  const legacy = parsed as Partial<AppConfig> & { cameraPreset?: string };
  return {
    ...current,
    viewAngle:
      legacy.viewAngle !== undefined || legacy.cameraPreset !== undefined
        ? normalizeViewAngle(legacy.viewAngle, legacy.cameraPreset)
        : current.viewAngle,
    atmosphere:
      parsed.atmosphere !== undefined ? normalizeAtmosphere(parsed.atmosphere) : current.atmosphere,
    uiStyle: parsed.uiStyle !== undefined ? normalizeUiStyle(parsed.uiStyle) : current.uiStyle,
    scale: parsed.scale === 'compact' || parsed.scale === 'standard' ? parsed.scale : current.scale,
    showStrip: typeof parsed.showStrip === 'boolean' ? parsed.showStrip : current.showStrip,
    racks: nextRacks,
    liveRacks: nextLiveRacks,
    nodeStyles: parsed.nodeStyles ? { ...current.nodeStyles, ...parsed.nodeStyles } : current.nodeStyles,
    api: nextApi,
    activeRackId,
  };
}

export function autoDetectModel(node: NodeInfo): ChassisModel {
  const cores = node.cpu_cores || 1;
  const ramGb = (node.mem_total || 1024 ** 3) / 1024 ** 3;
  if (cores >= 16 || ramGb >= 32) return 'B3';
  if (cores >= 4 || ramGb >= 8) return 'B2';
  if (cores <= 1 && ramGb <= 1.5) return 'B4';
  return 'B1';
}

export function getEffectiveStyle(
  node: NodeInfo,
  nodeStyles: AppConfig['nodeStyles'],
): EffectiveNodeStyle {
  const custom = nodeStyles[node.uuid] ?? {};
  const model: ChassisModel = !custom.model || custom.model === 'auto' ? autoDetectModel(node) : custom.model;
  return {
    model,
    rawModel: custom.model ?? 'auto',
    finish: custom.finish ?? 'gunmetal',
    accent: custom.accent ?? 'orange',
    oled: custom.oled ?? 'cyan',
    tag: custom.tag !== undefined && custom.tag !== '' ? custom.tag : node.tag || model,
  };
}

export function getUnitHeightU(
  item: RackItem,
  nodesMap: Map<string, NodeInfo>,
  nodeStyles: AppConfig['nodeStyles'],
): number {
  if (item.type === 'pdu' || item.type === 'blank') return 1;
  const node = nodesMap.get(item.nodeId);
  if (!node) return 1;
  const model = getEffectiveStyle(node, nodeStyles).model;
  return model === 'B3' ? 4 : model === 'B2' ? 2 : 1;
}

export function estimateRackWatts(
  rack: RackCabinetData,
  nodesMap: Map<string, NodeInfo>,
  nodeStyles: AppConfig['nodeStyles'],
): number {
  return rack.items.reduce((sum, item) => {
    if (item.type !== 'node') return sum;
    const node = nodesMap.get(item.nodeId);
    if (!node || !node.online) return sum;
    const model = getEffectiveStyle(node, nodeStyles).model;
    const base = model === 'B3' ? 210 : model === 'B2' ? 85 : model === 'B1' ? 38 : 14;
    return sum + Math.round(base * (0.55 + (node.cpu / 100) * 0.75));
  }, 0);
}

export function formatBytesGiB(bytes: number): string {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1000) return `${(gib / 1000).toFixed(1)} TB`;
  return `${Math.round(gib)} GB`;
}

export function buildInitialHistory(node: NodeInfo, hours: RecordHours = 1): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const total = 24;
  const stepMin = Math.max(1, Math.round((hours * 60) / (total - 1)));
  const baseDown = Math.max(32 * KB, node.netDown || 256 * KB);
  const baseUp = Math.max(16 * KB, node.netUp || 96 * KB);
  const baseLoad = node.load1 ?? Math.max(0.1, (node.cpu / 100) * node.cpu_cores * 0.65);

  for (let i = 0; i < total; i++) {
    const minsAgo = (total - 1 - i) * stepMin;
    const label =
      minsAgo === 0
        ? '现在'
        : minsAgo >= 60
          ? `-${Math.round((minsAgo / 60) * 10) / 10}h`
          : `-${minsAgo}m`;
    if (!node.online) {
      points.push({ time: label, cpu: 0, ram: 0, ping: 0, netDown: 0, netUp: 0, load1: 0 });
      continue;
    }
    const wave = Math.sin(i * 0.55 + node.cpu_cores) * 6 + Math.cos(i * 0.32) * 4;
    const cpu = Math.max(4, Math.min(98, Math.round(node.cpu + wave)));
    const ram = Math.max(8, Math.min(96, Math.round(node.ram + wave * 0.45)));
    const ping = Math.max(6, Math.round(node.ping + Math.sin(i * 0.7) * Math.max(2, node.ping * 0.08)));
    const netWave = 0.72 + Math.sin(i * 0.62 + node.cpu_cores * 0.4) * 0.24 + Math.cos(i * 0.27) * 0.18;
    const netDown = Math.max(8 * KB, Math.round(baseDown * netWave));
    const netUp = Math.max(4 * KB, Math.round(baseUp * (0.76 + Math.cos(i * 0.58 + 0.9) * 0.28)));
    const load1 = Math.max(0.02, Math.round((baseLoad * (0.85 + Math.sin(i * 0.45) * 0.22)) * 100) / 100);
    points.push({ time: label, cpu, ram, ping, netDown, netUp, load1 });
  }
  return points;
}

function summarizePingProbe(id: string, name: string, points: PingProbeSample[]): PingProbeSeries {
  const validVals: number[] = [];
  let dropped = 0;
  let latest: number | null = null;
  let jitterSum = 0;
  let jitterPairs = 0;
  let prevValid: number | null = null;

  for (const pt of points) {
    if (pt.value !== null && Number.isFinite(pt.value) && pt.value > 0) {
      validVals.push(pt.value);
      latest = pt.value;
      if (prevValid !== null) {
        jitterSum += Math.abs(pt.value - prevValid);
        jitterPairs += 1;
      }
      prevValid = pt.value;
    } else {
      dropped += 1;
    }
  }

  const sorted = validVals.slice().sort((a, b) => a - b);
  const min = sorted.length > 0 ? Math.round(sorted[0] * 10) / 10 : null;
  const max = sorted.length > 0 ? Math.round(sorted[sorted.length - 1] * 10) / 10 : null;
  const avg =
    validVals.length > 0 ? Math.round((validVals.reduce((s, v) => s + v, 0) / validVals.length) * 10) / 10 : null;
  const p95Idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1));
  const p95 = sorted.length > 0 ? Math.round(sorted[p95Idx] * 10) / 10 : null;
  const jitter = jitterPairs > 0 ? Math.round((jitterSum / jitterPairs) * 10) / 10 : null;
  const loss = points.length > 0 ? Math.round((dropped / points.length) * 1000) / 10 : 0;

  return {
    id,
    name,
    latest: latest !== null ? Math.round(latest * 10) / 10 : null,
    min,
    avg,
    p95,
    max,
    jitter,
    loss,
    totalSamples: points.length,
    points,
  };
}

export function buildInitialPingProbes(node: NodeInfo, hours: RecordHours = 1): PingProbeSeries[] {
  const total = 24;
  const stepMin = Math.max(1, Math.round((hours * 60) / (total - 1)));
  const seed = node.uuid.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const probeDefs = [
    { id: 'demo-ct', name: '上海电信 CT', mult: 1.0, jitterPct: 0.055, dropAt: -1 },
    { id: 'demo-cu', name: '北京联通 CU', mult: 1.16, jitterPct: 0.085, dropAt: node.ping > 120 ? 14 : -1 },
    { id: 'demo-cm', name: '广州移动 CM', mult: 0.94, jitterPct: 0.11, dropAt: node.ping > 100 ? 8 : -1 },
  ];

  return probeDefs.map((def, pIdx) => {
    const base = Math.max(6, node.ping * def.mult);
    const points: PingProbeSample[] = [];
    for (let i = 0; i < total; i++) {
      const minsAgo = (total - 1 - i) * stepMin;
      const label =
        minsAgo === 0
          ? '现在'
          : minsAgo >= 60
            ? `-${Math.round((minsAgo / 60) * 10) / 10}h`
            : `-${minsAgo}m`;
      if (!node.online) {
        points.push({ time: label, value: null });
        continue;
      }
      if (def.dropAt === i) {
        points.push({ time: label, value: null });
        continue;
      }
      const wave =
        Math.sin(i * 0.58 + pIdx * 1.9 + (seed % 7)) * base * def.jitterPct +
        Math.cos(i * 0.29 + pIdx) * base * (def.jitterPct * 0.65);
      const spike = i === ((seed + pIdx * 5) % (total - 4)) + 2 ? base * 0.16 : 0;
      const val = Math.max(4, Math.round((base + wave + spike) * 10) / 10);
      points.push({ time: label, value: val });
    }
    return summarizePingProbe(def.id, def.name, points);
  });
}

export function appendDemoPingSample(
  existing: PingProbeSeries[],
  node: NodeInfo,
  timeLabel: string,
): PingProbeSeries[] {
  const baseList = existing.length > 0 ? existing : buildInitialPingProbes(node);
  const mults = [1.0, 1.16, 0.94];
  return baseList.map((probe, idx) => {
    const mult = mults[idx] ?? 1.05;
    let nextVal: number | null = null;
    if (node.online && node.ping > 0) {
      const dropChance = node.ping > 120 && idx > 0 ? 0.025 : 0.005;
      if (Math.random() >= dropChance) {
        const target = node.ping * mult;
        const delta = (Math.random() - 0.48) * Math.max(1.8, target * 0.09);
        nextVal = Math.max(4, Math.round((target + delta) * 10) / 10);
      }
    }
    const nextPoints = [...probe.points.slice(-23), { time: timeLabel, value: nextVal }];
    return summarizePingProbe(probe.id, probe.name, nextPoints);
  });
}
