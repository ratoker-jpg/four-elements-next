import { describe, it, expect } from 'vitest';
import {
  tileToScreen,
  screenToTile,
  worldToCanvas,
  canvasToWorld,
  clamp,
  dist,
  terrainWorldBounds,
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

describe('terrainWorldBounds', () => {
  it('1x1 map has bounds around the single tile diamond', () => {
    const b = terrainWorldBounds(1, 1);
    // Tile (0,0) center at tileToScreen(0.5, 0.5) = (0, TILE_H/2)
    // Diamond: top (0, 0), right (TILE_W/2, TILE_H/2), bottom (0, TILE_H), left (-TILE_W/2, TILE_H/2)
    expect(b.minX).toBe(-TILE_W / 2);
    expect(b.maxX).toBe(TILE_W / 2);
    expect(b.minY).toBe(0);
    expect(b.maxY).toBe(TILE_H);
  });

  it('square map has symmetric X bounds', () => {
    const size = 48;
    const b = terrainWorldBounds(size, size);
    expect(b.minX).toBe(-size * TILE_W / 2);
    expect(b.maxX).toBe(size * TILE_W / 2);
    expect(b.minY).toBe(0);
    expect(b.maxY).toBe((size + size) * TILE_H / 2);
  });

  it('non-square map: minX depends on height, maxX depends on width', () => {
    const b = terrainWorldBounds(64, 32);
    expect(b.minX).toBe(-32 * TILE_W / 2);
    expect(b.maxX).toBe(64 * TILE_W / 2);
    expect(b.minY).toBe(0);
    expect(b.maxY).toBe((64 + 32) * TILE_H / 2);
  });

  it('minX is negative for any map with height > 0', () => {
    const b = terrainWorldBounds(10, 5);
    expect(b.minX).toBeLessThan(0);
  });

  it('bounds contain all tile diamond vertices for a small map', () => {
    // Brute-force: check every tile diamond vertex is within bounds
    const W = 8;
    const H = 6;
    const b = terrainWorldBounds(W, H);
    const halfW = TILE_W / 2;
    const halfH = TILE_H / 2;

    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const center = tileToScreen(tx + 0.5, ty + 0.5);
        // Top vertex
        expect(center.y - halfH).toBeGreaterThanOrEqual(b.minY);
        // Bottom vertex
        expect(center.y + halfH).toBeLessThanOrEqual(b.maxY);
        // Left vertex
        expect(center.x - halfW).toBeGreaterThanOrEqual(b.minX);
        // Right vertex
        expect(center.x + halfW).toBeLessThanOrEqual(b.maxX);
      }
    }
  });

  it('bounds are tight: outermost vertices touch the bounds', () => {
    const W = 10;
    const H = 10;
    const b = terrainWorldBounds(W, H);

    // Top vertex of tile (0,0) should be at minY
    const topLeft = tileToScreen(0.5, 0.5);
    expect(topLeft.y - TILE_H / 2).toBe(b.minY);

    // Left vertex of tile (0, H-1) should be at minX
    const left = tileToScreen(0.5, H - 0.5);
    expect(left.x - TILE_W / 2).toBe(b.minX);

    // Right vertex of tile (W-1, 0) should be at maxX
    const right = tileToScreen(W - 0.5, 0.5);
    expect(right.x + TILE_W / 2).toBe(b.maxX);

    // Bottom vertex of tile (W-1, H-1) should be at maxY
    const bottom = tileToScreen(W - 0.5, H - 0.5);
    expect(bottom.y + TILE_H / 2).toBe(b.maxY);
  });
});
