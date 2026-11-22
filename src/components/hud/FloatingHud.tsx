import { useEffect, useRef, useState } from 'react';
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
  totalNetDown: number;
  cameraPreset: CameraPreset;
  cameraControlMode: CameraControlMode;
  zoomPercent: number;
  cameraCustomized: boolean;
  atmosphere: RoomAtmosphere;
  scale: ScaleMode;
  showStrip: boolean;
  showServerHud: boolean;
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
  onToggleServerHud: () => void;
  onToggleDrawer: () => void;
  onToggleEditMode: () => void;
  onPublishLayout: () => void;
  onOpenApiTab: () => void;
}

const PRESET_ORDER: CameraPreset[] = ['closeup', 'front', 'iso34', 'corridor', 'overhead'];

const LOCK_MODE_META: Record<CameraControlMode, { short: string; title: string; locked: boolean }> = {
  fixed: {
    short: '机位锁定',
    title: '固定机位锁定（禁止拖拽与滚轮偏移，仅点击切换机位）；点击切换至平移缩放',
    locked: true,
  },
  locked25d: {
    short: '2.5D 平移',
    title: '固定 2.5D 角度（允许横向平移与缩放）；点击切换至受限微倾',
    locked: false,
  },
  micro_tilt: {
    short: '2.5D 微倾',
    title: '受限微倾 2.5D 视角（允许小幅倾斜观察细节）；点击切换回机位锁定',
    locked: false,
  },
};

