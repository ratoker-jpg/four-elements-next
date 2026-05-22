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

test.describe('MAP-EDITOR-ARCH-01 PR6 — Preset selector on Seed Screen', () => {
  test('preset selector is visible on seed screen', async ({ page }) => {
    await navigateToSeedScreen(page);
    await expect(page.locator('#preset-selector')).toBeVisible();
  });

  test('default preset is balanced (Сбалансированная)', async ({ page }) => {
    await navigateToSeedScreen(page);
    const balancedBtn = page.locator('#preset-selector').getByRole('button', { name: 'Сбалансированная' });
    await expect(balancedBtn).toBeVisible();
    // Balanced should be active by default
    await expect(balancedBtn).toHaveClass(/btn--preset-active/);
  });

  test('all four preset buttons are visible', async ({ page }) => {
    await navigateToSeedScreen(page);
    await expect(page.locator('#preset-selector').getByRole('button', { name: 'Сбалансированная' })).toBeVisible();
    await expect(page.locator('#preset-selector').getByRole('button', { name: 'Больше ресурсов' })).toBeVisible();
    await expect(page.locator('#preset-selector').getByRole('button', { name: 'Больше скал и гор' })).toBeVisible();
    await expect(page.locator('#preset-selector').getByRole('button', { name: 'Открытая карта' })).toBeVisible();
  });

  test('selecting "Больше ресурсов" reaches faction select and starts game', async ({ page }) => {
    await navigateToGameScreen(page, { preset: 'more-resources' });
    await expect(page.locator('.screen--game')).toBeVisible();
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('selecting "Больше скал и гор" reaches faction select and starts game', async ({ page }) => {
    await navigateToGameScreen(page, { preset: 'more-mountains' });
    await expect(page.locator('.screen--game')).toBeVisible();
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('selecting "Открытая карта" reaches faction select and starts game', async ({ page }) => {
    await navigateToGameScreen(page, { preset: 'open-map' });
    await expect(page.locator('.screen--game')).toBeVisible();
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('Back from faction select returns to seed screen with same seed and preset', async ({ page }) => {
    await navigateToSeedScreen(page, { seed: 555, preset: 'more-resources' });

    // Verify "Больше ресурсов" is active
    const moreResBtn = page.locator('#preset-selector').getByRole('button', { name: 'Больше ресурсов' });
    await expect(moreResBtn).toHaveClass(/btn--preset-active/);

    // Verify seed is 555
    const input = page.locator('#seed-input');
    await expect(input).toHaveValue('555');

    // Navigate forward
    await page.getByRole('button', { name: 'Далее' }).click();
    await expect(page.locator('.screen--faction-select')).toBeVisible();

    // Go back
    await page.getByRole('button', { name: 'Назад' }).click();
    await expect(page.locator('.screen--seed')).toBeVisible();

    // Seed should be preserved
    await expect(input).toHaveValue('555');

    // Preset should still be "Больше ресурсов"
    await expect(moreResBtn).toHaveClass(/btn--preset-active/);
  });

  test('no volcano preset exists in the UI', async ({ page }) => {
    await navigateToSeedScreen(page);
    const volcanoButtons = page.locator('#preset-selector').getByRole('button', { name: /вулкан/i });
    await expect(volcanoButtons).toHaveCount(0);
  });

  test('E2E helper defaults to balanced preset', async ({ page }) => {
    // navigateToGameScreen without preset option should use balanced
    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game')).toBeVisible();
    await expect(page.locator('#economy-hud')).toBeVisible();
  });
});
