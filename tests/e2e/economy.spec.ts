import { test, expect } from '@playwright/test';
import { navigateToGameScreen } from './helpers/navigate.js';

test.describe('NEXT-03 economy baseline', () => {

  test('economy HUD is visible', async ({ page }) => {
    await navigateToGameScreen(page);
    await expect(page.locator('#economy-hud')).toBeVisible();
  });

  test('economy HUD shows three resource items', async ({ page }) => {
    await navigateToGameScreen(page);
    const items = page.locator('.economy-hud__item');
    // 3 resource items + 2 power/control items = 5
    await expect(items).toHaveCount(5);
  });

  test('economy HUD shows correct starting resources (elementUnits displayed as elements)', async ({ page }) => {
    await navigateToGameScreen(page);
    const values = page.locator('.economy-hud__value');
    await expect(values.nth(0)).toHaveText('30/200');
    await expect(values.nth(1)).toHaveText('120/200');
    // Element display: 30 elementUnits → "3.0", 200 elementUnits cap → "20.0"
    await expect(values.nth(2)).toHaveText('3.0/20.0');
  });

  test('economy HUD labels are in Russian and show active faction element', async ({ page }) => {
    await navigateToGameScreen(page);
    const labels = page.locator('.economy-hud__label');
    await expect(labels.nth(0)).toHaveText('Сырьё');
    await expect(labels.nth(1)).toHaveText('Материя');
    await expect(labels.nth(2)).toHaveText('Голубой элемент');
  });

  test('economy state stores four faction elements (elementUnits)', async ({ page }) => {
    await navigateToGameScreen(page);
    const economyState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as {
        faction: string;
        raw: number;
        matter: number;
        elements: Record<string, number>;
        activeElement: number;
        rawCap: number;
        matterCap: number;
        elementCap: number;
      } | null;
    });
    expect(economyState).not.toBeNull();
    expect(economyState!.faction).toBe('cyan');
    expect(economyState!.raw).toBe(30);
    expect(economyState!.matter).toBe(120);
    // Elements stored in elementUnits: 30 units = 3.0 displayed elements
    expect(economyState!.elements).toEqual({ cyan: 30, green: 0, yellow: 0, purple: 0 });
    expect(economyState!.activeElement).toBe(30); // 30 elementUnits
    expect(economyState!.rawCap).toBe(200);
    expect(economyState!.matterCap).toBe(200);
    expect(economyState!.elementCap).toBe(200); // 200 elementUnits = 20 displayed elements
  });

  test('green faction starts with green element only (elementUnits)', async ({ page }) => {
    await navigateToGameScreen(page, { faction: 'Зелёные' });

    await expect(page.locator('.economy-hud__label').nth(2)).toHaveText('Зелёный элемент');
    const economyState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as {
        faction: string;
        elements: Record<string, number>;
        activeElement: number;
      } | null;
    });
    expect(economyState!.faction).toBe('green');
    // Elements stored in elementUnits: 30 units = 3.0 displayed elements
    expect(economyState!.elements).toEqual({ cyan: 0, green: 30, yellow: 0, purple: 0 });
    expect(economyState!.activeElement).toBe(30); // 30 elementUnits
  });

  test('separator state is empty at game start (no separators)', async ({ page }) => {
    await navigateToGameScreen(page);
    const economyState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as {
        separators: Array<{ tx: number; ty: number; progress: number; active: boolean }>;
      } | null;
    });
    expect(economyState).not.toBeNull();
    expect(economyState!.separators).toHaveLength(0);
  });

  test('separator list stays empty with no raw and no separators', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.waitForTimeout(3000);
    const economyState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as {
        separators: Array<{ active: boolean; progress: number }>;
      } | null;
    });
    expect(economyState!.separators).toHaveLength(0);
  });

  test('economy HUD does not interfere with camera pan', async ({ page }) => {
    await navigateToGameScreen(page);
    const cameraBefore = await page.evaluate(() => {
      return (window as Record<string, unknown>).__cameraPos as { x: number; y: number };
    });
    const canvas = page.locator('#game-canvas');
    await canvas.click();
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    const cameraAfter = await page.evaluate(() => {
      return (window as Record<string, unknown>).__cameraPos as { x: number; y: number };
    });
    expect(cameraAfter.y).toBeLessThan(cameraBefore.y);
  });

  test('Back to menu cleans up economy state', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.getByRole('button', { name: 'В главное меню' }).click();
    await expect(page.locator('.screen--main-menu')).toBeVisible();
    const economyState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState;
    });
    expect(economyState).toBeUndefined();
  });

  test('no critical console errors with economy', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await navigateToGameScreen(page);
    await page.waitForTimeout(500);
    const critical = errors.filter((e) => !e.includes('favicon'));
    expect(critical).toEqual([]);
  });
});
