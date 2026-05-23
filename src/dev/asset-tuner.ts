/**
 * ENV-ASSET-TUNER-01 — Dev-only Asset Tuner / Calibration Panel.
 *
 * Allows live preview of temporary environment sprite profile overrides.
 * Overrides are NOT applied to SPRITE_PROFILES at runtime.
 * Overrides are NOT saved into MapData or custom map saves.
 *
 * Persistence: localStorage (dev-only, separate from custom map storage).
 * Guard: same as dev panel (DEV / test / ?devtools=1).
 * Toggle: key "9" when dev guard passes.
 */

import { SPRITE_PROFILES } from '../core/constants.js';
import type { SpriteProfile } from '../core/constants.js';
import type { EnvironmentProfileKey } from '../core/asset-variants.js';

// ── Types ──────────────────────────────────────────────────────────

/** Override values for a single profile key. All fields optional. */
export interface AssetTunerProfileOverride {
  sizeW?: number;
  sizeH?: number;
  groundOffset?: number;
  screenOffsetX?: number;
  screenOffsetY?: number;
}

/** Full override map: profile key → partial override. */
export type AssetTunerOverrides = Partial<Record<string, AssetTunerProfileOverride>>;

/** Profile keys tunable via the Asset Tuner. */
export const TUNABLE_PROFILE_KEYS: readonly EnvironmentProfileKey[] = [
  'mineral_small',
  'mineral_medium',
  'mineral_large',
  'mineral_infinite',
  'mountain_small_01',
  'mountain_medium_01',
  'mountain_large_01',
  'rock_cluster_small_01',
  'dry_bush_01',
  'sand_bump_01',
] as const;

// ── Override state ────────────────────────────────────────────────

let activeOverrides: AssetTunerOverrides = {};

/** Get the current active overrides (live reference — do not mutate). */
export function getActiveOverrides(): Readonly<AssetTunerOverrides> {
  return activeOverrides;
}

/** Set an override value for a profile key and field. */
export function setOverride(key: string, field: keyof AssetTunerProfileOverride, value: number): void {
  const existing = activeOverrides[key] ?? {};
  activeOverrides = {
    ...activeOverrides,
    [key]: { ...existing, [field]: value },
  };
  persistOverrides();
}

/** Reset overrides for a single profile key. */
export function resetOverride(key: string): void {
  const { [key]: _, ...rest } = activeOverrides;
  activeOverrides = rest;
  persistOverrides();
}

/** Reset all overrides. */
export function resetAllOverrides(): void {
  activeOverrides = {};
  persistOverrides();
}

// ── Merge logic ───────────────────────────────────────────────────

/** Merge base profile with override, returning an effective profile.
 *  Does NOT mutate the base SPRITE_PROFILES constant. */
export function mergeProfileWithOverride(
  base: Readonly<SpriteProfile>,
  override: AssetTunerProfileOverride | undefined,
): SpriteProfile {
  if (!override) return base;
  return {
    size: [
      override.sizeW ?? base.size[0],
      override.sizeH ?? base.size[1],
    ] as [number, number],
    groundOffset: override.groundOffset ?? base.groundOffset,
    ...(override.screenOffsetX !== undefined || base.screenOffsetX !== undefined
      ? { screenOffsetX: override.screenOffsetX ?? base.screenOffsetX ?? 0 }
      : {}),
    ...(override.screenOffsetY !== undefined || base.screenOffsetY !== undefined
      ? { screenOffsetY: override.screenOffsetY ?? base.screenOffsetY ?? 0 }
      : {}),
  };
}

/** Get the effective profile for a profile key, applying any active override.
 *  Falls back to base profile if key is not in SPRITE_PROFILES. */
export function getEffectiveProfile(key: string): SpriteProfile | undefined {
  const base = SPRITE_PROFILES[key as keyof typeof SPRITE_PROFILES] as SpriteProfile | undefined;
  if (!base) return undefined;
  const override = activeOverrides[key];
  return mergeProfileWithOverride(base, override);
}

// ── Config snippet ────────────────────────────────────────────────

/** Format a TypeScript config snippet for a profile key with its override values.
 *  Omits screenOffsetX/Y if they are zero. Output is ready to paste into SPRITE_PROFILES. */
