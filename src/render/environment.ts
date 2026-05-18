/** Environment rendering: resource nodes and decor. */

import { SPRITE_PROFILES } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { ResourcePlacement, DecorPlacement, ResourceType } from '../game/map-types.js';
import { RESOURCE_ASSET_KEYS, DECOR_ASSET_KEYS } from '../game/map-types.js';
import type { AssetStore } from '../core/assets.js';
import type { Camera } from './camera.js';
import { containFit } from './contain-fit.js';

/** Render a resource node with sprite or geometric fallback. */
export function renderResourceNode(
  ctx: CanvasRenderingContext2D,
  node: ResourcePlacement,
  camera: Camera,
  assets: AssetStore,
): void {
  const scr = tileToScreen(node.tx + 0.5, node.ty + 0.5);
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

/** Render a decor item with sprite or geometric fallback. */
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
