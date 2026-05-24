import { expect, test } from '@playwright/test';
import { PHASER_RENDERER_FLAG } from '../../src/render-phaser/feature-flag.js';
import { navigateToGameScreen } from './helpers/navigate.js';

test.describe('Phaser renderer switch', () => {
  test('boots a real game scene behind the runtime flag', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);

    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#economy-hud')).toBeVisible();
    const canvas = page.locator('#game-canvas[data-renderer="phaser"]');
    await expect(canvas).toBeVisible();

    const paintState = await canvas.evaluate((node) => {
      const canvasElement = node as HTMLCanvasElement;
      const ctx = canvasElement.getContext('2d');
      if (!ctx) return { painted: false, reason: '2d context unavailable' };
      const width = canvasElement.width;
      const height = canvasElement.height;
      if (width < 1 || height < 1) return { painted: false, reason: 'empty canvas' };

      const sample = ctx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < sample.length; i += 4 * 97) {
        const r = sample[i] ?? 0;
        const g = sample[i + 1] ?? 0;
        const b = sample[i + 2] ?? 0;
        const a = sample[i + 3] ?? 0;
        const isBackground = r === 23 && g === 16 && b === 8;
        if (a > 0 && !isBackground) return { painted: true, reason: 'world pixels present' };
      }
      return { painted: false, reason: 'only background sampled' };
    });
    expect(paintState).toEqual({ painted: true, reason: 'world pixels present' });

    const before = await page.evaluate(() => ({ ...(window as unknown as { __cameraPos: { x: number; y: number; zoom: number } }).__cameraPos }));
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(150);
    await page.keyboard.up('KeyD');
    const afterPan = await page.evaluate(() => ({ ...(window as unknown as { __cameraPos: { x: number; y: number; zoom: number } }).__cameraPos }));
    expect(afterPan.x).toBeGreaterThan(before.x);

    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(50);
    const afterZoom = await page.evaluate(() => ({ ...(window as unknown as { __cameraPos: { x: number; y: number; zoom: number } }).__cameraPos }));
    expect(afterZoom.zoom).toBeGreaterThan(afterPan.zoom);

    expect(runtimeErrors).toEqual([]);
  });
});

test.describe('Phaser renderer Stage 2 — persistent registry and live state', () => {
  test('reports renderer stats with registry sizes', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();

    // Check renderer stats are available
    const stats = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });

    expect(stats).toBeDefined();
    expect(stats.kind).toBe('phaser');

    // Registry sizes should be present
    const sizes = stats.registrySizes as Record<string, number>;
    expect(sizes).toBeDefined();
    expect(sizes.hq).toBeGreaterThanOrEqual(1);
    expect(sizes.resources).toBeGreaterThanOrEqual(0);
    expect(sizes.obstacles).toBeGreaterThanOrEqual(0);
    expect(sizes.harvesters).toBeGreaterThanOrEqual(2);

    // Terrain should be cached
    expect(stats.terrainCached).toBe(true);
    expect(stats.terrainBuildCount as number).toBeGreaterThanOrEqual(1);

    expect(runtimeErrors).toEqual([]);
  });

  test('Canvas remains default when Phaser flag is off', async ({ page }) => {
    await page.goto('/');
    // Make sure Phaser flag is NOT set
    await page.evaluate((flag) => {
      window.localStorage.removeItem(flag);
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="canvas"][data-ready="true"]')).toBeVisible();

    const stats = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });
    expect(stats.kind).toBe('canvas');
  });

  test('harvester positions change over time under Phaser', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();

    // Get initial harvester positions
    const beforePositions = await page.evaluate(() => {
      const hs = (window as unknown as { __harvesterState: { harvesters: Array<{ tx: number; ty: number }> } }).__harvesterState;
      return hs.harvesters.map((h) => ({ tx: h.tx, ty: h.ty }));
    });

    // Wait for harvesters to move
    await page.waitForTimeout(2000);

    // Check positions changed
    const afterPositions = await page.evaluate(() => {
      const hs = (window as unknown as { __harvesterState: { harvesters: Array<{ tx: number; ty: number }> } }).__harvesterState;
      return hs.harvesters.map((h) => ({ tx: h.tx, ty: h.ty }));
    });

    // At least one harvester should have moved
    const anyMoved = beforePositions.some((before, i) => {
      const after = afterPositions[i];
      return after && (Math.abs(after.tx - before.tx) > 0.01 || Math.abs(after.ty - before.ty) > 0.01);
    });
    expect(anyMoved).toBe(true);

    // Phaser renderer stats should still be healthy
    const stats = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });
    expect(stats.kind).toBe('phaser');
    const sizes = stats.registrySizes as Record<string, number>;
    expect(sizes.harvesters).toBeGreaterThanOrEqual(2);

    expect(runtimeErrors).toEqual([]);
  });

  test('terrain bounds cover negative-X isometric area', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message()));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();

    // Check terrain bounds are exposed and include negative X
    const stats = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });

    const bounds = stats.terrainBounds as { minX: number; minY: number; maxX: number; maxY: number } | null;
    expect(bounds).toBeDefined();
    expect(bounds).not.toBeNull();
    // Isometric maps always have negative X on the left side
    expect(bounds!.minX).toBeLessThan(0);
    // Bounds should be non-empty
    expect(bounds!.maxX).toBeGreaterThan(bounds!.minX);
    expect(bounds!.maxY).toBeGreaterThan(bounds!.minY);

    expect(runtimeErrors).toEqual([]);
  });

  test('construction site appears under Phaser after build action', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();

    // Give matter and start construction
    await page.evaluate(() => {
      const dev = (window as unknown as { __devActions: { addMatter: (n: number) => void } }).__devActions;
      dev.addMatter(500);
    });

    await page.getByRole('button', { name: 'Строительство (B)' }).click();
    await page.getByRole('button', { name: /Сепаратор/ }).click();

    // Wait for construction site to appear
    await expect.poll(async () => {
      const stats = await page.evaluate(() => {
        return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
      });
      const sizes = stats.registrySizes as Record<string, number>;
      return sizes.constructionSites;
    }, { timeout: 5000 }).toBeGreaterThanOrEqual(1);

    expect(runtimeErrors).toEqual([]);
  });
});

