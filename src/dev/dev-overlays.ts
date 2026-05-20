/**
 * DEV-SANDBOX-ARCH-01 PR2 — Debug canvas overlays.
 *
 * Render-only debug overlays for QA. Controlled from the dev panel.
 * All overlays are OFF by default and have near-zero overhead when disabled.
 *
 * Availability: same guard as dev panel (DEV / test / ?devtools=1).
 * No gameplay state mutation from overlays. Additive rendering only.
 */

import { TILE_W, TILE_H, HQ_FOOTPRINT, START_CORE_RADIUS, START_ECONOMY_RADIUS, START_TRANSITION_RADIUS } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { Camera } from '../render/camera.js';
import type { MapData } from '../game/map-types.js';
import type { TerritoryState } from '../systems/territory.js';
import type { ResourceNodeState } from '../systems/harvesting.js';
import { getBuildingFootprint } from '../config/buildings.js';
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
}

const toggles: OverlayToggles = {
  grid: false,
  footprints: false,
  resourceAmounts: false,
  obstacleBlocking: false,
  territoryDebug: false,
  hqToCenter: false,
  radii: false,
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
         toggles.obstacleBlocking || toggles.territoryDebug || toggles.hqToCenter || toggles.radii;
}

// ── Main render entry ─────────────────────────────────────────────

/** Render all enabled debug overlays. Called after the main render pass. */
export function renderDevOverlays(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
  territory: TerritoryState,
  resourceNodes: readonly ResourceNodeState[],
): void {
  if (!isDevPanelAllowed() || !anyOverlayEnabled()) return;

  if (toggles.grid) drawGridOverlay(ctx, map, camera);
  if (toggles.footprints) drawFootprintsOverlay(ctx, map, camera);
  if (toggles.resourceAmounts) drawResourceAmountsOverlay(ctx, map, camera, resourceNodes);
  if (toggles.obstacleBlocking) drawObstacleBlockingOverlay(ctx, map, camera);
  if (toggles.territoryDebug) drawTerritoryDebugOverlay(ctx, territory, camera);
  if (toggles.hqToCenter) drawHqToCenterLine(ctx, map, camera);
  if (toggles.radii) drawRadiiOverlay(ctx, map, camera);
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
