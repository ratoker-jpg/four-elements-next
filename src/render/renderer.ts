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
  renderRawStorage,
  renderMatterStorage,
  renderPowerPlant,
  renderCommandRelay,
  renderUnitsFactory,
  renderBuilder,
  renderConstructionSite,
  renderHarvester,
} from './buildings.js';
import type { Camera } from './camera.js';
import { renderResourceNode, renderObstacle, renderDecor } from './environment.js';
import { renderTerrain } from './terrain.js';
import { renderTerritory } from './territory.js';
import type { TerritoryState } from '../systems/territory.js';
import type { HarvesterState, ResourceNodeState } from '../systems/harvesting.js';
import { isAssetPreviewEnabled, drawAssetPreview } from '../dev/asset-preview.js';
import { renderDevOverlays, anyOverlayEnabled, type SpriteDebugData } from '../dev/dev-overlays.js';

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
  harvesters: readonly HarvesterState[],
  ticks: number,
  prevHarvesterPositions: ReadonlyMap<number, { tx: number; ty: number }>,
  territory: TerritoryState,
  resourceNodes?: readonly ResourceNodeState[],
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvasW, canvasH);

  renderTerrain(ctx, map, camera, assets);

  // Territory overlay: after terrain, before entities
  renderTerritory(ctx, territory, camera);

  const entities: SortedEntity[] = [];
  entities.push({
    sortKey: getFootprintSortKey(map.hq.tx, map.hq.ty, HQ_FOOTPRINT),
    render: () => renderHq(ctx, map.hq, camera, assets),
  });

  const faction = map.hq.faction;

  for (const b of map.buildings) {
    const online = isBuildingOnline(power, b.tx, b.ty);
    const footprint = getBuildingFootprint(b.type);
    if (b.type === 'separator') {
      const sepState = economy.separators.find((s) => s.tx === b.tx && s.ty === b.ty);
      const active = online && (sepState?.active ?? false);
      const progress = sepState?.progress ?? 0;
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        render: () => renderSeparator(ctx, b.tx, b.ty, camera, active, progress, online, assets, faction),
      });
    } else if (b.type === 'raw-storage') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        render: () => renderRawStorage(ctx, b.tx, b.ty, camera, online, assets, faction),
      });
    } else if (b.type === 'matter-storage') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        render: () => renderMatterStorage(ctx, b.tx, b.ty, camera, online, assets, faction),
      });
    } else if (b.type === 'power-plant') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        render: () => renderPowerPlant(ctx, b.tx, b.ty, camera, online, assets, faction),
      });
    } else if (b.type === 'command-relay') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        render: () => renderCommandRelay(ctx, b.tx, b.ty, camera, online, assets, faction),
      });
    } else if (b.type === 'units-factory') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        render: () => renderUnitsFactory(ctx, b.tx, b.ty, camera, online, assets, faction),
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
      render: () => renderBuilder(ctx, builder, camera, assets, faction, ticks),
    });
  }

  for (let i = 0; i < harvesters.length; i++) {
    const harvester = harvesters[i]!;
    const prev = prevHarvesterPositions.get(i) ?? { tx: harvester.tx, ty: harvester.ty };
    entities.push({
      sortKey: harvester.tx + harvester.ty,
      render: () => renderHarvester(ctx, harvester, camera, assets, faction, ticks, prev.tx, prev.ty),
    });
  }

  for (const r of map.resources) {
    entities.push({ sortKey: r.tx + r.ty + (r.footprint - 1) * 2, render: () => renderResourceNode(ctx, r, camera, assets) });
  }
  for (const o of map.obstacles) {
    entities.push({ sortKey: o.tx + o.ty + (o.footprint - 1) * 2, render: () => renderObstacle(ctx, o, camera, assets) });
  }
  for (const d of map.decor) {
    entities.push({ sortKey: d.tx + d.ty, render: () => renderDecor(ctx, d, camera, assets) });
  }

  entities.sort((a, b) => a.sortKey - b.sortKey);

  for (const e of entities) {
    e.render();
  }

  // ASSET-PREVIEW-01: debug-only candidate preview overlay (zero effect when disabled)
  if (isAssetPreviewEnabled()) {
    drawAssetPreview(ctx, camera, canvasW, canvasH, map.hq.tx, map.hq.ty);
  }

  // DEV-SANDBOX-ARCH-01 PR2: debug overlays (zero effect when all toggled off)
  if (anyOverlayEnabled()) {
    const spriteDebugData: SpriteDebugData = {
      harvesters: harvesters.map((h, i) => ({
        state: h,
        prevTx: prevHarvesterPositions.get(i)?.tx ?? h.tx,
        prevTy: prevHarvesterPositions.get(i)?.ty ?? h.ty,
      })),
    };
    renderDevOverlays(ctx, map, camera, territory, resourceNodes ?? [], spriteDebugData);
  }
}
