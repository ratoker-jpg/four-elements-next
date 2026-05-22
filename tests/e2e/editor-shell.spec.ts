import { test, expect } from '@playwright/test';

test.describe('MAP-EDITOR-ARCH-01 PR1 — Editor shell', () => {
  test('editor button is visible in test/dev mode', async ({ page }) => {
    // In MODE=test (E2E builds), isDevPanelAllowed() returns true,
    // so the editor button is visible. Production-only gating
    // (?devtools=1 requirement) cannot be verified in E2E test builds.
    await page.goto('/');
    await expect(page.locator('.screen--main-menu')).toBeVisible();
    await expect(page.locator('#editor-menu-btn')).toBeVisible();
  });

  test('editor button is also visible with ?devtools=1', async ({ page }) => {
    await page.goto('/?devtools=1');
    await expect(page.locator('.screen--main-menu')).toBeVisible();
    await expect(page.locator('#editor-menu-btn')).toBeVisible();
  });

  test('editor screen opens from main menu', async ({ page }) => {
    await page.goto('/?devtools=1');
    await expect(page.locator('#editor-menu-btn')).toBeVisible();
    await page.locator('#editor-menu-btn').click();
    await expect(page.locator('.screen--editor')).toBeVisible();
  });

  test('editor canvas renders map preview', async ({ page }) => {
    await page.goto('/?devtools=1');
    await page.locator('#editor-menu-btn').click();
    await expect(page.locator('.screen--editor')).toBeVisible();
    await expect(page.locator('#editor-canvas')).toBeVisible();

    // Wait for canvas to have rendered content (non-transparent pixels)
    await page.waitForTimeout(1500);
    const hasContent = await page.evaluate(() => {
      const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Check a sample of pixels for non-zero content
      let nonZero = 0;
      for (let i = 3; i < Math.min(data.data.length, 4000); i += 4) {
        if (data.data[i]! > 0) nonZero++;
      }
      return nonZero > 50;
    });
    expect(hasContent).toBe(true);
  });

  test('editor shows map info', async ({ page }) => {
    await page.goto('/?devtools=1');
    await page.locator('#editor-menu-btn').click();
    await expect(page.locator('.screen--editor')).toBeVisible();
    await expect(page.locator('#editor-info')).toBeVisible();
    // Should contain map size info like "48×48"
    await expect(page.locator('#editor-info')).toContainText('48');
  });

  test('Back to Menu works from editor', async ({ page }) => {
    await page.goto('/?devtools=1');
    await page.locator('#editor-menu-btn').click();
    await expect(page.locator('.screen--editor')).toBeVisible();
    await page.locator('#editor-back-btn').click();
    await expect(page.locator('.screen--main-menu')).toBeVisible();
  });

  test('normal new game flow still works after editor round-trip', async ({ page }) => {
    await page.goto('/?devtools=1');

    // Visit editor and come back
    await page.locator('#editor-menu-btn').click();
    await expect(page.locator('.screen--editor')).toBeVisible();
    await page.locator('#editor-back-btn').click();
    await expect(page.locator('.screen--main-menu')).toBeVisible();

    // Normal new game flow (now includes seed screen)
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await expect(page.locator('.screen--map-size')).toBeVisible();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await expect(page.locator('.screen--seed')).toBeVisible();
    await page.getByRole('button', { name: 'Далее' }).click();
    await expect(page.locator('.screen--faction-select')).toBeVisible();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await expect(page.locator('#game-canvas')).toBeVisible();
  });
});
