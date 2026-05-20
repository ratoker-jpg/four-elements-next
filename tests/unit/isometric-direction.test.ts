import { describe, it, expect } from 'vitest';
import { directionToRow } from '../../src/render/spritesheet.js';

/**
 * Isometric direction mapping tests.
 *
 * Spritesheet art follows screen-space direction convention:
 *   Row 0 = screen-east, 1 = screen-SE, 2 = screen-south, 3 = screen-SW,
 *   4 = screen-west, 5 = screen-NW, 6 = screen-north, 7 = screen-NE.
 *
 * directionToRow() operates in tile-space, so the caller must apply
 * the isometric correction: screenRow = (tileRow + 1) % 8.
 *
 * In isometric projection (2:1 aspect):
 *   Tile east  (dx=+1, dy= 0) → screen SE
 *   Tile south (dx= 0, dy=+1) → screen SW
 *   Tile west  (dx=-1, dy= 0) → screen NW
 *   Tile north (dx= 0, dy=-1) → screen NE
 */
describe('isometric direction mapping: tile-space → screen-space', () => {
  /** Apply the isometric correction used in renderHarvester. */
  function toScreenRow(tileDx: number, tileDy: number): number {
    const tileRow = directionToRow(tileDx, tileDy);
    return (tileRow + 1) % 8;
  }

  // ── Cardinal directions (4-way movement) ────────────────────────

  it('tile east → screen SE (row 1)', () => {
    expect(toScreenRow(1, 0)).toBe(1);
  });

  it('tile south → screen SW (row 3)', () => {
    expect(toScreenRow(0, 1)).toBe(3);
  });

  it('tile west → screen NW (row 5)', () => {
    expect(toScreenRow(-1, 0)).toBe(5);
  });

  it('tile north → screen NE (row 7)', () => {
    expect(toScreenRow(0, -1)).toBe(7);
  });

  // ── Diagonal directions ─────────────────────────────────────────

  it('tile SE → screen south (row 2)', () => {
    expect(toScreenRow(1, 1)).toBe(2);
  });

  it('tile SW → screen west (row 4)', () => {
    expect(toScreenRow(-1, 1)).toBe(4);
  });

  it('tile NW → screen north (row 6)', () => {
    expect(toScreenRow(-1, -1)).toBe(6);
  });

  it('tile NE → screen east (row 0)', () => {
    expect(toScreenRow(1, -1)).toBe(0);
  });

  // ── Zero movement (default facing) ──────────────────────────────

  it('zero delta → screen SW default (row 3)', () => {
    // directionToRow(0,0) returns 2 (tile-south), mapped to (2+1)%8 = 3 (screen-SW)
    expect(toScreenRow(0, 0)).toBe(3);
  });

  // ── Small fractional deltas (smooth movement) ───────────────────

  it('small positive dx (moving tile-east) → screen SE', () => {
    expect(toScreenRow(0.1, 0)).toBe(1);
  });

  it('small positive dy (moving tile-south) → screen SW', () => {
    expect(toScreenRow(0, 0.1)).toBe(3);
  });
});
