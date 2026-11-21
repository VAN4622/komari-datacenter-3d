import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataCenterScene3D, type CameraControlSignal } from '@/components/three/DataCenterScene3D';
import { FloatingHud } from '@/components/hud/FloatingHud';
import { InspectorDrawer } from '@/components/hud/InspectorDrawer';
import {
  ATMOSPHERES,
  DEMO_NODES,
  buildAutoRacksFromNodes,
  buildInitialHistory,
  estimateRackWatts,
  getDefaultConfig,
  getUnitHeightU,
  loadConfig,
  parseImportedConfig,
  saveConfig,
} from '@/data/fleet';
import {
  applyClientsSnapshot,
  buildWsUrl,
  fetchKomariNodes,
  fetchKomariPublic,
  fetchNodeTelemetryRecords,
  normalizeBaseUrl,
  parseClientsMessage,
} from '@/lib/komariApi';
import type {
  ApiConnectionStatus,
  AppConfig,
  CabinetTheme,
  CameraPreset,
  DataSourceMode,
  DrawerTab,
  KomariPublicInfo,
  NodeInfo,
  NodeStyleOverride,
  RackCabinetData,
  RackItem,
  RecordHours,
  RoomAtmosphere,
  TelemetryPoint,
} from '@/types/rack';

interface ToastNotice {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

function makeUid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>(() => loadConfig());
  const [demoNodes, setDemoNodes] = useState<NodeInfo[]>(() => DEMO_NODES.map((n) => ({ ...n })));
  const [liveNodes, setLiveNodes] = useState<NodeInfo[]>([]);
  const [publicInfo, setPublicInfo] = useState<KomariPublicInfo | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiConnectionStatus>(() =>
    config.api.mode === 'live' ? 'connecting' : 'demo',
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [wsFramesCount, setWsFramesCount] = useState(0);
  const [liveConnectNonce, setLiveConnectNonce] = useState(0);

  // React Three Fiber spatial camera signal
  const [cameraSignal, setCameraSignal] = useState<CameraControlSignal>(() => ({
    preset: config.cameraPreset,
    nonce: 0,
  }));
  const [zoomPercent, setZoomPercent] = useState(100);
  const [cameraCustomized, setCameraCustomized] = useState(false);

  // Slide-over inspector drawer (starts closed so the 3D datacenter hall owns the viewport)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('builder');
  const [selectedNodeId, setSelectedNodeId] = useState<string>(DEMO_NODES[1].uuid);
  const [uidBlinkingIds, setUidBlinkingIds] = useState<Set<string>>(() => new Set());
  const [telemetryMap, setTelemetryMap] = useState<Record<string, TelemetryPoint[]>>(() => {
    const initial: Record<string, TelemetryPoint[]> = {};
    for (const n of DEMO_NODES) {
      initial[n.uuid] = buildInitialHistory(n);
    }
    return initial;
  });

  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const isLiveMode = config.api.mode === 'live';
  const nodes = isLiveMode ? liveNodes : demoNodes;
  const activeRackList = useMemo(
    () => (isLiveMode && config.liveRacks && config.liveRacks.length > 0 ? config.liveRacks : config.racks),
    [isLiveMode, config.liveRacks, config.racks],
  );

  const showNotice = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    const id = Date.now();
    setNotice({ id, message, actionLabel, onAction });
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice((cur) => (cur?.id === id ? null : cur));
    }, actionLabel ? 6500 : 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const updateCurrentRacks = useCallback(
    (updater: (racks: RackCabinetData[]) => RackCabinetData[], nextActiveRackId?: string) => {
      setConfig((prev) => {
        const key: 'liveRacks' | 'racks' = prev.api.mode === 'live' ? 'liveRacks' : 'racks';
        const base =
          key === 'liveRacks'
            ? prev.liveRacks && prev.liveRacks.length > 0
              ? prev.liveRacks
              : buildAutoRacksFromNodes(liveNodes)
            : prev.racks;
        const updated = updater(base);
        return {
          ...prev,
          [key]: updated,
          activeRackId: nextActiveRackId ?? prev.activeRackId,
        };
      });
    },
    [liveNodes],
  );

