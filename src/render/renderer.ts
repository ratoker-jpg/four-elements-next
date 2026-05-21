/** Render orchestrator. Delegates to terrain, environment, buildings. */

import { getBuildingFootprint } from '../config/buildings.js';
import { BG_COLOR, HQ_FOOTPRINT, TILE_H, TILE_W } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
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
  shadow?: () => void;
  render: () => void;
}

type ShadowKind = 'builder' | 'harvester' | 'hq' | 'building' | 'construction' | 'resource' | 'obstacle';

interface ShadowProfile {
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly yOffsetTiles: number;
  readonly xOffsetTiles: number;
  readonly alpha: number;
}

const SHADOW_PROFILES: Record<ShadowKind, ShadowProfile> = {
  builder: { widthTiles: 0.32, heightTiles: 0.1, xOffsetTiles: -0.08, yOffsetTiles: -0.08, alpha: 0.11 },
  harvester: { widthTiles: 0.28, heightTiles: 0.09, xOffsetTiles: -0.07, yOffsetTiles: -0.07, alpha: 0.1 },
  hq: { widthTiles: 0.58, heightTiles: 0.3, xOffsetTiles: -0.08, yOffsetTiles: -0.05, alpha: 0.09 },
  building: { widthTiles: 0.5, heightTiles: 0.26, xOffsetTiles: -0.07, yOffsetTiles: -0.04, alpha: 0.08 },
  construction: { widthTiles: 0.5, heightTiles: 0.23, xOffsetTiles: -0.06, yOffsetTiles: -0.03, alpha: 0.08 },
  resource: { widthTiles: 0.3, heightTiles: 0.14, xOffsetTiles: -0.04, yOffsetTiles: -0.025, alpha: 0.045 },
  obstacle: { widthTiles: 0.46, heightTiles: 0.22, xOffsetTiles: -0.06, yOffsetTiles: -0.035, alpha: 0.075 },
};

function getFootprintSortKey(tx: number, ty: number, footprint: number): number {
  return tx + ty + (footprint - 1) * 2;
}

function renderGroundShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  footprint: number,
  kind: ShadowKind,
): void {
  const profile = SHADOW_PROFILES[kind];
  const radiusX = (TILE_W / 2) * profile.widthTiles * footprint * zoom;
  const radiusY = (TILE_H / 2) * profile.heightTiles * footprint * zoom;
  const x = cx + (TILE_W / 2) * profile.xOffsetTiles * footprint * zoom;
  const y = cy + (TILE_H / 2) * profile.yOffsetTiles * footprint * zoom;

  ctx.save();
  ctx.fillStyle = `rgba(18, 16, 14, ${profile.alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderTileShadow(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  tx: number,
  ty: number,
  footprint: number,
  kind: ShadowKind,
): void {
  const scr = tileToScreen(tx + footprint / 2, ty + footprint / 2);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  renderGroundShadow(ctx, cv.x, cv.y, camera.zoom, footprint, kind);
}

function renderUnitShadow(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  tx: number,
  ty: number,
  kind: 'builder' | 'harvester',
): void {
  const scr = tileToScreen(tx, ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  renderGroundShadow(ctx, cv.x, cv.y, camera.zoom, 1, kind);
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
    shadow: () => renderTileShadow(ctx, camera, map.hq.tx, map.hq.ty, HQ_FOOTPRINT, 'hq'),
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
        shadow: () => renderTileShadow(ctx, camera, b.tx, b.ty, footprint, 'building'),
        render: () => renderSeparator(ctx, b.tx, b.ty, camera, active, progress, online, assets, faction),
      });
    } else if (b.type === 'raw-storage') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        shadow: () => renderTileShadow(ctx, camera, b.tx, b.ty, footprint, 'building'),
        render: () => renderRawStorage(ctx, b.tx, b.ty, camera, online, assets, faction),
      });
    } else if (b.type === 'matter-storage') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        shadow: () => renderTileShadow(ctx, camera, b.tx, b.ty, footprint, 'building'),
        render: () => renderMatterStorage(ctx, b.tx, b.ty, camera, online, assets, faction),
      });
    } else if (b.type === 'power-plant') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        shadow: () => renderTileShadow(ctx, camera, b.tx, b.ty, footprint, 'building'),
        render: () => renderPowerPlant(ctx, b.tx, b.ty, camera, online, assets, faction),
      });
    } else if (b.type === 'command-relay') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        shadow: () => renderTileShadow(ctx, camera, b.tx, b.ty, footprint, 'building'),
        render: () => renderCommandRelay(ctx, b.tx, b.ty, camera, online, assets, faction),
      });
    } else if (b.type === 'units-factory') {
      entities.push({
        sortKey: getFootprintSortKey(b.tx, b.ty, footprint),
        shadow: () => renderTileShadow(ctx, camera, b.tx, b.ty, footprint, 'building'),
        render: () => renderUnitsFactory(ctx, b.tx, b.ty, camera, online, assets, faction),
      });
    }
  }

  for (const site of map.constructionSites) {
    const footprint = getBuildingFootprint(site.type);
    entities.push({
      sortKey: getFootprintSortKey(site.tx, site.ty, footprint),
      shadow: () => renderTileShadow(ctx, camera, site.tx, site.ty, footprint, 'construction'),
      render: () => renderConstructionSite(ctx, site, camera),
    });
  }

  for (const builder of map.builders) {
    const renderTx = (builder.phase === 'moving-to-site') ? builder.ftx : builder.tx + 0.5;
    const renderTy = (builder.phase === 'moving-to-site') ? builder.fty : builder.ty + 0.5;
    entities.push({
      sortKey: builder.tx + builder.ty,
      shadow: () => renderUnitShadow(ctx, camera, renderTx, renderTy, 'builder'),
      render: () => renderBuilder(ctx, builder, camera, assets, faction, ticks),
    });
  }

  for (let i = 0; i < harvesters.length; i++) {
    const harvester = harvesters[i]!;
    const prev = prevHarvesterPositions.get(i) ?? { tx: harvester.tx, ty: harvester.ty };
    entities.push({
      sortKey: harvester.tx + harvester.ty,
      shadow: () => renderUnitShadow(ctx, camera, harvester.tx, harvester.ty, 'harvester'),
      render: () => renderHarvester(ctx, harvester, camera, assets, faction, ticks, prev.tx, prev.ty),
    });
  }

  for (const r of map.resources) {
    entities.push({
      sortKey: r.tx + r.ty + (r.footprint - 1) * 2,
      shadow: () => renderTileShadow(ctx, camera, r.tx, r.ty, r.footprint, 'resource'),
      render: () => renderResourceNode(ctx, r, camera, assets),
    });
  }
  for (const o of map.obstacles) {
    entities.push({
      sortKey: o.tx + o.ty + (o.footprint - 1) * 2,
      shadow: () => renderTileShadow(ctx, camera, o.tx, o.ty, o.footprint, 'obstacle'),
      render: () => renderObstacle(ctx, o, camera, assets),
    });
  }
  for (const d of map.decor) {
    entities.push({ sortKey: d.tx + d.ty, render: () => renderDecor(ctx, d, camera, assets) });
  }

  entities.sort((a, b) => a.sortKey - b.sortKey);

  for (const e of entities) {
    e.shadow?.();
  }

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
      assets,
      faction,
    };
    renderDevOverlays(ctx, map, camera, territory, resourceNodes ?? [], spriteDebugData);
  }
}
