/**
 * MAP-EDITOR-ARCH-01 PR1+PR2+PR3+PR9+PR10 — Editor screen with tools, palette,
 * validation, custom map save/load, and game launch.
 *
 * Dev-only screen for viewing and editing a generated map preview.
 * Camera pan/zoom works. PR2 adds: Select/Place/Erase tools,
 * object palette, hover tile tracking, valid/invalid footprint preview,
 * placement/removal on editor MapData only.
 * PR3 adds: status line, validation panel, "Проверить карту" button,
 * placement rejection reasons, validation after edit, HQ/economy overlays.
 * PR9 adds: "Сохранить карту" button, saved custom maps list,
 * load saved map into editor, delete saved map, editor status feedback.
 * PR10 adds: "Начать игру" button, launches Game Screen from current
 * editor MapData when valid. Deep-clones MapData before runtime use.
 *
 * Availability: same guard as dev panel (DEV / test / ?devtools=1).
 */

import type { Screen, ScreenTransitionData, EditorScreenData, GameScreenData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';
import { MAP_SIZE_STANDARD, MAP_SIZE_LARGE, ASSET_MANIFEST } from '../core/constants.js';
import { computeMapVisualSeed } from '../core/asset-variants.js';
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
import {
  loadSavedMaps,
  saveCustomMap,
  deleteSavedMap,
  type SavedCustomMap,
} from '../game/custom-map-storage.js';
import { deepCloneMapData } from '../game/game-state.js';
import { createAssetTunerPanel, loadOverrides, isAssetTunerAllowed } from '../dev/asset-tuner.js';

function resolveMapSize(mapSize: string): number {
  return mapSize === 'large' ? MAP_SIZE_LARGE : MAP_SIZE_STANDARD;
}

/** Tool labels for status line display. */
const TOOL_LABELS: Record<EditorTool, string> = {
  select: 'Выбор',
  place: 'Размещение',
  erase: 'Удаление',
};

/** Format a timestamp to a locale-friendly date/time string. */
function formatDate(epoch: number): string {
  try {
    return new Date(epoch).toLocaleString();
  } catch {
    return String(epoch);
  }
}

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

  // PR9: Current saved map id — tracks which saved map is currently loaded
  let currentSavedMapId: string | null = null;

  // DOM references for live updates
  let infoEl: HTMLElement | null = null;
  let statusEl: HTMLElement | null = null;
  let validationEl: HTMLElement | null = null;
  let paletteEl: HTMLElement | null = null;
  let toolBtns: Map<EditorTool, HTMLButtonElement> = new Map();
  let canvas: HTMLCanvasElement | null = null;

  // PR9: DOM references for custom maps UI
  let savedMapsListEl: HTMLElement | null = null;
  let editorStatusEl: HTMLElement | null = null;

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

  // Asset Tuner (dev-only)
  let assetTunerDestroy: (() => void) | null = null;

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

  // ── PR9: Editor status feedback ────────────────────────────────

  let editorStatusTimeout: ReturnType<typeof setTimeout> | undefined;

  function showEditorStatus(message: string, isError = false): void {
    if (!editorStatusEl) return;
    editorStatusEl.textContent = message;
    editorStatusEl.dataset.visible = 'true';
    editorStatusEl.dataset.tone = isError ? 'error' : 'ok';
    if (editorStatusTimeout !== undefined) {
      clearTimeout(editorStatusTimeout);
    }
    editorStatusTimeout = setTimeout(() => {
      if (editorStatusEl) {
        editorStatusEl.dataset.visible = 'false';
      }
    }, 3000);
  }

  // ── PR9: Load saved map into editor ────────────────────────────

  function loadMapIntoEditor(savedMap: SavedCustomMap): void {
    if (!mapData) return;

    // Replace current editor MapData with loaded map
    const loadedMap = savedMap.map;
    mapData.width = loadedMap.width;
    mapData.height = loadedMap.height;
    mapData.terrain = loadedMap.terrain;
    mapData.hq = loadedMap.hq;
    mapData.resources = loadedMap.resources;
    mapData.obstacles = loadedMap.obstacles;
    mapData.decor = loadedMap.decor;
    mapData.buildings = loadedMap.buildings;
    mapData.builders = loadedMap.builders;
    mapData.constructionSites = loadedMap.constructionSites;

    // Update map dimensions
    mapWidth = loadedMap.width;
    mapHeight = loadedMap.height;

    // Rebuild editor-local resourceNodes from map.resources
    resourceNodes = createResourceNodeStates(loadedMap.resources);

    // Update current saved map id
    currentSavedMapId = savedMap.id;

    // Recenters camera
    if (camera) {
      const center = tileToScreen(mapWidth / 2, mapHeight / 2);
      camera.x = center.x;
      camera.y = center.y;
    }

    // Clear hover/preview/transient state
    hoverTx = -1;
    hoverTy = -1;
    selectedPaletteItem = null;
    setTool('select');

    // Update counts/info
    updateInfo();
    updateStatus();

    // Run validation
    runValidation();

    showEditorStatus(`Загружена: ${savedMap.name}`);
  }

  // ── PR9: Render saved maps list ────────────────────────────────

  function renderSavedMaps(): void {
    if (!savedMapsListEl) return;
    savedMapsListEl.innerHTML = '';

    let savedMaps: SavedCustomMap[];
    try {
      savedMaps = loadSavedMaps();
    } catch {
      savedMaps = [];
    }

    if (savedMaps.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.className = 'editor-saved-maps__empty';
      emptyEl.textContent = 'Нет сохранённых карт';
      savedMapsListEl.appendChild(emptyEl);
      return;
    }

    for (const entry of savedMaps) {
      const row = document.createElement('div');
      row.className = 'editor-saved-map-entry';
      if (entry.id === currentSavedMapId) {
        row.classList.add('editor-saved-map-entry--active');
      }
      row.dataset.mapId = entry.id;

      const info = document.createElement('div');
      info.className = 'editor-saved-map-entry__info';

      const nameLabel = document.createElement('span');
      nameLabel.className = 'editor-saved-map-entry__name';
      nameLabel.textContent = entry.name;
      info.appendChild(nameLabel);

      const sizeLabel = document.createElement('span');
      sizeLabel.className = 'editor-saved-map-entry__size';
      sizeLabel.textContent = `${entry.map.width}×${entry.map.height}`;
      info.appendChild(sizeLabel);

      const countsLabel = document.createElement('span');
      countsLabel.className = 'editor-saved-map-entry__counts';
      countsLabel.textContent = `Р:${entry.map.resources.length} П:${entry.map.obstacles.length} Д:${entry.map.decor.length}`;
      info.appendChild(countsLabel);

      const dateLabel = document.createElement('span');
      dateLabel.className = 'editor-saved-map-entry__date';
      dateLabel.textContent = formatDate(entry.updatedAt);
      info.appendChild(dateLabel);

      row.appendChild(info);

      // Delete button
      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn btn--delete-map';
      btnDelete.dataset.mapId = entry.id;
      btnDelete.textContent = 'Удалить';
      btnDelete.setAttribute('aria-label', `Удалить карту ${entry.name}`);
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent triggering the row click
        try {
          const ok = deleteSavedMap(entry.id);
          if (ok) {
            // If the deleted map was the current one, clear currentSavedMapId
            if (currentSavedMapId === entry.id) {
              currentSavedMapId = null;
            }
            showEditorStatus('Карта удалена');
          } else {
            showEditorStatus('Не удалось удалить карту', true);
          }
        } catch {
          showEditorStatus('Не удалось удалить карту', true);
        }
        renderSavedMaps();
      });
      row.appendChild(btnDelete);

      // Click entry info area to load the map
      info.addEventListener('click', () => {
        loadMapIntoEditor(entry);
        renderSavedMaps(); // re-render to update active state
      });

      savedMapsListEl.appendChild(row);
    }
  }

  return {
    id: 'editor-screen',

    async mount(container: HTMLElement, data: ScreenTransitionData): Promise<void> {
      const editorData = data as EditorScreenData | null;
      const mapSize = editorData?.mapSize ?? 'standard';
      const size = resolveMapSize(mapSize);

      // Reset state
      currentSavedMapId = null;

      // Generate map and resource node states
      mapData = generateMap(size, size, 'cyan');
      resourceNodes = createResourceNodeStates(mapData.resources);
      mapWidth = mapData.width;
      mapHeight = mapData.height;

      // Test hook: expose editor MapData for E2E tests
      (window as any).__editorMapData = mapData;

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

      // ── PR9: Save map button ────────────────────────────────────────
      const btnSaveMap = document.createElement('button');
      btnSaveMap.className = 'btn btn--tool editor-overlay__save-btn';
      btnSaveMap.id = 'editor-save-map-btn';
      btnSaveMap.textContent = 'Сохранить карту';
      btnSaveMap.addEventListener('click', () => {
        if (!mapData) return;
        try {
          const id = saveCustomMap(mapData, { id: currentSavedMapId ?? undefined });
          if (id !== null) {
            currentSavedMapId = id;
            showEditorStatus('Карта сохранена');
          } else {
            showEditorStatus('Не удалось сохранить карту', true);
          }
        } catch {
          showEditorStatus('Не удалось сохранить карту', true);
        }
        renderSavedMaps();
      });
      overlay.appendChild(btnSaveMap);

      // ── PR10: Launch game button ────────────────────────────────────
      const btnLaunchGame = document.createElement('button');
      btnLaunchGame.className = 'btn btn--tool editor-overlay__launch-btn';
      btnLaunchGame.id = 'editor-launch-game-btn';
      btnLaunchGame.textContent = 'Начать игру';
      btnLaunchGame.addEventListener('click', () => {
        if (!mapData) return;
        // Validate map before launch
        const result = validateEditorMap(mapData);
        if (!result.ok) {
          // Show validation errors and do not navigate
          lastValidation = result;
          renderValidationPanel(result);
          showEditorStatus('Карта невалидна — исправьте ошибки', true);
          return;
        }
        // Deep-clone MapData to prevent runtime mutations from reaching editor/saved map
        const cloned = deepCloneMapData(mapData);
        if (cloned === null) {
          showEditorStatus('Не удалось клонировать карту', true);
          return;
        }
        // Navigate to game screen with custom map data
        // Faction comes from mapData.hq.faction — NOT hardcoded
        const gameScreenData: GameScreenData = {
          mapSize: mapWidth === MAP_SIZE_LARGE ? 'large' : 'standard',
          faction: mapData.hq.faction,
          seed: 0,
          mapgenPresetId: 'balanced' as import('../game/mapgen-presets.js').MapgenPresetId,
          customMapData: cloned,
        };
        navigate('game-screen', gameScreenData);
      });
      overlay.appendChild(btnLaunchGame);

      // ── PR9: Editor status feedback ─────────────────────────────────
      editorStatusEl = document.createElement('div');
      editorStatusEl.className = 'editor-map-status';
      editorStatusEl.id = 'editor-map-status';
      editorStatusEl.dataset.visible = 'false';
      overlay.appendChild(editorStatusEl);

      // ── PR9: Saved maps list (collapsible) ─────────────────────────────
      const savedMapsSection = document.createElement('div');
      savedMapsSection.className = 'editor-saved-maps';
      savedMapsSection.id = 'editor-saved-maps';
      savedMapsSection.dataset.expanded = 'false'; // Start collapsed

      const savedMapsToggle = document.createElement('button');
      savedMapsToggle.className = 'editor-saved-maps__toggle';
      savedMapsToggle.id = 'editor-saved-maps-toggle';
      savedMapsToggle.textContent = 'Сохранённые карты ▾';
      savedMapsToggle.addEventListener('click', () => {
        const isExpanded = savedMapsSection.dataset.expanded === 'true';
        savedMapsSection.dataset.expanded = isExpanded ? 'false' : 'true';
        savedMapsToggle.textContent = isExpanded
          ? 'Сохранённые карты ▾'
          : 'Сохранённые карты ▴';
      });
      savedMapsSection.appendChild(savedMapsToggle);

      savedMapsListEl = document.createElement('div');
      savedMapsListEl.className = 'editor-saved-maps__list';
      savedMapsListEl.id = 'editor-saved-maps-list';
      savedMapsSection.appendChild(savedMapsListEl);

      overlay.appendChild(savedMapsSection);

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

      // PR9: Render saved maps list
      renderSavedMaps();

      // Asset Tuner (dev-only — load persisted overrides, create panel)
      if (isAssetTunerAllowed()) {
        loadOverrides();
        const tuner = createAssetTunerPanel();
        tuner.element.id = 'fe-asset-tuner';
        wrapper.appendChild(tuner.element);
        assetTunerDestroy = tuner.destroy;
      }

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
        editorPreviewRender(
          ctx,
          mapData,
          computeMapVisualSeed(mapData),
          camera,
          assets,
          resourceNodes ?? undefined,
          hover,
        );

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
      delete (window as any).__editorMapData;
      assets = null;

      // Asset Tuner cleanup
      if (assetTunerDestroy) {
        assetTunerDestroy();
        assetTunerDestroy = null;
      }
      mapData = null;
      resourceNodes = null;
      canvas = null;
      infoEl = null;
      statusEl = null;
      validationEl = null;
      paletteEl = null;
      toolBtns.clear();
      lastValidation = null;
      currentSavedMapId = null;
      savedMapsListEl = null;
      editorStatusEl = null;

      boundKeyDown = null;
      boundKeyUp = null;
      boundMouseDown = null;
      boundMouseMove = null;
      boundMouseUp = null;
      boundWheel = null;
      boundResize = null;
      boundContextMenu = null;

      if (editorStatusTimeout !== undefined) {
        clearTimeout(editorStatusTimeout);
        editorStatusTimeout = undefined;
      }
    },
  };
}
