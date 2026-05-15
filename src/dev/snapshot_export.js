// REF-MAIN-GLM-05 — Snapshot/export debug module
// Extracted from src/main.js (feMakeSnapshot, feSnapshotSafe, etc.)
// This is a dev-only debug export — NOT gameplay logic, NOT save/load.

window.FE_SNAPSHOT_EXPORT = (function () {
  'use strict';

  // ----------------------------------------------------------------
  // Internal state — deps stored at init() time
  // ----------------------------------------------------------------
  let _deps = null;

  // ----------------------------------------------------------------
  // Pure helpers — no IIFE scope dependencies
  // ----------------------------------------------------------------

  function feSnapshotSafe(value, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 5) return '[max_depth]';
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;

    if (Array.isArray(value)) {
      return value.slice(0, 80).map(function (v) { return feSnapshotSafe(v, depth + 1); });
    }

    var out = {};
    var keys = Object.keys(value).slice(0, 80);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = value[k];
      if (typeof v === 'function') continue;
      out[k] = feSnapshotSafe(v, depth + 1);
    }

    return out;
  }

  // ----------------------------------------------------------------
  // Cell diagnosis — uses _deps for IIFE-scope functions
  // ----------------------------------------------------------------

  function feSnapshotDiagnoseCell(x, y, ignoreUnitId) {
    var info = { x: x, y: y };

    try {
      info.inBounds = (_deps && typeof _deps.inBounds === 'function') ? _deps.inBounds(x, y) : null;
      info.obstacleBlocked = (_deps && typeof _deps.isObstacleBlocked === 'function') ? _deps.isObstacleBlocked(x, y) : null;
      info.mine = (_deps && typeof _deps.mineAt === 'function') ? feSnapshotSafe(_deps.mineAt(x, y)) : null;
      info.building = (_deps && typeof _deps.buildingAt === 'function') ? feSnapshotSafe(_deps.buildingAt(x, y)) : null;
      info.unit = (_deps && typeof _deps.unitAt === 'function') ? feSnapshotSafe(_deps.unitAt(x, y, ignoreUnitId)) : null;
      info.passable = (_deps && typeof _deps.passable === 'function') ? _deps.passable(x, y, ignoreUnitId) : null;

      if (!info.inBounds) info.reason = 'out_of_bounds';
      else if (info.obstacleBlocked) info.reason = 'obstacle';
      else if (info.mine) info.reason = 'mine';
      else if (info.building) info.reason = 'building';
      else if (info.unit) info.reason = 'unit';
      else if (info.passable) info.reason = 'passable';
      else info.reason = 'unknown_block';
    } catch (e) {
      info.error = String(e && e.message ? e.message : e);
    }

    return info;
  }

  function feSnapshotAroundUnit(u) {
    if (!u) return [];

    var gx = Math.round(u.x);
    var gy = Math.round(u.y);
    var cells = [];

    for (var yy = gy - 2; yy <= gy + 2; yy++) {
      for (var xx = gx - 2; xx <= gx + 2; xx++) {
        cells.push(feSnapshotDiagnoseCell(xx, yy, u.id));
      }
    }

    return cells;
  }

  function feSnapshotBuildInfo(builder) {
    if (!builder || !builder.buildOrder) return null;

    var order = builder.buildOrder;
    var spot = order.spot;
    var type = order.type;
    var buildingSize = (_deps && _deps.BUILDING_SIZE) ? (_deps.BUILDING_SIZE[type] || [2, 2]) : [2, 2];

    var info = {
      order: feSnapshotSafe(order),
      size: buildingSize,
      footprint: [],
      adjacent: [],
      accessCell: order.accessCell ? feSnapshotSafe(order.accessCell) : null,
      canPlaceBuilding: null
    };

    if (spot) {
      for (var yy = spot.y; yy < spot.y + buildingSize[1]; yy++) {
        var row = [];
        for (var xx = spot.x; xx < spot.x + buildingSize[0]; xx++) {
          row.push(feSnapshotDiagnoseCell(xx, yy, builder.id));
        }
        info.footprint.push(row);
      }

      try {
        info.canPlaceBuilding =
          (_deps && typeof _deps.canPlaceBuilding === 'function')
            ? _deps.canPlaceBuilding(spot.x, spot.y, buildingSize[0], buildingSize[1])
            : null;
      } catch (e) {
        info.canPlaceBuildingError = String(e && e.message ? e.message : e);
      }

      try {
        var adj =
          (_deps && typeof _deps.adjacentFreeCellsForRect === 'function')
            ? _deps.adjacentFreeCellsForRect(spot.x, spot.y, buildingSize[0], buildingSize[1], builder.id)
            : [];

        info.adjacent = adj.map(function (c) {
          return {
            cell: c,
            diagnosis: feSnapshotDiagnoseCell(c.x, c.y, builder.id),
            pathLength: (function () {
              try {
                var p = (_deps && typeof _deps.findPath === 'function') ? _deps.findPath(builder, c, builder.id) : null;
                return p === null ? null : p.length;
              } catch (e2) {
                return 'path_error: ' + String(e2 && e2.message ? e2.message : e2);
              }
            })()
          };
        });
      } catch (e) {
        info.adjacentError = String(e && e.message ? e.message : e);
      }
    }

    return info;
  }

  // ----------------------------------------------------------------
  // Main snapshot — uses window.FE_CORE.game + _deps
  // ----------------------------------------------------------------

  function feMakeSnapshot() {
    var game = (window.FE_CORE && window.FE_CORE.game) || null;
    var selected = (_deps && typeof _deps.getSelected === 'function') ? _deps.getSelected() : null;

    var builders = (game && game.units || []).filter(function (u) { return u.type === 'builder'; });
    var harvesters = (game && game.units || []).filter(function (u) { return u.type === 'harvester'; });

    return {
      createdAt: new Date().toISOString(),
      note: 'Manual Four Elements debug snapshot',
      game: game ? {
        screen: game.screen,
        paused: game.paused,
        mapSize: game.mapSize,
        mapW: game.mapW,
        mapH: game.mapH,
        faction: game.faction,
        time: game.time,
        resources: feSnapshotSafe(game.resources),
        storageLimits: (_deps && typeof _deps.getStorageLimits === 'function') ? feSnapshotSafe(_deps.getStorageLimits()) : null,
        camera: feSnapshotSafe(game.camera),
        buildingsCount: game.buildings ? game.buildings.length || 0 : 0,
        unitsCount: game.units ? game.units.length || 0 : 0,
        mineralsCount: game.minerals ? game.minerals.length || 0 : 0
      } : null,

      selected: selected ? feSnapshotSafe(selected) : null,

      builders: builders.map(function (b) {
        return {
          unit: feSnapshotSafe(b),
          grid: { x: Math.round(b.x), y: Math.round(b.y) },
          currentCell: feSnapshotDiagnoseCell(Math.round(b.x), Math.round(b.y), b.id),
          around: feSnapshotAroundUnit(b),
          buildInfo: feSnapshotBuildInfo(b)
        };
      }),

      harvesters: harvesters.map(function (h) {
        return {
          unit: feSnapshotSafe(h),
          grid: { x: Math.round(h.x), y: Math.round(h.y) },
          currentCell: feSnapshotDiagnoseCell(Math.round(h.x), Math.round(h.y), h.id),
          around: feSnapshotAroundUnit(h),
          targetMine: h.target ? feSnapshotSafe((game.minerals || []).find(function (m) { return m.id === h.target; })) : null,
          nearestBase: feSnapshotSafe((game.buildings || []).find(function (b) { return b.type === 'hq_base'; }))
        };
      }),

      buildings: feSnapshotSafe(game ? game.buildings || [] : []),
      visibleMinerals: feSnapshotSafe((game ? game.minerals || [] : []).slice(0, 80))
    };
  }

  // ----------------------------------------------------------------
  // Export — creates JSON and triggers browser download
  // ----------------------------------------------------------------

  function exportSnapshot() {
    var snapshot = feMakeSnapshot();

    var blob = new Blob(
      [JSON.stringify(snapshot, null, 2)],
      { type: 'application/json' }
    );

    var a = document.createElement('a');
    var ts = new Date().toISOString().replace(/[:.]/g, '-');

    a.href = URL.createObjectURL(blob);
    a.download = 'four_elements_snapshot_' + ts + '.json';

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);

    console.warn('[Four Elements] Snapshot exported', snapshot);
  }

  // ----------------------------------------------------------------
  // Init — store IIFE-scope function references from main.js
  // ----------------------------------------------------------------

  /**
   * Initialize the module with IIFE-scope function references.
   * Must be called once from main.js after all IIFE functions are defined.
   *
   * @param {Object} deps — IIFE-scope function references
   * @param {Function} [deps.inBounds]
   * @param {Function} [deps.isObstacleBlocked]
   * @param {Function} [deps.mineAt]
   * @param {Function} [deps.buildingAt]
   * @param {Function} [deps.unitAt]
   * @param {Function} [deps.passable]
   * @param {Function} [deps.canPlaceBuilding]
   * @param {Function} [deps.adjacentFreeCellsForRect]
   * @param {Function} [deps.findPath]
   * @param {Function} [deps.getStorageLimits]
   * @param {Function} [deps.getSelected]
   * @param {Object}   [deps.BUILDING_SIZE]
   */
  function init(deps) {
    _deps = deps || {};

    // Register F8 keydown handler
    window.addEventListener('keydown', function (e) {
      if (e.key === 'F8') {
        e.preventDefault();
        exportSnapshot();
      }
    });

    // Preserve backward-compatible public API
    window.FE_EXPORT_SNAPSHOT = exportSnapshot;

    console.warn('[Four Elements] Debug snapshot ready: use FE_EXPORT_SNAPSHOT() or F8');
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  return {
    init: init,
    makeSnapshot: feMakeSnapshot,
    exportSnapshot: exportSnapshot
  };
})();
