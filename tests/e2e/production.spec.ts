import { test, expect } from '@playwright/test';

test.describe('NEXT-06C2 production system', () => {
  async function navigateToGameScreen(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
  }

  async function openProductionPanel(page: import('@playwright/test').Page) {
    await page.locator('#production-panel').getByRole('button', { name: /^Производство/ }).click();
  }

  /** Build a Units Factory using debug hooks and return its position. */
  async function buildUnitsFactory(page: import('@playwright/test').Page): Promise<{ tx: number; ty: number }> {
    // Give enough matter to build factory (150) and still have some left for production
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        setMatter: (value: number) => void;
      };
      debug.setMatter(500);
    });

    // Build the factory
    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    await page.getByRole('button', { name: /Фабрика юнитов/ }).click();

    // Advance construction to completion (30s build time)
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        advanceConstruction: (seconds: number) => void;
      };
      debug.advanceConstruction(31);
    });

    // Wait for factory to appear in production state and get its position
    await expect.poll(async () => {
      const production = await page.evaluate(() => {
        const prod = (window as Record<string, unknown>).__productionState as {
          factories: Array<{ tx: number; ty: number; queue: Array<unknown> }>;
        } | null;
        return prod?.factories.length ?? 0;
      });
      return production;
    }).toBeGreaterThan(0);

    // Now safely get the factory position
    const factoryPos = await page.evaluate(() => {
      const production = (window as Record<string, unknown>).__productionState as {
        factories: Array<{ tx: number; ty: number; queue: Array<unknown> }>;
      };
      return { tx: production.factories[0]!.tx, ty: production.factories[0]!.ty };
    });

    return factoryPos;
  }

  test('production panel is not visible before building a factory', async ({ page }) => {
    await navigateToGameScreen(page);
    const panel = page.locator('#production-panel');
    await expect(panel).not.toBeVisible();
  });

  test('production panel appears after building a factory', async ({ page }) => {
    await navigateToGameScreen(page);
    await buildUnitsFactory(page);

    const panel = page.locator('#production-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: /^Производство/ })).toBeVisible();
  });

  test('production panel shows factory position and buttons', async ({ page }) => {
    await navigateToGameScreen(page);
    await buildUnitsFactory(page);
    await openProductionPanel(page);

    const panel = page.locator('#production-panel');
    await expect(panel).toContainText('Фабрика');
    await expect(panel.getByRole('button', { name: /Строитель/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Сборщик/ })).toBeVisible();
  });

  test('produce buttons show cost and time', async ({ page }) => {
    await navigateToGameScreen(page);
    await buildUnitsFactory(page);
    await openProductionPanel(page);

    const panel = page.locator('#production-panel');
    const builderBtn = panel.getByRole('button', { name: /Строитель/ });
    await expect(builderBtn).toContainText('50M');
    await expect(builderBtn).toContainText('20');

    const harvesterBtn = panel.getByRole('button', { name: /Сборщик/ });
    await expect(harvesterBtn).toContainText('60M');
    await expect(harvesterBtn).toContainText('25');
  });

  test('produce buttons are disabled when resources are insufficient', async ({ page }) => {
    await navigateToGameScreen(page);
    await buildUnitsFactory(page);
    await openProductionPanel(page);

    // Drain matter
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        setMatter: (value: number) => void;
      };
      debug.setMatter(10);
    });

    const panel = page.locator('#production-panel');
    await expect(panel.getByRole('button', { name: /Строитель/ })).toBeDisabled();
    await expect(panel.getByRole('button', { name: /Сборщик/ })).toBeDisabled();
  });

  test('producing a builder from UI deducts resources and shows queue', async ({ page }) => {
    await navigateToGameScreen(page);
    await buildUnitsFactory(page);
    await openProductionPanel(page);

    const panel = page.locator('#production-panel');
    await panel.getByRole('button', { name: /Строитель/ }).click();

    // Wait a frame for test hooks to update, then verify resources changed
    await page.waitForTimeout(100);

    const afterState = await page.evaluate(() => {
      const eco = (window as Record<string, unknown>).__economyState as { matter: number; activeElement: number };
      const ctrl = (window as Record<string, unknown>).__controlState as { used: number };
      const production = (window as Record<string, unknown>).__productionState as {
        factories: Array<{ tx: number; ty: number; queue: Array<{ unitType: string }> }>;
      };
      return {
        matter: eco.matter,
        activeElement: eco.activeElement,
        used: ctrl.used,
        queueLength: production.factories[0]?.queue.length ?? 0,
      };
    });

    // Matter should be less than 500 (initial) - 150 (factory cost) = 350
    // Further reduced by 50 (builder cost) = 300, but economy may have changed
    expect(afterState.matter).toBeLessThan(350);
    // Active element should be reduced by 1 from initial 3
    expect(afterState.activeElement).toBe(2);
    // Control used should have increased by 1
    expect(afterState.used).toBeGreaterThanOrEqual(3); // initial builder(1) + harvester(1) + produced builder(1)

    // Verify queue shows 1/2
    await expect(panel).toContainText('1/2');
  });

  test('builder spawns after production completes', async ({ page }) => {
    await navigateToGameScreen(page);
    const factoryPos = await buildUnitsFactory(page);

    // Get initial builder count
    const initialBuilders = await page.evaluate(() => {
      const construction = (window as Record<string, unknown>).__constructionState as {
        builders: Array<unknown>;
      };
      return construction.builders.length;
    });

    // Produce a builder
    await page.evaluate((pos) => {
      const debug = (window as Record<string, unknown>).__productionTest as {
        startProduction: (tx: number, ty: number, unitType: string) => unknown;
      };
      debug.startProduction(pos.tx, pos.ty, 'builder');
    }, factoryPos);

    // Advance time to complete production (20s)
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        advanceConstruction: (seconds: number) => void;
      };
      debug.advanceConstruction(21);
    });

    // Verify builder spawned
    await expect.poll(async () => {
      return page.evaluate(() => {
        const construction = (window as Record<string, unknown>).__constructionState as {
          builders: Array<unknown>;
        };
        return construction.builders.length;
      });
    }).toBe(initialBuilders + 1);
  });

  test('harvester spawns after production completes', async ({ page }) => {
    await navigateToGameScreen(page);
    const factoryPos = await buildUnitsFactory(page);

    // Get initial harvester count
    const initialHarvesters = await page.evaluate(() => {
      const harvester = (window as Record<string, unknown>).__harvesterState as {
        harvesters: Array<unknown>;
      };
      return harvester.harvesters.length;
    });

    // Produce a harvester
    await page.evaluate((pos) => {
      const debug = (window as Record<string, unknown>).__productionTest as {
        startProduction: (tx: number, ty: number, unitType: string) => unknown;
      };
      debug.startProduction(pos.tx, pos.ty, 'harvester');
    }, factoryPos);

    // Advance time to complete production (25s)
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        advanceConstruction: (seconds: number) => void;
      };
      debug.advanceConstruction(26);
    });

    // Verify harvester spawned
    await expect.poll(async () => {
      return page.evaluate(() => {
        const harvester = (window as Record<string, unknown>).__harvesterState as {
          harvesters: Array<unknown>;
        };
        return harvester.harvesters.length;
      });
    }).toBe(initialHarvesters + 1);
  });

  test('queue is limited to 2 items', async ({ page }) => {
    await navigateToGameScreen(page);
    const factoryPos = await buildUnitsFactory(page);

    // Queue 2 items
    await page.evaluate((pos) => {
      const debug = (window as Record<string, unknown>).__productionTest as {
        startProduction: (tx: number, ty: number, unitType: string) => unknown;
      };
      debug.startProduction(pos.tx, pos.ty, 'builder');
      debug.startProduction(pos.tx, pos.ty, 'harvester');
    }, factoryPos);

    // Verify queue is 2/2
    const panel = page.locator('#production-panel');
    await expect(panel).toContainText('2/2');

    // Try to add a third — should fail
    const result = await page.evaluate((pos) => {
      const debug = (window as Record<string, unknown>).__productionTest as {
        startProduction: (tx: number, ty: number, unitType: string) => unknown;
      };
      return debug.startProduction(pos.tx, pos.ty, 'builder') as { ok: boolean; reason?: string };
    }, factoryPos);

    expect(result.ok).toBe(false);
  });

  test('production progress shows in panel', async ({ page }) => {
    await navigateToGameScreen(page);
    const factoryPos = await buildUnitsFactory(page);

    // Produce a builder
    await page.evaluate((pos) => {
      const debug = (window as Record<string, unknown>).__productionTest as {
        startProduction: (tx: number, ty: number, unitType: string) => unknown;
      };
      debug.startProduction(pos.tx, pos.ty, 'builder');
    }, factoryPos);

    // Advance partially
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        advanceConstruction: (seconds: number) => void;
      };
      debug.advanceConstruction(10);
    });

    // Panel should show progress
    const panel = page.locator('#production-panel');
    await expect(panel).toContainText('BLD');
  });

  // NEXT-TEST-01: Control HUD updates after production order

  test('control HUD shows 3/15 after producing a builder from UI', async ({ page }) => {
    await navigateToGameScreen(page);
    await buildUnitsFactory(page);
    await openProductionPanel(page);

    // Verify initial HUD shows 2/15
    const controlValue = page.locator('.economy-hud__item--control .economy-hud__value');
    await expect(controlValue).toHaveText('2/15');

    // Produce a builder via UI click
    const panel = page.locator('#production-panel');
    await panel.getByRole('button', { name: /Строитель/ }).click();

    // Wait for control.used to become 3 via poll (more reliable than waitForTimeout)
    await expect.poll(async () => {
      const ctrl = await page.evaluate(() => {
        const c = (window as Record<string, unknown>).__controlState as { used: number };
        return c.used;
      });
      return ctrl;
    }).toBe(3);

    // Now assert HUD text shows 3/15
    await expect(controlValue).toHaveText('3/15');
  });
});
