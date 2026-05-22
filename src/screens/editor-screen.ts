/**
 * MAP-EDITOR-ARCH-01 PR1+PR2+PR3 — Editor screen with tools, palette, and validation.
 *
 * Dev-only screen for viewing and editing a generated map preview.
 * Camera pan/zoom works. PR2 adds: Select/Place/Erase tools,
 * object palette, hover tile tracking, valid/invalid footprint preview,
 * placement/removal on editor MapData only.
 * PR3 adds: status line, validation panel, "Проверить карту" button,
 * placement rejection reasons, validation after edit, HQ/economy overlays.
 *
 * Availability: same guard as dev panel (DEV / test / ?devtools=1).
 */

import type { Screen, ScreenTransitionData, EditorScreenData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';
import { MAP_SIZE_STANDARD, MAP_SIZE_LARGE, ASSET_MANIFEST } from '../core/constants.js';
import { canvasToTile, tileToScreen } from '../core/coordinates.js';
import { AssetStore } from '../core/assets.js';
import { generateMap } from '../game/mapgen.js';
import { createResourceNodeStates } from '../systems/harvesting.js';
import { Camera } from '../render/camera.js';
import { editorPreviewRender } from '../render/editor-preview.js';
import type { EditorHoverState } from '../render/editor-preview.js';
import {
  type EditorTool,
  type PaletteItem,
  type PaletteGroup,
  PALETTE_ITEMS,
  buildEditorOccupiedSet,
  canPlace,
  placeResource,
  placeObstacle,
  placeDecor,
  findEntityAtTile,
  eraseAtTile,
} from '../game/editor-state.js';
import {
  validateEditorMap,
  getPlacementRejectionReason,
} from '../game/editor-validation.js';
import type { EditorValidationResult } from '../game/editor-validation.js';
import type { ResourceNodeState } from '../systems/harvesting.js';
import type { MapData, ResourceType, ObstacleType, DecorType } from '../game/map-types.js';

function resolveMapSize(mapSize: string): number {
  return mapSize === 'large' ? MAP_SIZE_LARGE : MAP_SIZE_STANDARD;
}

/** Tool labels for status line display. */
const TOOL_LABELS: Record<EditorTool, string> = {
  select: 'Выбор',
  place: 'Размещение',
  erase: 'Удаление',
};

export function createEditorScreen(navigate: NavigateFn): Screen {
  let camera: Camera | null = null;
  let assets: AssetStore | null = null;
  let animFrameId: number | null = null;
  let mapWidth = 0;
  let mapHeight = 0;

  // Input state
  const keys = new Set<string>();
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let camPanStartX = 0;
  let camPanStartY = 0;

  // PR2: Tool state
  let activeTool: EditorTool = 'select';
  let selectedPaletteItem: PaletteItem | null = null;

  // PR2: Hover state
  let hoverTx = -1;
  let hoverTy = -1;

  // Map data — stored for render loop and editor operations
  let mapData: MapData | null = null;
  let resourceNodes: ResourceNodeState[] | null = null;

  // DOM references for live updates
  let infoEl: HTMLElement | null = null;
  let statusEl: HTMLElement | null = null;
  let validationEl: HTMLElement | null = null;
  let paletteEl: HTMLElement | null = null;
  let toolBtns: Map<EditorTool, HTMLButtonElement> = new Map();
  let canvas: HTMLCanvasElement | null = null;

  // PR3: Cached validation result
  let lastValidation: EditorValidationResult | null = null;

  // Bound handlers for cleanup
  let boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  let boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  let boundMouseDown: ((e: MouseEvent) => void) | null = null;
  let boundMouseMove: ((e: MouseEvent) => void) | null = null;
  let boundMouseUp: (() => void) | null = null;
  let boundWheel: ((e: WheelEvent) => void) | null = null;
  let boundResize: (() => void) | null = null;
  let boundContextMenu: ((e: Event) => void) | null = null;

  /** Update the info panel with current map counts. */
  function updateInfo(): void {
    if (!infoEl || !mapData) return;
    infoEl.innerHTML =
      `<span>Размер: ${mapWidth}×${mapHeight}</span>` +
      `<span>Ресурсы: ${mapData.resources.length}</span>` +
      `<span>Препятствия: ${mapData.obstacles.length}</span>` +
      `<span>Декор: ${mapData.decor.length}</span>`;
  }

  /** Update the status line with current hover/tool/selection info. */
  function updateStatus(): void {
    if (!statusEl || !mapData) return;

    const parts: string[] = [];

    // Current tile
    if (hoverTx >= 0 && hoverTy >= 0 && hoverTx < mapWidth && hoverTy < mapHeight) {
      parts.push(`Клетка: (${hoverTx}, ${hoverTy})`);
    }

    // Active tool
    parts.push(`Инструмент: ${TOOL_LABELS[activeTool]}`);

    // Selected object (only in Place mode)
    if (activeTool === 'place' && selectedPaletteItem) {
      parts.push(`Объект: ${selectedPaletteItem.label}`);
    } else if (activeTool === 'place' && !selectedPaletteItem) {
      parts.push('Объект: не выбран');
    }

    // Rejection reason (only when hovering in Place mode)
    if (activeTool === 'place' && selectedPaletteItem && hoverTx >= 0 && hoverTy >= 0) {
      const reason = getPlacementRejectionReason(
        mapData, hoverTx, hoverTy, selectedPaletteItem.footprint,
      );
      if (reason) {
        parts.push(`<span class="editor-status__reason">${reason}</span>`);
      }
    }

    statusEl.innerHTML = parts.join(' &middot; ');
  }

  /** Run validation and update the validation panel. */
  function runValidation(): void {
    if (!mapData || !validationEl) return;
    lastValidation = validateEditorMap(mapData);
    renderValidationPanel(lastValidation);
  }

  /** Render validation results into the validation panel. */
  function renderValidationPanel(result: EditorValidationResult): void {
    if (!validationEl) return;

    const statusClass = result.ok ? 'editor-validation__status--ok' : 'editor-validation__status--error';
    const statusText = result.ok ? 'OK' : 'ОШИБКИ';

    let html = `<div class="editor-validation__status ${statusClass}">${statusText}</div>`;

    if (result.errors.length > 0) {
      html += '<div class="editor-validation__errors">';
      for (const err of result.errors) {
        html += `<div class="editor-validation__error">⚠ ${err}</div>`;
      }
      html += '</div>';
    }

    if (result.warnings.length > 0) {
      html += '<div class="editor-validation__warnings">';
      for (const warn of result.warnings) {
        html += `<div class="editor-validation__warning">⚡ ${warn}</div>`;
      }
      html += '</div>';
    }

    validationEl.innerHTML = html;
  }

  /** Set the active tool and update UI. */
  function setTool(tool: EditorTool): void {
    activeTool = tool;
    // Update button active states
    for (const [t, btn] of toolBtns) {
      if (t === tool) {
        btn.classList.add('btn--active');
      } else {
        btn.classList.remove('btn--active');
      }
    }
    // Show/hide palette
    if (paletteEl) {
      paletteEl.style.display = tool === 'place' ? 'flex' : 'none';
    }
    // Update cursor
    if (canvas) {
      if (tool === 'place') {
        canvas.style.cursor = 'crosshair';
      } else if (tool === 'erase') {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'grab';
      }
    }
  }

  /** Select a palette item. */
  function selectPaletteItem(item: PaletteItem): void {
    selectedPaletteItem = item;
    // Update palette button active states
    if (paletteEl) {
      const buttons = paletteEl.querySelectorAll('.editor-palette__item');
      buttons.forEach((btn) => {
        const btnItem = (btn as HTMLButtonElement).dataset.paletteType;
        const btnGroup = (btn as HTMLButtonElement).dataset.paletteGroup;
        if (btnItem === item.type && btnGroup === item.group) {
          btn.classList.add('btn--active');
        } else {
          btn.classList.remove('btn--active');
        }
      });
    }
  }

  /** Convert mouse event to tile coordinates, clamped to map bounds. */
  function mouseToTile(e: MouseEvent): { tx: number; ty: number } {
    if (!camera || !canvas) return { tx: -1, ty: -1 };
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const tile = canvasToTile(cx, cy, camera.x, camera.y, camera.zoom, canvas.width, canvas.height);
    const tx = Math.floor(tile.x);
    const ty = Math.floor(tile.y);
    return { tx, ty };
  }

  /** Handle left-click on canvas based on active tool. */
  function handleToolClick(e: MouseEvent): void {
    if (!mapData || !resourceNodes) return;
    const { tx, ty } = mouseToTile(e);
    if (tx < 0 || ty < 0 || tx >= mapWidth || ty >= mapHeight) return;

    if (activeTool === 'place' && selectedPaletteItem) {
      const item = selectedPaletteItem;
      let placed = false;
      switch (item.group) {
        case 'resource':
          placed = placeResource(mapData, tx, ty, item.type as ResourceType, resourceNodes);
          break;
        case 'obstacle':
          placed = placeObstacle(mapData, tx, ty, item.type as ObstacleType);
          break;
        case 'decor':
          placed = placeDecor(mapData, tx, ty, item.type as DecorType);
          break;
      }
      if (placed) {
        updateInfo();
        runValidation();
      }
    } else if (activeTool === 'erase') {
      const erased = eraseAtTile(mapData, tx, ty, resourceNodes);
      if (erased) {
        updateInfo();
        runValidation();
      }
    }
  }

  /** Compute the current hover state for the render loop. */
  function computeHoverState(): EditorHoverState | undefined {
    if (!mapData || hoverTx < 0 || hoverTy < 0) return undefined;

    const hover: EditorHoverState = {
      tx: hoverTx,
      ty: hoverTy,
      tool: activeTool,
    };

    if (activeTool === 'place' && selectedPaletteItem) {
      hover.paletteGroup = selectedPaletteItem.group;
      hover.paletteFootprint = selectedPaletteItem.footprint;
      const occupied = buildEditorOccupiedSet(mapData);
      hover.isValid = canPlace(mapData, occupied, hoverTx, hoverTy, selectedPaletteItem.footprint);
    } else if (activeTool === 'erase') {
      const entity = findEntityAtTile(mapData, hoverTx, hoverTy);
      if (entity) {
        hover.eraseTx = entity.tx;
        hover.eraseTy = entity.ty;
        hover.eraseFootprint = entity.footprint;
      }
    }

    return hover;
  }

  return {
    id: 'editor-screen',

    async mount(container: HTMLElement, data: ScreenTransitionData): Promise<void> {
      const editorData = data as EditorScreenData | null;
      const mapSize = editorData?.mapSize ?? 'standard';
      const size = resolveMapSize(mapSize);

      // Generate map and resource node states
      mapData = generateMap(size, size, 'cyan');
      resourceNodes = createResourceNodeStates(mapData.resources);
      mapWidth = mapData.width;
      mapHeight = mapData.height;

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--editor';

      // Create canvas
      canvas = document.createElement('canvas');
      canvas.className = 'screen__canvas';
      canvas.id = 'editor-canvas';
      canvas.style.cursor = 'grab';
      wrapper.appendChild(canvas);

      // ── Editor overlay UI (top-left) ─────────────────────────────────
      const overlay = document.createElement('div');
      overlay.className = 'editor-overlay';
      overlay.id = 'editor-overlay';

      const title = document.createElement('h2');
      title.className = 'editor-overlay__title';
      title.textContent = 'Редактор карты';
      overlay.appendChild(title);

      // Tool bar
      const toolbar = document.createElement('div');
      toolbar.className = 'editor-toolbar';
      toolbar.id = 'editor-toolbar';

      const toolSelect = document.createElement('button');
      toolSelect.className = 'btn btn--tool btn--active';
      toolSelect.textContent = 'Выбор';
      toolSelect.id = 'editor-tool-select';
      toolSelect.addEventListener('click', () => setTool('select'));
      toolBtns.set('select', toolSelect);

      const toolPlace = document.createElement('button');
      toolPlace.className = 'btn btn--tool';
      toolPlace.textContent = 'Размещение';
      toolPlace.id = 'editor-tool-place';
      toolPlace.addEventListener('click', () => setTool('place'));
      toolBtns.set('place', toolPlace);

      const toolErase = document.createElement('button');
      toolErase.className = 'btn btn--tool';
      toolErase.textContent = 'Удаление';
      toolErase.id = 'editor-tool-erase';
      toolErase.addEventListener('click', () => setTool('erase'));
      toolBtns.set('erase', toolErase);

      toolbar.appendChild(toolSelect);
      toolbar.appendChild(toolPlace);
      toolbar.appendChild(toolErase);
      overlay.appendChild(toolbar);

      infoEl = document.createElement('div');
      infoEl.className = 'editor-overlay__info';
      infoEl.id = 'editor-info';
      updateInfo();
      overlay.appendChild(infoEl);

      // ── PR3: Status line ────────────────────────────────────────────
      statusEl = document.createElement('div');
      statusEl.className = 'editor-status';
      statusEl.id = 'editor-status';
      statusEl.textContent = 'Инструмент: Выбор';
      overlay.appendChild(statusEl);

      // ── PR3: Validate button ────────────────────────────────────────
      const btnValidate = document.createElement('button');
      btnValidate.className = 'btn btn--tool editor-overlay__validate-btn';
      btnValidate.id = 'editor-validate-btn';
      btnValidate.textContent = 'Проверить карту';
      btnValidate.addEventListener('click', () => runValidation());
      overlay.appendChild(btnValidate);

      // ── PR3: Validation result panel ────────────────────────────────
      validationEl = document.createElement('div');
      validationEl.className = 'editor-validation';
      validationEl.id = 'editor-validation';
      overlay.appendChild(validationEl);

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back editor-overlay__back';
      btnBack.id = 'editor-back-btn';
      btnBack.textContent = 'В меню';
      btnBack.addEventListener('click', () => navigate('main-menu', null));
      overlay.appendChild(btnBack);

      wrapper.appendChild(overlay);

      // ── Object palette (right side, visible only in Place mode) ──────
      paletteEl = document.createElement('div');
      paletteEl.className = 'editor-palette';
      paletteEl.id = 'editor-palette';
      paletteEl.style.display = 'none'; // Hidden until Place tool is active

      const paletteTitle = document.createElement('div');
      paletteTitle.className = 'editor-palette__title';
      paletteTitle.textContent = 'Объекты';
      paletteEl.appendChild(paletteTitle);

      // Group palette items by group
      const groups: Array<{ label: string; group: PaletteGroup; items: readonly PaletteItem[] }> = [
        { label: 'Ресурсы', group: 'resource', items: PALETTE_ITEMS.filter(i => i.group === 'resource') },
        { label: 'Препятствия', group: 'obstacle', items: PALETTE_ITEMS.filter(i => i.group === 'obstacle') },
        { label: 'Декор', group: 'decor', items: PALETTE_ITEMS.filter(i => i.group === 'decor') },
      ];

      for (const group of groups) {
        const groupLabel = document.createElement('div');
        groupLabel.className = 'editor-palette__group-label';
        groupLabel.textContent = group.label;
        paletteEl.appendChild(groupLabel);

        for (const item of group.items) {
          const btn = document.createElement('button');
          btn.className = 'btn btn--palette-item editor-palette__item';
          btn.textContent = item.label;
          btn.dataset.paletteType = item.type;
          btn.dataset.paletteGroup = item.group;
          // Show footprint hint for multi-tile objects
          if (item.footprint > 1) {
            const hint = document.createElement('small');
            hint.textContent = `${item.footprint}×${item.footprint}`;
            btn.appendChild(hint);
          }
          btn.addEventListener('click', () => selectPaletteItem(item));
          paletteEl.appendChild(btn);
        }
      }

      wrapper.appendChild(paletteEl);

      container.appendChild(wrapper);

      // Setup canvas context
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot get 2D context for editor canvas');

      // Load assets
      const store = new AssetStore();
      await store.loadManifest(ASSET_MANIFEST);
      assets = store;

      // Setup camera — center on map center
      const center = tileToScreen(mapWidth / 2, mapHeight / 2);
      camera = new Camera(center.x, center.y);

      // PR3: Run initial validation on generated map
      runValidation();

      // Setup event handlers
      boundKeyDown = (e: KeyboardEvent) => {
        keys.add(e.code);
        // Keyboard shortcuts for tools
        if (e.code === 'KeyQ') setTool('select');
        if (e.code === 'KeyW' && !e.ctrlKey) setTool('place');
        if (e.code === 'KeyE') setTool('erase');
      };
      boundKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
      boundMouseDown = (e: MouseEvent) => {
        if (e.button === 1 || e.button === 2) {
          // Middle or right click — start panning
          isPanning = true;
          panStartX = e.clientX;
          panStartY = e.clientY;
          camPanStartX = camera!.x;
          camPanStartY = camera!.y;
          if (canvas) canvas.style.cursor = 'grabbing';
        } else if (e.button === 0) {
          // Left click — tool action
          handleToolClick(e);
        }
      };
      boundMouseMove = (e: MouseEvent) => {
        // Update hover tile
        const { tx, ty } = mouseToTile(e);
        hoverTx = tx;
        hoverTy = ty;

        // PR3: Update status line on every mouse move
        updateStatus();

        // Panning
        if (!isPanning || !camera) return;
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        camera.x = camPanStartX - dx / camera.zoom;
        camera.y = camPanStartY - dy / camera.zoom;
      };
      boundMouseUp = () => {
        if (isPanning) {
          isPanning = false;
          // Restore cursor based on active tool
          if (canvas) {
            if (activeTool === 'place') canvas.style.cursor = 'crosshair';
            else if (activeTool === 'erase') canvas.style.cursor = 'pointer';
            else canvas.style.cursor = 'grab';
          }
        }
      };
      boundWheel = (e: WheelEvent) => {
        e.preventDefault();
        if (!camera || !canvas) return;
        const delta = e.deltaY > 0 ? -1 : 1;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        camera.zoomAt(delta, cx, cy, canvas.width, canvas.height);
      };
      boundResize = () => {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      boundContextMenu = (e: Event) => {
        // Prevent browser context menu on right-click canvas pan
        e.preventDefault();
      };

      window.addEventListener('keydown', boundKeyDown);
      window.addEventListener('keyup', boundKeyUp);
      canvas.addEventListener('mousedown', boundMouseDown);
      window.addEventListener('mousemove', boundMouseMove);
      window.addEventListener('mouseup', boundMouseUp);
      canvas.addEventListener('wheel', boundWheel, { passive: false });
      window.addEventListener('resize', boundResize);
      canvas.addEventListener('contextmenu', boundContextMenu);

      // Initial resize
      boundResize();

      // Start render loop
      const loop = () => {
        if (!camera || !mapData || !assets) return;

        // Keyboard pan (only when not in Place/Erase mode or when select is active)
        let dx = 0;
        let dy = 0;
        // Use arrow keys for camera pan (WASD used for tool shortcuts)
        if (keys.has('ArrowUp')) dy -= 1;
        if (keys.has('ArrowDown')) dy += 1;
        if (keys.has('ArrowLeft')) dx -= 1;
        if (keys.has('ArrowRight')) dx += 1;
        if (dx !== 0 || dy !== 0) camera.panDirection(dx, dy, 0.016);

        // Compute hover state for rendering
        const hover = computeHoverState();

        // Render editor preview
        editorPreviewRender(ctx, mapData, camera, assets, resourceNodes ?? undefined, hover);

        animFrameId = requestAnimationFrame(loop);
      };
      animFrameId = requestAnimationFrame(loop);
    },

    unmount(): void {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }

      // Remove event listeners
      if (boundKeyDown) window.removeEventListener('keydown', boundKeyDown);
      if (boundKeyUp) window.removeEventListener('keyup', boundKeyUp);
      if (boundMouseDown) {
        const el = document.getElementById('editor-canvas');
        if (el) el.removeEventListener('mousedown', boundMouseDown);
      }
      if (boundMouseMove) window.removeEventListener('mousemove', boundMouseMove);
      if (boundMouseUp) window.removeEventListener('mouseup', boundMouseUp);
      if (boundWheel) {
        const el = document.getElementById('editor-canvas');
        if (el) el.removeEventListener('wheel', boundWheel);
      }
      if (boundResize) window.removeEventListener('resize', boundResize);
      if (boundContextMenu) {
        const el = document.getElementById('editor-canvas');
        if (el) el.removeEventListener('contextmenu', boundContextMenu);
      }

      keys.clear();
      isPanning = false;
      camera = null;
      assets = null;
      mapData = null;
      resourceNodes = null;
      canvas = null;
      infoEl = null;
      statusEl = null;
      validationEl = null;
      paletteEl = null;
      toolBtns.clear();
      lastValidation = null;

      boundKeyDown = null;
      boundKeyUp = null;
      boundMouseDown = null;
      boundMouseMove = null;
      boundMouseUp = null;
      boundWheel = null;
      boundResize = null;
      boundContextMenu = null;
    },
  };
}
