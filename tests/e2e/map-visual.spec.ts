import { test, expect } from '@playwright/test';

test.describe('NEXT-02 map visual baseline', () => {
  async function navigateToGameScreen(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
  }

  test('Canvas is visible with correct dimensions', async ({ page }) => {
    await navigateToGameScreen(page);

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    const hasValidSize = await page.evaluate(() => {
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      if (!canvas) return false;
      return canvas.width > 0 && canvas.height > 0;
    });
    expect(hasValidSize).toBe(true);
  });

  test('no critical console errors after game screen loads', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await navigateToGameScreen(page);
    await page.waitForTimeout(500);
    const critical = errors.filter((e) => !e.includes('favicon'));
    expect(critical.length).toBeLessThanOrEqual(0);
  });

  test('camera responds to keyboard pan (WASD)', async ({ page }) => {
    await navigateToGameScreen(page);

    const cameraBefore = await page.evaluate(() => {
      return (window as Record<string, unknown>).__cameraPos as { x: number; y: number } | null;
    });

    const canvas = page.locator('#game-canvas');
    await canvas.click();
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');

    const cameraAfter = await page.evaluate(() => {
      return (window as Record<string, unknown>).__cameraPos as { x: number; y: number } | null;
    });

    expect(cameraAfter).not.toBeNull();
    expect(cameraBefore).not.toBeNull();
    expect(cameraAfter!.y).toBeLessThan(cameraBefore!.y);
  });

  test('Back to menu still works from game screen', async ({ page }) => {
    await navigateToGameScreen(page);

    await page.getByRole('button', { name: 'В главное меню' }).click();
    await expect(page.locator('.screen--main-menu')).toBeVisible();
  });

  test('no window.FE_* globals', async ({ page }) => {
    await navigateToGameScreen(page);

    const feGlobals = await page.evaluate(() => {
      return Object.keys(window).filter((k) => k.startsWith('FE_'));
    });
    expect(feGlobals).toEqual([]);
  });

  test('different factions render correctly', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Зелёные' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
  });
});
