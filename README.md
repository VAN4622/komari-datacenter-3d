# Komari Data Center Studio

极简影棚纯 CSS 3D 固定微侧透视拟物机柜监控主题，适用于 [Komari Monitor](https://github.com/komari-monitor/komari)。  
v2.0 彻底移除 Three.js / WebGL 重渲染负担，以 **Retina 矢量拟物服务器面板 + 纯 CSS 3D 固定微侧透视 + 虚拟数据链科幻悬浮 HUD + 全球节点态势世界地图** 重新构建。

![Komari Data Center Studio Preview](./preview.png)

## v2.0 核心特性

- **极简影棚 · 纯 CSS 3D 固定微侧透视（~15°）**：
  - 放弃沉重的 WebGL 机房，改用纯 CSS 3D 硬件展台呈现单座居中主视觉机柜，默认固定约 15° 微侧透视（可一键切换为纯正立面 `正视`），露出拉丝金属侧板、通风百叶、顶部散热风扇盖板与地面软阴影反射；
  - 所有服务器面板均由 Retina 高清内联 SVG 渲染（`ServerChassisSvg`），文字、LED 与硬盘托架细节锐利清晰，点击选中节点后执行平滑的 **3D 滑轨抽拉（Rail Pull-Out）** 动效；
  - 内置 2 套极简影棚布光：`深石墨影棚（studio-dark，默认）` 与 `浅银画廊（studio-light）`；支持底部切换器、键盘 `← / →` 与移动端左右滑动切换机柜。
- **科幻悬浮 HUD · 虚拟数据链连接 + 自由计算定位**：
  - 选中任意服务器节点后，自动根据机柜位置与视口剩余空间**动态自由计算**悬浮 HUD 坐标（不固定死在角落，也不会遮挡所选服务器）；
  - 全视口 SVG **虚拟数据链（Virtual Data-Link Tether）** 实时锚定到被抽出服务器面板的光学端口，带 45° 战术折线回路、双向流动遥测数据包、目标瞄准准星与实时状态标签；
  - 桌面端支持拖拽 HUD 标题栏到屏幕任意位置，数据链实时重新计算追踪，并可点击 `⌖` 一键恢复自动跟随；移动端自动切换为停靠式卡片，不挡操作。
- **全球节点态势世界地图**：
  - 顶部右上角一键切换至全球节点世界地图，自动根据节点地区/名称识别国家与坐标，**点亮已部署节点的区域板块**；
  - 在对应国家/地区显示 **国旗徽章 + 区域代码 + 在线数**，并通过发光贝塞尔弧线与双向穿梭数据包呈现各区域之间的实时数据交互态势；
  - 点击任意区域即可在左下角战术检视卡中查看该区域全部节点与实时负载，并支持一键跳转回对应机柜及服务器。
- **极简菜单与完整功能保留**：
  - 顶部仅保留左上站点/在线状态胶囊 + 右上「全球节点」切换与单一折叠「菜单」；底部仅保留机柜切换与 `微侧 15° / 正视` 切换；
  - 完整保留 Komari `/api/public`、`/api/nodes`、`/api/clients`（WebSocket）、`/api/records/load` 与 `/api/records/ping` 实时对接、自适应网络速率单位（`B/s`–`GB/s`）、管理员鉴权编排与云端发布（`theme_settings.rackLayoutJson`）、单机涂装自定义、UID 定位闪烁与历史遥测曲线抽屉。

## 在 Komari 中安装主题

1. 前往本仓库 [Releases](https://github.com/VAN4622/komari-datacenter-3d/releases) 页面，下载最新版的 `komari-datacenter-3d-v*.zip`。
2. 登录你的 Komari 管理后台（`/admin`），进入 **主题管理**，上传该 ZIP 包并启用 `Komari Data Center Studio`。
3. 可在后台 **主题设置** 中自定义默认影棚布光、默认透视角度（`side` / `front`）、默认首页视图（`rack` / `map`）、自动建柜涂装与站点标题，或在站点页面登录管理员后直接进行可视化机柜编排并发布到站点。

## 本地开发与打包

环境要求：Node.js 20+

```bash
npm install
```

启动本地开发服务器（端口 `5174`，内置演示集群并支持填写 Komari 地址预览）：

```bash
npm run dev
```

类型检查、生产构建并打包标准 Komari 主题 ZIP（输出至 `release/komari-datacenter-3d-v<version>.zip`）：

```bash
npm run build:theme
```

## 技术栈

- React 19 + TypeScript 5.7 + Vite 6
- Pure CSS 3D Transforms + Inline Retina SVG Hardware + Tactical SVG World Map（零 Three.js、零 WebGL、打包体积约 148 KB）
