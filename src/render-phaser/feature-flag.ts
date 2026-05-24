export const PHASER_RENDERER_FLAG = 'FE_PHASER_RENDERER_ENABLED';

interface FlagStorage {
  getItem(key: string): string | null;
}

interface PhaserRendererFlagSource {
  readonly search?: string;
  readonly storage?: FlagStorage | null;
  readonly envValue?: string | boolean | undefined;
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'phaser']);

export function isTruthyFlagValue(value: string | boolean | null | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

export function isPhaserRendererEnabled(source: PhaserRendererFlagSource = {}): boolean {
  if (isTruthyFlagValue(source.envValue ?? import.meta.env.VITE_FE_PHASER_RENDERER_ENABLED)) {
    return true;
  }

  const runtimeWindow = typeof window === 'undefined' ? null : window;
  const search = source.search ?? runtimeWindow?.location.search ?? '';
  const query = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);

  if (isTruthyFlagValue(query.get(PHASER_RENDERER_FLAG))) {
    return true;
  }

  if (query.get('renderer')?.trim().toLowerCase() === 'phaser') {
    return true;
  }

  const storage = source.storage ?? runtimeWindow?.localStorage ?? null;
  try {
    return isTruthyFlagValue(storage?.getItem(PHASER_RENDERER_FLAG));
  } catch {
    return false;
  }
}
