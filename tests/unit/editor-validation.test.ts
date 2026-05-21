import { describe, it, expect } from 'vitest';
import {
  validateEditorMap,
  getPlacementRejectionReason,
} from '../../src/game/editor-validation.js';
import type { MapData, ResourceType, ObstacleType, DecorType } from '../../src/game/map-types.js';
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

/** Create a valid map with at least one resource. */
function makeValidMap(): MapData {
  return makeTestMap({
    resources: [
      { tx: 5, ty: 5, type: 'small' as ResourceType, footprint: 1 },
    ],
  });
}

describe('editor-validation', () => {
  describe('getPlacementRejectionReason', () => {
    it('returns null for valid placement', () => {
      const map = makeValidMap();
      const reason = getPlacementRejectionReason(map, 0, 0, 1);
      expect(reason).toBeNull();
    });

    it('returns "Выходит за границы карты" for out-of-bounds placement', () => {
      const map = makeValidMap();
      const reason = getPlacementRejectionReason(map, -1, 0, 1);
      expect(reason).toBe('Выходит за границы карты');
    });

    it('returns "Выходит за границы карты" for placement exceeding map edge', () => {
      const map = makeValidMap();
      const reason = getPlacementRejectionReason(map, 19, 19, 3);
      expect(reason).toBe('Выходит за границы карты');
    });

    it('returns "Перекрывает занятую клетку" for overlapping HQ', () => {
      const map = makeValidMap();
      const reason = getPlacementRejectionReason(map, map.hq.tx, map.hq.ty, 1);
      expect(reason).toBe('Перекрывает занятую клетку');
    });

    it('returns "Перекрывает занятую клетку" for overlapping existing resource', () => {
      const map = makeTestMap({
        resources: [{ tx: 3, ty: 3, type: 'small' as ResourceType, footprint: 1 }],
      });
      const reason = getPlacementRejectionReason(map, 3, 3, 1);
      expect(reason).toBe('Перекрывает занятую клетку');
    });

    it('returns "Перекрывает занятую клетку" for overlapping existing obstacle', () => {
      const map = makeTestMap({
        resources: [{ tx: 0, ty: 0, type: 'small' as ResourceType, footprint: 1 }],
        obstacles: [{ tx: 3, ty: 3, type: 'rock-cluster' as ObstacleType, footprint: 1 }],
      });
      const reason = getPlacementRejectionReason(map, 3, 3, 1);
      expect(reason).toBe('Перекрывает занятую клетку');
    });
  });

  describe('validateEditorMap', () => {
    it('returns ok with no editor-specific errors for a valid generated map', () => {
      const map = makeValidMap();
      const result = validateEditorMap(map);
      // Generated map with one resource should have no editor-specific errors
      // (may still have warnings from validateMap like partial reachability)
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error when no resources exist', () => {
      const map = makeTestMap(); // No resources
      const result = validateEditorMap(map);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('Нет ресурсов на карте');
    });

    it('returns error when a resource is out of bounds', () => {
      const map = makeTestMap({
        resources: [{ tx: 19, ty: 19, type: 'infinite' as ResourceType, footprint: 3 }],
      });
      const result = validateEditorMap(map);
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('выходит за границы карты'))).toBe(true);
    });

    it('returns error when an obstacle is out of bounds', () => {
      const map = makeTestMap({
        resources: [{ tx: 0, ty: 0, type: 'small' as ResourceType, footprint: 1 }],
        obstacles: [{ tx: 19, ty: 19, type: 'mountain-large' as ObstacleType, footprint: 3 }],
      });
      const result = validateEditorMap(map);
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('Препятствие') && e.includes('выходит за границы карты'))).toBe(true);
    });

    it('returns error when decor is out of bounds', () => {
      const map = makeTestMap({
        resources: [{ tx: 0, ty: 0, type: 'small' as ResourceType, footprint: 1 }],
        decor: [{ tx: 20, ty: 5, type: 'bush' as DecorType }],
      });
      const result = validateEditorMap(map);
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('Декор') && e.includes('выходит за границы карты'))).toBe(true);
    });

    it('returns error when resources overlap each other', () => {
      const map = makeTestMap({
        resources: [
          { tx: 5, ty: 5, type: 'small' as ResourceType, footprint: 1 },
          { tx: 5, ty: 5, type: 'medium' as ResourceType, footprint: 1 },
        ],
      });
      const result = validateEditorMap(map);
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('перекрывает'))).toBe(true);
    });

    it('returns error when obstacle overlaps resource', () => {
      const map = makeTestMap({
        resources: [{ tx: 3, ty: 3, type: 'small' as ResourceType, footprint: 1 }],
        obstacles: [{ tx: 3, ty: 3, type: 'rock-cluster' as ObstacleType, footprint: 1 }],
      });
      const result = validateEditorMap(map);
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('перекрывает'))).toBe(true);
    });

    it('returns warnings from validateMap', () => {
      // A map with only one resource far from HQ may generate reachability warnings
      const map = makeTestMap({
        resources: [{ tx: 0, ty: 0, type: 'small' as ResourceType, footprint: 1 }],
      });
      const result = validateEditorMap(map);
      // The result may have warnings about starter resource reachability
      // Just check the structure is correct — warnings is an array
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('includes base validateMap errors for start core blocked', () => {
      // Place a large obstacle in the start core zone
      const map = makeTestMap({
        resources: [{ tx: 0, ty: 0, type: 'small' as ResourceType, footprint: 1 }],
        obstacles: [{ tx: 9, ty: 9, type: 'mountain-large' as ObstacleType, footprint: 3 }],
      });
      const result = validateEditorMap(map);
      // This should trigger start-core-blocked error from validateMap
      // plus overlap errors from editor validation
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
