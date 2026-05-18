/**
 * ASSET-PREVIEW-01 — In-game building candidate preview sandbox.
 *
 * Debug-only tool to preview candidate building PNGs inside the actual game
 * canvas before committing them as production assets. Uses the same building
 * render pipeline: alpha-bounds, containFit, profile size, footprint,
 * vertical offset.
 *
 * Position controls: Position X/Y sliders (tile offset from default HQ-adjacent
 * position), plus left-click drag on canvas to reposition the candidate.
 *
 * Toggle: press 0 (zero key), or call toggleAssetPreview().
 * No gameplay changes. No production asset changes. No profile tuning.
 */

import { TILE_W, TILE_H } from '../core/constants.js';
import { tileToScreen } from '../core/coordinates.js';
import type { AssetMeta } from '../core/assets.js';
import { containFit } from '../render/contain-fit.js';
import type { Camera } from '../render/camera.js';

// ── State ────────────────────────────────────────────────────────

interface PreviewState {
  enabled: boolean;
  candidateImage: HTMLImageElement | null;
  candidateFileName: string;
  alphaBounds: AssetMeta | null;
  footprint: number;            // 1, 2, or 3
  profileSize: number;          // adjustable profile size (px at zoom=1)
  verticalOffset: number;       // adjustable groundOffset (px at zoom=1)
  posOffsetX: number;           // tile offset from default position (X/east direction)
  posOffsetY: number;           // tile offset from default position (Y/south direction)
  showFootprintOutline: boolean;
  showPlatform: boolean;
  showAlphaBoundsRect: boolean;
}

const state: PreviewState = {
  enabled: false,
  candidateImage: null,
  candidateFileName: '',
  alphaBounds: null,
  footprint: 2,
  profileSize: 128,
  verticalOffset: 0,
  posOffsetX: 0,
  posOffsetY: 0,
  showFootprintOutline: true,
  showPlatform: true,
  showAlphaBoundsRect: false,
};

// ── Alpha bounds computation (local, for candidate images) ───────

function computeCandidateAlphaBounds(img: HTMLImageElement): AssetMeta | null {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, nw, nh);
    const data = imageData.data;

    let minX = nw;
    let minY = nh;
    let maxX = -1;
    let maxY = -1;

    for (let iy = 0; iy < nh; iy++) {
      for (let ix = 0; ix < nw; ix++) {
        const alpha = data[(iy * nw + ix) * 4 + 3] ?? 0;
        if (alpha > 0) {
          if (ix < minX) minX = ix;
          if (iy < minY) minY = iy;
          if (ix > maxX) maxX = ix;
          if (iy > maxY) maxY = iy;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return { visibleX: 0, visibleY: 0, visibleW: nw, visibleH: nh, naturalW: nw, naturalH: nh };
    }

    return {
      visibleX: minX,
      visibleY: minY,
      visibleW: maxX - minX + 1,
      visibleH: maxY - minY + 1,
      naturalW: nw,
      naturalH: nh,
    };
  } catch {
    return null;
  }
}

// ── Construction-site platform drawing ────────────────────────────

/**
 * Draw the construction-site platform visual: an isometric diamond
 * slightly inset from the exact footprint, representing the safe art target.
 * Matches the renderConstructionSite() platform in buildings.ts.
 */
function drawConstructionPlatform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  footprint: number,
): void {
  const hw = (TILE_W / 2) * zoom * footprint * 0.82;
  const hh = (TILE_H / 2) * zoom * footprint * 0.82;
  const platformY = cy - 3 * zoom;

  ctx.save();

  // Filled platform diamond (same as construction-site platform)
  ctx.beginPath();
  ctx.moveTo(cx, platformY - hh);
  ctx.lineTo(cx + hw, platformY);
  ctx.lineTo(cx, platformY + hh);
  ctx.lineTo(cx - hw, platformY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(155, 104, 43, 0.85)';
  ctx.fill();
  ctx.strokeStyle = '#f0c96a';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Cross-hatch lines (construction texture)
  ctx.strokeStyle = 'rgba(255, 232, 155, 0.75)';
  ctx.lineWidth = Math.max(1, zoom);
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.45, platformY - hh * 0.2);
  ctx.lineTo(cx + hw * 0.45, platformY + hh * 0.2);
  ctx.moveTo(cx - hw * 0.45, platformY + hh * 0.2);
  ctx.lineTo(cx + hw * 0.45, platformY - hh * 0.2);
  ctx.stroke();

  ctx.restore();
}

