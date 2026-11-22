# Komari Data Center 3D

轻写实 2.5D 拟物数据中心机房监控主题，适用于 [Komari Monitor](https://github.com/komari-monitor/komari)。

![Komari Data Center 3D Preview](./preview.png)

## 核心特性

- **固定 / 受控 2.5D 建筑视角**：低畸变长焦建筑透视（`fov 28°–29°`），支持 `2.5D 锁定`（仅平移与安全缩放，避免穿墙与露背）与 `2.5D 微倾`（小角度立体观摩）两种模式，内置 4 套机位（标准 3/4、左侧走道、高位俯视、正立面）。
- **4 套封闭机房建筑场景**：`冷通道（cold-aisle）`、`洁净室（cleanroom）`、`暗夜战情（obsidian-noc）`、`极简展厅（showroom）`，内置 NOC 大屏、背墙灯槽、顶部走线桥架与冷通道地板出风砖。
- **拟物机柜与服务器硬件细节**：支持曜石黑 / 钛金灰 / 阳极银机柜材质、调平地脚与倒角饰条；支持 B1–B4 机身涂装、3D 机架挂耳、阳极氧化拉手、M6 手拧螺丝、风扇转速与负载联动及机下双排遥测状态条。
- **自适应网络吞吐与实时遥测**：完整兼容 Komari `/api/public`、`/api/nodes`、`/api/clients`（WebSocket）、`/api/records/load` 与 `/api/records/ping`，网络速率统一按 `B/s` 采集并在 `B/s`、`KB/s`、`MB/s`、`GB/s` 间自适应显示，附带累计流量差值兜底。
- **管理员鉴权与双层布局持久化**：
  - 默认严格进入 **只读监控模式**，访客与跨域远程连接无法修改机柜或涂装；
  - 同源登录 Komari 管理员后（通过 `/api/me` 校验），可在右上角解锁 **编排模式**，编辑实时保存为本地草稿，并支持一键 **发布到站点** 写入 `theme_settings.rackLayoutJson`，同步给所有访客。

## 在 Komari 中安装主题

1. 前往本仓库 [Releases](https://github.com/VAN4622/komari-datacenter-3d/releases) 页面，下载最新版的 `komari-datacenter-3d-v*.zip`。
2. 登录你的 Komari 管理后台（`/admin`），进入 **主题管理**，上传该 ZIP 包并启用 `Komari Data Center 3D`。
3. 可在后台 **主题设置** 中自定义默认机房风格、默认 2.5D 机位、自动建柜涂装、状态条、Ping 轮询与标题，或在站点页面登录管理员后直接进行可视化机柜编排并发布到站点。

## 本地开发与打包

环境要求：Node.js 20+

```bash
npm install
```

启动本地开发服务器（端口 `5174`，支持演示数据或填写 Komari 地址预览）：

```bash
npm run dev
```

类型检查、生产构建并打包标准 Komari 主题 ZIP（输出至 `release/komari-datacenter-3d-v<version>.zip`）：

```bash
npm run build:theme
```

## 技术栈

- React 19 + TypeScript 5.7 + Vite 6
- Three.js + `@react-three/fiber` + `@react-three/drei`
