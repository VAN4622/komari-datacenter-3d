import { useEffect, useRef, useState } from 'react';
import { ATMOSPHERES, VIEW_ANGLES } from '@/data/fleet';
import { formatNetSpeed } from '@/lib/formatters';
import type {
  AdminAuthStatus,
  ApiConnectionStatus,
  DataSourceMode,
  RackCabinetData,
  RackViewAngle,
  RoomAtmosphere,
  ScaleMode,
  StageViewMode,
} from '@/types/rack';

interface FloatingHudProps {
  siteName: string;
  dataMode: DataSourceMode;
  apiStatus: ApiConnectionStatus;
  onlineNodes: number;
  totalNodes: number;
  regionCount: number;
  totalNetDown: number;
  stageView: StageViewMode;
  viewAngle: RackViewAngle;
  atmosphere: RoomAtmosphere;
  scale: ScaleMode;
  showStrip: boolean;
  showServerHud: boolean;
  drawerOpen: boolean;
  racks: RackCabinetData[];
  activeRackId: string;
  showAdminLink: boolean;
  adminUrl: string;
  isSameOrigin: boolean;
  adminAuthStatus: AdminAuthStatus;
  adminUsername?: string;
  canEnterEditMode: boolean;
  editMode: boolean;
  hasUnpublishedChanges: boolean;
  isPublishingLayout: boolean;
  onToggleStageView: () => void;
  onSelectRack: (rackId: string, dir?: 'next' | 'prev') => void;
  onChangeViewAngle: (angle: RackViewAngle) => void;
  onChangeAtmosphere: (atmosphere: RoomAtmosphere) => void;
  onToggleScale: () => void;
  onToggleStrip: () => void;
  onToggleServerHud: () => void;
  onToggleDrawer: () => void;
  onToggleEditMode: () => void;
  onPublishLayout: () => void;
  onOpenApiTab: () => void;
}

const ANGLE_ORDER: RackViewAngle[] = ['side', 'front'];

