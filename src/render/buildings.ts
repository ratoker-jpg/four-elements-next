/** Building rendering: faction HQ, Separator, Storage with sprite or geometric fallback. */

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

// ── HQ ───────────────────────────────────────────────────────────────

/** Render the faction HQ with sprite or isometric-box fallback. */
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

/** Render a Separator building with progress bar overlay. */
export function renderSeparator(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  camera: Camera,
  active: boolean,
  progress: number,
): void {
  const scr = tileToScreen(tx + 0.5, ty + 0.5);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  renderSeparatorFallback(ctx, cv.x, cv.y, z, active, progress);
}

function renderSeparatorFallback(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  z: number,
  active: boolean,
  progress: number,
): void {
  const hw = (TILE_W / 2) * z;
  const hh = (TILE_H / 2) * z;
  const bHeight = 12 * z;

  // Right face
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - bHeight);
  ctx.lineTo(cx + hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = '#3a6b8c';
  ctx.fill();
  ctx.strokeStyle = '#1e4a6a';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left face
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - bHeight);
  ctx.lineTo(cx - hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = '#2c5570';
  ctx.fill();
  ctx.strokeStyle = '#163d55';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Top face
  ctx.beginPath();
  ctx.moveTo(cx, cy - bHeight - hh);
  ctx.lineTo(cx + hw, cy - bHeight);
  ctx.lineTo(cx, cy - bHeight + hh);
  ctx.lineTo(cx - hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = active ? '#4a9ac2' : '#3a7a9a';
  ctx.fill();
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Progress bar (only visible when progress > 0)
  if (progress > 0) {
    const barW = 24 * z;
    const barH = 4 * z;
    const barX = cx - barW / 2;
    const barY = cy - bHeight - hh - 8 * z;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);

    // Fill
    ctx.fillStyle = active ? '#5ee89a' : '#888';
    ctx.fillRect(barX, barY, barW * Math.min(progress, 1), barH);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  // Label
  ctx.fillStyle = '#1a3a4a';
  ctx.font = `${7 * z}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SEP', cx, cy - bHeight);
}

// ── Storage ──────────────────────────────────────────────────────────

/** Render a Storage building. */
export function renderStorage(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  camera: Camera,
): void {
  const scr = tileToScreen(tx + 0.5, ty + 0.5);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  renderStorageFallback(ctx, cv.x, cv.y, z);
}

function renderStorageFallback(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  z: number,
): void {
  const hw = (TILE_W / 2) * z;
  const hh = (TILE_H / 2) * z;
  const bHeight = 10 * z;

  // Right face
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - bHeight);
  ctx.lineTo(cx + hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = '#6b5a3a';
  ctx.fill();
  ctx.strokeStyle = '#4a3d25';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left face
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - bHeight);
  ctx.lineTo(cx - hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = '#554828';
  ctx.fill();
  ctx.strokeStyle = '#3a3018';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Top face
  ctx.beginPath();
  ctx.moveTo(cx, cy - bHeight - hh);
  ctx.lineTo(cx + hw, cy - bHeight);
  ctx.lineTo(cx, cy - bHeight + hh);
  ctx.lineTo(cx - hw, cy - bHeight);
  ctx.closePath();
  ctx.fillStyle = '#8b7a50';
  ctx.fill();
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label
  ctx.fillStyle = '#2a1e0a';
  ctx.font = `${7 * z}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('STO', cx, cy - bHeight);
}
