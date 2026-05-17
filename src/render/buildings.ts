/** Building rendering: faction HQ, civil buildings, builder, and construction sites. */

import { getBuildingFootprint } from '../config/buildings.js';
import { TILE_W, TILE_H, SPRITE_PROFILES, HQ_FOOTPRINT, HQ_COLOR, GRID_COLOR, FE_CIVIL_8X8_256_SHEETS_ENABLED } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { AssetStore } from '../core/assets.js';
import type { BuilderPlacement, ConstructionSitePlacement, HqPlacement, FactionId } from '../game/map-types.js';
import type { HarvesterState } from '../systems/harvesting.js';
import type { Camera } from './camera.js';
import { drawSpritesheetFrame, directionToRow, builderAnimColumn, harvesterAnimColumn } from './spritesheet.js';

const HQ_ASSET_KEYS: Record<FactionId, string> = {
  cyan: 'hq_cyan',
  green: 'hq_green',
  yellow: 'hq_yellow',
  purple: 'hq_purple',
};

const BUILDER_ASSET_KEYS: Record<FactionId, string> = {
  cyan: 'builder_cyan',
  green: 'builder_green',
  yellow: 'builder_yellow',
  purple: 'builder_purple',
};

const HARVESTER_ASSET_KEYS: Record<FactionId, string> = {
  cyan: 'harvester_cyan',
  green: 'harvester_green',
  yellow: 'harvester_yellow',
  purple: 'harvester_purple',
};

function dimColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

function getFootprintCenter(tx: number, ty: number, footprint: number): { tx: number; ty: number } {
  return {
    tx: tx + footprint / 2,
    ty: ty + footprint / 2,
  };
}

function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  rightFace: string,
  leftFace: string,
  topFace: string,
  boxHeight: number,
  label: string,
  online: boolean,
  footprint: number = 1,
): void {
  const hw = (TILE_W / 2) * footprint * zoom;
  const hh = (TILE_H / 2) * footprint * zoom;
  const dim = online ? 1 : 0.45;

  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - boxHeight);
  ctx.lineTo(cx + hw, cy - boxHeight);
  ctx.closePath();
  ctx.fillStyle = dimColor(rightFace, dim);
  ctx.fill();
  ctx.strokeStyle = dimColor('#000000', dim);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - boxHeight);
  ctx.lineTo(cx - hw, cy - boxHeight);
  ctx.closePath();
  ctx.fillStyle = dimColor(leftFace, dim);
  ctx.fill();
  ctx.strokeStyle = dimColor('#000000', dim);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - boxHeight - hh);
  ctx.lineTo(cx + hw, cy - boxHeight);
  ctx.lineTo(cx, cy - boxHeight + hh);
  ctx.lineTo(cx - hw, cy - boxHeight);
  ctx.closePath();
  ctx.fillStyle = dimColor(topFace, dim);
  ctx.fill();
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = online ? '#1a1a1a' : '#555';
  ctx.font = `${7 * zoom}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy - boxHeight);
}

export function renderHq(
  ctx: CanvasRenderingContext2D,
  hq: HqPlacement,
  camera: Camera,
  assets: AssetStore,
): void {
  const centerTx = hq.tx + HQ_FOOTPRINT / 2;
  const centerTy = hq.ty + HQ_FOOTPRINT / 2;
  const scr = tileToScreen(centerTx, centerTy);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const assetKey = HQ_ASSET_KEYS[hq.faction];
  const sprite = assets.get(assetKey);
  const profile = SPRITE_PROFILES.hq_base;

  if (sprite) {
    const w = profile.size[0] * z;
    const h = profile.size[1] * z;
    const offY = profile.groundOffset * z;
    ctx.drawImage(sprite, cv.x - w / 2, cv.y - h / 2 - offY, w, h);
  } else {
    renderHqFallback(ctx, cv.x, cv.y, z);
  }
}

function renderHqFallback(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  z: number,
): void {
  const s = HQ_FOOTPRINT;
  const hw = (TILE_W / 2) * s * z;
  const hh = (TILE_H / 2) * s * z;
  const boxHeight = 18 * z;

  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - boxHeight);
  ctx.lineTo(cx + hw, cy - boxHeight);
  ctx.closePath();
  ctx.fillStyle = '#a07830';
  ctx.fill();
  ctx.strokeStyle = '#6b4e1a';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx, cy + hh - boxHeight);
  ctx.lineTo(cx - hw, cy - boxHeight);
  ctx.closePath();
  ctx.fillStyle = '#8b6820';
  ctx.fill();
  ctx.strokeStyle = '#5a4015';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, cy - boxHeight - hh);
  ctx.lineTo(cx + hw, cy - boxHeight);
  ctx.lineTo(cx, cy - boxHeight + hh);
  ctx.lineTo(cx - hw, cy - boxHeight);
  ctx.closePath();
  ctx.fillStyle = HQ_COLOR;
  ctx.fill();
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#3a2400';
  ctx.font = `${10 * z}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HQ', cx, cy - boxHeight);
}

