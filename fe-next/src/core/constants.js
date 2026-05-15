// FEN-01: FE Next core constants.
// Zero dependencies. All values are pure constants for the FE Next game.
// Exposed as window.FE_NEXT_CONSTANTS.

(function () {
  'use strict';

  window.FE_NEXT_CONSTANTS = Object.freeze({
    // Map
    MAP_W: 24,
    MAP_H: 24,

    // Isometric tile dimensions (half-width, half-height for diamond)
    TILE_W: 76,
    TILE_H: 38,

    // Camera
    CAMERA_MIN_ZOOM: 0.4,
    CAMERA_MAX_ZOOM: 3.0,
    CAMERA_PAN_SPEED: 400,      // pixels per second
    CAMERA_ZOOM_STEP: 0.12,

    // Rendering
    TERRAIN_COLORS: {
      grass:  '#a8c256',
      sand:   '#d9c67a',
      dirt:   '#b8944e',
      water:  '#4a8fb8',
      rock:   '#8a8a7a'
    },
    HQ_COLOR:     '#d4a544',
    HQ_OUTLINE:   '#8b6914',
    UNIT_COLOR:   '#5eaaef',
    UNIT_OUTLINE: '#2d6fa0',
    UNIT_SELECTED: '#ffd66c',
    GRID_COLOR:   'rgba(0,0,0,0.08)',
    MOVE_MARKER_COLOR: 'rgba(255,214,108,0.7)',

    // Unit
    UNIT_SPEED: 3.0,            // tiles per second
    UNIT_RADIUS: 0.35,          // in tile units
    UNIT_HP: 100,

    // HQ
    HQ_SIZE: 2,                 // tiles (2x2 building)

    // Resources
    START_MINERALS: 200,
    START_ENERGY: 160,

    // Tick
    TARGET_FPS: 60,
    FRAME_BUDGET_MS: 16.67
  });
})();