  // Persist config
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // Keep selectedNodeId valid when node list changes
  useEffect(() => {
    if (nodes.length === 0) return;
    if (!nodes.some((n) => n.uuid === selectedNodeId)) {
      setSelectedNodeId(nodes[0].uuid);
    }
  }, [nodes, selectedNodeId]);

  // Subtle demo telemetry heartbeat
  useEffect(() => {
    if (isLiveMode) return;
    const timer = window.setInterval(() => {
      setDemoNodes((prev) =>
        prev.map((n) => {
          if (!n.online) return n;
          const nextCpu = Math.max(4, Math.min(96, Math.round(n.cpu + (Math.random() - 0.5) * 6)));
          const nextRam = Math.max(10, Math.min(94, Math.round(n.ram + (Math.random() - 0.5) * 3)));
          const nextPing = Math.max(6, Math.round(n.ping + (Math.random() - 0.5) * 4));
          const nextDown = Math.max(0.4, Number((n.netDown + (Math.random() - 0.5) * 8).toFixed(1)));
          const nextUp = Math.max(0.2, Number((n.netUp + (Math.random() - 0.5) * 4).toFixed(1)));
          return { ...n, cpu: nextCpu, ram: nextRam, ping: nextPing, netDown: nextDown, netUp: nextUp };
        }),
      );
    }, 3200);
    return () => window.clearInterval(timer);
  }, [isLiveMode]);

  // Append telemetry history in demo mode
  useEffect(() => {
    if (isLiveMode) return;
    const current = demoNodes.find((n) => n.uuid === selectedNodeId);
    if (!current) return;
    setTelemetryMap((prev) => {
      const hist = prev[current.uuid] ?? buildInitialHistory(current);
      const nowLabel = new Date().toLocaleTimeString('zh-CN', { hour12: false, minute: '2-digit', second: '2-digit' });
      const next = [
        ...hist.slice(-17),
        {
          time: nowLabel,
          cpu: current.online ? current.cpu : 0,
          ram: current.online ? current.ram : 0,
          ping: current.online ? current.ping : 0,
        },
      ];
      return { ...prev, [current.uuid]: next };
    });
  }, [demoNodes, selectedNodeId, isLiveMode]);

