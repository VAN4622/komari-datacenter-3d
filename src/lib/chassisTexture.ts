import * as THREE from 'three';
import { ACCENTS, FINISHES, OLEDS, type AccentSpec, type FinishPalette, type OledSpec } from '@/data/fleet';
import type { EffectiveNodeStyle, NodeInfo } from '@/types/rack';

const SCALE = 2; // 2x retina crispness (540 -> 1080px wide)

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
  stroke?: string,
  lineWidth = 0.8,
) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function makeVerticalGrad(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  stops: [number, string][],
): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

function drawScrew(ctx: CanvasRenderingContext2D, cx: number, cy: number, fin: FinishPalette) {
  ctx.beginPath();
  ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = fin.screwFace;
  ctx.fill();
  ctx.strokeStyle = fin.stroke;
  ctx.lineWidth = 0.55;
  ctx.stroke();

  ctx.strokeStyle = fin.screwSlot;
  ctx.lineWidth = 0.78;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 1.35, cy);
  ctx.lineTo(cx + 1.35, cy);
  ctx.moveTo(cx, cy - 1.35);
  ctx.lineTo(cx, cy + 1.35);
  ctx.stroke();
}

function drawRackEars(ctx: CanvasRenderingContext2D, h: number, fin: FinishPalette) {
  const earGrad = makeVerticalGrad(ctx, 1, h - 1, [
    [0, fin.earTop],
    [0.5, fin.earMid],
    [1, fin.earBot],
  ]);
  const topScrew = Math.min(13.5, h * 0.24);
  const botScrew = h - topScrew;
  const midY = h / 2;

  fillRoundRect(ctx, 0.5, 1, 21.5, h - 2, 1.8, earGrad, fin.stroke, 0.8);
  fillRoundRect(ctx, 518, 1, 21.5, h - 2, 1.8, earGrad, fin.stroke, 0.8);

  ctx.strokeStyle = fin.bevel;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(2, 2);
  ctx.lineTo(20.5, 2);
  ctx.moveTo(519.5, 2);
  ctx.lineTo(538, 2);
  ctx.stroke();

  drawScrew(ctx, 11.25, topScrew, fin);
  drawScrew(ctx, 11.25, botScrew, fin);
  drawScrew(ctx, 528.75, topScrew, fin);
  drawScrew(ctx, 528.75, botScrew, fin);

  if (h >= 110) {
    fillRoundRect(ctx, 7.75, midY - 14, 7, 28, 2, fin.deep, fin.stroke, 0.6);
    fillRoundRect(ctx, 525.25, midY - 14, 7, 28, 2, fin.deep, fin.stroke, 0.6);
    ctx.strokeStyle = fin.bevel;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(9.4, midY - 10);
    ctx.lineTo(9.4, midY + 10);
    ctx.moveTo(526.9, midY - 10);
    ctx.lineTo(526.9, midY + 10);
    ctx.stroke();
  }
}

function drawGlassGloss(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.38, 'rgba(255,255,255,0.02)');
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0.04)');
  fillRoundRect(ctx, x, y, w, h, r, g);
}

function drawStatusStripOverlay(
  ctx: CanvasRenderingContext2D,
  emCtx: CanvasRenderingContext2D,
  node: NodeInfo,
  w: number,
  h: number,
) {
  const stripH = 13;
  const y = h - stripH - 1;
  fillRoundRect(ctx, 24, y, w - 48, stripH, 1.6, 'rgba(5, 9, 16, 0.88)', 'rgba(56, 189, 248, 0.35)', 0.6);
  fillRoundRect(emCtx, 24, y, w - 48, stripH, 1.6, 'rgba(10, 22, 36, 0.45)');

  const font = '700 7.2px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.font = font;
  emCtx.font = font;
  ctx.textBaseline = 'middle';
  emCtx.textBaseline = 'middle';

  const statusText = node.online
    ? `${node.name.slice(0, 14)}   CPU ${Math.round(node.cpu)}%   RAM ${Math.round(node.ram)}%   ↓${node.netDown.toFixed(1)}M   ↑${node.netUp.toFixed(1)}M   ${node.ping > 0 ? `${node.ping}ms` : '--'}`
    : `${node.name.slice(0, 14)}   OFFLINE · STANDBY`;

  ctx.fillStyle = node.online ? '#bae6fd' : '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText(statusText, 32, y + stripH / 2 + 0.4);

  emCtx.fillStyle = node.online ? '#38bdf8' : '#334155';
  emCtx.textAlign = 'left';
  emCtx.fillText(statusText, 32, y + stripH / 2 + 0.4);
}

function drawSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  emCtx: CanvasRenderingContext2D,
  w: number,
  h: number,
  selected: boolean,
  uidBlinking: boolean,
) {
  if (selected) {
    roundRectPath(ctx, 1.2, 1.2, w - 2.4, h - 2.4, 2.2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    roundRectPath(emCtx, 1.2, 1.2, w - 2.4, h - 2.4, 2.2);
    emCtx.strokeStyle = '#38bdf8';
    emCtx.lineWidth = 1.6;
    emCtx.stroke();
  }
  if (uidBlinking) {
    fillRoundRect(ctx, 2, 4, 4, h - 8, 1.5, '#38bdf8');
    fillRoundRect(emCtx, 2, 4, 4, h - 8, 1.5, '#38bdf8');
    fillRoundRect(ctx, w - 6, 4, 4, h - 8, 1.5, '#38bdf8');
    fillRoundRect(emCtx, w - 6, 4, 4, h - 8, 1.5, '#38bdf8');
  }
}

function drawB1(
  ctx: CanvasRenderingContext2D,
  emCtx: CanvasRenderingContext2D,
  node: NodeInfo,
  style: EffectiveNodeStyle,
  fin: FinishPalette,
  acc: AccentSpec,
  oled: OledSpec,
  uidBlinking: boolean,
) {
  const h = 58;
  const isOff = !node.online;
  const isHot = node.online && node.cpu >= 80;
  const statColor = isOff ? '#64748B' : isHot ? '#FB923C' : oled.main;
  const healthColor = isOff ? '#475569' : isHot ? '#F97316' : '#22C55E';
  const barW = isOff ? 0 : Math.max(4, Math.round((node.cpu / 100) * 102));

  drawRackEars(ctx, h, fin);
  const bodyGrad = makeVerticalGrad(ctx, 1, h - 1, [
    [0, fin.top],
    [0.16, fin.mid],
    [0.86, fin.bot],
    [1, fin.deep],
  ]);
  const accGrad = makeVerticalGrad(ctx, 0, 18, [
    [0, acc.hex],
    [1, acc.dark],
  ]);

  fillRoundRect(ctx, 23, 1, 494, 56, 2, bodyGrad, fin.stroke, 0.8);
  ctx.strokeStyle = fin.bevel;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(25, 2.1);
  ctx.lineTo(515, 2.1);
  ctx.stroke();

  // Left OLED module
  const ox = 34;
  const oy = 7;
  fillRoundRect(ctx, ox, oy, 120, 44, 2.8, '#0D1016', fin.bayBorder, 0.65);
  fillRoundRect(ctx, ox + 2, oy + 2, 116, 40, 2.2, oled.bg, '#283140', 0.55);
  fillRoundRect(emCtx, ox + 2, oy + 2, 116, 40, 2.2, oled.bg);

  ctx.textBaseline = 'alphabetic';
  emCtx.textBaseline = 'alphabetic';

  // OLED texts
  ctx.font = '700 7px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = oled.title;
  ctx.textAlign = 'left';
  ctx.fillText(node.name.slice(0, 16), ox + 8, oy + 14);
  emCtx.font = ctx.font;
  emCtx.fillStyle = oled.title;
  emCtx.textAlign = 'left';
  emCtx.fillText(node.name.slice(0, 16), ox + 8, oy + 14);

  ctx.font = '800 10.2px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = statColor;
  ctx.fillText(isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`, ox + 8, oy + 27);
  emCtx.font = ctx.font;
  emCtx.fillStyle = statColor;
  emCtx.fillText(isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`, ox + 8, oy + 27);

  ctx.font = '600 6.8px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#8B98AA';
  ctx.textAlign = 'right';
  ctx.fillText(isOff ? 'STBY' : `↓${node.netDown.toFixed(0)}M`, ox + 112, oy + 27);
  emCtx.font = ctx.font;
  emCtx.fillStyle = '#64748B';
  emCtx.textAlign = 'right';
  emCtx.fillText(isOff ? 'STBY' : `↓${node.netDown.toFixed(0)}M`, ox + 112, oy + 27);

  fillRoundRect(ctx, ox + 8, oy + 33.5, 102, 3.5, 1.75, 'rgba(255,255,255,0.09)');
  if (barW > 0) {
    const barColor = isHot ? '#F97316' : oled.bar;
    fillRoundRect(ctx, ox + 8, oy + 33.5, barW, 3.5, 1.75, barColor);
    fillRoundRect(emCtx, ox + 8, oy + 33.5, barW, 3.5, 1.75, barColor);
  }
  drawGlassGloss(ctx, ox + 2, oy + 2, 116, 40, 2.2);

  // Center 6x RJ45 + 2x SFP+ Bank
  const cx0 = 164;
  const cy0 = 7;
  fillRoundRect(ctx, cx0, cy0, 236, 44, 2.8, '#0D1016', fin.bayBorder, 0.65);

  for (let i = 0; i < 6; i++) {
    const px = cx0 + 10 + i * 26.5;
    fillRoundRect(ctx, px, cy0 + 11, 20, 16, 1.2, '#06080B', '#475161', 0.6);
    fillRoundRect(ctx, px + 2.8, cy0 + 13.5, 14.4, 9.8, 0.7, '#0E1219');
    ctx.strokeStyle = '#B5892E';
    ctx.lineWidth = 0.85;
    ctx.setLineDash([1.2, 1.2]);
    ctx.beginPath();
    ctx.moveTo(px + 5, cy0 + 15.5);
    ctx.lineTo(px + 15, cy0 + 15.5);
    ctx.stroke();
    ctx.setLineDash([]);

    const led1 = isOff ? '#334155' : i === 4 ? '#38BDF8' : '#22C55E';
    const led2 = isOff ? '#334155' : '#F59E0B';
    ctx.beginPath();
    ctx.arc(px + 4.8, cy0 + 6.5, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = led1;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 14.5, cy0 + 6.5, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = led2;
    ctx.fill();
    if (!isOff) {
      emCtx.beginPath();
      emCtx.arc(px + 4.8, cy0 + 6.5, 1.8, 0, Math.PI * 2);
      emCtx.fillStyle = led1;
      emCtx.fill();
      emCtx.beginPath();
      emCtx.arc(px + 14.5, cy0 + 6.5, 1.5, 0, Math.PI * 2);
      emCtx.fillStyle = led2;
      emCtx.fill();
    }
  }

  // Dual SFP+ cages
  fillRoundRect(ctx, cx0 + 176, cy0 + 11, 22, 16, 1.2, '#171E28', '#6E7B8C', 0.65);
  fillRoundRect(ctx, cx0 + 204, cy0 + 11, 22, 16, 1.2, '#171E28', '#6E7B8C', 0.65);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(cx0 + 179, cy0 + 13.8);
  ctx.lineTo(cx0 + 195, cy0 + 13.8);
  ctx.moveTo(cx0 + 207, cy0 + 13.8);
  ctx.lineTo(cx0 + 223, cy0 + 13.8);
  ctx.stroke();
  ctx.font = '700 6px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'center';
  ctx.fillText('10G SFP+', cx0 + 201, cy0 + 37.5);

  // Patch cables
  fillRoundRect(ctx, cx0 + 40, cy0 + 16, 12, 10, 1.5, acc.hex, acc.dark, 0.6);
  fillRoundRect(ctx, cx0 + 120, cy0 + 16, 12, 10, 1.5, acc.hex, acc.dark, 0.6);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(cx0 + 46, cy0 + 26);
  ctx.bezierCurveTo(cx0 + 46, cy0 + 44, cx0 + 126, cy0 + 44, cx0 + 126, cy0 + 26);
  ctx.stroke();
  ctx.strokeStyle = acc.hex;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx0 + 46, cy0 + 26);
  ctx.bezierCurveTo(cx0 + 46, cy0 + 43, cx0 + 126, cy0 + 43, cx0 + 126, cy0 + 26);
  ctx.stroke();

  fillRoundRect(ctx, cx0 + 181, cy0 + 16, 12, 10, 1.5, acc.cable2, '#0F172A', 0.6);
  ctx.strokeStyle = acc.cable2;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(cx0 + 187, cy0 + 26);
  ctx.bezierCurveTo(cx0 + 187, cy0 + 40, cx0 + 222, cy0 + 40, cx0 + 231, cy0 + 32);
  ctx.stroke();

  // Right asset tag + power ring + PWR/UID
  const rx = 410;
  const ry = 8;
  fillRoundRect(ctx, rx, ry + 1.5, 60, 14, 2.2, accGrad);
  ctx.font = '800 6.8px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#FFFDF9';
  ctx.textAlign = 'center';
  ctx.fillText(style.tag.slice(0, 10), rx + 30, ry + 11);

  ctx.beginPath();
  ctx.arc(rx + 81, ry + 21, 11.5, 0, Math.PI * 2);
  ctx.fillStyle = '#14181F';
  ctx.fill();
  ctx.strokeStyle = fin.bayBorder;
  ctx.lineWidth = 0.65;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(rx + 81, ry + 21, 8.8, 0, Math.PI * 2);
  ctx.fillStyle = '#0C0F14';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(rx + 81, ry + 21, 5.8, 0, Math.PI * 2);
  ctx.strokeStyle = healthColor;
  ctx.lineWidth = 1.65;
  ctx.stroke();
  if (!isOff) {
    emCtx.beginPath();
    emCtx.arc(rx + 81, ry + 21, 5.8, 0, Math.PI * 2);
    emCtx.strokeStyle = healthColor;
    emCtx.lineWidth = 1.8;
    emCtx.stroke();
  }

  ctx.beginPath();
  ctx.arc(rx + 8, ry + 31.5, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = healthColor;
  ctx.fill();
  if (!isOff) {
    emCtx.beginPath();
    emCtx.arc(rx + 8, ry + 31.5, 2.7, 0, Math.PI * 2);
    emCtx.fillStyle = healthColor;
    emCtx.fill();
  }

  ctx.font = '600 6.2px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = fin.textMute;
  ctx.textAlign = 'left';
  ctx.fillText('PWR', rx + 15, ry + 33.8);

  const uidColor = uidBlinking ? '#38BDF8' : '#64748B';
  ctx.beginPath();
  ctx.arc(rx + 40, ry + 31.5, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = uidColor;
  ctx.fill();
  if (uidBlinking) {
    emCtx.beginPath();
    emCtx.arc(rx + 40, ry + 31.5, 3.2, 0, Math.PI * 2);
    emCtx.fillStyle = '#38BDF8';
    emCtx.fill();
  }
  ctx.fillStyle = fin.textMute;
  ctx.fillText('UID', rx + 47, ry + 33.8);
}

function drawB2(
  ctx: CanvasRenderingContext2D,
  emCtx: CanvasRenderingContext2D,
  node: NodeInfo,
  style: EffectiveNodeStyle,
  fin: FinishPalette,
  acc: AccentSpec,
  oled: OledSpec,
  uidBlinking: boolean,
) {
  const h = 116;
  const isOff = !node.online;
  const isHot = node.online && node.cpu >= 80;
  const statColor = isOff ? '#64748B' : isHot ? '#FB923C' : oled.main;
  const healthColor = isOff ? '#475569' : isHot ? '#F97316' : '#22C55E';
  const barW = isOff ? 0 : Math.max(4, Math.round((node.cpu / 100) * 84));

  drawRackEars(ctx, h, fin);
  const bodyGrad = makeVerticalGrad(ctx, 1, h - 1, [
    [0, fin.top],
    [0.16, fin.mid],
    [0.86, fin.bot],
    [1, fin.deep],
  ]);
  fillRoundRect(ctx, 23, 1, 494, 114, 2, bodyGrad, fin.stroke, 0.8);
  ctx.strokeStyle = fin.bevel;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(25, 2.1);
  ctx.lineTo(515, 2.1);
  ctx.stroke();

  // 2 x 4 Hot-Swap NVMe Drive Bays
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const bx = 34 + c * 91;
      const by = 11 + r * 49;
      const num = r * 4 + c + 1;
      const latchGrad = makeVerticalGrad(ctx, by + 5.5, by + 37.5, [
        [0, acc.hex],
        [1, acc.dark],
      ]);

      fillRoundRect(ctx, bx, by, 85, 43, 2.2, fin.bayBg, fin.bayBorder, 0.65);
      fillRoundRect(ctx, bx + 4, by + 5.5, 8.5, 32, 1.6, latchGrad);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(bx + 6.4, by + 9.5);
      ctx.lineTo(bx + 6.4, by + 33.5);
      ctx.stroke();

      for (let v = 0; v < 5; v++) {
        fillRoundRect(ctx, bx + 19 + v * 9.2, by + 12, 5.6, 18, 1.1, '#090C10', 'rgba(255,255,255,0.05)', 0.45);
      }

      const l1 = isOff ? '#334155' : '#22C55E';
      const l2 = isOff ? '#334155' : '#38BDF8';
      ctx.beginPath();
      ctx.arc(bx + 75, by + 13.5, 2, 0, Math.PI * 2);
      ctx.fillStyle = l1;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx + 75, by + 23, 2, 0, Math.PI * 2);
      ctx.fillStyle = l2;
      ctx.fill();

      if (!isOff) {
        emCtx.beginPath();
        emCtx.arc(bx + 75, by + 13.5, 2.1, 0, Math.PI * 2);
        emCtx.fillStyle = l1;
        emCtx.fill();
        emCtx.beginPath();
        emCtx.arc(bx + 75, by + 23, 2.1, 0, Math.PI * 2);
        emCtx.fillStyle = l2;
        emCtx.fill();
      }

      ctx.font = '700 6.2px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = fin.textMute;
      ctx.textAlign = 'center';
      ctx.fillText(`0${num}`, bx + 75, by + 36.5);
    }
  }

  // Right Control Bay + OLED
  const rx = 402;
  const ry = 11;
  fillRoundRect(ctx, rx, ry, 104, 92, 2.8, '#0D1016', fin.bayBorder, 0.65);
  fillRoundRect(ctx, rx + 5, ry + 5, 94, 44, 2.2, oled.bg, '#283140', 0.55);
  fillRoundRect(emCtx, rx + 5, ry + 5, 94, 44, 2.2, oled.bg);

  ctx.font = '700 7px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = oled.title;
  ctx.textAlign = 'left';
  ctx.fillText(node.name.slice(0, 13), rx + 10, ry + 16);
  emCtx.font = ctx.font;
  emCtx.fillStyle = oled.title;
  emCtx.textAlign = 'left';
  emCtx.fillText(node.name.slice(0, 13), rx + 10, ry + 16);

  ctx.font = '800 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = statColor;
  ctx.fillText(isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`, rx + 10, ry + 30.5);
  emCtx.font = ctx.font;
  emCtx.fillStyle = statColor;
  emCtx.fillText(isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`, rx + 10, ry + 30.5);

  ctx.font = '600 6.6px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#8B98AA';
  ctx.textAlign = 'right';
  ctx.fillText(isOff ? 'STBY' : `D${node.disk}%`, rx + 94, ry + 30.5);

  fillRoundRect(ctx, rx + 10, ry + 38.5, 84, 3.5, 1.75, 'rgba(255,255,255,0.09)');
  if (barW > 0) {
    const barColor = isHot ? '#F97316' : oled.bar;
    fillRoundRect(ctx, rx + 10, ry + 38.5, barW, 3.5, 1.75, barColor);
    fillRoundRect(emCtx, rx + 10, ry + 38.5, barW, 3.5, 1.75, barColor);
  }
  drawGlassGloss(ctx, rx + 5, ry + 5, 94, 44, 2.2);

  const accGrad = makeVerticalGrad(ctx, ry + 55, ry + 68.5, [
    [0, acc.hex],
    [1, acc.dark],
  ]);
  fillRoundRect(ctx, rx + 6, ry + 55, 54, 13.5, 2, accGrad);
  ctx.font = '800 6.5px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#FFFDF9';
  ctx.textAlign = 'center';
  ctx.fillText(style.tag.slice(0, 9), rx + 33, ry + 64);

  ctx.beginPath();
  ctx.arc(rx + 82, ry + 71, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#151A22';
  ctx.fill();
  ctx.strokeStyle = fin.bayBorder;
  ctx.lineWidth = 0.65;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(rx + 82, ry + 71, 6.2, 0, Math.PI * 2);
  ctx.strokeStyle = healthColor;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  if (!isOff) {
    emCtx.beginPath();
    emCtx.arc(rx + 82, ry + 71, 6.2, 0, Math.PI * 2);
    emCtx.strokeStyle = healthColor;
    emCtx.lineWidth = 1.8;
    emCtx.stroke();
  }

  ctx.beginPath();
  ctx.arc(rx + 12, ry + 80, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = healthColor;
  ctx.fill();
  ctx.font = '600 6.2px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#8B98AA';
  ctx.textAlign = 'left';
  ctx.fillText('OK', rx + 18.5, ry + 82.3);

  ctx.beginPath();
  ctx.arc(rx + 40, ry + 80, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = uidBlinking ? '#38BDF8' : '#64748B';
  ctx.fill();
  if (uidBlinking) {
    emCtx.beginPath();
    emCtx.arc(rx + 40, ry + 80, 3.1, 0, Math.PI * 2);
    emCtx.fillStyle = '#38BDF8';
    emCtx.fill();
  }
  ctx.fillStyle = '#8B98AA';
  ctx.fillText('UID', rx + 46.5, ry + 82.3);
}

function drawTurbine(ctx: CanvasRenderingContext2D, cx: number, cy: number, accHex: string) {
  ctx.beginPath();
  ctx.arc(cx, cy, 27, 0, Math.PI * 2);
  ctx.fillStyle = '#080B0F';
  ctx.fill();
  ctx.strokeStyle = '#475161';
  ctx.lineWidth = 0.85;
  ctx.stroke();

  // 4 fan blades
  ctx.fillStyle = '#64748B';
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i * Math.PI) / 2 + 0.35);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(0, -17, 13, -21, 17, -11);
    ctx.bezierCurveTo(10, -5, 5, -3, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 6.4, 0, Math.PI * 2);
  ctx.fillStyle = accHex;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 2.3, 0, Math.PI * 2);
  ctx.fillStyle = '#101318';
  ctx.fill();

  ctx.strokeStyle = 'rgba(148,163,184,0.24)';
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  ctx.arc(cx, cy, 19, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 11.5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawB3(
  ctx: CanvasRenderingContext2D,
  emCtx: CanvasRenderingContext2D,
  node: NodeInfo,
  style: EffectiveNodeStyle,
  fin: FinishPalette,
  acc: AccentSpec,
  oled: OledSpec,
  uidBlinking: boolean,
) {
  const h = 216;
  const isOff = !node.online;
  const isHot = node.online && node.cpu >= 80;
  const statColor = isOff ? '#64748B' : isHot ? '#FB923C' : oled.main;
  const healthColor = isOff ? '#475569' : isHot ? '#F97316' : '#22C55E';
  const barW = isOff ? 0 : Math.max(5, Math.round((node.cpu / 100) * 114));

  drawRackEars(ctx, h, fin);
  const bodyGrad = makeVerticalGrad(ctx, 1, h - 1, [
    [0, fin.top],
    [0.16, fin.mid],
    [0.86, fin.bot],
    [1, fin.deep],
  ]);
  fillRoundRect(ctx, 23, 1, 494, 214, 2, bodyGrad, fin.stroke, 0.8);
  ctx.strokeStyle = fin.bevel;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(25, 2.1);
  ctx.lineTo(515, 2.1);
  ctx.stroke();

  // 4x Vertical Compute Blades
  for (let i = 0; i < 4; i++) {
    const bx = 34 + i * 81;
    const by = 13;
    fillRoundRect(ctx, bx, by, 74, 190, 2.5, fin.bayBg, fin.bayBorder, 0.65);

    const accGrad = makeVerticalGrad(ctx, by + 8, by + 20.5, [
      [0, acc.hex],
      [1, acc.dark],
    ]);
    fillRoundRect(ctx, bx + 8, by + 8, 58, 12.5, 2, accGrad);
    ctx.font = '800 6.4px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#FFFDF9';
    ctx.textAlign = 'center';
    ctx.fillText(`BLADE 0${i + 1}`, bx + 37, by + 16.5);

    const l1 = isOff ? '#334155' : '#22C55E';
    const l2 = isOff ? '#334155' : '#38BDF8';
    ctx.beginPath();
    ctx.arc(bx + 14.5, by + 30, 2.1, 0, Math.PI * 2);
    ctx.fillStyle = l1;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + 24, by + 30, 2.1, 0, Math.PI * 2);
    ctx.fillStyle = l2;
    ctx.fill();

    if (!isOff) {
      emCtx.beginPath();
      emCtx.arc(bx + 14.5, by + 30, 2.2, 0, Math.PI * 2);
      emCtx.fillStyle = l1;
      emCtx.fill();
      emCtx.beginPath();
      emCtx.arc(bx + 24, by + 30, 2.2, 0, Math.PI * 2);
      emCtx.fillStyle = l2;
      emCtx.fill();
    }

    ctx.font = '600 6.2px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = fin.textMute;
    ctx.textAlign = 'right';
    ctx.fillText('EPYC', bx + 63, by + 32.2);

    for (let row = 0; row < 11; row++) {
      fillRoundRect(ctx, bx + 11, by + 42 + row * 10.8, 52, 5.6, 1.1, '#090C10', 'rgba(255,255,255,0.04)', 0.45);
    }

    fillRoundRect(ctx, bx + 14, by + 168, 46, 12, 2, '#0B0E13', '#3E4754', 0.6);
    ctx.strokeStyle = acc.hex;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx + 21, by + 174);
    ctx.lineTo(bx + 53, by + 174);
    ctx.stroke();
  }

  // Right Telemetry + Dual High-CFM Turbines
  const rx = 364;
  const ry = 13;
  fillRoundRect(ctx, rx, ry, 142, 190, 3, '#0D1016', fin.bayBorder, 0.65);
  fillRoundRect(ctx, rx + 7, ry + 7, 128, 46, 2.2, oled.bg, '#283140', 0.6);
  fillRoundRect(emCtx, rx + 7, ry + 7, 128, 46, 2.2, oled.bg);

  ctx.font = '700 7.2px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = oled.title;
  ctx.textAlign = 'left';
  ctx.fillText(node.name.slice(0, 14), rx + 13, ry + 18.5);
  emCtx.font = ctx.font;
  emCtx.fillStyle = oled.title;
  emCtx.textAlign = 'left';
  emCtx.fillText(node.name.slice(0, 14), rx + 13, ry + 18.5);

  ctx.font = '800 10.4px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = statColor;
  ctx.fillText(isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`, rx + 13, ry + 33);
  emCtx.font = ctx.font;
  emCtx.fillStyle = statColor;
  emCtx.fillText(isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`, rx + 13, ry + 33);

  ctx.font = '600 6.8px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#8B98AA';
  ctx.textAlign = 'right';
  ctx.fillText(isOff ? '0 RPM' : `${Math.round(1800 + node.cpu * 34)} RPM`, rx + 128, ry + 33);

  fillRoundRect(ctx, rx + 13, ry + 41.5, 114, 3.6, 1.8, 'rgba(255,255,255,0.09)');
  if (barW > 0) {
    const barColor = isHot ? '#F97316' : oled.bar;
    fillRoundRect(ctx, rx + 13, ry + 41.5, barW, 3.6, 1.8, barColor);
    fillRoundRect(emCtx, rx + 13, ry + 41.5, barW, 3.6, 1.8, barColor);
  }
  drawGlassGloss(ctx, rx + 7, ry + 7, 128, 46, 2.2);

  const accGrad = makeVerticalGrad(ctx, ry + 59, ry + 73, [
    [0, acc.hex],
    [1, acc.dark],
  ]);
  fillRoundRect(ctx, rx + 7, ry + 59, 56, 14, 2.2, accGrad);
  ctx.font = '800 6.6px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#FFFDF9';
  ctx.textAlign = 'center';
  ctx.fillText(style.tag.slice(0, 9), rx + 35, ry + 68.5);

  ctx.beginPath();
  ctx.arc(rx + 90, ry + 66, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = healthColor;
  ctx.fill();
  if (!isOff) {
    emCtx.beginPath();
    emCtx.arc(rx + 90, ry + 66, 2.9, 0, Math.PI * 2);
    emCtx.fillStyle = healthColor;
    emCtx.fill();
  }

  ctx.beginPath();
  ctx.arc(rx + 105, ry + 66, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = uidBlinking ? '#38BDF8' : '#64748B';
  ctx.fill();
  if (uidBlinking) {
    emCtx.beginPath();
    emCtx.arc(rx + 105, ry + 66, 3.2, 0, Math.PI * 2);
    emCtx.fillStyle = '#38BDF8';
    emCtx.fill();
  }

  ctx.beginPath();
  ctx.arc(rx + 123, ry + 66, 5.8, 0, Math.PI * 2);
  ctx.fillStyle = '#14181F';
  ctx.fill();
  ctx.strokeStyle = healthColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawTurbine(ctx, rx + 40, ry + 116, acc.hex);
  drawTurbine(ctx, rx + 102, ry + 116, acc.hex);

  fillRoundRect(ctx, rx + 9, ry + 158, 124, 22, 2.5, '#090C10', '#2B3340', 0.6);
  ctx.font = '600 6.5px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#7D8899';
  ctx.textAlign = 'center';
  ctx.fillText('DUAL REDUNDANT PSU · 1600W', rx + 71, ry + 171.8);
}

function drawB4(
  ctx: CanvasRenderingContext2D,
  emCtx: CanvasRenderingContext2D,
  node: NodeInfo,
  style: EffectiveNodeStyle,
  fin: FinishPalette,
  acc: AccentSpec,
  oled: OledSpec,
  uidBlinking: boolean,
) {
  const h = 58;
  const isOff = !node.online;
  const isHot = node.online && node.cpu >= 80;
  const statColor = isOff ? '#64748B' : isHot ? '#FB923C' : oled.main;
  const healthColor = isOff ? '#475569' : isHot ? '#F97316' : '#22C55E';
  const finTemp = isOff ? '--' : `${Math.round(28 + node.cpu * 0.44)}°C`;

  fillRoundRect(ctx, 23, 1, 494, 56, 2, '#0B0E13');
  drawRackEars(ctx, h, fin);

  // Cantilever shelf lip
  fillRoundRect(ctx, 23, 46, 494, 11, 1.6, '#252B34', '#0E1116', 0.75);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(25, 47.2);
  ctx.lineTo(515, 47.2);
  ctx.stroke();
  ctx.font = '700 6px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#8893A3';
  ctx.textAlign = 'left';
  ctx.fillText('1U CANTILEVER SHELF · NANO IPC', 36, 53.8);
  ctx.fillStyle = acc.hex;
  ctx.textAlign = 'right';
  ctx.fillText(style.tag.slice(0, 12), 504, 53.8);

  // Mini 12V Power Brick + Coiled Cable
  const px = 396;
  const py = 15;
  fillRoundRect(ctx, px + 22, py + 8, 72, 21, 3, '#181D24', '#3F4958', 0.65);
  ctx.beginPath();
  ctx.arc(px + 32, py + 18.5, 2, 0, Math.PI * 2);
  ctx.fillStyle = healthColor;
  ctx.fill();
  ctx.font = '700 6.3px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.textAlign = 'left';
  ctx.fillText('12V · 3A', px + 40, py + 20.8);

  ctx.strokeStyle = acc.hex;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px - 24, py + 19);
  ctx.bezierCurveTo(px - 10, py + 19, px - 8, py + 9, px + 6, py + 9);
  ctx.bezierCurveTo(px + 15, py + 9, px + 14, py + 19, px + 22, py + 19);
  ctx.stroke();

  // CNC Finned Fanless Edge Chassis
  const finGrad = makeVerticalGrad(ctx, 4.5, 13, [
    [0, fin.finTop],
    [0.55, fin.finMid],
    [1, fin.finBot],
  ]);
  for (let i = 0; i < 12; i++) {
    const x1 = 92 + i * 21.5;
    ctx.beginPath();
    ctx.moveTo(x1, 13);
    ctx.lineTo(x1 + 4, 4.5);
    ctx.lineTo(x1 + 13, 4.5);
    ctx.lineTo(x1 + 9.5, 13);
    ctx.closePath();
    ctx.fillStyle = finGrad;
    ctx.fill();
    ctx.strokeStyle = fin.stroke;
    ctx.lineWidth = 0.55;
    ctx.stroke();
  }

  const bodyGrad = makeVerticalGrad(ctx, 12, 47, [
    [0, fin.top],
    [0.2, fin.mid],
    [0.85, fin.bot],
    [1, fin.deep],
  ]);
  fillRoundRect(ctx, 80, 12, 292, 35, 3.4, bodyGrad, fin.stroke, 0.8);
  ctx.strokeStyle = fin.bevel;
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  ctx.moveTo(84, 13.2);
  ctx.lineTo(368, 13.2);
  ctx.stroke();

  // Dual 2.5GbE + USB-C
  fillRoundRect(ctx, 91, 17, 11, 13, 1.3, '#090C10', '#4D5766', 0.6);
  fillRoundRect(ctx, 106, 17, 15, 13, 1.3, '#090C10', '#4D5766', 0.6);
  fillRoundRect(ctx, 125, 17, 15, 13, 1.3, '#090C10', '#4D5766', 0.6);
  ctx.fillStyle = isOff ? '#334155' : '#22C55E';
  ctx.fillRect(111, 18.8, 3.4, 1.8);
  ctx.fillStyle = isOff ? '#334155' : '#38BDF8';
  ctx.fillRect(130, 18.8, 3.4, 1.8);
  if (!isOff) {
    emCtx.fillStyle = '#22C55E';
    emCtx.fillRect(111, 18.8, 3.4, 1.8);
    emCtx.fillStyle = '#38BDF8';
    emCtx.fillRect(130, 18.8, 3.4, 1.8);
  }
  const accGrad = makeVerticalGrad(ctx, 34.5, 39.3, [
    [0, acc.hex],
    [1, acc.dark],
  ]);
  fillRoundRect(ctx, 104, 34.5, 22, 4.8, 2.4, accGrad);

  // Mini OLED
  fillRoundRect(ctx, 154, 15.5, 142, 28, 2.6, oled.bg, fin.bayBorder, 0.65);
  fillRoundRect(emCtx, 154, 15.5, 142, 28, 2.6, oled.bg);
  ctx.font = '700 7px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = oled.title;
  ctx.textAlign = 'left';
  ctx.fillText(node.name.slice(0, 14), 161, 26);
  emCtx.font = ctx.font;
  emCtx.fillStyle = oled.title;
  emCtx.textAlign = 'left';
  emCtx.fillText(node.name.slice(0, 14), 161, 26);

  ctx.font = '800 9.8px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = statColor;
  ctx.fillText(isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`, 161, 38);
  emCtx.font = ctx.font;
  emCtx.fillStyle = statColor;
  emCtx.fillText(isOff ? 'OFFLINE' : `CPU ${Math.round(node.cpu)}%`, 161, 38);

  ctx.font = '600 6.8px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#8B98AA';
  ctx.textAlign = 'right';
  ctx.fillText(isOff ? 'STBY' : finTemp, 289, 37.3);
  drawGlassGloss(ctx, 154, 15.5, 142, 28, 2.6);

  // Power ring + status LEDs
  ctx.beginPath();
  ctx.arc(321, 29.5, 8.8, 0, Math.PI * 2);
  ctx.fillStyle = '#14181F';
  ctx.fill();
  ctx.strokeStyle = fin.bayBorder;
  ctx.lineWidth = 0.65;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(321, 29.5, 5.2, 0, Math.PI * 2);
  ctx.strokeStyle = healthColor;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  if (!isOff) {
    emCtx.beginPath();
    emCtx.arc(321, 29.5, 5.2, 0, Math.PI * 2);
    emCtx.strokeStyle = healthColor;
    emCtx.lineWidth = 1.8;
    emCtx.stroke();
  }

  ctx.beginPath();
  ctx.arc(343, 25, 2.3, 0, Math.PI * 2);
  ctx.fillStyle = healthColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(343, 34.5, 2.3, 0, Math.PI * 2);
  ctx.fillStyle = uidBlinking ? '#38BDF8' : '#64748B';
  ctx.fill();
  if (uidBlinking) {
    emCtx.beginPath();
    emCtx.arc(343, 34.5, 2.9, 0, Math.PI * 2);
    emCtx.fillStyle = '#38BDF8';
    emCtx.fill();
  }
}

export function paintServerFaceplate(
  canvas: HTMLCanvasElement,
  emCanvas: HTMLCanvasElement,
  node: NodeInfo,
  style: EffectiveNodeStyle,
  uidBlinking: boolean,
  selected: boolean,
  showStrip: boolean,
) {
  const logicalH = style.model === 'B3' ? 216 : style.model === 'B2' ? 116 : 58;
  const logicalW = 540;
  const targetW = logicalW * SCALE;
  const targetH = logicalH * SCALE;

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  if (emCanvas.width !== targetW || emCanvas.height !== targetH) {
    emCanvas.width = targetW;
    emCanvas.height = targetH;
  }

  const ctx = canvas.getContext('2d');
  const emCtx = emCanvas.getContext('2d');
  if (!ctx || !emCtx) return;

  ctx.save();
  emCtx.save();
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  emCtx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

  ctx.clearRect(0, 0, logicalW, logicalH);
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, logicalW, logicalH);

  const fin = FINISHES[style.finish] ?? FINISHES.gunmetal;
  const acc = ACCENTS.find((a) => a.id === style.accent) ?? ACCENTS[0];
  const oled = OLEDS.find((o) => o.id === style.oled) ?? OLEDS[0];

  if (style.model === 'B2') {
    drawB2(ctx, emCtx, node, style, fin, acc, oled, uidBlinking);
  } else if (style.model === 'B3') {
    drawB3(ctx, emCtx, node, style, fin, acc, oled, uidBlinking);
  } else if (style.model === 'B4') {
    drawB4(ctx, emCtx, node, style, fin, acc, oled, uidBlinking);
  } else {
    drawB1(ctx, emCtx, node, style, fin, acc, oled, uidBlinking);
  }

  if (showStrip) {
    drawStatusStripOverlay(ctx, emCtx, node, logicalW, logicalH);
  }

  drawSelectionHighlight(ctx, emCtx, logicalW, logicalH, selected, uidBlinking);

  ctx.restore();
  emCtx.restore();
}

export function paintPduFaceplate(
  canvas: HTMLCanvasElement,
  emCanvas: HTMLCanvasElement,
  label: string | undefined,
  watts: number,
  activeSockets: number,
) {
  const logicalW = 540;
  const logicalH = 58;
  const targetW = logicalW * SCALE;
  const targetH = logicalH * SCALE;

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  if (emCanvas.width !== targetW || emCanvas.height !== targetH) {
    emCanvas.width = targetW;
    emCanvas.height = targetH;
  }

  const ctx = canvas.getContext('2d');
  const emCtx = emCanvas.getContext('2d');
  if (!ctx || !emCtx) return;

  ctx.save();
  emCtx.save();
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  emCtx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, logicalW, logicalH);
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, logicalW, logicalH);

  const fin = FINISHES.obsidian;
  const amps = (watts / 220).toFixed(1);

  drawRackEars(ctx, logicalH, fin);
  const bodyGrad = makeVerticalGrad(ctx, 1, logicalH - 1, [
    [0, fin.top],
    [0.16, fin.mid],
    [0.86, fin.bot],
    [1, fin.deep],
  ]);
  fillRoundRect(ctx, 23, 1, 494, 56, 2, bodyGrad, fin.stroke, 0.8);

  // Main Breaker Rocker
  fillRoundRect(ctx, 38, 13, 22, 32, 2.5, '#B91C1C', '#7F1D1D', 0.7);
  fillRoundRect(emCtx, 40, 15, 18, 28, 2, 'rgba(220, 38, 38, 0.45)');
  ctx.strokeStyle = '#FEE2E2';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(49, 21);
  ctx.lineTo(49, 37);
  ctx.stroke();

  // Digital Wattmeter
  fillRoundRect(ctx, 70, 11.5, 104, 35, 2.8, '#140907', '#3D4654', 0.65);
  fillRoundRect(emCtx, 70, 11.5, 104, 35, 2.8, '#1b0907');

  ctx.font = '700 6.8px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#FB923C';
  ctx.textAlign = 'left';
  ctx.fillText((label || 'APC-PDU-16A').slice(0, 14), 78, 23);
  emCtx.font = ctx.font;
  emCtx.fillStyle = '#FB923C';
  emCtx.textAlign = 'left';
  emCtx.fillText((label || 'APC-PDU-16A').slice(0, 14), 78, 23);

  ctx.font = '800 10.8px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#F87171';
  ctx.fillText(`${watts}W · ${amps}A`, 78, 38.5);
  emCtx.font = ctx.font;
  emCtx.fillStyle = '#F87171';
  emCtx.fillText(`${watts}W · ${amps}A`, 78, 38.5);
  drawGlassGloss(ctx, 70, 11.5, 104, 35, 2.8);

  // 6x IEC C13 Sockets
  for (let i = 0; i < 6; i++) {
    const sx = 188 + i * 44;
    fillRoundRect(ctx, sx, 13, 32, 32, 2.8, '#080A0E', '#363E4B', 0.65);
    fillRoundRect(ctx, sx + 8, 21, 3.4, 7, 0.7, '#475569');
    fillRoundRect(ctx, sx + 20.5, 21, 3.4, 7, 0.7, '#475569');
    fillRoundRect(ctx, sx + 14.2, 32, 3.4, 6, 0.7, '#475569');

    const active = i < activeSockets;
    ctx.beginPath();
    ctx.arc(sx + 26.5, 18.2, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#22C55E' : '#334155';
    ctx.fill();
    if (active) {
      emCtx.beginPath();
      emCtx.arc(sx + 26.5, 18.2, 1.8, 0, Math.PI * 2);
      emCtx.fillStyle = '#22C55E';
      emCtx.fill();
    }
  }

  ctx.font = '700 7.2px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'right';
  ctx.fillText('220V~', 502, 32);

  ctx.restore();
  emCtx.restore();
}

export function paintBlankFaceplate(canvas: HTMLCanvasElement, label: string | undefined) {
  const logicalW = 540;
  const logicalH = 58;
  const targetW = logicalW * SCALE;
  const targetH = logicalH * SCALE;

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, logicalW, logicalH);

  const fin = FINISHES.gunmetal;
  drawRackEars(ctx, logicalH, fin);
  const bodyGrad = makeVerticalGrad(ctx, 1, logicalH - 1, [
    [0, fin.top],
    [0.16, fin.mid],
    [0.86, fin.bot],
    [1, fin.deep],
  ]);
  fillRoundRect(ctx, 23, 1, 494, 56, 2, bodyGrad, fin.stroke, 0.8);

  for (let i = 0; i < 22; i++) {
    const x = 42 + i * 20.5;
    fillRoundRect(ctx, x, 15, 11.5, 28, 2.2, '#0A0D11', '#363E4A', 0.55);
  }

  fillRoundRect(ctx, 200, 20, 140, 18, 2.4, '#1A1F27', '#444E5D', 0.65);
  ctx.font = '700 6.8px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#9AA4B3';
  ctx.textAlign = 'center';
  ctx.fillText((label || 'AIRFLOW-BAFFLE-1U').slice(0, 20), 270, 31.2);

  ctx.restore();
}

export function configureCrispTexture(tex: THREE.CanvasTexture): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}
