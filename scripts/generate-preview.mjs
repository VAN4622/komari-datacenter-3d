import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outPath = path.join(rootDir, 'preview.png');

const W = 1200;
const H = 675;
const buf = Buffer.alloc(W * H * 4);

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function blendPixel(x, y, r, g, b, a = 1) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H || a <= 0) return;
  const idx = (iy * W + ix) * 4;
  if (a >= 0.999) {
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = 255;
    return;
  }
  const inv = 1 - a;
  buf[idx] = Math.round(buf[idx] * inv + r * a);
  buf[idx + 1] = Math.round(buf[idx + 1] * inv + g * a);
  buf[idx + 2] = Math.round(buf[idx + 2] * inv + b * a);
  buf[idx + 3] = 255;
}

function fillRect(x, y, w, h, hex, a = 1) {
  const [r, g, b] = hexToRgb(hex);
  const x0 = clamp(Math.floor(x), 0, W);
  const y0 = clamp(Math.floor(y), 0, H);
  const x1 = clamp(Math.ceil(x + w), 0, W);
  const y1 = clamp(Math.ceil(y + h), 0, H);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      blendPixel(px, py, r, g, b, a);
    }
  }
}

function fillRoundRect(x, y, w, h, rad, hex, a = 1) {
  const [r, g, b] = hexToRgb(hex);
  const rClamped = Math.min(rad, w / 2, h / 2);
  const x0 = clamp(Math.floor(x), 0, W);
  const y0 = clamp(Math.floor(y), 0, H);
  const x1 = clamp(Math.ceil(x + w), 0, W);
  const y1 = clamp(Math.ceil(y + h), 0, H);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = Math.max(x + rClamped - px, 0, px - (x + w - rClamped));
      const dy = Math.max(y + rClamped - py, 0, py - (y + h - rClamped));
      const dist = Math.hypot(dx, dy);
      if (dist <= rClamped + 0.6) {
        const cov = dist <= rClamped - 0.5 ? 1 : clamp(rClamped + 0.5 - dist, 0, 1);
        blendPixel(px, py, r, g, b, a * cov);
      }
    }
  }
}

function fillCircle(cx, cy, rad, hex, a = 1) {
  const [r, g, b] = hexToRgb(hex);
  const x0 = clamp(Math.floor(cx - rad - 1), 0, W);
  const y0 = clamp(Math.floor(cy - rad - 1), 0, H);
  const x1 = clamp(Math.ceil(cx + rad + 1), 0, W);
  const y1 = clamp(Math.ceil(cy + rad + 1), 0, H);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dist = Math.hypot(px - cx, py - cy);
      if (dist <= rad + 0.6) {
        const cov = dist <= rad - 0.5 ? 1 : clamp(rad + 0.5 - dist, 0, 1);
        blendPixel(px, py, r, g, b, a * cov);
      }
    }
  }
}

function strokeRect(x, y, w, h, t, hex, a = 1) {
  fillRect(x, y, w, t, hex, a);
  fillRect(x, y + h - t, w, t, hex, a);
  fillRect(x, y, t, h, hex, a);
  fillRect(x + w - t, y, t, h, hex, a);
}

