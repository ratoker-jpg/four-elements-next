// FEN-01: Isometric coordinate helpers.
// Pure functions — no state, no side effects.
// Exposed as window.FE_NEXT_COORDS.

(function () {
  'use strict';

  var C = window.FE_NEXT_CONSTANTS;

  /**
   * Convert tile (grid) coordinates to isometric screen coordinates.
   * The isometric projection uses the standard diamond layout:
   *   screenX = (tileX - tileY) * TILE_W / 2
   *   screenY = (tileX + tileY) * TILE_H / 2
   * Origin (0,0) maps to the top of the diamond.
   *
   * @param {number} tx - Tile X (column)
   * @param {number} ty - Tile Y (row)
   * @returns {{x: number, y: number}} Screen-space position (before camera)
   */
  function tileToScreen(tx, ty) {
    return {
      x: (tx - ty) * C.TILE_W / 2,
      y: (tx + ty) * C.TILE_H / 2
    };
  }

  /**
   * Convert screen coordinates to tile coordinates.
   * Inverse of tileToScreen.
   *
   * @param {number} sx - Screen X
   * @param {number} sy - Screen Y
   * @returns {{x: number, y: number}} Tile-space position (fractional)
   */
  function screenToTile(sx, sy) {
    var halfW = C.TILE_W / 2;
    var halfH = C.TILE_H / 2;
    return {
      x: (sx / halfW + sy / halfH) / 2,
      y: (sy / halfH - sx / halfW) / 2
    };
  }

  /**
   * Apply camera transform to a screen position.
   * Returns canvas-space coordinates.
   *
   * @param {number} sx - Screen X (from tileToScreen)
   * @param {number} sy - Screen Y (from tileToScreen)
   * @param {{x: number, y: number, zoom: number}} camera
   * @param {number} canvasW - Canvas width in pixels
   * @param {number} canvasH - Canvas height in pixels
   * @returns {{x: number, y: number}}
   */
  function worldToCanvas(sx, sy, camera, canvasW, canvasH) {
    return {
      x: (sx - camera.x) * camera.zoom + canvasW / 2,
      y: (sy - camera.y) * camera.zoom + canvasH / 2
    };
  }

  /**
   * Convert canvas coordinates (mouse position) back to world (screen) coordinates.
   * Inverse of worldToCanvas.
   *
   * @param {number} cx - Canvas X
   * @param {number} cy - Canvas Y
   * @param {{x: number, y: number, zoom: number}} camera
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{x: number, y: number}}
   */
  function canvasToWorld(cx, cy, camera, canvasW, canvasH) {
    return {
      x: (cx - canvasW / 2) / camera.zoom + camera.x,
      y: (cy - canvasH / 2) / camera.zoom + camera.y
    };
  }

  /**
   * Full pipeline: canvas pixel -> tile coordinate.
   *
   * @param {number} cx - Canvas pixel X (e.g. from mouse event)
   * @param {number} cy - Canvas pixel Y
   * @param {{x: number, y: number, zoom: number}} camera
   * @param {number} canvasW
   * @param {number} canvasH
   * @returns {{x: number, y: number}} Tile coordinate (fractional)
   */
  function canvasToTile(cx, cy, camera, canvasW, canvasH) {
    var world = canvasToWorld(cx, cy, camera, canvasW, canvasH);
    return screenToTile(world.x, world.y);
  }

  /**
   * Clamp value to [min, max].
   * @param {number} v
   * @param {number} lo
   * @param {number} hi
   * @returns {number}
   */
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /**
   * Euclidean distance between two points.
   * @param {{x:number,y:number}} a
   * @param {{x:number,y:number}} b
   * @returns {number}
   */
  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /**
   * Get the center of the map in screen coordinates.
   * @returns {{x: number, y: number}}
   */
  function mapCenterScreen() {
    return tileToScreen(C.MAP_W / 2, C.MAP_H / 2);
  }

  window.FE_NEXT_COORDS = {
    tileToScreen: tileToScreen,
    screenToTile: screenToTile,
    worldToCanvas: worldToCanvas,
    canvasToWorld: canvasToWorld,
    canvasToTile: canvasToTile,
    clamp: clamp,
    dist: dist,
    mapCenterScreen: mapCenterScreen
  };
})();
