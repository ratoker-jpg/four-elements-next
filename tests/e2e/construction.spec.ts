import { test, expect } from '@playwright/test';

test.describe('NEXT-05 construction', () => {
  async function navigateToGameScreen(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
  }

  test('shows a visible build entry point and builder state at game start', async ({ page }) => {
    await navigateToGameScreen(page);
    await expect(page.locator('#build-menu .build-menu__toggle')).toBeVisible();

    const constructionState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__constructionState as {
        builderBusy: boolean;
        builders: Array<{ tx: number; ty: number; busy: boolean }>;
      };
    });

    expect(constructionState.builderBusy).toBe(false);
    expect(constructionState.builders).toHaveLength(1);
  });

  test('starts construction from the menu, spends matter, and completes into a building', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    await page.getByRole('button', { name: /Сепаратор/ }).click();

    const started = await page.evaluate(() => {
      return {
        construction: (window as Record<string, unknown>).__constructionState as {
          builderBusy: boolean;
          sites: Array<{ type: string; progress: number }>;
        },
        economy: (window as Record<string, unknown>).__economyState as {
          matter: number;
        },
      };
    });

    expect(started.construction.builderBusy).toBe(true);
    expect(started.construction.sites).toHaveLength(1);
    expect(started.construction.sites[0]!.type).toBe('separator');
    expect(started.economy.matter).toBe(20);

    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        advanceConstruction: (seconds: number) => void;
      };
      debug.advanceConstruction(25);
    });

    await expect.poll(async () => {
      return page.evaluate(() => {
        const construction = (window as Record<string, unknown>).__constructionState as {
          builderBusy: boolean;
          sites: Array<unknown>;
        };
        return {
          builderBusy: construction.builderBusy,
          siteCount: construction.sites.length,
          separatorCount: ((window as Record<string, unknown>).__economyState as {
            separators: Array<unknown>;
          }).separators.length,
          netPower: ((window as Record<string, unknown>).__powerState as {
            netPower: number;
          }).netPower,
        };
      });
    }).toEqual({
      builderBusy: false,
      siteCount: 0,
      separatorCount: 2,
      netPower: 3,
    });
  });

  test('disables unaffordable build options', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        setMatter: (value: number) => void;
      };
      debug.setMatter(70);
    });

    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    await expect(page.getByRole('button', { name: /Сепаратор/ })).toBeDisabled();
  });
});
