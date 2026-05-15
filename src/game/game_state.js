// Four Elements v0.4 module: game state data factory.
// ARCH-LAB-02: extracted from src/main.js blankGame().
// Provides window.FE_GAME_STATE.createBlankGame(sizeKey) which returns the
// initial game-state object for a new or loaded game.

(function () {
  'use strict';

  if (!window.FE_STANDALONE_CONSTANTS) {
    var msg = '[FE GAME STATE] FATAL: window.FE_STANDALONE_CONSTANTS is missing. ' +
      'Ensure src/core/standalone_constants.js is loaded before game_state.js.';
    console.error(msg);
    throw new Error(msg);
  }

  var MAP_SIZES = window.FE_STANDALONE_CONSTANTS.MAP_SIZES;

  /**
   * Create a blank game-state object for the given map size key.
   * Returns an object identical to the previous inline blankGame(sizeKey).
   *
   * @param {string} sizeKey - Map size key, e.g. 'standard', 'large'. Defaults to 'standard'.
   * @returns {object} Fresh game-state object.
   */
  function createBlankGame(sizeKey) {
    var key = sizeKey || 'standard';
    var cfg = MAP_SIZES[key] || MAP_SIZES.standard;
    return {
      screen: 'game',
      paused: false,
      mapSize: key,
      mapW: cfg.w,
      mapH: cfg.h,
      time: 0,
      faction: 'cyan',
      factionWasRandom: false,
      resources: { minerals: 0, purple: 0, greenEl: 0, cyanEl: 0, yellowEl: 0, energy: 160, powerTotal: 0, powerUsed: 0 },
      // FE_PATCH_09A: hidden enemy economy bucket. Not shown in player HUD.
      enemyResources: { minerals: 0, energy: 160, purple: 0, greenEl: 0, cyanEl: 0, yellowEl: 0 },
      camera: { x: 0, y: 0, zoom: 1.05 },
      terrain: [],
      minerals: [],
      units: [],
      buildings: [],
      obstacles: [],
      territory: [],
      fogVisible: [],
      fogExplored: [],
      messages: [],
      clickMarkers: [],
      dustParticles: [],
      combatFxParticles: [],
      _sepTimer: 0,
      _reactTimer: 0,
      _saveTimer: 0,
      gameResult: null,
      gameResultReason: null,
      gameResultAt: 0,
      gameEnded: false,
      _enemyHqSeen: false
    };
  }

  window.FE_GAME_STATE = {
    createBlankGame: createBlankGame
  };
})();
