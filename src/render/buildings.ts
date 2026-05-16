/** Building rendering: faction HQ, Separator, Storage, Power Plant, Command Relay with geometric fallbacks. */

import { TILE_W, TILE_H, SPRITE_PROFILES, HQ_FOOTPRINT, HQ_COLOR, GRID_COLOR } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { HqPlacement, FactionId } from '../game/map-types.js';
import type { AssetStore } from '../core/assets.js';
import type { Camera } from './camera.js';

const HQ_ASSET_KEYS: Record<FactionId, string> = {
  cyan: 'hq_cyan',
  green: 'hq_green',
  yellow: 'hq_yellow',
  purple: 'hq_purple',
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Dim a hex color by multiplying RGB channels by a factor (0..1). */
function dimColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, z: number,
  rightFace: string, leftFace: string, topFace: string,
  bHeight: number, label: string, online: boolean,
): void {
  const hw = (TILE_W / 2) * z;
  const hh = (TILE_H / 2) * z;
  const dim = online ? 1 : 0.45;

  // Right face
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - bHeight);
  ctx.lineTo(cx + hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = dimColor(rightFace, dim);
  ctx.fill();
  ctx.strokeStyle = dimColor('#000000', dim);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left face
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - bHeight);
  ctx.lineTo(cx - hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = dimColor(leftFace, dim);
  ctx.fill();
  ctx.strokeStyle = dimColor('#000000', dim);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Top face
  ctx.beginPath();
  ctx.moveTo(cx, cy - bHeight - hh);
  ctx.lineTo(cx + hw, cy - bHeight);
  ctx.lineTo(cx, cy - bHeight + hh);
  ctx.lineTo(cx - hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = dimColor(topFace, dim);
  ctx.fill();
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label
  ctx.fillStyle = online ? '#1a1a1a' : '#555';
  ctx.font = `${7 * z}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy - bHeight);
}

// ── HQ ───────────────────────────────────────────────────────────────

export function renderHq(
  ctx: CanvasRenderingContext2D,
  hq: HqPlacement,
  camera: Camera,
  assets: AssetStore,
): void {
  const centerTx = hq.tx + HQ_FOOTPRINT / 2;
  const centerTy = hq.ty + HQ_FOOTPRINT / 2;
  const scr = tileToScreen(centerTx, centerTy);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const assetKey = HQ_ASSET_KEYS[hq.faction];
  const sprite = assets.get(assetKey);
  const profile = SPRITE_PROFILES.hq_base;

  if (sprite) {
    const w = profile.size[0] * z;
    const h = profile.size[1] * z;
    const offY = profile.groundOffset * z;
    ctx.drawImage(sprite, cv.x - w / 2, cv.y - h / 2 - offY, w, h);
  } else {
    renderHqFallback(ctx, cv.x, cv.y, z);
  }
}

function renderHqFallback(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  z: number,
): void {
  const s = HQ_FOOTPRINT;
  const hw = (TILE_W / 2) * s * z;
  const hh = (TILE_H / 2) * s * z;
  const bHeight = 18 * z;

  // Right face
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - bHeight);
  ctx.lineTo(cx + hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = '#a07830';
  ctx.fill();
  ctx.strokeStyle = '#6b4e1a';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left face
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - bHeight);
  ctx.lineTo(cx - hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = '#8b6820';
  ctx.fill();
  ctx.strokeStyle = '#5a4015';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Top face
  ctx.beginPath();
  ctx.moveTo(cx, cy - bHeight - hh);
  ctx.lineTo(cx + hw, cy - bHeight);
  ctx.lineTo(cx, cy - bHeight + hh);
  ctx.lineTo(cx - hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = HQ_COLOR;
  ctx.fill();
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label
  ctx.fillStyle = '#3a2400';
  ctx.font = `${10 * z}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HQ', cx, cy - bHeight);
}

// ── Separator ────────────────────────────────────────────────────────

export function renderSeparator(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number,
  camera: Camera,
  active: boolean,
  progress: number,
  online: boolean,
): void {
  const scr = tileToScreen(tx + 0.5, ty + 0.5);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;

  const bHeight = 12 * z;
  drawIsoBox(ctx, cv.x, cv.y, z,
    '#3a6b8c', '#2c5570', active ? '#4a9ac2' : '#3a7a9a',
    bHeight, 'SEP', online);

  // Progress bar (only visible when progress > 0 and online)
  if (online && progress > 0) {
    const barW = 24 * z;
    const barH = 4 * z;
    const barX = cv.x - barW / 2;
    const barY = cv.y - bHeight - ((TILE_H / 2) * z) - 8 * z;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = active ? '#5ee89a' : '#888';
    ctx.fillRect(barX, barY, barW * Math.min(progress, 1), barH);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  // Offline indicator
  if (!online) {
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OFF', cv.x, cv.y - bHeight - 10 * z);
  }
}

// ── Storage ──────────────────────────────────────────────────────────

export function renderStorage(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number,
  camera: Camera,
  online: boolean,
): void {
  const scr = tileToScreen(tx + 0.5, ty + 0.5);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;

  drawIsoBox(ctx, cv.x, cv.y, z,
    '#6b5a3a', '#554828', '#8b7a50',
    10 * z, 'STO', online);

  if (!online) {
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OFF', cv.x, cv.y - 10 * z - 10 * z);
  }
}

// ── Power Plant ──────────────────────────────────────────────────────

export function renderPowerPlant(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number,
  camera: Camera,
  online: boolean,
): void {
  const scr = tileToScreen(tx + 0.5, ty + 0.5);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;

  // Power Plant is always online (immune), but keep consistent API
  drawIsoBox(ctx, cv.x, cv.y, z,
    '#5a8c3a', '#487028', online ? '#7ac24a' : '#5a9a3a',
    14 * z, 'PWR', online);

  // Lightning bolt indicator
  if (online) {
    ctx.fillStyle = '#ffff44';
    ctx.font = `bold ${9 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u26A1', cv.x, cv.y - 14 * z - 10 * z);
  }
}

// ── Command Relay ────────────────────────────────────────────────────

export function renderCommandRelay(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number,
  camera: Camera,
  online: boolean,
): void {
  const scr = tileToScreen(tx + 0.5, ty + 0.5);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;

  drawIsoBox(ctx, cv.x, cv.y, z,
    '#6a3a8c', '#552870', online ? '#8a4ac2' : '#6a3a9a',
    11 * z, 'CMD', online);

  if (!online) {
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OFF', cv.x, cv.y - 11 * z - 10 * z);
  }
}
