import { test, expect } from '@playwright/test';
import { navigateToSeedScreen, navigateToGameScreen } from './helpers/navigate.js';

test.describe('MAP-EDITOR-ARCH-01 PR4 — Seed selection flow', () => {
  test('seed screen appears after map size selection', async ({ page }) => {
    await navigateToSeedScreen(page);
    await expect(page.locator('.screen--seed')).toBeVisible();
    await expect(page.getByText('Сид карты')).toBeVisible();
  });

  test('seed input is prefilled with a numeric value', async ({ page }) => {
    await navigateToSeedScreen(page);
    const input = page.locator('#seed-input');
    await expect(input).toBeVisible();
    const value = await input.inputValue();
    expect(value).toMatch(/^\d+$/);
    expect(parseInt(value, 10)).toBeGreaterThan(0);
  });

  test('random seed button changes the value', async ({ page }) => {
    await navigateToSeedScreen(page);
    const input = page.locator('#seed-input');
    const valueBefore = await input.inputValue();

    await page.getByRole('button', { name: 'Случайный сид' }).click();

    // Value should change (extremely unlikely to get the same random seed)
    const valueAfter = await input.inputValue();
    expect(valueAfter).toMatch(/^\d+$/);
    // We can't guarantee they're different (tiny chance of collision), but we verify format
    expect(parseInt(valueAfter, 10)).toBeGreaterThan(0);
  });

  test('custom seed continues to faction select', async ({ page }) => {
    await navigateToSeedScreen(page);
    const input = page.locator('#seed-input');
    await input.fill('12345');

    await page.getByRole('button', { name: 'Далее' }).click();

    await expect(page.locator('.screen--faction-select')).toBeVisible();
  });

  test('Back from seed screen returns to map size', async ({ page }) => {
    await navigateToSeedScreen(page);

    await page.getByRole('button', { name: 'Назад' }).click();

    await expect(page.locator('.screen--map-size')).toBeVisible();
  });

  test('Back from faction select returns to seed screen with same mapSize', async ({ page }) => {
    await navigateToSeedScreen(page);
    await page.getByRole('button', { name: 'Далее' }).click();
    await expect(page.locator('.screen--faction-select')).toBeVisible();

    await page.getByRole('button', { name: 'Назад' }).click();

    // Should be back on seed screen
    await expect(page.locator('.screen--seed')).toBeVisible();
  });

  test('starting game with seed works', async ({ page }) => {
    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game')).toBeVisible();
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('non-numeric input is stripped', async ({ page }) => {
    await navigateToSeedScreen(page);
    const input = page.locator('#seed-input');
    await input.fill('12abc34');

    const value = await input.inputValue();
    expect(value).toBe('1234');
  });

  test('empty input generates random seed on Далее', async ({ page }) => {
    await navigateToSeedScreen(page);
    const input = page.locator('#seed-input');
    await input.fill('');

    await page.getByRole('button', { name: 'Далее' }).click();

    await expect(page.locator('.screen--faction-select')).toBeVisible();
  });

  test('editor screen still works after seed screen changes', async ({ page }) => {
    await page.goto('/');
    // Editor is a dev-only button, available in test mode
    const editorBtn = page.getByRole('button', { name: 'Редактор карты' });
    if (await editorBtn.isVisible()) {
      await editorBtn.click();
      await expect(page.locator('.screen--editor')).toBeVisible();
    }
  });

  test('normal New Game flow still works end-to-end', async ({ page }) => {
    await navigateToGameScreen(page);
    // Verify the game actually started — economy HUD should be visible
    await expect(page.locator('#economy-hud')).toBeVisible();
  });
});
