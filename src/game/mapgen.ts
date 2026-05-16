/** Procedural map generator. Pure function, deterministic with seed. */

import { getBuildingFootprint } from '../config/buildings.js';
import { HQ_FOOTPRINT, MAP_SIZE_STANDARD } from '../core/constants.js';
import type {
  MapData,
  FactionId,
  TerrainType,
  ResourceType,
  DecorType,
  BuildingPlacement,
  BuilderPlacement,
} from './map-types.js';

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMap(
  width: number = MAP_SIZE_STANDARD,
  height: number = MAP_SIZE_STANDARD,
  faction: FactionId = 'cyan',
  seed: number = 42,
): MapData {
  const rand = mulberry32(seed);
  const terrain = generateTerrain(width, height, rand);
  const occupied = createOccupiedSet(width, height);
  const hq = placeHq(width, height, faction, occupied);
  const buildings = placeBuildings(width, height, hq, occupied);
  const builders = placeBuildersNearHq(width, height, hq, occupied);
  const resources = placeResources(width, height, hq, rand, occupied);
  const decor = placeDecor(width, height, hq, rand, occupied);

  return {
    width,
    height,
    terrain,
    hq,
    resources,
    decor,
    buildings,
    builders,
    constructionSites: [],
  };
}

function generateTerrain(w: number, h: number, rand: () => number): TerrainType[][] {
  const grid: TerrainType[][] = [];
  for (let y = 0; y < h; y++) {
    const row: TerrainType[] = [];
    for (let x = 0; x < w; x++) {
      const r = rand();
      if (r < 0.15) row.push('sand-dark');
      else if (r < 0.30) row.push('sand-light');
      else row.push('sand');
    }
    grid.push(row);
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const neighbors: TerrainType[] = [grid[y - 1]![x]!, grid[y + 1]![x]!, grid[y]![x - 1]!, grid[y]![x + 1]!];
      const counts = new Map<TerrainType, number>();
      for (const n of neighbors) counts.set(n, (counts.get(n) ?? 0) + 1);
      for (const [type, count] of counts) {
        if (count >= 3 && type !== grid[y]![x]) {
          grid[y]![x] = type;
          break;
        }
      }
    }
  }

  return grid;
}

function createOccupiedSet(_w: number, _h: number): Set<string> {
  return new Set();
}

function markOccupied(occupied: Set<string>, tx: number, ty: number, size: number): void {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      occupied.add(`${tx + dx},${ty + dy}`);
    }
  }
}

function isAreaAvailable(
  width: number,
  height: number,
  occupied: ReadonlySet<string>,
  tx: number,
  ty: number,
  size: number,
): boolean {
  if (tx < 0 || ty < 0) return false;
  if (tx + size > width || ty + size > height) return false;

  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (occupied.has(`${tx + dx},${ty + dy}`)) return false;
    }
  }

  return true;
}

function placeHq(w: number, h: number, faction: FactionId, occupied: Set<string>): MapData['hq'] {
  const tx = Math.max(0, Math.min(w - HQ_FOOTPRINT, 4));
  const ty = Math.max(0, Math.min(h - HQ_FOOTPRINT, 4));
  markOccupied(occupied, tx, ty, HQ_FOOTPRINT);
  return { tx, ty, faction };
}

function placeBuildings(
  width: number,
  height: number,
  hq: MapData['hq'],
  occupied: Set<string>,
): BuildingPlacement[] {
  const buildings: BuildingPlacement[] = [
    { tx: hq.tx + HQ_FOOTPRINT, ty: hq.ty, type: 'separator' },
    { tx: hq.tx, ty: hq.ty + HQ_FOOTPRINT, type: 'storage' },
    { tx: hq.tx + HQ_FOOTPRINT, ty: hq.ty + HQ_FOOTPRINT, type: 'power-plant' },
    { tx: hq.tx, ty: hq.ty - getBuildingFootprint('command-relay'), type: 'command-relay' },
  ];

  for (const building of buildings) {
    const footprint = getBuildingFootprint(building.type);
    if (!isAreaAvailable(width, height, occupied, building.tx, building.ty, footprint)) {
      throw new Error(`Failed to place initial building: ${building.type}`);
    }
    markOccupied(occupied, building.tx, building.ty, footprint);
  }

  return buildings;
}

