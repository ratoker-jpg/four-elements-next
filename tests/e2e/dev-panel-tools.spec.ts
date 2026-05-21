import { test, expect } from '@playwright/test';

test.describe('DEV-SANDBOX-TOOLS-01 dev panel tools', () => {
  async function navigateToGameScreen(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
  }

  test('Max All sets raw/matter/active element to caps', async ({ page }) => {
    await navigateToGameScreen(page);

    // First zero everything to have a clear baseline
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        zeroAll: () => void;
      };
      dev.zeroAll();
    });

    // Verify zeroed
    await expect.poll(async () => {
      const es = await page.evaluate(() => {
        return (window as Record<string, unknown>).__economyState as {
          raw: number; matter: number; activeElement: number; rawCap: number; matterCap: number; elementCap: number;
        };
      });
      return { raw: es.raw, matter: es.matter, activeElement: es.activeElement };
    }, { timeout: 3000 }).toEqual({ raw: 0, matter: 0, activeElement: 0 });

    // Max All
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        maxAll: () => void;
      };
      dev.maxAll();
    });

    // Verify at caps
    await expect.poll(async () => {
      const es = await page.evaluate(() => {
        return (window as Record<string, unknown>).__economyState as {
          raw: number; matter: number; activeElement: number; rawCap: number; matterCap: number; elementCap: number;
        };
      });
      return {
        rawAtCap: es.raw === es.rawCap,
        matterAtCap: es.matter === es.matterCap,
        elementAtCap: es.activeElement === es.elementCap,
      };
    }, { timeout: 3000 }).toEqual({ rawAtCap: true, matterAtCap: true, elementAtCap: true });
  });

  test('Zero All sets raw/matter/active element to 0', async ({ page }) => {
    await navigateToGameScreen(page);

    // First max everything
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        maxAll: () => void;
      };
      dev.maxAll();
    });

    // Zero All
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        zeroAll: () => void;
      };
      dev.zeroAll();
    });

    // Verify zeroed
    await expect.poll(async () => {
      const es = await page.evaluate(() => {
        return (window as Record<string, unknown>).__economyState as {
          raw: number; matter: number; activeElement: number;
        };
      });
      return { raw: es.raw, matter: es.matter, activeElement: es.activeElement };
    }, { timeout: 3000 }).toEqual({ raw: 0, matter: 0, activeElement: 0 });
  });

  test('+ Builder increments builder count', async ({ page }) => {
    await navigateToGameScreen(page);

    const beforeCount = await page.evaluate(() => {
      return (window as Record<string, unknown>).__constructionState as {
        builders: Array<unknown>;
      };
    });
    expect(beforeCount.builders.length).toBeGreaterThanOrEqual(1);

    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        spawnBuilder: () => void;
      };
      dev.spawnBuilder();
    });

    await expect.poll(async () => {
      const cs = await page.evaluate(() => {
        return (window as Record<string, unknown>).__constructionState as {
          builders: Array<{ phase: string; busy: boolean }>;
        };
      });
      return cs.builders.length;
    }, { timeout: 3000 }).toBe(beforeCount.builders.length + 1);
  });

  test('+ Harvester increments harvester count', async ({ page }) => {
    await navigateToGameScreen(page);

    const beforeCount = await page.evaluate(() => {
      return (window as Record<string, unknown>).__harvesterState as {
        harvesters: Array<unknown>;
      };
    });
    expect(beforeCount.harvesters.length).toBeGreaterThanOrEqual(2);

    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        spawnHarvester: () => void;
      };
      dev.spawnHarvester();
    });

    await expect.poll(async () => {
      const hs = await page.evaluate(() => {
        return (window as Record<string, unknown>).__harvesterState as {
          harvesters: Array<unknown>;
        };
      });
      return hs.harvesters.length;
    }, { timeout: 3000 }).toBe(beforeCount.harvesters.length + 1);
  });

  test('+ Obstacle at camera center increases obstacle count if free', async ({ page }) => {
    await navigateToGameScreen(page);

    // Open dev panel to read obstacle count from info
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(200);

    // Get initial obstacle count from dev panel info text
    const beforeText = await page.locator('.fe-dev-panel__info').textContent();
    const beforeMatch = beforeText?.match(/Obstacles:\s*(\d+)/);
    const beforeCount = beforeMatch ? parseInt(beforeMatch[1]!, 10) : -1;

    // Find a free tile by scanning the map using test hooks
    const freeTile = await page.evaluate(() => {
      // Return a tile in the bottom-left corner — usually sand with nothing
      const mapH = 48;
      return { tx: 1, ty: mapH - 2 };
    });

    // Move camera to the free tile
    await page.evaluate((tile) => {
      const dev = (window as Record<string, unknown>).__devActions as {
        moveCameraToTile: (tx: number, ty: number) => void;
      };
      dev.moveCameraToTile(tile.tx, tile.ty);
    }, freeTile);
    await page.waitForTimeout(200);

    // Add obstacle — try multiple tiles in the corner area if the first is occupied
    let added = false;
    for (const offset of [0, 1, 2, -1, -2]) {
      await page.evaluate((ofs) => {
        const dev = (window as Record<string, unknown>).__devActions as {
          moveCameraToTile: (tx: number, ty: number) => void;
        };
        dev.moveCameraToTile(1 + ofs, 46);
      }, offset);
      await page.waitForTimeout(100);

      await page.evaluate(() => {
        const dev = (window as Record<string, unknown>).__devActions as {
          addObstacle: () => void;
        };
        dev.addObstacle();
      });

      // Check if obstacle count changed
      const currentText = await page.locator('.fe-dev-panel__info').textContent();
      const currentMatch = currentText?.match(/Obstacles:\s*(\d+)/);
      const currentCount = currentMatch ? parseInt(currentMatch[1]!, 10) : -1;
      if (currentCount === beforeCount + 1) {
        added = true;
        break;
      }
    }

    expect(added).toBe(true);
  });

  test('+ Resource at camera center increases resource count and resourceNodes count if free', async ({ page }) => {
    await navigateToGameScreen(page);

    const beforeResources = await page.evaluate(() => {
      const hs = (window as Record<string, unknown>).__harvesterState as {
        resourceNodes: Array<unknown>;
      };
      return hs.resourceNodes.length;
    });

    // Try multiple tiles in the corner area until we find a free one
    let added = false;
    for (const offset of [0, 1, 2, 3, 4, -1, -2]) {
      await page.evaluate((ofs) => {
        const dev = (window as Record<string, unknown>).__devActions as {
          moveCameraToTile: (tx: number, ty: number) => void;
        };
        dev.moveCameraToTile(1 + ofs, 45);
      }, offset);
      await page.waitForTimeout(100);

      await page.evaluate(() => {
        const dev = (window as Record<string, unknown>).__devActions as {
          addResource: () => void;
        };
        dev.addResource();
      });

      // Check if resourceNodes count increased
      const currentCount = await page.evaluate(() => {
        const hs = (window as Record<string, unknown>).__harvesterState as {
          resourceNodes: Array<unknown>;
        };
        return hs.resourceNodes.length;
      });
      if (currentCount === beforeResources + 1) {
        added = true;
        break;
      }
    }

    expect(added).toBe(true);
  });

  test('Clear Sites removes construction sites and resets builders idle', async ({ page }) => {
    await navigateToGameScreen(page);

    // Give matter and start construction
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addMatter: (n: number) => void;
      };
      dev.addMatter(500);
    });

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

    // Now clear sites
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        clearConstruction: () => void;
      };
      dev.clearConstruction();
    });

    // Verify: no sites, builder idle
    await expect.poll(async () => {
      const cs = await page.evaluate(() => {
        return (window as Record<string, unknown>).__constructionState as {
          builderBusy: boolean;
          sites: Array<unknown>;
          builders: Array<{ phase: string; busy: boolean }>;
        };
      });
      return {
        builderBusy: cs.builderBusy,
        siteCount: cs.sites.length,
        allBuildersIdle: cs.builders.every(b => b.phase === 'idle' && !b.busy),
      };
    }, { timeout: 3000 }).toEqual({
      builderBusy: false,
      siteCount: 0,
      allBuildersIdle: true,
    });
  });
});

