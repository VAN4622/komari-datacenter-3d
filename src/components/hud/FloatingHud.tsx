import { ATMOSPHERES, CAMERA_PRESETS } from '@/data/fleet';
import type {
  ApiConnectionStatus,
  CameraPreset,
  DataSourceMode,
  RoomAtmosphere,
  ScaleMode,
} from '@/types/rack';

interface FloatingHudProps {
  siteName: string;
  dataMode: DataSourceMode;
  apiStatus: ApiConnectionStatus;
  onlineNodes: number;
  totalNodes: number;
  totalWatts: number;
  totalU: number;
  rackCount: number;
  cameraPreset: CameraPreset;
  zoomPercent: number;
  cameraCustomized: boolean;
  atmosphere: RoomAtmosphere;
  scale: ScaleMode;
  showStrip: boolean;
  drawerOpen: boolean;
  onSelectPreset: (preset: CameraPreset) => void;
  onResetCamera: () => void;
  onZoomStep: (delta: number) => void;
  onChangeAtmosphere: (atmosphere: RoomAtmosphere) => void;
  onToggleScale: () => void;
  onToggleStrip: () => void;
  onToggleDrawer: () => void;
  onOpenApiTab: () => void;
}

const PRESET_ORDER: CameraPreset[] = ['iso34', 'corridor', 'overhead', 'front'];

export function FloatingHud({
  siteName,
  dataMode,
  apiStatus,
  onlineNodes,
  totalNodes,
  totalWatts,
  totalU,
  rackCount,
  cameraPreset,
  zoomPercent,
  cameraCustomized,
  atmosphere,
  scale,
  showStrip,
  drawerOpen,
  onSelectPreset,
  onResetCamera,
  onZoomStep,
  onChangeAtmosphere,
  onToggleScale,
  onToggleStrip,
  onToggleDrawer,
  onOpenApiTab,
}: FloatingHudProps) {
  const statusDotClass =
    apiStatus === 'live'
      ? 'is-live'
      : apiStatus === 'error'
        ? 'is-err'
        : apiStatus === 'connecting' || apiStatus === 'degraded'
          ? 'is-warn'
          : 'is-demo';

  const statusText =
    dataMode === 'demo'
      ? 'DEMO'
      : apiStatus === 'live'
        ? 'LIVE'
        : apiStatus === 'connecting'
          ? 'SYNC'
          : apiStatus === 'degraded'
            ? 'RETRY'
            : 'OFFLINE';

  return (
    <>
      {/* Top-Left Minimal Architectural Header & Quiet Fleet Readout */}
      <header className="hud-top-left" aria-label="机房概览">
        <div className="hud-pill hud-brand-pill">
          <span className="hud-brand-mark" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2.5" width="12" height="3.2" rx="0.9" stroke="currentColor" strokeWidth="1.35" />
              <rect x="2" y="7.2" width="12" height="3.2" rx="0.9" stroke="currentColor" strokeWidth="1.35" />
              <path d="M2.5 13H13.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.55" />
            </svg>
          </span>
          <span className="hud-site-name">{siteName}</span>
          <button
            type="button"
            className="hud-link-chip"
            onClick={onOpenApiTab}
            title="查看或切换 Komari API 数据源"
          >
            <i className={`hud-led ${statusDotClass}`} />
            <span>{statusText}</span>
          </button>

          <span className="hud-vsep" aria-hidden="true" />

          <div className="hud-metrics" aria-label="机房汇总指标">
            <span className="hud-metric">
              <b>{onlineNodes}</b>
              <small>/{totalNodes}</small>
              <em>在线</em>
            </span>
            <span className="hud-metric">
              <b>{totalWatts}</b>
              <small>W</small>
            </span>
            <span className="hud-metric">
              <b>{totalU}</b>
              <small>U</small>
              <em>· {rackCount}柜</em>
            </span>
          </div>
        </div>
      </header>

      {/* Top-Right 3D Scene Switcher & Drawer Toggle */}
      <div className="hud-top-right">
        <div className="hud-pill hud-atmo-pill" role="group" aria-label="三维机房场景切换">
          {ATMOSPHERES.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`hud-atmo-btn${atmosphere === a.id ? ' is-active' : ''}`}
              onClick={() => onChangeAtmosphere(a.id)}
              title={`${a.label} · ${a.subtitle}`}
            >
              <span className="hud-atmo-dot" style={{ background: a.swatch }} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`hud-pill hud-drawer-toggle${drawerOpen ? ' is-open' : ''}`}
          onClick={onToggleDrawer}
          aria-expanded={drawerOpen}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.35" />
            <line x1="9.8" y1="2.5" x2="9.8" y2="13.5" stroke="currentColor" strokeWidth="1.35" />
          </svg>
          <span>{drawerOpen ? '收起面板' : '控制面板'}</span>
        </button>
      </div>

      {/* Bottom-Center Floating Spatial Camera Dock */}
      <nav className="hud-bottom-dock" aria-label="三维视角与舞台控制">
        <div className="hud-pill hud-camera-pill">
          <div className="hud-preset-group" role="group" aria-label="机房机位预设">
            {PRESET_ORDER.map((id) => {
              const p = CAMERA_PRESETS[id];
              const isActive = cameraPreset === id && !cameraCustomized;
              return (
                <button
                  key={id}
                  type="button"
                  className={`hud-seg-btn${isActive ? ' is-active' : ''}`}
                  onClick={() => onSelectPreset(id)}
                  title={p.label}
                >
                  {p.short}
                </button>
              );
            })}
          </div>

          <span className="hud-vsep" aria-hidden="true" />

          <div className="hud-zoom-group" aria-label="视角缩放">
            <button
              type="button"
              className="hud-icon-btn"
              onClick={() => onZoomStep(-0.08)}
              aria-label="缩小视角"
              title="缩小"
            >
              −
            </button>
            <span className="hud-zoom-val">{zoomPercent}%</span>
            <button
              type="button"
              className="hud-icon-btn"
              onClick={() => onZoomStep(0.08)}
              aria-label="放大视角"
              title="放大"
            >
              +
            </button>
          </div>

          <span className="hud-vsep" aria-hidden="true" />

          <button
            type="button"
            className={`hud-mini-toggle${scale === 'compact' ? ' is-active' : ''}`}
            onClick={onToggleScale}
            title="切换机柜标准/紧凑宽度"
          >
            {scale === 'compact' ? '紧凑' : '标准'}
          </button>

          <button
            type="button"
            className={`hud-mini-toggle${showStrip ? ' is-active' : ''}`}
            onClick={onToggleStrip}
            title="在每台服务器下方显示简明状态条"
          >
            状态条
          </button>

          {cameraCustomized && (
            <>
              <span className="hud-vsep" aria-hidden="true" />
              <button
                type="button"
                className="hud-reset-btn"
                onClick={onResetCamera}
                title="复位当前预设机位"
              >
                复位
              </button>
            </>
          )}
        </div>

        <p className="hud-orbit-hint">左键拖拽环绕 · 右键平移 · 滚轮缩放 · 点击机柜或服务器检视</p>
      </nav>
    </>
  );
}
