/**
 * Generic keyed object registry for persistent Phaser GameObjects.
 *
 * Instead of destroying and recreating all presentation objects every frame,
 * the registry tracks objects by stable identity keys and only creates,
 * updates, or destroys objects when the snapshot changes.
 */

export interface DisposableObject {
  setDepth(value: number): this;
  destroy(): void;
}

export class ObjectRegistry<T extends DisposableObject> {
  private readonly objects = new Map<string, T>();

  /** Number of objects currently tracked. */
  get size(): number {
    return this.objects.size;
  }

  /** Get an object by key, or undefined. */
  get(key: string): T | undefined {
    return this.objects.get(key);
  }

  /** Check if a key exists. */
  has(key: string): boolean {
    return this.objects.has(key);
  }

  /**
   * Synchronize the registry against the current snapshot keys.
   *
   * - Keys present in `currentKeys` but not in the registry → call `onCreate`
   * - Keys present in both → call `onUpdate`
   * - Keys present in the registry but not in `currentKeys` → call `onDestroy`
   *
   * Returns a stats object for debugging.
   */
  sync(
    currentKeys: Iterable<string>,
    onCreate: (key: string) => T,
    onUpdate: (key: string, obj: T) => void,
    onDestroy: (key: string, obj: T) => void,
  ): { created: number; updated: number; destroyed: number } {
    let created = 0;
    let updated = 0;
    let destroyed = 0;

    const currentKeySet = new Set<string>();

    for (const key of currentKeys) {
      currentKeySet.add(key);
      const existing = this.objects.get(key);
      if (existing) {
        onUpdate(key, existing);
        updated++;
      } else {
        const obj = onCreate(key);
        this.objects.set(key, obj);
        created++;
      }
    }

    for (const [key, obj] of this.objects) {
      if (!currentKeySet.has(key)) {
        onDestroy(key, obj);
        this.objects.delete(key);
        destroyed++;
      }
    }

    return { created, updated, destroyed };
  }

  /** Destroy all tracked objects and clear the registry. */
  clear(onDestroy: (key: string, obj: T) => void): void {
    for (const [key, obj] of this.objects) {
      onDestroy(key, obj);
    }
    this.objects.clear();
  }

  /** Iterate all entries. */
  entries(): IterableIterator<[string, T]> {
    return this.objects.entries();
  }
}
