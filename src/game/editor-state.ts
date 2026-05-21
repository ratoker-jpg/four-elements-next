/**
 * MAP-EDITOR-ARCH-01 PR2 — Editor-local placement helper.
 *
 * Pure functions for overlap checks, placement, and removal on editor MapData.
 * No GameState, GameWorld, or system dependencies.
 * ResourceNodeState[] is optional and kept 1:1 with map.resources when provided.
 */

import type { MapData, ResourceType, ObstacleType, DecorType } from './map-types.js';
import { RESOURCE_FOOTPRINTS, OBSTACLE_FOOTPRINTS } from './map-types.js';
import { HQ_FOOTPRINT } from '../core/constants.js';
import { RESOURCE_AMOUNTS } from '../systems/harvesting.js';
import type { ResourceNodeState } from '../systems/harvesting.js';

// ── Types ────────────────────────────────────────────────────────────

export type EditorTool = 'select' | 'place' | 'erase';

export type PaletteGroup = 'resource' | 'obstacle' | 'decor';

export interface PaletteItem {
  readonly group: PaletteGroup;
  readonly type: ResourceType | ObstacleType | DecorType;
  readonly label: string;
  readonly footprint: number;
}

/** Result of finding an entity at a tile. */
export interface EntityAtTile {
  readonly kind: 'resource' | 'obstacle' | 'decor';
  readonly index: number;
  readonly tx: number;
  readonly ty: number;
  readonly footprint: number;
}

// ── Palette definition ───────────────────────────────────────────────

export const PALETTE_ITEMS: readonly PaletteItem[] = [
  // Resources
  { group: 'resource', type: 'small', label: 'Малый минерал', footprint: RESOURCE_FOOTPRINTS['small'] },
  { group: 'resource', type: 'medium', label: 'Средний минерал', footprint: RESOURCE_FOOTPRINTS['medium'] },
  { group: 'resource', type: 'large', label: 'Крупный минерал', footprint: RESOURCE_FOOTPRINTS['large'] },
  { group: 'resource', type: 'infinite', label: 'Бесконечный минерал', footprint: RESOURCE_FOOTPRINTS['infinite'] },
  // Obstacles
  { group: 'obstacle', type: 'rock-cluster', label: 'Скалы', footprint: OBSTACLE_FOOTPRINTS['rock-cluster'] },
  { group: 'obstacle', type: 'mountain-small', label: 'Малая гора', footprint: OBSTACLE_FOOTPRINTS['mountain-small'] },
  { group: 'obstacle', type: 'mountain-medium', label: 'Средняя гора', footprint: OBSTACLE_FOOTPRINTS['mountain-medium'] },
  { group: 'obstacle', type: 'mountain-large', label: 'Крупная гора', footprint: OBSTACLE_FOOTPRINTS['mountain-large'] },
  // Decor
  { group: 'decor', type: 'bush', label: 'Куст', footprint: 1 },
  { group: 'decor', type: 'sand-bump', label: 'Песчаный холмик', footprint: 1 },
] as const;

// ── Occupied set ─────────────────────────────────────────────────────

/** Build an editor-local occupied tile set from MapData.
 *  Includes HQ, resources, obstacles, and decor (for visual stacking prevention). */
export function buildEditorOccupiedSet(map: MapData): Set<string> {
  const occupied = new Set<string>();

  // HQ
  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      occupied.add(`${map.hq.tx + dx},${map.hq.ty + dy}`);
    }
  }

  // Resources
  for (const r of map.resources) {
    markFootprint(occupied, r.tx, r.ty, r.footprint);
  }

  // Obstacles
  for (const o of map.obstacles) {
    markFootprint(occupied, o.tx, o.ty, o.footprint);
  }

  // Decor — included to prevent visual stacking in editor
  for (const d of map.decor) {
    occupied.add(`${d.tx},${d.ty}`);
  }

  return occupied;
}

function markFootprint(set: Set<string>, tx: number, ty: number, footprint: number): void {
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      set.add(`${tx + dx},${ty + dy}`);
    }
  }
}

// ── Placement checks ─────────────────────────────────────────────────

/** Check if a footprint rectangle fits within map bounds. */
export function isInBounds(map: MapData, tx: number, ty: number, footprint: number): boolean {
  return tx >= 0 && ty >= 0 && tx + footprint <= map.width && ty + footprint <= map.height;
}

