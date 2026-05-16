/** Render orchestrator. Delegates to terrain, environment, buildings. */

import { BG_COLOR, HQ_FOOTPRINT } from '../core/constants.js';
import type { MapData } from '../game/map-types.js';
import type { AssetStore } from '../core/assets.js';
import type { Camera } from './camera.js';
import type { ReadonlyEconomyState } from '../systems/economy.js';
import type { ReadonlyPowerState } from '../systems/power.js';
import { isBuildingOnline } from '../systems/power.js';
import { renderTerrain } from './terrain.js';
import { renderResourceNode, renderDecor } from './environment.js';
import {
  renderHq,
  renderSeparator,
  renderStorage,
  renderPowerPlant,
  renderCommandRelay,
  renderBuilder,
  renderConstructionSite,
} from './buildings.js';

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
  economy: ReadonlyEconomyState,
  power: ReadonlyPowerState,
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

  // Buildings — 1×1 footprint
  for (const b of map.buildings) {
    const online = isBuildingOnline(power, b.tx, b.ty);
    if (b.type === 'separator') {
      const sepState = economy.separators.find((s) => s.tx === b.tx && s.ty === b.ty);
      const active = online && (sepState?.active ?? false);
      const progress = sepState?.progress ?? 0;
      entities.push({
        sortKey: b.tx + b.ty,
        render: () => renderSeparator(ctx, b.tx, b.ty, camera, active, progress, online),
      });
    } else if (b.type === 'storage') {
      entities.push({
        sortKey: b.tx + b.ty,
        render: () => renderStorage(ctx, b.tx, b.ty, camera, online),
      });
    } else if (b.type === 'power-plant') {
      entities.push({
        sortKey: b.tx + b.ty,
        render: () => renderPowerPlant(ctx, b.tx, b.ty, camera, online),
      });
    } else if (b.type === 'command-relay') {
      entities.push({
        sortKey: b.tx + b.ty,
        render: () => renderCommandRelay(ctx, b.tx, b.ty, camera, online),
      });
    }
  }

  for (const site of map.constructionSites) {
    entities.push({
      sortKey: site.tx + site.ty,
      render: () => renderConstructionSite(ctx, site, camera),
    });
  }

  for (const builder of map.builders) {
    entities.push({
      sortKey: builder.tx + builder.ty,
      render: () => renderBuilder(ctx, builder, camera),
    });
  }

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
