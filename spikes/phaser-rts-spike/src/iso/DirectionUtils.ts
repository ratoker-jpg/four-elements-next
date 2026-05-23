/**
 * Direction utilities for spritesheet row mapping.
 * Matches production game's direction system from src/render/spritesheet.ts.
 *
 * Spritesheet layout: 8 rows (directions) × 8 columns (animation frames).
 * Direction row order: 0=east, 1=SE, 2=south, 3=SW, 4=west, 5=NW, 6=north, 7=NE.
 *
 * Harvester column layout:
 *   0=idle, 1-4=move, 5-7=unload
 */

export const DIRECTION_NAMES = ['east', 'se', 'south', 'sw', 'west', 'nw', 'north', 'ne'] as const;
export type DirectionName = (typeof DIRECTION_NAMES)[number];

/** Unit vectors for each of the 8 compass directions, in spritesheet row order. */
const DIRECTION_ANGLES: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 },    // 0: east
  { dx: 1, dy: 1 },    // 1: south-east
  { dx: 0, dy: 1 },    // 2: south
  { dx: -1, dy: 1 },   // 3: south-west
  { dx: -1, dy: 0 },   // 4: west
  { dx: -1, dy: -1 },  // 5: north-west
  { dx: 0, dy: -1 },   // 6: north
  { dx: 1, dy: -1 },   // 7: north-east
];

/**
 * Convert a movement vector (in tile-space) to a spritesheet row index (0-7).
 * Returns the row whose direction is closest to the given vector via dot product.
 * Defaults to row 2 (south) when the vector is zero-length.
 *
 * This mirrors the production game's directionToRow() in src/render/spritesheet.ts.
 */
export function directionToRow(dx: number, dy: number): number {
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return 2; // default: south

  const nx = dx / len;
  const ny = dy / len;

  let bestRow = 2;
  let bestDot = -Infinity;

  for (let i = 0; i < DIRECTION_ANGLES.length; i++) {
    const dir = DIRECTION_ANGLES[i]!;
    const dirLen = Math.hypot(dir.dx, dir.dy);
    const dot = nx * (dir.dx / dirLen) + ny * (dir.dy / dirLen);
    if (dot > bestDot) {
      bestDot = dot;
      bestRow = i;
    }
  }

  return bestRow;
}

/** Convert a spritesheet row index to a human-readable direction name. */
export function directionName(row: number): DirectionName {
  return DIRECTION_NAMES[row] ?? 'south';
}