// ── Footprint outline drawing ─────────────────────────────────────

function drawFootprintOutline(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  footprint: number,
): void {
  // Single diamond outline around the entire footprint area
  const hw = (TILE_W / 2) * footprint * zoom;
  const hh = (TILE_H / 2) * footprint * zoom;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 0, 180, 0.95)';
  ctx.lineWidth = Math.max(1, 2 * zoom);
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

// ── Candidate sprite drawing (same pipeline as drawBuildingSprite) ──

function drawCandidateSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  meta: AssetMeta | null,
  cx: number,
  cy: number,
  zoom: number,
  footprint: number,
  profileSize: number,
  verticalOffset: number,
): void {
  // Same anchor logic as drawBuildingSprite:
  // baseY = cy + (TILE_H/2) * footprint * zoom
  // groundOffset: positive = sprite moves up from baseY
  const baseY = cy + (TILE_H / 2) * footprint * zoom;
  const offY = verticalOffset * zoom;

  // Full-canvas containFit (same as getFullCanvasDestinationRect)
  const maxW = profileSize * zoom;
  const maxH = profileSize * zoom;
  const { drawWidth: fullW, drawHeight: fullH } = containFit(img.naturalWidth, img.naturalHeight, maxW, maxH);

  const fullX = cx - fullW / 2;
  const fullY = baseY - fullH - offY;

  ctx.save();
  ctx.globalAlpha = 0.92;

  if (meta && meta.naturalW > 0 && meta.naturalH > 0) {
    // Alpha-bounds crop mapped into full rect (same as getVisibleDestinationRect)
    const visX = fullX + (meta.visibleX / meta.naturalW) * fullW;
    const visY = fullY + (meta.visibleY / meta.naturalH) * fullH;
    const visW = (meta.visibleW / meta.naturalW) * fullW;
    const visH = (meta.visibleH / meta.naturalH) * fullH;

    ctx.drawImage(
      img,
      meta.visibleX, meta.visibleY, meta.visibleW, meta.visibleH,
      visX, visY, visW, visH,
    );
  } else {
    ctx.drawImage(img, fullX, fullY, fullW, fullH);
  }

  ctx.restore();
}

// ── Metadata drawing ──────────────────────────────────────────────

