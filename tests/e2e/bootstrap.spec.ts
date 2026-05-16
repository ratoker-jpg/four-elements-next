import { test, expect } from '@playwright/test';

test.describe('NEXT-01 bootstrap flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads without critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForTimeout(500);
    const critical = errors.filter((e) => !e.includes('favicon'));
    expect(critical).toEqual([]);
  });

  test('main menu is visible', async ({ page }) => {
    await expect(page.locator('.screen--main-menu')).toBeVisible();
    await expect(page.locator('.screen__title')).toHaveText('Четыре элемента');
    await expect(page.getByRole('button', { name: 'Новая игра' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Настройки' })).toBeVisible();
  });

  test('Continue is disabled', async ({ page }) => {
    const continueBtn = page.getByRole('button', { name: 'Продолжить' });
    await expect(continueBtn).toBeDisabled();
  });

  test('New Game opens map size screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await expect(page.locator('.screen--map-size')).toBeVisible();
  });

  test('Standard and Large are visible on map size screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await expect(page.getByRole('button', { name: /Стандартная/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Большая/ })).toBeVisible();
  });

  test('Back from map screen works', async ({ page }) => {
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await expect(page.locator('.screen--map-size')).toBeVisible();
    await page.getByRole('button', { name: 'Назад' }).click();
    await expect(page.locator('.screen--main-menu')).toBeVisible();
  });

  test('Standard -> faction screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await expect(page.locator('.screen--faction-select')).toBeVisible();
  });

  test('faction options are visible', async ({ page }) => {
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    for (const faction of ['Голубые', 'Зелёные', 'Жёлтые', 'Фиолетовые', 'Случайная']) {
      await expect(page.getByRole('button', { name: faction })).toBeVisible();
    }
  });

  test('Back from faction screen works', async ({ page }) => {
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Назад' }).click();
    await expect(page.locator('.screen--map-size')).toBeVisible();
  });

  test('selecting faction opens game screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Большая/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
  });

  test('Canvas exists on game screen', async ({ page }) => {
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Зелёные' }).click();
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('Settings opens', async ({ page }) => {
    await page.getByRole('button', { name: 'Настройки' }).click();
    await expect(page.locator('.screen--settings')).toBeVisible();
  });

  test('UI scale buttons change CSS variable', async ({ page }) => {
    await page.getByRole('button', { name: 'Настройки' }).click();
    await page.getByRole('button', { name: '125%' }).click();

    const uiScale = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--ui-scale'),
    );
    expect(uiScale).toBe('1.25');
  });

  test('no window.FE_* globals', async ({ page }) => {
    const feGlobals = await page.evaluate(() => {
      return Object.keys(window).filter((k) => k.startsWith('FE_'));
    });
    expect(feGlobals).toEqual([]);
  });
});
