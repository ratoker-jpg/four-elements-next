/** Environment rendering: resource nodes, obstacles, and decor. */

import { SPRITE_PROFILES } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { ResourcePlacement, ObstaclePlacement, DecorPlacement, ResourceType, ObstacleType } from '../game/map-types.js';
import { RESOURCE_ASSET_KEYS, OBSTACLE_ASSET_KEYS, DECOR_ASSET_KEYS } from '../game/map-types.js';
import type { AssetStore } from '../core/assets.js';
import type { Camera } from './camera.js';
import { containFit } from './contain-fit.js';

// ── Resource rendering ───────────────────────────────────────────────

/** Render a resource node with sprite or geometric fallback. */
export function renderResourceNode(
  ctx: CanvasRenderingContext2D,
  node: ResourcePlacement,
  camera: Camera,
  assets: AssetStore,
): void {
  const halfFp = node.footprint / 2;
  const scr = tileToScreen(node.tx + halfFp, node.ty + halfFp);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const assetKey = RESOURCE_ASSET_KEYS[node.type];
  const sprite = assets.get(assetKey);
  const profile = SPRITE_PROFILES[assetKey as keyof typeof SPRITE_PROFILES];

  if (sprite && profile) {
    const maxW = profile.size[0] * z;
    const maxH = profile.size[1] * z;
    const offY = profile.groundOffset * z;
    const { drawWidth: w, drawHeight: h } = containFit(
      sprite.naturalWidth, sprite.naturalHeight, maxW, maxH,
    );
    ctx.drawImage(sprite, cv.x - w / 2, cv.y - h / 2 - offY, w, h);
  } else {
    renderResourceFallback(ctx, node.type, cv.x, cv.y, z);
  }
}

// ── Obstacle rendering ───────────────────────────────────────────────

/** Render a blocking obstacle with sprite or geometric fallback. */
export function renderObstacle(
  ctx: CanvasRenderingContext2D,
  obstacle: ObstaclePlacement,
  camera: Camera,
  assets: AssetStore,
): void {
  const halfFp = obstacle.footprint / 2;
  const scr = tileToScreen(obstacle.tx + halfFp, obstacle.ty + halfFp);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const assetKey = OBSTACLE_ASSET_KEYS[obstacle.type];
  const sprite = assets.get(assetKey);
  const profile = SPRITE_PROFILES[assetKey as keyof typeof SPRITE_PROFILES];

  if (sprite && profile) {
    const maxW = profile.size[0] * z;
    const maxH = profile.size[1] * z;
    const offY = profile.groundOffset * z;
    const { drawWidth: w, drawHeight: h } = containFit(
      sprite.naturalWidth, sprite.naturalHeight, maxW, maxH,
    );
    ctx.drawImage(sprite, cv.x - w / 2, cv.y - h / 2 - offY, w, h);
  } else {
    renderObstacleFallback(ctx, obstacle.type, cv.x, cv.y, z);
  }
}

// ── Decor rendering ──────────────────────────────────────────────────

/** Render a non-blocking decor item with sprite or geometric fallback. */
export function renderDecor(
  ctx: CanvasRenderingContext2D,
  item: DecorPlacement,
  camera: Camera,
  assets: AssetStore,
): void {
  const scr = tileToScreen(item.tx + 0.5, item.ty + 0.5);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const assetKey = DECOR_ASSET_KEYS[item.type];
  const sprite = assets.get(assetKey);
  const profile = SPRITE_PROFILES[assetKey as keyof typeof SPRITE_PROFILES];

  if (sprite && profile) {
    const maxW = profile.size[0] * z;
    const maxH = profile.size[1] * z;
    const offY = profile.groundOffset * z;
    const { drawWidth: w, drawHeight: h } = containFit(
      sprite.naturalWidth, sprite.naturalHeight, maxW, maxH,
    );
    ctx.drawImage(sprite, cv.x - w / 2, cv.y - h / 2 - offY, w, h);
  } else {
    renderDecorFallback(ctx, cv.x, cv.y, z);
  }
}

// ── Fallback renderers ───────────────────────────────────────────────

function renderResourceFallback(
  ctx: CanvasRenderingContext2D,
  type: ResourceType,
  cx: number, cy: number,
  z: number,
): void {
  const radius = (type === 'infinite' ? 16 : type === 'large' ? 12 : type === 'medium' ? 10 : 8) * z;
  ctx.beginPath();
  ctx.arc(cx, cy - 8 * z, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#7de1ff';
  ctx.fill();
  ctx.strokeStyle = '#1a768c';
  ctx.lineWidth = 2 * z;
  ctx.stroke();
}

function renderObstacleFallback(
  ctx: CanvasRenderingContext2D,
  type: ObstacleType,
  cx: number, cy: number,
  z: number,
): void {
  const size = (type === 'mountain-large' ? 18 : type === 'mountain-medium' || type === 'volcano-medium' ? 14 : 10) * z;
  ctx.beginPath();
  // Draw a rough triangle/mountain shape
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx - size * 0.8, cy + size * 0.4);
  ctx.lineTo(cx + size * 0.8, cy + size * 0.4);
  ctx.closePath();
  ctx.fillStyle = type.includes('volcano') ? '#8b4513' : '#7a7a6a';
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5 * z;
  ctx.stroke();
}

function renderDecorFallback(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  z: number,
): void {
  const r = 6 * z;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#8a8a7a';
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1 * z;
  ctx.stroke();
}
