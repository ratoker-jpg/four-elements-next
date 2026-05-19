import { HQ_FOOTPRINT } from '../core/constants.js';
import { BUILDING_DEFINITIONS, getBuildingFootprint } from '../config/buildings.js';
import type {
  BuildingPlacement,
  BuildingType,
  BuilderPlacement,
  ConstructionSitePlacement,
  MapData,
} from '../game/map-types.js';
import type { EconomyState } from './economy.js';

export const BUILDER_CONTROL_COST = 1;
export const AUTO_BUILD_MAX_RADIUS = 15;

export type ConstructionFailureReason = 'busy' | 'insufficient-matter' | 'no-placement';

export interface ConstructionCommandResult {
  ok: boolean;
  reason?: ConstructionFailureReason;
  buildingType: BuildingType;
  site?: ConstructionSitePlacement;
}

export interface ConstructionTickResult {
  completedBuildings: BuildingPlacement[];
}

export function startConstruction(
  map: MapData,
  economy: EconomyState,
  buildingType: BuildingType,
): ConstructionCommandResult {
  // No builders at all → no-placement
  if (map.builders.length === 0) {
    return { ok: false, reason: 'no-placement', buildingType };
  }

  // Collect idle (non-busy) builder indices
  const idleIndices: number[] = [];
  for (let i = 0; i < map.builders.length; i++) {
    if (!map.builders[i]!.busy) {
      idleIndices.push(i);
    }
  }

  // All builders busy → busy
  if (idleIndices.length === 0) {
    return { ok: false, reason: 'busy', buildingType };
  }

  const definition = BUILDING_DEFINITIONS[buildingType];
  if (economy.resources.matter < definition.costMatter) {
    return { ok: false, reason: 'insufficient-matter', buildingType };
  }

  // Try each idle builder for auto-placement; use the first that succeeds
  for (const builderIndex of idleIndices) {
    const builder = map.builders[builderIndex]!;
    const placement = findAutoPlacement(map, builder, buildingType);
    if (placement) {
      economy.resources.matter -= definition.costMatter;
      builder.busy = true;

      const site: ConstructionSitePlacement = {
        tx: placement.tx,
        ty: placement.ty,
        type: buildingType,
        elapsed: 0,
        duration: definition.buildTimeSeconds,
        progress: 0,
        builderIndex,
      };
      map.constructionSites.push(site);

      return { ok: true, buildingType, site };
    }
  }

  // Idle builders exist but none can place the building
  return { ok: false, reason: 'no-placement', buildingType };
}

export function tickConstruction(map: MapData, dt: number): ConstructionTickResult {
  const completedBuildings: BuildingPlacement[] = [];

  for (let index = map.constructionSites.length - 1; index >= 0; index--) {
    const site = map.constructionSites[index]!;
    site.elapsed += dt;
    site.progress = Math.min(site.elapsed / site.duration, 1);

    if (site.elapsed < site.duration) continue;

    const building: BuildingPlacement = {
      tx: site.tx,
      ty: site.ty,
      type: site.type,
    };
    map.buildings.push(building);
    completedBuildings.push(building);

    // Free only the builder assigned to this completed site
    const assignedBuilder = map.builders[site.builderIndex];
    if (assignedBuilder) {
      assignedBuilder.busy = false;
    }

    map.constructionSites.splice(index, 1);
  }

  return { completedBuildings };
}

export function canAffordBuilding(economy: EconomyState, buildingType: BuildingType): boolean {
  return economy.resources.matter >= BUILDING_DEFINITIONS[buildingType].costMatter;
}

export function findAutoPlacement(
  map: MapData,
  builder: BuilderPlacement,
  buildingType: BuildingType,
  maxRadius: number = AUTO_BUILD_MAX_RADIUS,
): { tx: number; ty: number } | null {
  const occupied = buildOccupiedTileSet(map);
  const footprint = getBuildingFootprint(buildingType);

  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let ty = builder.ty - radius; ty <= builder.ty + radius; ty++) {
      for (let tx = builder.tx - radius; tx <= builder.tx + radius; tx++) {
        const onRing = Math.max(Math.abs(tx - builder.tx), Math.abs(ty - builder.ty)) === radius;
        if (!onRing) continue;
        if (!isFootprintWithSpacingBuildable(map, occupied, tx, ty, footprint)) continue;
        return { tx, ty };
      }
    }
  }

  return null;
}

