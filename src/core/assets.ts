/** Manifest-based asset loader. Never throws; missing assets return null. */

import { assetPath } from './constants.js';

/** Alpha-bounds metadata for a loaded image asset. */
export interface AssetMeta {
  /** Horizontal offset of visible content within the canvas. */
  visibleX: number;
  /** Vertical offset of visible content within the canvas. */
  visibleY: number;
  /** Width of visible (non-transparent) content. */
  visibleW: number;
  /** Height of visible (non-transparent) content. */
  visibleH: number;
  /** Original canvas natural width. */
  naturalW: number;
  /** Original canvas natural height. */
  naturalH: number;
}

/**
 * Compute alpha bounding box from raw pixel data.
 * Pure function — no DOM dependency, easily testable.
 * Returns full dimensions as fallback when no visible pixels are found.
 */
export function computeAlphaBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let iy = 0; iy < height; iy++) {
    for (let ix = 0; ix < width; ix++) {
      const alpha: number = data[(iy * width + ix) * 4 + 3] ?? 0;
      if (alpha > 0) {
        if (ix < minX) minX = ix;
        if (iy < minY) minY = iy;
        if (ix > maxX) maxX = ix;
        if (iy > maxY) maxY = iy;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    // No visible pixels — fallback to full dimensions
    return { x: 0, y: 0, w: width, h: height };
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Determine whether alpha-bounds metadata should be computed for a given asset key.
 * Only building and HQ sprites need alpha-bounds; terrain, environment, and
 * unit spritesheets do not consume metadata yet, so scanning them is wasteful.
 */
export function shouldComputeAlphaMeta(key: string): boolean {
  return key.startsWith('building_') || key.startsWith('hq_');
}

export class AssetStore {
  private cache = new Map<string, HTMLImageElement>();
  private metaCache = new Map<string, AssetMeta>();
  private pending = new Set<string>();
  private failed = new Set<string>();

  /** Load all assets from a manifest. Paths are public-dir-relative; BASE_URL is prepended. */
  async loadManifest(manifest: Readonly<Record<string, string>>): Promise<void> {
    const entries = Object.entries(manifest);
    const promises = entries.map(([key, path]) => this.loadSingle(key, assetPath(path)));
    await Promise.all(promises);
  }

  /** Get a loaded asset by key. Returns null if not loaded yet, failed, or unknown. */
  get(key: string): HTMLImageElement | null {
    return this.cache.get(key) ?? null;
  }

  /** Get alpha-bounds metadata for a loaded asset. Returns null if not available. */
  getMeta(key: string): AssetMeta | null {
    return this.metaCache.get(key) ?? null;
  }

  /** Loading statistics. */
  stats(): { loaded: number; pending: number; failed: number } {
    return {
      loaded: this.cache.size,
      pending: this.pending.size,
      failed: this.failed.size,
    };
  }

  private loadSingle(key: string, path: string): Promise<void> {
    if (this.cache.has(key) || this.pending.has(key)) {
      return Promise.resolve();
    }
    this.pending.add(key);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(key, img);
        this.pending.delete(key);
        if (shouldComputeAlphaMeta(key)) {
          this.computeAndStoreMeta(key, img);
        }
        resolve();
      };
      img.onerror = () => {
        this.failed.add(key);
        this.pending.delete(key);
        console.warn(`[Assets] Failed to load: ${key} from ${path}`);
        resolve();
      };
      img.src = path;
    });
  }

  /** Scan the image's alpha channel and store metadata. Falls back to full dimensions on any error. */
  private computeAndStoreMeta(key: string, img: HTMLImageElement): void {
    try {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) return; // invalid dimensions — skip meta

      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, nw, nh);
      const bounds = computeAlphaBounds(imageData.data, nw, nh);

      this.metaCache.set(key, {
        visibleX: bounds.x,
        visibleY: bounds.y,
        visibleW: bounds.w,
        visibleH: bounds.h,
        naturalW: nw,
        naturalH: nh,
      });
    } catch {
      // Silently skip meta on any canvas/DOM error — fallback to full dimensions in render
    }
  }
}
