/** Building rendering: faction HQ, civil buildings, builder, and construction sites. */

import { getBuildingFootprint } from '../config/buildings.js';
import { TILE_W, TILE_H, SPRITE_PROFILES, HQ_FOOTPRINT, HQ_COLOR, GRID_COLOR, FE_CIVIL_8X8_256_SHEETS_ENABLED, FE_BUILDING_SPRITES_ENABLED } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { AssetStore } from '../core/assets.js';
import type { AssetMeta } from '../core/assets.js';
import type { BuilderPlacement, ConstructionSitePlacement, HqPlacement, FactionId, BuildingType } from '../game/map-types.js';
import type { HarvesterState } from '../systems/harvesting.js';
import type { Camera } from './camera.js';
import { drawSpritesheetFrame, directionToRow, builderAnimColumn, harvesterAnimColumn } from './spritesheet.js';
import { containFit } from './contain-fit.js';
import { isDebugOverlayEnabled, drawBuildingDebugOverlay } from './debug-overlay.js';

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

/** Building type → faction → asset key mapping. */
const BUILDING_ASSET_KEYS: Record<BuildingType, Record<FactionId, string>> = {
  separator: {
    cyan: 'building_cyan_separator',
    green: 'building_green_separator',
    yellow: 'building_yellow_separator',
    purple: 'building_purple_separator',
  },
  'raw-storage': {
    cyan: 'building_cyan_raw_storage',
    green: 'building_green_raw_storage',
    yellow: 'building_yellow_raw_storage',
    purple: 'building_purple_raw_storage',
  },
  'matter-storage': {
    cyan: 'building_cyan_matter_storage',
    green: 'building_green_matter_storage',
    yellow: 'building_yellow_matter_storage',
    purple: 'building_purple_matter_storage',
  },
  'power-plant': {
    cyan: 'building_cyan_power_plant',
    green: 'building_green_power_plant',
    yellow: 'building_yellow_power_plant',
    purple: 'building_purple_power_plant',
  },
  'command-relay': {
    cyan: 'building_cyan_command_relay',
    green: 'building_green_command_relay',
    yellow: 'building_yellow_command_relay',
    purple: 'building_purple_command_relay',
  },
  'units-factory': {
    cyan: 'building_cyan_units_factory',
    green: 'building_green_units_factory',
    yellow: 'building_yellow_units_factory',
    purple: 'building_purple_units_factory',
  },
};

/** Profile key for each building type. */
const BUILDING_PROFILE_KEYS: Record<BuildingType, keyof typeof SPRITE_PROFILES> = {
  separator: 'building_separator',
  'raw-storage': 'building_raw_storage',
  'matter-storage': 'building_matter_storage',
  'power-plant': 'building_power_plant',
  'command-relay': 'building_command_relay',
  'units-factory': 'building_units_factory',
};

interface SpriteDestinationRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Compute the destination rect for the full source canvas inside a profile bbox.
 * This preserves the same scale that full-canvas drawing used before alpha crops.
 */
function getFullCanvasDestinationRect(
  sprite: HTMLImageElement,
  profileKey: keyof typeof SPRITE_PROFILES,
  cx: number,
  baseY: number,
  zoom: number,
): SpriteDestinationRect {
  const profile = SPRITE_PROFILES[profileKey];
  const maxW = profile.size[0] * zoom;
  const maxH = profile.size[1] * zoom;
  const offY = profile.groundOffset * zoom;
  const { drawWidth, drawHeight } = containFit(sprite.naturalWidth, sprite.naturalHeight, maxW, maxH);
  return {
    x: cx - drawWidth / 2,
    y: baseY - drawHeight - offY,
    w: drawWidth,
    h: drawHeight,
  };
}

/**
 * Map an alpha-bounds source rect onto the destination rect of the full canvas.
 * This crops transparent pixels without upscaling the visible art to fill profile.size.
 */
function getVisibleDestinationRect(
  fullRect: SpriteDestinationRect,
  meta: AssetMeta,
): SpriteDestinationRect {
  const naturalW = meta.naturalW > 0 ? meta.naturalW : meta.visibleW;
  const naturalH = meta.naturalH > 0 ? meta.naturalH : meta.visibleH;
  return {
    x: fullRect.x + (meta.visibleX / naturalW) * fullRect.w,
    y: fullRect.y + (meta.visibleY / naturalH) * fullRect.h,
    w: (meta.visibleW / naturalW) * fullRect.w,
    h: (meta.visibleH / naturalH) * fullRect.h,
  };
}

