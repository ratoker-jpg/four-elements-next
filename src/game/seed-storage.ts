/**
 * MAP-EDITOR-ARCH-01 PR8 — Saved seeds / seed list.
 *
 * localStorage CRUD for saved seed entries.
 * Used by Seed Screen to persist, load, and delete saved seeds.
 *
 * Storage schema:
 *   Key: four-elements-next.saved-seeds.v1
 *   Envelope: { version: 1, seeds: SavedSeed[] }
 *   SavedSeed: { id, seed, mapSize, mapgenPresetId, createdAt }
 *
 * Design decisions:
 * - Versioned envelope for future migration.
 * - Dedup by (seed, mapSize, mapgenPresetId): on duplicate, update createdAt
 *   and move to top.
 * - Cap at 20 entries, dropping oldest from the end.
 * - Safe id generation: crypto.randomUUID with fallback.
 * - localStorage failures never throw; operations return safe defaults.
 * - Storage adapter pattern: production uses localStorage, tests inject a Map.
 */

import type { MapgenPresetId } from './mapgen-presets.js';

/** localStorage key — versioned for future migration. */
const STORAGE_KEY = 'four-elements-next.saved-seeds.v1';

/** Current envelope version. */
const STORAGE_VERSION = 1;

/** Maximum number of saved seed entries. Oldest are dropped from the end. */
const MAX_SAVED_SEEDS = 20;

/** A persisted seed entry. */
export interface SavedSeed {
  readonly id: string;
  readonly seed: number;
  readonly mapSize: 'standard' | 'large';
  readonly mapgenPresetId: MapgenPresetId;
  /** Unix epoch milliseconds. */
  readonly createdAt: number;
}

/** Envelope stored in localStorage. */
interface SavedSeedsEnvelope {
  readonly version: number;
  readonly seeds: SavedSeed[];
}

/** Storage adapter — abstracts localStorage for testability. */
export interface SeedStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Production adapter using real localStorage. */
const localStorageAdapter: SeedStorageAdapter = {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  },
};

/** Currently active storage adapter. */
let activeAdapter: SeedStorageAdapter = localStorageAdapter;

/**
 * Override the storage adapter (for testing).
 * Pass null to reset to the default localStorage adapter.
 */
export function setSeedStorageAdapter(adapter: SeedStorageAdapter | null): void {
  activeAdapter = adapter ?? localStorageAdapter;
}

/**
 * Generate a unique ID using crypto.randomUUID if available,
 * falling back to a timestamp + random string.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random chars
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Safely read the envelope from the storage adapter.
 * Returns null on any failure (missing key, invalid JSON, wrong version, etc.).
 */
function readEnvelope(): SavedSeedsEnvelope | null {
  try {
    const raw = activeAdapter.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== STORAGE_VERSION) return null;
    if (!Array.isArray(obj.seeds)) return null;
    // Basic shape validation for each entry
    for (const entry of obj.seeds as unknown[]) {
      if (typeof entry !== 'object' || entry === null) return null;
      const e = entry as Record<string, unknown>;
      if (typeof e.id !== 'string') return null;
      if (typeof e.seed !== 'number') return null;
      if (e.mapSize !== 'standard' && e.mapSize !== 'large') return null;
      if (typeof e.mapgenPresetId !== 'string') return null;
      if (typeof e.createdAt !== 'number') return null;
    }
    return obj as unknown as SavedSeedsEnvelope;
  } catch {
    return null;
  }
}

/**
 * Write the envelope to the storage adapter.
 * Returns true on success, false on failure.
 */
function writeEnvelope(envelope: SavedSeedsEnvelope): boolean {
  try {
    activeAdapter.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Load all saved seeds from storage.
 * Returns an empty array on any failure (missing key, corrupt data, etc.).
 * Entries are ordered newest-first (by createdAt descending).
 */
export function loadSavedSeeds(): SavedSeed[] {
  const envelope = readEnvelope();
  if (envelope === null) return [];
  // Return a shallow copy sorted by createdAt descending (newest first)
  return [...envelope.seeds].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Save a seed entry. If an entry with the same (seed, mapSize, mapgenPresetId)
 * already exists, it is updated with a new createdAt and moved to the top.
 * After dedup, if the list exceeds MAX_SAVED_SEEDS, the oldest entries are
 * dropped from the end.
 *
 * Returns true on success, false on storage write failure.
 */
export function saveSeed(
  seed: number,
  mapSize: 'standard' | 'large',
  mapgenPresetId: MapgenPresetId,
): boolean {
  const envelope = readEnvelope();
  const existingSeeds = envelope?.seeds ?? [];

  const now = Date.now();
  const id = generateId();

  // Check for duplicate (same seed + mapSize + mapgenPresetId)
  const duplicateIndex = existingSeeds.findIndex(
    (entry) => entry.seed === seed && entry.mapSize === mapSize && entry.mapgenPresetId === mapgenPresetId,
  );

  let updatedSeeds: SavedSeed[];

  if (duplicateIndex !== -1) {
    // Remove the duplicate entry — we'll add the updated one at the top
    const dupEntry = existingSeeds[duplicateIndex]!;
    updatedSeeds = [
      { id: dupEntry.id, seed, mapSize, mapgenPresetId, createdAt: now },
      ...existingSeeds.filter((_, i) => i !== duplicateIndex),
    ];
  } else {
    // Add new entry at the top
    updatedSeeds = [{ id, seed, mapSize, mapgenPresetId, createdAt: now }, ...existingSeeds];
  }

  // Cap at MAX_SAVED_SEEDS — drop oldest from the end
  if (updatedSeeds.length > MAX_SAVED_SEEDS) {
    updatedSeeds = updatedSeeds.slice(0, MAX_SAVED_SEEDS);
  }

  return writeEnvelope({ version: STORAGE_VERSION, seeds: updatedSeeds });
}

/**
 * Delete a saved seed entry by its id.
 * No-op if the id is not found.
 * Returns true on success (or no-op), false on storage write failure.
 */
export function deleteSavedSeed(id: string): boolean {
  const envelope = readEnvelope();
  if (envelope === null) return true; // nothing to delete, no error

  const updatedSeeds = envelope.seeds.filter((entry) => entry.id !== id);
  // If nothing was removed, no write needed
  if (updatedSeeds.length === envelope.seeds.length) return true;

  return writeEnvelope({ version: STORAGE_VERSION, seeds: updatedSeeds });
}

/**
 * Filter saved seeds by mapSize.
 * Returns a new array containing only entries matching the given mapSize,
 * sorted newest-first.
 */
export function filterByMapSize(seeds: SavedSeed[], mapSize: 'standard' | 'large'): SavedSeed[] {
  return seeds.filter((entry) => entry.mapSize === mapSize);
}
