import { test, expect } from '@playwright/test';
import { navigateToSeedScreen, navigateToGameScreen } from './helpers/navigate.js';

test.describe('MAP-EDITOR-ARCH-01 PR8 — Saved seeds', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('empty state shows "Нет сохранённых сидов"', async ({ page }) => {
    await navigateToSeedScreen(page);
    await expect(page.locator('.saved-seeds-empty')).toBeVisible();
    await expect(page.locator('.saved-seeds-empty')).toHaveText('Нет сохранённых сидов');
  });

  test('save current seed creates an entry', async ({ page }) => {
    await navigateToSeedScreen(page, { seed: 777 });
    await page.getByRole('button', { name: 'Сохранить сид' }).click();

    // Entry should appear
    const entry = page.locator('.saved-seed-entry').first();
    await expect(entry).toBeVisible();
    await expect(entry.locator('.saved-seed-entry__seed')).toHaveText('777');
  });

  test('entry displays seed + current map size + preset label', async ({ page }) => {
    await navigateToSeedScreen(page, { seed: 123, preset: 'more-resources' });
    await page.getByRole('button', { name: 'Сохранить сид' }).click();

    const entry = page.locator('.saved-seed-entry').first();
    await expect(entry).toBeVisible();
    await expect(entry.locator('.saved-seed-entry__seed')).toHaveText('123');
    await expect(entry.locator('.saved-seed-entry__size')).toHaveText('Стандартная');
    await expect(entry.locator('.saved-seed-entry__preset')).toHaveText('Больше ресурсов');
  });

  test('click saved entry fills seed and selected preset', async ({ page }) => {
    // Save a seed with more-resources preset
    await navigateToSeedScreen(page, { seed: 999, preset: 'more-resources' });
    await page.getByRole('button', { name: 'Сохранить сид' }).click();

    // Change the current seed input to something else
    await page.locator('#seed-input').fill('555');

    // Click the seed text in the saved entry to load it (avoid the delete button)
    const seedText = page.locator('.saved-seed-entry__seed').first();
    await seedText.click();

    // Seed input should now be 999
    await expect(page.locator('#seed-input')).toHaveValue('999');

    // Preset should be "Больше ресурсов"
    const moreResBtn = page.locator('#preset-selector').getByRole('button', { name: 'Больше ресурсов' });
    await expect(moreResBtn).toHaveClass(/btn--preset-active/);
  });

  test('delete removes entry', async ({ page }) => {
    await navigateToSeedScreen(page, { seed: 42 });
    await page.getByRole('button', { name: 'Сохранить сид' }).click();
    await expect(page.locator('.saved-seed-entry')).toHaveCount(1);

    // Click delete button
    await page.locator('.btn--delete-seed').first().click();

    // Entry should be gone, empty state should appear
    await expect(page.locator('.saved-seed-entry')).toHaveCount(0);
    await expect(page.locator('.saved-seeds-empty')).toBeVisible();
  });

  test('duplicate save creates one row and moves it to top', async ({ page }) => {
    // Save seed 100 with balanced
    await navigateToSeedScreen(page, { seed: 100, preset: 'balanced' });
    await page.getByRole('button', { name: 'Сохранить сид' }).click();

    // Save a different seed 200
    await page.locator('#seed-input').fill('200');
    await page.getByRole('button', { name: 'Сохранить сид' }).click();

    // Should have 2 entries, 200 on top
    await expect(page.locator('.saved-seed-entry')).toHaveCount(2);
    const seeds = page.locator('.saved-seed-entry__seed');
    await expect(seeds.nth(0)).toHaveText('200');
    await expect(seeds.nth(1)).toHaveText('100');

    // Save 100 again (duplicate) — should move to top, still 2 entries
    await page.locator('#seed-input').fill('100');
    await page.getByRole('button', { name: 'Сохранить сид' }).click();

    await expect(page.locator('.saved-seed-entry')).toHaveCount(2);
    await expect(page.locator('.saved-seed-entry__seed').first()).toHaveText('100');
  });

  test('saved seeds are filtered by current mapSize', async ({ page }) => {
    // Save a standard seed
    await navigateToSeedScreen(page, { seed: 10, mapSize: 'standard' });
    await page.getByRole('button', { name: 'Сохранить сид' }).click();

    // Go back and select large map size
    await page.getByRole('button', { name: 'Назад' }).click();
    await expect(page.locator('.screen--map-size')).toBeVisible();
    await page.getByRole('button', { name: /Большая/ }).click();

    // On seed screen with large — should show empty (no large seeds saved)
    await expect(page.locator('.screen--seed')).toBeVisible();
    await expect(page.locator('.saved-seeds-empty')).toBeVisible();
    await expect(page.locator('.saved-seed-entry')).toHaveCount(0);
  });

  test('corrupt localStorage does not crash Seed Screen', async ({ page }) => {
    // Inject corrupt data
    await page.evaluate(() => {
      localStorage.setItem('four-elements-next.saved-seeds.v1', '{invalid json!!!');
    });

    await navigateToSeedScreen(page);
    // Screen should load without crashing
    await expect(page.locator('.screen--seed')).toBeVisible();
    // Should show empty state (corrupt data ignored)
    await expect(page.locator('.saved-seeds-empty')).toBeVisible();
  });

  test('normal New Game flow still works', async ({ page }) => {
    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game')).toBeVisible();
    await expect(page.locator('#economy-hud')).toBeVisible();
  });
});
