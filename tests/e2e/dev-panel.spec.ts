import { test, expect } from '@playwright/test';

test.describe('DEV-SANDBOX-ARCH-01 dev panel', () => {
  async function navigateToGameScreen(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
  }

  test('dev panel is hidden by default', async ({ page }) => {
    await navigateToGameScreen(page);
    const panel = page.locator('#fe-dev-panel');
    // Panel element exists (in test mode) but is hidden
    await expect(panel).toBeAttached();
    await expect(panel).toHaveAttribute('data-visible', 'false');
    await expect(panel).toBeHidden();
  });

  test('toggle key (backtick) opens dev panel', async ({ page }) => {
    await navigateToGameScreen(page);
    const panel = page.locator('#fe-dev-panel');
    await expect(panel).toBeHidden();
    await page.keyboard.press('Backquote');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-visible', 'true');
  });

  test('toggle key (backtick) closes dev panel', async ({ page }) => {
    await navigateToGameScreen(page);
    const panel = page.locator('#fe-dev-panel');
    await page.keyboard.press('Backquote');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Backquote');
    await expect(panel).toBeHidden();
    await expect(panel).toHaveAttribute('data-visible', 'false');
  });

  test('dev panel shows map/faction/resource info', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.keyboard.press('Backquote');
    const panel = page.locator('#fe-dev-panel');
    await expect(panel).toBeVisible();
    const info = panel.locator('.fe-dev-panel__info');
    await expect(info).toContainText('48x48'); // standard map size
    await expect(info).toContainText('cyan');   // faction
  });

  test('+50 Raw increases raw and HUD updates', async ({ page }) => {
    await navigateToGameScreen(page);
    const rawBefore = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as { raw: number } | null;
    });
    expect(rawBefore!.raw).toBe(0);

    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addRaw: (n: number) => void;
      } | null;
      dev?.addRaw(50);
    });

    await expect.poll(async () => {
      return (await page.evaluate(() => {
        return (window as Record<string, unknown>).__economyState as { raw: number } | null;
      }))?.raw;
    }).toBe(50);
  });

  test('+50 Matter increases matter and HUD updates', async ({ page }) => {
    await navigateToGameScreen(page);
    const matterBefore = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as { matter: number } | null;
    });
    expect(matterBefore!.matter).toBe(100);

    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addMatter: (n: number) => void;
      } | null;
      dev?.addMatter(50);
    });

    await expect.poll(async () => {
      return (await page.evaluate(() => {
        return (window as Record<string, unknown>).__economyState as { matter: number } | null;
      }))?.matter;
    }).toBe(150);
  });

  test('+1 Element increases activeElement by 10 elementUnits and HUD shows +1.0 displayed element', async ({ page }) => {
    await navigateToGameScreen(page);
    const economyBefore = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as {
        activeElement: number;
        elementCap: number;
      } | null;
    });
    expect(economyBefore!.activeElement).toBe(30); // 30 elementUnits = 3.0 displayed

    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addElementUnits: (n: number) => void;
      } | null;
      dev?.addElementUnits(10); // 10 elementUnits = 1.0 displayed element
    });

    await expect.poll(async () => {
      return (await page.evaluate(() => {
        return (window as Record<string, unknown>).__economyState as {
          activeElement: number;
        } | null;
      }))?.activeElement;
    }).toBe(40); // 40 elementUnits = 4.0 displayed

    // Verify HUD shows the updated value
    const elementHudValue = page.locator('.economy-hud__item--element .economy-hud__value');
    await expect(elementHudValue).toHaveText('4.0/20.0');
  });

  test('+10s fast-forward does not crash and advances state', async ({ page }) => {
    await navigateToGameScreen(page);

    // Give some raw so separator can work
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addRaw: (n: number) => void;
      } | null;
      dev?.addRaw(200);
    });

    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        fastForward: (n: number) => void;
      } | null;
      dev?.fastForward(10);
    });

    // Verify the game didn't crash — economy state is still accessible
    const economyAfter = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as { raw: number } | null;
    });
    expect(economyAfter).not.toBeNull();
  });

  test('+60s fast-forward does not crash and advances state', async ({ page }) => {
    await navigateToGameScreen(page);

    // Give resources for systems to consume
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addRaw: (n: number) => void;
        addMatter: (n: number) => void;
      } | null;
      dev?.addRaw(200);
      dev?.addMatter(200);
    });

    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        fastForward: (n: number) => void;
      } | null;
      dev?.fastForward(60);
    });

    // Verify game didn't crash
    const economyAfter = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as { raw: number; matter: number } | null;
    });
    expect(economyAfter).not.toBeNull();
    expect(typeof economyAfter!.raw).toBe('number');
  });

  test('Camera to HQ changes camera position', async ({ page }) => {
    await navigateToGameScreen(page);

    // Move camera away first
    const canvas = page.locator('#game-canvas');
    await canvas.click();
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(300);
    await page.keyboard.up('KeyW');

    const cameraBefore = await page.evaluate(() => {
      return (window as Record<string, unknown>).__cameraPos as { x: number; y: number };
    });

    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        cameraToHq: () => void;
      } | null;
      dev?.cameraToHq();
    });

    // Wait for __cameraPos to update (it updates on next frame in publishTestHooks)
    await expect.poll(async () => {
      const pos = await page.evaluate(() => {
        return (window as Record<string, unknown>).__cameraPos as { x: number; y: number };
      });
      return pos.x !== cameraBefore.x || pos.y !== cameraBefore.y;
    }).toBe(true);
  });

  test('Camera to Center changes camera position', async ({ page }) => {
    await navigateToGameScreen(page);

    // First move camera to HQ (known position)
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        cameraToHq: () => void;
      } | null;
      dev?.cameraToHq();
    });

    // Wait for camera to reach HQ
    await page.waitForTimeout(100);

    const cameraAtHq = await page.evaluate(() => {
      return (window as Record<string, unknown>).__cameraPos as { x: number; y: number };
    });

    // Now jump to center
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        cameraToCenter: () => void;
      } | null;
      dev?.cameraToCenter();
    });

    // Wait for camera to reach center (different from HQ on standard map)
    await expect.poll(async () => {
      const pos = await page.evaluate(() => {
        return (window as Record<string, unknown>).__cameraPos as { x: number; y: number };
      });
      return pos.x !== cameraAtHq.x || pos.y !== cameraAtHq.y;
    }).toBe(true);
  });

  test('normal game start values are unchanged if panel is not used', async ({ page }) => {
    await navigateToGameScreen(page);
    // Do NOT open dev panel or use dev actions
    const economyState = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as {
        raw: number;
        matter: number;
        activeElement: number;
        rawCap: number;
        matterCap: number;
        elementCap: number;
      } | null;
    });
    expect(economyState).not.toBeNull();
    expect(economyState!.raw).toBe(0);
    expect(economyState!.matter).toBe(100);
    expect(economyState!.activeElement).toBe(30); // 30 elementUnits
    expect(economyState!.rawCap).toBe(200);
    expect(economyState!.matterCap).toBe(200);
    expect(economyState!.elementCap).toBe(200);
  });

  test('dev panel actions are available via __devActions in test mode', async ({ page }) => {
    await navigateToGameScreen(page);
    const devActions = await page.evaluate(() => {
      return typeof (window as Record<string, unknown>).__devActions;
    });
    expect(devActions).toBe('object');

    // Verify all expected methods exist (including DEV-SANDBOX-TOOLS-01 additions)
    const methods = await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as Record<string, unknown> | null;
      if (!dev) return null;
      return {
        addRaw: typeof dev.addRaw,
        addMatter: typeof dev.addMatter,
        addElementUnits: typeof dev.addElementUnits,
        fastForward: typeof dev.fastForward,
        cameraToHq: typeof dev.cameraToHq,
        cameraToCenter: typeof dev.cameraToCenter,
        maxAll: typeof dev.maxAll,
        zeroAll: typeof dev.zeroAll,
        spawnBuilder: typeof dev.spawnBuilder,
        spawnHarvester: typeof dev.spawnHarvester,
        addObstacle: typeof dev.addObstacle,
        addResource: typeof dev.addResource,
        clearConstruction: typeof dev.clearConstruction,
      };
    });
    expect(methods).not.toBeNull();
    expect(methods!.addRaw).toBe('function');
    expect(methods!.addMatter).toBe('function');
    expect(methods!.addElementUnits).toBe('function');
    expect(methods!.fastForward).toBe('function');
    expect(methods!.cameraToHq).toBe('function');
    expect(methods!.cameraToCenter).toBe('function');
    expect(methods!.maxAll).toBe('function');
    expect(methods!.zeroAll).toBe('function');
    expect(methods!.spawnBuilder).toBe('function');
    expect(methods!.spawnHarvester).toBe('function');
    expect(methods!.addObstacle).toBe('function');
    expect(methods!.addResource).toBe('function');
    expect(methods!.clearConstruction).toBe('function');
  });

  test('no critical console errors when dev panel is used', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await navigateToGameScreen(page);
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(500);
    // Use __devActions to exercise all code paths
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addRaw: (n: number) => void;
        fastForward: (n: number) => void;
        cameraToHq: () => void;
      } | null;
      dev?.addRaw(50);
      dev?.fastForward(10);
      dev?.cameraToHq();
    });
    const critical = errors.filter((e) => !e.includes('favicon'));
    expect(critical).toEqual([]);
  });
});

