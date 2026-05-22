import { test, expect } from '@playwright/test';
import { navigateToGameScreen } from './helpers/navigate.js';

test.describe('NEXT-04 power and control', () => {

  test('economy HUD now shows 5 items + separator', async ({ page }) => {
    await navigateToGameScreen(page);
    const items = page.locator('.economy-hud__item');
    await expect(items).toHaveCount(5);
  });

  test('economy HUD labels include Энергия and Контроль', async ({ page }) => {
    await navigateToGameScreen(page);
    const labels = page.locator('.economy-hud__label');
    await expect(labels.nth(0)).toHaveText('Сырьё');
    await expect(labels.nth(1)).toHaveText('Материя');
    await expect(labels.nth(2)).toHaveText('Голубой элемент');
    await expect(labels.nth(3)).toHaveText('Энергия');
    await expect(labels.nth(4)).toHaveText('Контроль');
  });

  test('power state shows correct supply and demand', async ({ page }) => {
    await navigateToGameScreen(page);
    const powerState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__powerState as {
        totalSupply: number;
        totalDemand: number;
        netPower: number;
        buildings: Array<{ tx: number; ty: number; type: string; online: boolean }>;
      } | null;
    });
    expect(powerState).not.toBeNull();
    // HQ (supply=2) only, no starting buildings
    expect(powerState!.totalSupply).toBe(2);
    expect(powerState!.totalDemand).toBe(0);
    expect(powerState!.netPower).toBe(2);
  });

  test('control state shows 10 with HQ only (no relays)', async ({ page }) => {
    await navigateToGameScreen(page);
    const controlState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__controlState as {
        current: number;
        cap: number;
        used: number;
      } | null;
    });
    expect(controlState).not.toBeNull();
    expect(controlState!.current).toBe(10); // HQ(10), no relays
    expect(controlState!.cap).toBe(50);
    expect(controlState!.used).toBe(3); // 1 builder + 2 harvesters
  });

  test('power HUD shows net power as +2', async ({ page }) => {
    await navigateToGameScreen(page);
    const powerValue = page.locator('.economy-hud__item--power .economy-hud__value');
    await expect(powerValue).toHaveText('+2');
  });

  test('control HUD shows used/current control', async ({ page }) => {
    await navigateToGameScreen(page);
    const controlValue = page.locator('.economy-hud__item--control .economy-hud__value');
    await expect(controlValue).toHaveText('3/10');
  });

  test('all buildings are online at game start', async ({ page }) => {
    await navigateToGameScreen(page);
    const powerState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__powerState as {
        buildings: Array<{ type: string; online: boolean }>;
      } | null;
    });
    for (const b of powerState!.buildings) {
      expect(b.online).toBe(true);
    }
  });

  test('Back to menu cleans up power and control state', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.getByRole('button', { name: 'В главное меню' }).click();
    await expect(page.locator('.screen--main-menu')).toBeVisible();
    const powerState = await page.evaluate(() => (window as Record<string, unknown>).__powerState);
    const controlState = await page.evaluate(() => (window as Record<string, unknown>).__controlState);
    expect(powerState).toBeUndefined();
    expect(controlState).toBeUndefined();
  });

  test('no critical console errors with power+control', async ({ page }) => {
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
