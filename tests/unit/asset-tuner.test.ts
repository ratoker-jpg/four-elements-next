/**
 * ENV-ASSET-TUNER-01 — Unit tests for Asset Tuner override logic.
 *
 * Tests the pure logic functions: merge, reset, localStorage, config snippet,
 * and dev guard behavior.
 */

import { describe, expect, it, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import {
  mergeProfileWithOverride,
  formatConfigSnippet,
  resetOverride,
  resetAllOverrides,
  setOverride,
  getActiveOverrides,
  isAssetTunerAllowed,
  loadOverrides,
  getEffectiveProfile,
  type AssetTunerProfileOverride,
  type AssetTunerOverrides,
} from '../../src/dev/asset-tuner.js';
import type { SpriteProfile } from '../../src/core/constants.js';

// ── In-memory localStorage mock ──────────────────────────────────────

const STORAGE_KEY = 'four-elements-next.asset-tuner-overrides.v1';

let storage: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { storage = {}; },
  get length() { return Object.keys(storage).length; },
  key: (_index: number) => null,
};

// Install localStorage mock before tests
beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function clearTunerStorage(): void {
  try {
    localStorageMock.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// ── Merge logic ──────────────────────────────────────────────────────

describe('mergeProfileWithOverride', () => {
  const base: SpriteProfile = {
    size: [80, 72],
    groundOffset: 0,
  };

  it('returns base profile when no override is provided', () => {
    const result = mergeProfileWithOverride(base, undefined);
    expect(result.size).toEqual([80, 72]);
    expect(result.groundOffset).toBe(0);
    expect(result.screenOffsetX).toBeUndefined();
    expect(result.screenOffsetY).toBeUndefined();
  });

  it('returns base profile when empty override is provided', () => {
    const result = mergeProfileWithOverride(base, {});
    expect(result.size).toEqual([80, 72]);
    expect(result.groundOffset).toBe(0);
  });

  it('overrides sizeW only', () => {
    const result = mergeProfileWithOverride(base, { sizeW: 100 });
    expect(result.size).toEqual([100, 72]);
    expect(result.groundOffset).toBe(0);
  });

  it('overrides sizeH only', () => {
    const result = mergeProfileWithOverride(base, { sizeH: 60 });
    expect(result.size).toEqual([80, 60]);
  });

  it('overrides groundOffset', () => {
    const result = mergeProfileWithOverride(base, { groundOffset: -4 });
    expect(result.groundOffset).toBe(-4);
  });

  it('overrides screenOffsetX and screenOffsetY', () => {
    const result = mergeProfileWithOverride(base, { screenOffsetX: 2, screenOffsetY: -3 });
    expect(result.screenOffsetX).toBe(2);
    expect(result.screenOffsetY).toBe(-3);
  });

  it('preserves base screenOffsetX/Y when override does not include them but base has them', () => {
    const baseWithOffsets: SpriteProfile = {
      size: [200, 200],
      groundOffset: 2,
      screenOffsetX: -2,
      screenOffsetY: -2,
    };
    const result = mergeProfileWithOverride(baseWithOffsets, { groundOffset: 5 });
    expect(result.groundOffset).toBe(5);
    expect(result.screenOffsetX).toBe(-2);
    expect(result.screenOffsetY).toBe(-2);
  });

  it('applies override screenOffsetX even when base does not have it', () => {
    const result = mergeProfileWithOverride(base, { screenOffsetX: 3 });
    expect(result.screenOffsetX).toBe(3);
  });

  it('does not mutate the base profile', () => {
    const baseCopy: SpriteProfile = { ...base, size: [...base.size] as [number, number] };
    mergeProfileWithOverride(base, { sizeW: 999 });
    expect(base.size[0]).toBe(80);
    expect(baseCopy.size[0]).toBe(80);
  });
});

// ── Override set / reset ─────────────────────────────────────────────

describe('override set and reset', () => {
  beforeEach(() => {
    resetAllOverrides();
    clearTunerStorage();
  });

  afterEach(() => {
    resetAllOverrides();
    clearTunerStorage();
  });

  it('setOverride stores the override value', () => {
    setOverride('dry_bush_01', 'sizeW', 48);
    const overrides = getActiveOverrides();
    expect(overrides['dry_bush_01']).toBeDefined();
    expect(overrides['dry_bush_01']!.sizeW).toBe(48);
  });

  it('setOverride adds to existing override without losing other fields', () => {
    setOverride('dry_bush_01', 'sizeW', 48);
    setOverride('dry_bush_01', 'groundOffset', -4);
    const overrides = getActiveOverrides();
    expect(overrides['dry_bush_01']!.sizeW).toBe(48);
    expect(overrides['dry_bush_01']!.groundOffset).toBe(-4);
  });

  it('resetOverride clears a specific key', () => {
    setOverride('dry_bush_01', 'sizeW', 48);
    setOverride('mountain_small_01', 'groundOffset', 5);
    resetOverride('dry_bush_01');
    const overrides = getActiveOverrides();
    expect(overrides['dry_bush_01']).toBeUndefined();
    expect(overrides['mountain_small_01']).toBeDefined();
  });

  it('resetAllOverrides clears everything', () => {
    setOverride('dry_bush_01', 'sizeW', 48);
    setOverride('mountain_small_01', 'groundOffset', 5);
    resetAllOverrides();
    const overrides = getActiveOverrides();
    expect(Object.keys(overrides)).toHaveLength(0);
  });
});

// ── Config snippet formatting ────────────────────────────────────────

describe('formatConfigSnippet', () => {
  beforeEach(() => {
    resetAllOverrides();
    clearTunerStorage();
  });

  afterEach(() => {
    resetAllOverrides();
    clearTunerStorage();
  });

  it('formats base profile with no overrides', () => {
    const snippet = formatConfigSnippet('dry_bush_01');
    // dry_bush_01 base: { size: [66, 68], groundOffset: -12 }
    expect(snippet).toContain('dry_bush_01:');
    expect(snippet).toContain('size: [66, 68]');
    expect(snippet).toContain('groundOffset: -12');
    expect(snippet).not.toContain('screenOffsetX');
    expect(snippet).not.toContain('screenOffsetY');
  });

  it('formats profile with override applied', () => {
    setOverride('dry_bush_01', 'sizeW', 48);
    setOverride('dry_bush_01', 'groundOffset', -4);
    const snippet = formatConfigSnippet('dry_bush_01');
    expect(snippet).toContain('dry_bush_01:');
    expect(snippet).toContain('size: [48, 68]');
    expect(snippet).toContain('groundOffset: -4');
  });

  it('includes screenOffsetX when non-zero', () => {
    setOverride('dry_bush_01', 'screenOffsetX', 3);
    const snippet = formatConfigSnippet('dry_bush_01');
    expect(snippet).toContain('screenOffsetX: 3');
  });

  it('omits screenOffsetX/Y when zero', () => {
    setOverride('dry_bush_01', 'screenOffsetX', 0);
    const snippet = formatConfigSnippet('dry_bush_01');
    expect(snippet).not.toContain('screenOffsetX');
  });

  it('returns empty string for unknown profile key', () => {
    const snippet = formatConfigSnippet('nonexistent_profile');
    expect(snippet).toBe('');
  });

  it('output is valid TypeScript-like config entry', () => {
    setOverride('dry_bush_01', 'sizeW', 48);
    setOverride('dry_bush_01', 'sizeH', 40);
    setOverride('dry_bush_01', 'groundOffset', -4);
    setOverride('dry_bush_01', 'screenOffsetY', 2);
    const snippet = formatConfigSnippet('dry_bush_01');
    // Should look like: dry_bush_01: { size: [48, 40], groundOffset: -4, screenOffsetY: 2 },
    expect(snippet).toBe('dry_bush_01: { size: [48, 40], groundOffset: -4, screenOffsetY: 2 },');
  });
});

// ── localStorage persistence ─────────────────────────────────────────

describe('localStorage persistence', () => {
  beforeEach(() => {
    resetAllOverrides();
    clearTunerStorage();
  });

  afterEach(() => {
    resetAllOverrides();
    clearTunerStorage();
  });

  it('persists overrides to localStorage on set', () => {
    setOverride('dry_bush_01', 'sizeW', 48);
    const raw = localStorageMock.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed['dry_bush_01'].sizeW).toBe(48);
  });

  it('loads overrides from localStorage', () => {
    const data: AssetTunerOverrides = {
      mountain_small_01: { groundOffset: 5 },
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(data));
    const loaded = loadOverrides();
    expect(loaded['mountain_small_01']).toBeDefined();
    expect(loaded['mountain_small_01']!.groundOffset).toBe(5);
  });

  it('handles corrupt localStorage data safely', () => {
    localStorageMock.setItem(STORAGE_KEY, '{invalid json!!!');
    const loaded = loadOverrides();
    expect(Object.keys(loaded)).toHaveLength(0);
  });

  it('handles non-object localStorage data safely', () => {
    localStorageMock.setItem(STORAGE_KEY, '"just a string"');
    const loaded = loadOverrides();
    expect(Object.keys(loaded)).toHaveLength(0);
  });

  it('handles array localStorage data safely', () => {
    localStorageMock.setItem(STORAGE_KEY, '[1,2,3]');
    const loaded = loadOverrides();
    expect(Object.keys(loaded)).toHaveLength(0);
  });

  it('handles null localStorage data safely', () => {
    localStorageMock.setItem(STORAGE_KEY, 'null');
    const loaded = loadOverrides();
    expect(Object.keys(loaded)).toHaveLength(0);
  });

  it('ignores invalid field names in stored data', () => {
    const data = {
      dry_bush_01: { sizeW: 48, invalidField: 'bad' },
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(data));
    const loaded = loadOverrides();
    expect(loaded['dry_bush_01']).toBeDefined();
    expect(loaded['dry_bush_01']!.sizeW).toBe(48);
    expect((loaded['dry_bush_01'] as Record<string, unknown>)['invalidField']).toBeUndefined();
  });

  it('ignores non-number field values in stored data', () => {
    const data = {
      dry_bush_01: { sizeW: 'not a number' },
    };
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(data));
    const loaded = loadOverrides();
    // No valid fields -> entry is skipped
    expect(loaded['dry_bush_01']).toBeUndefined();
  });

  it('removes corrupt data from localStorage after failed load', () => {
    localStorageMock.setItem(STORAGE_KEY, '{invalid json!!!');
    loadOverrides();
    expect(localStorageMock.getItem(STORAGE_KEY)).toBeNull();
  });
});

