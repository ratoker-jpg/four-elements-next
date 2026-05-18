/**
 * Building render debug overlay — toggleable with F3.
 *
 * When enabled, draws diagnostic rectangles and text labels
 * for each building sprite render. Zero effect when disabled.
 */

import { TILE_W, TILE_H, SPRITE_PROFILES, HQ_FOOTPRINT } from '../core/constants.js';
import type { AssetMeta } from '../core/assets.js';

// ── Toggle state ──────────────────────────────────────────────────────

let _enabled = false;

/** Returns whether the debug overlay is currently active. */
export function isDebugOverlayEnabled(): boolean {
  return _enabled;
}

/** Toggle the debug overlay on/off. */
export function toggleDebugOverlay(): void {
  _enabled = !_enabled;
}

// ── Overlay drawing ───────────────────────────────────────────────────

export interface DebugOverlayInfo {
  assetKey: string;
  profileKey: keyof typeof SPRITE_PROFILES;
  sprite: HTMLImageElement;
  meta: AssetMeta | null;
  cx: number;
  cy: number;
  zoom: number;
  footprint: number;
  /** If true, this is an HQ render (uses HQ_FOOTPRINT instead of footprint param). */
  isHq?: boolean;
}

/**
 * Draw the debug overlay for a single building sprite render.
 * Call only when `isDebugOverlayEnabled()` is true.
 */
export function drawBuildingDebugOverlay(
  ctx: CanvasRenderingContext2D,
  info: DebugOverlayInfo,
): void {
  const { assetKey, profileKey, sprite, meta, cx, cy, zoom, footprint, isHq } = info;
  const effectiveFootprint = isHq ? HQ_FOOTPRINT : footprint;
  const baseY = cy + (TILE_H / 2) * effectiveFootprint * zoom;
  const profile = SPRITE_PROFILES[profileKey];

  // Full-canvas destination rect (what would be drawn without alpha crop)
  const maxW = profile.size[0] * zoom;
  const maxH = profile.size[1] * zoom;
  const offY = profile.groundOffset * zoom;
  const canvasAspect = sprite.naturalWidth / sprite.naturalHeight;
  const boxAspect = maxW / maxH;
  let fullW: number, fullH: number;
  if (canvasAspect > boxAspect) {
    fullW = maxW;
    fullH = maxW / canvasAspect;
  } else {
    fullH = maxH;
    fullW = maxH * canvasAspect;
  }
  const fullX = cx - fullW / 2;
  const fullY = baseY - fullH - offY;

  // Visible destination rect (alpha-bounds crop mapped into full rect)
  let visX = fullX, visY = fullY, visW = fullW, visH = fullH;
  let visibleAspect = fullW / fullH;
  if (meta && meta.naturalW > 0 && meta.naturalH > 0) {
    visX = fullX + (meta.visibleX / meta.naturalW) * fullW;
    visY = fullY + (meta.visibleY / meta.naturalH) * fullH;
    visW = (meta.visibleW / meta.naturalW) * fullW;
    visH = (meta.visibleH / meta.naturalH) * fullH;
    visibleAspect = visW / visH;
  }

  // Footprint diamond
  const hw = (TILE_W / 2) * effectiveFootprint * zoom;
  const hh = (TILE_H / 2) * effectiveFootprint * zoom;

  ctx.save();

  // Full rect — red dashed
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(fullX, fullY, fullW, fullH);

  // Visible rect — green solid
  if (meta) {
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(visX, visY, visW, visH);
  }

  // Footprint diamond — cyan
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.8)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.stroke();

  // Anchor/baseY point — yellow dot
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(cx, baseY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Text label panel
  const fontSize = Math.max(9, 10 * zoom);
  ctx.font = `${fontSize}px "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const canvas = ctx.canvas;
  const lines: string[] = [
    assetKey,
    `natural: ${sprite.naturalWidth}x${sprite.naturalHeight}`,
    meta
      ? `alpha: (${meta.visibleX},${meta.visibleY}) ${meta.visibleW}x${meta.visibleH}`
      : 'alpha: N/A',
    `profile: [${profile.size[0]},${profile.size[1]}] off=${profile.groundOffset}`,
    `full rect: [${fullX.toFixed(1)},${fullY.toFixed(1)} ${fullW.toFixed(1)}x${fullH.toFixed(1)}]`,
    meta
      ? `vis rect: [${visX.toFixed(1)},${visY.toFixed(1)} ${visW.toFixed(1)}x${visH.toFixed(1)}]`
      : 'vis rect: = full',
    `vis aspect: ${visibleAspect.toFixed(4)}`,
    `zoom: ${zoom.toFixed(3)}`,
    `DPR: ${dpr}`,
    `canvas: ${canvas.width}x${canvas.height}`,
    `CSS: ${canvas.clientWidth}x${canvas.clientHeight}`,
    `rect: ${canvas.getBoundingClientRect().width.toFixed(1)}x${canvas.getBoundingClientRect().height.toFixed(1)}`,
    `smoothing: ${ctx.imageSmoothingEnabled}`,
  ];

  const lineH = fontSize + 2;
  const padX = 4;
  const padY = 3;
  const panelX = fullX + fullW + 4;
  const panelY = fullY;
  const panelW = 260;
  const panelH = lines.length * lineH + padY * 2;

  // Semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  // Text lines
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, panelX + padX, panelY + padY + i * lineH);
  }

  ctx.restore();
}