// 1. Enclosed Architectural Cold-Aisle Room Backdrop (vertical gradient)
for (let y = 0; y < H; y++) {
  const t = y / H;
  const r = Math.round(13 + t * 9);
  const g = Math.round(20 + t * 14);
  const b = Math.round(34 + t * 20);
  for (let x = 0; x < W; x++) {
    const idx = (y * W + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = 255;
  }
}

// Recessed Architectural Ceiling & Flush Softbox Lights
fillRect(0, 0, W, 62, '#101828', 1);
fillRect(0, 62, W, 3, '#25354f', 0.9);
for (const lx of [220, 600, 980]) {
  fillRoundRect(lx - 110, 18, 220, 16, 6, '#38bdf8', 0.14);
  fillRoundRect(lx - 90, 22, 180, 8, 4, '#dbeafe', 0.85);
}

// Architectural Wall Panels & Subtle Pilasters
for (let px = 80; px < W; px += 160) {
  fillRect(px, 65, 2, 485, '#253652', 0.45);
}
fillRect(0, 540, W, 135, '#131d2f', 1);
fillRect(0, 540, W, 2, '#33486b', 0.7);
// Subtle floor tile grid lines
for (let fy = 556; fy < H; fy += 28) {
  fillRect(0, fy, W, 1, '#263854', 0.45);
}
for (let fx = 60; fx < W; fx += 96) {
  fillRect(fx, 540, 1, H - 540, '#263854', 0.35);
}

// 2. Elevated Unobstructed Live NOC Big Screen above the Cabinets
const scrX = 275;
const scrY = 78;
const scrW = 650;
const scrH = 148;
fillRoundRect(scrX - 8, scrY - 8, scrW + 16, scrH + 16, 14, '#1b2435', 1);
strokeRect(scrX - 8, scrY - 8, scrW + 16, scrH + 16, 2, '#334666', 0.9);
fillRoundRect(scrX, scrY, scrW, scrH, 8, '#0b1220', 1);
// Subtle top accent line on big screen
fillRect(scrX + 12, scrY + 10, scrW - 24, 3, '#38bdf8', 0.7);
// Simulated live telemetry widgets on NOC screen
fillRoundRect(scrX + 18, scrY + 24, 155, 106, 6, '#121d33', 1);
fillRoundRect(scrX + 185, scrY + 24, 240, 106, 6, '#121d33', 1);
fillRoundRect(scrX + 437, scrY + 24, 195, 106, 6, '#121d33', 1);
// Status bars inside NOC widgets
fillRoundRect(scrX + 30, scrY + 42, 62, 10, 4, '#34d399', 0.9);
fillRoundRect(scrX + 30, scrY + 62, 126, 8, 4, '#38bdf8', 0.65);
fillRoundRect(scrX + 30, scrY + 80, 96, 8, 4, '#a78bfa', 0.65);
fillRoundRect(scrX + 30, scrY + 98, 110, 8, 4, '#fb923c', 0.75);
// Telemetry sparkline bars in center widget
const barHeights = [34, 48, 42, 64, 58, 72, 66, 52, 78, 70, 60, 82, 74, 62];
barHeights.forEach((bh, i) => {
  const bx = scrX + 200 + i * 15;
  fillRoundRect(bx, scrY + 116 - bh, 9, bh, 3, i % 3 === 0 ? '#38bdf8' : '#2563eb', 0.82);
});
// Right widget metric rows
for (let r = 0; r < 4; r++) {
  const ry = scrY + 38 + r * 22;
  fillCircle(scrX + 452, ry + 5, 4, r === 2 ? '#fb923c' : '#22c55e', 0.95);
  fillRoundRect(scrX + 464, ry + 1, 95, 8, 3, '#475569', 0.8);
  fillRoundRect(scrX + 568, ry + 1, 48, 8, 3, '#38bdf8', 0.75);
}

// 3. Three Tactile 3D-Styled Server Cabinets (Obsidian / Titanium / Silver)
const cabinets = [
  { x: 165, shell: '#232833', pillar: '#2e3442', accent: '#38bdf8', units: ['pdu', 'B1', 'B2', 'B3'] },
  { x: 472, shell: '#5a6373', pillar: '#70798a', accent: '#fb923c', units: ['B1', 'B2', 'blank', 'B4', 'B1'] },
  { x: 779, shell: '#cfd6e2', pillar: '#e3e8f1', accent: '#34d399', units: ['pdu', 'B2', 'B1', 'B4'] },
];

for (const cab of cabinets) {
  const cw = 256;
  const ch = 358;
  const cy = 248;

  // Soft contact shadow under plinth
  fillRoundRect(cab.x - 14, cy + ch - 4, cw + 28, 22, 10, '#040812', 0.65);

  // Outer rounded cabinet shell
  fillRoundRect(cab.x, cy, cw, ch, 12, cab.shell, 1);
  // Roof lid & plinth
  fillRoundRect(cab.x - 3, cy, cw + 6, 20, 8, cab.pillar, 1);
  fillRoundRect(cab.x - 3, cy + ch - 18, cw + 6, 20, 8, '#171c25', 1);
  // Status trim strip on roof
  fillRoundRect(cab.x + 52, cy + 7, cw - 104, 4, 2, cab.accent, 0.95);

  // Inner dark rack bay
  const bayX = cab.x + 16;
  const bayW = cw - 32;
  fillRoundRect(bayX, cy + 28, bayW, ch - 54, 6, '#0d1118', 1);

  // Header plaque
  fillRoundRect(bayX + 4, cy + 32, bayW - 8, 22, 4, '#1b2230', 1);
  fillCircle(bayX + 16, cy + 43, 3.5, cab.accent, 0.95);
  fillRoundRect(bayX + 28, cy + 39, 92, 7, 3, '#cbd5e1', 0.78);
  fillRoundRect(bayX + bayW - 56, cy + 39, 44, 7, 3, cab.accent, 0.65);

  // Mounted server units + under-chassis telemetry status strips
  let uy = cy + 60;
  for (const kind of cab.units) {
    const uh = kind === 'B3' ? 70 : kind === 'B2' ? 40 : 22;
    const isNode = kind.startsWith('B');
    const faceColor = kind === 'pdu' ? '#1e2430' : kind === 'blank' ? '#2c3442' : '#2a313e';

    fillRoundRect(bayX + 5, uy, bayW - 10, uh, 4, faceColor, 1);
    strokeRect(bayX + 5, uy, bayW - 10, uh, 1, '#475569', 0.55);

    if (kind === 'pdu') {
      for (let s = 0; s < 6; s++) {
        fillRoundRect(bayX + 18 + s * 22, uy + 6, 14, 10, 2, '#0f172a', 1);
        fillCircle(bayX + 25 + s * 22, uy + 4, 1.8, '#22c55e', 0.9);
      }
      fillRoundRect(bayX + bayW - 52, uy + 5, 38, 12, 2, '#07131d', 1);
      fillRoundRect(bayX + bayW - 46, uy + 9, 26, 4, 2, '#38bdf8', 0.9);
    } else if (kind === 'blank') {
      fillRoundRect(bayX + 22, uy + 8, bayW - 44, 6, 3, '#1a202c', 0.8);
    } else {
      // Server LEDs & OLED readout
      fillCircle(bayX + 16, uy + 10, 2.8, '#22c55e', 0.95);
      fillCircle(bayX + 24, uy + 10, 2.2, '#38bdf8', 0.9);
      // Drive bays or vents
      const bays = kind === 'B3' ? 4 : kind === 'B2' ? 6 : 5;
      for (let b = 0; b < bays; b++) {
        fillRoundRect(bayX + 34 + b * 22, uy + 6, 17, uh - 12, 2, '#161c26', 1);
      }
      // B3 Dual Turbines
      if (kind === 'B3') {
        for (const tx of [bayX + bayW - 58, bayX + bayW - 26]) {
          fillCircle(tx, uy + uh / 2 + 4, 13, '#0a0e16', 1);
          fillCircle(tx, uy + uh / 2 + 4, 9, '#475569', 0.6);
          fillCircle(tx, uy + uh / 2 + 4, 3.5, cab.accent, 0.95);
        }
      } else {
        // OLED mini telemetry panel
        fillRoundRect(bayX + bayW - 60, uy + 5, 48, uh - 10, 3, '#07111c', 1);
        fillRoundRect(bayX + bayW - 54, uy + 9, 34, 4, 2, '#38bdf8', 0.85);
      }
    }

    uy += uh + 2;

    // Dedicated Under-Server Dual-Row Status Strip
    if (isNode && uy + 24 < cy + ch - 28) {
      const sh = 24;
      fillRoundRect(bayX + 5, uy, bayW - 10, sh, 3, '#0c121e', 1);
      fillRoundRect(bayX + 7, uy + 3, 3, sh - 6, 1.5, cab.accent, 0.95);
      // Row 1: LED + title + latency badge
      fillCircle(bayX + 16, uy + 7, 2.3, '#22c55e', 0.95);
      fillRoundRect(bayX + 23, uy + 5, 76, 4, 2, '#e2e8f0', 0.8);
      fillRoundRect(bayX + bayW - 44, uy + 4, 32, 6, 2, '#10b981', 0.45);
      // Row 2: CPU / RAM / DISK progress bars
      fillRoundRect(bayX + 14, uy + 15, 52, 4.5, 2, '#1e293b', 1);
      fillRoundRect(bayX + 14, uy + 15, 34, 4.5, 2, '#38bdf8', 0.92);
      fillRoundRect(bayX + 72, uy + 15, 52, 4.5, 2, '#1e293b', 1);
      fillRoundRect(bayX + 72, uy + 15, 40, 4.5, 2, '#a78bfa', 0.92);
      fillRoundRect(bayX + 130, uy + 15, 46, 4.5, 2, '#1e293b', 1);
      fillRoundRect(bayX + 130, uy + 15, 28, 4.5, 2, '#34d399', 0.92);
      uy += sh + 5;
    } else {
      uy += 4;
    }
  }
}

// 4. Floating Minimal Glass HUD Pills (Top-Left Brand + Bottom Camera Dock)
fillRoundRect(24, 18, 310, 34, 17, '#0f172a', 0.84);
strokeRect(24, 18, 310, 34, 1, '#475569', 0.45);
fillCircle(44, 35, 5, '#34d399', 0.95);
fillRoundRect(58, 31, 118, 8, 4, '#f1f5f9', 0.86);
fillRoundRect(190, 28, 44, 14, 7, '#0284c7', 0.35);
fillRoundRect(248, 31, 68, 8, 4, '#94a3b8', 0.72);

fillRoundRect(410, H - 52, 380, 34, 17, '#0f172a', 0.84);
strokeRect(410, H - 52, 380, 34, 1, '#475569', 0.45);
fillRoundRect(422, H - 46, 68, 22, 11, '#f8fafc', 0.92);
for (let i = 1; i < 4; i++) {
  fillRoundRect(422 + i * 74, H - 44, 58, 18, 9, '#334155', 0.55);
}

// Encode Raw RGBA Buffer to Standard PNG (Zero Dependencies)
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const rawRows = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  const rowStart = y * (W * 4 + 1);
  rawRows[rowStart] = 0; // filter type 0 (None)
  buf.copy(rawRows, rowStart + 1, y * W * 4, (y + 1) * W * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const idat = zlib.deflateSync(rawRows, { level: 9 });
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', idat),
  pngChunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync(outPath, png);
console.log(`Generated ${outPath} (${W}x${H}, ${(png.length / 1024).toFixed(1)} KB)`);