// ── Dev guard behavior ──────────────────────────────────────────────

describe('isAssetTunerAllowed', () => {
  it('returns true in test mode (import.meta.env.MODE === test)', () => {
    // In vitest, MODE should be 'test', so this should pass
    expect(isAssetTunerAllowed()).toBe(true);
  });
});

// ── No-overrides identity behavior ──────────────────────────────────

describe('no-override identity', () => {
  beforeEach(() => {
    resetAllOverrides();
    clearTunerStorage();
  });

  afterEach(() => {
    resetAllOverrides();
    clearTunerStorage();
  });

  it('getEffectiveProfile returns base values when no overrides are active', () => {
    const profile = getEffectiveProfile('dry_bush_01');
    expect(profile).toBeDefined();
    expect(profile!.size).toEqual([66, 68]);
    expect(profile!.groundOffset).toBe(-12);
  });

  it('getEffectiveProfile with override applied reflects the override', () => {
    setOverride('dry_bush_01', 'sizeW', 48);
    setOverride('dry_bush_01', 'groundOffset', -4);
    const profile = getEffectiveProfile('dry_bush_01');
    expect(profile).toBeDefined();
    expect(profile!.size).toEqual([48, 68]);
    expect(profile!.groundOffset).toBe(-4);
  });

  it('getEffectiveProfile returns undefined for unknown keys', () => {
    const profile = getEffectiveProfile('totally_unknown_key');
    expect(profile).toBeUndefined();
  });
});
