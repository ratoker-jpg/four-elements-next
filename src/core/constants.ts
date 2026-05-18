/** Core constants for the Four Elements game. Zero dependencies. */

// Isometric tile dimensions (pixels)
export const TILE_W = 76;
export const TILE_H = 38;

// Camera
export const CAMERA_MIN_ZOOM = 0.4;
export const CAMERA_MAX_ZOOM = 3.0;
export const CAMERA_PAN_SPEED = 400; // world pixels per second
export const CAMERA_ZOOM_STEP = 0.12;

// Map sizes
// TODO(NEXT-03+): Large map should use a larger grid (e.g. 64×64).
// For now both Standard and Large produce 48×48.
export const MAP_SIZE_STANDARD = 48;
export const MAP_SIZE_LARGE = 48; // intentional — differentiate in a future step
export const MAP_SIZE_DEV = 32;

// HQ
export const HQ_FOOTPRINT = 3; // 3×3 tiles (confirmed: matches sprite_profiles)

// Sprite rendering profiles (from Sandbox sprite_profiles.js, adapted)
export const SPRITE_PROFILES = {
  hq_base: { size: [172, 172], groundOffset: 0 },
  mineral_small: { size: [42, 42], groundOffset: -12 },
  mineral_medium: { size: [58, 58], groundOffset: 0 },
  mineral_large: { size: [74, 74], groundOffset: 0 },
  mineral_infinite: { size: [110, 96], groundOffset: 28 },
  mountain_small_01: { size: [80, 72], groundOffset: 0 },
  mountain_medium_01: { size: [120, 96], groundOffset: 12 },
  mountain_large_01: { size: [160, 142], groundOffset: 28 },
  volcano_small_01: { size: [95, 90], groundOffset: 0 },
  volcano_medium_01: { size: [130, 120], groundOffset: 12 },
  rock_cluster_small_01: { size: [58, 46], groundOffset: 0 },
  dry_bush_01: { size: [34, 28], groundOffset: -12 },
  sand_bump_01: { size: [50, 28], groundOffset: -8 },
  builder_base: { size: [76, 76], groundOffset: 20 },
  harvester_base: { size: [82, 82], groundOffset: 16 },
  building_separator: { size: [132, 132], groundOffset: 0 },
  building_raw_storage: { size: [138, 138], groundOffset: 0 },
  building_matter_storage: { size: [136, 136], groundOffset: 0 },
  building_power_plant: { size: [124, 124], groundOffset: 0 },
  building_command_relay: { size: [96, 96], groundOffset: 0 },
  building_units_factory: { size: [142, 142], groundOffset: 0 },
} as const;

// Terrain rendering
export const TERRAIN_COLORS: Record<string, string> = {
  sand: '#d9c67a',
  'sand-dark': '#c4a85a',
  'sand-light': '#e8d88e',
};
export const GRID_COLOR = 'rgba(0,0,0,0.06)';
export const HQ_COLOR = '#d4a544';
export const BG_COLOR = '#171008';

// Asset manifest — paths relative to public dir (no leading slash).
// Resolved at runtime via assetPath() which prepends BASE_URL.
export const ASSET_MANIFEST: Record<string, string> = {
  terrain_sand: 'assets/tiles/sand_tile.png',
  terrain_sand_dark: 'assets/tiles/sand_tile_dark.png',
  terrain_sand_light: 'assets/tiles/sand_tile_light.png',
  mineral_small: 'assets/environment/mineral_small.png',
  mineral_medium: 'assets/environment/mineral_medium.png',
  mineral_large: 'assets/environment/mineral_large.png',
  mineral_infinite: 'assets/environment/mineral_infinite.png',
  mountain_small_01: 'assets/environment/mountain_small_01.png',
  mountain_medium_01: 'assets/environment/mountain_medium_01.png',
  mountain_large_01: 'assets/environment/mountain_large_01.png',
  volcano_small_01: 'assets/environment/volcano_small_01.png',
  volcano_medium_01: 'assets/environment/volcano_medium_01.png',
  rock_cluster_small_01: 'assets/environment/rock_cluster_small_01.png',
  dry_bush_01: 'assets/environment/dry_bush_01.png',
  sand_bump_01: 'assets/environment/sand_bump_01.png',
  hq_cyan: 'assets/factions/cyan/buildings/hq_t1.png',
  hq_green: 'assets/factions/green/buildings/hq_t1.png',
  hq_yellow: 'assets/factions/yellow/buildings/hq_t1.png',
  hq_purple: 'assets/factions/purple/buildings/hq_t1.png',
};

