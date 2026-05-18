import { test, expect } from '@playwright/test';

test.describe('NEXT-06C1 units factory building', () => {
  async function navigateToGameScreen(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
  }

  test('units factory appears in build menu', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    await expect(page.getByRole('button', { name: /Фабрика юнитов/ })).toBeVisible();
  });

  test('units factory button shows cost and build time', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    const button = page.getByRole('button', { name: /Фабрика юнитов/ });
    await expect(button).toContainText('150');
    await expect(button).toContainText('30');
  });

  test('builds units factory and it appears in power state', async ({ page }) => {
    await navigateToGameScreen(page);

    // Give enough matter to afford the factory (150)
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        setMatter: (value: number) => void;
      };
      debug.setMatter(200);
    });

    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    await page.getByRole('button', { name: /Фабрика юнитов/ }).click();

    // Verify construction started
    await expect.poll(async () => {
      return page.evaluate(() => {
        const construction = (window as Record<string, unknown>).__constructionState as {
          builderBusy: boolean;
          sites: Array<{ type: string; progress: number }>;
        };
        const economy = (window as Record<string, unknown>).__economyState as {
          matter: number;
        };
        return {
          builderBusy: construction.builderBusy,
          siteCount: construction.sites.length,
          siteType: construction.sites[0]?.type ?? '',
          matter: economy.matter,
        };
      });
    }).toEqual({
      builderBusy: true,
      siteCount: 1,
      siteType: 'units-factory',
      matter: 50, // 200 matter - 150 cost = 50 remaining
    });

    // Advance time to complete construction (30 seconds build time)
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        advanceConstruction: (seconds: number) => void;
      };
      debug.advanceConstruction(31);
    });

    // Verify completion: site gone, builder free, factory in power buildings
    await expect.poll(async () => {
      return page.evaluate(() => {
        const construction = (window as Record<string, unknown>).__constructionState as {
          builderBusy: boolean;
          sites: Array<unknown>;
        };
        const power = (window as Record<string, unknown>).__powerState as {
          buildings: Array<{ type: string; online: boolean }>;
          totalDemand: number;
          netPower: number;
        };
        const map = (window as Record<string, unknown>).__constructionState as {
          statusMessage: string;
        };
        return {
          builderBusy: construction.builderBusy,
          siteCount: construction.sites.length,
          hasFactoryInPower: power.buildings.some((b) => b.type === 'units-factory'),
          factoryOnline: power.buildings.find((b) => b.type === 'units-factory')?.online ?? false,
          statusMessage: map.statusMessage,
        };
      });
    }).toEqual({
      builderBusy: false,
      siteCount: 0,
      hasFactoryInPower: true,
      factoryOnline: true,
      statusMessage: expect.stringContaining('построен'),
    });
  });

  test('units factory consumes 2 power when online', async ({ page }) => {
    await navigateToGameScreen(page);

    // Give enough matter
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        setMatter: (value: number) => void;
      };
      debug.setMatter(200);
    });

    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    await page.getByRole('button', { name: /Фабрика юнитов/ }).click();

    // Complete construction
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        advanceConstruction: (seconds: number) => void;
      };
      debug.advanceConstruction(31);
    });

    // Check power state: initial demand was 2 (1 separator + 1 command relay)
    // After adding units-factory, demand should be 2 + 2 = 4
    await expect.poll(async () => {
      return page.evaluate(() => {
        const power = (window as Record<string, unknown>).__powerState as {
          totalDemand: number;
          totalSupply: number;
          netPower: number;
          buildings: Array<{ type: string; online: boolean }>;
        };
        return {
          totalDemand: power.totalDemand,
          hasFactory: power.buildings.some((b) => b.type === 'units-factory'),
          factoryOnline: power.buildings.find((b) => b.type === 'units-factory')?.online ?? false,
        };
      });
    }).toEqual({
      totalDemand: 4, // separator(1) + command-relay(1) + units-factory(2) = 4
      hasFactory: true,
      factoryOnline: true,
    });
  });
});
