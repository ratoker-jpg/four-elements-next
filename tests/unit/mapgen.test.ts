import { describe, it, expect } from 'vitest';
import { generateMap } from '../../src/game/mapgen.js';
import { HQ_FOOTPRINT, MAP_SIZE_STANDARD, START_CORE_RADIUS } from '../../src/core/constants.js';
import { OBSTACLE_FOOTPRINTS } from '../../src/game/map-types.js';

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

  it('places resources within map bounds', () => {
    const map = generateMap();
    for (const r of map.resources) {
      expect(r.tx).toBeGreaterThanOrEqual(0);
      expect(r.ty).toBeGreaterThanOrEqual(0);
      expect(r.tx).toBeLessThan(map.width);
      expect(r.ty).toBeLessThan(map.height);
    }
  });

  it('no resource overlaps HQ footprint', () => {
    const map = generateMap();
    for (const r of map.resources) {
      const inHqX = r.tx >= map.hq.tx && r.tx < map.hq.tx + HQ_FOOTPRINT;
      const inHqY = r.ty >= map.hq.ty && r.ty < map.hq.ty + HQ_FOOTPRINT;
      expect(inHqX && inHqY).toBe(false);
    }
  });

  it('has an infinite deposit near map center', () => {
    const map = generateMap();
    const infinite = map.resources.filter((r) => r.type === 'infinite');
    expect(infinite.length).toBeGreaterThanOrEqual(1);
    const center = map.width / 2;
    for (const dep of infinite) {
      expect(Math.abs(dep.tx - center)).toBeLessThan(5);
      expect(Math.abs(dep.ty - center)).toBeLessThan(5);
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
      claim(`resource:${resource.type}`, resource.tx, resource.ty);
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

  // ── Stage B: Resource distribution tests ──────────────────────────────

  it('has many small resources near HQ', () => {
    const map = generateMap();
    const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
    const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
    const nearSmall = map.resources.filter(
      (r) => r.type === 'small' && Math.hypot(r.tx - hqCx, r.ty - hqCy) < START_CORE_RADIUS + 6,
    );
    expect(nearSmall.length).toBeGreaterThanOrEqual(3);
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

  it('no large or infinite resource inside start economy zone', () => {
    const map = generateMap();
    const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
    const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
    for (const r of map.resources) {
      if (r.type === 'large' || r.type === 'infinite') {
        const dist = Math.hypot(r.tx - hqCx, r.ty - hqCy);
        expect(dist).toBeGreaterThan(START_CORE_RADIUS);
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

  it('no obstacle overlaps a resource', () => {
    const map = generateMap();
    const resourceTiles = new Set(map.resources.map((r) => `${r.tx},${r.ty}`));
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
});
