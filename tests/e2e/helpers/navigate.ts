/**
 * Shared E2E navigation helpers.
 *
 * Centralises the New Game flow so that screen insertion
 * (e.g. Seed Screen between Map Size and Faction Select)
 * only requires updating this file, not every spec.
 */

import { expect, type Page } from '@playwright/test';

/**
 * Navigate from main menu through the full New Game flow to the game screen.
 * Flow: Main Menu → Map Size → Seed Screen → Faction Select → Game Screen.
 */
export async function navigateToGameScreen(
  page: Page,
  options: {
    mapSize?: 'standard' | 'large';
    faction?: string;
  } = {},
): Promise<void> {
  const mapSize = options.mapSize ?? 'standard';
  const faction = options.faction ?? 'Голубые';

  await page.goto('/');
  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.getByRole('button', { name: mapSize === 'large' ? /Большая/ : /Стандартная/ }).click();

  // Seed screen — click Далее with the default random seed
  await expect(page.locator('.screen--seed')).toBeVisible();
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
 */
export async function navigateToSeedScreen(
  page: Page,
  options: {
    mapSize?: 'standard' | 'large';
  } = {},
): Promise<void> {
  const mapSize = options.mapSize ?? 'standard';
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.getByRole('button', { name: mapSize === 'large' ? /Большая/ : /Стандартная/ }).click();
  await expect(page.locator('.screen--seed')).toBeVisible();
}