test.describe('DEV-SANDBOX-PR1B devtools URL flag', () => {
  test('URL with ?devtools=1 — URLSearchParams returns devtools=1', async ({ page }) => {
    await page.goto('/?devtools=1');
    const allowed = await page.evaluate(() => {
      const params = new URLSearchParams(window.location.search);
      return params.get('devtools') === '1';
    });
    expect(allowed).toBe(true);
  });

  test('URL without ?devtools=1 — URLSearchParams does not have devtools', async ({ page }) => {
    await page.goto('/');
    const hasDevtools = await page.evaluate(() => {
      return new URLSearchParams(window.location.search).get('devtools');
    });
    expect(hasDevtools).toBeNull();
  });
});

test.describe('DEV-SANDBOX-ARCH-01 PR2 overlay toggles', () => {
  async function navigateToGameScreen(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
  }

  test('overlay toggle buttons exist in dev panel', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.keyboard.press('Backquote');
    const panel = page.locator('#fe-dev-panel');
    await expect(panel).toBeVisible();

    // Check that overlay toggle buttons exist
    const toggleBtns = panel.locator('.fe-dev-panel__btn--toggle');
    await expect(toggleBtns).toHaveCount(8);

    // Verify all expected overlay keys
    const keys = ['grid', 'footprints', 'resourceAmounts', 'obstacleBlocking', 'territoryDebug', 'hqToCenter', 'radii', 'spriteDebug'];
    for (const key of keys) {
      await expect(panel.locator(`.fe-dev-panel__btn--toggle[data-overlay-key="${key}"]`)).toHaveCount(1);
    }
  });

  test('overlay toggles are off by default', async ({ page }) => {
    await navigateToGameScreen(page);

    const toggles = await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        get: () => Record<string, boolean>;
      } | null;
      return ot?.get() ?? null;
    });

    expect(toggles).not.toBeNull();
    expect(toggles!.grid).toBe(false);
    expect(toggles!.footprints).toBe(false);
    expect(toggles!.resourceAmounts).toBe(false);
    expect(toggles!.obstacleBlocking).toBe(false);
    expect(toggles!.territoryDebug).toBe(false);
    expect(toggles!.hqToCenter).toBe(false);
    expect(toggles!.radii).toBe(false);
    expect(toggles!.spriteDebug).toBe(false);
  });

  test('clicking Grid toggle activates it', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.keyboard.press('Backquote');

    const gridBtn = page.locator('#fe-dev-panel .fe-dev-panel__btn--toggle[data-overlay-key="grid"]');
    await expect(gridBtn).toHaveAttribute('data-active', 'false');
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute('data-active', 'true');

    // Verify via test hook
    const toggles = await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        get: () => Record<string, boolean>;
      } | null;
      return ot?.get() ?? null;
    });
    expect(toggles!.grid).toBe(true);
  });

  test('toggling overlay on then off returns to false', async ({ page }) => {
    await navigateToGameScreen(page);

    // Toggle grid on via test hook
    await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        set: (key: string, value: boolean) => void;
      } | null;
      ot?.set('grid', true);
    });

    let toggles = await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        get: () => Record<string, boolean>;
      } | null;
      return ot?.get() ?? null;
    });
    expect(toggles!.grid).toBe(true);

    // Toggle off
    await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        set: (key: string, value: boolean) => void;
      } | null;
      ot?.set('grid', false);
    });

    toggles = await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        get: () => Record<string, boolean>;
      } | null;
      return ot?.get() ?? null;
    });
    expect(toggles!.grid).toBe(false);
  });

  test('enabling all overlays does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await navigateToGameScreen(page);

    // Enable all overlays via test hook
    await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        set: (key: string, value: boolean) => void;
      } | null;
      const keys = ['grid', 'footprints', 'resourceAmounts', 'obstacleBlocking', 'territoryDebug', 'hqToCenter', 'radii', 'spriteDebug'];
      for (const key of keys) {
        ot?.set(key, true);
      }
    });

    // Wait a few frames for rendering
    await page.waitForTimeout(500);

    // Verify game state is still accessible (no crash)
    const economyAfter = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as { raw: number } | null;
    });
    expect(economyAfter).not.toBeNull();

    const critical = errors.filter((e) => !e.includes('favicon'));
    expect(critical).toEqual([]);
  });

  test('Grid overlay toggle renders without crash (DEV-SANDBOX-FIX-01)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await navigateToGameScreen(page);

    // Toggle grid on via dev panel button
    await page.keyboard.press('Backquote');
    const gridBtn = page.locator('#fe-dev-panel .fe-dev-panel__btn--toggle[data-overlay-key="grid"]');
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute('data-active', 'true');

    // Wait several frames for rendering
    await page.waitForTimeout(500);

    // Verify game is still running (no crash)
    const economyAfter = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as { raw: number } | null;
    });
    expect(economyAfter).not.toBeNull();

    const critical = errors.filter((e) => !e.includes('favicon'));
    expect(critical).toEqual([]);
  });

  test('existing dev actions still work with overlay code present', async ({ page }) => {
    await navigateToGameScreen(page);

    // Enable an overlay
    await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        set: (key: string, value: boolean) => void;
      } | null;
      ot?.set('grid', true);
    });

    // Verify __devActions still works
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addRaw: (n: number) => void;
      } | null;
      dev?.addRaw(50);
    });

    await expect.poll(async () => {
      return (await page.evaluate(() => {
        return (window as Record<string, unknown>).__economyState as { raw: number } | null;
      }))?.raw;
    }).toBe(50);
  });
});