function drawMetadata(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  meta: AssetMeta | null,
  cx: number,
  cy: number,
  zoom: number,
  footprint: number,
  profileSize: number,
  verticalOffset: number,
  fileName: string,
): void {
  const baseY = cy + (TILE_H / 2) * footprint * zoom;
  const offY = verticalOffset * zoom;
  const maxW = profileSize * zoom;
  const maxH = profileSize * zoom;
  const { drawWidth: fullW, drawHeight: fullH } = containFit(img.naturalWidth, img.naturalHeight, maxW, maxH);
  const fullY = baseY - fullH - offY;

  // Anchor point (yellow dot)
  ctx.save();
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(cx, baseY, 3 * zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Alpha-bounds rect (cyan dashed)
  if (state.showAlphaBoundsRect && meta && meta.naturalW > 0 && meta.naturalH > 0) {
    const visX = fullX(cx, fullW) + (meta.visibleX / meta.naturalW) * fullW;
    const visY = fullY + (meta.visibleY / meta.naturalH) * fullH;
    const visW = (meta.visibleW / meta.naturalW) * fullW;
    const visH = (meta.visibleH / meta.naturalH) * fullH;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.90)';
    ctx.lineWidth = Math.max(1, 2 * zoom);
    ctx.setLineDash([6 * zoom, 4 * zoom]);
    ctx.strokeRect(visX, visY, visW, visH);
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Full rect (red dashed)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(fullX(cx, fullW), fullY, fullW, fullH);
  ctx.setLineDash([]);
  ctx.restore();

  // Label above sprite
  const fontSize = Math.max(9, 10 * zoom);
  ctx.save();
  ctx.font = `bold ${fontSize}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255, 210, 90, 0.95)';
  ctx.fillText(`[PREVIEW] ${fileName || 'candidate'}`, cx, fullY - 4 * zoom);
  ctx.restore();

  // Info panel to the right of the sprite
  const visibleAspect = meta ? (meta.visibleW / meta.visibleH).toFixed(3) : 'N/A';
  const lines: string[] = [
    `File: ${fileName || '(none)'}`,
    `Natural: ${img.naturalWidth}x${img.naturalHeight}`,
    meta
      ? `Alpha: (${meta.visibleX},${meta.visibleY}) ${meta.visibleW}x${meta.visibleH}`
      : 'Alpha: N/A',
    `Vis aspect: ${visibleAspect}`,
    `Profile: ${profileSize}px`,
    `Footprint: ${footprint}x${footprint}`,
    `GroundOffset: ${verticalOffset}`,
    `Pos offset: (${state.posOffsetX}, ${state.posOffsetY})`,
  ];

  const lineH = fontSize + 2;
  const padX = 4;
  const padY = 3;
  const panelX = fullX(cx, fullW) + fullW + 6;
  const panelY = fullY;
  const panelW = 240;
  const panelH = lines.length * lineH + padY * 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.font = `${fontSize}px "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, panelX + padX, panelY + padY + i * lineH);
  }
  ctx.restore();
}

function fullX(cx: number, drawWidth: number): number {
  return cx - drawWidth / 2;
}

// ── Public render entry point ─────────────────────────────────────

/**
 * Draw the asset preview overlay. Called from the render loop only when
 * state.enabled is true. Zero effect when disabled.
 */
export function drawAssetPreview(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  hqTx: number,
  hqTy: number,
): void {
  if (!state.enabled || !state.candidateImage) return;

  const img = state.candidateImage;
  if (!img.complete || !img.naturalWidth || !img.naturalHeight) return;

  const meta = state.alphaBounds;

  // Place preview footprint to the right of HQ, plus position offsets
  const previewTx = hqTx + (state.footprint === 3 ? 4 : 3) + state.posOffsetX;
  const previewTy = hqTy + state.posOffsetY;
  const centerTx = previewTx + state.footprint / 2;
  const centerTy = previewTy + state.footprint / 2;

  const scr = tileToScreen(centerTx, centerTy);
  const cv = camera.toCanvas(scr.x, scr.y, canvasWidth, canvasHeight);
  const z = camera.zoom;

  // Snapshot camera for drag calculations
  dragCamera = { x: camera.x, y: camera.y, zoom: camera.zoom };

  // 1. Construction platform (under candidate)
  if (state.showPlatform) {
    drawConstructionPlatform(ctx, cv.x, cv.y, z, state.footprint);
  }

  // 2. Footprint outline
  if (state.showFootprintOutline) {
    drawFootprintOutline(ctx, cv.x, cv.y, z, state.footprint);
  }

  // 3. Candidate sprite
  drawCandidateSprite(ctx, img, meta, cv.x, cv.y, z, state.footprint, state.profileSize, state.verticalOffset);

  // 4. Metadata overlay
  drawMetadata(ctx, img, meta, cv.x, cv.y, z, state.footprint, state.profileSize, state.verticalOffset, state.candidateFileName);
}

// ── Toggle ────────────────────────────────────────────────────────

/** Returns whether the asset preview is currently active. */
export function isAssetPreviewEnabled(): boolean {
  return state.enabled;
}

