import { test, expect } from '@playwright/test';
import { navigateToGameScreen } from './helpers/navigate.js';

test.describe('NEXT-05 construction', () => {

  test('shows a visible build entry point and builder state at game start', async ({ page }) => {
    await navigateToGameScreen(page);
    await expect(page.locator('#build-menu .build-menu__toggle')).toBeVisible();

    const constructionState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__constructionState as {
        builderBusy: boolean;
        builders: Array<{ tx: number; ty: number; busy: boolean; phase: string }>;
      };
    });

    expect(constructionState.builderBusy).toBe(false);
    expect(constructionState.builders).toHaveLength(1);
    expect(constructionState.builders[0]!.phase).toBe('idle');
  });

  test('starts construction from the menu, builder moves to site, and completes into a building', async ({ page }) => {
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
          builders: Array<{ phase: string; assignedSiteId: number }>;
          sites: Array<{ pending: boolean; id: number }>;
          statusMessage: string;
        };
      });
      return {
        builderBusy: cs.builderBusy,
        siteCount: cs.sites.length,
      };
    }, { timeout: 3000 }).toEqual({
      builderBusy: true,
      siteCount: 1,
    });

    // Read full state after construction started
    const started = await page.evaluate(() => {
      const cs = (window as Record<string, unknown>).__constructionState as {
        builderBusy: boolean;
        builders: Array<{ tx: number; ty: number; busy: boolean; phase: string; assignedSiteId: number; pathLength: number }>;
        sites: Array<{ type: string; progress: number; pending: boolean; id: number }>;
        statusMessage: string;
      };
      const es = (window as Record<string, unknown>).__economyState as { matter: number };
      return {
        builderBusy: cs.builderBusy,
        builderPhase: cs.builders[0]!.phase,
        builderAssignedSiteId: cs.builders[0]!.assignedSiteId,
        sites: cs.sites,
        statusMessage: cs.statusMessage,
        matter: es.matter,
      };
    });

    expect(started.builderBusy).toBe(true);
    expect(started.sites).toHaveLength(1);
    expect(started.sites[0]!.type).toBe('separator');
    // Verify matter was spent: addMatter(500) capped at matterCap (200), minus separator cost (60) = 140
    expect(started.matter).toBe(140);
    // Builder should be assigned to the site
    expect(started.builderAssignedSiteId).toBe(started.sites[0]!.id);
    // Builder should be either moving-to-site or building (if already adjacent)
    expect(['moving-to-site', 'building']).toContain(started.builderPhase);

    // If site is pending (builder not yet adjacent), fast-forward movement
    if (started.sites[0]!.pending) {
      // Use fast-forward to advance builder movement and then construction
      await page.evaluate(() => {
        const debug = (window as Record<string, unknown>).__constructionTest as {
          advanceConstruction: (seconds: number) => void;
        };
        // Advance enough for builder to arrive (generous time for movement)
        debug.advanceConstruction(30);
      });

      // Verify builder arrived and site is no longer pending
      await expect.poll(async () => {
        const cs = await page.evaluate(() => {
          return (window as Record<string, unknown>).__constructionState as {
            builders: Array<{ phase: string }>;
            sites: Array<{ pending: boolean }>;
          };
        });
        return {
          builderPhase: cs.builders[0]!.phase,
          sitePending: cs.sites[0]?.pending ?? true,
        };
      }, { timeout: 5000 }).toEqual({
        builderPhase: 'building',
        sitePending: false,
      });
    }

    // Fast-forward remaining build time (20 seconds for separator)
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
          builders: Array<{ phase: string }>;
        };
        return {
          builderBusy: construction.builderBusy,
          siteCount: construction.sites.length,
          builderPhase: construction.builders[0]!.phase,
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
      builderPhase: 'idle',
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
      debug.setMatter(50);
    });

    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    await expect(page.getByRole('button', { name: /Сепаратор/ })).toBeDisabled();
  });

  test('status toast appears when construction fails', async ({ page }) => {
    await navigateToGameScreen(page);

    // Set matter too low for any building so the construction attempt fails
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        setMatter: (value: number) => void;
      };
      debug.setMatter(10);
    });

    // Trigger startConstruction directly via test hook (buttons are disabled)
    await page.evaluate(() => {
      const debug = (window as Record<string, unknown>).__constructionTest as {
        startConstruction: (type: string) => { ok: boolean; reason?: string };
      };
      debug.startConstruction('separator');
    });

    // The status message should indicate insufficient matter
    await expect.poll(async () => {
      const cs = await page.evaluate(() => {
        return (window as Record<string, unknown>).__constructionState as {
          statusMessage: string;
        };
      });
      return cs.statusMessage;
    }, { timeout: 3000 }).toContain('Недостаточно');

    // Toast element should be visible
    const toast = page.locator('.build-menu__toast[data-visible="true"]');
    await expect(toast).toBeVisible();
  });

  test('cancelledSitesCount hook is exposed and starts at 0', async ({ page }) => {
    await navigateToGameScreen(page);

    // Give plenty of matter
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addMatter: (n: number) => void;
      };
      dev.addMatter(500);
    });

    // Start construction
    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    await page.getByRole('button', { name: /Сепаратор/ }).click();

    // Wait for construction to start
    await expect.poll(async () => {
      const cs = await page.evaluate(() => {
        return (window as Record<string, unknown>).__constructionState as {
          builderBusy: boolean;
          sites: Array<{ pending: boolean }>;
        };
      });
      return cs.builderBusy && cs.sites.length === 1;
    }, { timeout: 3000 }).toBe(true);

    // Verify cancelledSitesCount starts at 0
    const beforeCount = await page.evaluate(() => {
      return (window as Record<string, unknown>).__constructionState as {
        cancelledSitesCount: number;
      };
    });
    expect(beforeCount.cancelledSitesCount).toBe(0);

    // On a normal generated map, no cancellations should occur
    // This test verifies the hook is accessible and the counter starts at 0
    // Full cancellation testing requires map manipulation beyond E2E scope
  });
});
