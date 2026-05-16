/** Manifest-based asset loader. Never throws; missing assets return null. */

export class AssetStore {
  private cache = new Map<string, HTMLImageElement>();
  private pending = new Set<string>();
  private failed = new Set<string>();

  /** Load all assets from a manifest. Returns a promise that resolves when all are done. */
  async loadManifest(manifest: Readonly<Record<string, string>>): Promise<void> {
    const entries = Object.entries(manifest);
    const promises = entries.map(([key, path]) => this.loadSingle(key, path));
    await Promise.all(promises);
  }

  /** Get a loaded asset by key. Returns null if not loaded yet, failed, or unknown. */
  get(key: string): HTMLImageElement | null {
    return this.cache.get(key) ?? null;
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
}
