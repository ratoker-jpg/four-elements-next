/** Procedural map generator. Pure function, deterministic with seed. */

import {
  HQ_FOOTPRINT,
  MAP_SIZE_STANDARD,
  START_CORE_RADIUS,
  START_ECONOMY_RADIUS,
  START_TRANSITION_RADIUS,
  STARTER_POCKET_SMALL_COUNT,
  STARTER_POCKET_MEDIUM_COUNT,
  STARTER_POCKET_SUBCLUSTER_MIN,
  STARTER_POCKET_SUBCLUSTER_MAX,
  STARTER_POCKET_SUBCLUSTER_RADIUS,
  STARTER_POCKET_CORNER_BIAS,
  STARTER_POCKET_WEDGE_HALF_ANGLE,
  CENTER_FIELD_LARGE_COUNT,
  CENTER_FIELD_MEDIUM_COUNT,
  CENTER_INFINITE_OFFSET_MAX,
} from '../core/constants.js';
import type {
  MapData,
  FactionId,
  TerrainType,
  ResourceType,
  ObstacleType,
  DecorType,
  ObstaclePlacement,
  BuilderPlacement,
} from './map-types.js';
import { OBSTACLE_FOOTPRINTS, RESOURCE_FOOTPRINTS } from './map-types.js';
import { validateMap, isStraightLineClearOfObstacles } from './map-validation.js';

// ── PRNG ─────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Main generator ───────────────────────────────────────────────────

/** Maximum number of generation attempts before giving up. */
const MAX_GENERATION_ATTEMPTS = 50;

export function generateMap(
  width: number = MAP_SIZE_STANDARD,
  height: number = MAP_SIZE_STANDARD,
  faction: FactionId = 'cyan',
  seed: number = 42,
): MapData {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const currentSeed = seed + attempt;
    const rand = mulberry32(currentSeed);
    const terrain = generateTerrain(width, height, rand);
    const occupied = new Set<string>();
    const hq = placeHq(width, height, faction, occupied);
    const builders = placeBuildersNearHq(width, height, hq, occupied);

    // Place resources by distance zones
    const resources = placeResources(width, height, hq, rand, occupied);

    // Place obstacle clusters away from start zone
    const obstaclesResult = placeObstacles(width, height, hq, rand, occupied);

    // Place non-blocking decor
    const decor = placeDecor(width, height, hq, rand, occupied);

    const map: MapData = {
      width,
      height,
      terrain,
      hq,
      resources,
      obstacles: obstaclesResult.obstacles,
      decor,
      buildings: [],
      builders,
      constructionSites: [],
    };

    // Validate the generated map
    const report = validateMap(map, currentSeed, obstaclesResult.rejectedClusters);
    if (report.ok) {
      return map;
    }

    // If this was the last attempt, throw with diagnostic info
    if (attempt === MAX_GENERATION_ATTEMPTS - 1) {
      throw new Error(
        `Map generation failed after ${MAX_GENERATION_ATTEMPTS} attempts. ` +
        `seed=${seed}, size=${width}x${height}, ` +
        `errors: [${report.errors.join('; ')}]`,
      );
    }
    // Otherwise, retry with next seed
  }

  // Unreachable, but satisfies TypeScript return analysis
  throw new Error('Map generation failed: unexpected loop exit');
}

// ── Terrain generation ───────────────────────────────────────────────

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

  // Cellular-automata smoothing pass to break harsh patterns
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

// ── Occupied set helpers ─────────────────────────────────────────────

function markOccupied(occupied: Set<string>, tx: number, ty: number, size: number): void {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      occupied.add(`${tx + dx},${ty + dy}`);
    }
  }
}

// ── HQ placement ─────────────────────────────────────────────────────

function placeHq(w: number, h: number, faction: FactionId, occupied: Set<string>): MapData['hq'] {
  const tx = Math.max(0, Math.min(w - HQ_FOOTPRINT, 4));
  const ty = Math.max(0, Math.min(h - HQ_FOOTPRINT, 4));
  markOccupied(occupied, tx, ty, HQ_FOOTPRINT);
  return { tx, ty, faction };
}

// ── Builder placement ────────────────────────────────────────────────

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