export function renderSeparator(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  camera: Camera,
  active: boolean,
  progress: number,
  online: boolean,
): void {
  const footprint = getBuildingFootprint('separator');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 12 * z;

  drawIsoBox(
    ctx,
    cv.x,
    cv.y,
    z,
    '#3a6b8c',
    '#2c5570',
    active ? '#4a9ac2' : '#3a7a9a',
    boxHeight,
    'SEP',
    online,
    footprint,
  );

  if (online && progress > 0) {
    const barW = 28 * z;
    const barH = 4 * z;
    const barX = cv.x - barW / 2;
    const barY = cv.y - boxHeight - ((TILE_H / 2) * footprint * z) - 8 * z;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = active ? '#5ee89a' : '#888';
    ctx.fillRect(barX, barY, barW * Math.min(progress, 1), barH);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  if (!online) {
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OFF', cv.x, cv.y - boxHeight - 10 * z);
  }
}

export function renderStorage(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  camera: Camera,
  online: boolean,
): void {
  const footprint = getBuildingFootprint('storage');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 10 * z;

  drawIsoBox(ctx, cv.x, cv.y, z, '#6b5a3a', '#554828', '#8b7a50', boxHeight, 'STO', online, footprint);

  if (!online) {
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OFF', cv.x, cv.y - boxHeight - 10 * z);
  }
}

export function renderPowerPlant(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  camera: Camera,
  online: boolean,
): void {
  const footprint = getBuildingFootprint('power-plant');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 14 * z;

  drawIsoBox(
    ctx,
    cv.x,
    cv.y,
    z,
    '#5a8c3a',
    '#487028',
    online ? '#7ac24a' : '#5a9a3a',
    boxHeight,
    'PWR',
    online,
    footprint,
  );

  if (online) {
    ctx.fillStyle = '#ffff44';
    ctx.font = `bold ${9 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u26A1', cv.x, cv.y - boxHeight - 10 * z);
  }
}

export function renderCommandRelay(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  camera: Camera,
  online: boolean,
): void {
  const footprint = getBuildingFootprint('command-relay');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 11 * z;

  drawIsoBox(
    ctx,
    cv.x,
    cv.y,
    z,
    '#6a3a8c',
    '#552870',
    online ? '#8a4ac2' : '#6a3a9a',
    boxHeight,
    'CMD',
    online,
    footprint,
  );

  if (!online) {
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OFF', cv.x, cv.y - boxHeight - 10 * z);
  }
}

export function renderUnitsFactory(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  camera: Camera,
  online: boolean,
): void {
  const footprint = getBuildingFootprint('units-factory');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 13 * z;

  drawIsoBox(
    ctx,
    cv.x,
    cv.y,
    z,
    '#8c5a2a',
    '#704520',
    online ? '#c27a3a' : '#9a6a3a',
    boxHeight,
    'FAC',
    online,
    footprint,
  );

  if (!online) {
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OFF', cv.x, cv.y - boxHeight - 10 * z);
  }
}

export function renderBuilder(
  ctx: CanvasRenderingContext2D,
  builder: BuilderPlacement,
  camera: Camera,
  assets: AssetStore,
  faction: FactionId,
  ticks: number,
): void {
  const scr = tileToScreen(builder.tx + 0.5, builder.ty + 0.5);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;

  // Try spritesheet rendering when feature flag is ON and asset exists
  if (FE_CIVIL_8X8_256_SHEETS_ENABLED) {
    const assetKey = BUILDER_ASSET_KEYS[faction];
    const sprite = assets.get(assetKey);
    if (sprite) {
      const profile = SPRITE_PROFILES.builder_base;
      const row = 2; // default direction: south
      const col = builderAnimColumn(builder.busy, ticks);
      drawSpritesheetFrame(ctx, sprite, row, col, cv.x, cv.y, z, profile);
      return;
    }
  }

  // Fallback: exact existing isometric box geometry
  const boxHeight = 8 * z;

  drawIsoBox(
    ctx,
    cv.x,
    cv.y,
    z * 0.72,
    '#6f7e8c',
    '#4e5b66',
    builder.busy ? '#d68f3e' : '#9ad8ff',
    boxHeight,
    'BLD',
    true,
  );

  ctx.fillStyle = builder.busy ? '#ffdc73' : '#d9f4ff';
  ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(builder.busy ? 'WORK' : 'IDLE', cv.x, cv.y - boxHeight - 10 * z);
}

export function renderConstructionSite(
  ctx: CanvasRenderingContext2D,
  site: ConstructionSitePlacement,
  camera: Camera,
): void {
  const footprint = getBuildingFootprint(site.type);
  const center = getFootprintCenter(site.tx, site.ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const hw = (TILE_W / 2) * z * footprint * 0.82;
  const hh = (TILE_H / 2) * z * footprint * 0.82;
  const platformY = cv.y - 3 * z;

  ctx.beginPath();
  ctx.moveTo(cv.x, platformY - hh);
  ctx.lineTo(cv.x + hw, platformY);
  ctx.lineTo(cv.x, platformY + hh);
  ctx.lineTo(cv.x - hw, platformY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(155, 104, 43, 0.85)';
  ctx.fill();
  ctx.strokeStyle = '#f0c96a';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 232, 155, 0.75)';
  ctx.lineWidth = Math.max(1, z);
  ctx.beginPath();
  ctx.moveTo(cv.x - hw * 0.45, platformY - hh * 0.2);
  ctx.lineTo(cv.x + hw * 0.45, platformY + hh * 0.2);
  ctx.moveTo(cv.x - hw * 0.45, platformY + hh * 0.2);
  ctx.lineTo(cv.x + hw * 0.45, platformY - hh * 0.2);
  ctx.stroke();

  const barW = 30 * z;
  const barH = 4 * z;
  const barX = cv.x - barW / 2;
  const barY = platformY - hh - 12 * z;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#ffdc73';
  ctx.fillRect(barX, barY, barW * site.progress, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.fillStyle = '#fff3d7';
  ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SITE', cv.x, platformY - hh - 21 * z);
}

/** Phase label for harvester rendering. */
function harvesterPhaseLabel(phase: HarvesterState['phase']): string {
  switch (phase) {
    case 'idle': return 'IDLE';
    case 'moving-to-resource': return 'GO';
    case 'gathering': return 'DIG';
    case 'moving-to-hq': return 'RET';
    case 'delivering': return 'DLV';
  }
}

/** Top face color for harvester based on phase. */
function harvesterTopColor(phase: HarvesterState['phase']): string {
  switch (phase) {
    case 'idle': return '#9ad8ff';
    case 'moving-to-resource': return '#d6c83e';
    case 'gathering': return '#e89040';
    case 'moving-to-hq': return '#d68f3e';
    case 'delivering': return '#5ee89a';
  }
}

/** Render a Harvester unit with sprite (when available) or fallback geometry. */
export function renderHarvester(
  ctx: CanvasRenderingContext2D,
  harvester: HarvesterState,
  camera: Camera,
  assets: AssetStore,
  faction: FactionId,
  ticks: number,
  prevTx: number,
  prevTy: number,
): void {
  const scr = tileToScreen(harvester.tx, harvester.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;

  // Try spritesheet rendering when feature flag is ON and asset exists
  if (FE_CIVIL_8X8_256_SHEETS_ENABLED) {
    const assetKey = HARVESTER_ASSET_KEYS[faction];
    const sprite = assets.get(assetKey);
    if (sprite) {
      const profile = SPRITE_PROFILES.harvester_base;
      const dx = harvester.tx - prevTx;
      const dy = harvester.ty - prevTy;
      const row = directionToRow(dx, dy);
      const col = harvesterAnimColumn(harvester.phase, ticks);
      drawSpritesheetFrame(ctx, sprite, row, col, cv.x, cv.y, z, profile);
      return;
    }
  }

  // Fallback: exact existing isometric box geometry
  const boxHeight = 7 * z;

  drawIsoBox(
    ctx,
    cv.x,
    cv.y,
    z * 0.65,
    '#5a7a4a',
    '#3e5830',
    harvesterTopColor(harvester.phase),
    boxHeight,
    'HRV',
    true,
  );

  // Phase label above
  ctx.fillStyle = '#e8f0d8';
  ctx.font = `bold ${5 * z}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(harvesterPhaseLabel(harvester.phase), cv.x, cv.y - boxHeight - 9 * z);

  // Carry indicator
  if (harvester.carry > 0) {
    ctx.fillStyle = '#5ee89a';
    ctx.font = `bold ${5 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(`${harvester.carry}`, cv.x, cv.y - boxHeight - 3 * z);
  }

  // Gathering progress bar
  if (harvester.phase === 'gathering' && harvester.gatherProgress > 0) {
    const barW = 22 * z;
    const barH = 3 * z;
    const barX = cv.x - barW / 2;
    const barY = cv.y - boxHeight - ((TILE_H / 2) * z * 0.65) - 6 * z;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#e89040';
    ctx.fillRect(barX, barY, barW * Math.min(harvester.gatherProgress, 1), barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }
}