function placeBuildersNearHq(
  width: number,
  height: number,
  hq: MapData['hq'],
  occupied: Set<string>,
): BuilderPlacement[] {
  const candidates: Array<{ tx: number; ty: number }> = [];
  for (let ty = hq.ty - 1; ty <= hq.ty + HQ_FOOTPRINT; ty++) {
    for (let tx = hq.tx - 1; tx <= hq.tx + HQ_FOOTPRINT; tx++) {
      const onRing =
        tx === hq.tx - 1
        || tx === hq.tx + HQ_FOOTPRINT
        || ty === hq.ty - 1
        || ty === hq.ty + HQ_FOOTPRINT;
      if (!onRing) continue;
      candidates.push({ tx, ty });
    }
  }

  for (const candidate of candidates) {
    if (candidate.tx < 0 || candidate.ty < 0) continue;
    if (candidate.tx >= width || candidate.ty >= height) continue;
    if (occupied.has(`${candidate.tx},${candidate.ty}`)) continue;
    markOccupied(occupied, candidate.tx, candidate.ty, 1);
    return [{ ...candidate, busy: false }];
  }

  throw new Error('Failed to place Builder near HQ');
}

function placeResources(
  w: number,
  h: number,
  hq: MapData['hq'],
  rand: () => number,
  occupied: Set<string>,
): MapData['resources'] {
  const resources: MapData['resources'] = [];
  const hqCx = hq.tx + HQ_FOOTPRINT / 2;
  const hqCy = hq.ty + HQ_FOOTPRINT / 2;
  const center = w / 2;

  const placeNear = (type: ResourceType, minDist: number, maxDist: number, count: number) => {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < 200) {
      attempts++;
      const tx = Math.floor(rand() * w);
      const ty = Math.floor(rand() * h);
      const dist = Math.hypot(tx - hqCx, ty - hqCy);
      if (dist < minDist || dist > maxDist) continue;
      if (occupied.has(`${tx},${ty}`)) continue;
      occupied.add(`${tx},${ty}`);
      resources.push({ tx, ty, type });
      placed++;
    }
  };

  placeNear('small', 3, 8, 4);
  placeNear('medium', 8, 16, 3);
  placeNear('large', 14, 22, 2);

  let infPlaced = false;
  for (let attempts = 0; attempts < 100 && !infPlaced; attempts++) {
    const tx = Math.floor(center + (rand() - 0.5) * 4);
    const ty = Math.floor(center + (rand() - 0.5) * 4);
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
    if (occupied.has(`${tx},${ty}`)) continue;
    occupied.add(`${tx},${ty}`);
    resources.push({ tx, ty, type: 'infinite' });
    infPlaced = true;
  }

  return resources;
}

function placeDecor(
  w: number,
  h: number,
  hq: MapData['hq'],
  rand: () => number,
  occupied: Set<string>,
): MapData['decor'] {
  const decor: MapData['decor'] = [];
  const hqCx = hq.tx + HQ_FOOTPRINT / 2;
  const hqCy = hq.ty + HQ_FOOTPRINT / 2;

  const decorSpecs: Array<{ type: DecorType; count: number }> = [
    { type: 'mountain-small', count: 4 },
    { type: 'mountain-medium', count: 3 },
    { type: 'mountain-large', count: 2 },
    { type: 'volcano-small', count: 2 },
    { type: 'volcano-medium', count: 2 },
    { type: 'rock-cluster', count: 6 },
    { type: 'bush', count: 12 },
    { type: 'sand-bump', count: 12 },
  ];

  for (const spec of decorSpecs) {
    let placed = 0;
    let attempts = 0;
    while (placed < spec.count && attempts < 300) {
      attempts++;
      const tx = Math.floor(rand() * w);
      const ty = Math.floor(rand() * h);
      if (Math.hypot(tx - hqCx, ty - hqCy) < 5) continue;
      if (occupied.has(`${tx},${ty}`)) continue;
      occupied.add(`${tx},${ty}`);
      decor.push({ tx, ty, type: spec.type });
      placed++;
    }
  }

  return decor;
}