function isUsableMeta(meta: AssetMeta | null | undefined): meta is AssetMeta {
  return Boolean(meta && meta.visibleW > 0 && meta.visibleH > 0 && meta.naturalW > 0 && meta.naturalH > 0);
}

/** Compute the top Y of the actually visible sprite area for overlay placement. */
function getVisibleSpriteTopY(
  sprite: HTMLImageElement,
  profileKey: keyof typeof SPRITE_PROFILES,
  cx: number,
  baseY: number,
  zoom: number,
  meta?: AssetMeta | null,
): number {
  const fullRect = getFullCanvasDestinationRect(sprite, profileKey, cx, baseY, zoom);
  if (!isUsableMeta(meta)) return fullRect.y;
  return getVisibleDestinationRect(fullRect, meta).y;
}

/** Draw a building sprite anchored to the footprint's south vertex, dimmed when offline.
 *  baseY = cy + (TILE_H/2) * footprint * zoom  (south vertex of isometric diamond)
 *  groundOffset: positive = sprite moves up from baseY (floats), negative = moves down (sinks)
 *  Full source canvas bottom = baseY - groundOffset * zoom
 *  Alpha bounds crop only skips transparent source pixels; it does not change scale/position.
 */
function drawBuildingSprite(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement,
  profileKey: keyof typeof SPRITE_PROFILES,
  cx: number,
  cy: number,
  zoom: number,
  online: boolean,
  footprint: number,
  meta?: AssetMeta | null,
): void {
  const baseY = cy + (TILE_H / 2) * footprint * zoom;
  const fullRect = getFullCanvasDestinationRect(sprite, profileKey, cx, baseY, zoom);
  if (!online) {
    ctx.globalAlpha = 0.45;
  }
  if (isUsableMeta(meta)) {
    const visibleRect = getVisibleDestinationRect(fullRect, meta);
    ctx.drawImage(
      sprite,
      meta.visibleX, meta.visibleY, meta.visibleW, meta.visibleH,
      visibleRect.x, visibleRect.y, visibleRect.w, visibleRect.h,
    );
  } else {
    ctx.drawImage(sprite, fullRect.x, fullRect.y, fullRect.w, fullRect.h);
  }
  if (!online) {
    ctx.globalAlpha = 1;
  }
}

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
  const profileKey = 'hq_base';

  if (sprite) {
    const meta = assets.getMeta(assetKey);
    const baseY = cv.y + (TILE_H / 2) * HQ_FOOTPRINT * z;
    const fullRect = getFullCanvasDestinationRect(sprite, profileKey, cv.x, baseY, z);
    if (isUsableMeta(meta)) {
      const visibleRect = getVisibleDestinationRect(fullRect, meta);
      ctx.drawImage(
        sprite,
        meta.visibleX, meta.visibleY, meta.visibleW, meta.visibleH,
        visibleRect.x, visibleRect.y, visibleRect.w, visibleRect.h,
      );
    } else {
      ctx.drawImage(sprite, fullRect.x, fullRect.y, fullRect.w, fullRect.h);
    }
    if (isDebugOverlayEnabled()) {
      drawBuildingDebugOverlay(ctx, { assetKey, profileKey, sprite, meta, cx: cv.x, cy: cv.y, zoom: z, footprint: HQ_FOOTPRINT, isHq: true });
    }
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
  assets: AssetStore,
  faction: FactionId,
): void {
  const footprint = getBuildingFootprint('separator');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 12 * z;

  // Try sprite rendering when feature flag is ON and asset exists
  if (FE_BUILDING_SPRITES_ENABLED) {
    const assetKey = BUILDING_ASSET_KEYS['separator'][faction];
    const sprite = assets.get(assetKey);
    if (sprite) {
      const profileKey = BUILDING_PROFILE_KEYS['separator'];
      const meta = assets.getMeta(assetKey);
      drawBuildingSprite(ctx, sprite, profileKey, cv.x, cv.y, z, online, footprint, meta);
      if (isDebugOverlayEnabled()) { drawBuildingDebugOverlay(ctx, { assetKey, profileKey, sprite, meta, cx: cv.x, cy: cv.y, zoom: z, footprint }); }
      const baseY = cv.y + (TILE_H / 2) * footprint * z;
      const spriteTopY = getVisibleSpriteTopY(sprite, profileKey, cv.x, baseY, z, meta);
      // Overlay: progress bar
      if (online && progress > 0) {
        const barW = 28 * z;
        const barH = 4 * z;
        const barX = cv.x - barW / 2;
        const barY = spriteTopY - 2 * z;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX, barY, barW, barH);

        ctx.fillStyle = active ? '#5ee89a' : '#888';
        ctx.fillRect(barX, barY, barW * Math.min(progress, 1), barH);

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
      }
      // Overlay: OFF label
      if (!online) {
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OFF', cv.x, spriteTopY - 4 * z);
      }
      return;
    }
  }

  // Fallback: exact existing isometric box geometry
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

