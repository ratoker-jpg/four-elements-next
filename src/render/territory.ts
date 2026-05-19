/** Territory overlay rendering. Draws semi-transparent faction-colored tile overlays. */

import { TILE_W, TILE_H, TERRITORY_FACTION_COLORS } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { TerritoryState, TerritoryTile } from '../systems/territory.js';
import type { Camera } from './camera.js';

/**
 * Render territory overlay after terrain, before entities.
 * Each claimed tile gets a semi-transparent faction-colored diamond overlay.
 * Progress affects opacity: filling tiles are dimmer, fully claimed tiles are brighter.
 */
export function renderTerritory(
  ctx: CanvasRenderingContext2D,
  territory: TerritoryState,
  camera: Camera,
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const hw = (TILE_W / 2) * camera.zoom;
  const hh = (TILE_H / 2) * camera.zoom;
  const margin = Math.max(hw, hh) + 20;

  for (let ty = 0; ty < territory.height; ty++) {
    for (let tx = 0; tx < territory.width; tx++) {
      const tile: TerritoryTile | undefined = territory.tiles[ty * territory.width + tx];
      if (!tile || tile.progress <= 0 || tile.owner === null) continue;

      const scr = tileToScreen(tx + 0.5, ty + 0.5);
      const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);

      if (cv.x < -margin || cv.x > canvasW + margin) continue;
      if (cv.y < -margin || cv.y > canvasH + margin) continue;

      const color = TERRITORY_FACTION_COLORS[tile.owner];
      if (!color) continue;

      // Opacity scales with progress: 0.15 at start → 0.35 when fully claimed
      const alpha = 0.15 + tile.progress * 0.2;
      drawTerritoryDiamond(ctx, cv.x, cv.y, hw, hh, color, alpha);
    }
  }
}

function drawTerritoryDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  color: string,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