  // Live Komari REST + WebSocket connection
  useEffect(() => {
    if (!isLiveMode) {
      setApiStatus('demo');
      setApiError(null);
      return;
    }

    let disposed = false;
    let ws: WebSocket | null = null;
    let heartbeatTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    const baseUrl = config.api.baseUrl;
    const controller = new AbortController();

    const connectWebSocket = () => {
      if (disposed) return;
      try {
        const wsUrl = buildWsUrl(baseUrl, '/api/clients');
        ws = new WebSocket(wsUrl);
      } catch (err) {
        setApiStatus('error');
        setApiError(err instanceof Error ? err.message : '无法建立 WebSocket 连接');
        return;
      }

      ws.onopen = () => {
        if (disposed) return;
        reconnectAttempt = 0;
        setApiStatus('live');
        setApiError(null);
        try {
          ws?.send('get');
        } catch {
          // ignore
        }
        if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
        heartbeatTimer = window.setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send('get');
            } catch {
              // ignore
            }
          }
        }, 2500);
      };

      ws.onmessage = (event) => {
        if (disposed || typeof event.data !== 'string') return;
        const snapshot = parseClientsMessage(event.data);
        if (!snapshot) return;
        setWsFramesCount((c) => c + 1);
        setLastSyncAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
        setLiveNodes((prev) => applyClientsSnapshot(prev, snapshot));
      };

      ws.onerror = () => {
        if (disposed) return;
        setApiStatus('degraded');
      };

      ws.onclose = () => {
        if (heartbeatTimer !== null) {
          window.clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (disposed) return;
        setApiStatus('degraded');
        reconnectAttempt += 1;
        const delay = Math.min(12000, 1500 * Math.pow(1.6, reconnectAttempt - 1));
        reconnectTimer = window.setTimeout(connectWebSocket, delay);
      };
    };

    const bootstrapLive = async () => {
      setApiStatus('connecting');
      setApiError(null);
      setWsFramesCount(0);

      try {
        const [pubResult, fetchedNodes] = await Promise.all([
          fetchKomariPublic(baseUrl, controller.signal).catch(() => null),
          fetchKomariNodes(baseUrl, controller.signal),
        ]);
        if (disposed) return;

        setPublicInfo(pubResult);
        setLiveNodes(fetchedNodes);
        setLastSyncAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));

        setConfig((prev) => {
          if (prev.api.mode !== 'live') return prev;
          const validIds = new Set(fetchedNodes.map((n) => n.uuid));
          const hasMatchingLiveRacks =
            prev.liveRacks &&
            prev.liveRacks.length > 0 &&
            prev.liveRacks.some((r) => r.items.some((it) => it.type === 'node' && validIds.has(it.nodeId)));

          if (hasMatchingLiveRacks) {
            return { ...prev, activeRackId: prev.liveRacks![0].id };
          }
          const autoRacks = buildAutoRacksFromNodes(fetchedNodes);
          return { ...prev, liveRacks: autoRacks, activeRackId: autoRacks[0].id };
        });

        connectWebSocket();
      } catch (err) {
        if (disposed) return;
        const msg = err instanceof Error ? err.message : String(err);
        const hint =
          baseUrl && /Failed to fetch|NetworkError|Load failed/i.test(msg)
            ? '跨域或网络受限：请确认 Komari 后台开启 allow_cors，或留空地址改用同源反代。'
            : msg;
        setApiStatus('error');
        setApiError(hint);
        showNotice('Komari 连接失败，请在「接口」页检查地址或 CORS');
      }
    };

    void bootstrapLive();

    return () => {
      disposed = true;
      controller.abort();
      if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, [isLiveMode, config.api.baseUrl, liveConnectNonce, showNotice]);

  // Fetch historical telemetry for selected node in live mode
  useEffect(() => {
    if (!isLiveMode || !selectedNodeId) return;
    const selected = liveNodes.find((n) => n.uuid === selectedNodeId);
    if (!selected) return;

    const controller = new AbortController();
    fetchNodeTelemetryRecords(config.api.baseUrl, selected, config.api.recordHours, controller.signal)
      .then(({ points, latestPing }) => {
        if (points.length > 0) {
          setTelemetryMap((prev) => ({ ...prev, [selectedNodeId]: points }));
        }
        if (latestPing !== null) {
          setLiveNodes((prev) => prev.map((n) => (n.uuid === selectedNodeId ? { ...n, ping: latestPing } : n)));
        }
      })
      .catch(() => {
        // ignore abort or disabled records
      });

    return () => controller.abort();
  }, [isLiveMode, selectedNodeId, config.api.baseUrl, config.api.recordHours, liveNodes.length]);

  const nodesMap = useMemo(() => new Map(nodes.map((n) => [n.uuid, n])), [nodes]);

  const activeRack = useMemo(
    () => activeRackList.find((r) => r.id === config.activeRackId) ?? activeRackList[0],
    [activeRackList, config.activeRackId],
  );

  const mountedNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of activeRackList) {
      for (const item of r.items) {
        if (item.type === 'node') set.add(item.nodeId);
      }
    }
    return set;
  }, [activeRackList]);

  const selectedNode = useMemo(
    () => nodesMap.get(selectedNodeId) ?? nodes[0] ?? null,
    [nodesMap, selectedNodeId, nodes],
  );

  const fleetStats = useMemo(() => {
    const onlineNodes = nodes.filter((n) => n.online).length;
    const totalWatts = activeRackList.reduce((sum, r) => sum + estimateRackWatts(r, nodesMap, config.nodeStyles), 0);
    const totalU = activeRackList.reduce(
      (sum, r) => sum + r.items.reduce((acc, it) => acc + getUnitHeightU(it, nodesMap, config.nodeStyles), 0),
      0,
    );
    return { onlineNodes, totalNodes: nodes.length, totalWatts, totalU };
  }, [nodes, activeRackList, nodesMap, config.nodeStyles]);

  // Camera handlers
  const handleSelectPreset = (preset: CameraPreset) => {
    setConfig((prev) => ({ ...prev, cameraPreset: preset }));
    setCameraSignal((prev) => ({ preset, nonce: prev.nonce + 1 }));
    setCameraCustomized(false);
  };

  const handleResetCamera = () => {
    setCameraSignal((prev) => ({ preset: config.cameraPreset, nonce: prev.nonce + 1 }));
    setCameraCustomized(false);
  };

  const handleUserOrbit = useCallback(() => {
    setCameraCustomized(true);
  }, []);

  const handleZoomStep = (delta: number) => {
    setCameraSignal((prev) => ({
      ...prev,
      zoomStep: { delta, nonce: (prev.zoomStep?.nonce ?? 0) + 1 },
    }));
    setCameraCustomized(true);
  };

  const handleChangeAtmosphere = (atmosphere: RoomAtmosphere) => {
    setConfig((prev) => ({ ...prev, atmosphere }));
    const meta = ATMOSPHERES.find((a) => a.id === atmosphere);
    if (meta) {
      showNotice(`已切换场景：${meta.label} · ${meta.subtitle}`);
    }
  };

  // Rack & node operations
  const handleAddRack = () => {
    if (activeRackList.length >= 5) {
      showNotice('当前单排冷通道最多支持 5 座机柜');
      return;
    }
    const idx = activeRackList.length + 1;
    const themes: CabinetTheme[] = ['obsidian', 'titanium', 'silver'];
    const newRack: RackCabinetData = {
      id: makeUid('rack'),
      name: `A-0${idx} · 扩展机柜`,
      theme: themes[(idx - 1) % themes.length],
      items: [],
    };
    updateCurrentRacks((racks) => [...racks, newRack], newRack.id);
    showNotice(`已扩展机柜位 ${newRack.name}`);
  };

  const handleDeleteActiveRack = () => {
    if (activeRackList.length <= 1) return;
    const removedName = activeRack.name;
    const remaining = activeRackList.filter((r) => r.id !== activeRack.id);
    updateCurrentRacks(() => remaining, remaining[0].id);
    showNotice(`已移除 ${removedName}`);
  };

  const handleRenameRack = (rackId: string, name: string) => {
    updateCurrentRacks((racks) => racks.map((r) => (r.id === rackId ? { ...r, name } : r)));
  };

  const handleChangeRackTheme = (rackId: string, theme: CabinetTheme) => {
    updateCurrentRacks((racks) => racks.map((r) => (r.id === rackId ? { ...r, theme } : r)));
  };

  const handleMountNode = (nodeId: string) => {
    const node = nodesMap.get(nodeId);
    if (!node) return;
    const uid = makeUid('u');
    updateCurrentRacks((racks) =>
      racks.map((r) => (r.id === activeRack.id ? { ...r, items: [...r.items, { uid, type: 'node', nodeId }] } : r)),
    );
    setSelectedNodeId(nodeId);
    showNotice(`已上架 ${node.name} 至 ${activeRack.name}`);
  };

  const handleMountAccessory = (kind: 'pdu' | 'blank') => {
    const uid = makeUid(kind);
    const item: RackItem =
      kind === 'pdu'
        ? { uid, type: 'pdu', label: 'APC-PDU-32A' }
        : { uid, type: 'blank', label: 'COLD-AISLE-BAFFLE' };
    updateCurrentRacks((racks) =>
      racks.map((r) => (r.id === activeRack.id ? { ...r, items: [...r.items, item] } : r)),
    );
    showNotice(kind === 'pdu' ? '已安装 1U 计量 PDU' : '已安装 1U 导风盲板');
  };

  const handleRemoveItem = (rackId: string, uid: string) => {
    const targetRack = activeRackList.find((r) => r.id === rackId);
    const removedItem = targetRack?.items.find((i) => i.uid === uid);
    const removedIdx = targetRack?.items.findIndex((i) => i.uid === uid) ?? -1;
    if (!removedItem) return;

    const label =
      removedItem.type === 'node'
        ? nodesMap.get(removedItem.nodeId)?.name ?? '节点'
        : removedItem.type === 'pdu'
          ? '1U PDU'
          : '1U 导风盲板';

    updateCurrentRacks((racks) =>
      racks.map((r) => (r.id === rackId ? { ...r, items: r.items.filter((i) => i.uid !== uid) } : r)),
    );

    showNotice(`已卸载 ${label}`, '撤销', () => {
      updateCurrentRacks((racks) =>
        racks.map((r) => {
          if (r.id !== rackId) return r;
          const copy = [...r.items];
          copy.splice(Math.max(0, Math.min(removedIdx, copy.length)), 0, removedItem);
          return { ...r, items: copy };
        }),
      );
      setNotice(null);
    });
  };

  const handleClearActiveRack = () => {
    const rackId = activeRack.id;
    const rackName = activeRack.name;
    const snapshot = [...activeRack.items];
    if (snapshot.length === 0) return;

    updateCurrentRacks((racks) => racks.map((r) => (r.id === rackId ? { ...r, items: [] } : r)));
    showNotice(`已清空 ${rackName}（${snapshot.length} 台设备）`, '撤销清空', () => {
      updateCurrentRacks((racks) => racks.map((r) => (r.id === rackId ? { ...r, items: snapshot } : r)));
      setNotice(null);
    });
  };

  const handleResetDefaultLayout = () => {
    if (isLiveMode) {
      const autoRacks = buildAutoRacksFromNodes(liveNodes);
      updateCurrentRacks(() => autoRacks, autoRacks[0].id);
      showNotice('已按 Komari 分组重新编排机房');
      return;
    }
    const fresh = getDefaultConfig();
    setConfig((prev) => ({
      ...fresh,
      cameraPreset: prev.cameraPreset,
      atmosphere: prev.atmosphere,
      api: prev.api,
      liveRacks: prev.liveRacks,
    }));
    showNotice('已恢复默认三柜冷通道编排');
  };

  const handleMoveItem = (rackId: string, index: number, delta: -1 | 1) => {
    updateCurrentRacks((racks) =>
      racks.map((r) => {
        if (r.id !== rackId) return r;
        const target = index + delta;
        if (target < 0 || target >= r.items.length) return r;
        const next = [...r.items];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        return { ...r, items: next };
      }),
    );
  };

  const handleUpdateNodeStyle = (nodeId: string, patch: Partial<NodeStyleOverride>) => {
    setConfig((prev) => ({
      ...prev,
      nodeStyles: {
        ...prev.nodeStyles,
        [nodeId]: { ...(prev.nodeStyles[nodeId] ?? {}), ...patch },
      },
    }));
  };

  const handleResetNodeStyle = (nodeId: string) => {
    setConfig((prev) => {
      const next = { ...prev.nodeStyles };
      delete next[nodeId];
      return { ...prev, nodeStyles: next };
    });
    showNotice('已重置该节点涂装与机型');
  };

  const handleToggleUid = (nodeId: string) => {
    setUidBlinkingIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleToggleNodeOnline = (nodeId: string) => {
    if (isLiveMode) return;
    setDemoNodes((prev) =>
      prev.map((n) =>
        n.uuid === nodeId
          ? { ...n, online: !n.online, cpu: !n.online ? 32 : 0, ram: !n.online ? 44 : 0, uptime: !n.online ? '0d 01h' : 'OFFLINE' }
          : n,
      ),
    );
  };

  const handleRefreshTelemetry = () => {
    if (isLiveMode) {
      setLiveConnectNonce((n) => n + 1);
      showNotice('正在重新同步 Komari 遥测流');
      return;
    }
    setDemoNodes((prev) =>
      prev.map((n) =>
        n.online
          ? {
              ...n,
              cpu: Math.max(8, Math.min(92, Math.round(n.cpu + (Math.random() - 0.5) * 14))),
              ram: Math.max(14, Math.min(90, Math.round(n.ram + (Math.random() - 0.5) * 8))),
            }
          : n,
      ),
    );
    showNotice('已采样最新节点负载');
  };

  const handleSwitchDataMode = (mode: DataSourceMode) => {
    if (mode === config.api.mode) return;
    setConfig((prev) => {
      const targetPool = mode === 'live' && prev.liveRacks && prev.liveRacks.length > 0 ? prev.liveRacks : prev.racks;
      return {
        ...prev,
        activeRackId: targetPool[0]?.id ?? prev.activeRackId,
        api: { ...prev.api, mode },
      };
    });
    showNotice(mode === 'live' ? '已切换至 Komari 实况模式' : '已切换回 Demo 演示机房');
  };

  const handleConnectKomari = (rawBaseUrl: string) => {
    const clean = normalizeBaseUrl(rawBaseUrl);
    setConfig((prev) => ({ ...prev, api: { ...prev.api, mode: 'live', baseUrl: clean } }));
    setLiveConnectNonce((n) => n + 1);
    showNotice(clean ? `正在连接 ${clean}` : '正在通过同源 /api 连接 Komari');
  };

  const handleChangeRecordHours = (hours: RecordHours) => {
    setConfig((prev) => ({ ...prev, api: { ...prev.api, recordHours: hours } }));
  };

  const handleExportConfigJson = () => {
    const payload = JSON.stringify(config, null, 2);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(payload)
        .then(() => showNotice('机房编排与涂装 JSON 已复制到剪贴板'))
        .catch(() => showNotice('复制失败，请检查浏览器剪贴板权限'));
    } else {
      showNotice('当前环境不支持自动剪贴板复制');
    }
  };

  const handleImportConfigJson = (rawJson: string): { ok: boolean; error?: string } => {
    try {
      const next = parseImportedConfig(rawJson, config);
      setConfig(next);
      setCameraSignal((prev) => ({ preset: next.cameraPreset, nonce: prev.nonce + 1 }));
      setCameraCustomized(false);
      showNotice('已应用导入的机房编排与涂装');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'JSON 格式无效' };
    }
  };

  const siteDisplayName = isLiveMode ? publicInfo?.sitename || 'KOMARI // LIVE' : 'KOMARI // HALL A';

  return (
    <div className={`dc-app atmo-${config.atmosphere}`}>
      <DataCenterScene3D
        siteName={siteDisplayName}
        atmosphere={config.atmosphere}
        scale={config.scale}
        racks={activeRackList}
        activeRackId={activeRack.id}
        nodes={nodes}
        nodesMap={nodesMap}
        nodeStyles={config.nodeStyles}
        selectedNodeId={selectedNode?.uuid ?? null}
        uidBlinkingIds={uidBlinkingIds}
        showStrip={config.showStrip}
        drawerOpen={drawerOpen}
        totalWatts={fleetStats.totalWatts}
        totalU={fleetStats.totalU}
        isLive={isLiveMode}
        apiStatus={apiStatus}
        cameraSignal={cameraSignal}
        onUserOrbit={handleUserOrbit}
        onZoomPercentChange={setZoomPercent}
        onSelectRack={(rackId) => setConfig((prev) => ({ ...prev, activeRackId: rackId }))}
        onSelectNode={(nodeId, rackId) => {
          setSelectedNodeId(nodeId);
          setConfig((prev) => ({ ...prev, activeRackId: rackId }));
          setDrawerOpen(true);
          if (drawerTab === 'builder' || drawerTab === 'api') {
            setDrawerTab('style');
          }
        }}
        onAddRack={handleAddRack}
      />

      <FloatingHud
        siteName={siteDisplayName}
        dataMode={config.api.mode}
        apiStatus={apiStatus}
        onlineNodes={fleetStats.onlineNodes}
        totalNodes={fleetStats.totalNodes}
        totalWatts={fleetStats.totalWatts}
        totalU={fleetStats.totalU}
        rackCount={activeRackList.length}
        cameraPreset={config.cameraPreset}
        zoomPercent={zoomPercent}
        cameraCustomized={cameraCustomized}
        atmosphere={config.atmosphere}
        scale={config.scale}
        showStrip={config.showStrip}
        drawerOpen={drawerOpen}
        onSelectPreset={handleSelectPreset}
        onResetCamera={handleResetCamera}
        onZoomStep={handleZoomStep}
        onChangeAtmosphere={handleChangeAtmosphere}
        onToggleScale={() =>
          setConfig((prev) => ({ ...prev, scale: prev.scale === 'standard' ? 'compact' : 'standard' }))
        }
        onToggleStrip={() => setConfig((prev) => ({ ...prev, showStrip: !prev.showStrip }))}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        onOpenApiTab={() => {
          setDrawerTab('api');
          setDrawerOpen(true);
        }}
      />

      <InspectorDrawer
        open={drawerOpen}
        tab={drawerTab}
        onClose={() => setDrawerOpen(false)}
        onTabChange={setDrawerTab}
        config={config}
        racks={activeRackList}
        activeRack={activeRack}
        nodes={nodes}
        mountedNodeIds={mountedNodeIds}
        selectedNode={selectedNode}
        selectedNodeUidBlinking={selectedNode ? uidBlinkingIds.has(selectedNode.uuid) : false}
        telemetryHistory={selectedNode ? telemetryMap[selectedNode.uuid] ?? buildInitialHistory(selectedNode) : []}
        apiStatus={apiStatus}
        apiError={apiError}
        publicInfo={publicInfo}
        lastSyncAt={lastSyncAt}
        wsFramesCount={wsFramesCount}
        onSelectRack={(rackId) => setConfig((prev) => ({ ...prev, activeRackId: rackId }))}
        onAddRack={handleAddRack}
        onRenameRack={handleRenameRack}
        onDeleteActiveRack={handleDeleteActiveRack}
        onChangeRackTheme={handleChangeRackTheme}
        onMountNode={handleMountNode}
        onMountAccessory={handleMountAccessory}
        onMoveItem={handleMoveItem}
        onRemoveItem={handleRemoveItem}
        onClearActiveRack={handleClearActiveRack}
        onResetDefaultLayout={handleResetDefaultLayout}
        onSelectNodeById={setSelectedNodeId}
        onUpdateNodeStyle={handleUpdateNodeStyle}
        onResetNodeStyle={handleResetNodeStyle}
        onToggleUid={handleToggleUid}
        onToggleNodeOnline={handleToggleNodeOnline}
        onRefreshTelemetry={handleRefreshTelemetry}
        onSwitchDataMode={handleSwitchDataMode}
        onConnectKomari={handleConnectKomari}
        onChangeRecordHours={handleChangeRecordHours}
        onExportConfigJson={handleExportConfigJson}
        onImportConfigJson={handleImportConfigJson}
      />

      {/* Quiet bottom-left notice pill (pure CSS, zero external animation libs) */}
      {notice && (
        <div className="hud-notice" role="status" aria-live="polite">
          <span>{notice.message}</span>
          {notice.actionLabel && notice.onAction && (
            <button type="button" className="hud-notice-action" onClick={notice.onAction}>
              {notice.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
