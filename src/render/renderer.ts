/** Render orchestrator. Delegates to terrain, environment, buildings. */

import { getBuildingFootprint } from '../config/buildings.js';
import { BG_COLOR, HQ_FOOTPRINT } from '../core/constants.js';
import type { AssetStore } from '../core/assets.js';
import type { MapData } from '../game/map-types.js';
import type { ReadonlyEconomyState } from '../systems/economy.js';
import { isBuildingOnline } from '../systems/power.js';
import type { ReadonlyPowerState } from '../systems/power.js';
import {
  renderHq,
  renderSeparator,
  renderStorage,
  renderPowerPlant,
  renderCommandRelay,
  renderBuilder,
  renderConstructionSite,
} from './buildings.js';
import type { Camera } from './camera.js';
import { renderResourceNode, renderDecor } from './environment.js';
import { renderTerrain } from './terrain.js';

interface SortedEntity {
  sortKey: number;
  render: () => void;
}

function getFootprintSortKey(tx: number, ty: number, footprint: number): number {
  return tx + ty + (footprint - 1) * 2;
}

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

  const entities: SortedEntity[] = [];
  entities.push({
    sortKey: getFootprintSortKey(map.hq.tx, map.hq.ty, HQ_FOOTPRINT),
    render: () => renderHq(ctx, map.hq, camera, assets),
  });

  for (const b of map.buildings) {
    const online = isBuildingOnline(power, b.tx, b.ty);
    const footprint = getBuildingFootprint(b.type);
    if (b.type === 'separator') {
      const sepState = economy.separators.find((s) => s.tx === b.tx && s.ty === b.ty);
      const active = online && (sepState?.active ?? false);
      const progress = sepState?.progress ?? 0;
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        render: () => renderSeparator(ctx, b.tx, b.ty, camera, active, progress, online),
      });
    } else if (b.type === 'storage') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        render: () => renderStorage(ctx, b.tx, b.ty, camera, online),
      });
    } else if (b.type === 'power-plant') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        render: () => renderPowerPlant(ctx, b.tx, b.ty, camera, online),
      });
    } else if (b.type === 'command-relay') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        render: () => renderCommandRelay(ctx, b.tx, b.ty, camera, online),
      });
    }
  }

  for (const site of map.constructionSites) {
    entities.push({
      sortKey: getFootprintSortKey(site.tx, site.ty, getBuildingFootprint(site.type)),
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
