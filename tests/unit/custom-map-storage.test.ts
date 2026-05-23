/**
 * MAP-EDITOR-ARCH-01 PR9 — Unit tests for custom-map-storage.
 *
 * Tests all storage CRUD operations including edge cases:
 * - Empty / corrupt / mismatched storage
 * - Save, update, cap, delete, load by id
 * - Write failure handling
 * - MapData shape validation on load
 * - Deep-clone independence
 * - Name auto-generation
 * - Normalization of missing gameplay arrays
 *
 * Uses CustomMapStorageAdapter with an in-memory Map instead of real localStorage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSavedMaps,
  saveCustomMap,
  deleteSavedMap,
  loadSavedMapById,
  setCustomMapStorageAdapter,
  type SavedCustomMap,
  type CustomMapStorageAdapter,
} from '../../src/game/custom-map-storage.js';
import type { MapData } from '../../src/game/map-types.js';

const STORAGE_KEY = 'four-elements-next.custom-maps.v1';

/** Minimal valid MapData for testing. */
function makeTestMap(overrides?: Partial<MapData>): MapData {
  return {
    width: 40,
    height: 40,
    terrain: [['sand']],
    hq: { tx: 5, ty: 5, faction: 'cyan' },
    resources: [
      { tx: 10, ty: 10, type: 'small', footprint: 1 },
    ],
    obstacles: [
      { tx: 20, ty: 20, type: 'mountain-small', footprint: 1 },
    ],
    decor: [
      { tx: 15, ty: 15, type: 'bush' },
    ],
    buildings: [],
    builders: [],
    constructionSites: [],
    ...overrides,
  };
}

/** In-memory storage adapter for testing. */
function createMemoryAdapter(): CustomMapStorageAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
  };
}

/** Helper to set storage envelope directly. */
function setEnvelope(adapter: CustomMapStorageAdapter, maps: SavedCustomMap[], version = 1): void {
  adapter.setItem(STORAGE_KEY, JSON.stringify({ version, maps }));
}

