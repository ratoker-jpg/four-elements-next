/**
 * DEV-SANDBOX-ARCH-01 PR2 — Debug canvas overlays.
 *
 * Render-only debug overlays for QA. Controlled from the dev panel.
 * All overlays are OFF by default and have near-zero overhead when disabled.
 *
 * Availability: same guard as dev panel (DEV / test / ?devtools=1).
 * No gameplay state mutation from overlays. Additive rendering only.
 */

import { TILE_W, TILE_H, HQ_FOOTPRINT, SPRITE_PROFILES, START_CORE_RADIUS, START_ECONOMY_RADIUS, START_TRANSITION_RADIUS } from '../core/constants.js';
import type { SpriteProfile } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { Camera } from '../render/camera.js';
import type { MapData } from '../game/map-types.js';
import type { FactionId } from '../game/map-types.js';
import type { TerritoryState } from '../systems/territory.js';
import type { HarvesterState, ResourceNodeState } from '../systems/harvesting.js';
import { getBuildingFootprint } from '../config/buildings.js';
import { RESOURCE_ASSET_KEYS, OBSTACLE_ASSET_KEYS, DECOR_ASSET_KEYS } from '../game/map-types.js';
import type { AssetStore } from '../core/assets.js';
import { HQ_ASSET_KEYS, BUILDING_ASSET_KEYS, BUILDING_PROFILE_KEYS } from '../render/buildings.js';
import { isDevPanelAllowed } from './dev-panel.js';

// ── Overlay toggle state ──────────────────────────────────────────

export interface OverlayToggles {
  grid: boolean;
  footprints: boolean;
  resourceAmounts: boolean;
  obstacleBlocking: boolean;
  territoryDebug: boolean;
  hqToCenter: boolean;
  radii: boolean;
  spriteDebug: boolean;
}

const toggles: OverlayToggles = {
  grid: false,
  footprints: false,
  resourceAmounts: false,
  obstacleBlocking: false,
  territoryDebug: false,
  hqToCenter: false,
  radii: false,
  spriteDebug: false,
};

/** Get current overlay toggle state (for dev panel wiring). */
export function getOverlayToggles(): OverlayToggles {
  return toggles;
}

/** Set a specific overlay toggle. */
export function setOverlayToggle(key: keyof OverlayToggles, value: boolean): void {
  toggles[key] = value;
}

/** Check whether any overlay is enabled (to skip render pass entirely). */
export function anyOverlayEnabled(): boolean {
  return toggles.grid || toggles.footprints || toggles.resourceAmounts ||
         toggles.obstacleBlocking || toggles.territoryDebug || toggles.hqToCenter || toggles.radii ||
         toggles.spriteDebug;
}

// ── Main render entry ─────────────────────────────────────────────

/** Render all enabled debug overlays. Called after the main render pass. */
export function renderDevOverlays(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
  territory: TerritoryState,
  resourceNodes: readonly ResourceNodeState[],
  spriteDebugData?: SpriteDebugData,
): void {
  if (!isDevPanelAllowed() || !anyOverlayEnabled()) return;

  if (toggles.grid) drawGridOverlay(ctx, map, camera);
  if (toggles.footprints) drawFootprintsOverlay(ctx, map, camera);
  if (toggles.resourceAmounts) drawResourceAmountsOverlay(ctx, map, camera, resourceNodes);
  if (toggles.obstacleBlocking) drawObstacleBlockingOverlay(ctx, map, camera);
  if (toggles.territoryDebug) drawTerritoryDebugOverlay(ctx, territory, camera);
  if (toggles.hqToCenter) drawHqToCenterLine(ctx, map, camera);
  if (toggles.radii) drawRadiiOverlay(ctx, map, camera);
  if (toggles.spriteDebug && spriteDebugData) drawSpriteDebugOverlay(ctx, map, camera, spriteDebugData);
}

// ── 1. Grid overlay ───────────────────────────────────────────────

