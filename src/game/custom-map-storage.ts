/**
 * MAP-EDITOR-ARCH-01 PR9 — Custom map localStorage slots.
 *
 * localStorage CRUD for saved custom map entries.
 * Used by Editor Screen to persist, load, and delete custom maps.
 *
 * Storage schema:
 *   Key: four-elements-next.custom-maps.v1
 *   Envelope: { version: 1, maps: SavedCustomMap[] }
 *   SavedCustomMap: { id, name, map: MapData, createdAt, updatedAt }
 *
 * Design decisions:
 * - Versioned envelope for future migration.
 * - Cap at 20 entries, dropping oldest (by updatedAt) from the end.
 * - Safe id generation: crypto.randomUUID with fallback.
 * - localStorage failures never throw; operations return safe defaults.
 * - Storage adapter pattern: production uses localStorage, tests inject a Map.
 * - Deep-clone map data through JSON round-trip before storing/loading.
 * - Validate basic MapData shape on load; corrupt maps are rejected.
 * - Normalize missing gameplay arrays (buildings, builders, constructionSites)
 *   to empty arrays if safe.
 */

import type { MapData } from './map-types.js';

/** localStorage key — versioned for future migration. */
const STORAGE_KEY = 'four-elements-next.custom-maps.v1';

/** Current envelope version. */
const STORAGE_VERSION = 1;

/** Maximum number of saved custom maps. Oldest are dropped from the end. */
const MAX_SAVED_MAPS = 20;

/** A persisted custom map entry. */
export interface SavedCustomMap {
  readonly id: string;
  readonly name: string;
  readonly map: MapData;
  /** Unix epoch milliseconds. */
  readonly createdAt: number;
  /** Unix epoch milliseconds. */
  readonly updatedAt: number;
}

/** Envelope stored in localStorage. */
interface CustomMapsEnvelope {
  readonly version: number;
  readonly maps: SavedCustomMap[];
}

/** Storage adapter — abstracts localStorage for testability. */
export interface CustomMapStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Production adapter using real localStorage. */
const localStorageAdapter: CustomMapStorageAdapter = {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
  },
};

/** Currently active storage adapter. */
let activeAdapter: CustomMapStorageAdapter = localStorageAdapter;

/**
 * Override the storage adapter (for testing).
 * Pass null to reset to the default localStorage adapter.
 */
export function setCustomMapStorageAdapter(adapter: CustomMapStorageAdapter | null): void {
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
 * Validate basic MapData shape.
 * Returns true if the data looks like a valid MapData object with
 * the minimum required fields.
 */
function isValidMapDataShape(data: unknown): data is MapData {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Required scalar fields
  if (typeof obj.width !== 'number' || !Number.isFinite(obj.width) || obj.width <= 0) return false;
  if (typeof obj.height !== 'number' || !Number.isFinite(obj.height) || obj.height <= 0) return false;

  // Required terrain array
  if (!Array.isArray(obj.terrain)) return false;

  // Required hq
  if (typeof obj.hq !== 'object' || obj.hq === null) return false;
  const hq = obj.hq as Record<string, unknown>;
  if (typeof hq.tx !== 'number' || typeof hq.ty !== 'number') return false;
  if (typeof hq.faction !== 'string') return false;

  // Required arrays
  if (!Array.isArray(obj.resources)) return false;
  if (!Array.isArray(obj.obstacles)) return false;
  if (!Array.isArray(obj.decor)) return false;

  return true;
}

/**
 * Normalize a loaded MapData: ensure gameplay arrays exist as empty arrays
 * if they are missing or not arrays. This handles maps saved before
 * buildings/builders/constructionSites were part of the editor, or maps
 * that somehow lost these fields during serialization.
 *
 * Returns a new object (does not mutate input).
 */
function normalizeMapData(map: MapData): MapData {
  return {
    width: map.width,
    height: map.height,
    terrain: map.terrain,
    hq: map.hq,
    resources: map.resources,
    obstacles: map.obstacles,
    decor: map.decor,
    buildings: Array.isArray(map.buildings) ? map.buildings : [],
    builders: Array.isArray(map.builders) ? map.builders : [],
    constructionSites: Array.isArray(map.constructionSites) ? map.constructionSites : [],
  };
}

/**
 * Deep-clone a value through JSON round-trip.
 * Returns null if the value cannot be serialized/parsed.
 */
function deepClone<T>(value: T): T | null {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return null;
  }
}

/**
 * Safely read the envelope from the storage adapter.
 * Returns null on any failure (missing key, invalid JSON, wrong version, etc.).
 */
function readEnvelope(): CustomMapsEnvelope | null {
  try {
    const raw = activeAdapter.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== STORAGE_VERSION) return null;
    if (!Array.isArray(obj.maps)) return null;

    // Basic shape validation for each entry
    for (const entry of obj.maps as unknown[]) {
      if (typeof entry !== 'object' || entry === null) return null;
      const e = entry as Record<string, unknown>;
      if (typeof e.id !== 'string') return null;
      if (typeof e.name !== 'string') return null;
      if (typeof e.createdAt !== 'number') return null;
      if (typeof e.updatedAt !== 'number') return null;
      // Validate MapData shape
      if (!isValidMapDataShape(e.map)) return null;
    }

    return obj as unknown as CustomMapsEnvelope;
  } catch {
    return null;
  }
}

