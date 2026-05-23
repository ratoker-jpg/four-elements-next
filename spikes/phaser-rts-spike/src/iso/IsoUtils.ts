/**
 * Isometric coordinate utilities for the Phaser RTS spike.
 * Matches the production game's coordinate system:
 *   TILE_W = 76, TILE_H = 38
 *   tileToScreen: x = (tx - ty) * TILE_W/2, y = (tx + ty) * TILE_H/2
 */

export const TILE_W = 76;
export const TILE_H = 38;
export const MAP_SIZE = 48;

/**
 * Convert tile coordinates to screen (world) pixel coordinates.
 * Returns the top-center of the isometric diamond for the tile.
 */
export function tileToScreen(tx: number, ty: number): { x: number; y: number } {
  return {
    x: (tx - ty) * TILE_W / 2,
    y: (tx + ty) * TILE_H / 2,
  };
}

/**
 * Convert screen (world) pixel coordinates back to tile coordinates.
 */
export function screenToTile(sx: number, sy: number): { tx: number; ty: number } {
  return {
    tx: (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2,
    ty: (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2,
  };
}

/**
 * Isometric depth sort key — same formula as the production game.
 * Larger footprint entities get a higher sort key so they render in front.
 */
export function getDepthKey(tx: number, ty: number, footprint: number = 1): number {
  return tx + ty + (footprint - 1) * 2;
}

/**
 * Camera bounds in world coordinates for a MAP_SIZE x MAP_SIZE map.
 */
export function getMapWorldBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
  const top = tileToScreen(0, 0);
  const right = tileToScreen(MAP_SIZE, 0);
  const bottom = tileToScreen(MAP_SIZE, MAP_SIZE);
  const left = tileToScreen(0, MAP_SIZE);
  return {
    minX: left.x - 200,
    minY: top.y - 200,
    maxX: right.x + 200,
    maxY: bottom.y + 200,
  };
}
