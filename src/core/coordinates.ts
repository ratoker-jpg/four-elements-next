/** Isometric coordinate transforms. Pure functions — no state, no side effects. */

import { TILE_W, TILE_H } from './constants.js';

export interface Point {
  x: number;
  y: number;
}

/**
 * Convert tile (grid) coordinates to isometric screen coordinates.
 * Center of tile (0,0) maps to (0,0). Offset by +0.5 for tile centers.
 */
export function tileToScreen(tx: number, ty: number): Point {
  return {
    x: (tx - ty) * TILE_W / 2,
    y: (tx + ty) * TILE_H / 2,
  };
}

/** Convert isometric screen coordinates to tile coordinates (fractional). */
export function screenToTile(sx: number, sy: number): Point {
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  return {
    x: (sx / halfW + sy / halfH) / 2,
    y: (sy / halfH - sx / halfW) / 2,
  };
}

/** Apply camera transform: world (screen) → canvas pixels. */
export function worldToCanvas(
  sx: number, sy: number,
  camX: number, camY: number, zoom: number,
  canvasW: number, canvasH: number,
): Point {
  return {
    x: (sx - camX) * zoom + canvasW / 2,
    y: (sy - camY) * zoom + canvasH / 2,
  };
}

/** Inverse camera transform: canvas pixels → world (screen). */
export function canvasToWorld(
  cx: number, cy: number,
  camX: number, camY: number, zoom: number,
  canvasW: number, canvasH: number,
): Point {
  return {
    x: (cx - canvasW / 2) / zoom + camX,
    y: (cy - canvasH / 2) / zoom + camY,
  };
}

/** Full pipeline: canvas pixel → tile coordinate (fractional). */
export function canvasToTile(
  cx: number, cy: number,
  camX: number, camY: number, zoom: number,
  canvasW: number, canvasH: number,
): Point {
  const world = canvasToWorld(cx, cy, camX, camY, zoom, canvasW, canvasH);
  return screenToTile(world.x, world.y);
}

/** Clamp value to [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Euclidean distance between two points. */
export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Axis-aligned bounding box of the isometric terrain for a map of given tile dimensions.
 *
 *  Each tile (tx, ty) is drawn as a diamond centred at tileToScreen(tx+0.5, ty+0.5)
 *  with vertices offset by ±TILE_W/2 and ±TILE_H/2. The returned bounds cover the
 *  outermost vertices of ALL tile diamonds in the map, so they include the full
 *  visual extent of the terrain — including negative-X tiles that appear on the
 *  left side of the isometric diamond.
 *
 *  Analytic derivation:
 *    minX = -mapHeight * TILE_W / 2   (left vertex of tile (0, mapHeight-1))
 *    maxX =  mapWidth  * TILE_W / 2   (right vertex of tile (mapWidth-1, 0))
 *    minY =  0                         (top vertex of tile (0, 0))
 *    maxY = (mapWidth + mapHeight) * TILE_H / 2  (bottom vertex of tile (mapWidth-1, mapHeight-1))
 */
export interface TerrainWorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function terrainWorldBounds(mapWidth: number, mapHeight: number): TerrainWorldBounds {
  const minX = -mapHeight * TILE_W / 2;
  const maxX =  mapWidth  * TILE_W / 2;
  const minY = 0;
  const maxY = (mapWidth + mapHeight) * TILE_H / 2;
  return { minX, minY, maxX, maxY };
}