export function FloatingHud({
  siteName,
  dataMode,
  apiStatus,
  onlineNodes,
  totalNodes,
  totalNetDown,
  cameraPreset,
  cameraControlMode,
  zoomPercent,
  cameraCustomized,
  atmosphere,
  scale,
  showStrip,
  showServerHud,
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
  onToggleServerHud,
  onToggleDrawer,
  onToggleEditMode,
  onPublishLayout,
  onOpenApiTab,
}: FloatingHudProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

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
              : 'OFF';

  const editButtonLabel = editMode
    ? dataMode === 'live'
      ? '退出编排模式'
      : '退出演示编排'
    : dataMode === 'live'
      ? adminAuthStatus === 'authenticated'
        ? `进入编排${adminUsername ? ` · ${adminUsername}` : ''}`
        : adminAuthStatus === 'checking'
          ? '鉴权检测中…'
          : '只读监看模式'
      : '进入演示编排';

  const lockMeta = LOCK_MODE_META[cameraControlMode];
  const isFixedCam = cameraControlMode === 'fixed';

  return (
    <>
      {/* Top Bar: Minimal Brand Pill (Left) & Compact Menu + Drawer Trigger (Right) */}
      <div className="hud-top-bar">
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
              title="点击查看数据源与 Komari 接口状态"
            >
              <span className={`hud-led ${statusDotClass}`} />
              <span>{statusText}</span>
            </button>

            <span className="hud-vsep hud-hide-xs" aria-hidden="true" />
            <div className="hud-metrics" aria-label="节点在线统计">
              <span className="hud-metric">
                <b>{onlineNodes}</b>
                <small>/{totalNodes}</small>
                <em>在线</em>
              </span>
              <span className="hud-metric hud-hide-sm">
                <b>↓{formatNetSpeed(totalNetDown)}</b>
              </span>
            </div>
          </div>
        </header>

        <div className="hud-top-right" ref={menuWrapRef}>
          {editMode && hasUnpublishedChanges && dataMode === 'live' && isSameOrigin && (
            <button
              type="button"
              className="hud-pill hud-publish-btn"
              onClick={onPublishLayout}
              disabled={isPublishingLayout}
              title="将当前机柜编排发布至 Komari 服务端"
            >
              <span>{isPublishingLayout ? '发布中…' : '发布布局'}</span>
            </button>
          )}

          <div className="hud-menu-wrap">
            <button
              type="button"
              className={`hud-pill hud-menu-btn${menuOpen ? ' is-open' : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="场景、显示与编排菜单"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2.5 4.5H13.5M2.5 8H13.5M2.5 11.5H13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="5.5" cy="4.5" r="1.3" fill="currentColor" />
                <circle cx="10.5" cy="8" r="1.3" fill="currentColor" />
                <circle cx="6.5" cy="11.5" r="1.3" fill="currentColor" />
              </svg>
              <span className="hud-btn-text">菜单</span>
              {editMode && <span className="hud-auth-dot is-editing" aria-label="编排模式已开启" />}
            </button>

            {menuOpen && (
              <div className="hud-menu-popover" role="menu" aria-label="机房快捷设置菜单">
                <div className="hud-pop-section">
                  <span className="hud-pop-label">机房场景</span>
                  <div className="hud-pop-atmo-grid">
                    {ATMOSPHERES.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={atmosphere === a.id}
                        className={`hud-pop-atmo-btn${atmosphere === a.id ? ' is-active' : ''}`}
                        onClick={() => onChangeAtmosphere(a.id)}
                      >
                        <span className="hud-atmo-dot" style={{ background: a.swatch }} />
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hud-pop-divider" />

                <div className="hud-pop-section">
                  <span className="hud-pop-label">显示与悬浮 HUD</span>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={showServerHud}
                    className="hud-pop-row"
                    onClick={onToggleServerHud}
                  >
                    <span>服务器状态 HUD</span>
                    <span className={`hud-switch-pill${showServerHud ? ' is-on' : ''}`}>{showServerHud ? '开' : '关'}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={showStrip}
                    className="hud-pop-row"
                    onClick={onToggleStrip}
                  >
                    <span>机下遥测状态条</span>
                    <span className={`hud-switch-pill${showStrip ? ' is-on' : ''}`}>{showStrip ? '开' : '关'}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={scale === 'compact'}
                    className="hud-pop-row"
                    onClick={onToggleScale}
                  >
                    <span>紧凑机柜宽度</span>
                    <span className={`hud-switch-pill${scale === 'compact' ? ' is-on' : ''}`}>
                      {scale === 'compact' ? '紧凑' : '标准'}
                    </span>
                  </button>
                </div>

                <div className="hud-pop-divider" />

                <div className="hud-pop-section">
                  <span className="hud-pop-label">管理与接口</span>
                  <button
                    type="button"
                    role="menuitem"
                    className={`hud-pop-row${editMode ? ' is-highlight' : ''}`}
                    onClick={() => {
                      onToggleEditMode();
                      setMenuOpen(false);
                    }}
                  >
                    <span className="hud-pop-row-lead">
                      <span
                        className={`hud-auth-dot${editMode ? ' is-editing' : canEnterEditMode ? ' is-auth' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{editButtonLabel}</span>
                    </span>
                    <span className="hud-pop-hint">{editMode ? '退出' : canEnterEditMode ? '开启' : '只读'}</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="hud-pop-row"
                    onClick={() => {
                      onOpenApiTab();
                      setMenuOpen(false);
                    }}
                  >
                    <span>数据源与接口设置</span>
                    <span className="hud-pop-hint">{statusText}</span>
                  </button>

                  {showAdminLink && (
                    <a
                      role="menuitem"
                      className="hud-pop-row hud-pop-link"
                      href={adminUrl}
                      target={isSameOrigin ? undefined : '_blank'}
                      rel={isSameOrigin ? undefined : 'noreferrer'}
                      onClick={() => setMenuOpen(false)}
                    >
                      <span>前往 Komari 后台</span>
                      <span className="hud-pop-hint">/admin</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`hud-pill hud-drawer-toggle${drawerOpen ? ' is-open' : ''}`}
            onClick={() => {
              setMenuOpen(false);
              onToggleDrawer();
            }}
            aria-expanded={drawerOpen}
            title={drawerOpen ? '收起检视面板' : '打开遥测与机柜面板'}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.35" />
              <line x1="9.8" y1="2.5" x2="9.8" y2="13.5" stroke="currentColor" strokeWidth="1.35" />
            </svg>
            <span className="hud-btn-text">{drawerOpen ? '收起' : '面板'}</span>
          </button>
        </div>
      </div>

      {/* Bottom-Center Streamlined Fixed Camera Station Dock */}
      <nav className="hud-bottom-dock" aria-label="固定机位与视角控制">
        <div className="hud-pill hud-camera-pill">
          <div className="hud-preset-group" role="group" aria-label="机房固定机位">
            {PRESET_ORDER.map((id) => {
              const p = CAMERA_PRESETS[id];
              const isActive = cameraPreset === id && (isFixedCam || !cameraCustomized);
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
            className={`hud-mini-toggle hud-lock-btn${isFixedCam ? ' is-locked' : ' is-unlocked'}`}
            onClick={onToggleCameraControlMode}
            title={lockMeta.title}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              {lockMeta.locked ? (
                <>
                  <rect x="3" y="6.2" width="8" height="5.8" rx="1.4" stroke="currentColor" strokeWidth="1.35" />
                  <path d="M4.75 6.2V4.5a2.25 2.25 0 0 1 4.5 0v1.7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <rect x="3" y="6.2" width="8" height="5.8" rx="1.4" stroke="currentColor" strokeWidth="1.35" />
                  <path d="M4.75 6.2V4.5a2.25 2.25 0 0 1 4.2-1.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                </>
              )}
            </svg>
            <span>{lockMeta.short}</span>
          </button>

          {!isFixedCam && (
            <>
              <span className="hud-vsep hud-hide-xs" aria-hidden="true" />
              <div className="hud-zoom-group hud-hide-xs" aria-label="视角缩放">
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

              {cameraCustomized && (
                <button
                  type="button"
                  className="hud-reset-btn"
                  onClick={onResetCamera}
                  title="复位当前机位"
                >
                  复位
                </button>
              )}
            </>
          )}
        </div>
      </nav>
    </>
  );
}