export function formatConfigSnippet(key: string): string {
  const override = activeOverrides[key];
  const base = SPRITE_PROFILES[key as keyof typeof SPRITE_PROFILES] as SpriteProfile | undefined;
  if (!base) return '';
  const effective = mergeProfileWithOverride(base, override);

  const sizeW = effective.size[0];
  const sizeH = effective.size[1];
  const go = effective.groundOffset;
  const sox = effective.screenOffsetX ?? 0;
  const soy = effective.screenOffsetY ?? 0;

  const parts: string[] = [
    `size: [${sizeW}, ${sizeH}]`,
    `groundOffset: ${go}`,
  ];
  if (sox !== 0) parts.push(`screenOffsetX: ${sox}`);
  if (soy !== 0) parts.push(`screenOffsetY: ${soy}`);

  return `${key}: { ${parts.join(', ')} },`;
}

// ── localStorage persistence ──────────────────────────────────────

const STORAGE_KEY = 'four-elements-next.asset-tuner-overrides.v1';

/** Save overrides to localStorage. Fails safely on any error. */
function persistOverrides(): void {
  try {
    const json = JSON.stringify(activeOverrides);
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Silently ignore storage errors (quota, private mode, etc.)
  }
}

/** Load overrides from localStorage. Corrupt data resets to empty. */
export function loadOverrides(): AssetTunerOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      activeOverrides = {};
      return activeOverrides;
    }
    const parsed = JSON.parse(raw);
    // Basic shape validation: must be an object with optional nested objects
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      activeOverrides = {};
      persistOverrides();
      return activeOverrides;
    }
    // Validate each key's value is an object with number fields (or empty)
    const safe: AssetTunerOverrides = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val !== 'object' || val === null || Array.isArray(val)) continue;
      const entry: AssetTunerProfileOverride = {};
      let hasValidField = false;
      for (const [field, fieldVal] of Object.entries(val as Record<string, unknown>)) {
        if (field === 'sizeW' || field === 'sizeH' || field === 'groundOffset' ||
            field === 'screenOffsetX' || field === 'screenOffsetY') {
          if (typeof fieldVal === 'number') {
            (entry as Record<string, number>)[field] = fieldVal;
            hasValidField = true;
          }
        }
      }
      if (hasValidField) {
        safe[key] = entry;
      }
    }
    activeOverrides = safe;
  } catch {
    // Corrupt / malformed JSON — reset to empty
    activeOverrides = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Even removal failed — nothing to do
    }
  }
  return activeOverrides;
}

// ── Dev guard ─────────────────────────────────────────────────────

import { isDevPanelAllowed } from './dev-panel.js';

/** Whether the Asset Tuner is allowed in the current context.
 *  Uses the same guard as the dev panel. */
export function isAssetTunerAllowed(): boolean {
  return isDevPanelAllowed();
}

// ── Panel DOM ─────────────────────────────────────────────────────

let panelEl: HTMLDivElement | null = null;
let visible = false;
let keyInstalled = false;
let selectedKey: string = TUNABLE_PROFILE_KEYS[0]!;
let onUpdate: (() => void) | null = null;

/** Create the Asset Tuner overlay panel.
 *  Returns the DOM element and control methods. */
