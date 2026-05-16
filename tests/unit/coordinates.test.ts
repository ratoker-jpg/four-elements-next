import { describe, it, expect } from 'vitest';
import {
  tileToScreen,
  screenToTile,
  worldToCanvas,
  canvasToWorld,
  clamp,
  dist,
} from '../../src/core/coordinates.js';
import { TILE_W, TILE_H } from '../../src/core/constants.js';

describe('coordinates', () => {
  it('tileToScreen(0,0) returns origin', () => {
    const p = tileToScreen(0, 0);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('tileToScreen(1,0) shifts right and down', () => {
    const p = tileToScreen(1, 0);
    expect(p.x).toBe(TILE_W / 2);
    expect(p.y).toBe(TILE_H / 2);
  });

  it('tileToScreen(0,1) shifts left and down', () => {
    const p = tileToScreen(0, 1);
    expect(p.x).toBe(-TILE_W / 2);
    expect(p.y).toBe(TILE_H / 2);
  });

  it('screenToTile is inverse of tileToScreen', () => {
    const tile = screenToTile(tileToScreen(5, 7).x, tileToScreen(5, 7).y);
    expect(tile.x).toBeCloseTo(5, 5);
    expect(tile.y).toBeCloseTo(7, 5);
  });

  it('worldToCanvas and canvasToWorld are inverses', () => {
    const sx = 100;
    const sy = 200;
    const camX = 50;
    const camY = 75;
    const zoom = 1.5;
    const cw = 800;
    const ch = 600;
    const cv = worldToCanvas(sx, sy, camX, camY, zoom, cw, ch);
    const w = canvasToWorld(cv.x, cv.y, camX, camY, zoom, cw, ch);
    expect(w.x).toBeCloseTo(sx, 5);
    expect(w.y).toBeCloseTo(sy, 5);
  });

  it('clamp works correctly', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('dist computes Euclidean distance', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 5);
  });
});