// ── Resource placement (Stage A: starter pocket + Stage B: center field) ─

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
  const centerX = Math.floor(w / 2);
  const centerY = Math.floor(h / 2);
  const maxDist = Math.hypot(w, h) / 2;

  // ── Stage A: Starter resource pocket (corner-biased, clustered) ─────
  placeStarterResourcePocket(w, h, hq, rand, occupied, resources);

  // ── Transition zone (dist START_ECONOMY_RADIUS to START_TRANSITION_RADIUS) ──
  placeInZone('medium', START_ECONOMY_RADIUS, START_TRANSITION_RADIUS, 3, w, h, hqCx, hqCy, rand, occupied, resources);
  placeInZone('large', START_ECONOMY_RADIUS, START_TRANSITION_RADIUS, 2, w, h, hqCx, hqCy, rand, occupied, resources);

  // ── Far zone (dist START_TRANSITION_RADIUS to maxDist) ──
  placeInZone('large', START_TRANSITION_RADIUS, maxDist, 2, w, h, hqCx, hqCy, rand, occupied, resources, 300);

  // ── Stage B: Center resource field (3×3 infinite + surrounding field) ──
  placeCenterResourceField(w, h, hq, centerX, centerY, rand, occupied, resources);

  return resources;
}

/** Place a dense starter resource pocket biased toward the nearest map corner.
 *  Uses a corner-side wedge for sub-cluster placement and rejects any
 *  candidate that falls on the playfield side of HQ. */
function placeStarterResourcePocket(
  w: number,
  h: number,
  hq: MapData['hq'],
  rand: () => number,
  occupied: Set<string>,
  resources: MapData['resources'],
): void {
  const hqCx = hq.tx + HQ_FOOTPRINT / 2;
  const hqCy = hq.ty + HQ_FOOTPRINT / 2;

  // Find nearest corner
  const cornerX = hqCx < w / 2 ? 0 : w - 1;
  const cornerY = hqCy < h / 2 ? 0 : h - 1;

  // Compute pocket center: bias from HQ toward nearest corner
  const pocketCx = hqCx + (cornerX - hqCx) * STARTER_POCKET_CORNER_BIAS;
  const pocketCy = hqCy + (cornerY - hqCy) * STARTER_POCKET_CORNER_BIAS;

  // Direction from HQ toward map center ("playfield direction")
  const playDirX = w / 2 - hqCx;
  const playDirY = h / 2 - hqCy;

  // Direction from HQ toward corner (for wedge)
  const cornerAngle = Math.atan2(cornerY - hqCy, cornerX - hqCx);

  // Build a list of (type, count) pairs
  const toPlace: Array<{ type: ResourceType; remaining: number }> = [];
  for (let i = 0; i < STARTER_POCKET_SMALL_COUNT; i++) {
    toPlace.push({ type: 'small', remaining: 1 });
  }
  for (let i = 0; i < STARTER_POCKET_MEDIUM_COUNT; i++) {
    toPlace.push({ type: 'medium', remaining: 1 });
  }

  // Create 2-4 sub-clusters around pocket center, within a wedge toward the corner
  const subClusterCount = STARTER_POCKET_SUBCLUSTER_MIN
    + Math.floor(rand() * (STARTER_POCKET_SUBCLUSTER_MAX - STARTER_POCKET_SUBCLUSTER_MIN + 1));

  // Generate sub-cluster centres constrained to the corner-side wedge
  const subClusters: Array<{ cx: number; cy: number }> = [];
  for (let s = 0; s < subClusterCount; s++) {
    // Angle within ±WEDGE_HALF_ANGLE of the corner direction
    const angle = cornerAngle + (rand() * 2 - 1) * STARTER_POCKET_WEDGE_HALF_ANGLE;
    const dist = 2 + rand() * 4;
    subClusters.push({
      cx: pocketCx + Math.cos(angle) * dist,
      cy: pocketCy + Math.sin(angle) * dist,
    });
  }

  // Place resources by assigning them round-robin to sub-clusters
  let clusterIdx = 0;
  let totalAttempts = 0;
  const maxAttempts = toPlace.length * 30;

  while (toPlace.length > 0 && totalAttempts < maxAttempts) {
    totalAttempts++;
    const item = toPlace[0]!;
    const fp = RESOURCE_FOOTPRINTS[item.type];
    const sc = subClusters[clusterIdx % subClusters.length]!;

    // Random offset from sub-cluster center
    const offsetRange = STARTER_POCKET_SUBCLUSTER_RADIUS;
    const tx = Math.floor(sc.cx + (rand() - 0.5) * offsetRange * 2);
    const ty = Math.floor(sc.cy + (rand() - 0.5) * offsetRange * 2);

    // Reject if candidate falls on the playfield side of HQ
    const toRx = tx + fp / 2 - hqCx;
    const toRy = ty + fp / 2 - hqCy;
    if (toRx * playDirX + toRy * playDirY > 0) {
      // Candidate is on the inner/playfield side — skip
      clusterIdx++;
      continue;
    }

    // Validate placement
    if (canPlaceResource(tx, ty, fp, w, h, occupied, hqCx, hqCy)) {
      markResourceOccupied(occupied, tx, ty, fp);
      resources.push({ tx, ty, type: item.type, footprint: fp });
      toPlace.shift();
    }

    clusterIdx++;
  }
}