test.describe('Phaser renderer Stage 3 — performance smoke and acceptance', () => {
  test('render count increments over time', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();

    // Wait for game to render a few frames
    await page.waitForTimeout(500);

    const stats1 = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });
    const renderCount1 = stats1.renderCount as number;
    expect(renderCount1).toBeGreaterThanOrEqual(1);

    // Wait for more frames
    await page.waitForTimeout(500);

    const stats2 = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });
    const renderCount2 = stats2.renderCount as number;
    expect(renderCount2).toBeGreaterThan(renderCount1);

    expect(runtimeErrors).toEqual([]);
  });

  test('terrain cache does not rebuild every frame', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();

    // Wait for initial terrain build
    await page.waitForTimeout(500);

    const stats1 = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });
    const buildCount1 = stats1.terrainBuildCount as number;
    const renderCount1 = stats1.renderCount as number;
    expect(buildCount1).toBeGreaterThanOrEqual(1);

    // Wait for more frames
    await page.waitForTimeout(500);

    const stats2 = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });
    const buildCount2 = stats2.terrainBuildCount as number;
    const renderCount2 = stats2.renderCount as number;

    // Terrain should have been built once and not rebuilt despite many renders
    expect(buildCount2).toBe(buildCount1);
    expect(renderCount2).toBeGreaterThan(renderCount1);

    expect(runtimeErrors).toEqual([]);
  });

  test('total object count stays stable over short observation window', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();

    await page.waitForTimeout(500);

    const stats1 = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });
    const objectCount1 = stats1.totalObjectCount as number;
    // Must have at least HQ + harvesters
    expect(objectCount1).toBeGreaterThanOrEqual(3);

    // Short wait — object count should be stable (no leaks)
    await page.waitForTimeout(1000);

    const stats2 = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });
    const objectCount2 = stats2.totalObjectCount as number;

    // Object count should not grow unboundedly — allow small variance for territory/animation
    // but it should not double or grow by more than 50%
    expect(objectCount2).toBeLessThanOrEqual(objectCount1 * 1.5);

    expect(runtimeErrors).toEqual([]);
  });

  test('last render duration is measurable and sub-second', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();

    await page.waitForTimeout(500);

    const stats = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });

    // Duration should be measurable and reasonable (sub-second sanity bound)
    const duration = stats.lastRenderDurationMs as number;
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(1000);

    expect(runtimeErrors).toEqual([]);
  });

  test('harvester movement updates do not cause object count to explode', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();

    // Record harvester count and total object count
    await page.waitForTimeout(500);

    const stats1 = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });
    const harvesterCount1 = (stats1.registrySizes as Record<string, number>).harvesters;
    const objectCount1 = stats1.totalObjectCount as number;

    // Wait for harvesters to move
    await page.waitForTimeout(2000);

    const stats2 = await page.evaluate(() => {
      return (window as unknown as { __rendererStats: Record<string, unknown> }).__rendererStats;
    });
    const harvesterCount2 = (stats2.registrySizes as Record<string, number>).harvesters;
    const objectCount2 = stats2.totalObjectCount as number;

    // Harvester count should be stable (no duplicate objects created per frame)
    expect(harvesterCount2).toBe(harvesterCount1);
    // Total object count should not explode
    expect(objectCount2).toBeLessThanOrEqual(objectCount1 * 1.5);

    expect(runtimeErrors).toEqual([]);
  });

  test('no console errors during Phaser renderer session', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.goto('/');
    await page.evaluate((flag) => {
      window.localStorage.setItem(flag, '1');
    }, PHASER_RENDERER_FLAG);

    await navigateToGameScreen(page);
    await expect(page.locator('.screen--game[data-renderer="phaser"][data-ready="true"]')).toBeVisible();

    // Let the game run for a bit with interactions
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(300);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyW');

    await page.waitForTimeout(500);

    expect(runtimeErrors).toEqual([]);
  });
});
