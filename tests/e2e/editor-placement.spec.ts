import { test, expect } from '@playwright/test';

test.describe('MAP-EDITOR-ARCH-01 PR2 — Object palette + placement/removal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?devtools=1');
    await expect(page.locator('.screen--main-menu')).toBeVisible();
    await page.locator('#editor-menu-btn').click();
    await expect(page.locator('.screen--editor')).toBeVisible();
    await expect(page.locator('#editor-canvas')).toBeVisible();
  });

  test('editor opens with toolbar visible', async ({ page }) => {
    await expect(page.locator('#editor-toolbar')).toBeVisible();
    await expect(page.locator('#editor-tool-select')).toBeVisible();
    await expect(page.locator('#editor-tool-place')).toBeVisible();
    await expect(page.locator('#editor-tool-erase')).toBeVisible();
  });

  test('Place tool shows palette', async ({ page }) => {
    // Palette is hidden by default (select mode)
    await expect(page.locator('#editor-palette')).toBeHidden();

    // Click Place tool
    await page.locator('#editor-tool-place').click();

    // Palette becomes visible
    await expect(page.locator('#editor-palette')).toBeVisible();
    await expect(page.locator('#editor-palette')).toContainText('Ресурсы');
    await expect(page.locator('#editor-palette')).toContainText('Препятствия');
    await expect(page.locator('#editor-palette')).toContainText('Декор');
  });

  test('palette has all expected items with no volcano entries', async ({ page }) => {
    await page.locator('#editor-tool-place').click();
    await expect(page.locator('#editor-palette')).toBeVisible();

    // Check resource items
    await expect(page.locator('#editor-palette')).toContainText('Малый минерал');
    await expect(page.locator('#editor-palette')).toContainText('Средний минерал');
    await expect(page.locator('#editor-palette')).toContainText('Крупный минерал');
    await expect(page.locator('#editor-palette')).toContainText('Бесконечный минерал');

    // Check obstacle items
    await expect(page.locator('#editor-palette')).toContainText('Скалы');
    await expect(page.locator('#editor-palette')).toContainText('Малая гора');
    await expect(page.locator('#editor-palette')).toContainText('Средняя гора');
    await expect(page.locator('#editor-palette')).toContainText('Крупная гора');

    // Check decor items
    await expect(page.locator('#editor-palette')).toContainText('Куст');
    await expect(page.locator('#editor-palette')).toContainText('Песчаный холмик');

    // No volcano entries
    await expect(page.locator('#editor-palette')).not.toContainText('Вулкан');
  });

  test('place small resource and count increases', async ({ page }) => {
    // Get initial resource count
    const infoBefore = await page.locator('#editor-info').textContent();
    const resourceMatchBefore = infoBefore?.match(/Ресурсы:\s*(\d+)/);
    const countBefore = resourceMatchBefore ? parseInt(resourceMatchBefore[1]!, 10) : 0;

    // Activate Place tool
    await page.locator('#editor-tool-place').click();
    await expect(page.locator('#editor-palette')).toBeVisible();

    // Select "Малый минерал" (small resource)
    const smallMineralBtn = page.locator('#editor-palette .editor-palette__item', { hasText: 'Малый минерал' });
    await smallMineralBtn.click();

    // Wait for canvas to be ready, then click on it to place
    await page.waitForTimeout(500);
    const canvas = page.locator('#editor-canvas');
    // Click near top-left of canvas (avoiding the overlay and palette)
    const box = await canvas.boundingBox();
    if (box) {
      // Click at a position that's likely empty (near center-left of canvas)
      await canvas.click({ position: { x: box.width * 0.35, y: box.height * 0.4 } });
    }

    // Verify resource count increased
    const infoAfter = await page.locator('#editor-info').textContent();
    const resourceMatchAfter = infoAfter?.match(/Ресурсы:\s*(\d+)/);
    const countAfter = resourceMatchAfter ? parseInt(resourceMatchAfter[1]!, 10) : 0;
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  test('place rock-cluster and count increases', async ({ page }) => {
    // Get initial obstacle count
    const infoBefore = await page.locator('#editor-info').textContent();
    const obstacleMatchBefore = infoBefore?.match(/Препятствия:\s*(\d+)/);
    const countBefore = obstacleMatchBefore ? parseInt(obstacleMatchBefore[1]!, 10) : 0;

    // Activate Place tool
    await page.locator('#editor-tool-place').click();
    await expect(page.locator('#editor-palette')).toBeVisible();

    // Select "Скалы" (rock-cluster)
    const rockBtn = page.locator('#editor-palette .editor-palette__item', { hasText: 'Скалы' });
    await rockBtn.click();

    // Wait and click
    await page.waitForTimeout(500);
    const canvas = page.locator('#editor-canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await canvas.click({ position: { x: box.width * 0.35, y: box.height * 0.5 } });
    }

    // Verify obstacle count increased
    const infoAfter = await page.locator('#editor-info').textContent();
    const obstacleMatchAfter = infoAfter?.match(/Препятствия:\s*(\d+)/);
    const countAfter = obstacleMatchAfter ? parseInt(obstacleMatchAfter[1]!, 10) : 0;
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  test('invalid overlap is blocked — cannot place on same tile', async ({ page }) => {
    // Activate Place tool
    await page.locator('#editor-tool-place').click();
    await expect(page.locator('#editor-palette')).toBeVisible();

    // Select "Малый минерал"
    const smallMineralBtn = page.locator('#editor-palette .editor-palette__item', { hasText: 'Малый минерал' });
    await smallMineralBtn.click();

    // Place at a specific position
    await page.waitForTimeout(500);
    const canvas = page.locator('#editor-canvas');
    const box = await canvas.boundingBox();
    if (box) {
      const clickX = box.width * 0.35;
      const clickY = box.height * 0.45;

      // First placement should succeed
      await canvas.click({ position: { x: clickX, y: clickY } });

      // Get count after first placement
      const infoAfter1 = await page.locator('#editor-info').textContent();
      const matchAfter1 = infoAfter1?.match(/Ресурсы:\s*(\d+)/);
      const countAfter1 = matchAfter1 ? parseInt(matchAfter1[1]!, 10) : 0;

      // Second placement at exact same position should be blocked (overlap)
      await canvas.click({ position: { x: clickX, y: clickY } });

      // Count should not increase further
      const infoAfter2 = await page.locator('#editor-info').textContent();
      const matchAfter2 = infoAfter2?.match(/Ресурсы:\s*(\d+)/);
      const countAfter2 = matchAfter2 ? parseInt(matchAfter2[1]!, 10) : 0;
      expect(countAfter2).toBe(countAfter1);
    }
  });

  test('erase removes placed object and count decreases', async ({ page }) => {
    // First, place a resource
    await page.locator('#editor-tool-place').click();
    await expect(page.locator('#editor-palette')).toBeVisible();

    const smallMineralBtn = page.locator('#editor-palette .editor-palette__item', { hasText: 'Малый минерал' });
    await smallMineralBtn.click();

    await page.waitForTimeout(500);
    const canvas = page.locator('#editor-canvas');
    const box = await canvas.boundingBox();
    if (box) {
      const clickX = box.width * 0.35;
      const clickY = box.height * 0.4;

      // Place resource
      await canvas.click({ position: { x: clickX, y: clickY } });

      // Get count after placement
      const infoAfterPlace = await page.locator('#editor-info').textContent();
      const matchAfterPlace = infoAfterPlace?.match(/Ресурсы:\s*(\d+)/);
      const countAfterPlace = matchAfterPlace ? parseInt(matchAfterPlace[1]!, 10) : 0;

      // Switch to Erase tool
      await page.locator('#editor-tool-erase').click();

      // Click same position to erase
      await canvas.click({ position: { x: clickX, y: clickY } });

      // Count should decrease
      const infoAfterErase = await page.locator('#editor-info').textContent();
      const matchAfterErase = infoAfterErase?.match(/Ресурсы:\s*(\d+)/);
      const countAfterErase = matchAfterErase ? parseInt(matchAfterErase[1]!, 10) : 0;
      expect(countAfterErase).toBeLessThan(countAfterPlace);
    }
  });

  test('Back to Menu still works after using tools', async ({ page }) => {
    // Use Place tool first
    await page.locator('#editor-tool-place').click();
    await page.waitForTimeout(300);

    // Click back
    await page.locator('#editor-back-btn').click();
    await expect(page.locator('.screen--main-menu')).toBeVisible();
  });

  test('normal New Game flow still works after editor round-trip with tools', async ({ page }) => {
    // Use Place tool
    await page.locator('#editor-tool-place').click();
    await page.waitForTimeout(300);

    // Back to menu
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