function drawGridOverlay(ctx: CanvasRenderingContext2D, map: MapData, camera: Camera): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const hw = (TILE_W / 2) * camera.zoom;
  const hh = (TILE_H / 2) * camera.zoom;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;

  // Draw one diamond per terrain tile, using the same tile-center convention
  // as terrain rendering: tileToScreen(tx + 0.5, ty + 0.5)
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const scr = tileToScreen(tx + 0.5, ty + 0.5);
      const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);

      // Only draw if on screen (with margin)
      if (cv.x < -hw * 2 || cv.x > canvasW + hw * 2) continue;
      if (cv.y < -hh * 2 || cv.y > canvasH + hh * 2) continue;

      // Draw diamond outline matching terrain tile geometry
      ctx.beginPath();
      ctx.moveTo(cv.x, cv.y - hh);
      ctx.lineTo(cv.x + hw, cv.y);
      ctx.lineTo(cv.x, cv.y + hh);
      ctx.lineTo(cv.x - hw, cv.y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ── 2. Footprints overlay ─────────────────────────────────────────

function drawFootprintsOverlay(ctx: CanvasRenderingContext2D, map: MapData, camera: Camera): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  ctx.save();

  // HQ footprint — gold
  drawFootprintRect(ctx, map.hq.tx, map.hq.ty, HQ_FOOTPRINT, camera, canvasW, canvasH, 'rgba(212,165,68,0.5)', 'HQ');

  // Buildings — blue
  for (const b of map.buildings) {
    const fp = getBuildingFootprint(b.type);
    drawFootprintRect(ctx, b.tx, b.ty, fp, camera, canvasW, canvasH, 'rgba(66,165,245,0.45)', b.type);
  }

  // Construction sites — yellow dashed
  for (const s of map.constructionSites) {
    const fp = getBuildingFootprint(s.type);
    drawFootprintRect(ctx, s.tx, s.ty, fp, camera, canvasW, canvasH, 'rgba(255,235,59,0.4)', 'build');
  }

  // Resources — green
  for (const r of map.resources) {
    drawFootprintRect(ctx, r.tx, r.ty, r.footprint, camera, canvasW, canvasH, 'rgba(76,175,80,0.35)', r.type);
  }

  // Obstacles — red
  for (const o of map.obstacles) {
    drawFootprintRect(ctx, o.tx, o.ty, o.footprint, camera, canvasW, canvasH, 'rgba(244,67,54,0.35)', o.type);
  }

  // Decor — grey (non-blocking)
  for (const d of map.decor) {
    drawFootprintRect(ctx, d.tx, d.ty, 1, camera, canvasW, canvasH, 'rgba(158,158,158,0.25)', '');
  }

  ctx.restore();
}