/** Place the central 3×3 mineral_infinite and surrounding resource field. */
function placeCenterResourceField(
  w: number,
  h: number,
  hq: MapData['hq'],
  centerX: number,
  centerY: number,
  rand: () => number,
  occupied: Set<string>,
  resources: MapData['resources'],
): void {
  const hqCx = hq.tx + HQ_FOOTPRINT / 2;
  const hqCy = hq.ty + HQ_FOOTPRINT / 2;

  // Place 3×3 mineral_infinite near exact center
  let infPlaced = false;
  const infFp = RESOURCE_FOOTPRINTS.infinite; // 3
  for (let attempts = 0; attempts < 100 && !infPlaced; attempts++) {
    const tx = Math.floor(centerX + (rand() - 0.5) * (CENTER_INFINITE_OFFSET_MAX * 2 + 1)) - Math.floor(infFp / 2);
    const ty = Math.floor(centerY + (rand() - 0.5) * (CENTER_INFINITE_OFFSET_MAX * 2 + 1)) - Math.floor(infFp / 2);

    if (canPlaceResource(tx, ty, infFp, w, h, occupied, hqCx, hqCy)) {
      markResourceOccupied(occupied, tx, ty, infFp);
      resources.push({ tx, ty, type: 'infinite', footprint: infFp });
      infPlaced = true;
    }
  }

  // Place surrounding large resources (6-12 tiles from center)
  let largePlaced = 0;
  let largeAttempts = 0;
  while (largePlaced < CENTER_FIELD_LARGE_COUNT && largeAttempts < CENTER_FIELD_LARGE_COUNT * 40) {
    largeAttempts++;
    const angle = rand() * Math.PI * 2;
    const dist = 7 + rand() * 5;
    const tx = Math.floor(centerX + Math.cos(angle) * dist);
    const ty = Math.floor(centerY + Math.sin(angle) * dist);
    const fp = RESOURCE_FOOTPRINTS.large;

    if (canPlaceResource(tx, ty, fp, w, h, occupied, hqCx, hqCy)) {
      markResourceOccupied(occupied, tx, ty, fp);
      resources.push({ tx, ty, type: 'large', footprint: fp });
      largePlaced++;
    }
  }

  // Place surrounding medium resources (8-14 tiles from center)
  let mediumPlaced = 0;
  let mediumAttempts = 0;
  while (mediumPlaced < CENTER_FIELD_MEDIUM_COUNT && mediumAttempts < CENTER_FIELD_MEDIUM_COUNT * 40) {
    mediumAttempts++;
    const angle = rand() * Math.PI * 2;
    const dist = 9 + rand() * 5;
    const tx = Math.floor(centerX + Math.cos(angle) * dist);
    const ty = Math.floor(centerY + Math.sin(angle) * dist);
    const fp = RESOURCE_FOOTPRINTS.medium;

    if (canPlaceResource(tx, ty, fp, w, h, occupied, hqCx, hqCy)) {
      markResourceOccupied(occupied, tx, ty, fp);
      resources.push({ tx, ty, type: 'medium', footprint: fp });
      mediumPlaced++;
    }
  }
}

// ── Shared resource placement helpers ──────────────────────────────────

