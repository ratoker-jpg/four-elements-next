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

    // Give plenty of matter so cost is not an issue
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addMatter: (n: number) => void;
      };
      dev.addMatter(500);
    });

    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    await page.getByRole('button', { name: /Сепаратор/ }).click();

    // Wait for construction to start — the test hook (__constructionState) is
    // only updated per animation frame, so we poll until the builder becomes busy.
    // On a standard generated map, construction MUST succeed (builder can always
    // reach a buildable site near HQ). No-route is never acceptable here.
    await expect.poll(async () => {
      const cs = await page.evaluate(() => {
        return (window as Record<string, unknown>).__constructionState as {
          builderBusy: boolean;
          statusMessage: string;
        };
      });
      return cs.builderBusy;
    }, { timeout: 3000 }).toBe(true);

    // Now read the full construction state (guaranteed fresh after poll succeeded)
    const started = await page.evaluate(() => {
      const cs = (window as Record<string, unknown>).__constructionState as {
        builderBusy: boolean;
        sites: Array<{ type: string; progress: number }>;
        statusMessage: string;
      };
      const es = (window as Record<string, unknown>).__economyState as { matter: number };
      return {
        builderBusy: cs.builderBusy,
        sites: cs.sites,
        statusMessage: cs.statusMessage,
        matter: es.matter,
      };
    });

    expect(started.builderBusy).toBe(true);
    expect(started.sites).toHaveLength(1);
    expect(started.sites[0]!.type).toBe('separator');
    // Verify matter was spent: addMatter(500) capped at matterCap (200), minus separator cost (80) = 120
    expect(started.matter).toBe(120);

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
      separatorCount: 1,
      netPower: 1,
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
