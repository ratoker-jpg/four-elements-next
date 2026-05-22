/**
 * MAP-EDITOR-ARCH-01 PR4/PR6 — Seed selection screen with preset selector.
 *
 * Inserted between Map Size and Faction Select.
 * Shows a numeric seed input pre-filled with a random seed,
 * a "Случайный сид" button, and a mapgen preset selector.
 * User can type a custom seed, generate a new random seed,
 * select a preset, and continue.
 */

import type { Screen, ScreenTransitionData, SeedScreenData, FactionSelectData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';
import { MAPGEN_PRESETS, DEFAULT_PRESET_ID, PRESET_IDS, type MapgenPresetId } from '../game/mapgen-presets.js';

/** Generate a random positive integer seed (1–999999). */
function generateRandomSeed(): number {
  return Math.floor(Math.random() * 999999) + 1;
}

/** Clamp a seed value to a safe 32-bit integer range for mulberry32. */
function clampSeed(value: number): number {
  const MAX_SEED = 2147483647;
  if (!Number.isFinite(value) || value <= 0) return generateRandomSeed();
  return Math.min(Math.floor(value), MAX_SEED);
}

export function createSeedScreen(navigate: NavigateFn): Screen {
  return {
    id: 'seed-screen',

    mount(container: HTMLElement, data: ScreenTransitionData): void {
      const seedData = data as SeedScreenData | null;
      const mapSize = seedData?.mapSize ?? 'standard';
      // Preserve seed and preset on back navigation
      const incomingSeed = seedData?.seed;
      const incomingPreset = seedData?.mapgenPresetId ?? DEFAULT_PRESET_ID;

      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--seed';

      const card = document.createElement('section');
      card.className = 'menu-card';

      const heading = document.createElement('h2');
      heading.className = 'screen__heading';
      heading.textContent = 'Сид карты';
      card.appendChild(heading);

      const hint = document.createElement('p');
      hint.className = 'screen__hint';
      hint.textContent = 'Тот же сид + тот же размер = та же карта';
      card.appendChild(hint);

      const menu = document.createElement('div');
      menu.className = 'screen__menu';

      // Seed input field
      const inputRow = document.createElement('div');
      inputRow.className = 'seed-input-row';

      const input = document.createElement('input');
      input.className = 'seed-input';
      input.id = 'seed-input';
      input.type = 'text';
      input.inputMode = 'numeric';
      input.pattern = '[0-9]*';
      // Use incoming seed if returning from back navigation, otherwise generate random
      input.value = String(incomingSeed ?? generateRandomSeed());
      input.setAttribute('aria-label', 'Сид карты');

      // Strip non-numeric characters on input
      input.addEventListener('input', () => {
        const stripped = input.value.replace(/[^0-9]/g, '');
        if (stripped !== input.value) {
          input.value = stripped;
        }
      });

      inputRow.appendChild(input);

      // Random seed button
      const btnRandom = document.createElement('button');
      btnRandom.className = 'btn btn--random-seed';
      btnRandom.id = 'btn-random-seed';
      btnRandom.textContent = 'Случайный сид';
      btnRandom.addEventListener('click', () => {
        input.value = String(generateRandomSeed());
      });
      inputRow.appendChild(btnRandom);

      menu.appendChild(inputRow);

      // Preset selector
      const presetLabel = document.createElement('p');
      presetLabel.className = 'preset-label';
      presetLabel.textContent = 'Генерация карты';
      menu.appendChild(presetLabel);

      const presetGroup = document.createElement('div');
      presetGroup.className = 'preset-selector';
      presetGroup.id = 'preset-selector';

      let selectedPreset: MapgenPresetId = incomingPreset;

      for (const presetId of PRESET_IDS) {
        const preset = MAPGEN_PRESETS[presetId];
        const btn = document.createElement('button');
        btn.className = 'btn btn--preset';
        btn.dataset.presetId = presetId;
        btn.textContent = preset.label;
        if (presetId === selectedPreset) {
          btn.classList.add('btn--preset-active');
        }
        btn.addEventListener('click', () => {
          // Deselect all, then select this one
          for (const child of presetGroup.children) {
            if (child instanceof HTMLElement) {
              child.classList.remove('btn--preset-active');
            }
          }
          btn.classList.add('btn--preset-active');
          selectedPreset = presetId;
        });
        presetGroup.appendChild(btn);
      }

      menu.appendChild(presetGroup);

      // Continue button
      const btnContinue = document.createElement('button');
      btnContinue.className = 'btn';
      btnContinue.textContent = 'Далее';
      btnContinue.addEventListener('click', () => {
        // If input is empty, generate a new seed and fill it
        if (!input.value.trim()) {
          input.value = String(generateRandomSeed());
        }
        const seed = clampSeed(parseInt(input.value, 10));
        const factionData: FactionSelectData = { mapSize, seed, mapgenPresetId: selectedPreset };
        navigate('faction-select', factionData);
      });
      menu.appendChild(btnContinue);

      // Back button
      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back';
      btnBack.textContent = 'Назад';
      btnBack.addEventListener('click', () => navigate('map-size', { source: 'main-menu' }));
      menu.appendChild(btnBack);

      card.appendChild(menu);
      wrapper.appendChild(card);
      container.appendChild(wrapper);
    },

    unmount(): void {
      // DOM is cleared by ScreenManager
    },
  };
}
