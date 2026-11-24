export type ChassisModel = 'B1' | 'B2' | 'B3' | 'B4';
export type ModelSelection = 'auto' | ChassisModel;
export type ChassisFinish = 'gunmetal' | 'obsidian' | 'silver' | 'cream';
export type CabinetTheme = 'silver' | 'obsidian' | 'titanium';
export type AccentId = 'orange' | 'cyan' | 'green' | 'amber' | 'purple' | 'red';
export type OledId = 'cyan' | 'amber' | 'green' | 'ice';
export type ScaleMode = 'standard' | 'compact';
export type DrawerTab = 'builder' | 'style' | 'telemetry' | 'api';
export type DataSourceMode = 'demo' | 'live';
export type RecordHours = 1 | 6 | 24;
export type ApiConnectionStatus = 'demo' | 'connecting' | 'live' | 'degraded' | 'auth_required' | 'error';
export type AdminAuthStatus = 'checking' | 'authenticated' | 'guest' | 'remote_readonly';
export type LayoutSyncSource = 'server' | 'local_draft' | 'auto';
export type RackViewAngle = 'side' | 'front';
export type StageViewMode = 'rack' | 'map';

export type CabinetThemePreference = 'auto' | CabinetTheme;

export interface KomariThemeSettings {
  defaultAtmosphere?: RoomAtmosphere;
  defaultViewAngle?: RackViewAngle;
  defaultStageView?: StageViewMode;
  defaultCabinetTheme?: CabinetThemePreference;
  showStatusStrip?: boolean;
  compactRackWidth?: boolean;
  enablePingPolling?: boolean;
  recordHours?: RecordHours;
  showAdminLink?: boolean;
  customHallTitle?: string;
  rackLayoutJson?: string;
}

export interface KomariMeInfo {
  loggedIn: boolean;
  username?: string;
  uuid?: string;
  ssoType?: string;
}

export interface PersistedRackLayoutPayload {
  version: 1;
  racks: RackCabinetData[];
  nodeStyles: Record<string, NodeStyleOverride>;
  updatedAt?: string;
  updatedBy?: string;
}

export type RoomAtmosphere = 'studio-dark' | 'studio-light';

export interface NodeInfo {
  uuid: string;
  name: string;
  region: string;
  group?: string;
  tags?: string;
  cpu_cores: number;
  mem_total: number;
  swap_total?: number;
  disk_total: number;
  os: string;
  kernel_version?: string;
  cpu_name: string;
  gpu_name?: string;
  arch?: string;
  virtualization?: string;
  tag: string;
  online: boolean;
  cpu: number;
  ram: number;
  ramUsed?: number;
  swap?: number;
  swapUsed?: number;
  disk: number;
  diskUsed?: number;
  netUp: number;
  netDown: number;
  totalUp?: number;
  totalDown?: number;
  trafficLimit?: number;
  trafficLimitType?: string;
  expiredAt?: string;
  load1?: number;
  load5?: number;
  load15?: number;
  tcp?: number;
  udp?: number;
  process?: number;
  message?: string;
  ping: number;
  uptime: string;
  updatedAt?: string;
}

export interface NodeStyleOverride {
  model?: ModelSelection;
  finish?: ChassisFinish;
  accent?: AccentId;
  oled?: OledId;
  tag?: string;
}

export interface EffectiveNodeStyle {
  model: ChassisModel;
  rawModel: ModelSelection;
  finish: ChassisFinish;
  accent: AccentId;
  oled: OledId;
  tag: string;
}

export type RackItem =
  | { uid: string; type: 'node'; nodeId: string }
  | { uid: string; type: 'pdu'; label?: string }
  | { uid: string; type: 'blank'; label?: string };

export interface RackCabinetData {
  id: string;
  name: string;
  theme: CabinetTheme;
  items: RackItem[];
}

export interface ApiConnectionConfig {
  mode: DataSourceMode;
  baseUrl: string;
  recordHours: RecordHours;
}

export interface KomariPublicInfo {
  sitename: string;
  description: string;
  allow_cors: boolean;
  private_site: boolean;
  record_enabled: boolean;
  record_preserve_time?: number;
  ping_record_preserve_time?: number;
  theme?: string;
  theme_settings?: Record<string, unknown>;
  custom_head?: string;
  custom_body?: string;
}

export interface AppConfig {
  viewAngle: RackViewAngle;
  atmosphere: RoomAtmosphere;
  scale: ScaleMode;
  activeRackId: string;
  showStrip: boolean;
  racks: RackCabinetData[];
  liveRacks?: RackCabinetData[];
  nodeStyles: Record<string, NodeStyleOverride>;
  api: ApiConnectionConfig;
}

export interface TelemetryPoint {
  time: string;
  cpu: number;
  ram: number;
  ping: number;
  netDown?: number;
  netUp?: number;
  load1?: number;
}

export interface PingProbeSample {
  time: string;
  value: number | null;
}

export interface PingProbeSeries {
  id: string;
  name: string;
  latest: number | null;
  min: number | null;
  avg: number | null;
  p95: number | null;
  max: number | null;
  jitter: number | null;
  loss: number;
  totalSamples: number;
  points: PingProbeSample[];
}

export interface NodeTelemetryBundle {
  points: TelemetryPoint[];
  pingProbes: PingProbeSeries[];
  latestPing: number | null;
}