export function FloatingHud({
  siteName,
  dataMode,
  apiStatus,
  onlineNodes,
  totalNodes,
  regionCount,
  totalNetDown,
  stageView,
  viewAngle,
  atmosphere,
  scale,
  showStrip,
  showServerHud,
  drawerOpen,
  racks,
  activeRackId,
  showAdminLink,
  adminUrl,
  isSameOrigin,
  adminAuthStatus,
  adminUsername,
  canEnterEditMode,
  editMode,
  hasUnpublishedChanges,
  isPublishingLayout,
  onToggleStageView,
  onSelectRack,
  onChangeViewAngle,
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
        ? `进入编排 (${adminUsername || '管理员'})`
        : adminAuthStatus === 'remote_readonly'
          ? '远程只读'
          : '需管理员登录'
      : '进入演示编排';

  const activeRackIdx = Math.max(
    0,
    racks.findIndex((r) => r.id === activeRackId),
  );
  const activeRack = racks[activeRackIdx] ?? racks[0];

  const stepRack = (delta: -1 | 1) => {
    if (racks.length <= 1) return;
    const nextIdx = (activeRackIdx + delta + racks.length) % racks.length;
    onSelectRack(racks[nextIdx].id, delta > 0 ? 'next' : 'prev');
  };

  return (
    <>
      {/* Minimalist Top Bar: Left Brand/Live Status, Right Global Map + Single Collapsible Menu */}
      <header className="hud-top">
        <button
          type="button"
          className="hud-pill hud-brand-pill"
          onClick={onOpenApiTab}
          title="点击查看 Komari 接口状态与连接配置"
        >
          <span className={`hud-dot ${statusDotClass}`} />
          <span className="hud-site-name">{siteName}</span>
          <span className="hud-badge">{statusText}</span>
          <span className="hud-vsep hud-hide-sm" aria-hidden="true" />
          <span className="hud-metric hud-hide-sm">
            <b>
              {onlineNodes}/{totalNodes}
            </b>
            <span>在线</span>
          </span>
          <span className="hud-metric hud-hide-md">
            <b>{formatNetSpeed(totalNetDown)}</b>
            <span>下行</span>
          </span>
        </button>

        <div className="hud-right-group">
          {editMode && hasUnpublishedChanges && dataMode === 'live' && (
            <button
              type="button"
              className="hud-pill hud-publish-pill"
              onClick={onPublishLayout}
              disabled={isPublishingLayout}
              title="将当前机柜编排与涂装发布到 Komari 服务端"
            >
              <span className="hud-publish-dot" />
              <span>{isPublishingLayout ? '发布中…' : '发布布局'}</span>
            </button>
          )}

          {/* Global Node Overview World Map Toggle */}
          <button
            type="button"
            className={`hud-pill hud-map-toggle${stageView === 'map' ? ' is-active' : ''}`}
            onClick={() => {
              setMenuOpen(false);
              onToggleStageView();
            }}
            aria-pressed={stageView === 'map'}
            title={stageView === 'map' ? '返回拟物机柜展台' : '打开全球节点态势地图'}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
              <ellipse cx="8" cy="8" rx="2.9" ry="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2.4 8h11.2M3.3 4.8h9.4M3.3 11.2h9.4" stroke="currentColor" strokeWidth="1.15" />
            </svg>
            <span className="hud-btn-text">{stageView === 'map' ? '返回机柜' : '全球节点'}</span>
            {stageView !== 'map' && regionCount > 0 && <span className="hud-map-count">{regionCount}区</span>}
          </button>

          {/* Single Collapsible Studio Menu */}
          <div className="hud-menu-wrap" ref={menuWrapRef}>
            <button
              type="button"
              className={`hud-pill hud-menu-trigger${menuOpen || drawerOpen ? ' is-active' : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              title="影棚光效、视图选项与机柜编排"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M2.5 4.2h11M2.5 8h11M2.5 11.8h11"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <span className="hud-btn-text">菜单</span>
              {editMode && <span className="hud-edit-pip" aria-label="编排中" />}
            </button>

            {menuOpen && (
              <div className="hud-popover" role="menu">
                <div className="hud-pop-section">
                  <div className="hud-pop-title">影棚布光</div>
                  <div className="hud-atmo-grid">
                    {ATMOSPHERES.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={`hud-atmo-chip${atmosphere === a.id ? ' is-active' : ''}`}
                        onClick={() => onChangeAtmosphere(a.id)}
                        title={a.subtitle}
                      >
                        <span className="hud-atmo-swatch" style={{ background: a.swatch }} />
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hud-pop-section">
                  <div className="hud-pop-title">显示选项</div>
                  <button type="button" className="hud-pop-row" onClick={onToggleServerHud}>
                    <span>节点状态浮窗</span>
                    <span className={`hud-pop-state${showServerHud ? ' is-on' : ''}`}>
                      {showServerHud ? '开启' : '隐藏'}
                    </span>
                  </button>
                  <button type="button" className="hud-pop-row" onClick={onToggleStrip}>
                    <span>机箱下沿状态条</span>
                    <span className={`hud-pop-state${showStrip ? ' is-on' : ''}`}>
                      {showStrip ? '显示' : '隐藏'}
                    </span>
                  </button>
                  <button type="button" className="hud-pop-row" onClick={onToggleScale}>
                    <span>机柜展示宽度</span>
                    <span className={`hud-pop-state${scale === 'compact' ? ' is-on' : ''}`}>
                      {scale === 'compact' ? '紧凑' : '标准'}
                    </span>
                  </button>
                </div>

                <div className="hud-pop-section">
                  <div className="hud-pop-title">控制台与编排</div>
                  <button
                    type="button"
                    className="hud-pop-row"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleDrawer();
                    }}
                  >
                    <span>{drawerOpen ? '收起详细抽屉' : '打开遥测 / 涂装 / 接口抽屉'}</span>
                    <span className="hud-pop-hint">{drawerOpen ? '已展开' : '面板'}</span>
                  </button>

                  <button
                    type="button"
                    className={`hud-pop-row${editMode ? ' is-accent' : ''}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleEditMode();
                    }}
                    disabled={!canEnterEditMode && !editMode && dataMode === 'live'}
                  >
                    <span>{editButtonLabel}</span>
                    <span className={`hud-pop-state${editMode ? ' is-on' : ''}`}>
                      {editMode ? '编排中' : canEnterEditMode ? '可解锁' : '只读'}
                    </span>
                  </button>

                  {showAdminLink && (
                    <a
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
        </div>
      </header>

      {/* Bottom-Center Ultra-Clean Rack Switcher + Subtle Angle Switch (hidden on Global Map view) */}
      {stageView === 'rack' && (
        <nav className="hud-bottom-dock" aria-label="机柜切换与视角控制">
          <div className="hud-pill hud-studio-dock">
            {racks.length > 1 ? (
              <div className="hud-rack-switcher" role="group" aria-label="切换机柜">
                <button
                  type="button"
                  className="hud-rack-arrow"
                  onClick={() => stepRack(-1)}
                  title="上一座机柜 (←)"
                  aria-label="上一座机柜"
                >
                  ‹
                </button>
                <div className="hud-rack-tabs">
                  {racks.map((r, idx) => {
                    const isActive = r.id === activeRack?.id;
                    const shortName = r.name.split('·')[0]?.trim() || `R0${idx + 1}`;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`hud-seg-btn${isActive ? ' is-active' : ''}`}
                        onClick={() => onSelectRack(r.id)}
                        title={r.name}
                      >
                        {shortName}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="hud-rack-arrow"
                  onClick={() => stepRack(1)}
                  title="下一座机柜 (→)"
                  aria-label="下一座机柜"
                >
                  ›
                </button>
              </div>
            ) : (
              <span className="hud-single-rack-label">{activeRack?.name || 'RACK-01'}</span>
            )}

            <span className="hud-vsep" aria-hidden="true" />

            <div className="hud-angle-group" role="group" aria-label="机柜展示角度">
              {ANGLE_ORDER.map((ang) => {
                const spec = VIEW_ANGLES[ang];
                const isActive = viewAngle === ang;
                return (
                  <button
                    key={ang}
                    type="button"
                    className={`hud-seg-btn hud-angle-btn${isActive ? ' is-active' : ''}`}
                    onClick={() => onChangeViewAngle(ang)}
                    title={spec.label}
                  >
                    {spec.short}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </>
  );
}