export function renderRawStorage(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  camera: Camera,
  online: boolean,
  assets: AssetStore,
  faction: FactionId,
): void {
  const footprint = getBuildingFootprint('raw-storage');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 10 * z;

  // Try sprite rendering when feature flag is ON and asset exists
  if (FE_BUILDING_SPRITES_ENABLED) {
    const assetKey = BUILDING_ASSET_KEYS['raw-storage'][faction];
    const sprite = assets.get(assetKey);
    if (sprite) {
      const profileKey = BUILDING_PROFILE_KEYS['raw-storage'];
      const meta = assets.getMeta(assetKey);
      drawBuildingSprite(ctx, sprite, profileKey, cv.x, cv.y, z, online, footprint, meta);
      if (isDebugOverlayEnabled()) { drawBuildingDebugOverlay(ctx, { assetKey, profileKey, sprite, meta, cx: cv.x, cy: cv.y, zoom: z, footprint }); }
      // Overlay: OFF label
      if (!online) {
        const baseY = cv.y + (TILE_H / 2) * footprint * z;
        const spriteTopY = getVisibleSpriteTopY(sprite, profileKey, cv.x, baseY, z, meta);
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OFF', cv.x, spriteTopY - 4 * z);
      }
      return;
    }
  }

  // Fallback: exact existing isometric box geometry
  drawIsoBox(ctx, cv.x, cv.y, z, '#6b5a3a', '#554828', '#8b7a50', boxHeight, 'RSR', online, footprint);

  if (!online) {
    ctx.fillStyle = '#ff4444';
    ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OFF', cv.x, cv.y - boxHeight - 10 * z);
  }
}