/** Toggle the asset preview on/off. */
export function toggleAssetPreview(): void {
  state.enabled = !state.enabled;
  if (state.enabled) {
    createPanel();
    panelEl!.style.display = 'block';
    installDragListeners();
    console.warn('[ASSET PREVIEW] ON — press 0 to toggle; left-click drag to reposition');
  } else {
    if (panelEl) panelEl.style.display = 'none';
    removeDragListeners();
    console.warn('[ASSET PREVIEW] OFF');
  }
}

// ── Mouse drag for repositioning candidate ─────────────────────────

let dragInstalled = false;
let dragging = false;
let dragStartCanvasX = 0;
let dragStartCanvasY = 0;
let dragStartOffsetX = 0;
let dragStartOffsetY = 0;
let dragCamera: { x: number; y: number; zoom: number } | null = null;

/** Convert canvas-pixel delta to tile delta (isometric). */
function canvasDeltaToTileDelta(dx: number, dy: number, zoom: number): { dtx: number; dty: number } {
  // Canvas → world pixel delta
  const wsx = dx / zoom;
  const wsy = dy / zoom;
  // World screen delta → tile delta (inverse of tileToScreen which is linear)
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  return {
    dtx: (wsx / halfW + wsy / halfH) / 2,
    dty: (wsy / halfH - wsx / halfW) / 2,
  };
}

function onDragMouseDown(e: MouseEvent): void {
  if (!state.enabled || e.button !== 0) return;
  // Don't capture drag if the click is on the UI panel
  const target = e.target as HTMLElement;
  if (target.id === 'fe-asset-preview-panel' || target.closest('#fe-asset-preview-panel')) return;

  dragging = true;
  dragStartCanvasX = e.clientX;
  dragStartCanvasY = e.clientY;
  dragStartOffsetX = state.posOffsetX;
  dragStartOffsetY = state.posOffsetY;
  e.preventDefault();
}

function onDragMouseMove(e: MouseEvent): void {
  if (!dragging || !dragCamera) return;
  const dx = e.clientX - dragStartCanvasX;
  const dy = e.clientY - dragStartCanvasY;
  const { dtx, dty } = canvasDeltaToTileDelta(dx, dy, dragCamera.zoom);
  state.posOffsetX = Math.round((dragStartOffsetX + dtx) * 2) / 2; // snap to 0.5 tiles
  state.posOffsetY = Math.round((dragStartOffsetY + dty) * 2) / 2;
  // Clamp to slider range
  state.posOffsetX = Math.max(-20, Math.min(20, state.posOffsetX));
  state.posOffsetY = Math.max(-20, Math.min(20, state.posOffsetY));
  // Update slider UI
  updatePositionSliders();
}

function onDragMouseUp(): void {
  dragging = false;
}

function installDragListeners(): void {
  if (dragInstalled) return;
  dragInstalled = true;
  window.addEventListener('mousedown', onDragMouseDown);
  window.addEventListener('mousemove', onDragMouseMove);
  window.addEventListener('mouseup', onDragMouseUp);
}

function removeDragListeners(): void {
  if (!dragInstalled) return;
  dragInstalled = false;
  dragging = false;
  window.removeEventListener('mousedown', onDragMouseDown);
  window.removeEventListener('mousemove', onDragMouseMove);
  window.removeEventListener('mouseup', onDragMouseUp);
}

// ── UI Panel ──────────────────────────────────────────────────────

let panelEl: HTMLDivElement | null = null;
let metadataEl: HTMLDivElement | null = null;
let sizeLabelEl: HTMLDivElement | null = null;
let offsetLabelEl: HTMLDivElement | null = null;
let posXLabelEl: HTMLDivElement | null = null;
let posYLabelEl: HTMLDivElement | null = null;
let posXSliderEl: HTMLInputElement | null = null;
let posYSliderEl: HTMLInputElement | null = null;

