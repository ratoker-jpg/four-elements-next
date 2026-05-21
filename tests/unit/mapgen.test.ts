import { describe, it, expect } from 'vitest';
import { generateMap } from '../../src/game/mapgen.js';
import {
  HQ_FOOTPRINT,
  MAP_SIZE_STANDARD,
  MAP_SIZE_LARGE,
  SPRITE_PROFILES,
  START_CORE_RADIUS,
  START_ECONOMY_RADIUS,
  EDGE_BIOME_DEPTH,
} from '../../src/core/constants.js';
import { OBSTACLE_FOOTPRINTS, RESOURCE_FOOTPRINTS } from '../../src/game/map-types.js';
import { isStraightLineClearOfObstacles } from '../../src/game/map-validation.js';

describe('mapgen', () => {
  it('returns correct dimensions', () => {
    const map = generateMap(48, 48, 'cyan');
    expect(map.width).toBe(48);
    expect(map.height).toBe(48);
  });

  it('places HQ within map bounds', () => {
    const map = generateMap();
    expect(map.hq.tx).toBeGreaterThanOrEqual(0);
    expect(map.hq.ty).toBeGreaterThanOrEqual(0);
    expect(map.hq.tx + HQ_FOOTPRINT).toBeLessThanOrEqual(map.width);
    expect(map.hq.ty + HQ_FOOTPRINT).toBeLessThanOrEqual(map.height);
  });

  it('places resources within map bounds (including footprint)', () => {
    const map = generateMap();
    for (const r of map.resources) {
      expect(r.tx).toBeGreaterThanOrEqual(0);
      expect(r.ty).toBeGreaterThanOrEqual(0);
      expect(r.tx + r.footprint).toBeLessThanOrEqual(map.width);
      expect(r.ty + r.footprint).toBeLessThanOrEqual(map.height);
    }
  });

  it('no resource footprint overlaps HQ footprint', () => {
    const map = generateMap();
    const hqTiles = new Set<string>();
    for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
      for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
        hqTiles.add(`${map.hq.tx + dx},${map.hq.ty + dy}`);
      }
    }
    for (const r of map.resources) {
      for (let dy = 0; dy < r.footprint; dy++) {
        for (let dx = 0; dx < r.footprint; dx++) {
          expect(hqTiles.has(`${r.tx + dx},${r.ty + dy}`)).toBe(false);
        }
      }
    }
  });

  it('has an infinite deposit near map center with 3×3 footprint', () => {
    const map = generateMap();
    const infinite = map.resources.filter((r) => r.type === 'infinite');
    expect(infinite.length).toBeGreaterThanOrEqual(1);
    const center = map.width / 2;
    for (const dep of infinite) {
      // Center of the 3×3 deposit should be near map center
      const depCenterX = dep.tx + dep.footprint / 2;
      const depCenterY = dep.ty + dep.footprint / 2;
      expect(Math.abs(depCenterX - center)).toBeLessThan(3);
      expect(Math.abs(depCenterY - center)).toBeLessThan(3);
    }
  });

  it('all terrain types are valid', () => {
    const map = generateMap();
    const validTypes = new Set(['sand', 'sand-dark', 'sand-light']);
    for (const row of map.terrain) {
      for (const t of row) {
        expect(validTypes.has(t)).toBe(true);
      }
    }
  });

  it('is deterministic with same seed', () => {
    const a = generateMap(48, 48, 'cyan', 42);
    const b = generateMap(48, 48, 'cyan', 42);
    expect(a.hq.tx).toBe(b.hq.tx);
    expect(a.hq.ty).toBe(b.hq.ty);
    expect(a.resources.length).toBe(b.resources.length);
    expect(a.obstacles.length).toBe(b.obstacles.length);
    expect(a.decor.length).toBe(b.decor.length);
    // Also verify resource positions match
    for (let i = 0; i < a.resources.length; i++) {
      expect(a.resources[i]!.tx).toBe(b.resources[i]!.tx);
      expect(a.resources[i]!.ty).toBe(b.resources[i]!.ty);
      expect(a.resources[i]!.type).toBe(b.resources[i]!.type);
      expect(a.resources[i]!.footprint).toBe(b.resources[i]!.footprint);
    }
  });

  it('is deterministic with same seed for large map', () => {
    const a = generateMap(64, 64, 'cyan', 42);
    const b = generateMap(64, 64, 'cyan', 42);
    expect(a.obstacles.length).toBe(b.obstacles.length);
    expect(a.decor.length).toBe(b.decor.length);
    for (let i = 0; i < a.obstacles.length; i++) {
      expect(a.obstacles[i]!.tx).toBe(b.obstacles[i]!.tx);
      expect(a.obstacles[i]!.ty).toBe(b.obstacles[i]!.ty);
      expect(a.obstacles[i]!.type).toBe(b.obstacles[i]!.type);
    }
  });

  it('terrain grid matches dimensions', () => {
    const map = generateMap();
    expect(map.terrain.length).toBe(map.height);
    for (const row of map.terrain) {
      expect(row.length).toBe(map.width);
    }
  });

  it('obstacles are within map bounds', () => {
    const map = generateMap();
    for (const o of map.obstacles) {
      expect(o.tx).toBeGreaterThanOrEqual(0);
      expect(o.ty).toBeGreaterThanOrEqual(0);
      expect(o.tx + o.footprint).toBeLessThanOrEqual(map.width);
      expect(o.ty + o.footprint).toBeLessThanOrEqual(map.height);
    }
  });

  it('decor items are within map bounds', () => {
    const map = generateMap();
    for (const d of map.decor) {
      expect(d.tx).toBeGreaterThanOrEqual(0);
      expect(d.ty).toBeGreaterThanOrEqual(0);
      expect(d.tx).toBeLessThan(map.width);
      expect(d.ty).toBeLessThan(map.height);
    }
  });

  it('generated map starts with zero extra buildings', () => {
    const map = generateMap();
    expect(map.buildings).toHaveLength(0);
  });

  it('HQ and builder tiles do not overlap resources, obstacles, or decor', () => {
    const map = generateMap();
    const occupied = new Map<string, string>();

    const claim = (owner: string, tx: number, ty: number) => {
      const key = `${tx},${ty}`;
      expect(occupied.has(key)).toBe(false);
      occupied.set(key, owner);
    };

    for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
      for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
        claim('hq', map.hq.tx + dx, map.hq.ty + dy);
      }
    }

    for (const builder of map.builders) {
      claim('builder', builder.tx, builder.ty);
    }
    for (const resource of map.resources) {
      for (let dy = 0; dy < resource.footprint; dy++) {
        for (let dx = 0; dx < resource.footprint; dx++) {
          claim(`resource:${resource.type}`, resource.tx + dx, resource.ty + dy);
        }
      }
    }
    for (const obstacle of map.obstacles) {
      for (let dy = 0; dy < obstacle.footprint; dy++) {
        for (let dx = 0; dx < obstacle.footprint; dx++) {
          claim(`obstacle:${obstacle.type}`, obstacle.tx + dx, obstacle.ty + dy);
        }
      }
    }
    for (const decor of map.decor) {
      claim(`decor:${decor.type}`, decor.tx, decor.ty);
    }
  });

  // ── Resource footprints ───────────────────────────────────────────────

  it('resource footprints match type definitions', () => {
    const map = generateMap();
    for (const r of map.resources) {
      expect(r.footprint).toBe(RESOURCE_FOOTPRINTS[r.type]);
    }
  });

  it('mineral_infinite has footprint 3', () => {
    const map = generateMap();
    const infinite = map.resources.filter((r) => r.type === 'infinite');
    expect(infinite.length).toBeGreaterThanOrEqual(1);
    for (const r of infinite) {
      expect(r.footprint).toBe(3);
    }
  });

  it('small and medium resources have footprint 1', () => {
    const map = generateMap();
    for (const r of map.resources) {
      if (r.type === 'small' || r.type === 'medium') {
        expect(r.footprint).toBe(1);
      }
    }
  });

  // ── Stage A: Starter resource pocket tests ────────────────────────────

  it('starter pocket has enough small resources near HQ', () => {
    const map = generateMap();
    const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
    const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
    const nearSmall = map.resources.filter(
      (r) => r.type === 'small' && Math.hypot(r.tx - hqCx, r.ty - hqCy) < START_ECONOMY_RADIUS,
    );
    expect(nearSmall.length).toBeGreaterThanOrEqual(8);
  });

  it('starter pocket has enough medium resources near HQ', () => {
    const map = generateMap();
    const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
    const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
    const nearMedium = map.resources.filter(
      (r) => r.type === 'medium' && Math.hypot(r.tx - hqCx, r.ty - hqCy) < START_ECONOMY_RADIUS,
    );
    expect(nearMedium.length).toBeGreaterThanOrEqual(3);
  });

  it('starter resources are clustered, not pure scatter', () => {
    const map = generateMap();
    const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
    const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
    const nearSmall = map.resources.filter(
      (r) => r.type === 'small' && Math.hypot(r.tx - hqCx, r.ty - hqCy) < START_ECONOMY_RADIUS,
    );
    // At least 3 small resources should be within 4 tiles of each other
    let foundCluster = false;
    for (let i = 0; i < nearSmall.length && !foundCluster; i++) {
      let nearby = 0;
      for (let j = 0; j < nearSmall.length; j++) {
        if (i !== j && Math.hypot(nearSmall[i]!.tx - nearSmall[j]!.tx, nearSmall[i]!.ty - nearSmall[j]!.ty) < 4) {
          nearby++;
        }
      }
      if (nearby >= 2) foundCluster = true;
    }
    expect(foundCluster).toBe(true);
  });

  it('no large or infinite resource inside start economy zone', () => {
    const map = generateMap();
    const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
    const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
    for (const r of map.resources) {
      if (r.type === 'large' || r.type === 'infinite') {
        // Check center of resource footprint
        const rCx = r.tx + r.footprint / 2;
        const rCy = r.ty + r.footprint / 2;
        const dist = Math.hypot(rCx - hqCx, rCy - hqCy);
        expect(dist).toBeGreaterThan(START_ECONOMY_RADIUS);
      }
    }
  });

  it('starter pocket is mostly on corner-side of HQ, not distributed around all sides', () => {
    const map = generateMap();
    const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
    const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
    // Playfield direction: from HQ center toward map center
    const playDirX = map.width / 2 - hqCx;
    const playDirY = map.height / 2 - hqCy;

    const nearResources = map.resources.filter(
      (r) => (r.type === 'small' || r.type === 'medium')
        && Math.hypot(r.tx + r.footprint / 2 - hqCx, r.ty + r.footprint / 2 - hqCy) < START_ECONOMY_RADIUS,
    );

    let cornerSide = 0;
    let playfieldSide = 0;
    for (const r of nearResources) {
      const toRx = r.tx + r.footprint / 2 - hqCx;
      const toRy = r.ty + r.footprint / 2 - hqCy;
      const dot = toRx * playDirX + toRy * playDirY;
      if (dot <= 0) cornerSide++;
      else playfieldSide++;
    }

    // The majority of starter resources must be on the corner side
    expect(cornerSide).toBeGreaterThan(playfieldSide);
    // At least 70% should be on the corner side
    if (nearResources.length > 0) {
      expect(cornerSide).toBeGreaterThanOrEqual(Math.floor(nearResources.length * 0.7));
    }
  });

  it('starter pocket corner-side bias is robust across multiple seeds', () => {
    // Verify that the corner-side majority holds across many seeds
    const seeds = [1, 7, 42, 100, 200, 300, 500, 777, 999, 1234];
    let allPass = true;
    for (const seed of seeds) {
      const map = generateMap(48, 48, 'cyan', seed);
      const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
      const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
      const playDirX = map.width / 2 - hqCx;
      const playDirY = map.height / 2 - hqCy;
      const near = map.resources.filter(
        (r) => (r.type === 'small' || r.type === 'medium')
          && Math.hypot(r.tx + r.footprint / 2 - hqCx, r.ty + r.footprint / 2 - hqCy) < START_ECONOMY_RADIUS,
      );
      let cornerSide = 0;
      for (const r of near) {
        const toRx = r.tx + r.footprint / 2 - hqCx;
        const toRy = r.ty + r.footprint / 2 - hqCy;
        if (toRx * playDirX + toRy * playDirY <= 0) cornerSide++;
      }
      if (near.length > 0 && cornerSide < Math.floor(near.length * 0.7)) {
        allPass = false;
        break;
      }
    }
    expect(allPass).toBe(true);
  });

  // ── Sprite profile tests ────────────────────────────────────────────────

  it('mineral_infinite sprite profile has size [170, 170] and groundOffset -24', () => {
    const profile = SPRITE_PROFILES.mineral_infinite;
    expect(profile.size).toEqual([170, 170]);
    expect(profile.groundOffset).toBe(-24);
  });

  // ── Stage B: Center resource field tests ──────────────────────────────

  it('center has mineral_infinite near exact center', () => {
    const map = generateMap();
    const infinite = map.resources.filter((r) => r.type === 'infinite');
    expect(infinite.length).toBeGreaterThanOrEqual(1);
    const mapCx = map.width / 2;
    const mapCy = map.height / 2;
    for (const r of infinite) {
      // Infinite center should be within 2 tiles of exact center
      const rCx = r.tx + r.footprint / 2;
      const rCy = r.ty + r.footprint / 2;
      expect(Math.abs(rCx - mapCx)).toBeLessThan(3);
      expect(Math.abs(rCy - mapCy)).toBeLessThan(3);
    }
  });

  it('center has surrounding large resource field', () => {
    const map = generateMap();
    const mapCx = map.width / 2;
    const mapCy = map.height / 2;
    const centerLarge = map.resources.filter(
      (r) => r.type === 'large' && Math.hypot(r.tx - mapCx, r.ty - mapCy) < 15,
    );
    expect(centerLarge.length).toBeGreaterThanOrEqual(2);
  });

  it('center has surrounding medium resource field', () => {
    const map = generateMap();
    const mapCx = map.width / 2;
    const mapCy = map.height / 2;
    const centerMedium = map.resources.filter(
      (r) => r.type === 'medium' && Math.hypot(r.tx - mapCx, r.ty - mapCy) < 15,
    );
    expect(centerMedium.length).toBeGreaterThanOrEqual(3);
  });

  it('center resources do not overlap infinite footprint', () => {
    const map = generateMap();
    const infinite = map.resources.filter((r) => r.type === 'infinite');
    if (infinite.length === 0) return;
    const inf = infinite[0]!;
    const infTiles = new Set<string>();
    for (let dy = 0; dy < inf.footprint; dy++) {
      for (let dx = 0; dx < inf.footprint; dx++) {
        infTiles.add(`${inf.tx + dx},${inf.ty + dy}`);
      }
    }
    for (const r of map.resources) {
      if (r === inf) continue;
      for (let dy = 0; dy < r.footprint; dy++) {
        for (let dx = 0; dx < r.footprint; dx++) {
          expect(infTiles.has(`${r.tx + dx},${r.ty + dy}`)).toBe(false);
        }
      }
    }
  });

  // ── Stage C: Obstacle and decor tests ─────────────────────────────────

  it('no obstacles inside start core zone', () => {
    const map = generateMap();
    const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
    const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
    for (const o of map.obstacles) {
      const obsCx = o.tx + o.footprint / 2;
      const obsCy = o.ty + o.footprint / 2;
      const dist = Math.hypot(obsCx - hqCx, obsCy - hqCy);
      expect(dist).toBeGreaterThan(START_CORE_RADIUS);
    }
  });

  it('obstacle footprints match type definitions', () => {
    const map = generateMap();
    for (const o of map.obstacles) {
      expect(o.footprint).toBe(OBSTACLE_FOOTPRINTS[o.type]);
    }
  });

  it('decor only contains non-blocking types (bush, sand-bump)', () => {
    const map = generateMap();
    const validDecorTypes = new Set(['bush', 'sand-bump']);
    for (const d of map.decor) {
      expect(validDecorTypes.has(d.type)).toBe(true);
    }
  });

  it('no decor inside start core zone', () => {
    const map = generateMap();
    const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
    const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
    for (const d of map.decor) {
      const dist = Math.hypot(d.tx - hqCx, d.ty - hqCy);
      expect(dist).toBeGreaterThan(START_CORE_RADIUS);
    }
  });

  it('no obstacle overlaps a resource footprint', () => {
    const map = generateMap();
    const resourceTiles = new Set<string>();
    for (const r of map.resources) {
      for (let dy = 0; dy < r.footprint; dy++) {
        for (let dx = 0; dx < r.footprint; dx++) {
          resourceTiles.add(`${r.tx + dx},${r.ty + dy}`);
        }
      }
    }
    for (const o of map.obstacles) {
      for (let dy = 0; dy < o.footprint; dy++) {
        for (let dx = 0; dx < o.footprint; dx++) {
          expect(resourceTiles.has(`${o.tx + dx},${o.ty + dy}`)).toBe(false);
        }
      }
    }
  });

  it('map has at least one obstacle cluster', () => {
    const map = generateMap();
    expect(map.obstacles.length).toBeGreaterThanOrEqual(1);
  });

  // ── Stage C: Edge obstacle biome tests ─────────────────────────────────

  it('standard map has edge obstacles near map borders', () => {
    const map = generateMap(48, 48, 'cyan');
    const isInEdgeBand = (tx: number, ty: number, footprint: number) => {
      // Check if any footprint tile is in the edge band
      for (let dy = 0; dy < footprint; dy++) {
        for (let dx = 0; dx < footprint; dx++) {
          const x = tx + dx;
          const y = ty + dy;
          if (x < EDGE_BIOME_DEPTH || x >= map.width - EDGE_BIOME_DEPTH ||
              y < EDGE_BIOME_DEPTH || y >= map.height - EDGE_BIOME_DEPTH) {
            return true;
          }
        }
      }
      return false;
    };
    const edgeObstacles = map.obstacles.filter((o) => isInEdgeBand(o.tx, o.ty, o.footprint));
    // With 8 edge clusters, there should be at least a few edge obstacles
    expect(edgeObstacles.length).toBeGreaterThanOrEqual(3);
  });

  it('large map has more edge obstacles than standard', () => {
    const std = generateMap(48, 48, 'cyan', 42);
    const large = generateMap(64, 64, 'cyan', 42);
    const isInEdgeBand = (tx: number, ty: number, footprint: number, w: number, h: number) => {
      for (let dy = 0; dy < footprint; dy++) {
        for (let dx = 0; dx < footprint; dx++) {
          const x = tx + dx;
          const y = ty + dy;
          if (x < EDGE_BIOME_DEPTH || x >= w - EDGE_BIOME_DEPTH ||
              y < EDGE_BIOME_DEPTH || y >= h - EDGE_BIOME_DEPTH) {
            return true;
          }
        }
      }
      return false;
    };
    const stdEdge = std.obstacles.filter((o) => isInEdgeBand(o.tx, o.ty, o.footprint, std.width, std.height));
    const largeEdge = large.obstacles.filter((o) => isInEdgeBand(o.tx, o.ty, o.footprint, large.width, large.height));
    expect(largeEdge.length).toBeGreaterThanOrEqual(stdEdge.length);
  });

  it('standard map has zero mountain-large obstacles', () => {
    const map = generateMap(48, 48, 'cyan');
    const mountainLarge = map.obstacles.filter((o) => o.type === 'mountain-large');
    expect(mountainLarge.length).toBe(0);
  });

  it('standard map has zero volcano-medium obstacles', () => {
    const map = generateMap(48, 48, 'cyan');
    const volcanoMedium = map.obstacles.filter((o) => o.type === 'volcano-medium');
    expect(volcanoMedium.length).toBe(0);
  });

  it('large map has at most 2 mountain-large obstacles', () => {
    const map = generateMap(64, 64, 'cyan');
    const mountainLarge = map.obstacles.filter((o) => o.type === 'mountain-large');
    expect(mountainLarge.length).toBeLessThanOrEqual(2);
  });

  it('large map has at most 2 volcano-medium obstacles', () => {
    const map = generateMap(64, 64, 'cyan');
    const volcanoMedium = map.obstacles.filter((o) => o.type === 'volcano-medium');
    expect(volcanoMedium.length).toBeLessThanOrEqual(2);
  });

  it('no volcano-large obstacles exist on any map', () => {
    const std = generateMap(48, 48, 'cyan');
    const large = generateMap(64, 64, 'cyan');
    // volcano-large is not even an ObstacleType, but verify it doesn't appear
    const allObstacles = [...std.obstacles, ...large.obstacles];
    const volcanoLarge = allObstacles.filter((o) => o.type === 'volcano-large');
    expect(volcanoLarge.length).toBe(0);
  });

  it('edge obstacles do not overlap resources or HQ', () => {
    const map = generateMap(48, 48, 'cyan');
    const hqTiles = new Set<string>();
    for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
      for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
        hqTiles.add(`${map.hq.tx + dx},${map.hq.ty + dy}`);
      }
    }
    const resourceTiles = new Set<string>();
    for (const r of map.resources) {
      for (let dy = 0; dy < r.footprint; dy++) {
        for (let dx = 0; dx < r.footprint; dx++) {
          resourceTiles.add(`${r.tx + dx},${r.ty + dy}`);
        }
      }
    }
    const isInEdgeBand = (tx: number, ty: number, footprint: number) => {
      for (let dy = 0; dy < footprint; dy++) {
        for (let dx = 0; dx < footprint; dx++) {
          const x = tx + dx;
          const y = ty + dy;
          if (x < EDGE_BIOME_DEPTH || x >= map.width - EDGE_BIOME_DEPTH ||
              y < EDGE_BIOME_DEPTH || y >= map.height - EDGE_BIOME_DEPTH) {
            return true;
          }
        }
      }
      return false;
    };
    for (const o of map.obstacles) {
      if (!isInEdgeBand(o.tx, o.ty, o.footprint)) continue;
      for (let dy = 0; dy < o.footprint; dy++) {
        for (let dx = 0; dx < o.footprint; dx++) {
          expect(hqTiles.has(`${o.tx + dx},${o.ty + dy}`)).toBe(false);
          expect(resourceTiles.has(`${o.tx + dx},${o.ty + dy}`)).toBe(false);
        }
      }
    }
  });

  it('starter resources remain reachable via straight line from HQ', () => {
    const map = generateMap(48, 48, 'cyan');
    const hqCx = Math.floor(map.hq.tx + HQ_FOOTPRINT / 2);
    const hqCy = Math.floor(map.hq.ty + HQ_FOOTPRINT / 2);
    const starterResources = map.resources.filter(
      (r) => r.type === 'small' || r.type === 'medium',
    );
    // At least one starter resource must be reachable
    let reachable = 0;
    for (const r of starterResources) {
      if (isStraightLineClearOfObstacles(map.obstacles, hqCx, hqCy, r.tx, r.ty, map.width, map.height)) {
        reachable++;
      }
    }
    expect(reachable).toBeGreaterThan(0);
  });

  it('HQ to center remains clear of obstacles', () => {
    const map = generateMap(48, 48, 'cyan');
    const hqCx = Math.floor(map.hq.tx + HQ_FOOTPRINT / 2);
    const hqCy = Math.floor(map.hq.ty + HQ_FOOTPRINT / 2);
    const centerX = Math.floor(map.width / 2);
    const centerY = Math.floor(map.height / 2);
    expect(isStraightLineClearOfObstacles(map.obstacles, hqCx, hqCy, centerX, centerY, map.width, map.height)).toBe(true);
  });

  it('standard map obstacle type limits are robust across multiple seeds', () => {
    const seeds = [1, 7, 42, 100, 200, 300, 500, 777, 999, 1234];
    for (const seed of seeds) {
      const map = generateMap(48, 48, 'cyan', seed);
      const mountainLarge = map.obstacles.filter((o) => o.type === 'mountain-large');
      const volcanoMedium = map.obstacles.filter((o) => o.type === 'volcano-medium');
      expect(mountainLarge.length).toBe(0);
      expect(volcanoMedium.length).toBe(0);
    }
  });

  it('large map obstacle type limits are robust across multiple seeds', () => {
    const seeds = [1, 7, 42, 100, 200, 300, 500, 777, 999, 1234];
    for (const seed of seeds) {
      const map = generateMap(64, 64, 'cyan', seed);
      const mountainLarge = map.obstacles.filter((o) => o.type === 'mountain-large');
      const volcanoMedium = map.obstacles.filter((o) => o.type === 'volcano-medium');
      expect(mountainLarge.length).toBeLessThanOrEqual(2);
      expect(volcanoMedium.length).toBeLessThanOrEqual(2);
    }
  });

  // ── Minimal Stage D: Decor variation tests ─────────────────────────────

  it('decor has more items than the original minimum baseline', () => {
    const map = generateMap(48, 48, 'cyan');
    // Original: bush=12, sand-bump=14 = 26 total minimum
    // Stage D: bush=24 (18+6), sand-bump=30 (22+8) = 54 target
    // At least 30 total decor items should be placed
    expect(map.decor.length).toBeGreaterThanOrEqual(30);
  });

  it('decor includes edge-biased items near map borders', () => {
    const map = generateMap(48, 48, 'cyan');
    const edgeDecor = map.decor.filter((d) =>
      d.tx < EDGE_BIOME_DEPTH || d.tx >= map.width - EDGE_BIOME_DEPTH ||
      d.ty < EDGE_BIOME_DEPTH || d.ty >= map.height - EDGE_BIOME_DEPTH,
    );
    // With 14 edge-biased decor targets, at least a few should be in the edge band
    expect(edgeDecor.length).toBeGreaterThanOrEqual(3);
  });

  // ── Large map ─────────────────────────────────────────────────────────

  it('generates correct dimensions for large map', () => {
    const map = generateMap(64, 64, 'cyan');
    expect(map.width).toBe(64);
    expect(map.height).toBe(64);
  });

  it('large map has more obstacles than standard', () => {
    const std = generateMap(48, 48, 'cyan', 42);
    const large = generateMap(64, 64, 'cyan', 42);
    expect(large.obstacles.length).toBeGreaterThanOrEqual(std.obstacles.length);
  });

  // ── Generated maps pass validation ────────────────────────────────────

  it('generated standard map passes validation', () => {
    const map = generateMap(48, 48, 'cyan', 42);
    // Validate basic invariants
    expect(map.resources.length).toBeGreaterThan(0);
    expect(map.obstacles.length).toBeGreaterThan(0);
    // All resources have valid footprints
    for (const r of map.resources) {
      expect(r.footprint).toBe(RESOURCE_FOOTPRINTS[r.type]);
    }
  });

  it('generated large map passes validation', () => {
    const map = generateMap(64, 64, 'cyan', 42);
    expect(map.resources.length).toBeGreaterThan(0);
    expect(map.obstacles.length).toBeGreaterThan(0);
    for (const r of map.resources) {
      expect(r.footprint).toBe(RESOURCE_FOOTPRINTS[r.type]);
    }
  });

  it('has medium and large resources further from HQ', () => {
    const map = generateMap();
    const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
    const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
    const midResources = map.resources.filter(
      (r) => (r.type === 'medium' || r.type === 'large') && Math.hypot(r.tx - hqCx, r.ty - hqCy) > 8,
    );
    expect(midResources.length).toBeGreaterThanOrEqual(2);
  });

  // ── Profile metadata stability ────────────────────────────────────────

  it('mineral_infinite profile remains [170, 170] / groundOffset -24', () => {
    const profile = SPRITE_PROFILES.mineral_infinite;
    expect(profile.size).toEqual([170, 170]);
    expect(profile.groundOffset).toBe(-24);
  });

  it('all sprite profiles have valid size and groundOffset', () => {
    for (const [key, profile] of Object.entries(SPRITE_PROFILES)) {
      expect(profile.size.length).toBe(2);
      expect(profile.size[0]).toBeGreaterThan(0);
      expect(profile.size[1]).toBeGreaterThan(0);
      expect(typeof profile.groundOffset).toBe('number');
    }
  });
});