export function createAssetTunerPanel(): {
  element: HTMLElement;
  toggle: () => void;
  isVisible: () => boolean;
  destroy: () => void;
  setOnUpdate: (cb: () => void) => void;
} {
  panelEl = document.createElement('div');
  panelEl.className = 'fe-asset-tuner';
  panelEl.dataset.visible = 'false';
  panelEl.style.display = 'none';

  // Header with DEV ONLY label
  const header = document.createElement('div');
  header.className = 'fe-asset-tuner__header';
  header.innerHTML = 'ASSET TUNER <span class="fe-asset-tuner__dev-only">DEV ONLY</span>';
  panelEl.appendChild(header);

  // Profile key selector (dropdown)
  const selectorRow = document.createElement('div');
  selectorRow.className = 'fe-asset-tuner__row';

  const selectorLabel = document.createElement('label');
  selectorLabel.className = 'fe-asset-tuner__label';
  selectorLabel.textContent = 'Profile:';
  selectorLabel.setAttribute('for', 'fe-asset-tuner-select');

  const selector = document.createElement('select');
  selector.id = 'fe-asset-tuner-select';
  selector.className = 'fe-asset-tuner__select';
  for (const key of TUNABLE_PROFILE_KEYS) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    selector.appendChild(opt);
  }
  selector.value = selectedKey;
  selector.addEventListener('change', () => {
    selectedKey = selector.value;
    refreshPanel();
  });

  selectorRow.appendChild(selectorLabel);
  selectorRow.appendChild(selector);
  panelEl.appendChild(selectorRow);

  // Info section (profile key, base values, override values)
  const infoEl = document.createElement('div');
  infoEl.className = 'fe-asset-tuner__info';
  infoEl.id = 'fe-asset-tuner-info';
  panelEl.appendChild(infoEl);

  // Controls section
  const controlsEl = document.createElement('div');
  controlsEl.className = 'fe-asset-tuner__controls';
  controlsEl.id = 'fe-asset-tuner-controls';
  panelEl.appendChild(controlsEl);

  // Action buttons
  const actionsEl = document.createElement('div');
  actionsEl.className = 'fe-asset-tuner__actions';

  const btnResetSelected = document.createElement('button');
  btnResetSelected.className = 'fe-asset-tuner__btn';
  btnResetSelected.textContent = 'Reset Selected';
  btnResetSelected.addEventListener('click', () => {
    resetOverride(selectedKey);
    refreshPanel();
  });

  const btnResetAll = document.createElement('button');
  btnResetAll.className = 'fe-asset-tuner__btn';
  btnResetAll.textContent = 'Reset All';
  btnResetAll.addEventListener('click', () => {
    resetAllOverrides();
    refreshPanel();
  });

  const btnCopySnippet = document.createElement('button');
  btnCopySnippet.className = 'fe-asset-tuner__btn fe-asset-tuner__btn--copy';
  btnCopySnippet.textContent = 'Copy Config Snippet';
  btnCopySnippet.addEventListener('click', () => {
    const snippet = formatConfigSnippet(selectedKey);
    if (snippet) {
      navigator.clipboard.writeText(snippet).catch(() => {
        // Fallback: no notification, clipboard API may be unavailable
      });
    }
  });

  actionsEl.appendChild(btnResetSelected);
  actionsEl.appendChild(btnResetAll);
  actionsEl.appendChild(btnCopySnippet);
  panelEl.appendChild(actionsEl);

  // Initial render
  refreshPanel();

  // Install toggle key
  installToggleKey();

  return {
    element: panelEl,
    toggle: () => {
      visible = !visible;
      if (panelEl) {
        panelEl.style.display = visible ? 'block' : 'none';
        panelEl.dataset.visible = visible ? 'true' : 'false';
      }
    },
    isVisible: () => visible,
    destroy: () => {
      removeToggleKey();
      if (panelEl && panelEl.parentNode) {
        panelEl.parentNode.removeChild(panelEl);
      }
      panelEl = null;
      visible = false;
      onUpdate = null;
    },
    setOnUpdate: (cb: () => void) => {
      onUpdate = cb;
    },
  };
}

// ── Panel refresh ─────────────────────────────────────────────────

