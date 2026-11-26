import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandList,
  CommandSeparator,
} from '@ui-sdk/react/command';
import {
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogTitle,
} from '@ui-sdk/react/dialog';
import {
  Activity,
  Compass,
  Globe,
  Layers,
  Moon,
  Palette,
  Plug,
  Search,
  Server,
  SlidersHorizontal,
  Sun,
  Wrench,
} from 'lucide-react';
import { RegionFlag } from '@/components/ui/RegionFlag';
import { resolveNodeGeo } from '@/lib/geoRegions';
import type {
  DrawerTab,
  NodeInfo,
  RackCabinetData,
  RackViewAngle,
  RoomAtmosphere,
  StageViewMode,
  UiStyle,
} from '@/types/rack';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: NodeInfo[];
  racks: RackCabinetData[];
  activeRackId: string;
  stageView: StageViewMode;
  viewAngle: RackViewAngle;
  atmosphere: RoomAtmosphere;
  uiStyle: UiStyle;
  canEnterEditMode: boolean;
  editMode: boolean;
  onJumpToNode: (nodeId: string) => void;
  onSelectRack: (rackId: string) => void;
  onToggleStageView: () => void;
  onChangeViewAngle: (angle: RackViewAngle) => void;
  onChangeAtmosphere: (atmo: RoomAtmosphere) => void;
  onChangeUiStyle: (style: UiStyle) => void;
  onOpenDrawerTab: (tab: DrawerTab) => void;
  onToggleEditMode: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  nodes,
  racks,
  activeRackId,
  stageView,
  viewAngle,
  atmosphere,
  uiStyle,
  canEnterEditMode,
  editMode,
  onJumpToNode,
  onSelectRack,
  onToggleStageView,
  onChangeViewAngle,
  onChangeAtmosphere,
  onChangeUiStyle,
  onOpenDrawerTab,
  onToggleEditMode,
}: CommandPaletteProps) {
  const runAndClose = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const handleAction = (value: string) => {
    if (value.startsWith('node:')) {
      runAndClose(() => onJumpToNode(value.slice(5)));
      return;
    }
    if (value.startsWith('rack:')) {
      runAndClose(() => onSelectRack(value.slice(5)));
      return;
    }
    switch (value) {
      case 'action:toggle-stage':
        runAndClose(onToggleStageView);
        break;
      case 'action:toggle-angle':
        runAndClose(() => onChangeViewAngle(viewAngle === 'side' ? 'front' : 'side'));
        break;
      case 'action:toggle-atmo':
        runAndClose(() =>
          onChangeAtmosphere(atmosphere === 'studio-dark' ? 'studio-light' : 'studio-dark'),
        );
        break;
      case 'action:toggle-ui-style':
        runAndClose(() => onChangeUiStyle(uiStyle === 'tactile' ? 'glass' : 'tactile'));
        break;
      case 'action:tab-telemetry':
        runAndClose(() => onOpenDrawerTab('telemetry'));
        break;
      case 'action:tab-builder':
        runAndClose(() => onOpenDrawerTab('builder'));
        break;
      case 'action:tab-style':
        runAndClose(() => onOpenDrawerTab('style'));
        break;
      case 'action:tab-api':
        runAndClose(() => onOpenDrawerTab('api'));
        break;
      case 'action:toggle-edit':
        if (canEnterEditMode) runAndClose(onToggleEditMode);
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogBackdrop className="kdc-dialog-backdrop" />
      <DialogContent className="kdc-cmd-dialog" aria-describedby={undefined}>
        <DialogTitle className="sr-only">全局命令与节点快速检索</DialogTitle>
        <Command className="kdc-cmd-root" onAction={handleAction}>
          <div className="kdc-cmd-input-row">
            <Search className="kdc-cmd-search-icon" size={15} aria-hidden="true" />
            <CommandInput
              aria-label="搜索节点、机柜或快捷命令"
              placeholder="搜索节点名称、地区、机柜或命令…"
              className="kdc-cmd-input"
            />
            <kbd className="kdc-kbd">ESC</kbd>
          </div>

          <CommandEmpty className="kdc-cmd-empty">未找到匹配的节点或命令</CommandEmpty>

          <CommandList className="kdc-cmd-list">
            <CommandGroup>
              <CommandGroupLabel className="kdc-cmd-group-label">
                服务器节点 ({nodes.length})
              </CommandGroupLabel>
              {nodes.map((node) => {
                const geo = resolveNodeGeo(node);
                return (
                  <CommandItem
                    key={node.uuid}
                    value={`node:${node.uuid}`}
                    keywords={[
                      node.name,
                      geo.code,
                      geo.name,
                      node.tag,
                      node.group ?? '',
                      node.os,
                      node.online ? 'online 在线' : 'offline 离线',
                    ]}
                    className="kdc-cmd-item"
                  >
                    <CommandItemIcon className="kdc-cmd-item-icon">
                      <RegionFlag code={geo.code} size="xs" />
                    </CommandItemIcon>
                    <span className="kdc-cmd-item-main">
                      <span className="kdc-cmd-item-title">{node.name}</span>
                      <span className="kdc-cmd-item-sub">
                        {geo.name} · {node.cpu_cores}C
                      </span>
                    </span>
                    <span className="kdc-cmd-item-meta">
                      {node.online ? (
                        <>
                          <span>CPU {Math.round(node.cpu)}%</span>
                          <span>{node.ping > 0 ? `${node.ping}ms` : 'ONLINE'}</span>
                        </>
                      ) : (
                        <span className="is-crit">OFFLINE</span>
                      )}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {racks.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandGroupLabel className="kdc-cmd-group-label">
                    机柜展台 ({racks.length})
                  </CommandGroupLabel>
                  {racks.map((rack, idx) => (
                    <CommandItem
                      key={rack.id}
                      value={`rack:${rack.id}`}
                      keywords={[rack.name, `R${idx + 1}`, rack.theme]}
                      className="kdc-cmd-item"
                    >
                      <CommandItemIcon className="kdc-cmd-item-icon">
                        <Server size={14} aria-hidden="true" />
                      </CommandItemIcon>
                      <span className="kdc-cmd-item-main">
                        <span className="kdc-cmd-item-title">{rack.name}</span>
                        <span className="kdc-cmd-item-sub">
                          BAY R{String(idx + 1).padStart(2, '0')} · {rack.items.length} 槽位
                        </span>
                      </span>
                      {rack.id === activeRackId && (
                        <span className="kdc-cmd-pill">当前</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup>
              <CommandGroupLabel className="kdc-cmd-group-label">视图与系统操作</CommandGroupLabel>
              <CommandItem
                value="action:toggle-stage"
                keywords={['map', 'rack', '地图', '机柜', '世界']}
                className="kdc-cmd-item"
              >
                <CommandItemIcon className="kdc-cmd-item-icon">
                  <Globe size={14} aria-hidden="true" />
                </CommandItemIcon>
                <span className="kdc-cmd-item-title">
                  {stageView === 'map' ? '切换回拟物机柜展台' : '打开全球节点态势地图'}
                </span>
                <kbd className="kdc-kbd">G</kbd>
              </CommandItem>
              <CommandItem
                value="action:toggle-angle"
                keywords={['angle', 'perspective', '15', 'front', '正视', '侧视', '视角']}
                className="kdc-cmd-item"
              >
                <CommandItemIcon className="kdc-cmd-item-icon">
                  <Compass size={14} aria-hidden="true" />
                </CommandItemIcon>
                <span className="kdc-cmd-item-title">
                  切换机柜透视角度（当前：{viewAngle === 'side' ? '微侧 15°' : '正视'}）
                </span>
                <kbd className="kdc-kbd">V</kbd>
              </CommandItem>
              <CommandItem
                value="action:toggle-atmo"
                keywords={['theme', 'dark', 'light', '暗色', '亮色', '影棚', '布光']}
                className="kdc-cmd-item"
              >
                <CommandItemIcon className="kdc-cmd-item-icon">
                  {atmosphere === 'studio-dark' ? (
                    <Sun size={14} aria-hidden="true" />
                  ) : (
                    <Moon size={14} aria-hidden="true" />
                  )}
                </CommandItemIcon>
                <span className="kdc-cmd-item-title">
                  切换为{atmosphere === 'studio-dark' ? '暖瓷画廊（亮色）' : '深石墨影棚（暗色）'}
                </span>
              </CommandItem>
              <CommandItem
                value="action:toggle-ui-style"
                keywords={['glass', 'tactile', '材质', '玻璃', '拟物', '轻拟物']}
                className="kdc-cmd-item"
              >
                <CommandItemIcon className="kdc-cmd-item-icon">
                  <Layers size={14} aria-hidden="true" />
                </CommandItemIcon>
                <span className="kdc-cmd-item-title">
                  切换界面材质（当前：{uiStyle === 'tactile' ? '精致轻拟物' : '柔雾玻璃'}）
                </span>
              </CommandItem>
              <CommandItem
                value="action:tab-telemetry"
                keywords={['telemetry', 'ping', 'chart', '遥测', '曲线', '延迟']}
                className="kdc-cmd-item"
              >
                <CommandItemIcon className="kdc-cmd-item-icon">
                  <Activity size={14} aria-hidden="true" />
                </CommandItemIcon>
                <span className="kdc-cmd-item-title">打开历史遥测与多探针延迟</span>
              </CommandItem>
              <CommandItem
                value="action:tab-builder"
                keywords={['builder', 'rack', 'layout', '编排', '机柜']}
                className="kdc-cmd-item"
              >
                <CommandItemIcon className="kdc-cmd-item-icon">
                  <SlidersHorizontal size={14} aria-hidden="true" />
                </CommandItemIcon>
                <span className="kdc-cmd-item-title">打开机柜编排与云端同步</span>
              </CommandItem>
              <CommandItem
                value="action:tab-style"
                keywords={['style', 'chassis', '涂装', '机箱', '外观']}
                className="kdc-cmd-item"
              >
                <CommandItemIcon className="kdc-cmd-item-icon">
                  <Palette size={14} aria-hidden="true" />
                </CommandItemIcon>
                <span className="kdc-cmd-item-title">打开单机硬件涂装配置</span>
              </CommandItem>
              <CommandItem
                value="action:tab-api"
                keywords={['api', 'komari', 'sync', '接口', '数据源']}
                className="kdc-cmd-item"
              >
                <CommandItemIcon className="kdc-cmd-item-icon">
                  <Plug size={14} aria-hidden="true" />
                </CommandItemIcon>
                <span className="kdc-cmd-item-title">打开 Komari 接口与数据源配置</span>
              </CommandItem>
              {canEnterEditMode && (
                <CommandItem
                  value="action:toggle-edit"
                  keywords={['edit', 'admin', '编排模式']}
                  className="kdc-cmd-item"
                >
                  <CommandItemIcon className="kdc-cmd-item-icon">
                    <Wrench size={14} aria-hidden="true" />
                  </CommandItemIcon>
                  <span className="kdc-cmd-item-title">
                    {editMode ? '退出机柜编排模式' : '进入机柜编排模式'}
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
