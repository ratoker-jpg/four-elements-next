import { describe, it, expect } from 'vitest';
import {
  buildEditorOccupiedSet,
  isInBounds,
  isOverlapping,
  canPlace,
  placeResource,
  placeObstacle,
  placeDecor,
  findEntityAtTile,
  eraseAtTile,
  PALETTE_ITEMS,
} from '../../src/game/editor-state.js';
import type { MapData, ResourceType, ObstacleType, DecorType } from '../../src/game/map-types.js';
import { RESOURCE_FOOTPRINTS, OBSTACLE_FOOTPRINTS } from '../../src/game/map-types.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';

/** Create a minimal MapData for testing. */
function makeTestMap(overrides?: Partial<MapData>): MapData {
  return {
    width: 20,
    height: 20,
    terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
    hq: { tx: 8, ty: 8, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [],
    builders: [],
    constructionSites: [],
    ...overrides,
  };
}

describe('editor-state', () => {
  describe('buildEditorOccupiedSet', () => {
    it('includes HQ footprint tiles', () => {
      const map = makeTestMap();
      const occupied = buildEditorOccupiedSet(map);
      for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
        for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
          expect(occupied.has(`${map.hq.tx + dx},${map.hq.ty + dy}`)).toBe(true);
        }
      }
    });

    it('includes resource footprints', () => {
      const map = makeTestMap({
        resources: [{ tx: 0, ty: 0, type: 'infinite' as ResourceType, footprint: 3 }],
      });
      const occupied = buildEditorOccupiedSet(map);
      // 3x3 footprint: 9 tiles
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          expect(occupied.has(`${dx},${dy}`)).toBe(true);
        }
      }
    });

    it('includes obstacle footprints', () => {
      const map = makeTestMap({
        obstacles: [{ tx: 5, ty: 5, type: 'mountain-medium' as ObstacleType, footprint: 2 }],
      });
      const occupied = buildEditorOccupiedSet(map);
      expect(occupied.has('5,5')).toBe(true);
      expect(occupied.has('6,5')).toBe(true);
      expect(occupied.has('5,6')).toBe(true);
      expect(occupied.has('6,6')).toBe(true);
    });

    it('includes decor positions', () => {
      const map = makeTestMap({
        decor: [{ tx: 3, ty: 3, type: 'bush' as DecorType }],
      });
      const occupied = buildEditorOccupiedSet(map);
      expect(occupied.has('3,3')).toBe(true);
    });
  });

  describe('isInBounds', () => {
    it('returns true for valid 1x1 placement', () => {
      const map = makeTestMap();
      expect(isInBounds(map, 0, 0, 1)).toBe(true);
      expect(isInBounds(map, 19, 19, 1)).toBe(true);
    });

    it('returns false for out-of-bounds placement', () => {
      const map = makeTestMap();
      expect(isInBounds(map, -1, 0, 1)).toBe(false);
      expect(isInBounds(map, 0, -1, 1)).toBe(false);
      expect(isInBounds(map, 20, 0, 1)).toBe(false);
    });

    it('returns false for multi-tile placement exceeding bounds', () => {
      const map = makeTestMap();
      expect(isInBounds(map, 18, 18, 3)).toBe(false); // 18+3=21 > 20
      expect(isInBounds(map, 17, 17, 3)).toBe(true); // 17+3=20
    });
  });

  describe('isOverlapping', () => {
    it('returns false for empty occupied set', () => {
      expect(isOverlapping(new Set(), 5, 5, 1)).toBe(false);
    });

    it('returns true when a tile is occupied', () => {
      const occupied = new Set(['5,5']);
      expect(isOverlapping(occupied, 5, 5, 1)).toBe(true);
      expect(isOverlapping(occupied, 4, 4, 1)).toBe(false);
    });

    it('checks all tiles in a multi-tile footprint', () => {
      const occupied = new Set(['6,6']);
      // 3x3 at (5,5) covers 5-7,5-7 — includes 6,6
      expect(isOverlapping(occupied, 5, 5, 3)).toBe(true);
    });
  });

  describe('canPlace', () => {
    it('returns true for valid placement', () => {
      const map = makeTestMap();
      expect(canPlace(map, new Set(), 0, 0, 1)).toBe(true);
    });

    it('returns false for out-of-bounds', () => {
      const map = makeTestMap();
      expect(canPlace(map, new Set(), -1, 0, 1)).toBe(false);
    });

    it('returns false for overlapping', () => {
      const map = makeTestMap();
      const occupied = new Set(['5,5']);
      expect(canPlace(map, occupied, 5, 5, 1)).toBe(false);
    });
  });

  describe('placeResource', () => {
    it('places a small resource', () => {
      const map = makeTestMap();
      const result = placeResource(map, 0, 0, 'small');
      expect(result).toBe(true);
      expect(map.resources).toHaveLength(1);
      expect(map.resources[0]!.type).toBe('small');
      expect(map.resources[0]!.footprint).toBe(1);
    });

    it('places a resource with resourceNodes sync', () => {
      const map = makeTestMap();
      const resourceNodes: Array<{ tx: number; ty: number; type: ResourceType; infinite: boolean; remaining: number }> = [];
      const result = placeResource(map, 2, 3, 'medium', resourceNodes);
      expect(result).toBe(true);
      expect(map.resources).toHaveLength(1);
      expect(resourceNodes).toHaveLength(1);
      expect(resourceNodes[0]!.type).toBe('medium');
      expect(resourceNodes[0]!.infinite).toBe(false);
      expect(resourceNodes[0]!.remaining).toBe(100);
    });

    it('places an infinite resource with 3x3 footprint', () => {
      const map = makeTestMap();
      const result = placeResource(map, 0, 0, 'infinite');
      expect(result).toBe(true);
      expect(map.resources[0]!.footprint).toBe(3);
    });

    it('rejects placement overlapping HQ', () => {
      const map = makeTestMap();
      const result = placeResource(map, map.hq.tx, map.hq.ty, 'small');
      expect(result).toBe(false);
      expect(map.resources).toHaveLength(0);
    });

    it('rejects placement overlapping existing resource', () => {
      const map = makeTestMap({ resources: [{ tx: 0, ty: 0, type: 'small', footprint: 1 }] });
      const result = placeResource(map, 0, 0, 'small');
      expect(result).toBe(false);
      expect(map.resources).toHaveLength(1);
    });

    it('rejects out-of-bounds placement', () => {
      const map = makeTestMap();
      const result = placeResource(map, 19, 19, 'infinite');
      expect(result).toBe(false);
    });
  });

  describe('placeObstacle', () => {
    it('places a rock-cluster', () => {
      const map = makeTestMap();
      const result = placeObstacle(map, 0, 0, 'rock-cluster');
      expect(result).toBe(true);
      expect(map.obstacles).toHaveLength(1);
      expect(map.obstacles[0]!.footprint).toBe(1);
    });

    it('places a mountain-medium with 2x2 footprint', () => {
      const map = makeTestMap();
      const result = placeObstacle(map, 0, 0, 'mountain-medium');
      expect(result).toBe(true);
      expect(map.obstacles[0]!.footprint).toBe(2);
    });

    it('places a mountain-large with 3x3 footprint', () => {
      const map = makeTestMap();
      const result = placeObstacle(map, 0, 0, 'mountain-large');
      expect(result).toBe(true);
      expect(map.obstacles[0]!.footprint).toBe(3);
    });

    it('rejects placement overlapping HQ', () => {
      const map = makeTestMap();
      const result = placeObstacle(map, map.hq.tx, map.hq.ty, 'rock-cluster');
      expect(result).toBe(false);
    });
  });

  describe('placeDecor', () => {
    it('places a bush', () => {
      const map = makeTestMap();
      const result = placeDecor(map, 0, 0, 'bush');
      expect(result).toBe(true);
      expect(map.decor).toHaveLength(1);
      expect(map.decor[0]!.type).toBe('bush');
    });

    it('prevents visual stacking on existing decor', () => {
      const map = makeTestMap({ decor: [{ tx: 0, ty: 0, type: 'bush' }] });
      const result = placeDecor(map, 0, 0, 'sand-bump');
      expect(result).toBe(false);
    });

    it('prevents visual stacking on resource', () => {
      const map = makeTestMap({ resources: [{ tx: 0, ty: 0, type: 'small', footprint: 1 }] });
      const result = placeDecor(map, 0, 0, 'bush');
      expect(result).toBe(false);
    });
  });

  describe('findEntityAtTile', () => {
    it('finds a resource', () => {
      const map = makeTestMap({ resources: [{ tx: 5, ty: 5, type: 'small', footprint: 1 }] });
      const result = findEntityAtTile(map, 5, 5);
      expect(result).not.toBeNull();
      expect(result!.kind).toBe('resource');
      expect(result!.index).toBe(0);
    });

    it('finds a multi-tile resource by any tile in footprint', () => {
      const map = makeTestMap({ resources: [{ tx: 2, ty: 2, type: 'infinite', footprint: 3 }] });
      // (2,2), (3,2), (4,2), (2,3), (3,3), (4,3), (2,4), (3,4), (4,4)
      expect(findEntityAtTile(map, 3, 3)!.kind).toBe('resource');
      expect(findEntityAtTile(map, 4, 4)!.kind).toBe('resource');
    });

    it('finds an obstacle', () => {
      const map = makeTestMap({ obstacles: [{ tx: 3, ty: 3, type: 'rock-cluster', footprint: 1 }] });
      const result = findEntityAtTile(map, 3, 3);
      expect(result).not.toBeNull();
      expect(result!.kind).toBe('obstacle');
    });

    it('finds decor', () => {
      const map = makeTestMap({ decor: [{ tx: 7, ty: 7, type: 'bush' }] });
      const result = findEntityAtTile(map, 7, 7);
      expect(result).not.toBeNull();
      expect(result!.kind).toBe('decor');
    });

    it('prioritizes resource over obstacle over decor', () => {
      const map = makeTestMap({
        resources: [{ tx: 1, ty: 1, type: 'small', footprint: 1 }],
        obstacles: [{ tx: 1, ty: 1, type: 'rock-cluster', footprint: 1 }],
        decor: [{ tx: 1, ty: 1, type: 'bush' }],
      });
      // This shouldn't happen in practice (overlap check prevents it),
      // but if it does, resource has highest priority.
      const result = findEntityAtTile(map, 1, 1);
      expect(result!.kind).toBe('resource');
    });

    it('returns null for empty tile', () => {
      const map = makeTestMap();
      expect(findEntityAtTile(map, 0, 0)).toBeNull();
    });
  });

  describe('eraseAtTile', () => {
    it('erases a resource and syncs resourceNodes', () => {
      const map = makeTestMap({ resources: [{ tx: 5, ty: 5, type: 'small', footprint: 1 }] });
      const resourceNodes = [{ tx: 5, ty: 5, type: 'small' as ResourceType, infinite: false, remaining: 50 }];
      const result = eraseAtTile(map, 5, 5, resourceNodes);
      expect(result).toBe(true);
      expect(map.resources).toHaveLength(0);
      expect(resourceNodes).toHaveLength(0);
    });

    it('erases an obstacle', () => {
      const map = makeTestMap({ obstacles: [{ tx: 3, ty: 3, type: 'rock-cluster', footprint: 1 }] });
      const result = eraseAtTile(map, 3, 3);
      expect(result).toBe(true);
      expect(map.obstacles).toHaveLength(0);
    });

    it('erases decor', () => {
      const map = makeTestMap({ decor: [{ tx: 7, ty: 7, type: 'bush' }] });
      const result = eraseAtTile(map, 7, 7);
      expect(result).toBe(true);
      expect(map.decor).toHaveLength(0);
    });

    it('erases multi-tile entity by clicking any tile in footprint', () => {
      const map = makeTestMap({ resources: [{ tx: 2, ty: 2, type: 'infinite', footprint: 3 }] });
      const result = eraseAtTile(map, 4, 4);
      expect(result).toBe(true);
      expect(map.resources).toHaveLength(0);
    });

    it('returns false for empty tile', () => {
      const map = makeTestMap();
      const result = eraseAtTile(map, 0, 0);
      expect(result).toBe(false);
    });

    it('maintains index correlation after add/remove cycles', () => {
      const map = makeTestMap();
      const resourceNodes: Array<{ tx: number; ty: number; type: ResourceType; infinite: boolean; remaining: number }> = [];

      // Place two resources
      placeResource(map, 0, 0, 'small', resourceNodes);
      placeResource(map, 1, 0, 'medium', resourceNodes);

      expect(map.resources).toHaveLength(2);
      expect(resourceNodes).toHaveLength(2);
      expect(map.resources[0]!.type).toBe('small');
      expect(resourceNodes[0]!.type).toBe('small');
      expect(map.resources[1]!.type).toBe('medium');
      expect(resourceNodes[1]!.type).toBe('medium');

      // Erase first resource
      eraseAtTile(map, 0, 0, resourceNodes);
      expect(map.resources).toHaveLength(1);
      expect(resourceNodes).toHaveLength(1);
      expect(map.resources[0]!.type).toBe('medium');
      expect(resourceNodes[0]!.type).toBe('medium');
    });
  });

  describe('PALETTE_ITEMS', () => {
    it('has 10 items total (4 resource + 4 obstacle + 2 decor)', () => {
      expect(PALETTE_ITEMS).toHaveLength(10);
    });

    it('has correct resource types', () => {
      const resourceItems = PALETTE_ITEMS.filter(i => i.group === 'resource');
      expect(resourceItems).toHaveLength(4);
      const types = resourceItems.map(i => i.type);
      expect(types).toContain('small');
      expect(types).toContain('medium');
      expect(types).toContain('large');
      expect(types).toContain('infinite');
    });

    it('has correct obstacle types', () => {
      const obstacleItems = PALETTE_ITEMS.filter(i => i.group === 'obstacle');
      expect(obstacleItems).toHaveLength(4);
      const types = obstacleItems.map(i => i.type);
      expect(types).toContain('rock-cluster');
      expect(types).toContain('mountain-small');
      expect(types).toContain('mountain-medium');
      expect(types).toContain('mountain-large');
    });

    it('has correct decor types', () => {
      const decorItems = PALETTE_ITEMS.filter(i => i.group === 'decor');
      expect(decorItems).toHaveLength(2);
      const types = decorItems.map(i => i.type);
      expect(types).toContain('bush');
      expect(types).toContain('sand-bump');
    });

    it('has no volcano entries', () => {
      const hasVolcano = PALETTE_ITEMS.some(i =>
        (i.type as string).includes('volcano'),
      );
      expect(hasVolcano).toBe(false);
    });

    it('resource footprints match RESOURCE_FOOTPRINTS', () => {
      const resourceItems = PALETTE_ITEMS.filter(i => i.group === 'resource');
      for (const item of resourceItems) {
        expect(item.footprint).toBe(RESOURCE_FOOTPRINTS[item.type as ResourceType]);
      }
    });

    it('obstacle footprints match OBSTACLE_FOOTPRINTS', () => {
      const obstacleItems = PALETTE_ITEMS.filter(i => i.group === 'obstacle');
      for (const item of obstacleItems) {
        expect(item.footprint).toBe(OBSTACLE_FOOTPRINTS[item.type as ObstacleType]);
      }
    });
  });
});
