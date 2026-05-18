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
  // Find first available (non-busy) builder
  let builderIndex = -1;
  for (let i = 0; i < map.builders.length; i++) {
    if (!map.builders[i]!.busy) {
      builderIndex = i;
      break;
    }
  }

  if (builderIndex < 0) {
    // No builders exist or all are busy
    if (map.builders.length === 0) {
      return { ok: false, reason: 'no-placement', buildingType };
    }
    return { ok: false, reason: 'busy', buildingType };
  }

  const builder = map.builders[builderIndex]!;

  const definition = BUILDING_DEFINITIONS[buildingType];
  if (economy.resources.matter < definition.costMatter) {
    return { ok: false, reason: 'insufficient-matter', buildingType };
  }

  const placement = findAutoPlacement(map, builder, buildingType);
  if (!placement) {
    return { ok: false, reason: 'no-placement', buildingType };
  }

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
        if (!isFootprintBuildable(map, occupied, tx, ty, footprint)) continue;
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
    occupied.add(`${resource.tx},${resource.ty}`);
  }
  for (const decor of map.decor) {
    occupied.add(`${decor.tx},${decor.ty}`);
  }
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

function markFootprintOccupied(occupied: Set<string>, tx: number, ty: number, footprint: number): void {
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      occupied.add(`${tx + dx},${ty + dy}`);
    }
  }
}
