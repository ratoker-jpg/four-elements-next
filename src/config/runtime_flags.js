// Four Elements v0.4 runtime flags.
// Keep these defaults stable unless a specific visual/movement test changes them.

window.FE_EXTERNAL_RENDER_DEBUG_ENABLED = false;
window.FE_SHOW_BUILDING_FOOTPRINTS = false;
window.FE_SHOW_UNIT_FOOTPRINTS = false;
window.FE_BUILDER_USE_MOVE_FRAMES = false;
window.FE_DEV_HOTKEYS_ENABLED = true;

// Dev camera zoom: enabled for visual inspection/testing only.
// Set FE_DEV_CAMERA_ZOOM_ENABLED=false before locking final player-facing zoom.
window.FE_DEV_CAMERA_ZOOM_ENABLED = true;
window.FE_CAMERA_MIN_ZOOM = 0.55;
window.FE_CAMERA_MAX_ZOOM = 1.95;
window.FE_CAMERA_MAX_ZOOM_DEV = 4.0;

// Builder-only visual dust effect: short burst on movement start, light trail while moving.
window.FE_BUILDER_DUST_ENABLED = true;
window.FE_BUILDER_DUST_WHEEL_Y = -8;
// Harvester sprites use larger visual Y offsets, so dust needs a higher contact point.
window.FE_HARVESTER_DUST_WHEEL_Y = -34;
// Harvester dust visual tuning: heavier vehicle, larger/darker dust than builder.
window.FE_HARVESTER_DUST_RADIUS_MULT = 1.35;
window.FE_HARVESTER_DUST_ALPHA_MULT = 1.18;
window.FE_HARVESTER_DUST_COLOR = '#b98552';
// Light tank dust: smaller/lighter than harvester, only while moving.
window.FE_LIGHT_TANK_DUST_WHEEL_Y = -30;
window.FE_LIGHT_TANK_DUST_RADIUS_MULT = 0.72;
window.FE_LIGHT_TANK_DUST_ALPHA_MULT = 0.68;
window.FE_LIGHT_TANK_DUST_TRAIL_COUNT = 2;
window.FE_LIGHT_TANK_DUST_BURST_COUNT = 5;
// Scout dust: light vehicle, minimal dust.
window.FE_SCOUT_DUST_WHEEL_Y = -14;
window.FE_SCOUT_DUST_RADIUS_MULT = 0.55;
window.FE_SCOUT_DUST_ALPHA_MULT = 0.50;
window.FE_SCOUT_DUST_TRAIL_COUNT = 2;
window.FE_SCOUT_DUST_BURST_COUNT = 4;
window.FE_BUILDER_DUST_TRAIL_INTERVAL = 0.16;
window.FE_BUILDER_DUST_TRAIL_COUNT = 3;
window.FE_BUILDER_DUST_BURST_COUNT = 9;
window.FE_BUILDER_DUST_MAX_PARTICLES = 80;

// Universal RTS command marker: small ground marker on accepted/blocked move commands.
// Keep the old FE_BUILDER_* flags as compatibility fallback for builder-specific tests.
window.FE_UNIT_CLICK_MARKER_ENABLED = true;
window.FE_UNIT_CLICK_MARKER_TYPES = ['builder', 'harvester', 'light_tank', 'heavy_tank', 'bomber', 'scout'];
window.FE_UNIT_CLICK_MARKER_LIFE = 0.62;
window.FE_UNIT_CLICK_MARKER_SIZE = 0.23;
// v0.4 build menu cleanup: only show buildings with a clear role in the current playable loop.
window.FE_V04_BUILD_MENU_TYPES = ['separator', 'minerals_storage', 'energy_storage', 'elements_storage', 'units_factory', 'power_plant'];
window.FE_POWER_HQ_MW = 15; // POWER-SYSTEM-01A: increased from 10 to 15 — starter workers + separator + factory fit within HQ capacity
window.FE_POWER_PLANT_MW = 20;
window.FE_SEPARATOR_ACTIVE_POWER_MW = 4;
window.FE_UNITS_FACTORY_ACTIVE_POWER_MW = 5;
window.FE_POWER_UNIT_MW = 1; // POWER-SYSTEM-01A: each active unit consumes 1 MW of power (upkeep)
window.FE_POWER_ENFORCEMENT_ENABLED = true;
window.FE_BUILDER_CLICK_MARKER_ENABLED = true;
window.FE_BUILDER_CLICK_MARKER_LIFE = 0.62;
window.FE_BUILDER_CLICK_MARKER_SIZE = 0.23;

// Builder-only right-click cancel: suppress browser menu and stop builder after current tile.
window.FE_BUILDER_RIGHT_CLICK_CANCEL_ENABLED = true;

// Builder construction cancel/resume: right-click cancels active build, Ctrl+right-click cancels unfinished building.
window.FE_BUILDER_CONSTRUCTION_CANCEL_RESUME_ENABLED = true;
window.FE_BUILDER_CONSTRUCTION_CANCEL_REFUND_RATE = 0.75;

