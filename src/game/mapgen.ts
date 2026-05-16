/** Procedural map generator. Pure function, deterministic with seed. */

import { HQ_FOOTPRINT, MAP_SIZE_STANDARD } from '../core/constants.js';
import type { MapData, FactionId, TerrainType, ResourceType, DecorType, BuildingPlacement } from './map-types.js';

// Simple deterministic PRNG (mulberry32)
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
  const buildings = placeBuildings(hq, occupied);
  const resources = placeResources(width, height, hq, rand, occupied);
  const decor = placeDecor(width, height, hq, rand, occupied);

  return { width, height, terrain, hq, resources, decor, buildings };
}

function generateTerrain(w: number, h: number, rand: () => number): TerrainType[][] {
  // Phase 1: random assignment
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

  // Phase 2: one smoothing pass — if 3+ of 4 neighbors are same variant, switch
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

function placeHq(w: number, h: number, faction: FactionId, occupied: Set<string>): MapData['hq'] {
  const tx = Math.max(0, Math.min(w - HQ_FOOTPRINT, 4));
  const ty = Math.max(0, Math.min(h - HQ_FOOTPRINT, 4));
  markOccupied(occupied, tx, ty, HQ_FOOTPRINT);
  return { tx, ty, faction };
}

/** Pre-place one Separator, one Storage, one Power Plant, one Command Relay adjacent to HQ. */
function placeBuildings(hq: MapData['hq'], occupied: Set<string>): BuildingPlacement[] {
  const buildings: BuildingPlacement[] = [];

  // Separator: just east of HQ (1×1 footprint)
  const sepTx = hq.tx + HQ_FOOTPRINT;
  const sepTy = hq.ty;
  markOccupied(occupied, sepTx, sepTy, 1);
  buildings.push({ tx: sepTx, ty: sepTy, type: 'separator' });

  // Storage: south of Separator (1×1 footprint)
  const stoTx = sepTx;
  const stoTy = sepTy + 1;
  markOccupied(occupied, stoTx, stoTy, 1);
  buildings.push({ tx: stoTx, ty: stoTy, type: 'storage' });

  // Power Plant: south of HQ (1×1 footprint)
  const ppTx = hq.tx + 1;
  const ppTy = hq.ty + HQ_FOOTPRINT;
  markOccupied(occupied, ppTx, ppTy, 1);
  buildings.push({ tx: ppTx, ty: ppTy, type: 'power-plant' });

  // Command Relay: east of Power Plant (1×1 footprint)
  const crTx = ppTx + 1;
  const crTy = ppTy;
  markOccupied(occupied, crTx, crTy, 1);
  buildings.push({ tx: crTx, ty: crTy, type: 'command-relay' });

  return buildings;
}

function placeResources(
  w: number, h: number,
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

  // Infinite deposit at/near center
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
  w: number, h: number,
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
