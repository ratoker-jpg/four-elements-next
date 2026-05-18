/**
 * Spritesheet rendering helpers for 8×8 256-pixel civil unit spritesheets.
 *
 * Spritesheet layout: 8 rows (directions) × 8 columns (animation frames).
 * Each cell is 256×256 pixels; total sheet is 2048×2048.
 *
 * Direction row order: 0=east, 1=SE, 2=south, 3=SW, 4=west, 5=NW, 6=north, 7=NE.
 *
 * Builder column layout:
 *   0=idle, 1-4=move, 5-7=build placeholders
 *
 * Harvester column layout:
 *   0=idle, 1-4=move, 5-7=unload
 */

import { containFit } from './contain-fit.js';

/** Frame dimensions for 8×8 256 spritesheets. */
const FRAME_SIZE = 256;

/**
 * Draw a single frame from an 8×8 spritesheet onto the canvas.
 *
 * @param ctx   - Canvas 2D rendering context
 * @param sheet - Loaded HTMLImageElement of the full spritesheet
 * @param row   - Row index (0-7, maps to direction)
 * @param col   - Column index (0-7, maps to animation frame)
 * @param cx    - Screen X center position
 * @param cy    - Screen Y ground position (bottom of the sprite)
 * @param zoom  - Camera zoom level
 * @param profile - Sprite profile with size and groundOffset
 */
export function drawSpritesheetFrame(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  row: number,
  col: number,
  cx: number,
  cy: number,
  zoom: number,
  profile: { readonly size: readonly [number, number]; readonly groundOffset: number },
): void {
  const sx = col * FRAME_SIZE;
  const sy = row * FRAME_SIZE;
  const maxW = profile.size[0] * zoom;
  const maxH = profile.size[1] * zoom;
  const offY = profile.groundOffset * zoom;
  // Use source frame aspect ratio (FRAME_SIZE × FRAME_SIZE = square), not the
  // full spritesheet's naturalWidth/naturalHeight (2048×2048).
  // containFit preserves the square frame inside the profile.size bounding box,
  // preventing stretch if profiles ever become non-square.
  const { drawWidth: w, drawHeight: h } = containFit(
    FRAME_SIZE, FRAME_SIZE, maxW, maxH,
  );

  ctx.drawImage(
    sheet,
    sx, sy, FRAME_SIZE, FRAME_SIZE,
    cx - w / 2, cy - h / 2 - offY, w, h,
  );
}

/**
 * Direction names matching spritesheet row order (0-7).
 * 0=east, 1=south-east, 2=south, 3=south-west,
 * 4=west, 5=north-west, 6=north, 7=north-east.
 */
const DIRECTION_ANGLES: ReadonlyArray<{ readonly dx: number; readonly dy: number }> = [
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
 * Convert a movement vector to a spritesheet row index (0-7).
 * Returns the row whose direction is closest to the given vector.
 * Defaults to row 2 (south) when the vector is zero-length.
 *
 * @param dx - Movement delta X (tile space)
 * @param dy - Movement delta Y (tile space)
 * @returns Row index 0-7
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

/**
 * Compute the animation column for a builder.
 * Builder visual states: idle (col 0) or building (cols 5-7 cycling).
 * No moving state yet.
 *
 * @param busy  - Whether the builder is currently building
 * @param ticks - Monotonic tick counter for animation cycling
 * @returns Column index 0-7
 */
export function builderAnimColumn(busy: boolean, ticks: number): number {
  if (!busy) return 0; // idle
  // Cycle through build placeholder columns 5-7
  return 5 + (Math.floor(ticks / 15) % 3);
}

/**
 * Compute the animation column for a harvester.
 * Harvester phases map to columns:
 *   idle → col 0
 *   moving-to-resource / moving-to-dropoff → cols 1-4 cycling
 *   gathering → col 0 (idle pose)
 *   delivering → cols 5-7 cycling
 *   waiting-full-storage → col 0 (idle pose)
 *
 * @param phase - Current harvester phase
 * @param ticks - Monotonic tick counter for animation cycling
 * @returns Column index 0-7
 */
export function harvesterAnimColumn(
  phase: 'idle' | 'moving-to-resource' | 'gathering' | 'moving-to-dropoff' | 'delivering' | 'waiting-full-storage',
  ticks: number,
): number {
  switch (phase) {
    case 'idle':
      return 0;
    case 'moving-to-resource':
    case 'moving-to-dropoff':
      return 1 + (Math.floor(ticks / 10) % 4);
    case 'gathering':
      return 0;
    case 'delivering':
      return 5 + (Math.floor(ticks / 12) % 3);
    case 'waiting-full-storage':
      return 0;
  }
}
