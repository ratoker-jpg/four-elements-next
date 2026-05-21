/**
 * MAP-EDITOR-ARCH-01 PR3 — Editor map validation and placement feedback.
 *
 * Provides `validateEditorMap()` which wraps the existing `validateMap()` from
 * `map-validation.ts` and adds editor-specific checks (no resources, out-of-bounds
 * objects, editor-local overlaps, HQ existence). Also provides
 * `getPlacementRejectionReason()` for human-readable placement rejection reasons.
 *
 * Pure functions — no mutation, no DOM.
 */

import type { MapData } from './map-types.js';
import { HQ_FOOTPRINT } from '../core/constants.js';
import { validateMap } from './map-validation.js';
import { buildEditorOccupiedSet, isInBounds, isOverlapping } from './editor-state.js';

// ── Types ────────────────────────────────────────────────────────────

export interface EditorValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

// ── Placement rejection reasons ──────────────────────────────────────

/**
 * Return a human-readable reason why placement at (tx, ty) with the given
 * footprint would be rejected on the current map. Returns null if placement
 * is valid.
 *
 * Checks are ordered: bounds first, then overlap.
 */
export function getPlacementRejectionReason(
  map: MapData,
  tx: number,
  ty: number,
  footprint: number,
): string | null {
  if (!isInBounds(map, tx, ty, footprint)) {
    return 'Выходит за границы карты';
  }

  const occupied = buildEditorOccupiedSet(map);
  if (isOverlapping(occupied, tx, ty, footprint)) {
    return 'Перекрывает занятую клетку';
  }

  return null;
}

// ── Full editor map validation ───────────────────────────────────────

/**
 * Validate an editor map for playability.
 *
 * Reuses `validateMap()` from `map-validation.ts` for the core checks
 * (start core zone, starter resource reachability, center reachability,
 * infinite reachability, resource-obstacle overlaps). Then adds
 * editor-specific checks that `validateMap()` does not cover.
 *
 * Returns a simple `{ ok, errors, warnings }` result with Russian-language
 * messages suitable for the editor UI.
 */
export function validateEditorMap(map: MapData): EditorValidationResult {
  // Run the existing mapgen validation (pass seed=0 for editor context)
  const baseReport = validateMap(map, 0);

  const errors: string[] = [...baseReport.errors];
  const warnings: string[] = [...baseReport.warnings];

  // ── Editor-specific checks ───────────────────────────────────────

  // 1. HQ exists (defensive — HQ is always present from generateMap,
  //    but the editor should report it clearly if somehow missing)
  if (!map.hq || map.hq.tx == null || map.hq.ty == null) {
    errors.push('На карте отсутствует Штаб (HQ)');
  }

  // 2. At least one resource exists
  if (map.resources.length === 0) {
    errors.push('Нет ресурсов на карте');
  }

  // 3. All objects within map bounds
  // Resources
  for (let i = 0; i < map.resources.length; i++) {
    const r = map.resources[i]!;
    if (!isInBounds(map, r.tx, r.ty, r.footprint)) {
      errors.push(`Ресурс #${i + 1} (${r.type}) выходит за границы карты`);
    }
  }

  // Obstacles
  for (let i = 0; i < map.obstacles.length; i++) {
    const o = map.obstacles[i]!;
    if (!isInBounds(map, o.tx, o.ty, o.footprint)) {
      errors.push(`Препятствие #${i + 1} (${o.type}) выходит за границы карты`);
    }
  }

  // Decor — footprint is always 1
  for (let i = 0; i < map.decor.length; i++) {
    const d = map.decor[i]!;
    if (!isInBounds(map, d.tx, d.ty, 1)) {
      errors.push(`Декор #${i + 1} (${d.type}) выходит за границы карты`);
    }
  }

  // 4. No editor-local overlaps between placed objects
  //    (buildEditorOccupiedSet marks all tiles; if two entities share a tile,
  //     the overlap count exceeds the number of unique entity anchors)
  const overlapErrors = detectEditorOverlaps(map);
  errors.push(...overlapErrors);

  const ok = errors.length === 0;

  return { ok, errors, warnings };
}

// ── Internal: overlap detection ──────────────────────────────────────

/**
 * Detect overlaps between entities on the editor map.
 * buildEditorOccupiedSet only marks tiles; we need to check if
 * multiple entity footprints claim the same tile.
 */
function detectEditorOverlaps(map: MapData): string[] {
  const errors: string[] = [];
  const tileOwners = new Map<string, string>();

  // HQ
  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      const key = `${map.hq.tx + dx},${map.hq.ty + dy}`;
      tileOwners.set(key, 'HQ');
    }
  }

  // Helper to check/mark a footprint
  function checkFootprint(
    kind: string,
    index: number,
    type: string,
    tx: number,
    ty: number,
    footprint: number,
  ): void {
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        const key = `${tx + dx},${ty + dy}`;
        const owner = tileOwners.get(key);
        if (owner) {
          // Only report each overlap once — avoid duplicate messages
          // for the same pair of overlapping entities
          const label = kind === 'decor'
            ? `${kind} #${index + 1} (${type})`
            : `${kind} #${index + 1} (${type})`;
          // Avoid duplicate messages for same overlap
          const msg = `${label} перекрывает ${owner}`;
          if (!errors.includes(msg)) {
            errors.push(msg);
          }
        } else {
          tileOwners.set(key, `${kind} #${index + 1} (${type})`);
        }
      }
    }
  }

  // Resources
  for (let i = 0; i < map.resources.length; i++) {
    const r = map.resources[i]!;
    checkFootprint('ресурс', i, r.type, r.tx, r.ty, r.footprint);
  }

  // Obstacles
  for (let i = 0; i < map.obstacles.length; i++) {
    const o = map.obstacles[i]!;
    checkFootprint('препятствие', i, o.type, o.tx, o.ty, o.footprint);
  }

  // Decor
  for (let i = 0; i < map.decor.length; i++) {
    const d = map.decor[i]!;
    checkFootprint('декор', i, d.type, d.tx, d.ty, 1);
  }

  return errors;
}
