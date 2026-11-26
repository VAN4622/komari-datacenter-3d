import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@ui-sdk/react/alert-dialog';
import { Button } from '@ui-sdk/react/button';
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from '@ui-sdk/react/drawer';
import { Field, FieldDescription, FieldLabel } from '@ui-sdk/react/field';
import { Input } from '@ui-sdk/react/input';
import {
  Meter,
  MeterIndicator,
  MeterLabel,
  MeterTrack,
  MeterValue,
} from '@ui-sdk/react/meter';
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@ui-sdk/react/select';
import { Separator } from '@ui-sdk/react/separator';
import { Switch, SwitchThumb } from '@ui-sdk/react/switch';
import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsPanel,
  TabsTab,
} from '@ui-sdk/react/tabs';
import { Textarea } from '@ui-sdk/react/textarea';
import { Toggle } from '@ui-sdk/react/toggle';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  ExternalLink,
  Lock,
  Palette,
  Plug,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';
import { ServerUnitSvg } from '@/components/hardware/ServerChassisSvg';
import { TelemetryScope } from '@/components/hud/TelemetryScope';
import { RegionFlag } from '@/components/ui/RegionFlag';
import {
  ACCENTS,
  CABINET_THEMES,
  FINISHES,
  OLEDS,
  autoDetectModel,
  formatBytesGiB,
  getEffectiveStyle,
} from '@/data/fleet';
import { formatNetSpeed, formatTrafficBytes } from '@/lib/formatters';
import { resolveNodeGeo } from '@/lib/geoRegions';
import type {
  AdminAuthStatus,
  ApiConnectionStatus,
  AppConfig,
  CabinetTheme,
  ChassisFinish,
  DataSourceMode,
  DrawerTab,
  KomariPublicInfo,
  LayoutSyncSource,
  ModelSelection,
  NodeInfo,
  NodeStyleOverride,
  PingProbeSeries,
  RackCabinetData,
  RecordHours,
  TelemetryPoint,
} from '@/types/rack';

interface InspectorDrawerProps {
  open: boolean;
  tab: DrawerTab;
  onClose: () => void;
  onTabChange: (tab: DrawerTab) => void;
  config: AppConfig;
  racks: RackCabinetData[];
  activeRack: RackCabinetData;
  nodes: NodeInfo[];
  mountedNodeIds: Set<string>;
  selectedNode: NodeInfo | null;
  selectedNodeUidBlinking: boolean;
  telemetryHistory: TelemetryPoint[];
  pingProbes: PingProbeSeries[];
  apiStatus: ApiConnectionStatus;
  apiError: string | null;
  publicInfo: KomariPublicInfo | null;
  sameOriginDetected: boolean;
  isSameOriginLink: boolean;
  adminUrl: string;
  adminAuthStatus: AdminAuthStatus;
  adminUsername?: string;
  canEnterEditMode: boolean;
  canEdit: boolean;
  layoutSyncSource: LayoutSyncSource;
  hasServerLayout: boolean;
  hasUnpublishedChanges: boolean;
  isPublishingLayout: boolean;
  lastSyncAt: string | null;
  wsFramesCount: number;
  onToggleEditMode: () => void;
  onRecheckAdminAuth: () => void;
  onPublishLayout: () => void;
  onCopyServerLayoutJson: () => void;
  onReloadServerLayout: () => void;
  onSelectRack: (rackId: string) => void;
  onAddRack: () => void;
  onRenameRack: (rackId: string, name: string) => void;
  onDeleteActiveRack: () => void;
  onChangeRackTheme: (rackId: string, theme: CabinetTheme) => void;
  onToggleStrip: () => void;
  onMountNode: (nodeId: string) => void;
  onMountAccessory: (kind: 'pdu' | 'blank') => void;
  onMoveItem: (rackId: string, index: number, delta: -1 | 1) => void;
  onRemoveItem: (rackId: string, uid: string) => void;
  onClearActiveRack: () => void;
  onResetDefaultLayout: () => void;
  onSelectNodeById: (nodeId: string) => void;
  onUpdateNodeStyle: (nodeId: string, patch: Partial<NodeStyleOverride>) => void;
  onResetNodeStyle: (nodeId: string) => void;
  onToggleUid: (nodeId: string) => void;
  onToggleNodeOnline: (nodeId: string) => void;
  onRefreshTelemetry: () => void;
  onSwitchDataMode: (mode: DataSourceMode) => void;
  onConnectKomari: (baseUrl: string) => void;
  onChangeRecordHours: (hours: RecordHours) => void;
  onExportConfigJson: () => void;
  onImportConfigJson: (rawJson: string) => { ok: boolean; error?: string };
}

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'telemetry', label: '遥测' },
  { id: 'builder', label: '编排' },
  { id: 'style', label: '涂装' },
  { id: 'api', label: '接口' },
];

const HOUR_OPTIONS: RecordHours[] = [1, 6, 24];

const MODEL_OPTIONS: { value: ModelSelection; label: string; desc: string }[] = [
  { value: 'auto', label: '自动', desc: '按规格' },
  { value: 'B1', label: 'B1 · 1U', desc: '光纤边缘' },
  { value: 'B2', label: 'B2 · 2U', desc: '8盘存储' },
  { value: 'B3', label: 'B3 · 4U', desc: '双涡轮' },
  { value: 'B4', label: 'B4 · 1U', desc: 'CNC迷你' },
];

function getMeterTone(pct: number, warnAt = 80, critAt = 92): 'normal' | 'warn' | 'crit' {
  if (pct >= critAt) return 'crit';
  if (pct >= warnAt) return 'warn';
  return 'normal';
}

