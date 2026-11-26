import { Button } from '@ui-sdk/react/button';
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@ui-sdk/react/menu';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { Separator } from '@ui-sdk/react/separator';
import { useShortcutHint } from '@ui-sdk/react/shortcuts';
import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
} from '@ui-sdk/react/toolbar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui-sdk/react/tooltip';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  PanelRight,
  Plug,
  Search,
  Server,
  SlidersHorizontal,
  UploadCloud,
  Wrench,
} from 'lucide-react';
import { ATMOSPHERES, UI_STYLES, VIEW_ANGLES } from '@/data/fleet';
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
  UiStyle,
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
  uiStyle: UiStyle;
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
  onChangeUiStyle: (uiStyle: UiStyle) => void;
  onToggleScale: () => void;
  onToggleStrip: () => void;
  onToggleServerHud: () => void;
  onToggleDrawer: () => void;
  onToggleEditMode: () => void;
  onPublishLayout: () => void;
  onOpenApiTab: () => void;
  onOpenCommandPalette: () => void;
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
  uiStyle,
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
  onChangeUiStyle,
  onToggleScale,
  onToggleStrip,
  onToggleServerHud,
  onToggleDrawer,
  onToggleEditMode,
  onPublishLayout,
  onOpenApiTab,
  onOpenCommandPalette,
}: FloatingHudProps) {
  const cmdHint = useShortcutHint('mod+k');
  const drawerHint = useShortcutHint('mod+i');

  const statusTone =
    apiStatus === 'live'
      ? 'live'
      : apiStatus === 'error'
        ? 'err'
        : apiStatus === 'connecting' || apiStatus === 'degraded' || apiStatus === 'auth_required'
          ? 'warn'
          : 'demo';

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
      <header className="kdc-topbar">
        <div className="kdc-topbar-inner">
          <div className="kdc-topbar-left">
            <Button className="kdc-brand-btn" onClick={onOpenApiTab}>
              <span className={`kdc-sig-dot is-${statusTone}`} aria-hidden="true" />
              <span className="kdc-brand-name">{siteName}</span>
              <span className="kdc-mono-tag">{statusText}</span>
            </Button>

            <Separator orientation="vertical" className="kdc-topbar-sep hud-hide-sm" />

            <div className="kdc-fleet-metrics hud-hide-sm" aria-label="集群概览">
              <span className="kdc-metric-pair">
                <strong>
                  {onlineNodes}/{totalNodes}
                </strong>
                <span>在线</span>
              </span>
              <span className="kdc-metric-pair hud-hide-lg">
                <strong>{formatNetSpeed(totalNetDown)}</strong>
                <span>下行</span>
              </span>
            </div>
          </div>

          <div className="kdc-topbar-center">
            <SegmentedControl
              aria-label="主视图模式"
              value={stageView}
              onValueChange={(next) => {
                if (next && next !== stageView) onToggleStageView();
              }}
              className="kdc-view-seg"
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="rack" className="kdc-seg-item">
                <Server size={13} aria-hidden="true" />
                <span>机柜</span>
              </SegmentedControlItem>
              <SegmentedControlItem value="map" className="kdc-seg-item">
                <Globe size={13} aria-hidden="true" />
                <span>全球态势</span>
                {regionCount > 0 && <span className="kdc-seg-count">{regionCount}</span>}
              </SegmentedControlItem>
            </SegmentedControl>
          </div>

          <div className="kdc-topbar-right">
            {editMode && hasUnpublishedChanges && dataMode === 'live' && (
              <Button
                data-variant="solid"
                className="kdc-publish-btn"
                onClick={onPublishLayout}
                disabled={isPublishingLayout}
              >
                <UploadCloud size={13} aria-hidden="true" />
                <span>{isPublishingLayout ? '发布中…' : '发布布局'}</span>
              </Button>
            )}

            <Button
              className="kdc-search-btn"
              onClick={onOpenCommandPalette}
              aria-label="搜索节点与指令"
              aria-keyshortcuts={cmdHint.ariaKeyshortcuts}
            >
              <Search size={13} aria-hidden="true" />
              <span className="kdc-search-label hud-hide-md">搜索节点…</span>
              <kbd className="kdc-kbd hud-hide-md" aria-hidden="true">
                {cmdHint.text}
              </kbd>
            </Button>

            <Menu>
              <MenuTrigger className="kdc-menu-btn" aria-label="控制台与显示设置">
                <SlidersHorizontal size={13} aria-hidden="true" />
                <span className="hud-hide-sm">控制台</span>
                {editMode && <span className="kdc-edit-pip" aria-label="编排模式已开启" />}
              </MenuTrigger>
              <MenuContent align="end" sideOffset={8} className="kdc-menu-content">
                <MenuRadioGroup
                  name="atmosphere"
                  value={atmosphere}
                  onValueChange={(next) => {
                    if (next === 'studio-dark' || next === 'studio-light') {
                      onChangeAtmosphere(next);
                    }
                  }}
                >
                  <MenuGroupLabel>影棚布光</MenuGroupLabel>
                  {ATMOSPHERES.map((a) => (
                    <MenuRadioItem key={a.id} value={a.id} className="kdc-menu-item">
                      <MenuItemIndicator keepMounted className="kdc-menu-ind">
                        <Check size={12} aria-hidden="true" />
                      </MenuItemIndicator>
                      <span className="kdc-swatch-dot" style={{ background: a.swatch }} />
                      <span>{a.label}</span>
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>

                <MenuSeparator />

                <MenuRadioGroup
                  name="uiStyle"
                  value={uiStyle}
                  onValueChange={(next) => {
                    if (next === 'tactile' || next === 'glass') {
                      onChangeUiStyle(next);
                    }
                  }}
                >
                  <MenuGroupLabel>界面质感</MenuGroupLabel>
                  {UI_STYLES.map((styleMeta) => (
                    <MenuRadioItem key={styleMeta.id} value={styleMeta.id} className="kdc-menu-item">
                      <MenuItemIndicator keepMounted className="kdc-menu-ind">
                        <Check size={12} aria-hidden="true" />
                      </MenuItemIndicator>
                      <span>{styleMeta.label}</span>
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>

                <MenuSeparator />

                <MenuGroup>
                  <MenuGroupLabel>界面显示</MenuGroupLabel>
                  <MenuCheckboxItem
                    value="server-hud"
                    checked={showServerHud}
                    onCheckedChange={() => onToggleServerHud()}
                    className="kdc-menu-item"
                  >
                    <MenuItemIndicator keepMounted className="kdc-menu-ind">
                      <Check size={12} aria-hidden="true" />
                    </MenuItemIndicator>
                    <span>节点悬浮遥测卡</span>
                  </MenuCheckboxItem>
                  <MenuCheckboxItem
                    value="status-strip"
                    checked={showStrip}
                    onCheckedChange={() => onToggleStrip()}
                    className="kdc-menu-item"
                  >
                    <MenuItemIndicator keepMounted className="kdc-menu-ind">
                      <Check size={12} aria-hidden="true" />
                    </MenuItemIndicator>
                    <span>机箱下沿状态条</span>
                  </MenuCheckboxItem>
                  <MenuCheckboxItem
                    value="compact-width"
                    checked={scale === 'compact'}
                    onCheckedChange={() => onToggleScale()}
                    className="kdc-menu-item"
                  >
                    <MenuItemIndicator keepMounted className="kdc-menu-ind">
                      <Check size={12} aria-hidden="true" />
                    </MenuItemIndicator>
                    <span>紧凑机柜宽度</span>
                  </MenuCheckboxItem>
                </MenuGroup>

                <MenuSeparator />

                <MenuGroup>
                  <MenuGroupLabel>操作面板</MenuGroupLabel>
                  <MenuItem value="toggle-drawer" onSelect={onToggleDrawer} className="kdc-menu-item is-action">
                    <span className="kdc-menu-ico" aria-hidden="true">
                      <PanelRight size={13} />
                    </span>
                    <span>{drawerOpen ? '收起检视抽屉' : '打开遥测 / 编排 / 涂装抽屉'}</span>
                  </MenuItem>
                  <MenuItem
                    value="toggle-edit"
                    onSelect={onToggleEditMode}
                    disabled={!canEnterEditMode && !editMode && dataMode === 'live'}
                    className="kdc-menu-item is-action"
                  >
                    <span className="kdc-menu-ico" aria-hidden="true">
                      <Wrench size={13} />
                    </span>
                    <span>{editButtonLabel}</span>
                  </MenuItem>
                  <MenuItem value="open-api" onSelect={onOpenApiTab} className="kdc-menu-item is-action">
                    <span className="kdc-menu-ico" aria-hidden="true">
                      <Plug size={13} />
                    </span>
                    <span>Komari 数据源与接口</span>
                  </MenuItem>
                  {showAdminLink && (
                    <MenuItem
                      value="admin-link"
                      className="kdc-menu-item is-action"
                      render={
                        <a
                          href={adminUrl}
                          target={isSameOrigin ? undefined : '_blank'}
                          rel={isSameOrigin ? undefined : 'noreferrer'}
                        />
                      }
                    >
                      <span className="kdc-menu-ico" aria-hidden="true">
                        <ExternalLink size={13} />
                      </span>
                      <span>前往 Komari 后台 (/admin)</span>
                    </MenuItem>
                  )}
                </MenuGroup>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </header>

      {stageView === 'rack' && (
        <div className="kdc-dock-wrap">
          <Toolbar aria-label="机柜切换与视角工具栏" className="kdc-dock-toolbar">
            {racks.length > 1 ? (
              <div className="kdc-dock-racks">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <ToolbarButton
                        className="kdc-dock-icon-btn"
                        aria-label="上一座机柜"
                        onClick={() => stepRack(-1)}
                      />
                    }
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent side="top">上一座机柜 (←)</TooltipContent>
                </Tooltip>

                <SegmentedControl
                  aria-label="选择机柜"
                  value={activeRack?.id ?? ''}
                  onValueChange={(next) => {
                    if (next && next !== activeRack?.id) onSelectRack(next);
                  }}
                  className="kdc-rack-seg"
                >
                  <SegmentedControlIndicator />
                  {racks.map((rack, idx) => {
                    const shortName = rack.name.split('·')[0]?.trim() || `R0${idx + 1}`;
                    return (
                      <SegmentedControlItem
                        key={rack.id}
                        value={rack.id}
                        className="kdc-rack-seg-item"
                        title={rack.name}
                      >
                        {shortName}
                      </SegmentedControlItem>
                    );
                  })}
                </SegmentedControl>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <ToolbarButton
                        className="kdc-dock-icon-btn"
                        aria-label="下一座机柜"
                        onClick={() => stepRack(1)}
                      />
                    }
                  >
                    <ChevronRight size={14} aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent side="top">下一座机柜 (→)</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <span className="kdc-single-rack-label">{activeRack?.name || 'RACK-01'}</span>
            )}

            <ToolbarSeparator className="kdc-dock-sep" />

            <SegmentedControl
              aria-label="机柜展示视角"
              value={viewAngle}
              onValueChange={(next) => {
                if (next === 'side' || next === 'front') onChangeViewAngle(next);
              }}
              className="kdc-angle-seg"
            >
              <SegmentedControlIndicator />
              {ANGLE_ORDER.map((ang) => {
                const spec = VIEW_ANGLES[ang];
                return (
                  <SegmentedControlItem
                    key={ang}
                    value={ang}
                    className="kdc-angle-seg-item"
                    title={spec.label}
                  >
                    {spec.short}
                  </SegmentedControlItem>
                );
              })}
            </SegmentedControl>

            <ToolbarButton
              className="kdc-angle-mobile-btn"
              onClick={() => onChangeViewAngle(viewAngle === 'side' ? 'front' : 'side')}
              aria-label="切换机柜透视角度"
            >
              {viewAngle === 'side' ? '15°' : '正视'}
            </ToolbarButton>

            <ToolbarSeparator className="kdc-dock-sep" />

            <Tooltip>
              <TooltipTrigger
                render={
                  <ToolbarButton
                    className={`kdc-dock-inspector-btn${drawerOpen ? ' is-open' : ''}`}
                    onClick={onToggleDrawer}
                    aria-pressed={drawerOpen}
                    aria-keyshortcuts={drawerHint.ariaKeyshortcuts}
                  />
                }
              >
                <PanelRight size={13} aria-hidden="true" />
                <span className="hud-hide-xs">检视</span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {drawerOpen ? '收起检视抽屉' : '打开检视抽屉'} ({drawerHint.text})
              </TooltipContent>
            </Tooltip>
          </Toolbar>
        </div>
      )}
    </>
  );
}