/** Check if a footprint rectangle overlaps any occupied tiles. */
export function isOverlapping(occupied: Set<string>, tx: number, ty: number, footprint: number): boolean {
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      if (occupied.has(`${tx + dx},${ty + dy}`)) return true;
    }
  }
  return false;
}

/** Check if placement is valid: in bounds and no overlap. */
export function canPlace(map: MapData, occupied: Set<string>, tx: number, ty: number, footprint: number): boolean {
  return isInBounds(map, tx, ty, footprint) && !isOverlapping(occupied, tx, ty, footprint);
}

// ── Placement ────────────────────────────────────────────────────────

/** Place a resource on the editor map. Mutates map.resources (and resourceNodes if provided).
 *  Returns true if placed. */
export function placeResource(
  map: MapData,
  tx: number,
  ty: number,
  type: ResourceType,
  resourceNodes?: ResourceNodeState[],
): boolean {
  const footprint = RESOURCE_FOOTPRINTS[type];
  const occupied = buildEditorOccupiedSet(map);
  if (!canPlace(map, occupied, tx, ty, footprint)) return false;

  map.resources.push({ tx, ty, type, footprint });

  // Keep resourceNodes in 1:1 sync if provided
  if (resourceNodes) {
    resourceNodes.push({
      tx,
      ty,
      type,
      infinite: type === 'infinite',
      remaining: RESOURCE_AMOUNTS[type],
    });
  }

  return true;
}

/** Place an obstacle on the editor map. Mutates map.obstacles. Returns true if placed. */
export function placeObstacle(
  map: MapData,
  tx: number,
  ty: number,
  type: ObstacleType,
): boolean {
  const footprint = OBSTACLE_FOOTPRINTS[type];
  const occupied = buildEditorOccupiedSet(map);
  if (!canPlace(map, occupied, tx, ty, footprint)) return false;

  map.obstacles.push({ tx, ty, type, footprint });
  return true;
}

/** Place decor on the editor map. Mutates map.decor. Returns true if placed. */
export function placeDecor(
  map: MapData,
  tx: number,
  ty: number,
  type: DecorType,
): boolean {
  const footprint = 1;
  const occupied = buildEditorOccupiedSet(map);
  if (!canPlace(map, occupied, tx, ty, footprint)) return false;

  map.decor.push({ tx, ty, type });
  return true;
}

// ── Finding entities ─────────────────────────────────────────────────

/** Find the entity occupying a given tile. Priority: resource > obstacle > decor.
 *  Returns null if no entity occupies the tile. */
export function findEntityAtTile(map: MapData, tx: number, ty: number): EntityAtTile | null {
  // Resources
  for (let i = 0; i < map.resources.length; i++) {
    const r = map.resources[i]!;
    if (tx >= r.tx && tx < r.tx + r.footprint && ty >= r.ty && ty < r.ty + r.footprint) {
      return { kind: 'resource', index: i, tx: r.tx, ty: r.ty, footprint: r.footprint };
    }
  }

  // Obstacles
  for (let i = 0; i < map.obstacles.length; i++) {
    const o = map.obstacles[i]!;
    if (tx >= o.tx && tx < o.tx + o.footprint && ty >= o.ty && ty < o.ty + o.footprint) {
      return { kind: 'obstacle', index: i, tx: o.tx, ty: o.ty, footprint: o.footprint };
    }
  }

  // Decor
  for (let i = 0; i < map.decor.length; i++) {
    const d = map.decor[i]!;
    if (d.tx === tx && d.ty === ty) {
      return { kind: 'decor', index: i, tx: d.tx, ty: d.ty, footprint: 1 };
    }
  }

  return null;
}

// ── Removal ──────────────────────────────────────────────────────────

/** Remove the entity at the given tile. Also removes matching resourceNode if provided.
 *  Returns true if something was removed. */
export function eraseAtTile(
  map: MapData,
  tx: number,
  ty: number,
  resourceNodes?: ResourceNodeState[],
): boolean {
  const entity = findEntityAtTile(map, tx, ty);
  if (!entity) return false;

  switch (entity.kind) {
    case 'resource':
      map.resources.splice(entity.index, 1);
      if (resourceNodes) {
        resourceNodes.splice(entity.index, 1);
      }
      break;
    case 'obstacle':
      map.obstacles.splice(entity.index, 1);
      break;
    case 'decor':
      map.decor.splice(entity.index, 1);
      break;
  }

  return true;
}
