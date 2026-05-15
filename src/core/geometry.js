// Four Elements v0.4 module: pure geometry / math helpers.
// ARCH-LAB-03: extracted from src/main.js.
// Provides window.FE_GEOMETRY with clamp, dist, rectsOverlap, safeNum,
// formatTime, normalizeVec — all pure functions with zero closure deps.

(function () {
  'use strict';

  /**
   * Clamp value to [min, max] range.
   * @param {number} v
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /**
   * Manhattan distance between two tile-position objects.
   * @param {{x:number, y:number}} a
   * @param {{x:number, y:number}} b
   * @returns {number}
   */
  function dist(a, b) {
    return Math.abs(Math.round(a.x) - Math.round(b.x)) + Math.abs(Math.round(a.y) - Math.round(b.y));
  }

  /**
   * Axis-aligned bounding box overlap test.
   * Both a and b must have {x, y, w, h}.
   * @param {{x:number, y:number, w:number, h:number}} a
   * @param {{x:number, y:number, w:number, h:number}} b
   * @returns {boolean}
   */
  function rectsOverlap(a, b) {
    return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  }

  /**
   * Round if finite, else return 0.
   * @param {number} v
   * @returns {number}
   */
  function safeNum(v) {
    return Number.isFinite(v) ? Math.round(v) : 0;
  }

  /**
   * Format seconds as HH:MM:SS.
   * @param {number} sec
   * @returns {string}
   */
  function formatTime(sec) {
    sec = Math.floor(sec || 0);
    var h = String(Math.floor(sec / 3600)).padStart(2, '0');
    var m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    var s = String(sec % 60).padStart(2, '0');
    return h + ':' + m + ':' + s;
  }

  /**
   * Normalize a 2D vector. Returns {x, y} with length 1.
   * If both components are 0, returns {x: 0, y: 0}.
   * @param {number} vx
   * @param {number} vy
   * @returns {{x: number, y: number}}
   */
  function normalizeVec(vx, vy) {
    var len = Math.hypot(vx, vy) || 1;
    return { x: vx / len, y: vy / len };
  }

  window.FE_GEOMETRY = {
    clamp: clamp,
    dist: dist,
    rectsOverlap: rectsOverlap,
    safeNum: safeNum,
    formatTime: formatTime,
    normalizeVec: normalizeVec
  };
})();
