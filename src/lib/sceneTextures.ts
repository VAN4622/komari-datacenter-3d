import * as THREE from 'three';
import { formatNetSpeed } from '@/lib/formatters';
import type { NodeInfo, RackCabinetData, RoomAtmosphere } from '@/types/rack';

export interface BigScreenData {
  siteName: string;
  atmosphere: RoomAtmosphere;
  nodes: NodeInfo[];
  racks: RackCabinetData[];
  totalWatts: number;
  totalU: number;
  isLive: boolean;
  apiStatus: string;
  historySeed: number[];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function paintBigScreenCanvas(canvas: HTMLCanvasElement, data: BigScreenData) {
  const W = 1440;
  const H = 450;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { atmosphere, nodes, racks, totalWatts, totalU, siteName, isLive, apiStatus, historySeed } = data;
  const isLight = atmosphere === 'cleanroom';
  const isBunker = atmosphere === 'obsidian-noc';
  const isShowroom = atmosphere === 'showroom';

  const bgTop = isLight ? '#f4f7fb' : isBunker ? '#0b0d12' : isShowroom ? '#0d111a' : '#091220';
  const bgBot = isLight ? '#e5ecf5' : isBunker ? '#06070a' : isShowroom ? '#080b11' : '#060c16';
  const cardBg = isLight
    ? 'rgba(255,255,255,0.86)'
    : isBunker
      ? 'rgba(20, 22, 28, 0.84)'
      : isShowroom
        ? 'rgba(18, 23, 34, 0.82)'
        : 'rgba(14, 24, 40, 0.78)';
  const cardBorder = isLight
    ? 'rgba(15,23,42,0.12)'
    : isBunker
      ? 'rgba(249,115,22,0.28)'
      : isShowroom
        ? 'rgba(148,163,184,0.22)'
        : 'rgba(56,189,248,0.24)';
  const accent = isLight ? '#0284c7' : isBunker ? '#f97316' : isShowroom ? '#7dd3fc' : '#38bdf8';
  const accent2 = isLight ? '#d95b1e' : isBunker ? '#22c55e' : '#34d399';
  const ink = isLight ? '#0f172a' : '#edf2f8';
  const muted = isLight ? '#526074' : '#8596ab';

  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, bgTop);
  bgGrad.addColorStop(1, bgBot);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle architectural gridlines
  ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.04)' : isBunker ? 'rgba(255,255,255,0.03)' : 'rgba(148,179,214,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Top header bar
  ctx.fillStyle = isLight ? 'rgba(15,23,42,0.035)' : 'rgba(255,255,255,0.025)';
  ctx.fillRect(0, 0, W, 56);
  ctx.strokeStyle = cardBorder;
  ctx.beginPath();
  ctx.moveTo(0, 56);
  ctx.lineTo(W, 56);
  ctx.stroke();

  // Left accent bar & title
  ctx.fillStyle = accent;
  ctx.fillRect(28, 16, 5, 24);

  ctx.font = '800 20px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif';
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${siteName.toUpperCase()}   //   NOC TELEMETRY WALL`, 46, 29);

  // Status badge & clock
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
  ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = accent;
  ctx.textAlign = 'right';
  ctx.fillText(timeStr, W - 28, 29);

  const isAuthReq = apiStatus === 'auth_required';
  const badgeText = isAuthReq ? 'PRIVATE' : isLive ? 'LIVE FEED' : 'SIMULATION';
  roundRect(ctx, W - 252, 15, 110, 26, 6);
  ctx.fillStyle = isAuthReq
    ? 'rgba(245,158,11,0.18)'
    : isLive
      ? 'rgba(34,197,94,0.16)'
      : isBunker
        ? 'rgba(249,115,22,0.16)'
        : 'rgba(56,189,248,0.14)';
  ctx.fill();
  ctx.strokeStyle = isAuthReq ? '#f59e0b' : isLive ? '#22c55e' : accent;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = isAuthReq ? '#fbbf24' : isLive ? '#4ade80' : accent;
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, W - 197, 29);

  // Compute aggregate fleet stats
  const onlineList = nodes.filter((n) => n.online);
  const avgCpu = onlineList.length > 0 ? Math.round(onlineList.reduce((s, n) => s + n.cpu, 0) / onlineList.length) : 0;
  const avgRam = onlineList.length > 0 ? Math.round(onlineList.reduce((s, n) => s + n.ram, 0) / onlineList.length) : 0;
  const totalNetDown = onlineList.reduce((s, n) => s + n.netDown, 0);
  const totalNetUp = onlineList.reduce((s, n) => s + n.netUp, 0);

  // Row 1: 4 Hero KPI cards
  const kpis = [
    { label: 'ONLINE NODES', value: `${onlineList.length}/${nodes.length}`, sub: 'ACTIVE FLEET', color: '#22c55e' },
    { label: 'CLUSTER CPU', value: `${avgCpu}%`, sub: `AVG RAM ${avgRam}%`, color: accent },
    { label: 'POWER DRAW', value: `${totalWatts} W`, sub: `${(totalWatts / 220).toFixed(1)}A · ${racks.length} RACKS`, color: isBunker ? '#fb923c' : accent2 },
    {
      label: 'THROUGHPUT',
      value: `↓ ${formatNetSpeed(totalNetDown, false)}`,
      sub: `↑ ${formatNetSpeed(totalNetUp, false)} · ${totalU}U USED`,
      color: accent,
    },
  ];

  const cardW = 330;
  const cardGap = 21;
  kpis.forEach((k, idx) => {
    const cx = 28 + idx * (cardW + cardGap);
    const cy = 74;
    roundRect(ctx, cx, cy, cardW, 96, 10);
    ctx.fillStyle = cardBg;
    ctx.fill();
    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = k.color;
    ctx.fillRect(cx, cy + 14, 4, 68);

    ctx.textAlign = 'left';
    ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = muted;
    ctx.fillText(k.label, cx + 18, cy + 23);

    ctx.font = '800 34px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = ink;
    ctx.fillText(k.value, cx + 18, cy + 56);

    ctx.font = '600 11.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = k.color;
    ctx.fillText(k.sub, cx + 18, cy + 82);
  });

  // Left Panel: Live Cluster Load Oscilloscope
  const wx = 28;
  const wy = 188;
  const ww = 856;
  const wh = 238;
  roundRect(ctx, wx, wy, ww, wh, 12);
  ctx.fillStyle = cardBg;
  ctx.fill();
  ctx.strokeStyle = cardBorder;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = muted;
  ctx.fillText('REAL-TIME COMPUTE & MEMORY TELEMETRY', wx + 20, wy + 25);

  // Legend
  ctx.fillStyle = accent;
  ctx.fillRect(wx + ww - 208, wy + 21, 18, 4);
  ctx.fillStyle = ink;
  ctx.fillText(`CPU ${avgCpu}%`, wx + ww - 182, wy + 25);

  ctx.fillStyle = accent2;
  ctx.fillRect(wx + ww - 104, wy + 21, 18, 4);
  ctx.fillStyle = ink;
  ctx.fillText(`RAM ${avgRam}%`, wx + ww - 78, wy + 25);

  // Chart inner area
  const gx = wx + 54;
  const gy = wy + 48;
  const gw = ww - 80;
  const gh = wh - 74;

  for (let i = 0; i <= 4; i++) {
    const y = gy + (gh * i) / 4;
    ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(148,163,184,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);
    ctx.stroke();

    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = muted;
    ctx.textAlign = 'right';
    ctx.fillText(`${100 - i * 25}%`, gx - 10, y + 1);
  }

  const pts = historySeed.length >= 2 ? historySeed : [35, 42, 40, 48, 52, 46, 55, 51, avgCpu];
  const cpuPath = pts.map((v, i) => ({
    x: gx + (gw * i) / Math.max(1, pts.length - 1),
    y: gy + gh * (1 - Math.max(4, Math.min(98, v)) / 100),
  }));

  const areaGrad = ctx.createLinearGradient(0, gy, 0, gy + gh);
  areaGrad.addColorStop(
    0,
    isBunker ? 'rgba(249,115,22,0.28)' : isLight ? 'rgba(2,132,199,0.2)' : 'rgba(56,189,248,0.26)',
  );
  areaGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.moveTo(cpuPath[0].x, gy + gh);
  for (const p of cpuPath) ctx.lineTo(p.x, p.y);
  ctx.lineTo(cpuPath[cpuPath.length - 1].x, gy + gh);
  ctx.closePath();
  ctx.fillStyle = areaGrad;
  ctx.fill();

  ctx.beginPath();
  cpuPath.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.beginPath();
  pts.forEach((v, idx) => {
    const ramV = Math.max(10, Math.min(95, avgRam + (v - avgCpu) * 0.45));
    const px = gx + (gw * idx) / Math.max(1, pts.length - 1);
    const py = gy + gh * (1 - ramV / 100);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = accent2;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([8, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Right Panel: Node Health & Thermal Matrix
  const nx = 906;
  const ny = 188;
  const nw = 506;
  const nh = 238;
  roundRect(ctx, nx, ny, nw, nh, 12);
  ctx.fillStyle = cardBg;
  ctx.fill();
  ctx.strokeStyle = cardBorder;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = muted;
  ctx.fillText('NODE HEALTH & THERMAL MATRIX', nx + 20, ny + 25);

  const visibleNodes = nodes.slice(0, 6);
  visibleNodes.forEach((node, idx) => {
    const ry = ny + 48 + idx * 30;
    const isOff = !node.online;
    const isHot = node.online && node.cpu >= 78;
    const dot = isOff ? '#64748b' : isHot ? '#f97316' : '#22c55e';

    ctx.beginPath();
    ctx.arc(nx + 26, ry + 8, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = dot;
    ctx.fill();

    ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = ink;
    ctx.textAlign = 'left';
    ctx.fillText(node.name.slice(0, 15), nx + 40, ry + 9);

    const bx = nx + 216;
    const bw = 166;
    roundRect(ctx, bx, ry + 3, bw, 10, 5);
    ctx.fillStyle = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
    ctx.fill();
    if (!isOff) {
      roundRect(ctx, bx, ry + 3, Math.max(8, (bw * node.cpu) / 100), 10, 5);
      ctx.fillStyle = isHot ? '#f97316' : accent;
      ctx.fill();
    }

    ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = isOff ? muted : ink;
    ctx.textAlign = 'right';
    ctx.fillText(isOff ? 'OFF' : `${Math.round(node.cpu)}%  ${node.ping}ms`, nx + nw - 20, ry + 9);
  });
}

export function createFloorTileTexture(atmosphere: RoomAtmosphere): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const isLight = atmosphere === 'cleanroom';
  const isBunker = atmosphere === 'obsidian-noc';
  const isShowroom = atmosphere === 'showroom';

  // Soft tactile architectural matte-satin tile palette
  ctx.fillStyle = isLight ? '#dde3ec' : isBunker ? '#14171f' : isShowroom ? '#171c28' : '#192231';
  ctx.fillRect(0, 0, size, size);

  // Silky soft tonal surface gradient (avoids harsh flat CAD look)
  const grad = ctx.createLinearGradient(0, 0, size, size);
  if (isLight) {
    grad.addColorStop(0, 'rgba(255,255,255,0.34)');
    grad.addColorStop(1, 'rgba(182,194,210,0.14)');
  } else if (isBunker) {
    grad.addColorStop(0, 'rgba(255,255,255,0.032)');
    grad.addColorStop(1, 'rgba(0,0,0,0.1)');
  } else if (isShowroom) {
    grad.addColorStop(0, 'rgba(255,255,255,0.038)');
    grad.addColorStop(1, 'rgba(0,0,0,0.1)');
  } else {
    grad.addColorStop(0, 'rgba(165,196,232,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.09)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(8, 8, size - 16, size - 16);

  // Ultra-subtle rounded tile groove (no harsh aliasing lines or noisy polka dots)
  roundRect(ctx, 6, 6, size - 12, size - 12, 18);
  ctx.strokeStyle = isLight
    ? 'rgba(51,65,85,0.085)'
    : isBunker
      ? 'rgba(255,255,255,0.048)'
      : isShowroom
        ? 'rgba(148,163,184,0.055)'
        : 'rgba(148,179,214,0.075)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Gentle top-left soft bevel highlight inside tile
  roundRect(ctx, 10, 10, size - 20, size - 20, 15);
  ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createWallPanelTexture(atmosphere: RoomAtmosphere): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const isLight = atmosphere === 'cleanroom';
  const isBunker = atmosphere === 'obsidian-noc';
  const isShowroom = atmosphere === 'showroom';

  const base = isLight ? '#e8edf4' : isBunker ? '#151922' : isShowroom ? '#181e2c' : '#1a2333';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Soft vertical studio wall wash gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (isLight) {
    grad.addColorStop(0, 'rgba(255,255,255,0.28)');
    grad.addColorStop(1, 'rgba(160,174,192,0.1)');
  } else {
    grad.addColorStop(0, 'rgba(255,255,255,0.032)');
    grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Calm matte architectural panel seam (rounded corners, low contrast)
  roundRect(ctx, 4, 4, w - 8, h - 8, 12);
  ctx.strokeStyle = isLight ? 'rgba(51,65,85,0.06)' : 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createPerforatedSideTexture(baseHex: string, slotHex: string): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, w, h);

  // Subtle satin vertical sheen across side panel
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Softly rounded recessed panel border
  roundRect(ctx, 18, 22, w - 36, h - 44, 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Tactile pill-rounded ventilation louvers (softer, cleaner spacing)
  ctx.fillStyle = slotHex;
  for (let y = 58; y < 176; y += 16) {
    roundRect(ctx, 44, y, w - 88, 6, 3);
    ctx.fill();
  }
  for (let y = 334; y < 452; y += 16) {
    roundRect(ctx, 44, y, w - 88, 6, 3);
    ctx.fill();
  }

  // Softly rounded flush side handle recess
  roundRect(ctx, w / 2 - 14, h / 2 - 22, 28, 44, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createCabinetHeaderTexture(
  rackName: string,
  usedU: number,
  watts: number,
  beaconColor: string,
  active: boolean,
  theme: 'obsidian' | 'titanium' | 'silver',
): THREE.CanvasTexture {
  const W = 640;
  const H = 96;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const isSilver = theme === 'silver';
  const isTitanium = theme === 'titanium';

  // Exact match to original .cab3d-header gradients from hall.css
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  if (isSilver) {
    grad.addColorStop(0, '#e1e5ec');
    grad.addColorStop(1, '#cdd4df');
  } else if (isTitanium) {
    grad.addColorStop(0, '#79808d');
    grad.addColorStop(1, '#636976');
  } else {
    grad.addColorStop(0, '#2b313d');
    grad.addColorStop(1, '#1e222b');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle top bevel highlight
  ctx.fillStyle = active ? '#38bdf8' : isSilver ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.14)';
  ctx.fillRect(0, 0, W, active ? 5 : 2);

  // Bottom hairline divider
  ctx.fillStyle = isSilver ? 'rgba(15,23,42,0.14)' : 'rgba(0,0,0,0.42)';
  ctx.fillRect(0, H - 3, W, 3);

  // Quiet status LED dot (just like original .cab3d-beacon-dot)
  ctx.beginPath();
  ctx.arc(34, H / 2, 8.5, 0, Math.PI * 2);
  ctx.fillStyle = beaconColor;
  ctx.fill();

  // Rack name
  ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif';
  ctx.fillStyle = isSilver ? '#1a202c' : '#edf2f8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(rackName.slice(0, 18), 58, H / 2 + 1);

  // Quiet right-aligned U & W telemetry pills
  ctx.font = '700 22px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = isSilver ? '#475569' : isTitanium ? '#e2e8f0' : '#9aa6b8';
  ctx.textAlign = 'right';
  ctx.fillText(`${usedU}U   ${watts}W`, W - 26, H / 2 + 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createTerminalMonitorTexture(nodes: NodeInfo[], accentHex: string): THREE.CanvasTexture {
  const W = 512;
  const H = 320;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070d16';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 0, W, 32);
  ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = accentHex;
  ctx.textBaseline = 'middle';
  ctx.fillText('KVM-CONSOLE // KOMARI-CLI v2.4', 14, 16);

  ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  const lines = [
    `$ komari-ctl status --cold-aisle`,
    `[OK] WebSocket telemetry link healthy`,
    `[OK] Thermal intake: 19.4°C  RH: 44%`,
    ...nodes.slice(0, 6).map(
      (n) =>
        `${n.online ? '[UP]' : '[DN]'} ${n.name.padEnd(15).slice(0, 15)} CPU:${String(Math.round(n.cpu)).padStart(2)}%  MEM:${String(Math.round(n.ram)).padStart(2)}%`,
    ),
    `$ _`,
  ];

  lines.forEach((line, idx) => {
    ctx.fillStyle = line.startsWith('[DN]')
      ? '#f87171'
      : line.startsWith('$')
        ? accentHex
        : line.startsWith('[OK]')
          ? '#4ade80'
          : '#cbd5e1';
    ctx.fillText(line, 16, 54 + idx * 24);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createBayFloorTagTexture(
  bayCode: string,
  watts: number,
  isLight: boolean,
  active: boolean,
  accent: string,
): THREE.CanvasTexture {
  const W = 440;
  const H = 64;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, W, H);
  const ink = active ? accent : isLight ? 'rgba(51,65,85,0.58)' : 'rgba(160,194,228,0.52)';

  ctx.font = '700 24px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'left';
  ctx.fillText(bayCode, 12, H / 2);

  ctx.textAlign = 'right';
  ctx.fillText(`${watts}W`, W - 12, H / 2);

  // Connecting architectural rule matching original .bay-sep
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, H / 2);
  ctx.lineTo(W - 110, H / 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