export function InspectorDrawer({
  open,
  tab,
  onClose,
  onTabChange,
  config,
  racks,
  activeRack,
  nodes,
  mountedNodeIds,
  selectedNode,
  selectedNodeUidBlinking,
  telemetryHistory,
  pingProbes,
  apiStatus,
  apiError,
  publicInfo,
  sameOriginDetected,
  isSameOriginLink,
  adminUrl,
  adminAuthStatus,
  adminUsername,
  canEnterEditMode,
  canEdit,
  layoutSyncSource,
  hasServerLayout,
  hasUnpublishedChanges,
  isPublishingLayout,
  lastSyncAt,
  wsFramesCount,
  onToggleEditMode,
  onRecheckAdminAuth,
  onPublishLayout,
  onCopyServerLayoutJson,
  onReloadServerLayout,
  onSelectRack,
  onAddRack,
  onRenameRack,
  onDeleteActiveRack,
  onChangeRackTheme,
  onToggleStrip,
  onMountNode,
  onMountAccessory,
  onMoveItem,
  onRemoveItem,
  onClearActiveRack,
  onResetDefaultLayout,
  onSelectNodeById,
  onUpdateNodeStyle,
  onResetNodeStyle,
  onToggleUid,
  onToggleNodeOnline,
  onRefreshTelemetry,
  onSwitchDataMode,
  onConnectKomari,
  onChangeRecordHours,
  onExportConfigJson,
  onImportConfigJson,
}: InspectorDrawerProps) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false,
  );
  const [urlDraft, setUrlDraft] = useState(config.api.baseUrl);
  const [confirmAction, setConfirmAction] = useState<'clear' | 'delete' | 'reset' | null>(null);
  const [showImportBox, setShowImportBox] = useState(false);
  const [importDraft, setImportDraft] = useState('');
  const [importErr, setImportErr] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setUrlDraft(config.api.baseUrl);
  }, [config.api.baseUrl]);

  useEffect(() => {
    setConfirmAction(null);
  }, [activeRack.id, tab]);

  const isLiveMode = config.api.mode === 'live';
  const unmountedNodes = nodes.filter((n) => !mountedNodeIds.has(n.uuid));
  const selectedStyle = selectedNode ? getEffectiveStyle(selectedNode, config.nodeStyles) : null;
  const finishList = Object.values(FINISHES);

  const handleApplyImport = () => {
    setImportErr(null);
    const res = onImportConfigJson(importDraft);
    if (res.ok) {
      setImportDraft('');
      setShowImportBox(false);
    } else {
      setImportErr(res.error ?? '导入失败');
    }
  };

  const renderNodeSelect = (ariaLabel: string, includeStatus = false) => (
    <Select
      value={selectedNode?.uuid ?? null}
      onValueChange={(next) => {
        if (next) onSelectNodeById(next);
      }}
      disabled={nodes.length === 0}
    >
      <SelectTrigger className="kdc-select-trigger" aria-label={ariaLabel}>
        <SelectValue placeholder="暂无节点" />
      </SelectTrigger>
      <SelectContent align="start" sideOffset={6} className="kdc-select-content">
        {nodes.map((node) => {
          const geo = resolveNodeGeo(node);
          const label = includeStatus
            ? `[${geo.code}] ${node.name} · ${node.online ? '在线' : '离线'}`
            : `[${geo.code}] ${node.name} (${autoDetectModel(node)})`;
          return (
            <SelectItem key={node.uuid} value={node.uuid} label={label} className="kdc-select-item">
              <SelectItemIndicator keepMounted className="kdc-select-ind">
                <Check size={12} aria-hidden="true" />
              </SelectItemIndicator>
              <RegionFlag code={geo.code} size="xs" />
              <SelectItemText className="kdc-select-text">{node.name}</SelectItemText>
              <span className="kdc-select-meta">
                {includeStatus ? (node.online ? `${node.ping || 0}ms` : '离线') : autoDetectModel(node)}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  const renderEditLockBanner = () => {
    if (canEdit) return null;
    const isRemoteReadOnly = isLiveMode && !isSameOriginLink;
    const isLiveGuest = isLiveMode && isSameOriginLink && adminAuthStatus !== 'authenticated';

    return (
      <section className="kdc-d-card is-lock">
        <div className="kdc-d-head">
          <h3 className="kdc-d-title">
            <Lock size={12} aria-hidden="true" />
            <span>{isLiveMode ? '只读监控模式' : '演示只读模式'}</span>
          </h3>
          <span className="kdc-d-tag">READ ONLY</span>
        </div>
        <p className="kdc-d-note">
          {isLiveGuest
            ? '普通访客可自由查看所有节点与历史遥测。如需调整机柜上架、涂装并向全员发布，请先登录 Komari 管理员后台。'
            : isRemoteReadOnly
              ? '当前为跨域远程连接，浏览器无法校验目标站管理员会话，因此自动锁定为只读展示。'
              : isLiveMode
                ? `已通过 Komari 管理员会话校验（${adminUsername || '管理员'}）。点击下方即可解锁编排，完成后可一键发布至服务端。`
                : '默认保持纯净监控视图；如需在演示机房中体验拖拽上架与涂装，可手动开启本地演示编排。'}
        </p>
        <div className="kdc-d-two-col">
          {isLiveGuest ? (
            <>
              <Button
                data-variant="solid"
                className="kdc-d-btn"
                render={<a href={adminUrl} />}
              >
                <ExternalLink size={12} aria-hidden="true" />
                <span>前往 /admin 登录</span>
              </Button>
              <Button className="kdc-d-btn" onClick={onRecheckAdminAuth}>
                <RefreshCw size={12} aria-hidden="true" />
                <span>刷新鉴权</span>
              </Button>
            </>
          ) : isRemoteReadOnly ? (
            <Button
              className="kdc-d-btn is-full"
              render={<a href={adminUrl} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink size={12} aria-hidden="true" />
              <span>打开目标站后台 (/admin)</span>
            </Button>
          ) : canEnterEditMode ? (
            <Button data-variant="solid" className="kdc-d-btn is-full" onClick={onToggleEditMode}>
              <span>{isLiveMode ? '解锁管理员编排模式' : '开启本地演示编排'}</span>
            </Button>
          ) : (
            <Button className="kdc-d-btn is-full" onClick={onRecheckAdminAuth}>
              <RefreshCw size={12} aria-hidden="true" />
              <span>重新校验管理员会话</span>
            </Button>
          )}
        </div>
      </section>
    );
  };

  const renderLayoutSyncCard = () => {
    const sourceText = !isLiveMode
      ? '本地演示草稿 (localStorage)'
      : layoutSyncSource === 'server'
        ? 'Komari 服务端已发布 (theme_settings)'
        : layoutSyncSource === 'local_draft'
          ? '本地未发布草稿 (仅本机可见)'
          : '按节点分组自动生成';

    return (
      <section className="kdc-d-card">
        <div className="kdc-d-head">
          <h3 className="kdc-d-title">编排保存与同步</h3>
          <span className={`kdc-d-tag${hasUnpublishedChanges ? ' is-warn' : ''}`}>
            {hasUnpublishedChanges ? '待发布' : layoutSyncSource.toUpperCase()}
          </span>
        </div>
        <div className="kdc-d-kv-box">
          <div className="kdc-d-kv-row">
            <span>当前来源</span>
            <strong>{sourceText}</strong>
          </div>
          <div className="kdc-d-kv-row">
            <span>管理员鉴权</span>
            <strong className={adminAuthStatus === 'authenticated' ? 'is-ok' : ''}>
              {!isLiveMode
                ? 'DEMO 沙盒'
                : adminAuthStatus === 'authenticated'
                  ? `已登录 (${adminUsername || 'Admin'})`
                  : adminAuthStatus === 'checking'
                    ? '校验中…'
                    : adminAuthStatus === 'remote_readonly'
                      ? '跨域只读'
                      : '未登录访客'}
            </strong>
          </div>
          {lastSyncAt && (
            <div className="kdc-d-kv-row">
              <span>最近同步</span>
              <strong>{lastSyncAt}</strong>
            </div>
          )}
        </div>
        <p className="kdc-d-note">
          编辑实时暂存于本机 <code>localStorage</code>；同源登录管理员后点击发布，将写入主题配置 <code>rackLayoutJson</code> 全员同步。
        </p>

        {isLiveMode && isSameOriginLink && adminAuthStatus === 'authenticated' && (
          <Button
            data-variant="solid"
            className="kdc-d-btn is-full"
            disabled={isPublishingLayout}
            onClick={onPublishLayout}
          >
            <UploadCloud size={13} aria-hidden="true" />
            <span>{isPublishingLayout ? '正在发布至服务端…' : '保存并发布到 Komari 服务端'}</span>
          </Button>
        )}

        <div className="kdc-d-two-col">
          <Button className="kdc-d-btn" onClick={onCopyServerLayoutJson}>
            <Copy size={12} aria-hidden="true" />
            <span>复制布局 JSON</span>
          </Button>
          {isLiveMode && hasServerLayout ? (
            <Button className="kdc-d-btn" onClick={onReloadServerLayout}>
              <RefreshCw size={12} aria-hidden="true" />
              <span>拉取服务端编排</span>
            </Button>
          ) : (
            <Button className="kdc-d-btn" onClick={onExportConfigJson}>
              <Download size={12} aria-hidden="true" />
              <span>导出完整配置</span>
            </Button>
          )}
        </div>
      </section>
    );
  };

  const confirmMeta =
    confirmAction === 'clear'
      ? {
          title: `清空机柜「${activeRack.name}」？`,
          desc: `将卸载当前机柜中的 ${activeRack.items.length} 台设备，所有节点均会退回至「待上架设备」列表。`,
          cta: '确认清空',
          onConfirm: () => {
            setConfirmAction(null);
            onClearActiveRack();
          },
        }
      : confirmAction === 'delete'
        ? {
            title: `删除机柜「${activeRack.name}」？`,
            desc: '删除后该机柜内的全部服务器节点会退回至待上架池，此操作可重新新增机柜恢复。',
            cta: '确认删除',
            onConfirm: () => {
              setConfirmAction(null);
              onDeleteActiveRack();
            },
          }
        : confirmAction === 'reset'
          ? {
              title: isLiveMode ? '按分组自动重排机柜？' : '恢复默认机房编排？',
              desc: isLiveMode
                ? '将依据 Komari 节点分组重新生成机柜布局，未发布的自定义排布将被覆盖。'
                : '将恢复所有演示机柜、槽位排布与硬件涂装至初始状态。',
              cta: '确认重置',
              onConfirm: () => {
                setConfirmAction(null);
                onResetDefaultLayout();
              },
            }
          : null;

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        side={isMobile ? 'bottom' : 'right'}
        modal={isMobile}
        closeOnOutsidePress={isMobile}
      >
        {isMobile && <DrawerBackdrop className="kdc-drawer-backdrop" />}
        <DrawerContent
          className="kdc-drawer-content"
          aria-label="机房检视与编排面板"
        >
          {isMobile && (
            <div className="kdc-drawer-grab-wrap">
              <DrawerHandle className="kdc-drawer-handle" aria-label="拖动调整或关闭面板">
                <span />
              </DrawerHandle>
            </div>
          )}

          <div className="kdc-drawer-header">
            <div className="kdc-drawer-heading">
              <DrawerTitle className="kdc-drawer-title">机房检视台</DrawerTitle>
              <span className="kdc-drawer-sub">
                {selectedNode ? selectedNode.name : activeRack.name}
              </span>
            </div>
            <DrawerClose className="kdc-icon-btn" aria-label="关闭面板">
              <X size={14} aria-hidden="true" />
            </DrawerClose>
          </div>

          <Tabs
            value={tab}
            onValueChange={(next) => {
              if (next === 'telemetry' || next === 'builder' || next === 'style' || next === 'api') {
                onTabChange(next);
              }
            }}
            className="kdc-drawer-tabs"
          >
            <TabsList aria-label="检视功能页签" className="kdc-drawer-tablist">
              {TABS.map((t) => (
                <TabsTab key={t.id} value={t.id} className="kdc-drawer-tab">
                  {t.id === 'telemetry' && <Activity size={12} aria-hidden="true" />}
                  {t.id === 'builder' && <SlidersHorizontal size={12} aria-hidden="true" />}
                  {t.id === 'style' && <Palette size={12} aria-hidden="true" />}
                  {t.id === 'api' && <Plug size={12} aria-hidden="true" />}
                  <span>{t.label}</span>
                  {(t.id === 'builder' || t.id === 'style') && !canEdit && (
                    <Lock size={10} className="kdc-tab-lock" aria-hidden="true" />
                  )}
                </TabsTab>
              ))}
              <TabsIndicator className="kdc-drawer-tab-ind" />
            </TabsList>

            <ScrollArea className="kdc-drawer-scroll">
              <ScrollAreaViewport className="kdc-drawer-viewport">
                <ScrollAreaContent className="kdc-drawer-body">
                  <TabsPanel value="telemetry" className="kdc-d-panel">
                    <section className="kdc-d-card">
                      <div className="kdc-d-head">
                        <h3 className="kdc-d-title">监控节点</h3>
                        <Button className="kdc-d-link-btn" onClick={onRefreshTelemetry}>
                          <RefreshCw size={11} aria-hidden="true" />
                          <span>刷新采样</span>
                        </Button>
                      </div>

                      {renderNodeSelect('选择遥测节点', true)}

                      {selectedNode && (() => {
                        const geo = resolveNodeGeo(selectedNode);
                        return (
                          <div className="kdc-d-tel-toolbar">
                            <div className="kdc-d-tel-id">
                              <span className={`kdc-sig-dot ${selectedNode.online ? 'is-live' : 'is-err'}`} />
                              <RegionFlag code={geo.code} size="xs" />
                              <span className="kdc-d-tel-geo">{geo.name}</span>
                              {selectedNode.group && (
                                <span className="kdc-d-pill">{selectedNode.group}</span>
                              )}
                            </div>

                            <SegmentedControl
                              aria-label="全局采样时间窗口"
                              value={String(config.api.recordHours)}
                              onValueChange={(next) => {
                                const hr = Number(next) as RecordHours;
                                if (hr === 1 || hr === 6 || hr === 24) onChangeRecordHours(hr);
                              }}
                              className="kdc-seg-sm"
                            >
                              <SegmentedControlIndicator />
                              {HOUR_OPTIONS.map((hr) => (
                                <SegmentedControlItem key={hr} value={String(hr)} className="kdc-seg-sm-item">
                                  {hr}H
                                </SegmentedControlItem>
                              ))}
                            </SegmentedControl>
                          </div>
                        );
                      })()}
                    </section>

                    {selectedNode && (() => {
                      const ramUsedBytes =
                        selectedNode.ramUsed !== undefined
                          ? selectedNode.ramUsed
                          : Math.round((selectedNode.ram / 100) * selectedNode.mem_total);
                      const diskUsedBytes =
                        selectedNode.diskUsed !== undefined
                          ? selectedNode.diskUsed
                          : Math.round((selectedNode.disk / 100) * selectedNode.disk_total);
                      const hasSwap = (selectedNode.swap_total ?? 0) > 0;
                      const swapPct = hasSwap ? Math.max(0, Math.min(100, Math.round(selectedNode.swap ?? 0))) : 0;
                      const swapUsedBytes = hasSwap
                        ? (selectedNode.swapUsed ?? Math.round((swapPct / 100) * (selectedNode.swap_total ?? 0)))
                        : 0;
                      const cpuPct = selectedNode.online ? Math.max(0, Math.min(100, Math.round(selectedNode.cpu))) : 0;
                      const ramPct = selectedNode.online ? Math.max(0, Math.min(100, Math.round(selectedNode.ram))) : 0;
                      const diskPct = Math.max(0, Math.min(100, Math.round(selectedNode.disk)));

                      const totalDown = selectedNode.totalDown ?? 0;
                      const totalUp = selectedNode.totalUp ?? 0;
                      const combinedTraffic = totalDown + totalUp;
                      const rxShare = combinedTraffic > 0 ? Math.round((totalDown / combinedTraffic) * 100) : 50;

                      const loadPerCore =
                        selectedNode.load1 !== undefined && selectedNode.cpu_cores > 0
                          ? selectedNode.load1 / selectedNode.cpu_cores
                          : null;
                      const loadLabel =
                        selectedNode.load1 !== undefined
                          ? `${selectedNode.load1.toFixed(2)} / ${selectedNode.load5 !== undefined ? selectedNode.load5.toFixed(2) : '--'} / ${selectedNode.load15 !== undefined ? selectedNode.load15.toFixed(2) : '--'}`
                          : '--';

                      const tagList = (selectedNode.tags ?? '')
                        .split(/[;,]/)
                        .map((t) => t.trim())
                        .filter(Boolean);

                      return (
                        <>
                          <section className="kdc-d-card">
                            <div className="kdc-d-meter-grid">
                              <div className="kdc-d-meter-tile">
                                <Meter
                                  value={cpuPct}
                                  min={0}
                                  max={100}
                                  className={`kdc-d-meter tone-${getMeterTone(cpuPct, 78, 90)}`}
                                >
                                  <div className="kdc-d-meter-top">
                                    <MeterLabel className="kdc-d-meter-lbl">CPU</MeterLabel>
                                    <MeterValue className="kdc-d-meter-val">
                                      {selectedNode.online ? `${cpuPct}%` : '--'}
                                    </MeterValue>
                                  </div>
                                  <MeterTrack className="kdc-meter-track">
                                    <MeterIndicator className="kdc-meter-ind" />
                                  </MeterTrack>
                                </Meter>
                                <span className="kdc-d-meter-sub">{selectedNode.cpu_cores} 核心</span>
                              </div>

                              <div className="kdc-d-meter-tile">
                                <Meter
                                  value={ramPct}
                                  min={0}
                                  max={100}
                                  className={`kdc-d-meter tone-${getMeterTone(ramPct, 82, 92)}`}
                                >
                                  <div className="kdc-d-meter-top">
                                    <MeterLabel className="kdc-d-meter-lbl">内存</MeterLabel>
                                    <MeterValue className="kdc-d-meter-val">
                                      {selectedNode.online ? `${ramPct}%` : '--'}
                                    </MeterValue>
                                  </div>
                                  <MeterTrack className="kdc-meter-track">
                                    <MeterIndicator className="kdc-meter-ind" />
                                  </MeterTrack>
                                </Meter>
                                <span className="kdc-d-meter-sub">
                                  {selectedNode.online ? formatTrafficBytes(ramUsedBytes) : '0 B'} /{' '}
                                  {formatBytesGiB(selectedNode.mem_total)}
                                </span>
                              </div>

                              <div className="kdc-d-meter-tile">
                                <Meter
                                  value={hasSwap && selectedNode.online ? swapPct : 0}
                                  min={0}
                                  max={100}
                                  className={`kdc-d-meter tone-${getMeterTone(swapPct, 78, 90)}`}
                                >
                                  <div className="kdc-d-meter-top">
                                    <MeterLabel className="kdc-d-meter-lbl">Swap</MeterLabel>
                                    <MeterValue className="kdc-d-meter-val">
                                      {!hasSwap ? '未启用' : selectedNode.online ? `${swapPct}%` : '--'}
                                    </MeterValue>
                                  </div>
                                  <MeterTrack className="kdc-meter-track">
                                    <MeterIndicator className="kdc-meter-ind" />
                                  </MeterTrack>
                                </Meter>
                                <span className="kdc-d-meter-sub">
                                  {hasSwap
                                    ? `${selectedNode.online ? formatTrafficBytes(swapUsedBytes) : '0 B'} / ${formatTrafficBytes(selectedNode.swap_total)}`
                                    : '0 B'}
                                </span>
                              </div>

                              <div className="kdc-d-meter-tile">
                                <Meter
                                  value={diskPct}
                                  min={0}
                                  max={100}
                                  className={`kdc-d-meter tone-${getMeterTone(diskPct, 85, 95)}`}
                                >
                                  <div className="kdc-d-meter-top">
                                    <MeterLabel className="kdc-d-meter-lbl">磁盘</MeterLabel>
                                    <MeterValue className="kdc-d-meter-val">{diskPct}%</MeterValue>
                                  </div>
                                  <MeterTrack className="kdc-meter-track">
                                    <MeterIndicator className="kdc-meter-ind" />
                                  </MeterTrack>
                                </Meter>
                                <span className="kdc-d-meter-sub">
                                  {formatTrafficBytes(diskUsedBytes)} / {formatBytesGiB(selectedNode.disk_total)}
                                </span>
                              </div>
                            </div>
                          </section>

                          <TelemetryScope
                            points={telemetryHistory}
                            pingProbes={pingProbes}
                            nodeName={selectedNode.name}
                            online={selectedNode.online}
                            recordHours={config.api.recordHours}
                            isLiveMode={isLiveMode}
                            liveNetDown={selectedNode.netDown}
                            liveNetUp={selectedNode.netUp}
                          />

                          <section className="kdc-d-card">
                            <div className="kdc-d-head">
                              <h3 className="kdc-d-title">负载与连接态势</h3>
                              {loadPerCore !== null && selectedNode.online && (
                                <span className={`kdc-d-tag${loadPerCore >= 0.85 ? ' is-warn' : ''}`}>
                                  单核 {loadPerCore.toFixed(2)}
                                </span>
                              )}
                            </div>

                            <dl className="kdc-d-dl">
                              <div className="kdc-d-dl-row">
                                <dt>系统负载 (1m/5m/15m)</dt>
                                <dd>{selectedNode.online ? loadLabel : '--'}</dd>
                              </div>
                              <div className="kdc-d-dl-row">
                                <dt>TCP / UDP 连接</dt>
                                <dd>
                                  {selectedNode.online && selectedNode.tcp !== undefined
                                    ? `${selectedNode.tcp} / ${selectedNode.udp ?? 0}`
                                    : '--'}
                                </dd>
                              </div>
                              <div className="kdc-d-dl-row">
                                <dt>活跃进程</dt>
                                <dd>
                                  {selectedNode.online && selectedNode.process !== undefined
                                    ? `${selectedNode.process}`
                                    : '--'}
                                </dd>
                              </div>
                              <div className="kdc-d-dl-row">
                                <dt>实时带宽</dt>
                                <dd>
                                  {selectedNode.online
                                    ? `↓ ${formatNetSpeed(selectedNode.netDown)} · ↑ ${formatNetSpeed(selectedNode.netUp)}`
                                    : '0 B/s'}
                                </dd>
                              </div>
                              {(selectedNode.totalDown !== undefined || selectedNode.totalUp !== undefined) && (
                                <div className="kdc-d-dl-block">
                                  <div className="kdc-d-traffic-head">
                                    <span>累计流量 (入/出)</span>
                                    <span className="kdc-d-meta">总计 {formatTrafficBytes(combinedTraffic)}</span>
                                  </div>
                                  <strong className="kdc-d-dl-strong">
                                    ↓ {formatTrafficBytes(selectedNode.totalDown)} / ↑{' '}
                                    {formatTrafficBytes(selectedNode.totalUp)}
                                  </strong>
                                  {combinedTraffic > 0 && (
                                    <div className="kdc-d-ratio" aria-label={`入站占比 ${rxShare}%`}>
                                      <span className="is-rx" style={{ width: `${rxShare}%` }} />
                                      <span className="is-tx" style={{ width: `${100 - rxShare}%` }} />
                                    </div>
                                  )}
                                  {selectedNode.trafficLimit !== undefined && selectedNode.trafficLimit > 0 && (
                                    <span className="kdc-d-meta">
                                      限额 {formatTrafficBytes(selectedNode.trafficLimit)}
                                      {selectedNode.trafficLimitType ? ` (${selectedNode.trafficLimitType})` : ''}
                                    </span>
                                  )}
                                </div>
                              )}
                            </dl>
                          </section>

                          <section className="kdc-d-card">
                            <div className="kdc-d-head">
                              <h3 className="kdc-d-title">硬件与运行环境</h3>
                              <span className="kdc-d-meta">运行 {selectedNode.uptime}</span>
                            </div>

                            <dl className="kdc-d-dl">
                              <div className="kdc-d-dl-row">
                                <dt>处理器</dt>
                                <dd>
                                  {selectedNode.cpu_name} ({selectedNode.cpu_cores}C)
                                </dd>
                              </div>
                              {selectedNode.gpu_name && (
                                <div className="kdc-d-dl-row">
                                  <dt>GPU</dt>
                                  <dd>{selectedNode.gpu_name}</dd>
                                </div>
                              )}
                              <div className="kdc-d-dl-row">
                                <dt>系统内核</dt>
                                <dd>
                                  {selectedNode.os}
                                  {selectedNode.kernel_version ? ` · ${selectedNode.kernel_version}` : ''}
                                </dd>
                              </div>
                              <div className="kdc-d-dl-row">
                                <dt>架构 / 虚拟化</dt>
                                <dd>
                                  {selectedNode.arch || '--'} · {selectedNode.virtualization || '--'}
                                </dd>
                              </div>
                              {selectedNode.expiredAt && (
                                <div className="kdc-d-dl-row">
                                  <dt>到期时间</dt>
                                  <dd>{selectedNode.expiredAt.slice(0, 10)}</dd>
                                </div>
                              )}
                              {tagList.length > 0 && (
                                <div className="kdc-d-dl-block">
                                  <span className="kdc-d-dl-lbl">节点标签</span>
                                  <div className="kdc-d-tag-list">
                                    {tagList.map((tg) => (
                                      <span key={tg} className="kdc-d-pill">
                                        {tg}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {selectedNode.message && (
                                <div className="kdc-d-dl-block">
                                  <span className="kdc-d-dl-lbl">状态消息</span>
                                  <strong className="kdc-d-dl-strong">{selectedNode.message}</strong>
                                </div>
                              )}
                            </dl>

                            <div className="kdc-d-stream-foot">
                              <span className="kdc-d-meta">
                                {isLiveMode
                                  ? `WS 实时流${selectedNode.updatedAt ? ` · ${selectedNode.updatedAt.slice(11, 19)}` : ''}`
                                  : '本地演示心跳 (3.2s)'}
                              </span>
                              {!isLiveMode && (
                                <Button
                                  className="kdc-d-btn-sm"
                                  onClick={() => onToggleNodeOnline(selectedNode.uuid)}
                                >
                                  {selectedNode.online ? '模拟离线' : '恢复上线'}
                                </Button>
                              )}
                            </div>
                          </section>
                        </>
                      );
                    })()}
                  </TabsPanel>

                  <TabsPanel value="builder" className="kdc-d-panel">
                    {renderEditLockBanner()}

                    <section className="kdc-d-card">
                      <div className="kdc-d-head">
                        <h3 className="kdc-d-title">机柜阵列</h3>
                        {canEdit && (
                          <Button className="kdc-d-link-btn" onClick={onAddRack}>
                            <Plus size={12} aria-hidden="true" />
                            <span>新增机柜</span>
                          </Button>
                        )}
                      </div>

                      <div className="kdc-d-rack-list">
                        {racks.map((rack, idx) => (
                          <Button
                            key={rack.id}
                            className={`kdc-d-rack-item${rack.id === activeRack.id ? ' is-active' : ''}`}
                            onClick={() => onSelectRack(rack.id)}
                          >
                            <span className="kdc-d-rack-code">A-0{idx + 1}</span>
                            <span className="kdc-d-rack-name">{rack.name}</span>
                            <span className="kdc-d-rack-count">{rack.items.length} 台</span>
                          </Button>
                        ))}
                      </div>

                      {canEdit && (
                        <>
                          <Separator />
                          <Field className="kdc-d-field-row">
                            <FieldLabel className="kdc-d-label">机柜名称</FieldLabel>
                            <Input
                              className="kdc-d-input"
                              value={activeRack.name}
                              maxLength={24}
                              aria-label="当前机柜名称"
                              onChange={(e) => onRenameRack(activeRack.id, e.target.value)}
                            />
                          </Field>

                          <div className="kdc-d-row-between">
                            <span className="kdc-d-label">机柜材质</span>
                            <SegmentedControl
                              aria-label="机柜外观材质"
                              value={activeRack.theme}
                              onValueChange={(next) => {
                                if (next === 'obsidian' || next === 'titanium' || next === 'silver') {
                                  onChangeRackTheme(activeRack.id, next);
                                }
                              }}
                              className="kdc-seg-sm"
                            >
                              <SegmentedControlIndicator />
                              {CABINET_THEMES.map((t) => (
                                <SegmentedControlItem key={t.id} value={t.id} className="kdc-seg-sm-item">
                                  {t.label}
                                </SegmentedControlItem>
                              ))}
                            </SegmentedControl>
                          </div>
                        </>
                      )}

                      <Separator />
                      <div className="kdc-d-row-between">
                        <span className="kdc-d-label">机位遥测指示条</span>
                        <Switch
                          checked={config.showStrip}
                          onCheckedChange={() => onToggleStrip()}
                          aria-label="切换服务器状态指示条"
                        >
                          <SwitchThumb />
                        </Switch>
                      </div>
                    </section>

                    {activeRack.items.length > 0 && (
                      <section className="kdc-d-card">
                        <div className="kdc-d-head">
                          <h3 className="kdc-d-title">当前机柜槽位</h3>
                          <span className="kdc-d-meta">{activeRack.items.length} 台在柜</span>
                        </div>
                        <div className="kdc-d-slot-list">
                          {activeRack.items.map((item, idx) => {
                            const node = item.type === 'node' ? nodes.find((n) => n.uuid === item.nodeId) : null;
                            const geoCode = node ? resolveNodeGeo(node).code : null;
                            const title =
                              item.type === 'node'
                                ? node
                                  ? node.name
                                  : '未知节点'
                                : item.type === 'pdu'
                                  ? item.label || '1U 计量 PDU'
                                  : item.label || '1U 导风盲板';
                            return (
                              <div key={item.uid} className="kdc-d-slot-row">
                                <Button
                                  className="kdc-d-slot-select"
                                  onClick={() => {
                                    if (node) {
                                      onSelectNodeById(node.uuid);
                                      onTabChange(canEdit ? 'style' : 'telemetry');
                                    }
                                  }}
                                  disabled={!node}
                                >
                                  <span className="kdc-d-slot-idx">#{idx + 1}</span>
                                  {geoCode && <RegionFlag code={geoCode} size="xs" />}
                                  <span className="kdc-d-slot-name">{title}</span>
                                </Button>
                                {canEdit && (
                                  <div className="kdc-d-slot-acts">
                                    <Button
                                      className="kdc-icon-btn-xs"
                                      disabled={idx === 0}
                                      onClick={() => onMoveItem(activeRack.id, idx, -1)}
                                      aria-label="上移槽位"
                                    >
                                      <ArrowUp size={11} aria-hidden="true" />
                                    </Button>
                                    <Button
                                      className="kdc-icon-btn-xs"
                                      disabled={idx === activeRack.items.length - 1}
                                      onClick={() => onMoveItem(activeRack.id, idx, 1)}
                                      aria-label="下移槽位"
                                    >
                                      <ArrowDown size={11} aria-hidden="true" />
                                    </Button>
                                    <Button
                                      className="kdc-icon-btn-xs is-danger"
                                      onClick={() => onRemoveItem(activeRack.id, item.uid)}
                                      aria-label="卸载设备"
                                    >
                                      <X size={11} aria-hidden="true" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {canEdit && (
                      <>
                        <section className="kdc-d-card">
                          <div className="kdc-d-head">
                            <h3 className="kdc-d-title">待上架设备</h3>
                            <span className="kdc-d-meta">{unmountedNodes.length} 可用</span>
                          </div>

                          {unmountedNodes.length === 0 ? (
                            <p className="kdc-d-note">
                              {nodes.length === 0
                                ? '当前无可用节点，请到「接口」连接 Komari 或切回 Demo。'
                                : `全部 ${nodes.length} 台节点已在柜运行。卸载任意设备后可重新编排。`}
                            </p>
                          ) : (
                            <div className="kdc-d-mount-list">
                              {unmountedNodes.map((node) => (
                                <div key={node.uuid} className="kdc-d-mount-row">
                                  <div className="kdc-d-mount-info">
                                    <strong>
                                      <RegionFlag code={resolveNodeGeo(node).code} size="xs" />
                                      <span>{node.name}</span>
                                    </strong>
                                    <span>
                                      {autoDetectModel(node)} · {node.cpu_cores}C /{' '}
                                      {formatBytesGiB(node.mem_total)}
                                    </span>
                                  </div>
                                  <Button
                                    data-variant="solid"
                                    className="kdc-d-btn-sm"
                                    onClick={() => onMountNode(node.uuid)}
                                  >
                                    上架
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="kdc-d-two-col">
                            <Button className="kdc-d-btn" onClick={() => onMountAccessory('pdu')}>
                              <Plus size={12} aria-hidden="true" />
                              <span>1U 计量 PDU</span>
                            </Button>
                            <Button className="kdc-d-btn" onClick={() => onMountAccessory('blank')}>
                              <Plus size={12} aria-hidden="true" />
                              <span>1U 导风盲板</span>
                            </Button>
                          </div>
                        </section>

                        {renderLayoutSyncCard()}

                        <section className="kdc-d-card">
                          <div className="kdc-d-head">
                            <h3 className="kdc-d-title">机柜维护</h3>
                            <span className="kdc-d-meta">{activeRack.name}</span>
                          </div>
                          <div className="kdc-d-danger-stack">
                            {activeRack.items.length > 0 && (
                              <Button
                                className="kdc-d-btn is-full"
                                onClick={() => setConfirmAction('clear')}
                              >
                                清空当前机柜设备（{activeRack.items.length} 台）
                              </Button>
                            )}
                            {racks.length > 1 && (
                              <Button
                                data-variant="destructive"
                                className="kdc-d-btn is-full"
                                onClick={() => setConfirmAction('delete')}
                              >
                                <Trash2 size={12} aria-hidden="true" />
                                <span>删除当前机柜</span>
                              </Button>
                            )}
                            <Button
                              className="kdc-d-btn is-full"
                              onClick={() => setConfirmAction('reset')}
                            >
                              <RotateCcw size={12} aria-hidden="true" />
                              <span>{isLiveMode ? '按分组自动重排机柜' : '恢复默认机房编排'}</span>
                            </Button>
                          </div>
                        </section>
                      </>
                    )}
                  </TabsPanel>

                  <TabsPanel value="style" className="kdc-d-panel">
                    {renderEditLockBanner()}

                    <section className="kdc-d-card">
                      <div className="kdc-d-head">
                        <h3 className="kdc-d-title">目标服务器</h3>
                        {selectedNode && canEdit && (
                          <Button
                            className="kdc-d-link-btn"
                            onClick={() => onResetNodeStyle(selectedNode.uuid)}
                          >
                            <RotateCcw size={11} aria-hidden="true" />
                            <span>恢复默认</span>
                          </Button>
                        )}
                      </div>
                      {renderNodeSelect('选择要涂装的节点', false)}
                    </section>

                    {selectedNode && selectedStyle && (
                      <>
                        <div className="kdc-d-chassis-preview" aria-label="服务器硬件面板实时预览">
                          <ServerUnitSvg
                            node={selectedNode}
                            style={selectedStyle}
                            uidBlinking={selectedNodeUidBlinking}
                          />
                        </div>

                        {canEdit ? (
                          <>
                            <section className="kdc-d-card">
                              <div className="kdc-d-head">
                                <h3 className="kdc-d-title">机箱形态 (B1–B4)</h3>
                                <span className="kdc-d-tag">{selectedStyle.model}</span>
                              </div>
                              <div className="kdc-d-model-grid">
                                {MODEL_OPTIONS.map((opt) => (
                                  <Button
                                    key={opt.value}
                                    className={`kdc-d-model-card${selectedStyle.rawModel === opt.value ? ' is-active' : ''}`}
                                    onClick={() =>
                                      onUpdateNodeStyle(selectedNode.uuid, { model: opt.value })
                                    }
                                  >
                                    <strong>{opt.label}</strong>
                                    <span>{opt.desc}</span>
                                  </Button>
                                ))}
                              </div>
                            </section>

                            <section className="kdc-d-card">
                              <div className="kdc-d-head">
                                <h3 className="kdc-d-title">前面板阳极表面</h3>
                              </div>
                              <div className="kdc-d-finish-grid">
                                {finishList.map((fin) => (
                                  <Button
                                    key={fin.id}
                                    className={`kdc-d-finish-card${selectedStyle.finish === fin.id ? ' is-active' : ''}`}
                                    onClick={() =>
                                      onUpdateNodeStyle(selectedNode.uuid, {
                                        finish: fin.id as ChassisFinish,
                                      })
                                    }
                                  >
                                    <span
                                      className="kdc-d-finish-swatch"
                                      style={{
                                        background: `linear-gradient(180deg, ${fin.top}, ${fin.bot})`,
                                      }}
                                    />
                                    <span>{fin.name}</span>
                                  </Button>
                                ))}
                              </div>
                            </section>

                            <section className="kdc-d-card">
                              <div className="kdc-d-head">
                                <h3 className="kdc-d-title">指示色与资产铭牌</h3>
                              </div>

                              <div className="kdc-d-row-between">
                                <span className="kdc-d-label">拉手点缀</span>
                                <div className="kdc-d-swatch-row">
                                  {ACCENTS.map((acc) => (
                                    <Button
                                      key={acc.id}
                                      className={`kdc-d-color-dot${selectedStyle.accent === acc.id ? ' is-active' : ''}`}
                                      style={{ background: acc.hex }}
                                      title={acc.name}
                                      aria-label={`强调色：${acc.name}`}
                                      onClick={() =>
                                        onUpdateNodeStyle(selectedNode.uuid, { accent: acc.id })
                                      }
                                    />
                                  ))}
                                </div>
                              </div>

                              <div className="kdc-d-row-between">
                                <span className="kdc-d-label">OLED 荧光</span>
                                <SegmentedControl
                                  aria-label="OLED 屏幕荧光色"
                                  value={selectedStyle.oled}
                                  onValueChange={(next) => {
                                    if (
                                      next === 'cyan' ||
                                      next === 'amber' ||
                                      next === 'green' ||
                                      next === 'ice'
                                    ) {
                                      onUpdateNodeStyle(selectedNode.uuid, { oled: next });
                                    }
                                  }}
                                  className="kdc-seg-sm"
                                >
                                  <SegmentedControlIndicator />
                                  {OLEDS.map((o) => (
                                    <SegmentedControlItem key={o.id} value={o.id} className="kdc-seg-sm-item">
                                      <i className="kdc-d-pip" style={{ background: o.main }} />
                                      <span>{o.name}</span>
                                    </SegmentedControlItem>
                                  ))}
                                </SegmentedControl>
                              </div>

                              <Field className="kdc-d-field">
                                <FieldLabel className="kdc-d-label">面板标签</FieldLabel>
                                <div className="kdc-d-input-row">
                                  <Input
                                    className="kdc-d-input"
                                    value={selectedStyle.tag}
                                    maxLength={14}
                                    onChange={(e) =>
                                      onUpdateNodeStyle(selectedNode.uuid, { tag: e.target.value })
                                    }
                                  />
                                  <Toggle
                                    pressed={selectedNodeUidBlinking}
                                    onPressedChange={() => onToggleUid(selectedNode.uuid)}
                                    className="kdc-d-uid-toggle"
                                  >
                                    <Radio size={12} aria-hidden="true" />
                                    <span>{selectedNodeUidBlinking ? 'UID 亮' : 'UID'}</span>
                                  </Toggle>
                                </div>
                              </Field>
                            </section>
                          </>
                        ) : (
                          <section className="kdc-d-card">
                            <div className="kdc-d-row-between">
                              <span className="kdc-d-label">机位定位灯 (UID)</span>
                              <Toggle
                                pressed={selectedNodeUidBlinking}
                                onPressedChange={() => onToggleUid(selectedNode.uuid)}
                                className="kdc-d-uid-toggle"
                              >
                                <Radio size={12} aria-hidden="true" />
                                <span>{selectedNodeUidBlinking ? 'UID 闪烁中' : '点亮定位'}</span>
                              </Toggle>
                            </div>
                          </section>
                        )}
                      </>
                    )}
                  </TabsPanel>

                  <TabsPanel value="api" className="kdc-d-panel">
                    <section className="kdc-d-card">
                      <div className="kdc-d-head">
                        <h3 className="kdc-d-title">数据源模式</h3>
                        <span className="kdc-d-tag">{isLiveMode ? 'KOMARI API' : 'LOCAL DEMO'}</span>
                      </div>

                      <SegmentedControl
                        aria-label="切换数据源模式"
                        value={config.api.mode}
                        onValueChange={(next) => {
                          if (next === 'demo' || next === 'live') onSwitchDataMode(next);
                        }}
                        className="kdc-seg-full"
                      >
                        <SegmentedControlIndicator />
                        <SegmentedControlItem value="demo" className="kdc-seg-full-item">
                          Demo 演示机房
                        </SegmentedControlItem>
                        <SegmentedControlItem value="live" className="kdc-seg-full-item">
                          Komari 实况对接
                        </SegmentedControlItem>
                      </SegmentedControl>

                      <Field className="kdc-d-field">
                        <FieldLabel className="kdc-d-label">Komari 站点地址（同源部署留空）</FieldLabel>
                        <div className="kdc-d-input-row">
                          <Input
                            className="kdc-d-input is-mono"
                            placeholder="status.example.com 或 https://..."
                            value={urlDraft}
                            onChange={(e) => setUrlDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onConnectKomari(urlDraft);
                            }}
                          />
                          <Button
                            data-variant="solid"
                            className="kdc-d-btn-sm"
                            onClick={() => onConnectKomari(urlDraft)}
                          >
                            连接
                          </Button>
                        </div>
                        <FieldDescription className="kdc-d-note">
                          远程连接需目标站在 Komari 后台开启 <code>allow_cors</code>；作为官方主题同源部署时留空即可自动直连。
                        </FieldDescription>
                      </Field>

                      <div className="kdc-d-kv-box">
                        <div className="kdc-d-kv-row">
                          <span>LINK</span>
                          <strong
                            className={
                              apiStatus === 'live'
                                ? 'is-ok'
                                : apiStatus === 'error' || apiStatus === 'auth_required'
                                  ? 'is-err'
                                  : ''
                            }
                          >
                            {apiStatus === 'auth_required' ? 'AUTH REQUIRED' : apiStatus.toUpperCase()}
                          </strong>
                        </div>
                        <div className="kdc-d-kv-row">
                          <span>SITE</span>
                          <strong>{isLiveMode ? publicInfo?.sitename ?? '--' : 'DEMO-HALL'}</strong>
                        </div>
                        <div className="kdc-d-kv-row">
                          <span>NODES / WS</span>
                          <strong>
                            {nodes.length} 节点 · {wsFramesCount} 帧
                          </strong>
                        </div>
                        <div className="kdc-d-kv-row">
                          <span>ENV</span>
                          <strong>
                            {sameOriginDetected
                              ? '同源 Komari 主题'
                              : config.api.baseUrl
                                ? '远程跨域连接'
                                : '本地开发 / 演示'}
                          </strong>
                        </div>
                        {publicInfo && (
                          <div className="kdc-d-kv-row">
                            <span>POLICY</span>
                            <strong>
                              {publicInfo.private_site ? 'PRIVATE' : 'PUBLIC'} ·{' '}
                              {publicInfo.allow_cors ? 'CORS ON' : 'CORS OFF'}
                            </strong>
                          </div>
                        )}
                        {apiError && <div className="kdc-d-err-box">{apiError}</div>}
                      </div>

                      {apiStatus === 'auth_required' && (
                        <Button
                          className="kdc-d-btn is-full"
                          render={
                            <a
                              href={adminUrl}
                              target={config.api.baseUrl ? '_blank' : undefined}
                              rel={config.api.baseUrl ? 'noreferrer' : undefined}
                            />
                          }
                        >
                          <ExternalLink size={12} aria-hidden="true" />
                          <span>前往 Komari 后台登录 (/admin)</span>
                        </Button>
                      )}
                    </section>

                    {renderLayoutSyncCard()}

                    <section className="kdc-d-card">
                      <div className="kdc-d-head">
                        <h3 className="kdc-d-title">本地配置备份 / 恢复</h3>
                        <span className="kdc-d-tag">JSON</span>
                      </div>
                      <div className="kdc-d-two-col">
                        <Button className="kdc-d-btn" onClick={onExportConfigJson}>
                          <Copy size={12} aria-hidden="true" />
                          <span>复制导出</span>
                        </Button>
                        <Button
                          className="kdc-d-btn"
                          disabled={!canEdit}
                          onClick={() => {
                            if (!canEdit) return;
                            setShowImportBox((v) => !v);
                            setImportErr(null);
                          }}
                        >
                          <Upload size={12} aria-hidden="true" />
                          <span>{showImportBox ? '收起导入' : canEdit ? '导入 JSON' : '导入 (只读)'}</span>
                        </Button>
                      </div>
                      {showImportBox && canEdit && (
                        <div className="kdc-d-import-box">
                          <Textarea
                            className="kdc-d-textarea"
                            rows={4}
                            placeholder="粘贴此前导出的 JSON..."
                            value={importDraft}
                            onChange={(e) => setImportDraft(e.target.value)}
                          />
                          {importErr && <p className="kdc-d-err-text">{importErr}</p>}
                          <Button
                            data-variant="solid"
                            className="kdc-d-btn is-full"
                            onClick={handleApplyImport}
                          >
                            应用配置
                          </Button>
                        </div>
                      )}
                    </section>
                  </TabsPanel>
                </ScrollAreaContent>
              </ScrollAreaViewport>
              <ScrollAreaScrollbar className="kdc-scrollbar">
                <ScrollAreaThumb className="kdc-scrollbar-thumb" />
              </ScrollAreaScrollbar>
            </ScrollArea>
          </Tabs>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={confirmMeta !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmAction(null);
        }}
      >
        <AlertDialogBackdrop className="kdc-dialog-backdrop" />
        <AlertDialogContent className="kdc-alert-content">
          <AlertDialogTitle className="kdc-alert-title">{confirmMeta?.title}</AlertDialogTitle>
          <AlertDialogDescription className="kdc-alert-desc">
            {confirmMeta?.desc}
          </AlertDialogDescription>
          <div className="kdc-alert-actions">
            <AlertDialogClose className="kdc-d-btn">取消</AlertDialogClose>
            <Button
              data-variant="destructive"
              className="kdc-d-btn"
              onClick={confirmMeta?.onConfirm}
            >
              {confirmMeta?.cta}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