function createPanel(): void {
  if (panelEl) return;

  panelEl = document.createElement('div');
  panelEl.id = 'fe-asset-preview-panel';
  Object.assign(panelEl.style, {
    position: 'fixed',
    top: '64px',
    right: '12px',
    width: '280px',
    background: 'rgba(30, 22, 10, 0.94)',
    border: '1px solid #f0c96a',
    borderRadius: '6px',
    padding: '10px 12px',
    font: '12px/1.5 "Courier New", monospace',
    color: '#f0d080',
    zIndex: '9999',
    display: 'none',
    maxHeight: 'calc(100vh - 80px)',
    overflowY: 'auto',
    userSelect: 'none',
  });

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', color: '#ffd35b', borderBottom: '1px solid #8a7030', paddingBottom: '4px' });
  header.textContent = 'ASSET PREVIEW (0)';
  panelEl.appendChild(header);

  // File input
  const fileRow = document.createElement('div');
  Object.assign(fileRow.style, { marginBottom: '8px' });
  const fileLabel = document.createElement('label');
  Object.assign(fileLabel.style, { display: 'block', cursor: 'pointer', background: '#3a2e16', border: '1px solid #8a7030', borderRadius: '3px', padding: '4px 8px', textAlign: 'center', color: '#f0d080' });
  fileLabel.textContent = 'Load PNG Candidate...';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,.png';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const im = new Image();
      im.onload = () => {
        state.candidateImage = im;
        state.candidateFileName = file.name;
        state.alphaBounds = computeCandidateAlphaBounds(im);
        fileLabel.textContent = file.name.length > 24 ? file.name.slice(0, 21) + '...' : file.name;
      };
      im.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
  fileLabel.appendChild(fileInput);
  fileRow.appendChild(fileLabel);
  panelEl.appendChild(fileRow);

  // Footprint selector
  panelEl.appendChild(makeLabel('Footprint'));
  const fpRow = document.createElement('div');
  Object.assign(fpRow.style, { display: 'flex', gap: '4px', marginBottom: '8px' });
  for (const fp of [1, 2, 3]) {
    const btn = document.createElement('button');
    btn.textContent = `${fp}x${fp}`;
    Object.assign(btn.style, { flex: '1', padding: '4px 0', border: '1px solid #8a7030', borderRadius: '3px', background: state.footprint === fp ? '#5a4416' : '#2a1e06', color: '#f0d080', cursor: 'pointer', font: 'inherit' });
    btn.addEventListener('click', () => {
      state.footprint = fp;
      fpRow.querySelectorAll('button').forEach((b, i) => {
        (b as HTMLButtonElement).style.background = ([1, 2, 3][i] === fp) ? '#5a4416' : '#2a1e06';
      });
    });
    fpRow.appendChild(btn);
  }
  panelEl.appendChild(fpRow);

  // Profile size slider
  sizeLabelEl = makeLabel(`Profile Size: ${state.profileSize}px`);
  panelEl.appendChild(sizeLabelEl);
  panelEl.appendChild(makeSlider(64, 256, state.profileSize, (v) => {
    state.profileSize = v;
    if (sizeLabelEl) sizeLabelEl.textContent = `Profile Size: ${v}px`;
  }));

  // Vertical offset slider
  offsetLabelEl = makeLabel(`Vertical Offset: ${state.verticalOffset}px`);
  panelEl.appendChild(offsetLabelEl);
  panelEl.appendChild(makeSlider(-40, 80, state.verticalOffset, (v) => {
    state.verticalOffset = v;
    if (offsetLabelEl) offsetLabelEl.textContent = `Vertical Offset: ${v}px`;
  }));

  // Position X slider (tile offset)
  posXLabelEl = makeLabel(`Position X: ${state.posOffsetX} tiles`);
  panelEl.appendChild(posXLabelEl);
  posXSliderEl = makeSlider(-20, 20, state.posOffsetX, 0.5, (v) => {
    state.posOffsetX = v;
    if (posXLabelEl) posXLabelEl.textContent = `Position X: ${v} tiles`;
  });
  panelEl.appendChild(posXSliderEl);

  // Position Y slider (tile offset)
  posYLabelEl = makeLabel(`Position Y: ${state.posOffsetY} tiles`);
  panelEl.appendChild(posYLabelEl);
  posYSliderEl = makeSlider(-20, 20, state.posOffsetY, 0.5, (v) => {
    state.posOffsetY = v;
    if (posYLabelEl) posYLabelEl.textContent = `Position Y: ${v} tiles`;
  });
  panelEl.appendChild(posYSliderEl);

  // Toggles
  panelEl.appendChild(makeToggle('Footprint Outline', state.showFootprintOutline, (v) => { state.showFootprintOutline = v; }));
  panelEl.appendChild(makeToggle('Construction Platform', state.showPlatform, (v) => { state.showPlatform = v; }));
  panelEl.appendChild(makeToggle('Alpha-Bounds Rect', state.showAlphaBoundsRect, (v) => { state.showAlphaBoundsRect = v; }));

  // Clear button
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear Candidate';
  Object.assign(clearBtn.style, { width: '100%', marginTop: '8px', padding: '5px 0', border: '1px solid #8a7030', borderRadius: '3px', background: '#2a1e06', color: '#f0d080', cursor: 'pointer', font: 'inherit' });
  clearBtn.addEventListener('click', () => {
    state.candidateImage = null;
    state.candidateFileName = '';
    state.alphaBounds = null;
    state.posOffsetX = 0;
    state.posOffsetY = 0;
    fileLabel.textContent = 'Load PNG Candidate...';
    fileInput.value = '';
    updatePositionSliders();
  });
  panelEl.appendChild(clearBtn);

  // Metadata
  metadataEl = document.createElement('div');
  Object.assign(metadataEl.style, { marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #8a7030', fontSize: '11px', lineHeight: '1.6', color: '#c0a060', whiteSpace: 'pre-wrap' as const });
  panelEl.appendChild(metadataEl);

  document.body.appendChild(panelEl);
}

function makeLabel(text: string): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, { fontSize: '11px', marginBottom: '2px', color: '#c0a060' });
  el.textContent = text;
  return el;
}

