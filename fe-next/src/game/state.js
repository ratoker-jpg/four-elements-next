// FEN-01: Minimal game state.
// Creates and manages the FE Next game state object.
// Exposed as window.FE_NEXT_STATE.

(function () {
  'use strict';

  var C = window.FE_NEXT_CONSTANTS;
  var COORDS = window.FE_NEXT_COORDS;

  /**
   * Create a terrain grid for the given map size.
   * Each cell is a string: 'grass', 'sand', 'dirt', 'water', 'rock'.
   * For FEN-01 we use a simple deterministic pattern.
   *
   * @param {number} w
   * @param {number} h
   * @returns {string[][]}
   */
  function generateTerrain(w, h) {
    var grid = [];
    for (var y = 0; y < h; y++) {
      var row = [];
      for (var x = 0; x < w; x++) {
        // Simple pattern: mostly grass with sand borders and a few dirt patches
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          row.push('sand');
        } else if ((x + y) % 7 === 0) {
          row.push('dirt');
        } else {
          row.push('grass');
        }
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Create initial game state for FE Next.
   * @returns {object}
   */
  function createInitialState() {
    var terrain = generateTerrain(C.MAP_W, C.MAP_H);

    // Player HQ at tile (4, 4) — a 2x2 building
    var hq = {
      id: 'player_hq',
      type: 'hq',
      owner: 'player',
      tx: 4,
      ty: 4,
      size: C.HQ_SIZE,
      hp: 500,
      maxHp: 500
    };

    // One test unit near the HQ
    var testUnit = {
      id: 'test_unit_1',
      type: 'light_tank',
      owner: 'player',
      tx: 7,
      ty: 5,
      hp: C.UNIT_HP,
      maxHp: C.UNIT_HP,
      selected: false,
      moving: false,
      moveTarget: null,       // {tx, ty} — destination tile
      moveProgress: 0,        // 0..1 interpolation
      moveFrom: null          // {tx, ty} — origin tile
    };

    // Camera centered on HQ
    var hqScreen = COORDS.tileToScreen(hq.tx + 0.5, hq.ty + 0.5);

    return {
      // Meta
      running: true,
      time: 0,
      tickCount: 0,

      // Map
      mapW: C.MAP_W,
      mapH: C.MAP_H,
      terrain: terrain,

      // Camera
      camera: {
        x: hqScreen.x,
        y: hqScreen.y,
        zoom: 1.0
      },

      // Input state
      keys: {},
      mouseDown: false,
      middleMouseDown: false,
      lastMouseX: 0,
      lastMouseY: 0,
      panStartX: 0,
      panStartY: 0,
      camPanStartX: 0,
      camPanStartY: 0,

      // Entities
      buildings: [hq],
      units: [testUnit],

      // Resources
      resources: {
        minerals: C.START_MINERALS,
        energy: C.START_ENERGY
      },

      // Selection
      selectedUnitId: null,

      // Move markers (visual feedback for right-click commands)
      moveMarkers: []
    };
  }

  /**
   * Find a unit by its ID.
   * @param {object} state
   * @param {string} id
   * @returns {object|null}
   */
  function findUnit(state, id) {
    for (var i = 0; i < state.units.length; i++) {
      if (state.units[i].id === id) return state.units[i];
    }
    return null;
  }

  /**
   * Get the currently selected unit (if any).
   * @param {object} state
   * @returns {object|null}
   */
  function getSelectedUnit(state) {
    if (!state.selectedUnitId) return null;
    return findUnit(state, state.selectedUnitId);
  }

  /**
   * Find a unit at the given tile position (within radius tolerance).
   * @param {object} state
   * @param {number} tx
   * @param {number} ty
   * @returns {object|null}
   */
  function findUnitAtTile(state, tx, ty) {
    for (var i = 0; i < state.units.length; i++) {
      var u = state.units[i];
      var d = Math.abs(u.tx - tx) + Math.abs(u.ty - ty);
      if (d < 1.0) return u;
    }
    return null;
  }

  /**
   * Issue a move command to a unit.
   * @param {object} state
   * @param {string} unitId
   * @param {number} targetTx
   * @param {number} targetTy
   */
  function issueMoveCommand(state, unitId, targetTx, targetTy) {
    var unit = findUnit(state, unitId);
    if (!unit) return;

    // Clamp target to map bounds
    targetTx = COORDS.clamp(targetTx, 0, state.mapW - 1);
    targetTy = COORDS.clamp(targetTy, 0, state.mapH - 1);

    unit.moving = true;
    unit.moveFrom = { tx: unit.tx, ty: unit.ty };
    unit.moveTarget = { tx: targetTx, ty: targetTy };
    unit.moveProgress = 0;

    // Add move marker
    state.moveMarkers.push({
      tx: targetTx,
      ty: targetTy,
      life: 0.8    // seconds
    });
  }

  /**
   * Update movement for all units.
   * @param {object} state
   * @param {number} dt - Delta time in seconds
   */
  function updateMovement(state, dt) {
    for (var i = 0; i < state.units.length; i++) {
      var u = state.units[i];
      if (!u.moving || !u.moveTarget || !u.moveFrom) continue;

      var dx = u.moveTarget.tx - u.moveFrom.tx;
      var dy = u.moveTarget.ty - u.moveFrom.ty;
      var pathLen = Math.hypot(dx, dy);

      if (pathLen < 0.01) {
        // Already at target
        u.tx = u.moveTarget.tx;
        u.ty = u.moveTarget.ty;
        u.moving = false;
        u.moveFrom = null;
        u.moveTarget = null;
        u.moveProgress = 1;
        continue;
      }

      var speed = C.UNIT_SPEED;
      u.moveProgress += (speed * dt) / pathLen;

      if (u.moveProgress >= 1) {
        u.tx = u.moveTarget.tx;
        u.ty = u.moveTarget.ty;
        u.moving = false;
        u.moveFrom = null;
        u.moveTarget = null;
        u.moveProgress = 1;
      } else {
        u.tx = u.moveFrom.tx + dx * u.moveProgress;
        u.ty = u.moveFrom.ty + dy * u.moveProgress;
      }
    }
  }

  /**
   * Update move markers (fade out over time).
   * @param {object} state
   * @param {number} dt
   */
  function updateMoveMarkers(state, dt) {
    for (var i = state.moveMarkers.length - 1; i >= 0; i--) {
      state.moveMarkers[i].life -= dt;
      if (state.moveMarkers[i].life <= 0) {
        state.moveMarkers.splice(i, 1);
      }
    }
  }

  window.FE_NEXT_STATE = {
    createInitialState: createInitialState,
    findUnit: findUnit,
    getSelectedUnit: getSelectedUnit,
    findUnitAtTile: findUnitAtTile,
    issueMoveCommand: issueMoveCommand,
    updateMovement: updateMovement,
    updateMoveMarkers: updateMoveMarkers
  };
})();