/** Prepend Vite's BASE_URL to a public-dir-relative path. Works locally and on GitHub Pages. */
export function assetPath(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

// ── Civil unit 8×8 256 spritesheet feature flag ──────────────────────

/** When true (default), builder and harvester render from faction spritesheets. Falls back to iso-box geometry when OFF or asset missing. */
export const FE_CIVIL_8X8_256_SHEETS_ENABLED = true;

/** Manifest for 8 civil unit spritesheets (4 builder + 4 harvester). Only loaded when FE_CIVIL_8X8_256_SHEETS_ENABLED is true. */
export const CIVIL_8X8_256_MANIFEST: Record<string, string> = {
  builder_cyan: 'assets/factions/cyan/units/builder_8x8_256.png',
  builder_green: 'assets/factions/green/units/builder_8x8_256.png',
  builder_yellow: 'assets/factions/yellow/units/builder_8x8_256.png',
  builder_purple: 'assets/factions/purple/units/builder_8x8_256.png',
  harvester_cyan: 'assets/factions/cyan/units/harvester_8x8_256.png',
  harvester_green: 'assets/factions/green/units/harvester_8x8_256.png',
  harvester_yellow: 'assets/factions/yellow/units/harvester_8x8_256.png',
  harvester_purple: 'assets/factions/purple/units/harvester_8x8_256.png',
};

// ── Building sprite feature flag ──────────────────────────────────────

/** When true (default), buildings render from faction PNG sprites. Falls back to iso-box geometry when OFF or asset missing. */
export const FE_BUILDING_SPRITES_ENABLED = true;

/** Manifest for building PNG sprites (5 types × 4 factions = 20 entries). Only loaded when FE_BUILDING_SPRITES_ENABLED is true. */
export const BUILDING_ASSET_MANIFEST: Record<string, string> = {
  building_cyan_separator: 'assets/factions/cyan/buildings/separator.png',
  building_green_separator: 'assets/factions/green/buildings/separator.png',
  building_yellow_separator: 'assets/factions/yellow/buildings/separator.png',
  building_purple_separator: 'assets/factions/purple/buildings/separator.png',
  building_cyan_raw_storage: 'assets/factions/cyan/buildings/raw_storage.png',
  building_green_raw_storage: 'assets/factions/green/buildings/raw_storage.png',
  building_yellow_raw_storage: 'assets/factions/yellow/buildings/raw_storage.png',
  building_purple_raw_storage: 'assets/factions/purple/buildings/raw_storage.png',
  building_cyan_matter_storage: 'assets/factions/cyan/buildings/matter_storage.png',
  building_green_matter_storage: 'assets/factions/green/buildings/matter_storage.png',
  building_yellow_matter_storage: 'assets/factions/yellow/buildings/matter_storage.png',
  building_purple_matter_storage: 'assets/factions/purple/buildings/matter_storage.png',
  building_cyan_power_plant: 'assets/factions/cyan/buildings/power_plant.png',
  building_green_power_plant: 'assets/factions/green/buildings/power_plant.png',
  building_yellow_power_plant: 'assets/factions/yellow/buildings/power_plant.png',
  building_purple_power_plant: 'assets/factions/purple/buildings/power_plant.png',
  building_cyan_command_relay: 'assets/factions/cyan/buildings/command_relay.png',
  building_green_command_relay: 'assets/factions/green/buildings/command_relay.png',
  building_yellow_command_relay: 'assets/factions/yellow/buildings/command_relay.png',
  building_purple_command_relay: 'assets/factions/purple/buildings/command_relay.png',
  building_cyan_units_factory: 'assets/factions/cyan/buildings/units_factory.png',
  building_green_units_factory: 'assets/factions/green/buildings/units_factory.png',
  building_yellow_units_factory: 'assets/factions/yellow/buildings/units_factory.png',
  building_purple_units_factory: 'assets/factions/purple/buildings/units_factory.png',
};