describe('custom-map-storage', () => {
  let adapter: ReturnType<typeof createMemoryAdapter>;

  beforeEach(() => {
    adapter = createMemoryAdapter();
    setCustomMapStorageAdapter(adapter);
  });

  // ── loadSavedMaps ───────────────────────────────────────────────

  describe('loadSavedMaps', () => {
    it('returns [] when storage is empty', () => {
      expect(loadSavedMaps()).toEqual([]);
    });

    it('returns [] when stored value is invalid JSON', () => {
      adapter.store.set(STORAGE_KEY, '{not valid json');
      expect(loadSavedMaps()).toEqual([]);
    });

    it('returns [] when envelope version does not match', () => {
      setEnvelope(adapter, [], 999);
      expect(loadSavedMaps()).toEqual([]);
    });

    it('returns [] when envelope has malformed shape (maps is not an array)', () => {
      adapter.setItem(STORAGE_KEY, JSON.stringify({ version: 1, maps: 'not-array' }));
      expect(loadSavedMaps()).toEqual([]);
    });

    it('returns [] when an entry has a wrong field type', () => {
      const badMaps = [{ id: 123, name: 'Test', map: makeTestMap(), createdAt: Date.now(), updatedAt: Date.now() }];
      adapter.setItem(STORAGE_KEY, JSON.stringify({ version: 1, maps: badMaps }));
      expect(loadSavedMaps()).toEqual([]);
    });

    it('returns [] when map data has invalid shape (missing width)', () => {
      const badMap = { height: 40, terrain: [], hq: { tx: 0, ty: 0, faction: 'cyan' }, resources: [], obstacles: [], decor: [] };
      const badMaps = [{ id: 'a', name: 'Test', map: badMap, createdAt: Date.now(), updatedAt: Date.now() }];
      adapter.setItem(STORAGE_KEY, JSON.stringify({ version: 1, maps: badMaps }));
      expect(loadSavedMaps()).toEqual([]);
    });

    it('returns entries sorted newest-first by updatedAt', () => {
      const now = Date.now();
      const maps: SavedCustomMap[] = [
        { id: 'a', name: 'Карта 1', map: makeTestMap(), createdAt: now - 2000, updatedAt: now - 2000 },
        { id: 'b', name: 'Карта 2', map: makeTestMap(), createdAt: now, updatedAt: now },
        { id: 'c', name: 'Карта 3', map: makeTestMap(), createdAt: now - 1000, updatedAt: now - 1000 },
      ];
      setEnvelope(adapter, maps);
      const result = loadSavedMaps();
      expect(result.map((m) => m.id)).toEqual(['b', 'c', 'a']);
    });
  });

  // ── saveCustomMap ───────────────────────────────────────────────

  describe('saveCustomMap', () => {
    it('creates a new entry in storage', () => {
      const id = saveCustomMap(makeTestMap());
      expect(id).not.toBeNull();
      expect(typeof id).toBe('string');

      const maps = loadSavedMaps();
      expect(maps.length).toBe(1);
      expect(maps[0].id).toBe(id);
      expect(maps[0].name).toBe('Карта 1');
      expect(maps[0].map.width).toBe(40);
      expect(maps[0].map.resources.length).toBe(1);
    });

    it('auto-generates sequential names', () => {
      saveCustomMap(makeTestMap());
      saveCustomMap(makeTestMap());
      saveCustomMap(makeTestMap());

      const maps = loadSavedMaps();
      const names = maps.map((m) => m.name);
      expect(names).toContain('Карта 1');
      expect(names).toContain('Карта 2');
      expect(names).toContain('Карта 3');
    });

    it('updates existing entry when id is provided', () => {
      const id = saveCustomMap(makeTestMap());
      expect(id).not.toBeNull();

      const before = loadSavedMaps();
      expect(before.length).toBe(1);
      const originalCreatedAt = before[0].createdAt;

      // Update with different map
      const updatedId = saveCustomMap(
        makeTestMap({ width: 60, height: 60 }),
        { id: id! },
      );
      expect(updatedId).toBe(id);

      const after = loadSavedMaps();
      expect(after.length).toBe(1); // still 1 entry
      expect(after[0].map.width).toBe(60);
      expect(after[0].createdAt).toBe(originalCreatedAt);
      expect(after[0].updatedAt).toBeGreaterThanOrEqual(originalCreatedAt);
    });

    it('preserves custom name on update', () => {
      const id = saveCustomMap(makeTestMap(), { name: 'Моя карта' });
      const updatedId = saveCustomMap(makeTestMap(), { id: id! });
      const maps = loadSavedMaps();
      expect(maps[0].name).toBe('Моя карта'); // name preserved
    });

    it('caps at 20 entries by dropping oldest from the end', () => {
      // Add 22 entries
      const ids: string[] = [];
      for (let i = 0; i < 22; i++) {
        const id = saveCustomMap(makeTestMap());
        expect(id).not.toBeNull();
        ids.push(id!);
      }
      const maps = loadSavedMaps();
      expect(maps.length).toBe(20);
    });

    it('returns null when storage write fails', () => {
      const failAdapter: CustomMapStorageAdapter = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => {},
      };
      setCustomMapStorageAdapter(failAdapter);
      const id = saveCustomMap(makeTestMap());
      expect(id).toBeNull();
    });

    it('deep-clones map data on save (stored copy is independent)', () => {
      const map = makeTestMap();
      const id = saveCustomMap(map);

      // Mutate the original
      map.resources.push({ tx: 30, ty: 30, type: 'large', footprint: 1 });

      // Reload from storage — should not have the extra resource
      const saved = loadSavedMapById(id!);
      expect(saved).not.toBeNull();
      expect(saved!.map.resources.length).toBe(1); // original count
    });
  });

  // ── deleteSavedMap ──────────────────────────────────────────────

  describe('deleteSavedMap', () => {
    it('removes entry by id', () => {
      const id = saveCustomMap(makeTestMap());
      expect(loadSavedMaps().length).toBe(1);
      const ok = deleteSavedMap(id!);
      expect(ok).toBe(true);
      expect(loadSavedMaps()).toEqual([]);
    });

    it('is a no-op when id is not found', () => {
      saveCustomMap(makeTestMap());
      const ok = deleteSavedMap('nonexistent-id');
      expect(ok).toBe(true);
      expect(loadSavedMaps().length).toBe(1);
    });

    it('is a no-op when storage is empty', () => {
      const ok = deleteSavedMap('any-id');
      expect(ok).toBe(true);
    });
  });

  // ── loadSavedMapById ────────────────────────────────────────────

  describe('loadSavedMapById', () => {
    it('returns the map with the given id', () => {
      const id1 = saveCustomMap(makeTestMap({ width: 30 }));
      const id2 = saveCustomMap(makeTestMap({ width: 50 }));

      const map = loadSavedMapById(id2!);
      expect(map).not.toBeNull();
      expect(map!.id).toBe(id2);
      expect(map!.map.width).toBe(50);
    });

    it('returns null when id is not found', () => {
      saveCustomMap(makeTestMap());
      expect(loadSavedMapById('nonexistent')).toBeNull();
    });

    it('returns null when storage is empty', () => {
      expect(loadSavedMapById('any-id')).toBeNull();
    });
  });

  // ── Normalization ──────────────────────────────────────────────

  describe('normalization', () => {
    it('normalizes missing buildings array to empty array', () => {
      // Manually create a map without buildings
      const mapData = makeTestMap();
      // Simulate a saved entry without buildings/builders/constructionSites
      const rawEntry = {
        id: 'test-id',
        name: 'Test',
        map: {
          width: 40,
          height: 40,
          terrain: [['sand']],
          hq: { tx: 5, ty: 5, faction: 'cyan' },
          resources: [],
          obstacles: [],
          decor: [],
          // buildings, builders, constructionSites are missing
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      adapter.setItem(STORAGE_KEY, JSON.stringify({ version: 1, maps: [rawEntry] }));

      const maps = loadSavedMaps();
      expect(maps.length).toBe(1);
      expect(maps[0].map.buildings).toEqual([]);
      expect(maps[0].map.builders).toEqual([]);
      expect(maps[0].map.constructionSites).toEqual([]);
    });
  });

  // ── Deep-clone on load ─────────────────────────────────────────

  describe('deep-clone on load', () => {
    it('loaded map data is independent from storage', () => {
      saveCustomMap(makeTestMap());
      const maps1 = loadSavedMaps();

      // Mutate the loaded copy
      maps1[0].map.resources.push({ tx: 99, ty: 99, type: 'large', footprint: 1 });

      // Reload — should not have the mutation
      const maps2 = loadSavedMaps();
      expect(maps2[0].map.resources.length).toBe(1);
    });
  });

  // ── Corrupt storage does not crash ─────────────────────────────

  describe('corrupt storage', () => {
    it('null envelope does not crash', () => {
      adapter.store.set(STORAGE_KEY, 'null');
      expect(loadSavedMaps()).toEqual([]);
    });

    it('array instead of object does not crash', () => {
      adapter.store.set(STORAGE_KEY, '[1,2,3]');
      expect(loadSavedMaps()).toEqual([]);
    });

    it('string value does not crash', () => {
      adapter.store.set(STORAGE_KEY, '"hello"');
      expect(loadSavedMaps()).toEqual([]);
    });

    it('map with invalid hq does not crash', () => {
      const badEntry = {
        id: 'a',
        name: 'Test',
        map: { width: 40, height: 40, terrain: [], hq: null, resources: [], obstacles: [], decor: [] },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      adapter.setItem(STORAGE_KEY, JSON.stringify({ version: 1, maps: [badEntry] }));
      expect(loadSavedMaps()).toEqual([]);
    });

    it('delete on corrupt storage does not crash', () => {
      adapter.store.set(STORAGE_KEY, 'not json');
      expect(deleteSavedMap('any-id')).toBe(true);
    });
  });

  // ── Name generation ──────────────────────────────────────────────

  describe('name generation', () => {
    it('fills gaps in numbering after deletion', () => {
      const id1 = saveCustomMap(makeTestMap());
      const id2 = saveCustomMap(makeTestMap());
      const id3 = saveCustomMap(makeTestMap());

      // Delete "Карта 2"
      deleteSavedMap(id2!);

      // Next save should reuse "Карта 2" gap
      const id4 = saveCustomMap(makeTestMap());
      const maps = loadSavedMaps();
      const names = maps.map((m) => m.name);
      expect(names).toContain('Карта 2');
    });
  });
});
