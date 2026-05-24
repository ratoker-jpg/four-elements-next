import { describe, expect, it } from 'vitest';
import {
  PHASER_RENDERER_FLAG,
  isPhaserRendererEnabled,
  isTruthyFlagValue,
} from '../../src/render-phaser/feature-flag.js';

function storageValue(value: string | null) {
  return {
    getItem(key: string): string | null {
      return key === PHASER_RENDERER_FLAG ? value : null;
    },
  };
}

describe('Phaser renderer feature flag', () => {
  it('defaults to disabled', () => {
    expect(isPhaserRendererEnabled({ search: '', storage: null, envValue: undefined })).toBe(false);
  });

  it('accepts truthy flag values', () => {
    expect(isTruthyFlagValue('1')).toBe(true);
    expect(isTruthyFlagValue('true')).toBe(true);
    expect(isTruthyFlagValue('phaser')).toBe(true);
    expect(isTruthyFlagValue('0')).toBe(false);
  });

  it('can be enabled by query string', () => {
    expect(isPhaserRendererEnabled({ search: `?${PHASER_RENDERER_FLAG}=1`, storage: null })).toBe(true);
    expect(isPhaserRendererEnabled({ search: '?renderer=phaser', storage: null })).toBe(true);
  });

  it('can be enabled by localStorage-style storage', () => {
    expect(isPhaserRendererEnabled({ search: '', storage: storageValue('true') })).toBe(true);
  });
});