/** Check if a resource of the given footprint can be placed at (tx, ty). */
function canPlaceResource(
  tx: number,
  ty: number,
  footprint: number,
  mapW: number,
  mapH: number,
  occupied: Set<string>,
  hqCx: number,
  hqCy: number,
): boolean {
  // Bounds check
  if (tx < 0 || ty < 0 || tx + footprint > mapW || ty + footprint > mapH) return false;

  // Check all footprint tiles are free
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      if (occupied.has(`${tx + dx},${ty + dy}`)) return false;
    }
  }

  // No large or infinite resources inside start economy zone
  // Also check single-tile 'large' type by inspecting the type implied by footprint > 1
  // For footprint=3 (infinite), always enforce the distance check
  if (footprint > 1) {
    const rCx = tx + footprint / 2;
    const rCy = ty + footprint / 2;
    const distToHq = Math.hypot(rCx - hqCx, rCy - hqCy);
    if (distToHq < START_ECONOMY_RADIUS) return false;
  }

  return true;
}

/** Mark a resource's footprint tiles in the occupied set. */
function markResourceOccupied(occupied: Set<string>, tx: number, ty: number, footprint: number): void {
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      occupied.add(`${tx + dx},${ty + dy}`);
    }
  }
}

/** Place resources in an annular zone (distance-based scatter). Used for transition/far zones. */
function placeInZone(
  type: ResourceType,
  minDist: number,
  maxDist: number,
  count: number,
  mapW: number,
  mapH: number,
  hqCx: number,
  hqCy: number,
  rand: () => number,
  occupied: Set<string>,
  resources: MapData['resources'],
  maxAttempts: number = 200,
): void {
  const fp = RESOURCE_FOOTPRINTS[type];
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const tx = Math.floor(rand() * mapW);
    const ty = Math.floor(rand() * mapH);
    const dist = Math.hypot(tx + fp / 2 - hqCx, ty + fp / 2 - hqCy);
    if (dist < minDist || dist > maxDist) continue;
    if (!canPlaceResource(tx, ty, fp, mapW, mapH, occupied, hqCx, hqCy)) continue;
    markResourceOccupied(occupied, tx, ty, fp);
    resources.push({ tx, ty, type, footprint: fp });
    placed++;
  }
}

// ── Obstacle placement (Stage C: clustered obstacles) ────────────────

type ObstacleTheme = 'mountain' | 'volcano' | 'rock';

interface ClusterResult {
  obstacles: ObstaclePlacement[];
  rejectedClusters: number;
}

