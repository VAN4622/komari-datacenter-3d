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
export type ApiConnectionStatus = 'demo' | 'connecting' | 'live' | 'degraded' | 'error';

export type CameraPreset = 'iso34' | 'corridor' | 'overhead' | 'front';
export type RoomAtmosphere = 'cold-aisle' | 'cleanroom' | 'obsidian-noc' | 'showroom';

export interface NodeInfo {
  uuid: string;
  name: string;
  region: string;
  group?: string;
  tags?: string;
  cpu_cores: number;
  mem_total: number;
  disk_total: number;
  os: string;
  cpu_name: string;
  arch?: string;
  virtualization?: string;
  tag: string;
  online: boolean;
  cpu: number;
  ram: number;
  disk: number;
  netUp: number;
  netDown: number;
  totalUp?: number;
  totalDown?: number;
  load1?: number;
  tcp?: number;
  udp?: number;
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
}

export interface AppConfig {
  cameraPreset: CameraPreset;
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
}
