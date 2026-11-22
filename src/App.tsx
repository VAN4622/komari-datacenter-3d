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
  hasSavedConfig,
  loadConfig,
  parseImportedConfig,
  parsePersistedLayoutJson,
  saveConfig,
  serializePersistedLayout,
} from '@/data/fleet';
import {
  KomariApiError,
  applyClientsSnapshot,
  buildAdminUrl,
  buildWsUrl,
  fetchBatchLatestPings,
  fetchKomariMe,
  fetchKomariNodes,
  fetchKomariPublic,
  fetchNodeTelemetryRecords,
  isSameOriginTarget,
  normalizeBaseUrl,
  parseClientsMessage,
  parseKomariThemeSettings,
  probeSameOriginKomari,
  saveKomariThemeLayout,
} from '@/lib/komariApi';
import type {
  AdminAuthStatus,
  ApiConnectionStatus,
  AppConfig,
  CabinetTheme,
  CameraControlMode,
  CameraPreset,
  DataSourceMode,
  DrawerTab,
  KomariMeInfo,
  KomariPublicInfo,
  LayoutSyncSource,
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
  const hasInitialSavedConfigRef = useRef<boolean>(hasSavedConfig());
  const skipNextSaveRef = useRef<boolean>(!hasInitialSavedConfigRef.current);
  const themeDefaultsAppliedRef = useRef<boolean>(false);

  const [config, setConfig] = useState<AppConfig>(() => {
    const loaded = loadConfig();
    // Optional URL query override for direct remote preview: ?api=https://status.example.com
    if (typeof window !== 'undefined') {
      const apiParam = new URLSearchParams(window.location.search).get('api');
      if (apiParam !== null && apiParam.trim() !== '') {
        return {
          ...loaded,
          api: {
            ...loaded.api,
            mode: 'live',
            baseUrl: normalizeBaseUrl(apiParam),
          },
        };
      }
    }
    return loaded;
  });
  const liveRacksRef = useRef<RackCabinetData[] | undefined>(config.liveRacks);
  const [sameOriginKomari, setSameOriginKomari] = useState(false);
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

  // React Three Fiber spatial camera signal (fixed 2.5D default)
  const [cameraSignal, setCameraSignal] = useState<CameraControlSignal>(() => ({
    preset: config.cameraPreset,
    nonce: 0,
  }));
  const [cameraControlMode, setCameraControlMode] = useState<CameraControlMode>('locked25d');
  const [zoomPercent, setZoomPercent] = useState(100);
  const [cameraCustomized, setCameraCustomized] = useState(false);

  // Admin auth & read-only / edit-mode gating
  const [adminAuthStatus, setAdminAuthStatus] = useState<AdminAuthStatus>('guest');
  const [adminInfo, setAdminInfo] = useState<KomariMeInfo | null>(null);
  const [authCheckNonce, setAuthCheckNonce] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [layoutSyncSource, setLayoutSyncSource] = useState<LayoutSyncSource>('auto');
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [isPublishingLayout, setIsPublishingLayout] = useState(false);

  // Slide-over inspector drawer (starts closed; opens to telemetry by default in read-only mode)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('telemetry');
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
  const isSameOriginLink = isSameOriginTarget(config.api.baseUrl);
  const canEnterEditMode = !isLiveMode || adminAuthStatus === 'authenticated';
  const canEdit = canEnterEditMode && editMode;

  const themeSettings = useMemo(
    () => parseKomariThemeSettings(publicInfo?.theme_settings),
    [publicInfo?.theme_settings],
  );
  const serverPublishedLayout = useMemo(
    () => parsePersistedLayoutJson(themeSettings.rackLayoutJson),
    [themeSettings.rackLayoutJson],
  );
  const nodes = isLiveMode ? liveNodes : demoNodes;
  const activeRackList = useMemo(
    () => (isLiveMode && config.liveRacks && config.liveRacks.length > 0 ? config.liveRacks : config.racks),
    [isLiveMode, config.liveRacks, config.racks],
  );

  // Verify Komari admin session via same-origin /api/me (read-only by default for guests & remote links)
  useEffect(() => {
    if (!isLiveMode) {
      setAdminAuthStatus('guest');
      setAdminInfo(null);
      return;
    }
    if (!isSameOriginLink) {
      setAdminAuthStatus('remote_readonly');
      setAdminInfo(null);
      setEditMode(false);
      return;
    }
    const controller = new AbortController();
    setAdminAuthStatus('checking');
    fetchKomariMe(config.api.baseUrl, controller.signal)
      .then((me) => {
        if (controller.signal.aborted) return;
        if (me.loggedIn) {
          setAdminAuthStatus('authenticated');
          setAdminInfo(me);
        } else {
          setAdminAuthStatus('guest');
          setAdminInfo(null);
          setEditMode(false);
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAdminAuthStatus('guest');
        setAdminInfo(null);
        setEditMode(false);
      });
    return () => controller.abort();
  }, [isLiveMode, isSameOriginLink, config.api.baseUrl, authCheckNonce, liveConnectNonce]);

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

  // Persist config (skip system-only bootstrap updates so fresh visitors inherit Komari theme_settings)
  useEffect(() => {
    liveRacksRef.current = config.liveRacks;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveConfig(config);
  }, [config]);

  // Auto-detect same-origin Komari deployment on boot (when installed as an official Komari theme)
  useEffect(() => {
    const controller = new AbortController();
    probeSameOriginKomari(controller.signal).then((pub) => {
      if (!pub || controller.signal.aborted) return;
      setSameOriginKomari(true);
      setPublicInfo((prev) => prev ?? pub);

      const hasQueryApi =
        typeof window !== 'undefined' && Boolean(new URLSearchParams(window.location.search).get('api')?.trim());

      if (!hasInitialSavedConfigRef.current && !hasQueryApi) {
        const ts = parseKomariThemeSettings(pub.theme_settings);
        themeDefaultsAppliedRef.current = true;
        skipNextSaveRef.current = true;
        setConfig((prev) => ({
          ...prev,
          atmosphere: ts.defaultAtmosphere ?? prev.atmosphere,
          cameraPreset: ts.defaultCameraPreset ?? prev.cameraPreset,
          showStrip: ts.showStatusStrip ?? prev.showStrip,
          scale: ts.compactRackWidth !== undefined ? (ts.compactRackWidth ? 'compact' : 'standard') : prev.scale,
          api: {
            ...prev.api,
            mode: 'live',
            baseUrl: '',
            recordHours: ts.recordHours ?? prev.api.recordHours,
          },
        }));
        if (ts.defaultCameraPreset) {
          setCameraSignal((prev) => ({ preset: ts.defaultCameraPreset!, nonce: prev.nonce + 1 }));
          setCameraCustomized(false);
        }
      }
    });
    return () => controller.abort();
  }, []);

  // Sync browser document.title & meta description with Komari sitename / description
  useEffect(() => {
    const customTitle = themeSettings.customHallTitle;
    if (isLiveMode && (customTitle || publicInfo?.sitename)) {
      document.title = customTitle || publicInfo?.sitename || 'Komari Monitor';
    } else {
      document.title = 'Komari Data Center Hall — 3D Perspective Rack Monitor';
    }

    if (isLiveMode && publicInfo?.description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', publicInfo.description);
    }
  }, [isLiveMode, publicInfo?.sitename, publicInfo?.description, themeSettings.customHallTitle]);

  // Keep selectedNodeId valid when node list changes
  useEffect(() => {
    if (nodes.length === 0) return;
    if (!nodes.some((n) => n.uuid === selectedNodeId)) {
      setSelectedNodeId(nodes[0].uuid);
    }
  }, [nodes, selectedNodeId]);

  // Subtle demo telemetry heartbeat (canonical Bytes/sec)
  useEffect(() => {
    if (isLiveMode) return;
    const timer = window.setInterval(() => {
      setDemoNodes((prev) =>
        prev.map((n) => {
          if (!n.online) return n;
          const nextCpu = Math.max(4, Math.min(96, Math.round(n.cpu + (Math.random() - 0.5) * 6)));
          const nextRam = Math.max(10, Math.min(94, Math.round(n.ram + (Math.random() - 0.5) * 3)));
          const nextPing = Math.max(6, Math.round(n.ping + (Math.random() - 0.5) * 4));
          const downBase = Math.max(32 * 1024, n.netDown);
          const upBase = Math.max(16 * 1024, n.netUp);
          const nextDown = Math.max(16 * 1024, Math.round(downBase * (0.86 + Math.random() * 0.28)));
          const nextUp = Math.max(8 * 1024, Math.round(upBase * (0.86 + Math.random() * 0.28)));
          return {
            ...n,
            cpu: nextCpu,
            ram: nextRam,
            ping: nextPing,
            netDown: nextDown,
            netUp: nextUp,
            totalDown: (n.totalDown ?? 0) + nextDown * 3.2,
            totalUp: (n.totalUp ?? 0) + nextUp * 3.2,
          };
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
        // Fetch public info and nodes independently so private_site / sitename / theme_settings
        // are still captured even when /api/nodes responds with 401/403.
        const [pubOutcome, nodesOutcome] = await Promise.allSettled([
          fetchKomariPublic(baseUrl, controller.signal),
          fetchKomariNodes(baseUrl, controller.signal),
        ]);
        if (disposed) return;

        const pubResult = pubOutcome.status === 'fulfilled' ? pubOutcome.value : null;
        if (pubResult) {
          setPublicInfo(pubResult);
          if (isSameOriginTarget(baseUrl)) {
            setSameOriginKomari(true);
          }
        }

        const parsedTheme = parseKomariThemeSettings(pubResult?.theme_settings);

        if (nodesOutcome.status === 'rejected') {
          const err = nodesOutcome.reason;
          const isAuthErr =
            (err instanceof KomariApiError && err.code === 'auth') ||
            Boolean(pubResult?.private_site);

          if (isAuthErr) {
            setLiveNodes([]);
            setApiStatus('auth_required');
            setApiError(
              err instanceof Error
                ? err.message
                : '站点已开启私密模式（private_site），请先登录 Komari 后台。',
            );
            return;
          }
          throw err;
        }

        const fetchedNodes = nodesOutcome.value;
        setLiveNodes(fetchedNodes);
        setLastSyncAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));

        const shouldApplyThemeDefaults =
          Boolean(pubResult?.theme_settings) &&
          !hasInitialSavedConfigRef.current &&
          !themeDefaultsAppliedRef.current;

        if (shouldApplyThemeDefaults) {
          themeDefaultsAppliedRef.current = true;
        }

        const serverLayout = parsePersistedLayoutJson(parsedTheme.rackLayoutJson);
        const validIds = new Set(fetchedNodes.map((n) => n.uuid));
        const serverHasMatches =
          Boolean(serverLayout) &&
          serverLayout!.racks.some((r) => r.items.some((it) => it.type === 'node' && validIds.has(it.nodeId)));
        const currentLiveRacks = liveRacksRef.current;
        const localHasMatches =
          Boolean(currentLiveRacks && currentLiveRacks.length > 0) &&
          currentLiveRacks!.some((r) => r.items.some((it) => it.type === 'node' && validIds.has(it.nodeId)));

        const resolvedSource: LayoutSyncSource =
          serverLayout && (serverHasMatches || !localHasMatches)
            ? 'server'
            : localHasMatches
              ? 'local_draft'
              : 'auto';

        skipNextSaveRef.current = true;
        setConfig((prev) => {
          if (prev.api.mode !== 'live') return prev;
          let nextLiveRacks: RackCabinetData[];
          let nextNodeStyles = prev.nodeStyles;

          if (resolvedSource === 'server' && serverLayout) {
            nextLiveRacks = serverLayout.racks;
            nextNodeStyles = { ...prev.nodeStyles, ...serverLayout.nodeStyles };
          } else if (resolvedSource === 'local_draft' && prev.liveRacks && prev.liveRacks.length > 0) {
            nextLiveRacks = prev.liveRacks;
          } else {
            nextLiveRacks = buildAutoRacksFromNodes(fetchedNodes, parsedTheme.defaultCabinetTheme ?? 'auto');
          }

          return {
            ...prev,
            atmosphere: shouldApplyThemeDefaults && parsedTheme.defaultAtmosphere ? parsedTheme.defaultAtmosphere : prev.atmosphere,
            cameraPreset:
              shouldApplyThemeDefaults && parsedTheme.defaultCameraPreset
                ? parsedTheme.defaultCameraPreset
                : prev.cameraPreset,
            showStrip:
              shouldApplyThemeDefaults && parsedTheme.showStatusStrip !== undefined
                ? parsedTheme.showStatusStrip
                : prev.showStrip,
            scale:
              shouldApplyThemeDefaults && parsedTheme.compactRackWidth !== undefined
                ? parsedTheme.compactRackWidth
                  ? 'compact'
                  : 'standard'
                : prev.scale,
            api:
              shouldApplyThemeDefaults && parsedTheme.recordHours
                ? { ...prev.api, recordHours: parsedTheme.recordHours }
                : prev.api,
            liveRacks: nextLiveRacks,
            nodeStyles: nextNodeStyles,
            activeRackId: nextLiveRacks[0].id,
          };
        });
        setLayoutSyncSource(resolvedSource);
        setHasUnpublishedChanges(resolvedSource === 'local_draft');

        if (shouldApplyThemeDefaults && parsedTheme.defaultCameraPreset) {
          setCameraSignal((prev) => ({ preset: parsedTheme.defaultCameraPreset!, nonce: prev.nonce + 1 }));
          setCameraCustomized(false);
        }

        connectWebSocket();
      } catch (err) {
        if (disposed) return;
        const msg = err instanceof Error ? err.message : String(err);
        const hint =
          err instanceof KomariApiError
            ? err.message
            : baseUrl && /Failed to fetch|NetworkError|Load failed/i.test(msg)
              ? '跨域或网络受限：请确认目标 Komari 后台已开启 allow_cors，或留空地址使用同源部署。'
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

  // Background batch Ping polling for all live nodes so every server status strip displays live ms latency
  const liveNodeUuidsKey = useMemo(
    () =>
      isLiveMode
        ? liveNodes
            .map((n) => n.uuid)
            .sort()
            .join(',')
        : '',
    [isLiveMode, liveNodes],
  );

  useEffect(() => {
    if (!isLiveMode || !liveNodeUuidsKey) return;
    if (publicInfo?.record_enabled === false || themeSettings.enablePingPolling === false) return;

    const uuids = liveNodeUuidsKey.split(',').filter(Boolean);
    if (uuids.length === 0) return;

    let disposed = false;
    let activeController: AbortController | null = null;

    const syncAllPings = async () => {
      if (disposed) return;
      activeController?.abort();
      activeController = new AbortController();
      const pingMap = await fetchBatchLatestPings(config.api.baseUrl, uuids, activeController.signal, 3);
      if (disposed || Object.keys(pingMap).length === 0) return;

      setLiveNodes((prev) => {
        let changed = false;
        const next = prev.map((n) => {
          const nextPing = pingMap[n.uuid];
          if (nextPing !== undefined && nextPing !== n.ping) {
            changed = true;
            return { ...n, ping: nextPing };
          }
          return n;
        });
        return changed ? next : prev;
      });
    };

    void syncAllPings();
    const timer = window.setInterval(() => {
      void syncAllPings();
    }, 45000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      activeController?.abort();
    };
  }, [isLiveMode, liveNodeUuidsKey, config.api.baseUrl, publicInfo?.record_enabled, themeSettings.enablePingPolling]);

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
    const totalNetDown = nodes.reduce((sum, n) => sum + (n.online ? n.netDown : 0), 0);
    const totalNetUp = nodes.reduce((sum, n) => sum + (n.online ? n.netUp : 0), 0);
    return { onlineNodes, totalNodes: nodes.length, totalWatts, totalU, totalNetDown, totalNetUp };
  }, [nodes, activeRackList, nodesMap, config.nodeStyles]);

  const ensureCanEdit = useCallback((): boolean => {
    if (canEdit) return true;
    if (isLiveMode && !isSameOriginLink) {
      showNotice('远程跨域模式仅支持只读监看，请同源部署后登录 Komari 后台进行编排');
    } else if (isLiveMode && adminAuthStatus !== 'authenticated') {
      showNotice('当前为访客只读模式，仅登录 Komari 管理员账号 (/admin) 后可编排机柜');
    } else {
      showNotice('当前处于只读监看模式，请先点击顶部「解锁编排」按钮');
    }
    return false;
  }, [canEdit, isLiveMode, isSameOriginLink, adminAuthStatus, showNotice]);

  const markLayoutDirty = useCallback(() => {
    if (isLiveMode) {
      setHasUnpublishedChanges(true);
      setLayoutSyncSource('local_draft');
    }
  }, [isLiveMode]);

  const handleToggleEditMode = () => {
    if (!canEnterEditMode) {
      if (isLiveMode && !isSameOriginLink) {
        showNotice('远程跨域模式无法校验管理员 Cookie，请将主题安装到目标 Komari 后台使用');
      } else {
        showNotice('需要管理员鉴权：请先登录 Komari 后台 (/admin)，再点击刷新鉴权');
      }
      return;
    }
    setEditMode((prev) => {
      const next = !prev;
      if (next) {
        setDrawerTab('builder');
        setDrawerOpen(true);
        showNotice(
          isLiveMode
            ? `已进入管理员编排模式（${adminInfo?.username || 'Admin'}），修改后可一键发布至服务端`
            : '已进入本地演示编排模式（仅保存在当前浏览器）',
        );
      } else {
        showNotice('已切回只读监看模式');
      }
      return next;
    });
  };

  const handleRecheckAdminAuth = () => {
    setAuthCheckNonce((n) => n + 1);
    showNotice('正在通过 /api/me 重新校验 Komari 管理员会话...');
  };

  const handlePublishLayoutToServer = async () => {
    if (!isLiveMode || !isSameOriginLink || adminAuthStatus !== 'authenticated') {
      showNotice('仅同源已登录 Komari 管理员可直接发布编排到服务端');
      return;
    }
    setIsPublishingLayout(true);
    const serialized = serializePersistedLayout(activeRackList, config.nodeStyles, adminInfo?.username);
    const themeShort = publicInfo?.theme || 'komari-datacenter-3d';
    const result = await saveKomariThemeLayout(
      config.api.baseUrl,
      themeShort,
      publicInfo?.theme_settings,
      serialized,
    );
    setIsPublishingLayout(false);

    if (result.ok) {
      setPublicInfo((prev) =>
        prev
          ? {
              ...prev,
              theme_settings: {
                ...(prev.theme_settings ?? {}),
                rackLayoutJson: serialized,
              },
            }
          : prev,
      );
      setLayoutSyncSource('server');
      setHasUnpublishedChanges(false);
      showNotice('机柜编排已发布至 Komari 服务端，所有访客刷新即可看到最新布局');
    } else {
      showNotice(`服务端写入受限（${result.error || '未知原因'}），可复制布局 JSON 到后台主题设置`);
    }
  };

  const handleCopyServerLayoutJson = () => {
    const serialized = serializePersistedLayout(activeRackList, config.nodeStyles, adminInfo?.username);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(serialized)
        .then(() => showNotice('已复制 rackLayoutJson，可粘贴到 Komari 后台 → 主题设置保存'))
        .catch(() => showNotice('复制失败，请检查浏览器剪贴板权限'));
    } else {
      showNotice('当前环境不支持自动剪贴板复制');
    }
  };

  const handleReloadServerLayout = () => {
    if (!serverPublishedLayout) {
      showNotice('服务端尚未发布自定义编排（theme_settings.rackLayoutJson 为空）');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      liveRacks: serverPublishedLayout.racks,
      nodeStyles: { ...prev.nodeStyles, ...serverPublishedLayout.nodeStyles },
      activeRackId: serverPublishedLayout.racks[0]?.id ?? prev.activeRackId,
    }));
    setLayoutSyncSource('server');
    setHasUnpublishedChanges(false);
    showNotice('已拉取并恢复 Komari 服务端线上编排');
  };

  const handleToggleCameraControlMode = () => {
    setCameraControlMode((prev) => {
      const next: CameraControlMode = prev === 'locked25d' ? 'micro_tilt' : 'locked25d';
      if (next === 'locked25d') {
        setCameraSignal((sig) => ({ preset: config.cameraPreset, nonce: sig.nonce + 1 }));
        setCameraCustomized(false);
        showNotice('已锁定 2.5D 建筑视角（支持横向平移与定焦缩放）');
      } else {
        showNotice('已开启 2.5D 微调视角（受限角度微倾，防穿模）');
      }
      return next;
    });
  };

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

  // Rack & node operations (strictly gated by ensureCanEdit)
  const handleAddRack = () => {
    if (!ensureCanEdit()) return;
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
    markLayoutDirty();
    showNotice(`已扩展机柜位 ${newRack.name}`);
  };

  const handleDeleteActiveRack = () => {
    if (!ensureCanEdit()) return;
    if (activeRackList.length <= 1) return;
    const removedName = activeRack.name;
    const remaining = activeRackList.filter((r) => r.id !== activeRack.id);
    updateCurrentRacks(() => remaining, remaining[0].id);
    markLayoutDirty();
    showNotice(`已移除 ${removedName}`);
  };

  const handleRenameRack = (rackId: string, name: string) => {
    if (!ensureCanEdit()) return;
    updateCurrentRacks((racks) => racks.map((r) => (r.id === rackId ? { ...r, name } : r)));
    markLayoutDirty();
  };

  const handleChangeRackTheme = (rackId: string, theme: CabinetTheme) => {
    if (!ensureCanEdit()) return;
    updateCurrentRacks((racks) => racks.map((r) => (r.id === rackId ? { ...r, theme } : r)));
    markLayoutDirty();
  };

  const handleMountNode = (nodeId: string) => {
    if (!ensureCanEdit()) return;
    const node = nodesMap.get(nodeId);
    if (!node) return;
    const uid = makeUid('u');
    updateCurrentRacks((racks) =>
      racks.map((r) => (r.id === activeRack.id ? { ...r, items: [...r.items, { uid, type: 'node', nodeId }] } : r)),
    );
    markLayoutDirty();
    setSelectedNodeId(nodeId);
    showNotice(`已上架 ${node.name} 至 ${activeRack.name}`);
  };

  const handleMountAccessory = (kind: 'pdu' | 'blank') => {
    if (!ensureCanEdit()) return;
    const uid = makeUid(kind);
    const item: RackItem =
      kind === 'pdu'
        ? { uid, type: 'pdu', label: 'APC-PDU-32A' }
        : { uid, type: 'blank', label: 'COLD-AISLE-BAFFLE' };
    updateCurrentRacks((racks) =>
      racks.map((r) => (r.id === activeRack.id ? { ...r, items: [...r.items, item] } : r)),
    );
    markLayoutDirty();
    showNotice(kind === 'pdu' ? '已安装 1U 计量 PDU' : '已安装 1U 导风盲板');
  };

  const handleRemoveItem = (rackId: string, uid: string) => {
    if (!ensureCanEdit()) return;
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
    markLayoutDirty();

    showNotice(`已卸载 ${label}`, '撤销', () => {
      updateCurrentRacks((racks) =>
        racks.map((r) => {
          if (r.id !== rackId) return r;
          const copy = [...r.items];
          copy.splice(Math.max(0, Math.min(removedIdx, copy.length)), 0, removedItem);
          return { ...r, items: copy };
        }),
      );
      markLayoutDirty();
      setNotice(null);
    });
  };

  const handleClearActiveRack = () => {
    if (!ensureCanEdit()) return;
    const rackId = activeRack.id;
    const rackName = activeRack.name;
    const snapshot = [...activeRack.items];
    if (snapshot.length === 0) return;

    updateCurrentRacks((racks) => racks.map((r) => (r.id === rackId ? { ...r, items: [] } : r)));
    markLayoutDirty();
    showNotice(`已清空 ${rackName}（${snapshot.length} 台设备）`, '撤销清空', () => {
      updateCurrentRacks((racks) => racks.map((r) => (r.id === rackId ? { ...r, items: snapshot } : r)));
      markLayoutDirty();
      setNotice(null);
    });
  };

  const handleResetDefaultLayout = () => {
    if (!ensureCanEdit()) return;
    if (isLiveMode) {
      const autoRacks = buildAutoRacksFromNodes(liveNodes, themeSettings.defaultCabinetTheme ?? 'auto');
      updateCurrentRacks(() => autoRacks, autoRacks[0].id);
      markLayoutDirty();
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
    if (!ensureCanEdit()) return;
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
    markLayoutDirty();
  };

  const handleUpdateNodeStyle = (nodeId: string, patch: Partial<NodeStyleOverride>) => {
    if (!ensureCanEdit()) return;
    setConfig((prev) => ({
      ...prev,
      nodeStyles: {
        ...prev.nodeStyles,
        [nodeId]: { ...(prev.nodeStyles[nodeId] ?? {}), ...patch },
      },
    }));
    markLayoutDirty();
  };

  const handleResetNodeStyle = (nodeId: string) => {
    if (!ensureCanEdit()) return;
    setConfig((prev) => {
      const next = { ...prev.nodeStyles };
      delete next[nodeId];
      return { ...prev, nodeStyles: next };
    });
    markLayoutDirty();
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
    if (!ensureCanEdit()) {
      return { ok: false, error: '当前处于只读模式，请先以管理员身份解锁编排后再导入' };
    }
    try {
      const next = parseImportedConfig(rawJson, config);
      setConfig(next);
      setCameraSignal((prev) => ({ preset: next.cameraPreset, nonce: prev.nonce + 1 }));
      setCameraCustomized(false);
      markLayoutDirty();
      showNotice('已应用导入的机房编排与涂装');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'JSON 格式无效' };
    }
  };

  const siteDisplayName = isLiveMode
    ? themeSettings.customHallTitle || publicInfo?.sitename || 'KOMARI // LIVE'
    : 'KOMARI // HALL A';
  const adminUrl = buildAdminUrl(config.api.baseUrl);
  const showAdminLink = (sameOriginKomari || isLiveMode) && themeSettings.showAdminLink !== false;

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
        canEdit={canEdit}
        cameraControlMode={cameraControlMode}
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
          if (!canEdit) {
            setDrawerTab('telemetry');
          } else if (drawerTab === 'builder' || drawerTab === 'api') {
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
        totalNetDown={fleetStats.totalNetDown}
        totalNetUp={fleetStats.totalNetUp}
        rackCount={activeRackList.length}
        cameraPreset={config.cameraPreset}
        cameraControlMode={cameraControlMode}
        zoomPercent={zoomPercent}
        cameraCustomized={cameraCustomized}
        atmosphere={config.atmosphere}
        scale={config.scale}
        showStrip={config.showStrip}
        drawerOpen={drawerOpen}
        showAdminLink={showAdminLink}
        adminUrl={adminUrl}
        isSameOrigin={isSameOriginLink}
        adminAuthStatus={adminAuthStatus}
        adminUsername={adminInfo?.username}
        canEnterEditMode={canEnterEditMode}
        editMode={canEdit}
        hasUnpublishedChanges={hasUnpublishedChanges}
        isPublishingLayout={isPublishingLayout}
        onSelectPreset={handleSelectPreset}
        onToggleCameraControlMode={handleToggleCameraControlMode}
        onResetCamera={handleResetCamera}
        onZoomStep={handleZoomStep}
        onChangeAtmosphere={handleChangeAtmosphere}
        onToggleScale={() =>
          setConfig((prev) => ({ ...prev, scale: prev.scale === 'standard' ? 'compact' : 'standard' }))
        }
        onToggleStrip={() => setConfig((prev) => ({ ...prev, showStrip: !prev.showStrip }))}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        onToggleEditMode={handleToggleEditMode}
        onPublishLayout={handlePublishLayoutToServer}
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
        sameOriginDetected={sameOriginKomari}
        isSameOriginLink={isSameOriginLink}
        adminUrl={adminUrl}
        adminAuthStatus={adminAuthStatus}
        adminUsername={adminInfo?.username}
        canEnterEditMode={canEnterEditMode}
        canEdit={canEdit}
        layoutSyncSource={layoutSyncSource}
        hasServerLayout={Boolean(serverPublishedLayout)}
        hasUnpublishedChanges={hasUnpublishedChanges}
        isPublishingLayout={isPublishingLayout}
        lastSyncAt={lastSyncAt}
        wsFramesCount={wsFramesCount}
        onToggleEditMode={handleToggleEditMode}
        onRecheckAdminAuth={handleRecheckAdminAuth}
        onPublishLayout={handlePublishLayoutToServer}
        onCopyServerLayoutJson={handleCopyServerLayoutJson}
        onReloadServerLayout={handleReloadServerLayout}
        onSelectRack={(rackId) => setConfig((prev) => ({ ...prev, activeRackId: rackId }))}
        onAddRack={handleAddRack}
        onRenameRack={handleRenameRack}
        onDeleteActiveRack={handleDeleteActiveRack}
        onChangeRackTheme={handleChangeRackTheme}
        onToggleStrip={() => setConfig((prev) => ({ ...prev, showStrip: !prev.showStrip }))}
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

      {/* Private-Site Authentication Guidance Overlay */}
      {isLiveMode && apiStatus === 'auth_required' && (
        <div className="hud-auth-overlay" role="dialog" aria-modal="false" aria-label="私密站点鉴权提示">
          <div className="hud-auth-card">
            <div className="hud-auth-badge">PRIVATE SITE · AUTH REQUIRED</div>
            <h2 className="hud-auth-title">{publicInfo?.sitename || 'Komari Monitor'}</h2>
            <p className="hud-auth-desc">
              {isSameOriginLink
                ? '当前 Komari 站点已开启私密模式（private_site），需要管理员登录后才可读取实时节点与遥测数据。'
                : '目标远程站点已开启私密模式（private_site）。跨站浏览器无法携带目标站登录 Cookie，请将本主题直接安装到目标 Komari 后台或关闭私密模式。'}
            </p>
            <div className="hud-auth-actions">
              <a
                className="hud-auth-primary"
                href={adminUrl}
                target={isSameOriginLink ? undefined : '_blank'}
                rel={isSameOriginLink ? undefined : 'noreferrer'}
              >
                前往 Komari 后台登录
              </a>
              <button
                type="button"
                className="hud-auth-ghost"
                onClick={() => setLiveConnectNonce((n) => n + 1)}
              >
                重新检测
              </button>
              <button
                type="button"
                className="hud-auth-ghost"
                onClick={() => handleSwitchDataMode('demo')}
              >
                预览演示机房
              </button>
            </div>
          </div>
        </div>
      )}

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