function refreshPanel(): void {
  if (!panelEl) return;

  const key = selectedKey;
  const baseRaw = SPRITE_PROFILES[key as keyof typeof SPRITE_PROFILES];
  const base = baseRaw as SpriteProfile | undefined;
  const override = activeOverrides[key];
  const effective = getEffectiveProfile(key);

  // Update info
  const infoEl = panelEl.querySelector('#fe-asset-tuner-info') as HTMLDivElement | null;
  if (infoEl && base) {
    const lines: string[] = [];
    lines.push(`<b>Key:</b> ${key}`);
    lines.push(`<b>Base:</b> [${base.size[0]}, ${base.size[1]}] off=${base.groundOffset} sox=${base.screenOffsetX ?? 0} soy=${base.screenOffsetY ?? 0}`);
    if (override) {
      const parts: string[] = [];
      if (override.sizeW !== undefined) parts.push(`W=${override.sizeW}`);
      if (override.sizeH !== undefined) parts.push(`H=${override.sizeH}`);
      if (override.groundOffset !== undefined) parts.push(`go=${override.groundOffset}`);
      if (override.screenOffsetX !== undefined) parts.push(`sox=${override.screenOffsetX}`);
      if (override.screenOffsetY !== undefined) parts.push(`soy=${override.screenOffsetY}`);
      lines.push(`<b>Override:</b> ${parts.join(' ')}`);
    } else {
      lines.push(`<b>Override:</b> (none)`);
    }
    if (effective) {
      lines.push(`<b>Effective:</b> [${effective.size[0]}, ${effective.size[1]}] off=${effective.groundOffset} sox=${effective.screenOffsetX ?? 0} soy=${effective.screenOffsetY ?? 0}`);
    }
    infoEl.innerHTML = lines.join('<br>');
  }

  // Update controls
  const controlsEl = panelEl.querySelector('#fe-asset-tuner-controls') as HTMLDivElement | null;
  if (controlsEl) {
    controlsEl.innerHTML = '';
    if (base) {
      const fields: Array<{ label: string; field: keyof AssetTunerProfileOverride; current: number }> = [
        { label: 'sizeW', field: 'sizeW', current: effective?.size[0] ?? base.size[0] },
        { label: 'sizeH', field: 'sizeH', current: effective?.size[1] ?? base.size[1] },
        { label: 'groundOffset', field: 'groundOffset', current: effective?.groundOffset ?? base.groundOffset },
        { label: 'screenOffsetX', field: 'screenOffsetX', current: effective?.screenOffsetX ?? base.screenOffsetX ?? 0 },
        { label: 'screenOffsetY', field: 'screenOffsetY', current: effective?.screenOffsetY ?? base.screenOffsetY ?? 0 },
      ];

      for (const f of fields) {
        const row = document.createElement('div');
        row.className = 'fe-asset-tuner__control-row';

        const lbl = document.createElement('span');
        lbl.className = 'fe-asset-tuner__control-label';
        lbl.textContent = f.label;

        const valSpan = document.createElement('span');
        valSpan.className = 'fe-asset-tuner__control-value';
        valSpan.textContent = String(f.current);

        const btnMinus4 = document.createElement('button');
        btnMinus4.className = 'fe-asset-tuner__btn fe-asset-tuner__btn--small';
        btnMinus4.textContent = '-4';
        btnMinus4.addEventListener('click', () => {
          setOverride(key, f.field, f.current - 4);
          refreshPanel();
          onUpdate?.();
        });

        const btnMinus1 = document.createElement('button');
        btnMinus1.className = 'fe-asset-tuner__btn fe-asset-tuner__btn--small';
        btnMinus1.textContent = '-1';
        btnMinus1.addEventListener('click', () => {
          setOverride(key, f.field, f.current - 1);
          refreshPanel();
          onUpdate?.();
        });

        const btnPlus1 = document.createElement('button');
        btnPlus1.className = 'fe-asset-tuner__btn fe-asset-tuner__btn--small';
        btnPlus1.textContent = '+1';
        btnPlus1.addEventListener('click', () => {
          setOverride(key, f.field, f.current + 1);
          refreshPanel();
          onUpdate?.();
        });

        const btnPlus4 = document.createElement('button');
        btnPlus4.className = 'fe-asset-tuner__btn fe-asset-tuner__btn--small';
        btnPlus4.textContent = '+4';
        btnPlus4.addEventListener('click', () => {
          setOverride(key, f.field, f.current + 4);
          refreshPanel();
          onUpdate?.();
        });

        row.appendChild(lbl);
        row.appendChild(btnMinus4);
        row.appendChild(btnMinus1);
        row.appendChild(valSpan);
        row.appendChild(btnPlus1);
        row.appendChild(btnPlus4);
        controlsEl.appendChild(row);
      }
    }
  }
}

// ── Toggle key (digit 9) ──────────────────────────────────────────

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
  if (!isAssetTunerAllowed()) return;
  if (e.repeat) return;
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() ?? '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (e.code === 'Digit9') {
    e.preventDefault();
    const panel = panelEl;
    if (!panel) return;
    visible = !visible;
    panel.style.display = visible ? 'block' : 'none';
    panel.dataset.visible = visible ? 'true' : 'false';
  }
}