export function buildOccupiedTileSet(map: MapData): Set<string> {
  const occupied = new Set<string>();

  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      occupied.add(`${map.hq.tx + dx},${map.hq.ty + dy}`);
    }
  }

  for (const building of map.buildings) {
    markFootprintOccupied(occupied, building.tx, building.ty, getBuildingFootprint(building.type));
  }
  for (const site of map.constructionSites) {
    markFootprintOccupied(occupied, site.tx, site.ty, getBuildingFootprint(site.type));
  }
  for (const resource of map.resources) {
    markFootprintOccupied(occupied, resource.tx, resource.ty, resource.footprint);
  }
  // Obstacle footprints block building placement
  for (const obstacle of map.obstacles) {
    markFootprintOccupied(occupied, obstacle.tx, obstacle.ty, obstacle.footprint);
  }
  // Decor is non-blocking (bush, sand-bump) — does NOT block building placement
  for (const builder of map.builders) {
    occupied.add(`${builder.tx},${builder.ty}`);
  }

  return occupied;
}

export function isFootprintBuildable(
  map: MapData,
  occupied: ReadonlySet<string>,
  tx: number,
  ty: number,
  footprint: number,
): boolean {
  if (tx < 0 || ty < 0) return false;
  if (tx + footprint > map.width || ty + footprint > map.height) return false;

  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      if (occupied.has(`${tx + dx},${ty + dy}`)) return false;
    }
  }

  return true;
}

/**
 * Build a set of tiles occupied by structures that reserve building spacing:
 * HQ footprint, completed building footprints, and construction site footprints.
 * Resources and builders are NOT included — they block the footprint
 * itself (via buildOccupiedTileSet) but do not reserve spacing perimeter.
 * Decor is entirely non-blocking and is not included in either set.
 */
export function buildBuildingTileSet(map: MapData): Set<string> {
  const tiles = new Set<string>();

  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      tiles.add(`${map.hq.tx + dx},${map.hq.ty + dy}`);
    }
  }

  for (const building of map.buildings) {
    markFootprintOccupied(tiles, building.tx, building.ty, getBuildingFootprint(building.type));
  }
  for (const site of map.constructionSites) {
    markFootprintOccupied(tiles, site.tx, site.ty, getBuildingFootprint(site.type));
  }

  return tiles;
}

/**
 * Check whether a building of the given footprint can be placed at (tx, ty)
 * with a spacing buffer around it.
 *
 * Rules:
 * 1. The actual footprint must be inside map bounds.
 * 2. No footprint tile may be in the `occupied` set (all objects block the footprint).
 * 3. The expanded perimeter rectangle (tx-spacing .. tx+footprint+spacing-1,
 *    ty-spacing .. ty+footprint+spacing-1) must not overlap any tile from
 *    `buildBuildingTileSet` (HQ, completed buildings, construction sites).
 *    Out-of-bounds perimeter cells are silently ignored.
 *    Resources and builders do NOT block the spacing perimeter.
 *    Decor is non-blocking and does not appear in the occupied set at all.
 */
export function isFootprintWithSpacingBuildable(
  map: MapData,
  occupied: ReadonlySet<string>,
  tx: number,
  ty: number,
  footprint: number,
  spacing: number = 1,
): boolean {
  // 1. Footprint inside map bounds
  if (tx < 0 || ty < 0) return false;
  if (tx + footprint > map.width || ty + footprint > map.height) return false;

  // 2. No footprint tile may be occupied (any object blocks the footprint)
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      if (occupied.has(`${tx + dx},${ty + dy}`)) return false;
    }
  }

  // 3. Spacing perimeter — only HQ/buildings/construction-sites matter
  const buildingTiles = buildBuildingTileSet(map);
  const perimMinX = tx - spacing;
  const perimMinY = ty - spacing;
  const perimMaxX = tx + footprint + spacing - 1;
  const perimMaxY = ty + footprint + spacing - 1;

  for (let py = perimMinY; py <= perimMaxY; py++) {
    for (let px = perimMinX; px <= perimMaxX; px++) {
      // Ignore out-of-bounds perimeter cells
      if (px < 0 || py < 0 || px >= map.width || py >= map.height) continue;
      // Skip tiles inside the actual footprint (already validated in step 2)
      if (px >= tx && px < tx + footprint && py >= ty && py < ty + footprint) continue;
      // Reject if this perimeter cell overlaps a building-type tile
      if (buildingTiles.has(`${px},${py}`)) return false;
    }
  }

  return true;
}

function markFootprintOccupied(occupied: Set<string>, tx: number, ty: number, footprint: number): void {
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      occupied.add(`${tx + dx},${ty + dy}`);
    }
  }
}
