// PATCH-TEST-01C-FIX-BOT-AI-SMOKE-RUNTIME-GAME-WAIT
// Bot AI telemetry smoke.
//
// This version avoids requiring window.FE_CORE.game before entering a skirmish.

const { test, expect } = require('@playwright/test');

async function clickFirstAvailable(page, selectors, options = {}) {
  const timeout = options.timeout || 1200;
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.count()) {
        const visible = await locator.isVisible({ timeout }).catch(() => false);
        if (visible) {
          await locator.click({ timeout });
          await page.waitForTimeout(options.afterClickMs || 250);
          return selector;
        }
      }
    } catch (_) {}
  }
  return null;
}

async function enterStandardSkirmishIfNeeded(page) {
  const before = await page.evaluate(() => {
    const g = window.FE_CORE && window.FE_CORE.game;
    return {
      hasFeCore: !!window.FE_CORE,
      hasRuntimeGame: !!g,
      screen: g ? g.screen : null,
      skirmishMode: g ? g.skirmishMode : null,
    };
  });

  if (before.hasRuntimeGame && before.screen === 'game') {
    return before;
  }

  await clickFirstAvailable(page, [
    '[data-action="new"]',
    'button[data-action="new"]',
    'button:has-text("Новая игра")',
    'button:has-text("Новая")',
    'button:has-text("New Game")',
    'button:has-text("New")',
    'text=/Новая игра|New Game|New/i',
  ]);

  await clickFirstAvailable(page, [
    '[data-map-size="standard"]',
    '[data-size="standard"]',
    'button[data-map-size="standard"]',
    'button:has-text("standard")',
    'button:has-text("Standard")',
    'button:has-text("Стандарт")',
    'text=/standard|стандарт/i',
  ], { timeout: 800 });

  await clickFirstAvailable(page, [
    '[data-faction="cyan"]',
    '[data-color="cyan"]',
    'button[data-faction="cyan"]',
    'button:has-text("cyan")',
    'button:has-text("Cyan")',
    'button:has-text("Голуб")',
    'text=/cyan|голуб/i',
  ], { timeout: 800 });

  await clickFirstAvailable(page, [
    '[data-action="start"]',
    '[data-action="play"]',
    'button[data-action="start"]',
    'button[data-action="play"]',
    'button:has-text("Старт")',
    'button:has-text("Начать")',
    'button:has-text("Играть")',
    'button:has-text("Start")',
    'button:has-text("Play")',
    'text=/старт|начать|играть|start|play/i',
  ], { timeout: 800 });

  await page.waitForFunction(() => {
    const g = window.FE_CORE && window.FE_CORE.game;
    return !!g && g.screen === 'game';
  }, null, { timeout: 30000 });

  return page.evaluate(() => {
    const g = window.FE_CORE && window.FE_CORE.game;
    return {
      hasFeCore: !!window.FE_CORE,
      hasRuntimeGame: !!g,
      screen: g ? g.screen : null,
      skirmishMode: g ? g.skirmishMode : null,
    };
  });
}

test('Four Elements bot AI telemetry smoke', async ({ page }) => {
  const criticalConsoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text() || '';
    if (/favicon|DevTools|Failed to load resource/i.test(text)) return;
    if (/ReferenceError|TypeError|SyntaxError|Uncaught|Error:/i.test(text)) {
      criticalConsoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err && err.message ? err.message : String(err));
  });

  await page.goto('/index.html');

  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 15000 });

  await page.waitForFunction(() => {
    return !!window.FE_CORE && typeof window.FE_BOT_TELEMETRY === 'function';
  }, null, { timeout: 15000 });

  const entered = await enterStandardSkirmishIfNeeded(page);

  expect(entered.hasFeCore).toBeTruthy();
  expect(entered.hasRuntimeGame).toBeTruthy();
  expect(entered.screen).toBe('game');

  await page.waitForFunction(() => {
    const g = window.FE_CORE && window.FE_CORE.game;
    if (!g || g.screen !== 'game') return false;

    return !!(
      g.enemyScoutingMvp &&
      g.enemyAutopilotMvp &&
      g.enemyStrengthEstimateMvp &&
      g.enemyTargetingMvp &&
      g.enemyRetreatMvp
    );
  }, null, { timeout: 45000 });

  const result = await page.evaluate(() => {
    const telemetryResult = window.FE_BOT_TELEMETRY();
    const g = window.FE_CORE.game;
    return {
      telemetryResultIsObject: !!telemetryResult && typeof telemetryResult === 'object',
      screen: g.screen,
      skirmishMode: g.skirmishMode,
      hasScouting: !!g.enemyScoutingMvp,
      hasAutopilot: !!g.enemyAutopilotMvp,
      hasStrength: !!g.enemyStrengthEstimateMvp,
      hasTargeting: !!g.enemyTargetingMvp,
      hasRetreat: !!g.enemyRetreatMvp,
      scoutingStatus: g.enemyScoutingMvp && g.enemyScoutingMvp.status,
      autopilotStatus: g.enemyAutopilotMvp && g.enemyAutopilotMvp.status,
      strengthStatus: g.enemyStrengthEstimateMvp && g.enemyStrengthEstimateMvp.status,
      targetingStatus: g.enemyTargetingMvp && g.enemyTargetingMvp.status,
      retreatStatus: g.enemyRetreatMvp && g.enemyRetreatMvp.status,
    };
  });

  expect(result.telemetryResultIsObject).toBeTruthy();
  expect(result.hasScouting).toBeTruthy();
  expect(result.hasAutopilot).toBeTruthy();
  expect(result.hasStrength).toBeTruthy();
  expect(result.hasTargeting).toBeTruthy();
  expect(result.hasRetreat).toBeTruthy();

  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(criticalConsoleErrors, `console errors: ${criticalConsoleErrors.join('\n')}`).toEqual([]);
});
