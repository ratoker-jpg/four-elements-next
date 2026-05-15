// REF-MAIN-GLM-06 — Standalone pure constants
// Extracted from src/main.js (lines 7-14, 24-38)
// These constants have zero runtime dependencies: no window.*, no functions, no game state.

window.FE_STANDALONE_CONSTANTS = Object.freeze({
  SAVE_KEY: 'four_elements_core_base_v04_save',
  SETTINGS_KEY: 'four_elements_core_base_v04_settings',
  TILE_W: 76,
  TILE_H: 38,
  MAP_SIZES: {
    standard: { label: 'Стандартная', w: 48, h: 48 },
    large:    { label: 'Большая', w: 96, h: 96 }
  },
  BASE_STORAGE: {
    minerals: 200,
    energy: 300,
    purple: 20,
    greenEl: 20,
    cyanEl: 20,
    yellowEl: 20
  },
  FACTION_ELEMENT_KEY: {
    purple: 'purple',
    green: 'greenEl',
    cyan: 'cyanEl',
    yellow: 'yellowEl'
  }
});
