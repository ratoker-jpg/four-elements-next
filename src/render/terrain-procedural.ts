/**
 * PROC-SAND-01 — Procedural cached sand terrain renderer.
 *
 * Replaces PNG-based sand terrain rendering with deterministic procedural
 * terrain drawn as isometric diamonds. Uses soft chunk-level tint variation
 * and subtle per-tile micro-variation for natural-looking terrain without
 * visible seams, detached tiles, or grid artifacts.
 *
 * Design goals:
 * - No Math.random() — fully deterministic from visualSeed + tile coords
 * - Chunk-based tint variation keeps nearby tiles visually related
 * - Lightweight chunk cache keyed by visualSeed + terrain type + chunk coords
 * - Cache invalidated when visualSeed changes
 * - No stroke/seam — continuous filled diamonds with anti-gap overlap
 * - No expensive per-frame noise/image generation
 */

import {
  TILE_W,
  TILE_H,
  TERRAIN_COLORS,
  PROCEDURAL_SAND_CHUNK_SIZE,
  PROC_SAND_HUE_RANGE,
  PROC_SAND_SAT_RANGE,
  PROC_SAND_LIGHT_RANGE,
  PROC_SAND_MICRO_RANGE,
} from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { MapData, TerrainType } from '../game/map-types.js';
import type { Camera } from './camera.js';

// ── Deterministic hash (FNV-1a, same algorithm as asset-variants.ts) ────────

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashParts(...parts: Array<string | number>): number {
  return hashString(parts.join('|'));
}

// ── Color conversion utilities ──────────────────────────────────────────────

/** Parse a hex color string (#RRGGBB) to [R, G, B] in 0–255. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** Convert RGB (each 0–1) to HSL. Returns [H in degrees, S 0–1, L 0–1]. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l]; // achromatic

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return [h * 360, s, l];
}

/** HSL → RGB helper for a single channel. */
function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** Convert HSL (H in degrees, S/L 0–1) to RGB (each 0–1). */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  if (s === 0) return [l, l, l]; // achromatic

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;

  return [
    hueToRgb(p, q, hk + 1 / 3),
    hueToRgb(p, q, hk),
    hueToRgb(p, q, hk - 1 / 3),
  ];
}

// ── Pre-computed base HSL per terrain type ──────────────────────────────────

const baseHslCache = new Map<string, [number, number, number]>();

/** Get the base HSL for a terrain type. Cached after first computation. */
function getBaseHsl(terrainType: string): [number, number, number] {
  const cached = baseHslCache.get(terrainType);
  if (cached) return cached;

  const hex = TERRAIN_COLORS[terrainType] ?? TERRAIN_COLORS.sand!;
  const [r, g, b] = hexToRgb(hex);
  const hsl = rgbToHsl(r / 255, g / 255, b / 255);
  baseHslCache.set(terrainType, hsl);
  return hsl;
}

// ── Chunk tint cache ────────────────────────────────────────────────────────

/** Chunk-level tint offset data for procedural variation. */
export interface ChunkTintData {
  readonly hueShift: number;
  readonly satShift: number;
  readonly lightShift: number;
  readonly microSeed: number;
}

const chunkCache = new Map<string, ChunkTintData>();
let cachedVisualSeed: number = -1;

/** Get or compute chunk tint data. Cache is invalidated when visualSeed changes. */
function getChunkTint(
  visualSeed: number,
  terrainType: TerrainType,
  chunkX: number,
  chunkY: number,
): ChunkTintData {
  const key = `${visualSeed}:${terrainType}:${chunkX}:${chunkY}`;
  const cached = chunkCache.get(key);
  if (cached) return cached;

  const h1 = hashParts('chunk-hue', visualSeed, terrainType, chunkX, chunkY);
  const h2 = hashParts('chunk-sat', visualSeed, terrainType, chunkX, chunkY);
  const h3 = hashParts('chunk-lit', visualSeed, terrainType, chunkX, chunkY);
  const h4 = hashParts('chunk-micro', visualSeed, terrainType, chunkX, chunkY);

  // Map hash to signed offsets within the configured ranges
  // hueShift: ±PROC_SAND_HUE_RANGE degrees
  // satShift: ±PROC_SAND_SAT_RANGE (fraction)
  // lightShift: ±PROC_SAND_LIGHT_RANGE (fraction)
  const data: ChunkTintData = {
    hueShift: ((h1 % (PROC_SAND_HUE_RANGE * 20 + 1)) - PROC_SAND_HUE_RANGE * 10) / 10,
    satShift: ((h2 % (Math.round(PROC_SAND_SAT_RANGE * 200) + 1)) - PROC_SAND_SAT_RANGE * 100) / 100,
    lightShift: ((h3 % (Math.round(PROC_SAND_LIGHT_RANGE * 200) + 1)) - PROC_SAND_LIGHT_RANGE * 100) / 100,
    microSeed: h4,
  };

  chunkCache.set(key, data);
  return data;
}

