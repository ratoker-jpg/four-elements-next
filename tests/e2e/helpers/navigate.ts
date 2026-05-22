/**
 * Shared E2E navigation helpers.
 *
 * Centralises the New Game flow so that screen insertion
 * (e.g. Seed Screen between Map Size and Faction Select)
 * only requires updating this file, not every spec.
 *
 * IMPORTANT: The seed parameter defaults to 42 so that map-dependent
 * E2E tests get a deterministic map every run.  Seed-flow tests that
 * deliberately exercise random-seed behaviour should pass an explicit
 * seed or bypass the helper.
 */

import { expect, type Page } from '@playwright/test';

/** Default deterministic seed for E2E tests — matches the pre-PR4 mapgen default. */
const DEFAULT_SEED = 42;

/**
 * Navigate from main menu through the full New Game flow to the game screen.
 * Flow: Main Menu → Map Size → Seed Screen → Faction Select → Game Screen.
 *
 * @param options.seed - Deterministic seed for map generation. Defaults to 42.
 *                       Pass `undefined` explicitly to leave the random prefilled value.
 */
export async function navigateToGameScreen(
  page: Page,
  options: {
    mapSize?: 'standard' | 'large';
    faction?: string;
    seed?: number | string;
  } = {},
): Promise<void> {
  const mapSize = options.mapSize ?? 'standard';
  const faction = options.faction ?? 'Голубые';
  const seed = options.seed ?? DEFAULT_SEED;

  await page.goto('/');
  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.getByRole('button', { name: mapSize === 'large' ? /Большая/ : /Стандартная/ }).click();

  // Seed screen — fill deterministic seed then click Далее
  await expect(page.locator('.screen--seed')).toBeVisible();
  await page.locator('#seed-input').fill(String(seed));
  await page.getByRole('button', { name: 'Далее' }).click();

  // Faction select
  await page.getByRole('button', { name: faction }).click();

  // Wait for game screen
  await expect(page.locator('.screen--game')).toBeVisible();
  await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
}

/**
 * Navigate to the seed screen (Main Menu → Map Size → Seed Screen).
 * Useful for testing seed screen behavior directly.
 *
 * @param options.seed - If provided, fills the seed input after arriving.
 *                       Defaults to undefined (leave the random prefilled value).
 */
export async function navigateToSeedScreen(
  page: Page,
  options: {
    mapSize?: 'standard' | 'large';
    seed?: number | string;
  } = {},
): Promise<void> {
  const mapSize = options.mapSize ?? 'standard';
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.getByRole('button', { name: mapSize === 'large' ? /Большая/ : /Стандартная/ }).click();
  await expect(page.locator('.screen--seed')).toBeVisible();

  if (options.seed !== undefined) {
    await page.locator('#seed-input').fill(String(options.seed));
  }
}