function placeObstacles(
  w: number,
  h: number,
  hq: MapData['hq'],
  rand: () => number,
  occupied: Set<string>,
): ClusterResult {
  const obstacles: ObstaclePlacement[] = [];
  let rejectedClusters = 0;
  const hqCx = hq.tx + HQ_FOOTPRINT / 2;
  const hqCy = hq.ty + HQ_FOOTPRINT / 2;
  const centerX = Math.floor(w / 2);
  const centerY = Math.floor(h / 2);

  // Number of clusters scales with map size
  const clusterCount = Math.floor(w * h / 400); // ~5 for 48x48, ~10 for 64x64

  for (let c = 0; c < clusterCount; c++) {
    // Pick cluster center away from start core zone and center
    let cx: number, cy: number;
    let clusterAttempts = 0;
    do {
      cx = Math.floor(rand() * w);
      cy = Math.floor(rand() * h);
      clusterAttempts++;
    } while (
      clusterAttempts < 50 &&
      (Math.hypot(cx - hqCx, cy - hqCy) < START_TRANSITION_RADIUS ||
       Math.hypot(cx - centerX, cy - centerY) < 5)
    );

    if (clusterAttempts >= 50) {
      rejectedClusters++;
      continue;
    }

    // Choose theme
    const themes: ObstacleTheme[] = ['mountain', 'volcano', 'rock'];
    const theme = themes[Math.floor(rand() * themes.length)]!;

    // Place main obstacle
    const mainType = getMainObstacleType(theme, rand);
    const mainFootprint = OBSTACLE_FOOTPRINTS[mainType];
    const mainResult = tryPlaceObstacle(cx, cy, mainType, mainFootprint, w, h, occupied);
    if (!mainResult) {
      rejectedClusters++;
      continue;
    }
    obstacles.push(mainResult);

    // Place 1–5 supporting smaller obstacles around the main one
    const supportCount = 1 + Math.floor(rand() * 5);
    let supportsPlaced = 0;
    for (let s = 0; s < supportCount * 3 && supportsPlaced < supportCount; s++) {
      const offsetRange = mainFootprint + 2;
      const sx = cx + Math.floor(rand() * offsetRange * 2 - offsetRange);
      const sy = cy + Math.floor(rand() * offsetRange * 2 - offsetRange);
      const supportType = getSupportObstacleType(theme, rand);
      const supportFootprint = OBSTACLE_FOOTPRINTS[supportType];
      const supportResult = tryPlaceObstacle(sx, sy, supportType, supportFootprint, w, h, occupied);
      if (supportResult) {
        obstacles.push(supportResult);
        supportsPlaced++;
      }
    }

    // Validate: cluster must not block straight line from HQ to center
    const clusterObstacles = [...obstacles]; // all obstacles so far
    const hqToInt = isStraightLineClearOfObstacles(
      clusterObstacles,
      Math.floor(hqCx), Math.floor(hqCy),
      centerX, centerY,
      w, h,
    );
    if (!hqToInt) {
      // Reject entire cluster — remove its obstacles and free occupied tiles
      // Remove obstacles added in this cluster
      const clusterStartIdx = obstacles.length - 1 - supportsPlaced;
      for (let i = obstacles.length - 1; i >= clusterStartIdx; i--) {
        const obs = obstacles[i]!;
        for (let dy = 0; dy < obs.footprint; dy++) {
          for (let dx = 0; dx < obs.footprint; dx++) {
            occupied.delete(`${obs.tx + dx},${obs.ty + dy}`);
          }
        }
        obstacles.splice(i, 1);
      }
      // Also remove the main obstacle
      const mainObs = mainResult;
      for (let dy = 0; dy < mainObs.footprint; dy++) {
        for (let dx = 0; dx < mainObs.footprint; dx++) {
          occupied.delete(`${mainObs.tx + dx},${mainObs.ty + dy}`);
        }
      }
      // Find and remove mainResult from obstacles
      const mainIdx = obstacles.indexOf(mainResult);
      if (mainIdx >= 0) {
        obstacles.splice(mainIdx, 1);
      }
      rejectedClusters++;
    }
  }

  return { obstacles, rejectedClusters };
}

function tryPlaceObstacle(
  tx: number,
  ty: number,
  type: ObstacleType,
  footprint: number,
  mapW: number,
  mapH: number,
  occupied: Set<string>,
): ObstaclePlacement | null {
  // Bounds check
  if (tx < 0 || ty < 0 || tx + footprint > mapW || ty + footprint > mapH) return null;

  // Check all footprint tiles are free
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      if (occupied.has(`${tx + dx},${ty + dy}`)) return null;
    }
  }

  // Mark occupied
  markOccupied(occupied, tx, ty, footprint);

  return { tx, ty, type, footprint };
}

function getMainObstacleType(theme: ObstacleTheme, rand: () => number): ObstacleType {
  const r = rand();
  switch (theme) {
    case 'mountain':
      return r < 0.4 ? 'mountain-medium' : r < 0.7 ? 'mountain-large' : 'mountain-small';
    case 'volcano':
      return r < 0.5 ? 'volcano-medium' : 'volcano-small';
    case 'rock':
      return 'rock-cluster';
  }
}

function getSupportObstacleType(theme: ObstacleTheme, rand: () => number): ObstacleType {
  const r = rand();
  switch (theme) {
    case 'mountain':
      return r < 0.6 ? 'mountain-small' : 'rock-cluster';
    case 'volcano':
      return r < 0.5 ? 'volcano-small' : 'rock-cluster';
    case 'rock':
      return 'rock-cluster';
  }
}

// ── Decor placement (Stage C: non-blocking decor only) ───────────────

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
    { type: 'bush', count: 12 },
    { type: 'sand-bump', count: 14 },
  ];

  for (const spec of decorSpecs) {
    let placed = 0;
    let attempts = 0;
    while (placed < spec.count && attempts < 300) {
      attempts++;
      const tx = Math.floor(rand() * w);
      const ty = Math.floor(rand() * h);
      // Sparse near start core zone
      if (Math.hypot(tx - hqCx, ty - hqCy) < START_CORE_RADIUS) continue;
      if (occupied.has(`${tx},${ty}`)) continue;
      occupied.add(`${tx},${ty}`);
      decor.push({ tx, ty, type: spec.type });
      placed++;
    }
  }

  return decor;
}
