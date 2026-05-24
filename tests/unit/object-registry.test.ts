import { describe, expect, it } from 'vitest';
import { ObjectRegistry, type DisposableObject } from '../../src/render-phaser/object-registry.js';

class MockObject implements DisposableObject {
  depth = 0;
  destroyed = false;
  setDepth(value: number): this {
    this.depth = value;
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

describe('ObjectRegistry', () => {
  it('starts empty', () => {
    const registry = new ObjectRegistry<MockObject>();
    expect(registry.size).toBe(0);
  });

  it('creates objects for new keys', () => {
    const registry = new ObjectRegistry<MockObject>();
    const stats = registry.sync(
      ['a', 'b'],
      () => new MockObject(),
      () => {},
      () => {},
    );
    expect(stats.created).toBe(2);
    expect(stats.updated).toBe(0);
    expect(stats.destroyed).toBe(0);
    expect(registry.size).toBe(2);
  });

  it('updates existing objects', () => {
    const registry = new ObjectRegistry<MockObject>();
    registry.sync(['a', 'b'], () => new MockObject(), () => {}, () => {});
    const stats = registry.sync(
      ['a', 'b'],
      () => new MockObject(),
      (_key, obj) => obj.setDepth(42),
      () => {},
    );
    expect(stats.created).toBe(0);
    expect(stats.updated).toBe(2);
    expect(stats.destroyed).toBe(0);
    expect(registry.get('a')?.depth).toBe(42);
  });

  it('destroys removed objects', () => {
    const registry = new ObjectRegistry<MockObject>();
    registry.sync(['a', 'b', 'c'], () => new MockObject(), () => {}, () => {});
    const destroyed: string[] = [];
    const stats = registry.sync(
      ['a'],
      () => new MockObject(),
      () => {},
      (key, obj) => { destroyed.push(key); obj.destroy(); },
    );
    expect(stats.created).toBe(0);
    expect(stats.updated).toBe(1);
    expect(stats.destroyed).toBe(2);
    expect(destroyed).toContain('b');
    expect(destroyed).toContain('c');
    expect(registry.size).toBe(1);
  });

  it('handles empty current keys', () => {
    const registry = new ObjectRegistry<MockObject>();
    registry.sync(['a', 'b'], () => new MockObject(), () => {}, () => {});
    const stats = registry.sync(
      [],
      () => new MockObject(),
      () => {},
      (_key, obj) => obj.destroy(),
    );
    expect(stats.destroyed).toBe(2);
    expect(registry.size).toBe(0);
  });

  it('has and get work correctly', () => {
    const registry = new ObjectRegistry<MockObject>();
    registry.sync(['x'], () => new MockObject(), () => {}, () => {});
    expect(registry.has('x')).toBe(true);
    expect(registry.has('y')).toBe(false);
    expect(registry.get('x')).toBeDefined();
    expect(registry.get('y')).toBeUndefined();
  });

  it('clear destroys all objects', () => {
    const registry = new ObjectRegistry<MockObject>();
    registry.sync(['a', 'b'], () => new MockObject(), () => {}, () => {});
    registry.clear((_key, obj) => obj.destroy());
    expect(registry.size).toBe(0);
  });

  it('handles mixed create/update/destroy in one sync', () => {
    const registry = new ObjectRegistry<MockObject>();
    registry.sync(['a', 'b'], () => new MockObject(), () => {}, () => {});
    const stats = registry.sync(
      ['b', 'c'],
      () => new MockObject(),
      (_key, obj) => obj.setDepth(99),
      (_key, obj) => obj.destroy(),
    );
    expect(stats.created).toBe(1);
    expect(stats.updated).toBe(1);
    expect(stats.destroyed).toBe(1);
    expect(registry.has('a')).toBe(false);
    expect(registry.has('b')).toBe(true);
    expect(registry.has('c')).toBe(true);
    expect(registry.get('b')?.depth).toBe(99);
  });
});