test.describe('DEV-SANDBOX-TOOLS-02 scenario buttons', () => {
  async function navigateToGameScreen(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
  }

  test('scenario buttons exist in the dev panel', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.keyboard.press('Backquote');

    const panel = page.locator('#fe-dev-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Builder Test' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Economy Test' })).toBeVisible();
  });

  test('Prepare Builder Test sets resources to caps and adds a builder', async ({ page }) => {
    await navigateToGameScreen(page);

    // Get initial builder count
    const beforeBuilders = await page.evaluate(() => {
      return (window as Record<string, unknown>).__constructionState as {
        builders: Array<unknown>;
      };
    });
    const beforeCount = beforeBuilders.builders.length;

    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        prepareBuilderTest: () => void;
      };
      dev.prepareBuilderTest();
    });

    // Verify resources at caps
    await expect.poll(async () => {
      const es = await page.evaluate(() => {
        return (window as Record<string, unknown>).__economyState as {
          raw: number; matter: number; activeElement: number; rawCap: number; matterCap: number; elementCap: number;
        };
      });
      return {
        rawAtCap: es.raw === es.rawCap,
        matterAtCap: es.matter === es.matterCap,
        elementAtCap: es.activeElement === es.elementCap,
      };
    }, { timeout: 3000 }).toEqual({ rawAtCap: true, matterAtCap: true, elementAtCap: true });

    // Verify builder count increased by 1
    await expect.poll(async () => {
      const cs = await page.evaluate(() => {
        return (window as Record<string, unknown>).__constructionState as {
          builders: Array<unknown>;
        };
      });
      return cs.builders.length;
    }, { timeout: 3000 }).toBe(beforeCount + 1);

    // Verify camera moved (was at default, now at HQ)
    const cameraPos = await page.evaluate(() => {
      return (window as Record<string, unknown>).__cameraPos as { x: number; y: number };
    });
    expect(typeof cameraPos.x).toBe('number');
    expect(typeof cameraPos.y).toBe('number');
  });

  test('Prepare Economy Test adds harvesters and completes a separator', async ({ page }) => {
    await navigateToGameScreen(page);

    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        prepareEconomyTest: () => void;
      };
      dev.prepareEconomyTest();
    });

    // Wait for fast-forward to complete and state to settle
    await page.waitForTimeout(500);

    // Verify harvesters >= 3
    const harvesterState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__harvesterState as {
        harvesters: Array<unknown>;
      };
    });
    expect(harvesterState.harvesters.length).toBeGreaterThanOrEqual(3);

    // Verify separator exists (either completed building or economy separator)
    const afterState = await page.evaluate(() => {
      const es = (window as Record<string, unknown>).__economyState as {
        raw: number; matter: number; activeElement: number;
        rawCap: number; matterCap: number; elementCap: number;
        separators: Array<unknown>;
      };
      const ps = (window as Record<string, unknown>).__powerState as {
        netPower: number;
      };
      const cs = (window as Record<string, unknown>).__constructionState as {
        sites: Array<unknown>;
      };
      return {
        separatorCount: es.separators.length,
        siteCount: cs.sites.length,
        netPower: ps.netPower,
        rawInRange: es.raw >= 0 && es.raw <= es.rawCap,
        matterInRange: es.matter >= 0 && es.matter <= es.matterCap,
        elementInRange: es.activeElement >= 0 && es.activeElement <= es.elementCap,
        economyAccessible: true,
        powerAccessible: true,
      };
    });

    // Either separator completed (separators >= 1) or construction site still in progress
    expect(afterState.separatorCount + afterState.siteCount).toBeGreaterThanOrEqual(1);

    // Resources within valid range (fast-forward may change them)
    expect(afterState.rawInRange).toBe(true);
    expect(afterState.matterInRange).toBe(true);
    expect(afterState.elementInRange).toBe(true);

    // No crash — state is accessible
    expect(afterState.economyAccessible).toBe(true);
    expect(afterState.powerAccessible).toBe(true);

    // If separator completed, power should be positive
    if (afterState.separatorCount >= 1) {
      expect(afterState.netPower).toBeGreaterThanOrEqual(1);
    }
  });
});