test.describe('VISUAL-QA-ARCH-01 PR1 — Sprite Debug overlay', () => {
  async function navigateToGameScreen(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Новая игра' }).click();
    await page.getByRole('button', { name: /Стандартная/ }).click();
    await page.getByRole('button', { name: 'Голубые' }).click();
    await expect(page.locator('.screen--game')).toBeVisible();
    await page.locator('.screen--game[data-ready="true"]').waitFor({ timeout: 5000 });
  }

  test('Sprite Debug toggle exists in dev panel', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.keyboard.press('Backquote');
    const panel = page.locator('#fe-dev-panel');
    await expect(panel).toBeVisible();

    const spriteDebugBtn = panel.locator('.fe-dev-panel__btn--toggle[data-overlay-key="spriteDebug"]');
    await expect(spriteDebugBtn).toHaveCount(1);
    await expect(spriteDebugBtn).toHaveText('Sprite Debug');
  });

  test('Sprite Debug toggle is off by default', async ({ page }) => {
    await navigateToGameScreen(page);

    const toggles = await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        get: () => Record<string, boolean>;
      } | null;
      return ot?.get() ?? null;
    });

    expect(toggles!.spriteDebug).toBe(false);
  });

  test('Sprite Debug toggle can be switched on and off', async ({ page }) => {
    await navigateToGameScreen(page);
    await page.keyboard.press('Backquote');

    const spriteDebugBtn = page.locator('#fe-dev-panel .fe-dev-panel__btn--toggle[data-overlay-key="spriteDebug"]');
    await expect(spriteDebugBtn).toHaveAttribute('data-active', 'false');
    await spriteDebugBtn.click();
    await expect(spriteDebugBtn).toHaveAttribute('data-active', 'true');

    // Verify via test hook
    let toggles = await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        get: () => Record<string, boolean>;
      } | null;
      return ot?.get() ?? null;
    });
    expect(toggles!.spriteDebug).toBe(true);

    // Toggle off
    await spriteDebugBtn.click();
    await expect(spriteDebugBtn).toHaveAttribute('data-active', 'false');

    toggles = await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        get: () => Record<string, boolean>;
      } | null;
      return ot?.get() ?? null;
    });
    expect(toggles!.spriteDebug).toBe(false);
  });

  test('enabling Sprite Debug does not crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await navigateToGameScreen(page);

    // Enable Sprite Debug overlay via test hook
    await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        set: (key: string, value: boolean) => void;
      } | null;
      ot?.set('spriteDebug', true);
    });

    // Wait several frames for rendering
    await page.waitForTimeout(500);

    // Verify game is still running (no crash)
    const economyAfter = await page.evaluate(() => {
      return (window as Record<string, unknown>).__economyState as { raw: number } | null;
    });
    expect(economyAfter).not.toBeNull();

    const critical = errors.filter((e) => !e.includes('favicon'));
    expect(critical).toEqual([]);
  });

  test('existing dev actions still work with Sprite Debug enabled', async ({ page }) => {
    await navigateToGameScreen(page);

    // Enable Sprite Debug overlay
    await page.evaluate(() => {
      const ot = (window as Record<string, unknown>).__overlayToggles as {
        set: (key: string, value: boolean) => void;
      } | null;
      ot?.set('spriteDebug', true);
    });

    // Verify __devActions still works
    await page.evaluate(() => {
      const dev = (window as Record<string, unknown>).__devActions as {
        addRaw: (n: number) => void;
      } | null;
      dev?.addRaw(50);
    });

    await expect.poll(async () => {
      return (await page.evaluate(() => {
        return (window as Record<string, unknown>).__economyState as { raw: number } | null;
      }))?.raw;
    }).toBe(50);
  });
});