/** Clear the procedural terrain chunk cache. Used when visualSeed changes or for testing. */
export function clearProceduralSandCache(): void {
  chunkCache.clear();
  cachedVisualSeed = -1;
}

// ── Procedural color computation ────────────────────────────────────────────

/**
 * Compute the procedural sand color for a single tile.
 * Deterministic: same inputs always produce the same output.
 * Exported for testing.
 */
export function proceduralSandColor(
  terrainType: TerrainType,
  visualSeed: number,
  tx: number,
  ty: number,
): string {
  const chunkX = Math.floor(tx / PROCEDURAL_SAND_CHUNK_SIZE);
  const chunkY = Math.floor(ty / PROCEDURAL_SAND_CHUNK_SIZE);
  const chunkTint = getChunkTint(visualSeed, terrainType, chunkX, chunkY);

  const [baseH, baseS, baseL] = getBaseHsl(terrainType);

  // Apply chunk-level tint offsets
  let finalH = baseH + chunkTint.hueShift;
  let finalS = Math.max(0, Math.min(1, baseS + chunkTint.satShift));
  let finalL = Math.max(0, Math.min(1, baseL + chunkTint.lightShift));

  // Apply per-tile micro-variation (subtle brightness shift)
  const tileHash = hashParts('tile-micro', chunkTint.microSeed, tx, ty);
  const microShift = ((tileHash % (Math.round(PROC_SAND_MICRO_RANGE * 200) + 1)) - PROC_SAND_MICRO_RANGE * 100) / 100;
  finalL = Math.max(0, Math.min(1, finalL + microShift));

  const [fr, fg, fb] = hslToRgb(finalH, finalS, finalL);
  return `rgb(${Math.round(fr * 255)},${Math.round(fg * 255)},${Math.round(fb * 255)})`;
}

// ── Main render function ────────────────────────────────────────────────────

/**
 * Render procedural sand terrain with deterministic chunk-based variation.
 * Draws continuous isometric diamonds with no stroke/seam.
 * Replaces the PNG-based terrain render path when FE_PROCEDURAL_SAND_ENABLED is true.
 */
export function renderProceduralTerrain(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
  visualSeed: number,
): void {
  // Invalidate chunk cache if visualSeed changed
  if (cachedVisualSeed !== visualSeed) {
    chunkCache.clear();
    cachedVisualSeed = visualSeed;
  }

  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const hw = (TILE_W / 2) * camera.zoom;
  const hh = (TILE_H / 2) * camera.zoom;
  const margin = Math.max(hw, hh) + 20;

  // Anti-gap: slight overlap to prevent subpixel gaps between adjacent tiles.
  // 0.5px expansion ensures fills merge seamlessly even with anti-aliasing.
  const antiGap = 0.5;

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const scr = tileToScreen(tx + 0.5, ty + 0.5);
      const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);

      if (cv.x < -margin || cv.x > canvasW + margin) continue;
      if (cv.y < -margin || cv.y > canvasH + margin) continue;

      const terrainType: TerrainType = map.terrain[ty]?.[tx] ?? 'sand';
      const fill = proceduralSandColor(terrainType, visualSeed, tx, ty);

      // Draw filled diamond with NO stroke — continuous coverage, no grid lines
      ctx.beginPath();
      ctx.moveTo(cv.x, cv.y - hh - antiGap);
      ctx.lineTo(cv.x + hw + antiGap, cv.y);
      ctx.lineTo(cv.x, cv.y + hh + antiGap);
      ctx.lineTo(cv.x - hw - antiGap, cv.y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }
}
