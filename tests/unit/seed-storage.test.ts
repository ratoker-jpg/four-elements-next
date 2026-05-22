/**
 * MAP-EDITOR-ARCH-01 PR8 — Unit tests for seed-storage.
 *
 * Tests all storage CRUD operations including edge cases:
 * - Empty / corrupt / mismatched storage
 * - Save, dedup, cap, delete
 * - Write failure handling
 *
 * Uses SeedStorageAdapter with an in-memory Map instead of real localStorage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSavedSeeds,
  saveSeed,
  deleteSavedSeed,
  filterByMapSize,
  setSeedStorageAdapter,
  type SavedSeed,
  type SeedStorageAdapter,
} from '../../src/game/seed-storage.js';

const STORAGE_KEY = 'four-elements-next.saved-seeds.v1';

/** In-memory storage adapter for testing. */
function createMemoryAdapter(): SeedStorageAdapter & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
  };
}

/** Helper to set storage envelope directly. */
function setEnvelope(adapter: SeedStorageAdapter, seeds: SavedSeed[], version = 1): void {
  adapter.setItem(STORAGE_KEY, JSON.stringify({ version, seeds }));
}

describe('seed-storage', () => {
  let adapter: ReturnType<typeof createMemoryAdapter>;

  beforeEach(() => {
    adapter = createMemoryAdapter();
    setSeedStorageAdapter(adapter);
  });

  // ── loadSavedSeeds ───────────────────────────────────────────────

  describe('loadSavedSeeds', () => {
    it('returns [] when storage is empty', () => {
      expect(loadSavedSeeds()).toEqual([]);
    });

    it('returns [] when stored value is invalid JSON', () => {
      adapter.store.set(STORAGE_KEY, '{not valid json');
      expect(loadSavedSeeds()).toEqual([]);
    });

    it('returns [] when envelope version does not match', () => {
      setEnvelope(adapter, [], 999);
      expect(loadSavedSeeds()).toEqual([]);
    });

    it('returns [] when envelope has malformed shape (seeds is not an array)', () => {
      adapter.setItem(STORAGE_KEY, JSON.stringify({ version: 1, seeds: 'not-array' }));
      expect(loadSavedSeeds()).toEqual([]);
    });

    it('returns [] when an entry has a wrong field type', () => {
      const badSeeds = [{ id: 123, seed: 42, mapSize: 'standard', mapgenPresetId: 'balanced', createdAt: Date.now() }];
      adapter.setItem(STORAGE_KEY, JSON.stringify({ version: 1, seeds: badSeeds }));
      expect(loadSavedSeeds()).toEqual([]);
    });

    it('returns entries sorted newest-first by createdAt', () => {
      const now = Date.now();
      const seeds: SavedSeed[] = [
        { id: 'a', seed: 1, mapSize: 'standard', mapgenPresetId: 'balanced', createdAt: now - 2000 },
        { id: 'b', seed: 2, mapSize: 'standard', mapgenPresetId: 'balanced', createdAt: now },
        { id: 'c', seed: 3, mapSize: 'standard', mapgenPresetId: 'balanced', createdAt: now - 1000 },
      ];
      setEnvelope(adapter, seeds);
      const result = loadSavedSeeds();
      expect(result.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    });
  });

  // ── saveSeed ─────────────────────────────────────────────────────

  describe('saveSeed', () => {
    it('creates an entry in storage', () => {
      const ok = saveSeed(42, 'standard', 'balanced');
      expect(ok).toBe(true);
      const seeds = loadSavedSeeds();
      expect(seeds.length).toBe(1);
      expect(seeds[0].seed).toBe(42);
      expect(seeds[0].mapSize).toBe('standard');
      expect(seeds[0].mapgenPresetId).toBe('balanced');
      expect(typeof seeds[0].id).toBe('string');
      expect(seeds[0].id.length).toBeGreaterThan(0);
      expect(typeof seeds[0].createdAt).toBe('number');
    });

    it('deduplicates on same seed + mapSize + mapgenPresetId and moves newest first', () => {
      saveSeed(42, 'standard', 'balanced');
      const first = loadSavedSeeds();
      expect(first.length).toBe(1);

      // Save again with same combo
      saveSeed(42, 'standard', 'balanced');
      const second = loadSavedSeeds();
      expect(second.length).toBe(1); // still 1 entry, not 2
      expect(second[0].createdAt).toBeGreaterThanOrEqual(first[0].createdAt);
    });

    it('keeps different seed/mapSize/preset as separate entries', () => {
      saveSeed(1, 'standard', 'balanced');
      saveSeed(2, 'standard', 'balanced');
      saveSeed(1, 'large', 'balanced');
      saveSeed(1, 'standard', 'more-resources');
      const seeds = loadSavedSeeds();
      expect(seeds.length).toBe(4);
    });

    it('caps at 20 entries by dropping oldest from the end', () => {
      // Add 22 entries
      for (let i = 1; i <= 22; i++) {
        saveSeed(i, 'standard', 'balanced');
      }
      const seeds = loadSavedSeeds();
      expect(seeds.length).toBe(20);
      // The newest entry (seed=22) should be first
      expect(seeds[0].seed).toBe(22);
      // The oldest surviving entry should be seed=3 (1 and 2 dropped)
      expect(seeds[19].seed).toBe(3);
    });

    it('returns false when storage write fails', () => {
      // Replace adapter with one that throws on setItem
      const failAdapter: SeedStorageAdapter = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); },
      };
      setSeedStorageAdapter(failAdapter);
      const ok = saveSeed(42, 'standard', 'balanced');
      expect(ok).toBe(false);
    });
  });

  // ── deleteSavedSeed ──────────────────────────────────────────────

  describe('deleteSavedSeed', () => {
    it('removes entry by id', () => {
      saveSeed(42, 'standard', 'balanced');
      const seeds = loadSavedSeeds();
      expect(seeds.length).toBe(1);
      const ok = deleteSavedSeed(seeds[0].id);
      expect(ok).toBe(true);
      expect(loadSavedSeeds()).toEqual([]);
    });

    it('is a no-op when id is not found', () => {
      saveSeed(42, 'standard', 'balanced');
      const ok = deleteSavedSeed('nonexistent-id');
      expect(ok).toBe(true);
      expect(loadSavedSeeds().length).toBe(1);
    });

    it('is a no-op when storage is empty', () => {
      const ok = deleteSavedSeed('any-id');
      expect(ok).toBe(true);
    });
  });

  // ── filterByMapSize ──────────────────────────────────────────────

  describe('filterByMapSize', () => {
    it('returns only entries matching the given mapSize', () => {
      const now = Date.now();
      const seeds: SavedSeed[] = [
        { id: 'a', seed: 1, mapSize: 'standard', mapgenPresetId: 'balanced', createdAt: now },
        { id: 'b', seed: 2, mapSize: 'large', mapgenPresetId: 'balanced', createdAt: now },
        { id: 'c', seed: 3, mapSize: 'standard', mapgenPresetId: 'more-resources', createdAt: now },
      ];
      const standard = filterByMapSize(seeds, 'standard');
      expect(standard.length).toBe(2);
      expect(standard.every((s) => s.mapSize === 'standard')).toBe(true);

      const large = filterByMapSize(seeds, 'large');
      expect(large.length).toBe(1);
      expect(large[0].id).toBe('b');
    });

    it('returns empty array when no entries match', () => {
      const now = Date.now();
      const seeds: SavedSeed[] = [
        { id: 'a', seed: 1, mapSize: 'standard', mapgenPresetId: 'balanced', createdAt: now },
      ];
      expect(filterByMapSize(seeds, 'large')).toEqual([]);
    });
  });

  // ── Corrupt storage does not crash ───────────────────────────────

  describe('corrupt storage', () => {
    it('null envelope does not crash', () => {
      adapter.store.set(STORAGE_KEY, 'null');
      expect(loadSavedSeeds()).toEqual([]);
    });

    it('array instead of object does not crash', () => {
      adapter.store.set(STORAGE_KEY, '[1,2,3]');
      expect(loadSavedSeeds()).toEqual([]);
    });

    it('string value does not crash', () => {
      adapter.store.set(STORAGE_KEY, '"hello"');
      expect(loadSavedSeeds()).toEqual([]);
    });
  });
});
