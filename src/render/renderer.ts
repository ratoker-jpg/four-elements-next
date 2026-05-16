/** Render orchestrator. Delegates to terrain, environment, buildings. */

import { BG_COLOR, HQ_FOOTPRINT } from '../core/constants.js';
import type { MapData } from '../game/map-types.js';
import type { AssetStore } from '../core/assets.js';
import type { Camera } from './camera.js';
import { renderTerrain } from './terrain.js';
import { renderResourceNode, renderDecor } from './environment.js';
import { renderHq } from './buildings.js';

interface SortedEntity {
  sortKey: number;
  render: () => void;
}

/** Main render function. Orchestrates terrain + sorted entity rendering. */
export function render(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
  assets: AssetStore,
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvasW, canvasH);

  renderTerrain(ctx, map, camera, assets);

  // Painter's algorithm: sort by (tx+ty) ascending so back entities render first.
  // HQ uses the front-most tile of its footprint for correct depth ordering.
  const hqSortKey = map.hq.tx + map.hq.ty + (HQ_FOOTPRINT - 1) * 2;
  const entities: SortedEntity[] = [];
  entities.push({ sortKey: hqSortKey, render: () => renderHq(ctx, map.hq, camera, assets) });
  for (const r of map.resources) {
    entities.push({ sortKey: r.tx + r.ty, render: () => renderResourceNode(ctx, r, camera, assets) });
  }
  for (const d of map.decor) {
    entities.push({ sortKey: d.tx + d.ty, render: () => renderDecor(ctx, d, camera, assets) });
  }
  entities.sort((a, b) => a.sortKey - b.sortKey);

  for (const e of entities) {
    e.render();
  }
}
