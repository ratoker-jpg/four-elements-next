import { test, expect } from '@playwright/test';

test.describe('NEXT-06B harvester raw delivery', () => {
  async function navigateToGameScreen(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
  }

  test('harvester state is published at game start', async ({ page }) => {
    await navigateToGameScreen(page);
    const harvesterState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__harvesterState as {
        harvesters: Array<{
          tx: number;
          ty: number;
          phase: string;
          targetNodeIndex: number;
          gatherProgress: number;
          carry: number;
        }>;
        resourceNodes: Array<{
          tx: number;
          ty: number;
          type: string;
          infinite: boolean;
          remaining: number;
        }>;
      } | null;
    });
    expect(harvesterState).not.toBeNull();
    expect(harvesterState!.harvesters.length).toBeGreaterThanOrEqual(1);
    // Phase may already be 'moving-to-resource' since the RAF loop starts before data-ready
    const validPhases = ['idle', 'moving-to-resource', 'gathering', 'moving-to-hq', 'delivering'];
    expect(validPhases).toContain(harvesterState!.harvesters[0]!.phase);
    expect(harvesterState!.resourceNodes.length).toBeGreaterThanOrEqual(1);
  });

  test('harvester starts moving to resource node after first tick', async ({ page }) => {
    await navigateToGameScreen(page);
    // Wait a short time for the harvester to start moving
    await page.waitForTimeout(500);
    const harvesterState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__harvesterState as {
        harvesters: Array<{ phase: string }>;
      } | null;
    });
    expect(harvesterState).not.toBeNull();
    // Harvester should have left idle state
    const phases = harvesterState!.harvesters.map((h) => h.phase);
    const hasActivePhase = phases.some((p) =>
      p === 'moving-to-resource' || p === 'gathering' || p === 'moving-to-hq' || p === 'delivering',
    );
    expect(hasActivePhase).toBe(true);
  });

  test('raw is delivered to economy after harvester completes a cycle', async ({ page }) => {
    await navigateToGameScreen(page);
    // Record initial raw
    const initialRaw = await page.evaluate(() => {
      const eco = (window as Record<string, unknown>).__economyState as { raw: number } | null;
      return eco?.raw ?? 0;
    });

    // Wait for harvester to complete at least one delivery cycle
    // Distance from HQ to nearest small resource ≈ 3-8 tiles
    // At 2.5 tiles/s, round trip ≈ 2-7s, plus 3s gathering
    // Total: ~5-13s. Wait 20s to be safe.
    await page.waitForTimeout(20000);

    // Check that raw has appeared in economy
    const economyState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as {
        raw: number;
        matter: number;
        separators: Array<{ active: boolean; progress: number }>;
      } | null;
    });
    expect(economyState).not.toBeNull();

    // The most stable check: raw increased at some point
    // Even if Separator consumed it, raw > 0 or matter increased or separator became active
    const rawIncreased = economyState!.raw > initialRaw;
    const separatorActive = economyState!.separators.some((s) => s.active || s.progress > 0);
    const matterIncreased = economyState!.matter > 100; // started at 100

    // At least one of these should be true after 20 seconds of harvester activity
    expect(rawIncreased || separatorActive || matterIncreased).toBe(true);
  });

  test('resource nodes have finite remaining for non-infinite types', async ({ page }) => {
    await navigateToGameScreen(page);
    const harvesterState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__harvesterState as {
        resourceNodes: Array<{
          type: string;
          infinite: boolean;
          remaining: number;
        }>;
      } | null;
    });
    expect(harvesterState).not.toBeNull();

    const finiteNodes = harvesterState!.resourceNodes.filter((n) => !n.infinite);
    const infiniteNodes = harvesterState!.resourceNodes.filter((n) => n.infinite);

    // Finite nodes should have finite remaining
    for (const node of finiteNodes) {
      expect(Number.isFinite(node.remaining)).toBe(true);
      expect(node.remaining).toBeGreaterThan(0);
    }

    // Infinite nodes should have Infinity remaining
    for (const node of infiniteNodes) {
      expect(node.remaining).toBe(Infinity);
    }
  });

  test('harvester completes multiple cycles and depletes finite nodes over time', async ({ page }) => {
    test.setTimeout(45000);
    await navigateToGameScreen(page);
    // Wait 25 seconds for multiple cycles
    await page.waitForTimeout(25000);

    const harvesterState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__harvesterState as {
        harvesters: Array<{ phase: string; carry: number }>;
        resourceNodes: Array<{
          type: string;
          infinite: boolean;
          remaining: number;
        }>;
      } | null;
    });
    expect(harvesterState).not.toBeNull();

    // At least one finite node should have been harvested from
    const finiteNodes = harvesterState!.resourceNodes.filter((n) => !n.infinite);
    if (finiteNodes.length > 0) {
      // Small nodes start at 50, medium at 100, large at 200
      // After 30s, at least some harvesting should have occurred
      const smallNodes = finiteNodes.filter((n) => n.type === 'small');
      // A small node (50 raw) could be depleted after 5 deliveries (10 raw each)
      // Not guaranteed to be depleted but should have less than initial
      const someHarvested = smallNodes.some((n) => n.remaining < 50);
      expect(someHarvested).toBe(true);
    }
  });

  test('no critical console errors with harvesters', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await navigateToGameScreen(page);
    await page.waitForTimeout(3000);
    const critical = errors.filter((e) => !e.includes('favicon'));
    expect(critical).toEqual([]);
  });
});