export function renderMatterStorage(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  camera: Camera,
  online: boolean,
  assets: AssetStore,
  faction: FactionId,
): void {
  const footprint = getBuildingFootprint('matter-storage');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 10 * z;

  // Try sprite rendering when feature flag is ON and asset exists
  if (FE_BUILDING_SPRITES_ENABLED) {
    const assetKey = BUILDING_ASSET_KEYS['matter-storage'][faction];
    const sprite = assets.get(assetKey);
    if (sprite) {
      const profileKey = BUILDING_PROFILE_KEYS['matter-storage'];
      const meta = assets.getMeta(assetKey);
      drawBuildingSprite(ctx, sprite, profileKey, cv.x, cv.y, z, online, footprint, meta);
      if (isDebugOverlayEnabled()) { drawBuildingDebugOverlay(ctx, { assetKey, profileKey, sprite, meta, cx: cv.x, cy: cv.y, zoom: z, footprint }); }
      // Overlay: OFF label
      if (!online) {
        const baseY = cv.y + (TILE_H / 2) * footprint * z;
        const spriteTopY = getVisibleSpriteTopY(sprite, profileKey, cv.x, baseY, z, meta);
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OFF', cv.x, spriteTopY - 4 * z);
      }
      return;
    }
  }

  // Fallback: exact existing isometric box geometry
  drawIsoBox(ctx, cv.x, cv.y, z, '#5a6b3a', '#485528', '#7a8b50', boxHeight, 'MST', online, footprint);

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
  assets: AssetStore,
  faction: FactionId,
): void {
  const footprint = getBuildingFootprint('power-plant');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 14 * z;

  // Try sprite rendering when feature flag is ON and asset exists
  if (FE_BUILDING_SPRITES_ENABLED) {
    const assetKey = BUILDING_ASSET_KEYS['power-plant'][faction];
    const sprite = assets.get(assetKey);
    if (sprite) {
      const profileKey = BUILDING_PROFILE_KEYS['power-plant'];
      const meta = assets.getMeta(assetKey);
      drawBuildingSprite(ctx, sprite, profileKey, cv.x, cv.y, z, online, footprint, meta);
      if (isDebugOverlayEnabled()) { drawBuildingDebugOverlay(ctx, { assetKey, profileKey, sprite, meta, cx: cv.x, cy: cv.y, zoom: z, footprint }); }
      // Overlay: lightning bolt when online
      if (online) {
        const baseY = cv.y + (TILE_H / 2) * footprint * z;
        const spriteTopY = getVisibleSpriteTopY(sprite, profileKey, cv.x, baseY, z, meta);
        ctx.fillStyle = '#ffff44';
        ctx.font = `bold ${9 * z}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u26A1', cv.x, spriteTopY - 4 * z);
      }
      return;
    }
  }

  // Fallback: exact existing isometric box geometry
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
  assets: AssetStore,
  faction: FactionId,
): void {
  const footprint = getBuildingFootprint('command-relay');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 11 * z;

  // Try sprite rendering when feature flag is ON and asset exists
  if (FE_BUILDING_SPRITES_ENABLED) {
    const assetKey = BUILDING_ASSET_KEYS['command-relay'][faction];
    const sprite = assets.get(assetKey);
    if (sprite) {
      const profileKey = BUILDING_PROFILE_KEYS['command-relay'];
      const meta = assets.getMeta(assetKey);
      drawBuildingSprite(ctx, sprite, profileKey, cv.x, cv.y, z, online, footprint, meta);
      if (isDebugOverlayEnabled()) { drawBuildingDebugOverlay(ctx, { assetKey, profileKey, sprite, meta, cx: cv.x, cy: cv.y, zoom: z, footprint }); }
      // Overlay: OFF label
      if (!online) {
        const baseY = cv.y + (TILE_H / 2) * footprint * z;
        const spriteTopY = getVisibleSpriteTopY(sprite, profileKey, cv.x, baseY, z, meta);
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OFF', cv.x, spriteTopY - 4 * z);
      }
      return;
    }
  }

  // Fallback: exact existing isometric box geometry
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
  assets: AssetStore,
  faction: FactionId,
): void {
  const footprint = getBuildingFootprint('units-factory');
  const center = getFootprintCenter(tx, ty, footprint);
  const scr = tileToScreen(center.tx, center.ty);
  const cv = camera.toCanvas(scr.x, scr.y, ctx.canvas.width, ctx.canvas.height);
  const z = camera.zoom;
  const boxHeight = 13 * z;

  // Try sprite rendering when feature flag is ON and asset exists
  if (FE_BUILDING_SPRITES_ENABLED) {
    const assetKey = BUILDING_ASSET_KEYS['units-factory'][faction];
    const sprite = assets.get(assetKey);
    if (sprite) {
      const profileKey = BUILDING_PROFILE_KEYS['units-factory'];
      const meta = assets.getMeta(assetKey);
      drawBuildingSprite(ctx, sprite, profileKey, cv.x, cv.y, z, online, footprint, meta);
      if (isDebugOverlayEnabled()) { drawBuildingDebugOverlay(ctx, { assetKey, profileKey, sprite, meta, cx: cv.x, cy: cv.y, zoom: z, footprint }); }
      // Overlay: OFF label
      if (!online) {
        const baseY = cv.y + (TILE_H / 2) * footprint * z;
        const spriteTopY = getVisibleSpriteTopY(sprite, profileKey, cv.x, baseY, z, meta);
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold ${6 * z}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OFF', cv.x, spriteTopY - 4 * z);
      }
      return;
    }
  }

  // Fallback: exact existing isometric box geometry
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
    case 'moving-to-dropoff': return 'RET';
    case 'delivering': return 'DLV';
    case 'waiting-full-storage': return 'WAIT';
  }
}

/** Top face color for harvester based on phase. */
function harvesterTopColor(phase: HarvesterState['phase']): string {
  switch (phase) {
    case 'idle': return '#9ad8ff';
    case 'moving-to-resource': return '#d6c83e';
    case 'gathering': return '#e89040';
    case 'moving-to-dropoff': return '#d68f3e';
    case 'delivering': return '#5ee89a';
    case 'waiting-full-storage': return '#e87070';
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
