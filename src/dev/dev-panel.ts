/**
 * DEV-SANDBOX-ARCH-01 — Dev panel shell + safe QA actions.
 *
 * Development/test-only overlay panel for fast QA.
 * Shows read-only game state info and provides safe QA action buttons.
 *
 * Availability:
 * - import.meta.env.DEV === true (vite dev server)
 * - import.meta.env.MODE === 'test' (E2E builds)
 * - URL query parameter ?devtools=1 (GitHub Pages / production)
 * - NOT available on production/GitHub Pages URLs without ?devtools=1.
 *
 * Toggle: backtick/tilde key (`).
 * Hidden by default.
 */

import type { ReadonlyEconomyState } from '../systems/economy.js';
import type { ReadonlyPowerState } from '../systems/power.js';
import type { ReadonlyControlState } from '../systems/control.js';
import type { GameState } from '../game/game-state.js';
import { getFactionElement, formatDisplayElements, ELEMENT_UNITS_PER_ELEMENT } from '../systems/economy.js';
import { countClaimedTiles } from '../systems/territory.js';
import { getOverlayToggles, setOverlayToggle, type OverlayToggles } from './dev-overlays.js';

// ── Types ──────────────────────────────────────────────────────────

/** State snapshot read by the dev panel. All fields are read-only. */
export interface DevPanelState {
  mapWidth: number;
  mapHeight: number;
  faction: string;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  economy: ReadonlyEconomyState;
  power: ReadonlyPowerState;
  control: ReadonlyControlState;
  /** Count of resource nodes on the map. */
  resourceCount: number;
  /** Count of obstacles on the map. */
  obstacleCount: number;
  /** Count of decor objects on the map. */
  decorCount: number;
  /** Count of buildings (completed, not construction sites). */
  buildingsCount: number;
  /** Count of builders. */
  buildersCount: number;
  /** Count of harvesters. */
  harvestersCount: number;
  /** Territory: claimed tile count. */
  territoryClaimed: number;
  /** Territory: source count. */
  territorySourceCount: number;
}

/** Actions exposed by GameWorld for the dev panel. */
export interface DevPanelActions {
  addRaw: (amount: number) => void;
  addMatter: (amount: number) => void;
  addElementUnits: (elementUnits: number) => void;
  fastForward: (seconds: number) => void;
  cameraToHq: () => void;
  cameraToCenter: () => void;
}

// ── Environment guard ──────────────────────────────────────────────

/** Whether the dev panel is allowed in the current build mode. */
export function isDevPanelAllowed(): boolean {
  if (import.meta.env.DEV === true) return true;
  if (import.meta.env.MODE === 'test') return true;
  // Allow on production/GitHub Pages when explicitly enabled via URL flag
  if (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('devtools') === '1') {
    return true;
  }
  return false;
}

// ── Panel state ────────────────────────────────────────────────────

let panelEl: HTMLDivElement | null = null;
let visible = false;
let keyInstalled = false;

// Section elements that need updating
let infoEl: HTMLDivElement | null = null;

// ── Public API ─────────────────────────────────────────────────────

/**
 * Create the dev panel overlay.
 * Returns the DOM element and an update function.
 * The panel is hidden by default.
 */
export function createDevPanel(actions: DevPanelActions): {
  element: HTMLElement;
  update: (state: DevPanelState) => void;
  toggle: () => void;
  isVisible: () => boolean;
  destroy: () => void;
} {
  panelEl = document.createElement('div');
  panelEl.className = 'fe-dev-panel';
  panelEl.dataset.visible = 'false';
  panelEl.style.display = 'none';

  // Header
  const header = document.createElement('div');
  header.className = 'fe-dev-panel__header';
  header.textContent = 'DEV PANEL (`)';
  panelEl.appendChild(header);

  // Info section
  infoEl = document.createElement('div');
  infoEl.className = 'fe-dev-panel__info';
  panelEl.appendChild(infoEl);

  // Actions section
  const actionsEl = document.createElement('div');
  actionsEl.className = 'fe-dev-panel__actions';

  // Resource buttons
  const resSection = makeSection('Resources');
  resSection.appendChild(makeActionBtn('+50 Raw', () => actions.addRaw(50)));
  resSection.appendChild(makeActionBtn('+50 Matter', () => actions.addMatter(50)));
  resSection.appendChild(makeActionBtn('+1 Element', () => actions.addElementUnits(ELEMENT_UNITS_PER_ELEMENT)));
  actionsEl.appendChild(resSection);

  // Fast-forward buttons
  const ffSection = makeSection('Fast-Forward');
  ffSection.appendChild(makeActionBtn('+10s', () => actions.fastForward(10)));
  ffSection.appendChild(makeActionBtn('+60s', () => actions.fastForward(60)));
  actionsEl.appendChild(ffSection);

  // Camera buttons
  const camSection = makeSection('Camera');
  camSection.appendChild(makeActionBtn('To HQ', () => actions.cameraToHq()));
  camSection.appendChild(makeActionBtn('To Center', () => actions.cameraToCenter()));
  actionsEl.appendChild(camSection);

  // Overlay toggles
  const overlaySection = makeSection('Overlays');
  const overlayKeys: Array<keyof OverlayToggles> = ['grid', 'footprints', 'resourceAmounts', 'obstacleBlocking', 'territoryDebug', 'hqToCenter', 'radii', 'spriteDebug'];
  const overlayLabels: Record<keyof OverlayToggles, string> = {
    grid: 'Grid',
    footprints: 'Footprints',
    resourceAmounts: 'Resources',
    obstacleBlocking: 'Blocking',
    territoryDebug: 'Territory',
    hqToCenter: 'HQ-Line',
    radii: 'Radii',
    spriteDebug: 'Sprite Debug',
  };
  for (const key of overlayKeys) {
    overlaySection.appendChild(makeToggleBtn(overlayLabels[key], key));
  }
  actionsEl.appendChild(overlaySection);

  panelEl.appendChild(actionsEl);

  // Install toggle key
  installToggleKey();

  const update = (state: DevPanelState) => {
    if (!infoEl) return;
    infoEl.innerHTML = renderInfo(state);
  };

  const toggle = () => {
    visible = !visible;
    if (panelEl) {
      panelEl.style.display = visible ? 'block' : 'none';
      panelEl.dataset.visible = visible ? 'true' : 'false';
    }
  };

  const isVisible = () => visible;

  const destroy = () => {
    removeToggleKey();
    if (panelEl && panelEl.parentNode) {
      panelEl.parentNode.removeChild(panelEl);
    }
    panelEl = null;
    infoEl = null;
    visible = false;
  };

  return { element: panelEl, update, toggle, isVisible, destroy };
}

