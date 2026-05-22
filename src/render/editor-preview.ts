/**
 * MAP-EDITOR-ARCH-01 PR1+PR2+PR3 — Thin editor preview renderer.
 *
 * Renders a map preview for the editor screen: terrain, HQ, resources,
 * obstacles, decor, and an always-on grid overlay. No economy, power,
 * harvesters, territory, construction sites, or unit rendering.
 *
 * PR2 adds: hover tile highlight, valid/invalid footprint preview,
 * erase-target highlight.
 *
 * PR3 adds: HQ/start marker border, start economy radius circle.
 *
 * This is a standalone renderer to avoid coupling the editor to the full
 * render() signature which requires economy/power/harvesters/territory.
 */

import { BG_COLOR, HQ_FOOTPRINT, TILE_W, TILE_H, START_ECONOMY_RADIUS } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { AssetStore } from '../core/assets.js';
import type { MapData } from '../game/map-types.js';
import type { Camera } from './camera.js';
import { renderHq } from './buildings.js';
import { renderResourceNode, renderObstacle, renderDecor } from './environment.js';
import { renderTerrain } from './terrain.js';
import type { ResourceNodeState } from '../systems/harvesting.js';
import type { EditorTool, PaletteGroup } from '../game/editor-state.js';

// ── Hover state for PR2 ──────────────────────────────────────────────

export interface EditorHoverState {
  tx: number;
  ty: number;
  tool: EditorTool;
  /** Selected palette item group. */
  paletteGroup?: PaletteGroup;
  /** Selected palette item footprint. */
  paletteFootprint?: number;
  /** Whether the current hover position is valid for placement. */
  isValid?: boolean;
  /** Entity footprint to highlight in erase mode. */
  eraseFootprint?: number;
  eraseTx?: number;
  eraseTy?: number;
}

// ── Shadow profiles (subset of main renderer — editor only shows env + HQ) ──

type EditorShadowKind = 'hq' | 'resource' | 'obstacle' | 'decor';

interface ShadowProfile {
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly yOffsetTiles: number;
  readonly xOffsetTiles: number;
  readonly alpha: number;
}

const SHADOW_PROFILES: Record<EditorShadowKind, ShadowProfile> = {
  hq: { widthTiles: 0.58, heightTiles: 0.3, xOffsetTiles: -0.08, yOffsetTiles: -0.05, alpha: 0.09 },
  resource: { widthTiles: 0.38, heightTiles: 0.18, xOffsetTiles: -0.04, yOffsetTiles: -0.025, alpha: 0.09 },
  obstacle: { widthTiles: 0.46, heightTiles: 0.22, xOffsetTiles: -0.06, yOffsetTiles: -0.035, alpha: 0.09 },
  decor: { widthTiles: 0.18, heightTiles: 0.08, xOffsetTiles: -0.02, yOffsetTiles: -0.015, alpha: 0.04 },
};

function renderGroundShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  footprint: number,
  kind: EditorShadowKind,
): void {
  const profile = SHADOW_PROFILES[kind];
  const radiusX = (TILE_W / 2) * profile.widthTiles * footprint * zoom;
  const radiusY = (TILE_H / 2) * profile.heightTiles * footprint * zoom;
  const x = cx + (TILE_W / 2) * profile.xOffsetTiles * footprint * zoom;
  const y = cy + (TILE_H / 2) * profile.yOffsetTiles * footprint * zoom;

  ctx.save();
  ctx.fillStyle = `rgba(18, 16, 14, ${profile.alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderTileShadow(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  tx: number,
  ty: number,
  footprint: number,
  kind: EditorShadowKind,
): void {
  const scr = tileToScreen(tx + footprint / 2, ty + footprint / 2);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  renderGroundShadow(ctx, cv.x, cv.y, camera.zoom, footprint, kind);
}

// ── Grid overlay ─────────────────────────────────────────────────────

function drawGridOverlay(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const hw = (TILE_W / 2) * camera.zoom;
  const hh = (TILE_H / 2) * camera.zoom;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const scr = tileToScreen(tx + 0.5, ty + 0.5);
      const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);

      if (cv.x < -hw * 2 || cv.x > canvasW + hw * 2) continue;
      if (cv.y < -hh * 2 || cv.y > canvasH + hh * 2) continue;

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

// ── PR3: HQ / start marker overlay ──────────────────────────────────

/** Draw a highlighted border around the HQ footprint to mark the start position. */
function drawHqMarkerOverlay(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const hw = (TILE_W / 2) * camera.zoom;
  const hh = (TILE_H / 2) * camera.zoom;

  ctx.save();
  ctx.strokeStyle = 'rgba(0,229,255,0.45)';
  ctx.lineWidth = 2;

  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      const tx = map.hq.tx + dx;
      const ty = map.hq.ty + dy;
      const scr = tileToScreen(tx + 0.5, ty + 0.5);
      const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);

      if (cv.x < -hw * 2 || cv.x > canvasW + hw * 2) continue;
      if (cv.y < -hh * 2 || cv.y > canvasH + hh * 2) continue;

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

// ── PR3: Start economy radius circle ─────────────────────────────────

/**
 * Draw a faint elliptical ring showing the start economy radius around HQ.
 * In isometric projection, a circle in tile space becomes an ellipse on screen.
 */
function drawEconomyRadiusOverlay(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  // HQ center in tile coordinates
  const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
  const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;

  // Sample points on a circle of radius START_ECONOMY_RADIUS in tile space,
  // then draw them as a polygon in screen space
  const numPoints = 64;
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const tx = hqCx + START_ECONOMY_RADIUS * Math.cos(angle);
    const ty = hqCy + START_ECONOMY_RADIUS * Math.sin(angle);
    const scr = tileToScreen(tx, ty);
    const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
    points.push(cv);
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(33,150,243,0.28)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Hover / footprint preview ────────────────────────────────────────

function drawHoverOverlay(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
  hover: EditorHoverState,
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const hw = (TILE_W / 2) * camera.zoom;
  const hh = (TILE_H / 2) * camera.zoom;

  ctx.save();

  if (hover.tool === 'select') {
    // Simple white outline on hovered tile
    const scr = tileToScreen(hover.tx + 0.5, hover.ty + 0.5);
    const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
    drawDiamondOutline(ctx, cv.x, cv.y, hw, hh, 'rgba(255,255,255,0.6)', 2);
  } else if (hover.tool === 'place') {
    // Footprint preview: green if valid, red if invalid
    const footprint = hover.paletteFootprint ?? 1;
    const isValid = hover.isValid ?? false;
    const fillColor = isValid ? 'rgba(100,255,100,0.2)' : 'rgba(255,80,80,0.2)';
    const strokeColor = isValid ? 'rgba(100,255,100,0.7)' : 'rgba(255,80,80,0.7)';

    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        const ttx = hover.tx + dx;
        const tty = hover.ty + dy;
        if (ttx < 0 || ttx >= map.width || tty < 0 || tty >= map.height) continue;
        const scr = tileToScreen(ttx + 0.5, tty + 0.5);
        const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
        drawDiamondFill(ctx, cv.x, cv.y, hw, hh, fillColor);
        drawDiamondOutline(ctx, cv.x, cv.y, hw, hh, strokeColor, 2);
      }
    }
  } else if (hover.tool === 'erase') {
    // Highlight entity to be erased
    const eTx = hover.eraseTx ?? hover.tx;
    const eTy = hover.eraseTy ?? hover.ty;
    const eFp = hover.eraseFootprint ?? 1;

    for (let dy = 0; dy < eFp; dy++) {
      for (let dx = 0; dx < eFp; dx++) {
        const ttx = eTx + dx;
        const tty = eTy + dy;
        if (ttx < 0 || ttx >= map.width || tty < 0 || tty >= map.height) continue;
        const scr = tileToScreen(ttx + 0.5, tty + 0.5);
        const cv = camera.toCanvas(scr.x, scr.y, canvasW, canvasH);
        drawDiamondFill(ctx, cv.x, cv.y, hw, hh, 'rgba(255,60,60,0.25)');
        drawDiamondOutline(ctx, cv.x, cv.y, hw, hh, 'rgba(255,60,60,0.8)', 2);
      }
    }
  }

  ctx.restore();
}

function drawDiamondOutline(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  hw: number, hh: number,
  color: string,
  lineWidth: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawDiamondFill(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  hw: number, hh: number,
  color: string,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ── Sorted entity rendering ──────────────────────────────────────────

interface SortedEntity {
  sortKey: number;
  shadow?: () => void;
  render: () => void;
}

function getFootprintSortKey(tx: number, ty: number, footprint: number): number {
  return tx + ty + (footprint - 1) * 2;
}

// ── Main editor preview render ───────────────────────────────────────

export function editorPreviewRender(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
  assets: AssetStore,
  resourceNodes?: readonly ResourceNodeState[],
  hover?: EditorHoverState,
): void {
  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvasW, canvasH);

  renderTerrain(ctx, map, camera, assets);

  // Build sorted entity list — same pattern as main renderer but editor-only subset
  const entities: SortedEntity[] = [];

  // HQ
  entities.push({
    sortKey: getFootprintSortKey(map.hq.tx, map.hq.ty, HQ_FOOTPRINT),
    shadow: () => renderTileShadow(ctx, camera, map.hq.tx, map.hq.ty, HQ_FOOTPRINT, 'hq'),
    render: () => renderHq(ctx, map.hq, camera, assets),
  });

  // Resources
  for (let i = 0; i < map.resources.length; i++) {
    const r = map.resources[i]!;
    // Skip depleted finite resources (same logic as main renderer)
    if (resourceNodes) {
      const node = resourceNodes[i];
      if (node && !node.infinite && node.remaining <= 0) continue;
    }
    entities.push({
      sortKey: r.tx + r.ty + (r.footprint - 1) * 2,
      shadow: () => renderTileShadow(ctx, camera, r.tx, r.ty, r.footprint, 'resource'),
      render: () => renderResourceNode(ctx, r, camera, assets),
    });
  }

  // Obstacles
  for (const o of map.obstacles) {
    entities.push({
      sortKey: o.tx + o.ty + (o.footprint - 1) * 2,
      shadow: () => renderTileShadow(ctx, camera, o.tx, o.ty, o.footprint, 'obstacle'),
      render: () => renderObstacle(ctx, o, camera, assets),
    });
  }

  // Decor
  for (const d of map.decor) {
    entities.push({
      sortKey: d.tx + d.ty,
      shadow: () => renderTileShadow(ctx, camera, d.tx, d.ty, 1, 'decor'),
      render: () => renderDecor(ctx, d, camera, assets),
    });
  }

  entities.sort((a, b) => a.sortKey - b.sortKey);

  // Shadows pass
  for (const e of entities) {
    e.shadow?.();
  }

  // Entities pass
  for (const e of entities) {
    e.render();
  }

  // Grid overlay — always on in editor
  drawGridOverlay(ctx, map, camera);

  // PR3: HQ start marker — drawn after grid, before hover
  drawHqMarkerOverlay(ctx, map, camera);

  // PR3: Start economy radius — faint dashed ring
  drawEconomyRadiusOverlay(ctx, map, camera);

  // Hover / footprint preview — drawn on top of everything
  if (hover) {
    drawHoverOverlay(ctx, map, camera, hover);
  }
}