/**
 * Write the envelope to the storage adapter.
 * Returns true on success, false on failure.
 */
function writeEnvelope(envelope: CustomMapsEnvelope): boolean {
  try {
    activeAdapter.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Load all saved custom maps from storage.
 * Returns an empty array on any failure (missing key, corrupt data, etc.).
 * Entries are ordered newest-first (by updatedAt descending).
 * MapData is deep-cloned and normalized on load.
 */
export function loadSavedMaps(): SavedCustomMap[] {
  const envelope = readEnvelope();
  if (envelope === null) return [];

  // Deep-clone and normalize each map
  const result: SavedCustomMap[] = [];
  for (const entry of envelope.maps) {
    const clonedMap = deepClone(entry.map);
    if (clonedMap === null) continue; // skip uncloneable entries
    const normalized = normalizeMapData(clonedMap);
    result.push({
      id: entry.id,
      name: entry.name,
      map: normalized,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });
  }

  // Return sorted by updatedAt descending (newest first)
  return result.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Generate the next auto-name for a new saved map.
 * Pattern: "Карта 1", "Карта 2", etc.
 * Finds the next available number that is not used by existing entries.
 */
function generateMapName(existingMaps: ReadonlyArray<SavedCustomMap>): string {
  const usedNumbers = new Set<number>();
  for (const entry of existingMaps) {
    const match = entry.name.match(/^Карта (\d+)$/);
    if (match) {
      usedNumbers.add(parseInt(match[1]!, 10));
    }
  }
  // Find the next available number starting from 1
  let n = 1;
  while (usedNumbers.has(n)) {
    n++;
  }
  return `Карта ${n}`;
}

/**
 * Save a custom map entry. If an entry with the given id already exists,
 * it is updated in place with new map data and updatedAt timestamp.
 * If id is null/undefined, a new entry is created with an auto-generated name.
 *
 * After save, if the list exceeds MAX_SAVED_MAPS, the oldest entries
 * (by updatedAt) are dropped from the end.
 *
 * Returns the id of the saved entry on success, or null on failure.
 */
export function saveCustomMap(
  map: MapData,
  options?: { id?: string; name?: string },
): string | null {
  // Deep-clone the map data to ensure stored copy is independent
  const clonedMap = deepClone(map);
  if (clonedMap === null) return null;

  const envelope = readEnvelope();
  const existingMaps = envelope?.maps ?? [];
  const now = Date.now();

  let id: string;
  let name: string;
  let updatedMaps: SavedCustomMap[];

  const existingId = options?.id;
  const existingIndex = existingId
    ? existingMaps.findIndex((entry) => entry.id === existingId)
    : -1;

  if (existingIndex !== -1) {
    // Update existing entry
    const existing = existingMaps[existingIndex]!;
    id = existing.id;
    name = options?.name ?? existing.name;
    updatedMaps = existingMaps.map((entry, i) =>
      i === existingIndex
        ? { id, name, map: clonedMap, createdAt: existing.createdAt, updatedAt: now }
        : entry,
    );
  } else {
    // Create new entry
    id = generateId();
    name = options?.name ?? generateMapName(existingMaps);
    updatedMaps = [{ id, name, map: clonedMap, createdAt: now, updatedAt: now }, ...existingMaps];
  }

  // Sort by updatedAt descending and cap at MAX_SAVED_MAPS
  updatedMaps.sort((a, b) => b.updatedAt - a.updatedAt);
  if (updatedMaps.length > MAX_SAVED_MAPS) {
    updatedMaps = updatedMaps.slice(0, MAX_SAVED_MAPS);
  }

  const ok = writeEnvelope({ version: STORAGE_VERSION, maps: updatedMaps });
  return ok ? id : null;
}

/**
 * Delete a saved custom map entry by its id.
 * No-op if the id is not found.
 * Returns true on success (or no-op), false on storage write failure.
 */
export function deleteSavedMap(id: string): boolean {
  const envelope = readEnvelope();
  if (envelope === null) return true; // nothing to delete, no error

  const updatedMaps = envelope.maps.filter((entry) => entry.id !== id);
  // If nothing was removed, no write needed
  if (updatedMaps.length === envelope.maps.length) return true;

  return writeEnvelope({ version: STORAGE_VERSION, maps: updatedMaps });
}

/**
 * Load a single saved custom map by its id.
 * Returns the SavedCustomMap or null if not found or on failure.
 * MapData is deep-cloned and normalized on load.
 */
export function loadSavedMapById(id: string): SavedCustomMap | null {
  const maps = loadSavedMaps();
  return maps.find((entry) => entry.id === id) ?? null;
}