function makeSlider(min: number, max: number, val: number, stepOrOnChange: number | ((v: number) => void), onChange?: (v: number) => void): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'range';
  el.min = String(min);
  el.max = String(max);
  el.value = String(val);
  // Overloaded: makeSlider(min, max, val, onChange) or makeSlider(min, max, val, step, onChange)
  if (typeof stepOrOnChange === 'function') {
    onChange = stepOrOnChange;
  } else {
    el.step = String(stepOrOnChange);
  }
  Object.assign(el.style, { width: '100%', marginBottom: '6px', accentColor: '#f0c96a' });
  el.addEventListener('input', () => { onChange?.(Number(el.value)); });
  return el;
}

/** Update position slider UI from current state (called after drag). */
function updatePositionSliders(): void {
  if (posXSliderEl) posXSliderEl.value = String(state.posOffsetX);
  if (posYSliderEl) posYSliderEl.value = String(state.posOffsetY);
  if (posXLabelEl) posXLabelEl.textContent = `Position X: ${state.posOffsetX} tiles`;
  if (posYLabelEl) posYLabelEl.textContent = `Position Y: ${state.posOffsetY} tiles`;
}

function makeToggle(label: string, initial: boolean, onChange: (v: boolean) => void): HTMLDivElement {
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' });
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = initial;
  cb.style.accentColor = '#f0c96a';
  const lbl = document.createElement('span');
  Object.assign(lbl.style, { fontSize: '11px', color: '#c0a060' });
  lbl.textContent = label;
  cb.addEventListener('change', () => { onChange(cb.checked); });
  row.appendChild(cb);
  row.appendChild(lbl);
  return row;
}

// ── Keyboard shortcut (0 key) ─────────────────────────────────────

let keyInstalled = false;

export function installAssetPreviewKey(): void {
  if (keyInstalled) return;
  keyInstalled = true;

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.repeat) return;
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() ?? '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
      e.preventDefault();
      toggleAssetPreview();
    }
  });
}