// Resource generation: spawn-relative clusters instead of fixed map-coordinate fields.
window.FE_RESOURCE_CLUSTER_GENERATION_ENABLED = true;
window.FE_SPAWN_BASED_RESOURCE_GENERATION_ENABLED = true;
// Current build has one active player. Future builds can set this to 2, 3 or 4.
window.FE_RESOURCE_PLAYER_COUNT = 1;
window.FE_STARTER_RESOURCE_CLUSTER_BOOST_VERSION = "starter_resource_boost_20260503_1";
window.FE_LARGE_MAP_EXTRA_RESOURCE_FIELDS_ENABLED = true;
window.FE_MINERAL_CAPACITY_BALANCE_VERSION = "mineral_capacity_large_fields_20260503_1";
window.FE_CENTER_INFINITE_VISUAL_OFFSET_VERSION = "center_infinite_offset_20260503_1";
window.FE_CENTER_INFINITE_VISUAL_OFFSET_Y = -5;
window.FE_CENTER_INFINITE_VISUAL_OFFSET_X = -5;

// Dev map inspection: key 0 toggles all fog/vision overlays off/on.
window.FE_DEV_FULL_MAP_REVEAL_ENABLED = true;
window.FE_DEV_FULL_MAP_REVEAL_ACTIVE = false;

// Render sorting: sort map objects by their ground anchor, not sprite size/order.
window.FE_ANCHOR_DEPTH_SORT_ENABLED = true;

// Territory spread: max Manhattan radius painted by each completed building.
window.FE_TERRITORY_BUILDING_RADIUS = 5;

// rawDir -> spriteDir. Builder v2 sprites are rotated one 4-dir step vs the old set.
window.FE_BUILDER_DIR_MAP = [2, 2, 2, 0, 6, 6, 4, 4];
// Harvester v2 is a true 8-direction export: dir index matches screen rawDir.
window.FE_HARVESTER_DIR_MAP = [2, 0, 0, 6, 6, 4, 4, 2];
// Light tank uses the same first-pass direction mapping as the 350x350 harvester exports.
// Adjust only after visual Playwright/screenshot validation if a direction is wrong.
window.FE_LIGHT_TANK_DIR_MAP = [2, 0, 0, 6, 6, 4, 4, 2];
// Scout 8-direction mapping: confirmed by manual dev-calibration.
// rawDir 0→3, 1→2, 2→1, 3→0, 4→7, 5→6, 6→5, 7→4.
window.FE_SCOUT_DIR_MAP = [3, 2, 1, 0, 7, 6, 5, 4];
// ARCH-LAB-01: FE_UNIT_CONTROLLER_ENABLED is permanently false.
// unit_controller.js has been archived to src/core/_archived/unit_controller.js.
// The production movement code remains in main.js (Z14).
// Do NOT delete this flag — main.js guard code reads it.
// See: docs/project/ARCH_LAB_01_SKELETON_CONTRACTS.md §5
window.FE_UNIT_CONTROLLER_ENABLED = false;

// ARCH-AI-01 / ARCH-AI-05C3: Tank Decider — Priority Stack decision layer for enemy light_tank.
// When true, enemy light_tank decisions go through tank_decider.js instead of
// legacy updateEnemyBot cascade. Default true since 05C3 — legacy fallback remains active
// for tanks not managed by the decider (idle result, suppressLegacyOrders=false).
// Runtime toggle: window.FE_TANK_DECIDER_ENABLED = true/false in browser console.
// Rollback: set to false to restore 1:1 legacy behavior.
window.FE_TANK_DECIDER_ENABLED = true;
window.FE_BUILDER_FORCE_DIR = null;
window.FE_HARVESTER_FORCE_DIR = null;
window.FE_LIGHT_TANK_FORCE_DIR = null;
window.FE_SCOUT_FORCE_DIR = null;

// Builder landing correction by sprite direction, in screen pixels before zoom.
window.FE_BUILDER_DIR_OFFSETS = {
  0: { x: -2, y: 4 },
  2: { x:  1, y: 4 },
  4: { x: -1, y: 4 },
  6: { x: -1, y: 5 }
};
window.FE_HARVESTER_DIR_OFFSETS = {
  0: { x: 0, y: 26 }, // down-right
  2: { x: 0, y: 27 }, // up-right
  4: { x: 0, y: 26 }, // up-left
  6: { x: 0, y: 27 }  // down-left
};
// Light tank centering calibration from visual debug overlay.
// x/y are screen-pixel offsets before camera zoom.
window.FE_LIGHT_TANK_DIR_OFFSETS = {
  0: { x: 0, y: 0 },
  1: { x: 0, y: 0 },
  2: { x: 0, y: 0 },
  3: { x: 0, y: 0 },
  4: { x: 0, y: 0 },
  5: { x: 0, y: 0 },
  6: { x: 0, y: 0 },
  7: { x: 0, y: 0 }
};
// Scout visual landing offsets: calibrated from dev-overlay screenshot.
// dir 2 pinned to {"x":-1,"y":22} per photo measurement; remaining dirs
// follow the same +20 px vertical correction over the 01E baseline.
window.FE_SCOUT_DIR_OFFSETS = {
  0: { x: -1, y: 22 },
  1: { x: -1, y: 21 },
  2: { x: -1, y: 22 },
  3: { x: -1, y: 21 },
  4: { x: -1, y: 22 },
  5: { x: -1, y: 21 },
  6: { x: -1, y: 22 },
  7: { x: -1, y: 21 }
};
