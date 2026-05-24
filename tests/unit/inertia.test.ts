import { describe, it, expect } from 'vitest';
import { createInertiaState, updateInertia, type InertiaState } from '../../src/render-phaser/vfx/inertia.js';

describe('inertia', () => {
  it('creates state at rest', () => {
    const state = createInertiaState();
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
    expect(state.rotation).toBe(0);
    expect(state.wasMoving).toBe(false);
  });

  it('applies forward impulse on movement start', () => {
    const state = createInertiaState();
    updateInertia(state, true, 1, 0); // moving right

    expect(state.offsetX).toBeGreaterThan(0);
    expect(state.wasMoving).toBe(true);
  });

  it('decays to zero when stopped', () => {
    const state = createInertiaState();
    updateInertia(state, true, 1, 0);
    expect(state.offsetX).toBeGreaterThan(0);

    // Simulate many frames of being stopped
    for (let i = 0; i < 100; i++) {
      updateInertia(state, false, 0, 0);
    }

    expect(Math.abs(state.offsetX)).toBeLessThan(0.01);
    expect(Math.abs(state.offsetY)).toBeLessThan(0.01);
    expect(Math.abs(state.rotation)).toBeLessThan(0.01);
  });

  it('clamps offsets to max amplitude', () => {
    const state = createInertiaState();
    // Apply extreme direction — should still be clamped
    for (let i = 0; i < 50; i++) {
      updateInertia(state, true, 10, 10); // extreme normalized (should be -1 to 1, but clamp protects)
    }

    expect(state.offsetX).toBeLessThanOrEqual(3);
    expect(state.offsetX).toBeGreaterThanOrEqual(-3);
    expect(state.offsetY).toBeLessThanOrEqual(3);
    expect(state.offsetY).toBeGreaterThanOrEqual(-3);
    expect(state.rotation).toBeLessThanOrEqual(2.5);
    expect(state.rotation).toBeGreaterThanOrEqual(-2.5);
  });

  it('sustained movement produces subtle stable offset', () => {
    const state = createInertiaState();
    // Simulate many frames of sustained movement
    for (let i = 0; i < 100; i++) {
      updateInertia(state, true, 1, 0.5);
    }

    // Should settle to small sustained offset, not grow unboundedly
    expect(Math.abs(state.offsetX)).toBeLessThan(3);
    expect(Math.abs(state.offsetY)).toBeLessThan(3);
  });

  it('no idle bobbing — all values zero when stationary from start', () => {
    const state = createInertiaState();
    for (let i = 0; i < 50; i++) {
      updateInertia(state, false, 0, 0);
    }
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
    expect(state.rotation).toBe(0);
  });

  it('settle-back impulse on movement stop', () => {
    const state = createInertiaState();
    // Start moving
    updateInertia(state, true, 1, 0);
    const offsetXWhileMoving = state.offsetX;

    // Stop — should produce a brief overshoot/settle
    updateInertia(state, false, 0, 0);
    // After stopping, impulse should be in opposite direction
    expect(state.impulseOffsetX).toBeLessThan(0); // opposite to positive offset
  });
});
