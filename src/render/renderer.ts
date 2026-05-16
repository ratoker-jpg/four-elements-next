/** Render orchestrator. Delegates to terrain, environment, buildings. */

import { BG_COLOR } from '../core/constants.js';
import type { MapData } from '../game/map-types.js';
import type { AssetStore } from '../core/assets.js';
import type { Camera } from './camera.js';
import { renderTerrain } from './terrain.js';
import { renderResourceNode, renderDecor } from './environment.js';
import { renderHq } from './buildings.js';

interface SortedEntity {
  sortKey: number;
  kind: 'hq' | 'resource' | 'decor';
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

  const entities: SortedEntity[] = [];
  entities.push({ sortKey: (map.hq.tx + map.hq.ty) * 10, kind: 'hq' });
  for (const r of map.resources) entities.push({ sortKey: (r.tx + r.ty) * 10, kind: 'resource' });
  for (const d of map.decor) entities.push({ sortKey: (d.tx + d.ty) * 10, kind: 'decor' });
  entities.sort((a, b) => a.sortKey - b.sortKey);

  let resIndex = 0;
  let decIndex = 0;
  for (const e of entities) {
    if (e.kind === 'hq') { renderHq(ctx, map.hq, camera, assets); }
    else if (e.kind === 'resource') { renderResourceNode(ctx, map.resources[resIndex++]!, camera, assets); }
    else if (e.kind === 'decor') { renderDecor(ctx, map.decor[decIndex++]!, camera, assets); }
  }
}
