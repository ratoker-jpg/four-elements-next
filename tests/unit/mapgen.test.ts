import { describe, it, expect } from 'vitest';
import { getBuildingFootprint } from '../../src/config/buildings.js';
import { generateMap } from '../../src/game/mapgen.js';
import { HQ_FOOTPRINT, MAP_SIZE_STANDARD } from '../../src/core/constants.js';

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
    expect(a.decor.length).toBe(b.decor.length);
  });

  it('terrain grid matches dimensions', () => {
    const map = generateMap();
    expect(map.terrain.length).toBe(map.height);
    for (const row of map.terrain) {
      expect(row.length).toBe(map.width);
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

  it('pre-placed buildings occupy full footprints without overlaps', () => {
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

    for (const building of map.buildings) {
      const footprint = getBuildingFootprint(building.type);
      expect(footprint).toBe(2);
      for (let dy = 0; dy < footprint; dy++) {
        for (let dx = 0; dx < footprint; dx++) {
          claim(building.type, building.tx + dx, building.ty + dy);
        }
      }
    }

    for (const builder of map.builders) {
      claim('builder', builder.tx, builder.ty);
    }
    for (const resource of map.resources) {
      claim(`resource:${resource.type}`, resource.tx, resource.ty);
    }
    for (const decor of map.decor) {
      claim(`decor:${decor.type}`, decor.tx, decor.ty);
    }
  });
});