function drawFootprintRect(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number, footprint: number,
  camera: Camera, canvasW: number, canvasH: number,
  color: string, label: string,
): void {
  // Draw footprint as a filled isometric diamond covering footprint×footprint tiles.
  // Use the same tile-center convention as terrain rendering so the overlay
  // aligns with visible tile boundaries.
  const fpHalf = footprint / 2;
  const top = camera.toCanvas(tileToScreen(tx + fpHalf, ty).x, tileToScreen(tx + fpHalf, ty).y, canvasW, canvasH);
  const right = camera.toCanvas(tileToScreen(tx + footprint, ty + fpHalf).x, tileToScreen(tx + footprint, ty + fpHalf).y, canvasW, canvasH);
  const bottom = camera.toCanvas(tileToScreen(tx + fpHalf, ty + footprint).x, tileToScreen(tx + fpHalf, ty + footprint).y, canvasW, canvasH);
  const left = camera.toCanvas(tileToScreen(tx, ty + fpHalf).x, tileToScreen(tx, ty + fpHalf).y, canvasW, canvasH);

  // Quick culling: skip if all corners are far off screen
  const allLeft = [top, right, bottom, left].every(c => c.x < -200);
  const allRight = [top, right, bottom, left].every(c => c.x > canvasW + 200);
  const allTop = [top, right, bottom, left].every(c => c.y < -200);
  const allBottom = [top, right, bottom, left].every(c => c.y > canvasH + 200);
  if (allLeft || allRight || allTop || allBottom) return;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();
  ctx.fill();

  // Label at center
  if (label) {
    const centerScr = tileToScreen(tx + fpHalf, ty + fpHalf);
    const cv = camera.toCanvas(centerScr.x, centerScr.y, canvasW, canvasH);
    ctx.font = `${Math.max(9, 10 * camera.zoom)}px monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cv.x, cv.y);
  }
}

// ── 3. Resource amounts overlay ───────────────────────────────────

function drawResourceAmountsOverlay(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
  resourceNodes: readonly ResourceNodeState[],
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  ctx.save();
  const fontSize = Math.max(10, 11 * camera.zoom);
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // Build a lookup from (tx,ty) → ResourceNodeState for remaining values
  const nodeMap = new Map<string, ResourceNodeState>();
  for (const node of resourceNodes) {
    nodeMap.set(`${node.tx},${node.ty}`, node);
  }

  for (const r of map.resources) {
    const centerScr = tileToScreen(r.tx + r.footprint / 2, r.ty + r.footprint / 2);
    const cv = camera.toCanvas(centerScr.x, centerScr.y, canvasW, canvasH);

    // Culling
    if (cv.x < -100 || cv.x > canvasW + 100 || cv.y < -100 || cv.y > canvasH + 100) continue;

    // Get runtime state for remaining amount
    const nodeState = nodeMap.get(`${r.tx},${r.ty}`);
    let text: string;
    if (nodeState) {
      text = nodeState.infinite ? 'inf' : `${Math.round(nodeState.remaining)}`;
    } else {
      text = r.type === 'infinite' ? 'inf' : r.type;
    }

    // Background pill
    const textWidth = ctx.measureText(text).width;
    const padding = 3;
    const bgX = cv.x - textWidth / 2 - padding;
    const bgY = cv.y - fontSize - padding - 2;
    const bgW = textWidth + padding * 2;
    const bgH = fontSize + padding * 2;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(bgX, bgY, bgW, bgH);

    // Text
    ctx.fillStyle = r.type === 'infinite' ? '#ffd600' : '#76ff03';
    ctx.fillText(text, cv.x, cv.y - 2);
  }

  ctx.restore();
}

// ── 4. Obstacle blocking overlay ──────────────────────────────────

function drawObstacleBlockingOverlay(ctx: CanvasRenderingContext2D, map: MapData, camera: Camera): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  ctx.save();

  // Blocking obstacles — red border
  for (const o of map.obstacles) {
    drawFootprintBorder(ctx, o.tx, o.ty, o.footprint, camera, canvasW, canvasH, 'rgba(244,67,54,0.7)', 2);
  }

  // Decor — green (non-blocking)
  for (const d of map.decor) {
    drawFootprintBorder(ctx, d.tx, d.ty, 1, camera, canvasW, canvasH, 'rgba(76,175,80,0.4)', 1);
  }

  ctx.restore();
}

function drawFootprintBorder(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number, footprint: number,
  camera: Camera, canvasW: number, canvasH: number,
  color: string, lineWidth: number,
): void {
  // Use the same tile-center convention as terrain rendering so the border
  // aligns with visible tile boundaries.
  const fpHalf = footprint / 2;
  const top = camera.toCanvas(tileToScreen(tx + fpHalf, ty).x, tileToScreen(tx + fpHalf, ty).y, canvasW, canvasH);
  const right = camera.toCanvas(tileToScreen(tx + footprint, ty + fpHalf).x, tileToScreen(tx + footprint, ty + fpHalf).y, canvasW, canvasH);
  const bottom = camera.toCanvas(tileToScreen(tx + fpHalf, ty + footprint).x, tileToScreen(tx + fpHalf, ty + footprint).y, canvasW, canvasH);
  const left = camera.toCanvas(tileToScreen(tx, ty + fpHalf).x, tileToScreen(tx, ty + fpHalf).y, canvasW, canvasH);

  const allLeft = [top, right, bottom, left].every(c => c.x < -200);
  const allRight = [top, right, bottom, left].every(c => c.x > canvasW + 200);
  const allTop = [top, right, bottom, left].every(c => c.y < -200);
  const allBottom = [top, right, bottom, left].every(c => c.y > canvasH + 200);
  if (allLeft || allRight || allTop || allBottom) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();
  ctx.stroke();
}

// ── 5. Territory debug overlay ────────────────────────────────────

function drawTerritoryDebugOverlay(ctx: CanvasRenderingContext2D, territory: TerritoryState, camera: Camera): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const hw = (TILE_W / 2) * camera.zoom;
  const hh = (TILE_H / 2) * camera.zoom;

  ctx.save();

  // Show claimed tiles with debug info
  for (let ty = 0; ty < territory.height; ty++) {
    for (let tx = 0; tx < territory.width; tx++) {
      const tile = territory.tiles[ty * territory.width + tx]!;
      if (tile.progress <= 0) continue;

      const scr = tileToScreen(tx + 0.5, ty + 0.5);
      const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);

      if (cv.x < -hw * 2 || cv.x > canvasW + hw * 2) continue;
      if (cv.y < -hh * 2 || cv.y > canvasH + hh * 2) continue;

      // Progress text
      if (camera.zoom >= 0.8) {
        const fontSize = Math.max(7, 8 * camera.zoom);
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tile.progress < 1 ? tile.progress.toFixed(1) : '1', cv.x, cv.y);
      }
    }
  }

  // Draw source centers
  for (const source of territory.sources) {
    const scr = tileToScreen(source.cx + 0.5, source.cy + 0.5);
    const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);

    // Yellow circle for source center
    ctx.beginPath();
    ctx.arc(cv.x, cv.y, Math.max(4, 5 * camera.zoom), 0, Math.PI * 2);
    ctx.fillStyle = source.footprintClaimed ? 'rgba(255,235,59,0.9)' : 'rgba(255,152,0,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

// ── 6. HQ-to-center line ─────────────────────────────────────────

function drawHqToCenterLine(ctx: CanvasRenderingContext2D, map: MapData, camera: Camera): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  const hqCenter = tileToScreen(map.hq.tx + HQ_FOOTPRINT / 2, map.hq.ty + HQ_FOOTPRINT / 2);
  const mapCenter = tileToScreen(map.width / 2, map.height / 2);

  const cvHq = camera.toCanvas(hqCenter.x, hqCenter.y, canvasW, canvasH);
  const cvCenter = camera.toCanvas(mapCenter.x, mapCenter.y, canvasW, canvasH);

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,0,0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(cvHq.x, cvHq.y);
  ctx.lineTo(cvCenter.x, cvCenter.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // HQ dot
  ctx.beginPath();
  ctx.arc(cvHq.x, cvHq.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#d4a544';
  ctx.fill();

  // Center dot
  ctx.beginPath();
  ctx.arc(cvCenter.x, cvCenter.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd600';
  ctx.fill();

  // Labels
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'center';
  ctx.fillText('HQ', cvHq.x, cvHq.y - 10);
  ctx.fillText('Center', cvCenter.x, cvCenter.y - 10);

  ctx.restore();
}

// ── 7. Start/core/economy radii overlay ───────────────────────────

function drawRadiiOverlay(ctx: CanvasRenderingContext2D, map: MapData, camera: Camera): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  // HQ center
  const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
  const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;

  // Draw Chebyshev radius rings from HQ center
  // In isometric, a Chebyshev radius R from (cx,cy) is a square from (cx-R, cy-R) to (cx+R, cy+R)
  const radii = [
    { radius: START_CORE_RADIUS, color: 'rgba(76,175,80,0.4)', label: `Core r=${START_CORE_RADIUS}` },
    { radius: START_ECONOMY_RADIUS, color: 'rgba(33,150,243,0.35)', label: `Econ r=${START_ECONOMY_RADIUS}` },
    { radius: START_TRANSITION_RADIUS, color: 'rgba(255,152,0,0.3)', label: `Trans r=${START_TRANSITION_RADIUS}` },
  ];

  ctx.save();

  for (const { radius, color, label } of radii) {
    // Four corners of the Chebyshev square
    const minTx = hqCx - radius;
    const minTy = hqCy - radius;
    const maxTx = hqCx + radius;
    const maxTy = hqCy + radius;

    // Isometric diamond corners
    const top = tileToScreen(hqCx, minTy);
    const right = tileToScreen(maxTx, hqCy);
    const bottom = tileToScreen(hqCx, maxTy);
    const left = tileToScreen(minTx, hqCy);

    const cvTop = camera.toCanvas(top.x, top.y, canvasW, canvasH);
    const cvRight = camera.toCanvas(right.x, right.y, canvasW, canvasH);
    const cvBottom = camera.toCanvas(bottom.x, bottom.y, canvasW, canvasH);
    const cvLeft = camera.toCanvas(left.x, left.y, canvasW, canvasH);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cvTop.x, cvTop.y);
    ctx.lineTo(cvRight.x, cvRight.y);
    ctx.lineTo(cvBottom.x, cvBottom.y);
    ctx.lineTo(cvLeft.x, cvLeft.y);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.8)');
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label at top
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(label, cvTop.x, cvTop.y - 6);
  }

  ctx.restore();
}

// ── 8. Sprite debug overlay (VISUAL-QA-ARCH-01 PR1) ────────────────

/** Data needed for the sprite debug overlay, passed from the renderer. */
export interface SpriteDebugData {
  /** Harvesters with their current and previous tile positions. */
  harvesters: ReadonlyArray<{
    state: HarvesterState;
    prevTx: number;
    prevTy: number;
  }>;
  /** AssetStore for looking up real sprite naturalWidth/naturalHeight. */
  assets: AssetStore;
  /** Current faction — needed to resolve HQ and building asset keys. */
  faction: FactionId;
}

/**
 * Compute the destination rect for a spritesheet-rendered entity (builder/harvester).
 * Mirrors drawSpritesheetFrame math: containFit(FRAME_SIZE, FRAME_SIZE, ...) centered at (cx, cy)
 * with groundOffset applied.
 */
function computeSpritesheetDestRect(
  cx: number,
  cy: number,
  zoom: number,
  profile: SpriteProfile,
): { x: number; y: number; w: number; h: number } {
  const maxW = profile.size[0] * zoom;
  const maxH = profile.size[1] * zoom;
  const offY = profile.groundOffset * zoom;
  // Spritesheet frames are 256x256 (square), so containFit yields a square
  // inside the profile.size bounding box.
  const canvasAspect = 1; // FRAME_SIZE / FRAME_SIZE = 1
  const boxAspect = maxW / maxH;
  let w: number, h: number;
  if (canvasAspect > boxAspect) {
    w = maxW;
    h = maxW / canvasAspect;
  } else {
    h = maxH;
    w = maxH * canvasAspect;
  }
  return {
    x: cx - w / 2,
    y: cy - h / 2 - offY,
    w,
    h,
  };
}

/**
 * Compute the destination rect for a building sprite rendered via drawBuildingSprite.
 * Mirrors getFullCanvasDestinationRect: containFit(naturalW, naturalH, ...)
 * centered at cx with baseY as the south vertex of the footprint diamond.
 */
function computeBuildingDestRect(
  cx: number,
  cy: number,
  zoom: number,
  profileKey: string,
  footprint: number,
  naturalW: number,
  naturalH: number,
): { x: number; y: number; w: number; h: number } {
  const profile = SPRITE_PROFILES[profileKey as keyof typeof SPRITE_PROFILES];
  if (!profile) return { x: cx, y: cy, w: 0, h: 0 };

  const baseY = cy + (TILE_H / 2) * footprint * zoom;
  const maxW = profile.size[0] * zoom;
  const maxH = profile.size[1] * zoom;
  const offY = profile.groundOffset * zoom;
  const screenOffsetX = (profile as SpriteProfile).screenOffsetX ?? 0;
  const screenOffsetY = (profile as SpriteProfile).screenOffsetY ?? 0;

  const canvasAspect = naturalW / naturalH;
  const boxAspect = maxW / maxH;
  let w: number, h: number;
  if (canvasAspect > boxAspect) {
    w = maxW;
    h = maxW / canvasAspect;
  } else {
    h = maxH;
    w = maxH * canvasAspect;
  }
  return {
    x: cx - w / 2 + screenOffsetX,
    y: baseY - h - offY + screenOffsetY,
    w,
    h,
  };
}

/**
 * Compute the destination rect for an environment entity rendered via containFit
 * centered at (cx, cy) with groundOffset.
 */
function computeEnvDestRect(
  cx: number,
  cy: number,
  zoom: number,
  profile: SpriteProfile,
  naturalW: number,
  naturalH: number,
): { x: number; y: number; w: number; h: number } {
  const maxW = profile.size[0] * zoom;
  const maxH = profile.size[1] * zoom;
  const offY = profile.groundOffset * zoom;
  const canvasAspect = naturalW / naturalH;
  const boxAspect = maxW / maxH;
  let w: number, h: number;
  if (canvasAspect > boxAspect) {
    w = maxW;
    h = maxW / canvasAspect;
  } else {
    h = maxH;
    w = maxH * canvasAspect;
  }
  return {
    x: cx - w / 2,
    y: cy - h / 2 - offY,
    w,
    h,
  };
}

/** Draw a single sprite debug annotation (footprint + bbox + anchor + label). */
function drawSpriteAnnotation(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  footprint: number,
  destRect: { x: number; y: number; w: number; h: number },
  label: string,
  profileLabel: string,
  spriteMissing?: boolean,
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  // Culling: skip if way off screen
  const margin = 300;
  if (cx < -margin || cx > canvasW + margin || cy < -margin || cy > canvasH + margin) return;

  // Footprint diamond — magenta/pink
  const hw = (TILE_W / 2) * footprint * zoom;
  const hh = (TILE_H / 2) * footprint * zoom;
  ctx.strokeStyle = 'rgba(255, 0, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.stroke();

  // Sprite bbox — yellow rectangle (only if sprite is present and has dimensions)
  if (spriteMissing) {
    // Draw a small "X" marker to indicate missing sprite
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
    ctx.lineWidth = 1.5;
    const xSize = Math.max(4, 6 * zoom);
    ctx.beginPath();
    ctx.moveTo(cx - xSize, cy - xSize - 10 * zoom);
    ctx.lineTo(cx + xSize, cy + xSize - 10 * zoom);
    ctx.moveTo(cx + xSize, cy - xSize - 10 * zoom);
    ctx.lineTo(cx - xSize, cy + xSize - 10 * zoom);
    ctx.stroke();
  } else if (destRect.w > 0 && destRect.h > 0) {
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(destRect.x, destRect.y, destRect.w, destRect.h);
  }

  // Anchor / ground point — red dot
  ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(3, 3 * zoom), 0, Math.PI * 2);
  ctx.fill();

  // Label — small white/yellow text
  const fontSize = Math.max(8, 9 * zoom);
  ctx.font = `${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
  const labelY = (destRect.w > 0 && destRect.h > 0) ? destRect.y - 2 : cy - 10 * zoom;
  ctx.fillText(label, cx, labelY);
  ctx.fillStyle = spriteMissing ? 'rgba(255, 80, 80, 0.9)' : 'rgba(255, 200, 255, 0.85)';
  ctx.fillText(profileLabel, cx, labelY - fontSize - 1);
}

function drawSpriteDebugOverlay(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
  data: SpriteDebugData,
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const z = camera.zoom;
  const { assets, faction } = data;

  ctx.save();

  // ── HQ ─────────────────────────────────────────────────────────
  {
    const centerTx = map.hq.tx + HQ_FOOTPRINT / 2;
    const centerTy = map.hq.ty + HQ_FOOTPRINT / 2;
    const scr = tileToScreen(centerTx, centerTy);
    const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
    const profileKey = 'hq_base';
    const profile = SPRITE_PROFILES[profileKey];
    const assetKey = HQ_ASSET_KEYS[map.hq.faction];
    const sprite = assets.get(assetKey);
    if (sprite) {
      const destRect = computeBuildingDestRect(cv.x, cv.y, z, profileKey, HQ_FOOTPRINT, sprite.naturalWidth, sprite.naturalHeight);
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, HQ_FOOTPRINT, destRect, 'HQ', `${profileKey} [${profile.size}] off=${profile.groundOffset} nat=${sprite.naturalWidth}x${sprite.naturalHeight}`);
    } else {
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, HQ_FOOTPRINT, { x: cv.x, y: cv.y, w: 0, h: 0 }, 'HQ', `${profileKey} [${profile.size}] NO SPRITE`, true);
    }
  }

  // ── Completed buildings ────────────────────────────────────────
  for (const b of map.buildings) {
    const footprint = getBuildingFootprint(b.type);
    const centerTx = b.tx + footprint / 2;
    const centerTy = b.ty + footprint / 2;
    const scr = tileToScreen(centerTx, centerTy);
    const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
    const profileKey = BUILDING_PROFILE_KEYS[b.type];
    const profile = SPRITE_PROFILES[profileKey];
    const assetKey = BUILDING_ASSET_KEYS[b.type]?.[faction];
    const sprite = assetKey ? assets.get(assetKey) : null;
    if (profile && sprite) {
      const destRect = computeBuildingDestRect(cv.x, cv.y, z, profileKey, footprint, sprite.naturalWidth, sprite.naturalHeight);
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, footprint, destRect, b.type, `${profileKey} [${profile.size}] off=${profile.groundOffset} nat=${sprite.naturalWidth}x${sprite.naturalHeight}`);
    } else if (profile) {
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, footprint, { x: cv.x, y: cv.y, w: 0, h: 0 }, b.type, `${profileKey} [${profile.size}] NO SPRITE`, true);
    } else {
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, footprint, { x: cv.x, y: cv.y, w: 0, h: 0 }, b.type, '(no profile)', true);
    }
  }

  // ── Builder ────────────────────────────────────────────────────
  for (const builder of map.builders) {
    const scr = tileToScreen(builder.tx + 0.5, builder.ty + 0.5);
    const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
    const profile = SPRITE_PROFILES.builder_base;
    const destRect = computeSpritesheetDestRect(cv.x, cv.y, z, profile);
    drawSpriteAnnotation(ctx, cv.x, cv.y, z, 1, destRect, `builder (${builder.tx},${builder.ty})`, `builder_base [${profile.size}] off=${profile.groundOffset} frame=256x256`);
  }

  // ── Harvester ──────────────────────────────────────────────────
  for (const { state: harvester, prevTx, prevTy } of data.harvesters) {
    const scr = tileToScreen(harvester.tx, harvester.ty);
    const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
    const profile = SPRITE_PROFILES.harvester_base;
    const destRect = computeSpritesheetDestRect(cv.x, cv.y, z, profile);
    const dirLabel = (harvester.tx !== prevTx || harvester.ty !== prevTy) ? ` dir=(${(harvester.tx - prevTx).toFixed(1)},${(harvester.ty - prevTy).toFixed(1)})` : '';
    drawSpriteAnnotation(ctx, cv.x, cv.y, z, 1, destRect, `harvester (${harvester.tx.toFixed(1)},${harvester.ty.toFixed(1)})${dirLabel}`, `harvester_base [${profile.size}] off=${profile.groundOffset} frame=256x256`);
  }

  // ── Resources ──────────────────────────────────────────────────
  for (const r of map.resources) {
    const halfFp = r.footprint / 2;
    const scr = tileToScreen(r.tx + halfFp, r.ty + halfFp);
    const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
    const assetKey = RESOURCE_ASSET_KEYS[r.type];
    const profile = SPRITE_PROFILES[assetKey as keyof typeof SPRITE_PROFILES];
    const sprite = assets.get(assetKey);
    if (profile && sprite) {
      const destRect = computeEnvDestRect(cv.x, cv.y, z, profile, sprite.naturalWidth, sprite.naturalHeight);
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, r.footprint, destRect, r.type, `${assetKey} [${profile.size}] off=${profile.groundOffset} nat=${sprite.naturalWidth}x${sprite.naturalHeight}`);
    } else if (profile) {
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, r.footprint, { x: cv.x, y: cv.y, w: 0, h: 0 }, r.type, `${assetKey} [${profile.size}] NO SPRITE`, true);
    } else {
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, r.footprint, { x: cv.x, y: cv.y, w: 0, h: 0 }, r.type, '(no profile)', true);
    }
  }

  // ── Obstacles ──────────────────────────────────────────────────
  for (const o of map.obstacles) {
    const halfFp = o.footprint / 2;
    const scr = tileToScreen(o.tx + halfFp, o.ty + halfFp);
    const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
    const assetKey = OBSTACLE_ASSET_KEYS[o.type];
    const profile = SPRITE_PROFILES[assetKey as keyof typeof SPRITE_PROFILES];
    const sprite = assets.get(assetKey);
    if (profile && sprite) {
      const destRect = computeEnvDestRect(cv.x, cv.y, z, profile, sprite.naturalWidth, sprite.naturalHeight);
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, o.footprint, destRect, o.type, `${assetKey} [${profile.size}] off=${profile.groundOffset} nat=${sprite.naturalWidth}x${sprite.naturalHeight}`);
    } else if (profile) {
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, o.footprint, { x: cv.x, y: cv.y, w: 0, h: 0 }, o.type, `${assetKey} [${profile.size}] NO SPRITE`, true);
    } else {
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, o.footprint, { x: cv.x, y: cv.y, w: 0, h: 0 }, o.type, '(no profile)', true);
    }
  }

  // ── Decor ──────────────────────────────────────────────────────
  for (const d of map.decor) {
    const scr = tileToScreen(d.tx + 0.5, d.ty + 0.5);
    const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
    const assetKey = DECOR_ASSET_KEYS[d.type];
    const profile = SPRITE_PROFILES[assetKey as keyof typeof SPRITE_PROFILES];
    const sprite = assets.get(assetKey);
    if (profile && sprite) {
      const destRect = computeEnvDestRect(cv.x, cv.y, z, profile, sprite.naturalWidth, sprite.naturalHeight);
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, 1, destRect, d.type, `${assetKey} [${profile.size}] off=${profile.groundOffset} nat=${sprite.naturalWidth}x${sprite.naturalHeight}`);
    } else if (profile) {
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, 1, { x: cv.x, y: cv.y, w: 0, h: 0 }, d.type, `${assetKey} [${profile.size}] NO SPRITE`, true);
    } else {
      drawSpriteAnnotation(ctx, cv.x, cv.y, z, 1, { x: cv.x, y: cv.y, w: 0, h: 0 }, d.type, '(no profile)', true);
    }
  }

  ctx.restore();
}
