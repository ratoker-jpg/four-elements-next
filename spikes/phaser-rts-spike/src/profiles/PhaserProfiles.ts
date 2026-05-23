/**
 * Minimal sprite profiles for the Phaser RTS spike.
 * Maps asset keys to display parameters.
 * Based on the production game's SPRITE_PROFILES in src/core/constants.ts.
 */

import { TILE_W, TILE_H } from '../iso/IsoUtils.js';

export interface SpikeProfile {
  /** Maximum display width in pixels */
  displayW: number;
  /** Maximum display height in pixels */
  displayH: number;
  /** Vertical offset: positive = floats up from ground, negative = sinks */
  groundOffset: number;
  /** Footprint in tiles (1 = 1x1, 2 = 2x2, 3 = 3x3) */
  footprint: number;
}

/**
 * Minimal profiles for spike assets.
 * key = Phaser texture key used in BootScene loading.
 */
export const SPIKE_PROFILES: Record<string, SpikeProfile> = {
  // Terrain
  sand_tile: { displayW: TILE_W, displayH: TILE_H, groundOffset: 0, footprint: 1 },

  // Buildings
  hq: { displayW: 200, displayH: 200, groundOffset: 2, footprint: 3 },

  // Environment
  mineral_small: { displayW: 42, displayH: 42, groundOffset: -8, footprint: 1 },
  mineral_infinite: { displayW: 170, displayH: 170, groundOffset: -52, footprint: 3 },
  mountain_small: { displayW: 80, displayH: 73, groundOffset: -20, footprint: 2 },
  rock_cluster: { displayW: 58, displayH: 46, groundOffset: -8, footprint: 1 },

  // Units (sprite sheet frames are 256x256)
  harvester: { displayW: 41, displayH: 41, groundOffset: 8, footprint: 1 },
  builder: { displayW: 57, displayH: 57, groundOffset: 15, footprint: 1 },
};
