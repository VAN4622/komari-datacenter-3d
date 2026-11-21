import { useEffect, useState } from 'react';
import { ServerUnitSvg } from '@/components/hardware/ServerChassisSvg';
import { TelemetryScope } from '@/components/hud/TelemetryScope';
import { ACCENTS, CABINET_THEMES, FINISHES, OLEDS, autoDetectModel, formatBytesGiB, getEffectiveStyle } from '@/data/fleet';
import type {
  ApiConnectionStatus,
  AppConfig,
  CabinetTheme,
  ChassisFinish,
  DataSourceMode,
  DrawerTab,
  KomariPublicInfo,
  ModelSelection,
  NodeInfo,
  NodeStyleOverride,
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
  apiStatus: ApiConnectionStatus;
  apiError: string | null;
  publicInfo: KomariPublicInfo | null;
  lastSyncAt: string | null;
  wsFramesCount: number;
  onSelectRack: (rackId: string) => void;
  onAddRack: () => void;
  onRenameRack: (rackId: string, name: string) => void;
  onDeleteActiveRack: () => void;
  onChangeRackTheme: (rackId: string, theme: CabinetTheme) => void;
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
  { id: 'builder', label: '编排' },
  { id: 'style', label: '涂装' },
  { id: 'telemetry', label: '遥测' },
  { id: 'api', label: '接口' },
];

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
  apiStatus,
  apiError,
  publicInfo,
  lastSyncAt,
  wsFramesCount,
  onSelectRack,
  onAddRack,
  onRenameRack,
  onDeleteActiveRack,
  onChangeRackTheme,
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

  return (
    <aside
      className={`inspector-drawer${open ? ' is-open' : ''}`}
      aria-label="机房精调检视面板"
      aria-hidden={!open}
    >
      <div className="drawer-head">
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
            <section className="d-sec">
              <div className="d-sec-head">
                <h3 className="d-title">机柜阵列</h3>
                <button type="button" className="d-link-btn" onClick={onAddRack}>
                  + 新增机柜
                </button>
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
                    const title =
                      item.type === 'node'
                        ? node
                          ? `${node.region} ${node.name}`
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
                              onTabChange('style');
                            }
                          }}
                          disabled={!node}
                          title={node ? '点击检视与涂装该节点' : title}
                        >
                          <span className="d-slot-idx">#{idx + 1}</span>
                          <span className="d-slot-name">{title}</span>
                        </button>
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
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

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
                          {node.region} {node.name}
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

            <section className="d-sec">
              <div className="d-sec-head">
                <h3 className="d-title">机柜维护</h3>
                <span className="d-meta">{activeRack.name}</span>
              </div>

              <div className="d-danger-stack">
                {activeRack.items.length > 0 && (
                  confirmAction === 'clear' ? (
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
                  )
                )}

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
          </div>
        )}

        {tab === 'style' && (
          <div className="drawer-sections">
            <section className="d-sec">
              <div className="d-sec-head">
                <h3 className="d-title">目标服务器</h3>
                {selectedNode && (
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
                      {n.region} {n.name} ({autoDetectModel(n)})
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
            )}
          </div>
        )}

        {tab === 'telemetry' && (
          <div className="drawer-sections">
            <section className="d-sec">
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
                      {n.region} {n.name} · {n.online ? '在线' : '离线'}
                    </option>
                  ))
                )}
              </select>
            </section>

            {selectedNode && (
              <>
                <TelemetryScope
                  points={telemetryHistory}
                  nodeName={`${selectedNode.region} ${selectedNode.name}`}
                  online={selectedNode.online}
                  recordHours={config.api.recordHours}
                  onChangeRecordHours={onChangeRecordHours}
                  isLiveMode={isLiveMode}
                />

                <section className="d-sec">
                  <div className="d-spec-grid">
                    <div className="d-spec">
                      <span>实时吞吐</span>
                      <strong>
                        {selectedNode.online
                          ? `↓${selectedNode.netDown.toFixed(1)} / ↑${selectedNode.netUp.toFixed(1)} Mbps`
                          : '0 Mbps'}
                      </strong>
                    </div>
                    <div className="d-spec">
                      <span>往返延迟</span>
                      <strong>{selectedNode.online && selectedNode.ping > 0 ? `${selectedNode.ping} ms` : '--'}</strong>
                    </div>
                    <div className="d-spec">
                      <span>处理器</span>
                      <strong>{selectedNode.cpu_name}</strong>
                    </div>
                    <div className="d-spec">
                      <span>规格与系统</span>
                      <strong>
                        {selectedNode.cpu_cores}C · {formatBytesGiB(selectedNode.mem_total)} · {selectedNode.os}
                      </strong>
                    </div>
                    {isLiveMode && (
                      <>
                        <div className="d-spec">
                          <span>1m 负载</span>
                          <strong>{selectedNode.load1 !== undefined ? selectedNode.load1.toFixed(2) : '--'}</strong>
                        </div>
                        <div className="d-spec">
                          <span>TCP / UDP</span>
                          <strong>
                            {selectedNode.tcp !== undefined ? `${selectedNode.tcp} / ${selectedNode.udp ?? 0}` : '--'}
                          </strong>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="d-row-between">
                    <span className="d-meta">运行时间 {selectedNode.uptime}</span>
                    {!isLiveMode ? (
                      <button
                        type="button"
                        className="d-ghost-btn"
                        onClick={() => onToggleNodeOnline(selectedNode.uuid)}
                      >
                        {selectedNode.online ? '模拟离线' : '恢复上线'}
                      </button>
                    ) : (
                      <span className="d-meta">WS 实时流</span>
                    )}
                  </div>
                </section>
              </>
            )}
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
                  站点地址（留空使用同源 /api 反代）
                </label>
                <div className="d-input-row">
                  <input
                    id="dc-komari-url"
                    className="d-input d-mono"
                    placeholder="https://status.example.com"
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
              </div>

              <div className="d-status-box">
                <div className="d-status-row">
                  <span>LINK</span>
                  <strong className={apiStatus === 'live' ? 'is-ok' : apiStatus === 'error' ? 'is-err' : ''}>
                    {apiStatus.toUpperCase()}
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
                {apiError && <div className="d-status-err">{apiError}</div>}
              </div>
            </section>

            <section className="d-sec">
              <div className="d-sec-head">
                <h3 className="d-title">编排配置同步</h3>
                <span className="d-meta">JSON</span>
              </div>
              <div className="d-two-col">
                <button type="button" className="d-ghost-btn" onClick={onExportConfigJson}>
                  复制导出
                </button>
                <button
                  type="button"
                  className="d-ghost-btn"
                  onClick={() => {
                    setShowImportBox((v) => !v);
                    setImportErr(null);
                  }}
                >
                  {showImportBox ? '收起导入' : '导入 JSON'}
                </button>
              </div>
              {showImportBox && (
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
  );
}
