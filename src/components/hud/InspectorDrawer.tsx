import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react';
import { ServerUnitSvg } from '@/components/hardware/ServerChassisSvg';
import { TelemetryScope } from '@/components/hud/TelemetryScope';
import { RegionFlag } from '@/components/ui/RegionFlag';
import { ACCENTS, CABINET_THEMES, FINISHES, OLEDS, autoDetectModel, formatBytesGiB, getEffectiveStyle } from '@/data/fleet';
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
  const [urlDraft, setUrlDraft] = useState(config.api.baseUrl);
  const [confirmAction, setConfirmAction] = useState<'clear' | 'delete' | 'reset' | null>(null);
  const [showImportBox, setShowImportBox] = useState(false);
  const [importDraft, setImportDraft] = useState('');
  const [importErr, setImportErr] = useState<string | null>(null);
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetTouchRef = useRef<{ startY: number; dy: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setSheetDragY(0);
      sheetTouchRef.current = null;
    }
  }, [open]);

  const handleSheetTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    sheetTouchRef.current = { startY: e.touches[0].clientY, dy: 0 };
  };

  const handleSheetTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    const st = sheetTouchRef.current;
    if (!st || e.touches.length !== 1) return;
    const dy = Math.max(0, e.touches[0].clientY - st.startY);
    st.dy = dy;
    if (dy > 4) {
      setSheetDragY(dy);
    }
  };

  const handleSheetTouchEnd = () => {
    const st = sheetTouchRef.current;
    sheetTouchRef.current = null;
    if (st && st.dy > 76) {
      setSheetDragY(0);
      onClose();
    } else {
      setSheetDragY(0);
    }
  };

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

  const renderEditLockBanner = () => {
    if (canEdit) return null;
    const isRemoteReadOnly = isLiveMode && !isSameOriginLink;
    const isLiveGuest = isLiveMode && isSameOriginLink && adminAuthStatus !== 'authenticated';

    return (
      <section className="d-sec d-auth-gate">
        <div className="d-sec-head">
          <h3 className="d-title">
            {isRemoteReadOnly
              ? '远程只读监看模式'
              : isLiveGuest
                ? '访客只读 · 需管理员鉴权'
                : '当前处于只读监看模式'}
          </h3>
          <span className="d-meta">LOCKED</span>
        </div>
        <p className="d-note">
          {isRemoteReadOnly
            ? '跨站远程连接无法携带目标站 Komari 登录 Cookie，访客与远程预览仅允许只读检视机柜，避免未授权编排。'
            : isLiveGuest
              ? '已通过 /api/me 校验：当前浏览器未登录 Komari 管理员账号，所有机柜编排、上架与涂装修改均已锁定。'
              : isLiveMode
                ? `已通过 /api/me 鉴权（${adminUsername || 'Admin'}），点击下方按钮即可进入管理员编排模式。`
                : '默认以只读监看视图呈现，避免误操作。如需体验机柜上架与涂装，可手动开启本地演示编排模式。'}
        </p>
        <div className="d-two-col">
          {isLiveGuest ? (
            <>
              <a className="d-primary-sm d-link-cta" href={adminUrl}>
                前往 /admin 登录
              </a>
              <button type="button" className="d-ghost-btn" onClick={onRecheckAdminAuth}>
                刷新鉴权状态
              </button>
            </>
          ) : isRemoteReadOnly ? (
            <a
              className="d-ghost-btn d-btn-full d-link-cta"
              href={adminUrl}
              target="_blank"
              rel="noreferrer"
            >
              打开目标站后台 (/admin)
            </a>
          ) : canEnterEditMode ? (
            <button type="button" className="d-primary-sm d-btn-full" onClick={onToggleEditMode}>
              {isLiveMode ? '解锁管理员编排模式' : '开启本地演示编排'}
            </button>
          ) : (
            <button type="button" className="d-ghost-btn d-btn-full" onClick={onRecheckAdminAuth}>
              重新校验管理员会话
            </button>
          )}
        </div>
      </section>
    );
  };

  const renderLayoutSyncCard = () => {
    const sourceText =
      !isLiveMode
        ? '本地演示草稿 (localStorage)'
        : layoutSyncSource === 'server'
          ? 'Komari 服务端已发布 (theme_settings)'
          : layoutSyncSource === 'local_draft'
            ? '本地未发布草稿 (仅本机可见)'
            : '按节点分组自动生成';

    return (
      <section className="d-sec d-sync-card">
        <div className="d-sec-head">
          <h3 className="d-title">编排保存与同步机制</h3>
          <span className={`d-meta${hasUnpublishedChanges ? ' is-warn-text' : ''}`}>
            {hasUnpublishedChanges ? '待发布' : layoutSyncSource.toUpperCase()}
          </span>
        </div>
        <div className="d-status-box">
          <div className="d-status-row">
            <span>当前来源</span>
            <strong>{sourceText}</strong>
          </div>
          <div className="d-status-row">
            <span>管理员鉴权</span>
            <strong className={adminAuthStatus === 'authenticated' ? 'is-ok' : ''}>
              {!isLiveMode
                ? 'DEMO 本地沙盒'
                : adminAuthStatus === 'authenticated'
                  ? `已登录 (${adminUsername || 'Admin'})`
                  : adminAuthStatus === 'checking'
                    ? '校验中…'
                    : adminAuthStatus === 'remote_readonly'
                      ? '跨域只读'
                      : '未登录访客'}
            </strong>
          </div>
        </div>
        <p className="d-note">
          编辑过程实时暂存于本机浏览器 <code>localStorage</code>；同源登录 Komari 管理员后点击「发布到 Komari 服务端」，会写入主题配置 <code>rackLayoutJson</code>，所有访客通过 <code>/api/public</code> 自动同步展示。
        </p>

        {isLiveMode && isSameOriginLink && adminAuthStatus === 'authenticated' && (
          <button
            type="button"
            className="d-primary-sm d-btn-full"
            disabled={isPublishingLayout}
            onClick={onPublishLayout}
          >
            {isPublishingLayout ? '正在发布至 Komari 服务端…' : '保存并发布到 Komari 服务端（全员生效）'}
          </button>
        )}

        <div className="d-two-col">
          <button type="button" className="d-ghost-btn" onClick={onCopyServerLayoutJson}>
            复制 rackLayoutJson
          </button>
          {isLiveMode && hasServerLayout ? (
            <button type="button" className="d-ghost-btn" onClick={onReloadServerLayout}>
              拉取服务端编排
            </button>
          ) : (
            <button type="button" className="d-ghost-btn" onClick={onExportConfigJson}>
              导出完整 JSON
            </button>
          )}
        </div>
      </section>
    );
  };

  return (
    <>
      {open && <div className="drawer-mobile-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`inspector-drawer${open ? ' is-open' : ''}${sheetDragY > 0 ? ' is-dragging-sheet' : ''}`}
        style={sheetDragY > 0 ? { transform: `translate3d(0, ${sheetDragY}px, 0)` } : undefined}
        aria-label="机房精调检视面板"
        aria-hidden={!open}
      >
        <div
          className="drawer-sheet-handle"
          onClick={onClose}
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          onTouchCancel={handleSheetTouchEnd}
          aria-hidden="true"
        >
          <span />
        </div>
        <div
          className="drawer-head"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          onTouchCancel={handleSheetTouchEnd}
        >
        <div className="drawer-tabs" role="tablist" aria-label="检视功能页签">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`drawer-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
              {(t.id === 'builder' || t.id === 'style') && !canEdit && (
                <span className="drawer-tab-lock" aria-hidden="true">
                  ·只读
                </span>
              )}
            </button>
          ))}
        </div>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="关闭面板" title="收起面板">
          ×
        </button>
      </div>

      <div className="drawer-scroll">
        {tab === 'builder' && (
          <div className="drawer-sections">
            {renderEditLockBanner()}

            <section className="d-sec">
              <div className="d-sec-head">
                <h3 className="d-title">机柜阵列</h3>
                {canEdit && (
                  <button type="button" className="d-link-btn" onClick={onAddRack}>
                    + 新增机柜
                  </button>
                )}
              </div>

              <div className="d-rack-list">
                {racks.map((rack, idx) => (
                  <button
                    key={rack.id}
                    type="button"
                    className={`d-rack-item${rack.id === activeRack.id ? ' is-active' : ''}`}
                    onClick={() => onSelectRack(rack.id)}
                  >
                    <span className="d-rack-code">A-0{idx + 1}</span>
                    <span className="d-rack-name">{rack.name}</span>
                    <span className="d-rack-count">{rack.items.length}台</span>
                  </button>
                ))}
              </div>

              {canEdit && (
                <>
                  <div className="d-row-between">
                    <span className="d-label">机柜名称</span>
                    <input
                      type="text"
                      className="d-input d-input-inline"
                      value={activeRack.name}
                      maxLength={24}
                      aria-label="当前机柜名称"
                      onChange={(e) => onRenameRack(activeRack.id, e.target.value)}
                    />
                  </div>

                  <div className="d-row-between">
                    <span className="d-label">机柜材质</span>
                    <div className="d-chip-group">
                      {CABINET_THEMES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`d-chip${activeRack.theme === t.id ? ' is-active' : ''}`}
                          onClick={() => onChangeRackTheme(activeRack.id, t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="d-row-between">
                <span className="d-label">服务器状态指示条</span>
                <div className="d-chip-group">
                  <button
                    type="button"
                    className={`d-chip${config.showStrip ? ' is-active' : ''}`}
                    onClick={() => {
                      if (!config.showStrip) onToggleStrip();
                    }}
                  >
                    显示
                  </button>
                  <button
                    type="button"
                    className={`d-chip${!config.showStrip ? ' is-active' : ''}`}
                    onClick={() => {
                      if (config.showStrip) onToggleStrip();
                    }}
                  >
                    隐藏
                  </button>
                </div>
              </div>
            </section>

            {activeRack.items.length > 0 && (
              <section className="d-sec">
                <div className="d-sec-head">
                  <h3 className="d-title">当前机柜槽位</h3>
                  <span className="d-meta">{activeRack.items.length} 台在柜</span>
                </div>
                <div className="d-slot-list">
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
                      <div key={item.uid} className="d-slot-row">
                        <button
                          type="button"
                          className="d-slot-select"
                          onClick={() => {
                            if (node) {
                              onSelectNodeById(node.uuid);
                              onTabChange(canEdit ? 'style' : 'telemetry');
                            }
                          }}
                          disabled={!node}
                          title={node ? (canEdit ? '点击检视与涂装该节点' : '点击查看该节点遥测') : title}
                        >
                          <span className="d-slot-idx">#{idx + 1}</span>
                          <span className="d-slot-name">
                            {geoCode && <RegionFlag code={geoCode} size="xs" />}
                            <span>{title}</span>
                          </span>
                        </button>
                        {canEdit && (
                          <div className="d-slot-actions">
                            <button
                              type="button"
                              className="d-slot-btn"
                              disabled={idx === 0}
                              onClick={() => onMoveItem(activeRack.id, idx, -1)}
                              title="上移槽位"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="d-slot-btn"
                              disabled={idx === activeRack.items.length - 1}
                              onClick={() => onMoveItem(activeRack.id, idx, 1)}
                              title="下移槽位"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="d-slot-btn is-del"
                              onClick={() => onRemoveItem(activeRack.id, item.uid)}
                              title="卸载设备"
                            >
                              ×
                            </button>
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
                <section className="d-sec">
                  <div className="d-sec-head">
                    <h3 className="d-title">待上架设备</h3>
                    <span className="d-meta">{unmountedNodes.length} 可用</span>
                  </div>

                  {unmountedNodes.length === 0 ? (
                    <p className="d-note">
                      {nodes.length === 0
                        ? '当前无可用节点，请到「接口」连接 Komari 或切回 Demo。'
                        : `全部 ${nodes.length} 台节点已在柜运行。卸载任意设备后可重新编排。`}
                    </p>
                  ) : (
                    <div className="d-mount-list">
                      {unmountedNodes.map((node) => (
                        <div key={node.uuid} className="d-mount-row">
                          <div className="d-mount-info">
                            <strong>
                              <RegionFlag code={resolveNodeGeo(node).code} size="xs" />
                              <span>{node.name}</span>
                            </strong>
                            <span>
                              {autoDetectModel(node)} · {node.cpu_cores}C / {formatBytesGiB(node.mem_total)}
                            </span>
                          </div>
                          <button type="button" className="d-primary-sm" onClick={() => onMountNode(node.uuid)}>
                            上架
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="d-two-col">
                    <button type="button" className="d-ghost-btn" onClick={() => onMountAccessory('pdu')}>
                      + 1U 计量 PDU
                    </button>
                    <button type="button" className="d-ghost-btn" onClick={() => onMountAccessory('blank')}>
                      + 1U 导风盲板
                    </button>
                  </div>
                </section>

                {renderLayoutSyncCard()}

                <section className="d-sec">
                  <div className="d-sec-head">
                    <h3 className="d-title">机柜维护</h3>
                    <span className="d-meta">{activeRack.name}</span>
                  </div>

                  <div className="d-danger-stack">
                    {activeRack.items.length > 0 &&
                      (confirmAction === 'clear' ? (
                        <div className="d-confirm-bar">
                          <span>确认清空 {activeRack.items.length} 台设备？</span>
                          <div className="d-confirm-btns">
                            <button type="button" className="d-link-btn" onClick={() => setConfirmAction(null)}>
                              取消
                            </button>
                            <button
                              type="button"
                              className="d-danger-btn"
                              onClick={() => {
                                setConfirmAction(null);
                                onClearActiveRack();
                              }}
                            >
                              确认清空
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="d-ghost-btn d-btn-full"
                          onClick={() => setConfirmAction('clear')}
                        >
                          清空当前机柜设备（{activeRack.items.length} 台）
                        </button>
                      ))}

                    {racks.length > 1 ? (
                      confirmAction === 'delete' ? (
                        <div className="d-confirm-bar">
                          <span>删除此机柜？设备将退回待上架</span>
                          <div className="d-confirm-btns">
                            <button type="button" className="d-link-btn" onClick={() => setConfirmAction(null)}>
                              取消
                            </button>
                            <button
                              type="button"
                              className="d-danger-btn"
                              onClick={() => {
                                setConfirmAction(null);
                                onDeleteActiveRack();
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="d-ghost-btn d-btn-full d-text-danger"
                          onClick={() => setConfirmAction('delete')}
                        >
                          移除当前机柜
                        </button>
                      )
                    ) : confirmAction === 'reset' ? (
                      <div className="d-confirm-bar">
                        <span>重置默认机房编排？</span>
                        <div className="d-confirm-btns">
                          <button type="button" className="d-link-btn" onClick={() => setConfirmAction(null)}>
                            取消
                          </button>
                          <button
                            type="button"
                            className="d-danger-btn"
                            onClick={() => {
                              setConfirmAction(null);
                              onResetDefaultLayout();
                            }}
                          >
                            重置
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="d-ghost-btn d-btn-full"
                        onClick={() => setConfirmAction('reset')}
                      >
                        {isLiveMode ? '按分组自动重排机柜' : '恢复默认机房编排'}
                      </button>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {tab === 'style' && (
          <div className="drawer-sections">
            {renderEditLockBanner()}

            <section className="d-sec">
              <div className="d-sec-head">
                <h3 className="d-title">目标服务器</h3>
                {selectedNode && canEdit && (
                  <button
                    type="button"
                    className="d-link-btn"
                    onClick={() => onResetNodeStyle(selectedNode.uuid)}
                  >
                    恢复默认
                  </button>
                )}
              </div>
              <select
                className="d-select"
                aria-label="选择要涂装的节点"
                value={selectedNode?.uuid ?? ''}
                onChange={(e) => e.target.value && onSelectNodeById(e.target.value)}
              >
                {nodes.length === 0 ? (
                  <option value="">暂无节点</option>
                ) : (
                  nodes.map((n) => (
                    <option key={n.uuid} value={n.uuid}>
                      [{resolveNodeGeo(n).code}] {n.name} ({autoDetectModel(n)})
                    </option>
                  ))
                )}
              </select>
            </section>

            {selectedNode && selectedStyle && (
              <>
                <div className="d-chassis-preview" aria-label="服务器硬件面板实时预览">
                  <ServerUnitSvg
                    node={selectedNode}
                    style={selectedStyle}
                    uidBlinking={selectedNodeUidBlinking}
                  />
                </div>

                {canEdit ? (
                  <>
                    <section className="d-sec">
                      <div className="d-sec-head">
                        <h3 className="d-title">机箱形态 (B1–B4)</h3>
                        <span className="d-meta">{selectedStyle.model}</span>
                      </div>
                      <div className="d-model-grid">
                        {MODEL_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`d-model-card${selectedStyle.rawModel === opt.value ? ' is-active' : ''}`}
                            onClick={() => onUpdateNodeStyle(selectedNode.uuid, { model: opt.value })}
                          >
                            <strong>{opt.label}</strong>
                            <span>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="d-sec">
                      <h3 className="d-title">前面板阳极表面</h3>
                      <div className="d-finish-grid">
                        {finishList.map((fin) => (
                          <button
                            key={fin.id}
                            type="button"
                            className={`d-finish-card${selectedStyle.finish === fin.id ? ' is-active' : ''}`}
                            onClick={() => onUpdateNodeStyle(selectedNode.uuid, { finish: fin.id as ChassisFinish })}
                          >
                            <span
                              className="d-finish-swatch"
                              style={{ background: `linear-gradient(180deg, ${fin.top}, ${fin.bot})` }}
                            />
                            <span>{fin.name}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="d-sec">
                      <h3 className="d-title">指示色与资产铭牌</h3>

                      <div className="d-row-between">
                        <span className="d-label">拉手点缀</span>
                        <div className="d-swatch-row">
                          {ACCENTS.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              className={`d-color-dot${selectedStyle.accent === acc.id ? ' is-active' : ''}`}
                              style={{ background: acc.hex }}
                              title={acc.name}
                              aria-label={`强调色：${acc.name}`}
                              onClick={() => onUpdateNodeStyle(selectedNode.uuid, { accent: acc.id })}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="d-row-between">
                        <span className="d-label">OLED 荧光</span>
                        <div className="d-chip-group">
                          {OLEDS.map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              className={`d-chip${selectedStyle.oled === o.id ? ' is-active' : ''}`}
                              onClick={() => onUpdateNodeStyle(selectedNode.uuid, { oled: o.id })}
                            >
                              <i className="d-pip" style={{ background: o.main }} />
                              {o.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="d-field">
                        <label className="d-label" htmlFor="dc-asset-tag">
                          面板标签
                        </label>
                        <div className="d-input-row">
                          <input
                            id="dc-asset-tag"
                            className="d-input"
                            value={selectedStyle.tag}
                            maxLength={14}
                            onChange={(e) => onUpdateNodeStyle(selectedNode.uuid, { tag: e.target.value })}
                          />
                          <button
                            type="button"
                            className={`d-chip${selectedNodeUidBlinking ? ' is-active' : ''}`}
                            onClick={() => onToggleUid(selectedNode.uuid)}
                          >
                            {selectedNodeUidBlinking ? 'UID 闪烁中' : '点亮 UID'}
                          </button>
                        </div>
                      </div>
                    </section>
                  </>
                ) : (
                  <section className="d-sec">
                    <div className="d-row-between">
                      <span className="d-label">机位定位灯 (UID)</span>
                      <button
                        type="button"
                        className={`d-chip${selectedNodeUidBlinking ? ' is-active' : ''}`}
                        onClick={() => onToggleUid(selectedNode.uuid)}
                      >
                        {selectedNodeUidBlinking ? 'UID 闪烁中' : '点亮定位'}
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'telemetry' && (
          <div className="drawer-sections">
            <section className="d-sec d-tel-head-sec">
              <div className="d-sec-head">
                <h3 className="d-title">监控节点</h3>
                <button type="button" className="d-link-btn" onClick={onRefreshTelemetry}>
                  刷新采样
                </button>
              </div>
              <select
                className="d-select"
                aria-label="选择遥测节点"
                value={selectedNode?.uuid ?? ''}
                onChange={(e) => e.target.value && onSelectNodeById(e.target.value)}
              >
                {nodes.length === 0 ? (
                  <option value="">暂无节点</option>
                ) : (
                  nodes.map((n) => (
                    <option key={n.uuid} value={n.uuid}>
                      [{resolveNodeGeo(n).code}] {n.name} · {n.online ? '在线' : '离线'}
                    </option>
                  ))
                )}
              </select>

              {selectedNode && (() => {
                const geo = resolveNodeGeo(selectedNode);
                return (
                  <div className="d-tel-toolbar">
                    <div className="d-tel-identity">
                      <span className={`d-tel-status-dot${selectedNode.online ? ' is-on' : ''}`} />
                      <RegionFlag code={geo.code} size="xs" />
                      <span className="d-tel-geo">{geo.name}</span>
                      {selectedNode.group && <span className="d-tel-tag">{selectedNode.group}</span>}
                    </div>
                    <div className="scope-range-row" role="group" aria-label="全局采样时间窗口">
                      {HOUR_OPTIONS.map((hr) => (
                        <button
                          key={hr}
                          type="button"
                          className={`scope-btn${config.api.recordHours === hr ? ' is-active' : ''}`}
                          onClick={() => onChangeRecordHours(hr)}
                        >
                          {hr}H
                        </button>
                      ))}
                    </div>
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
              const swapPct = hasSwap ? (selectedNode.swap ?? 0) : 0;
              const swapUsedBytes = hasSwap
                ? (selectedNode.swapUsed ?? Math.round((swapPct / 100) * (selectedNode.swap_total ?? 0)))
                : 0;

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
                  {/* 4-Tile Resource Utilization Overview */}
                  <section className="d-sec d-tel-meters-sec">
                    <div className="d-meter-grid">
                      <div className="d-meter-tile">
                        <div className="d-meter-head">
                          <span>CPU</span>
                          <strong>{selectedNode.online ? `${Math.round(selectedNode.cpu)}%` : '--'}</strong>
                        </div>
                        <div className="d-meter-track">
                          <div
                            className={`d-meter-fill${selectedNode.cpu >= 85 ? ' is-hot' : ''}`}
                            style={{ width: `${selectedNode.online ? Math.min(100, selectedNode.cpu) : 0}%` }}
                          />
                        </div>
                        <div className="d-meter-sub">{selectedNode.cpu_cores} 核心</div>
                      </div>

                      <div className="d-meter-tile">
                        <div className="d-meter-head">
                          <span>内存</span>
                          <strong>{selectedNode.online ? `${Math.round(selectedNode.ram)}%` : '--'}</strong>
                        </div>
                        <div className="d-meter-track">
                          <div
                            className={`d-meter-fill${selectedNode.ram >= 88 ? ' is-hot' : ''}`}
                            style={{ width: `${selectedNode.online ? Math.min(100, selectedNode.ram) : 0}%` }}
                          />
                        </div>
                        <div className="d-meter-sub">
                          {selectedNode.online ? formatTrafficBytes(ramUsedBytes) : '0 B'} /{' '}
                          {formatBytesGiB(selectedNode.mem_total)}
                        </div>
                      </div>

                      <div className="d-meter-tile">
                        <div className="d-meter-head">
                          <span>Swap</span>
                          <strong>
                            {!hasSwap ? '未启用' : selectedNode.online ? `${Math.round(swapPct)}%` : '--'}
                          </strong>
                        </div>
                        <div className="d-meter-track">
                          <div
                            className={`d-meter-fill${swapPct >= 80 ? ' is-hot' : ''}`}
                            style={{ width: `${hasSwap && selectedNode.online ? Math.min(100, swapPct) : 0}%` }}
                          />
                        </div>
                        <div className="d-meter-sub">
                          {hasSwap
                            ? `${selectedNode.online ? formatTrafficBytes(swapUsedBytes) : '0 B'} / ${formatTrafficBytes(selectedNode.swap_total)}`
                            : '0 B'}
                        </div>
                      </div>

                      <div className="d-meter-tile">
                        <div className="d-meter-head">
                          <span>磁盘</span>
                          <strong>{`${Math.round(selectedNode.disk)}%`}</strong>
                        </div>
                        <div className="d-meter-track">
                          <div
                            className={`d-meter-fill${selectedNode.disk >= 88 ? ' is-hot' : ''}`}
                            style={{ width: `${Math.min(100, selectedNode.disk)}%` }}
                          />
                        </div>
                        <div className="d-meter-sub">
                          {formatTrafficBytes(diskUsedBytes)} / {formatBytesGiB(selectedNode.disk_total)}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Multi-Chart Telemetry Suite: Latency/Ping + CPU/RAM + Network Throughput */}
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

                  {/* Load Average, Connections & Traffic Summary */}
                  <section className="d-sec">
                    <div className="d-sec-head">
                      <h3 className="d-title">负载与连接态势</h3>
                      {loadPerCore !== null && selectedNode.online && (
                        <span className={`d-meta${loadPerCore >= 0.85 ? ' is-warn-text' : ''}`}>
                          单核负载 {loadPerCore.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="d-spec-grid">
                      <div className="d-spec is-wide">
                        <span>系统负载 (1m / 5m / 15m)</span>
                        <strong>{selectedNode.online ? loadLabel : '--'}</strong>
                      </div>
                      <div className="d-spec">
                        <span>TCP / UDP 连接</span>
                        <strong>
                          {selectedNode.online && selectedNode.tcp !== undefined
                            ? `${selectedNode.tcp} / ${selectedNode.udp ?? 0}`
                            : '--'}
                        </strong>
                      </div>
                      <div className="d-spec">
                        <span>活跃进程数</span>
                        <strong>
                          {selectedNode.online && selectedNode.process !== undefined ? `${selectedNode.process}` : '--'}
                        </strong>
                      </div>
                      <div className="d-spec is-wide">
                        <span>实时带宽</span>
                        <strong>
                          {selectedNode.online
                            ? `↓ ${formatNetSpeed(selectedNode.netDown)}   ↑ ${formatNetSpeed(selectedNode.netUp)}`
                            : '0 B/s'}
                        </strong>
                      </div>
                      {(selectedNode.totalDown !== undefined || selectedNode.totalUp !== undefined) && (
                        <div className="d-spec is-wide">
                          <div className="d-traffic-head">
                            <span>累计流量 (入站 / 出站)</span>
                            <span className="d-meta">总计 {formatTrafficBytes(combinedTraffic)}</span>
                          </div>
                          <strong>
                            ↓ {formatTrafficBytes(selectedNode.totalDown)} / ↑ {formatTrafficBytes(selectedNode.totalUp)}
                          </strong>
                          {combinedTraffic > 0 && (
                            <div className="d-traffic-ratio" aria-label={`入站占比 ${rxShare}%`}>
                              <span className="d-ratio-rx" style={{ width: `${rxShare}%` }} />
                              <span className="d-ratio-tx" style={{ width: `${100 - rxShare}%` }} />
                            </div>
                          )}
                          {selectedNode.trafficLimit !== undefined && selectedNode.trafficLimit > 0 && (
                            <span className="d-traffic-limit">
                              限额 {formatTrafficBytes(selectedNode.trafficLimit)}
                              {selectedNode.trafficLimitType ? ` (${selectedNode.trafficLimitType})` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Hardware & Runtime Specs */}
                  <section className="d-sec">
                    <div className="d-sec-head">
                      <h3 className="d-title">硬件与运行环境</h3>
                      <span className="d-meta">运行 {selectedNode.uptime}</span>
                    </div>

                    <div className="d-spec-grid">
                      <div className="d-spec is-wide">
                        <span>处理器</span>
                        <strong>
                          {selectedNode.cpu_name} ({selectedNode.cpu_cores}C)
                        </strong>
                      </div>
                      {selectedNode.gpu_name && (
                        <div className="d-spec is-wide">
                          <span>GPU 加速卡</span>
                          <strong>{selectedNode.gpu_name}</strong>
                        </div>
                      )}
                      <div className="d-spec is-wide">
                        <span>操作系统与内核</span>
                        <strong>
                          {selectedNode.os}
                          {selectedNode.kernel_version ? ` · ${selectedNode.kernel_version}` : ''}
                        </strong>
                      </div>
                      <div className="d-spec">
                        <span>指令架构</span>
                        <strong>{selectedNode.arch || '--'}</strong>
                      </div>
                      <div className="d-spec">
                        <span>虚拟化平台</span>
                        <strong>{selectedNode.virtualization || '--'}</strong>
                      </div>
                      {selectedNode.expiredAt && (
                        <div className="d-spec is-wide">
                          <span>到期时间</span>
                          <strong>{selectedNode.expiredAt.slice(0, 10)}</strong>
                        </div>
                      )}
                      {tagList.length > 0 && (
                        <div className="d-spec is-wide">
                          <span>节点标签</span>
                          <div className="d-tag-list">
                            {tagList.map((tg) => (
                              <span key={tg} className="d-tag-pill">
                                {tg}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedNode.message && (
                        <div className="d-spec is-wide">
                          <span>节点状态消息</span>
                          <strong>{selectedNode.message}</strong>
                        </div>
                      )}
                    </div>

                    <div className="d-row-between">
                      <span className="d-meta">
                        {isLiveMode
                          ? `WS 实时流${selectedNode.updatedAt ? ` · ${selectedNode.updatedAt.slice(11, 19)}` : ''}`
                          : '本地演示心跳 (3.2s)'}
                      </span>
                      {!isLiveMode && (
                        <button
                          type="button"
                          className="d-ghost-btn"
                          onClick={() => onToggleNodeOnline(selectedNode.uuid)}
                        >
                          {selectedNode.online ? '模拟离线' : '恢复上线'}
                        </button>
                      )}
                    </div>
                  </section>
                </>
              );
            })()}
          </div>
        )}

        {tab === 'api' && (
          <div className="drawer-sections">
            <section className="d-sec">
              <div className="d-sec-head">
                <h3 className="d-title">数据源模式</h3>
                <span className="d-meta">{isLiveMode ? 'Komari API' : '本地演示'}</span>
              </div>
              <div className="d-mode-switch" role="group" aria-label="切换数据源">
                <button
                  type="button"
                  className={`d-mode-btn${!isLiveMode ? ' is-active' : ''}`}
                  onClick={() => onSwitchDataMode('demo')}
                >
                  Demo 演示
                </button>
                <button
                  type="button"
                  className={`d-mode-btn${isLiveMode ? ' is-active' : ''}`}
                  onClick={() => onSwitchDataMode('live')}
                >
                  Komari 实况
                </button>
              </div>
              <p className="d-note">演示与实况机柜编排独立持久化，随时切换互不覆盖。</p>
            </section>

            <section className="d-sec">
              <div className="d-sec-head">
                <h3 className="d-title">Komari 服务端</h3>
                <span className="d-meta">{lastSyncAt ? `同步 ${lastSyncAt}` : '未同步'}</span>
              </div>

              <div className="d-field">
                <label className="d-label" htmlFor="dc-komari-url">
                  站点地址（支持直接填域名，留空使用同源 /api）
                </label>
                <div className="d-input-row">
                  <input
                    id="dc-komari-url"
                    className="d-input d-mono"
                    placeholder="status.example.com 或 https://..."
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onConnectKomari(urlDraft);
                    }}
                  />
                  <button type="button" className="d-primary-sm" onClick={() => onConnectKomari(urlDraft)}>
                    连接
                  </button>
                </div>
                <p className="d-note">
                  远程连接需目标站在 Komari 后台开启 <code>allow_cors</code>；作为官方主题上传同源部署时留空即可自动免配直连。
                </p>
              </div>

              <div className="d-status-box">
                <div className="d-status-row">
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
                <div className="d-status-row">
                  <span>SITE</span>
                  <strong>{isLiveMode ? publicInfo?.sitename ?? '--' : 'DEMO-HALL'}</strong>
                </div>
                <div className="d-status-row">
                  <span>NODES / WS</span>
                  <strong>
                    {nodes.length} 节点 · {wsFramesCount} 帧
                  </strong>
                </div>
                <div className="d-status-row">
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
                  <div className="d-status-row">
                    <span>POLICY</span>
                    <strong>
                      {publicInfo.private_site ? 'PRIVATE' : 'PUBLIC'} · {publicInfo.allow_cors ? 'CORS ON' : 'CORS OFF'}
                    </strong>
                  </div>
                )}
                {apiError && <div className="d-status-err">{apiError}</div>}
                {apiStatus === 'auth_required' && (
                  <a
                    className="d-ghost-btn d-btn-full d-admin-cta"
                    href={adminUrl}
                    target={config.api.baseUrl ? '_blank' : undefined}
                    rel={config.api.baseUrl ? 'noreferrer' : undefined}
                  >
                    前往 Komari 后台登录 (/admin)
                  </a>
                )}
              </div>
            </section>

            {renderLayoutSyncCard()}

            <section className="d-sec">
              <div className="d-sec-head">
                <h3 className="d-title">本地配置备份 / 恢复</h3>
                <span className="d-meta">JSON</span>
              </div>
              <div className="d-two-col">
                <button type="button" className="d-ghost-btn" onClick={onExportConfigJson}>
                  复制导出
                </button>
                <button
                  type="button"
                  className="d-ghost-btn"
                  disabled={!canEdit}
                  title={canEdit ? '导入 JSON 覆盖当前编排' : '需管理员进入编排模式后导入'}
                  onClick={() => {
                    if (!canEdit) return;
                    setShowImportBox((v) => !v);
                    setImportErr(null);
                  }}
                >
                  {showImportBox ? '收起导入' : canEdit ? '导入 JSON' : '导入 (只读)'}
                </button>
              </div>
              {showImportBox && canEdit && (
                <div className="d-import-box">
                  <textarea
                    className="d-textarea"
                    rows={4}
                    placeholder="粘贴此前导出的 JSON..."
                    value={importDraft}
                    onChange={(e) => setImportDraft(e.target.value)}
                  />
                  {importErr && <p className="d-err-text">{importErr}</p>}
                  <button type="button" className="d-primary-sm" onClick={handleApplyImport}>
                    应用配置
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
      </aside>
    </>
  );
}
