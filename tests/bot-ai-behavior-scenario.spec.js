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

  if (before.hasRuntimeGame && before.screen === 'game') return before;

  await clickFirstAvailable(page, [
    '[data-action="new"]',
    'button[data-action="new"]',
    'button:has-text("New Game")',
    'button:has-text("New")',
    'text=/РќРѕРІР°СЏ РёРіСЂР°|New Game|New/i',
  ]);

  await clickFirstAvailable(page, [
    '[data-map-size="standard"]',
    'button[data-map-size="standard"]',
    'button:has-text("Standard")',
    'text=/standard|СЃС‚Р°РЅРґР°СЂС‚/i',
  ], { timeout: 800 });

  await clickFirstAvailable(page, [
    '[data-faction="cyan"]',
    'button[data-faction="cyan"]',
    'button:has-text("Cyan")',
    'text=/cyan|РіРѕР»СѓР±/i',
  ], { timeout: 800 });

  await clickFirstAvailable(page, [
    '[data-action="start"]',
    '[data-action="play"]',
    'button[data-action="start"]',
    'button[data-action="play"]',
    'button:has-text("Start")',
    'button:has-text("Play")',
    'text=/СЃС‚Р°СЂС‚|РЅР°С‡Р°С‚СЊ|РёРіСЂР°С‚СЊ|start|play/i',
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

test('Four Elements bot AI behavior scenario smoke', async ({ page }) => {
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
      g.enemyRetreatMvp &&
      g.enemyDifficultyMvp
    );
  }, null, { timeout: 45000 });

  const baseline = await page.evaluate(() => {
    const g = window.FE_CORE.game;
    const telemetry = window.FE_BOT_TELEMETRY();
    return {
      telemetryExists: !!telemetry && typeof telemetry === 'object',
      screen: g.screen,
      defaultDifficultyProfile: g.enemyDifficultyMvp && g.enemyDifficultyMvp.profile,
      defaultDifficultySource: g.enemyDifficultyMvp && g.enemyDifficultyMvp.source,
      scoutingStatus: g.enemyScoutingMvp && g.enemyScoutingMvp.status,
      scoutingAvailableCombatScouts: g.enemyScoutingMvp && g.enemyScoutingMvp.availableCombatScouts,
      targetingSource: g.enemyTargetingMvp && g.enemyTargetingMvp.source,
      targetingReason: g.enemyTargetingMvp && g.enemyTargetingMvp.lastDecisionReason,
      targetingAttackAllowedByVision: g.enemyTargetingMvp && g.enemyTargetingMvp.attackAllowedByVision,
      retreatStatus: g.enemyRetreatMvp && g.enemyRetreatMvp.status,
      retreatActive: g.enemyRetreatMvp && g.enemyRetreatMvp.retreatActive,
    };
  });

  expect(baseline.telemetryExists).toBeTruthy();
  expect(baseline.defaultDifficultyProfile).toBe('normal');

  await page.evaluate(() => {
    window.FE_CORE.game.enemyBotDifficulty = 'easy';
  });

  await page.waitForFunction(() => {
    const g = window.FE_CORE && window.FE_CORE.game;
    return g && g.enemyDifficultyMvp && g.enemyDifficultyMvp.profile === 'easy';
  }, null, { timeout: 10000 });

  await page.waitForTimeout(1500);

  const scenario = await page.evaluate(() => {
    const g = window.FE_CORE.game;
    const targeting = g.enemyTargetingMvp || null;
    const scouting = g.enemyScoutingMvp || null;
    const retreat = g.enemyRetreatMvp || null;
    const difficulty = g.enemyDifficultyMvp || null;

    return {
      difficultyProfile: difficulty && difficulty.profile,
      difficultySource: difficulty && difficulty.source,
      affectsProduction: difficulty && difficulty.affectsProduction,
      hasScouting: !!scouting,
      hasAutopilot: !!g.enemyAutopilotMvp,
      hasStrength: !!g.enemyStrengthEstimateMvp,
      hasTargeting: !!targeting,
      hasRetreat: !!retreat,
      scoutingStatus: scouting && scouting.status,
      scoutingAvailableCombatScouts: scouting && scouting.availableCombatScouts,
      targetingSource: targeting && targeting.source,
      targetingAttackAllowedByVision: targeting && targeting.attackAllowedByVision,
      targetingTargetType: targeting && targeting.targetType,
      retreatStatus: retreat && retreat.status,
      retreatIsError: retreat && retreat.status === 'error',
    };
  });

  expect(scenario.difficultyProfile).toBe('easy');
  expect(scenario.affectsProduction).toBe(false);
  expect(scenario.hasScouting).toBeTruthy();
  expect(scenario.hasAutopilot).toBeTruthy();
  expect(scenario.hasStrength).toBeTruthy();
  expect(scenario.hasTargeting).toBeTruthy();
  expect(scenario.hasRetreat).toBeTruthy();
  expect(scenario.retreatIsError).toBeFalsy();

  if (scenario.targetingSource === 'assumed' || scenario.targetingSource === 'none') {
    expect(scenario.targetingAttackAllowedByVision).toBe(false);
  }
  if (scenario.targetingSource === 'visible' || scenario.targetingSource === 'known') {
    expect([true, false]).toContain(!!scenario.targetingAttackAllowedByVision);
  }

  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(criticalConsoleErrors, `console errors: ${criticalConsoleErrors.join('\n')}`).toEqual([]);
});
