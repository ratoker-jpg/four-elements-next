/**
 * VISUAL-QA-ARCH-01 PR2 — Regression test for civil unit sprite profiles.
 *
 * Ensures builder and harvester profile values remain at their tuned sizes.
 * These values were changed from original sandbox imports to reduce visual
 * scale relative to terrain cells and buildings.
 */

import { describe, it, expect } from 'vitest';
import { SPRITE_PROFILES } from '../../src/core/constants.js';

describe('VISUAL-QA-ARCH-01 PR2 — civil unit sprite profiles', () => {
  it('builder_base size is [57, 57]', () => {
    expect(SPRITE_PROFILES.builder_base.size).toEqual([57, 57]);
  });

  it('harvester_base size is [41, 41]', () => {
    expect(SPRITE_PROFILES.harvester_base.size).toEqual([41, 41]);
  });

  it('builder_base groundOffset is 15', () => {
    expect(SPRITE_PROFILES.builder_base.groundOffset).toBe(15);
  });

  it('harvester_base groundOffset is 8', () => {
    expect(SPRITE_PROFILES.harvester_base.groundOffset).toBe(8);
  });

  it('other profiles are unchanged (spot-check)', () => {
    // Verify we didn't accidentally touch unrelated profiles
    expect(SPRITE_PROFILES.hq_base.size).toEqual([200, 200]);
    expect(SPRITE_PROFILES.building_separator.size).toEqual([128, 128]);
    expect(SPRITE_PROFILES.mineral_small.size).toEqual([42, 42]);
    expect(SPRITE_PROFILES.mountain_small_01.size).toEqual([80, 72]);
  });
});
