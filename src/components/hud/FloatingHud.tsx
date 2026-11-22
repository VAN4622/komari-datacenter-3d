import { ATMOSPHERES, CAMERA_PRESETS } from '@/data/fleet';
import { formatNetSpeed } from '@/lib/formatters';
import type {
  AdminAuthStatus,
  ApiConnectionStatus,
  CameraControlMode,
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
  totalNetDown: number;
  totalNetUp: number;
  rackCount: number;
  cameraPreset: CameraPreset;
  cameraControlMode: CameraControlMode;
  zoomPercent: number;
  cameraCustomized: boolean;
  atmosphere: RoomAtmosphere;
  scale: ScaleMode;
  showStrip: boolean;
  drawerOpen: boolean;
  showAdminLink: boolean;
  adminUrl: string;
  isSameOrigin: boolean;
  adminAuthStatus: AdminAuthStatus;
  adminUsername?: string;
  canEnterEditMode: boolean;
  editMode: boolean;
  hasUnpublishedChanges: boolean;
  isPublishingLayout: boolean;
  onSelectPreset: (preset: CameraPreset) => void;
  onToggleCameraControlMode: () => void;
  onResetCamera: () => void;
  onZoomStep: (delta: number) => void;
  onChangeAtmosphere: (atmosphere: RoomAtmosphere) => void;
  onToggleScale: () => void;
  onToggleStrip: () => void;
  onToggleDrawer: () => void;
  onToggleEditMode: () => void;
  onPublishLayout: () => void;
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
  totalNetDown,
  totalNetUp,
  rackCount,
  cameraPreset,
  cameraControlMode,
  zoomPercent,
  cameraCustomized,
  atmosphere,
  scale,
  showStrip,
  drawerOpen,
  showAdminLink,
  adminUrl,
  isSameOrigin,
  adminAuthStatus,
  adminUsername,
  canEnterEditMode,
  editMode,
  hasUnpublishedChanges,
  isPublishingLayout,
  onSelectPreset,
  onToggleCameraControlMode,
  onResetCamera,
  onZoomStep,
  onChangeAtmosphere,
  onToggleScale,
  onToggleStrip,
  onToggleDrawer,
  onToggleEditMode,
  onPublishLayout,
  onOpenApiTab,
}: FloatingHudProps) {
  const statusDotClass =
    apiStatus === 'live'
      ? 'is-live'
      : apiStatus === 'error'
        ? 'is-err'
        : apiStatus === 'connecting' || apiStatus === 'degraded' || apiStatus === 'auth_required'
          ? 'is-warn'
          : 'is-demo';

  const statusText =
    dataMode === 'demo'
      ? 'DEMO'
      : apiStatus === 'live'
        ? 'LIVE'
        : apiStatus === 'auth_required'
          ? 'PRIVATE'
          : apiStatus === 'connecting'
            ? 'SYNC'
            : apiStatus === 'degraded'
              ? 'RETRY'
              : 'OFFLINE';

  const editButtonLabel = editMode
    ? dataMode === 'live'
      ? '退出编排'
      : '退出演示编排'
    : dataMode === 'live'
      ? adminAuthStatus === 'authenticated'
        ? `管理员编排${adminUsername ? ` · ${adminUsername}` : ''}`
        : adminAuthStatus === 'checking'
          ? '鉴权中…'
          : '只读监看'
      : '演示编排';

  const editButtonTitle = editMode
    ? '点击切回只读监看模式'
    : canEnterEditMode
      ? dataMode === 'live'
        ? '已验证 Komari 管理员会话，点击进入机柜编排模式'
        : '进入本地演示编排模式'
      : dataMode === 'live' && !isSameOrigin
        ? '远程跨域连接仅支持只读监看'
        : '当前为访客只读模式，请先登录 Komari 后台 (/admin)';

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
            <span
              className="hud-metric"
              title={`总下行 ${formatNetSpeed(totalNetDown)} · 总上行 ${formatNetSpeed(totalNetUp)}`}
            >
              <b>↓{formatNetSpeed(totalNetDown, true)}</b>
              <em>· ↑{formatNetSpeed(totalNetUp, true)}</em>
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
          {showAdminLink && (
            <>
              <span className="hud-vsep" aria-hidden="true" />
              <a
                className="hud-admin-link"
                href={adminUrl}
                target={isSameOrigin ? undefined : '_blank'}
                rel={isSameOrigin ? undefined : 'noreferrer'}
                title="打开 Komari 管理后台 (/admin)"
              >
                后台
              </a>
            </>
          )}
        </div>
      </header>

      {/* Top-Right 3D Scene Switcher, Admin Auth Gate & Drawer Toggle */}
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
          className={`hud-pill hud-edit-toggle${editMode ? ' is-editing' : canEnterEditMode ? ' is-ready' : ' is-readonly'}`}
          onClick={onToggleEditMode}
          title={editButtonTitle}
        >
          <i className={`hud-auth-dot${editMode ? ' is-editing' : canEnterEditMode ? ' is-auth' : ''}`} />
          <span>{editButtonLabel}</span>
        </button>

        {editMode && dataMode === 'live' && isSameOrigin && adminAuthStatus === 'authenticated' && hasUnpublishedChanges && (
          <button
            type="button"
            className="hud-pill hud-publish-btn"
            onClick={onPublishLayout}
            disabled={isPublishingLayout}
            title="将当前机柜编排保存到 Komari 服务端，所有访客刷新即可生效"
          >
            <span>{isPublishingLayout ? '发布中…' : '发布布局'}</span>
          </button>
        )}

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
          <span>{drawerOpen ? '收起面板' : '检视面板'}</span>
        </button>
      </div>

      {/* Bottom-Center Floating Spatial 2.5D Camera Dock */}
      <nav className="hud-bottom-dock" aria-label="2.5D 机房视角与舞台控制">
        <div className="hud-pill hud-camera-pill">
          <div className="hud-preset-group" role="group" aria-label="2.5D 机房机位预设">
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

          <button
            type="button"
            className={`hud-mini-toggle${cameraControlMode === 'locked25d' ? ' is-active' : ''}`}
            onClick={onToggleCameraControlMode}
            title={
              cameraControlMode === 'locked25d'
                ? '当前为固定 2.5D 视角（锁定角度，仅平移与定焦缩放）；点击切换受限微倾'
                : '当前为受限微倾 2.5D 视角（允许小角度倾斜观察细节）；点击切换固定 2.5D'
            }
          >
            {cameraControlMode === 'locked25d' ? '2.5D 锁定' : '2.5D 微倾'}
          </button>

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
            title="在每台服务器下方显示独立遥测状态条"
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

        <p className="hud-orbit-hint">
          {cameraControlMode === 'locked25d'
            ? '固定 2.5D 视角 · 拖拽沿机柜列平移 · 滚轮定焦缩放 · 点击机柜或服务器检视'
            : '2.5D 受限微倾 · 小幅左键微倾 · 右键平移 · 滚轮缩放 · 锁定防穿模边界'}
        </p>
      </nav>
    </>
  );
}
