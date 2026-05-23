/** Terrain tile rendering with sprite support and geometric fallback. */

import { TILE_W, TILE_H, TERRAIN_COLORS, GRID_COLOR } from '../core/constants.js';
import { resolveTerrainAsset } from '../core/asset-variants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { MapData, TerrainType } from '../game/map-types.js';
import type { AssetStore } from '../core/assets.js';
import type { Camera } from './camera.js';

/** Render the full terrain grid with viewport culling. */
export function renderTerrain(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
  assets: AssetStore,
  visualSeed: number,
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const hw = (TILE_W / 2) * camera.zoom;
  const hh = (TILE_H / 2) * camera.zoom;
  const margin = Math.max(hw, hh) + 20;

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const scr = tileToScreen(tx + 0.5, ty + 0.5);
      const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);

      if (cv.x < -margin || cv.x > canvasW + margin) continue;
      if (cv.y < -margin || cv.y > canvasH + margin) continue;

      const terrainType: TerrainType = map.terrain[ty]?.[tx] ?? 'sand';
      const resolved = resolveTerrainAsset(terrainType, tx, ty, visualSeed);
      const assetKey = assets.get(resolved.preferredKey) ? resolved.preferredKey : resolved.fallbackKey;
      const sprite = assets.get(assetKey);

      if (sprite) {
        ctx.drawImage(sprite, cv.x - hw, cv.y - hh, hw * 2, hh * 2);
      } else {
        drawDiamond(ctx, cv.x, cv.y, hw, hh, TERRAIN_COLORS[terrainType] ?? TERRAIN_COLORS['sand']!, GRID_COLOR);
      }
    }
  }
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  hw: number, hh: number,
  fill: string, stroke: string,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}