// ── Info rendering ─────────────────────────────────────────────────

function renderInfo(s: DevPanelState): string {
  const activeEl = getFactionElement(s.economy, s.economy.faction as keyof typeof s.economy.resources.elements);
  const elDisplay = formatDisplayElements(activeEl);
  const elCapDisplay = formatDisplayElements(s.economy.resources.elementCap);

  const lines: string[] = [
    `<b>Map</b>: ${s.mapWidth}x${s.mapHeight} | <b>Faction</b>: ${s.faction}`,
    `<b>Camera</b>: (${s.cameraX.toFixed(0)}, ${s.cameraY.toFixed(0)}) zoom ${s.cameraZoom.toFixed(2)}`,
    `<b>Raw</b>: ${s.economy.resources.raw}/${s.economy.resources.rawCap}`,
    `<b>Matter</b>: ${s.economy.resources.matter}/${s.economy.resources.matterCap}`,
    `<b>Element</b>: ${elDisplay}/${elCapDisplay}`,
    `<b>Power</b>: ${s.power.netPower >= 0 ? '+' : ''}${s.power.netPower}`,
    `<b>Control</b>: ${s.control.used}/${s.control.current} (max ${s.control.cap})`,
    `<b>Resources</b>: ${s.resourceCount} | <b>Obstacles</b>: ${s.obstacleCount} | <b>Decor</b>: ${s.decorCount}`,
    `<b>Buildings</b>: ${s.buildingsCount} | <b>Builders</b>: ${s.buildersCount} | <b>Harvesters</b>: ${s.harvestersCount}`,
    `<b>Territory</b>: ${s.territoryClaimed} tiles, ${s.territorySourceCount} sources`,
  ];
  return lines.join('<br>');
}

// ── DOM helpers ────────────────────────────────────────────────────

function makeSection(title: string): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'fe-dev-panel__section';
  const label = document.createElement('div');
  label.className = 'fe-dev-panel__section-title';
  label.textContent = title;
  section.appendChild(label);
  const btnRow = document.createElement('div');
  btnRow.className = 'fe-dev-panel__btn-row';
  section.appendChild(btnRow);
  return section;
}

function makeActionBtn(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'fe-dev-panel__btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function makeToggleBtn(label: string, overlayKey: keyof OverlayToggles): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'fe-dev-panel__btn fe-dev-panel__btn--toggle';
  btn.dataset.overlayKey = overlayKey;
  btn.textContent = label;
  btn.dataset.active = String(getOverlayToggles()[overlayKey]);

  btn.addEventListener('click', () => {
    const current = getOverlayToggles()[overlayKey];
    setOverlayToggle(overlayKey, !current);
    btn.dataset.active = String(!current);
  });
  return btn;
}

// ── Toggle key (backtick) ──────────────────────────────────────────

function installToggleKey(): void {
  if (keyInstalled) return;
  keyInstalled = true;
  window.addEventListener('keydown', onToggleKey);
}

function removeToggleKey(): void {
  if (!keyInstalled) return;
  keyInstalled = false;
  window.removeEventListener('keydown', onToggleKey);
}

function onToggleKey(e: KeyboardEvent): void {
  if (e.repeat) return;
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() ?? '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (e.code === 'Backquote') {
    e.preventDefault();
    // Toggle is handled by GameWorld callback — publish event via custom detail
    // We use a simple global flag that GameWorld reads in its keydown handler.
    // Actually, the panel toggle is self-contained here:
    const panel = panelEl;
    if (!panel) return;
    visible = !visible;
    panel.style.display = visible ? 'block' : 'none';
    panel.dataset.visible = visible ? 'true' : 'false';
  }
}

// ── Helper to build DevPanelState from GameState + camera ──────────

export function buildDevPanelState(
  gameState: GameState,
  cameraX: number,
  cameraY: number,
  cameraZoom: number,
): DevPanelState {
  return {
    mapWidth: gameState.map.width,
    mapHeight: gameState.map.height,
    faction: gameState.map.hq.faction,
    cameraX,
    cameraY,
    cameraZoom,
    economy: gameState.economy,
    power: gameState.power,
    control: gameState.control,
    resourceCount: gameState.map.resources.length,
    obstacleCount: gameState.map.obstacles.length,
    decorCount: gameState.map.decor.length,
    buildingsCount: gameState.map.buildings.length,
    buildersCount: gameState.map.builders.length,
    harvestersCount: gameState.harvesters.length,
    territoryClaimed: countClaimedTiles(gameState.territory),
    territorySourceCount: gameState.territory.sources.length,
  };
}
