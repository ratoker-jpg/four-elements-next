// ARCH-AI-05C4 — Tank Decider deterministic smoke test
//
// Verifies that the tank_decider Priority Stack rules fire correctly
// using crafted context objects passed through page.evaluate.
//
// Design:
//   - 100% deterministic — no timing, no bot progression, no RNG
//   - Uses window.FE_TANK_DECIDER.evaluateTankDecision() API directly
//   - No gameplay code changes required
//   - Tests defend_hq, retreat, keep_attacking, stand_and_fight_near_home, idle rules
//   - Validates result shape, action, ruleName, and priority

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** Stub helpers — mirrors the shape provided by main.js context builder. */
function stubHelpers(resolveTargetMap) {
  return {
    isAlive: function (obj) { return obj && (obj.hp || 0) > 0; },
    distTiles: function (a, b) {
      var ax = Number.isFinite(a.x) ? a.x : 0, ay = Number.isFinite(a.y) ? a.y : 0;
      var bx = Number.isFinite(b.x) ? b.x : 0, by = Number.isFinite(b.y) ? b.y : 0;
      return Math.abs(ax - bx) + Math.abs(ay - by);
    },
    resolveTarget: function (id) {
      if (!id || !resolveTargetMap) return null;
      return resolveTargetMap[id] || null;
    },
    getCombatStats: function () {
      return { range: 4, damage: 18, cooldown: 0.75, maxHp: 160 };
    }
  };
}

// ---------------------------------------------------------------------------
// Test 1: Module loads and API is available
// ---------------------------------------------------------------------------

test('FE_TANK_DECIDER module is available on window after page load', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const api = await page.evaluate(() => {
    var td = window.FE_TANK_DECIDER;
    if (!td) return { available: false };
    return {
      available: true,
      hasEvaluate: typeof td.evaluateTankDecision === 'function',
      hasActions: !!td.TANK_DECIDER_ACTIONS,
      hasRuleNames: !!td.TANK_DECIDER_RULE_NAMES,
      hasConstants: !!td.TANK_DECIDER_CONSTANTS,
      hasIsValidContext: typeof td.isValidContext === 'function',
      hasIsValidResult: typeof td.isValidDecisionResult === 'function'
    };
  });

  expect(api.available, 'window.FE_TANK_DECIDER should exist').toBe(true);
  expect(api.hasEvaluate, 'evaluateTankDecision should be a function').toBe(true);
  expect(api.hasActions, 'TANK_DECIDER_ACTIONS should exist').toBe(true);
  expect(api.hasRuleNames, 'TANK_DECIDER_RULE_NAMES should exist').toBe(true);
  expect(api.hasConstants, 'TANK_DECIDER_CONSTANTS should exist').toBe(true);
  expect(api.hasIsValidContext, 'isValidContext should be a function').toBe(true);
  expect(api.hasIsValidResult, 'isValidDecisionResult should be a function').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 2: defend_hq fires when player threats near enemy HQ
// ---------------------------------------------------------------------------

test('defend_hq fires when player threats are near enemy HQ', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var C = window.FE_TANK_DECIDER.TANK_DECIDER_CONSTANTS;
    var helpers = {
      isAlive: function (o) { return o && (o.hp || 0) > 0; },
      distTiles: function (a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); },
      resolveTarget: function (id) { return id === 'pt1' ? { id: 'pt1', hp: 160, x: 7, y: 7 } : null; },
      getCombatStats: function () { return { range: 4, damage: 18, cooldown: 0.75, maxHp: 160 }; }
    };

    return window.FE_TANK_DECIDER.evaluateTankDecision({
      tank: {
        id: 'et1', type: 'light_tank', hp: 120, maxHp: 160, x: 5, y: 5,
        state: 'idle', command: null,
        attackTargetId: null, attackApproachTargetId: null, attackTarget: null,
        hasPath: false,
        _attack10WaveLocked: false, _attack11IntelRally: null,
        _fe10h1Role: null, _attackCommanded: false
      },
      botState: { phase: 'defend', homeX: 3, homeY: 3, _attack02HqPush: false },
      homeBase: { x: 3, y: 3, hp: 500, id: 'ehq' },
      threatsNearHome: [{ unit: { id: 'pt1', hp: 160, x: 7, y: 7 }, distance: 4 }],
      nearbyThreats: [],
      helpers: helpers,
      now: 0, gameTime: 0
    });
  });

  expect(result, 'Result should not be null').not.toBeNull();
  expect(result.action, 'Action should be defend_hq').toBe('defend_hq');
  expect(result.ruleName, 'Rule name should be defend_hq_if_base_threatened').toBe('defend_hq_if_base_threatened');
  expect(result.priority, 'Priority should be 100').toBe(100);
  expect(result.suppressLegacyOrders, 'Should suppress legacy orders').toBe(true);
  expect(result.targetId, 'Should target the player threat').toBe('pt1');
});

// ---------------------------------------------------------------------------
// Test 3: retreat fires when HP is critically low
// ---------------------------------------------------------------------------

test('retreat fires when HP is critically low (< 25%)', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    return window.FE_TANK_DECIDER.evaluateTankDecision({
      tank: {
        id: 'et2', type: 'light_tank', hp: 20, maxHp: 160, x: 50, y: 50,
        state: 'idle', command: null,
        attackTargetId: null, attackApproachTargetId: null, attackTarget: null,
        hasPath: false,
        _attack10WaveLocked: false, _attack11IntelRally: null,
        _fe10h1Role: null, _attackCommanded: false
      },
      botState: { phase: 'attack', homeX: 3, homeY: 3, _attack02HqPush: false },
      homeBase: { x: 3, y: 3, hp: 500, id: 'ehq' },
      threatsNearHome: [],
      nearbyThreats: [],
      helpers: {
        isAlive: function (o) { return o && (o.hp || 0) > 0; },
        distTiles: function (a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); },
        resolveTarget: function () { return null; },
        getCombatStats: function () { return { range: 4, damage: 18, cooldown: 0.75, maxHp: 160 }; }
      },
      now: 0, gameTime: 0
    });
  });

  expect(result, 'Result should not be null').not.toBeNull();
  expect(result.action, 'Action should be retreat').toBe('retreat');
  expect(result.ruleName, 'Rule name should be retreat_if_losing_or_overextended').toBe('retreat_if_losing_or_overextended');
  expect(result.priority, 'Priority should be 90').toBe(90);
  expect(result.suppressLegacyOrders, 'Should suppress legacy orders').toBe(true);
  // Retreat target should be home base position
  expect(result.targetX, 'Target X should be home base X').toBe(3);
  expect(result.targetY, 'Target Y should be home base Y').toBe(3);
});

// ---------------------------------------------------------------------------
// Test 4: keep_attacking fires when tank has valid active target
// ---------------------------------------------------------------------------

test('keep_attacking fires when tank has valid active attack target', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var targetMap = {
      'pt2': { id: 'pt2', hp: 100, x: 10, y: 10 }
    };
    return window.FE_TANK_DECIDER.evaluateTankDecision({
      tank: {
        id: 'et3', type: 'light_tank', hp: 120, maxHp: 160, x: 8, y: 8,
        state: 'attacking', command: 'attack',
        attackTargetId: 'pt2', attackApproachTargetId: null,
        attackTarget: { id: 'pt2', hp: 100, x: 10, y: 10 },
        hasPath: false,
        _attack10WaveLocked: false, _attack11IntelRally: null,
        _fe10h1Role: null, _attackCommanded: false
      },
      botState: { phase: 'attack', homeX: 3, homeY: 3, _attack02HqPush: false },
      homeBase: { x: 3, y: 3, hp: 500, id: 'ehq' },
      threatsNearHome: [],
      nearbyThreats: [],
      helpers: {
        isAlive: function (o) { return o && (o.hp || 0) > 0; },
        distTiles: function (a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); },
        resolveTarget: function (id) { return targetMap[id] || null; },
        getCombatStats: function () { return { range: 4, damage: 18, cooldown: 0.75, maxHp: 160 }; }
      },
      now: 0, gameTime: 0
    });
  });

  expect(result, 'Result should not be null').not.toBeNull();
  expect(result.action, 'Action should be keep_attacking').toBe('keep_attacking');
  expect(result.ruleName, 'Rule name should be keep_attacking_valid_current_target').toBe('keep_attacking_valid_current_target');
  expect(result.priority, 'Priority should be 80').toBe(80);
  expect(result.suppressLegacyOrders, 'Should suppress legacy orders').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 5: stand_and_fight_near_home fires when tank near home with target in range
// ---------------------------------------------------------------------------

test('stand_and_fight_near_home fires when tank near home with target in range', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var targetMap = {
      'pt3': { id: 'pt3', hp: 100, x: 6, y: 6 }
    };
    return window.FE_TANK_DECIDER.evaluateTankDecision({
      tank: {
        id: 'et4', type: 'light_tank', hp: 120, maxHp: 160, x: 5, y: 5,
        state: 'attacking', command: 'attack',
        attackTargetId: 'pt3', attackApproachTargetId: null,
        attackTarget: { id: 'pt3', hp: 100, x: 6, y: 6 },
        hasPath: false,
        _attack10WaveLocked: false, _attack11IntelRally: null,
        _fe10h1Role: null, _attackCommanded: false
      },
      botState: { phase: 'attack', homeX: 3, homeY: 3, _attack02HqPush: false },
      homeBase: { x: 3, y: 3, hp: 500, id: 'ehq' },
      threatsNearHome: [],
      nearbyThreats: [],
      helpers: {
        isAlive: function (o) { return o && (o.hp || 0) > 0; },
        distTiles: function (a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); },
        resolveTarget: function (id) { return targetMap[id] || null; },
        getCombatStats: function () { return { range: 4, damage: 18, cooldown: 0.75, maxHp: 160 }; }
      },
      now: 0, gameTime: 0
    });
  });

  expect(result, 'Result should not be null').not.toBeNull();
  expect(result.action, 'Action should be keep_attacking (stand_and_fight reuses action)').toBe('keep_attacking');
  expect(result.ruleName, 'Rule name should be stand_and_fight_near_home').toBe('stand_and_fight_near_home');
  expect(result.priority, 'Priority should be 95').toBe(95);
  expect(result.suppressLegacyOrders, 'Should suppress legacy orders').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 6: idle fires when no conditions match
// ---------------------------------------------------------------------------

test('idle is the fallback when no rule conditions match', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    return window.FE_TANK_DECIDER.evaluateTankDecision({
      tank: {
        id: 'et5', type: 'light_tank', hp: 120, maxHp: 160, x: 5, y: 5,
        state: 'idle', command: null,
        attackTargetId: null, attackApproachTargetId: null, attackTarget: null,
        hasPath: false,
        _attack10WaveLocked: false, _attack11IntelRally: null,
        _fe10h1Role: null, _attackCommanded: false
      },
      botState: { phase: 'build', homeX: 3, homeY: 3, _attack02HqPush: false },
      homeBase: { x: 3, y: 3, hp: 500, id: 'ehq' },
      threatsNearHome: [],
      nearbyThreats: [],
      helpers: {
        isAlive: function (o) { return o && (o.hp || 0) > 0; },
        distTiles: function (a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); },
        resolveTarget: function () { return null; },
        getCombatStats: function () { return { range: 4, damage: 18, cooldown: 0.75, maxHp: 160 }; }
      },
      now: 0, gameTime: 0
    });
  });

  expect(result, 'Result should not be null').not.toBeNull();
  expect(result.action, 'Action should be idle').toBe('idle');
  expect(result.ruleName, 'Rule name should be idle_fallback').toBe('idle_fallback');
  expect(result.priority, 'Priority should be 10').toBe(10);
  expect(result.suppressLegacyOrders, 'Idle should NOT suppress legacy orders').toBe(false);
});

// ---------------------------------------------------------------------------
// Test 7: intel-rally guard prevents defend_hq recall
// ---------------------------------------------------------------------------

test('intel-rally tanks are NOT recalled by defend_hq even with threats near HQ', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    return window.FE_TANK_DECIDER.evaluateTankDecision({
      tank: {
        id: 'et6', type: 'light_tank', hp: 120, maxHp: 160, x: 5, y: 5,
        state: 'idle', command: null,
        attackTargetId: null, attackApproachTargetId: null, attackTarget: null,
        hasPath: false,
        _attack10WaveLocked: false, _attack11IntelRally: true,  // ← intel-rally active
        _fe10h1Role: null, _attackCommanded: false
      },
      botState: { phase: 'defend', homeX: 3, homeY: 3, _attack02HqPush: false },
      homeBase: { x: 3, y: 3, hp: 500, id: 'ehq' },
      threatsNearHome: [{ unit: { id: 'pt4', hp: 160, x: 7, y: 7 }, distance: 4 }],
      nearbyThreats: [],
      helpers: {
        isAlive: function (o) { return o && (o.hp || 0) > 0; },
        distTiles: function (a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); },
        resolveTarget: function (id) { return id === 'pt4' ? { id: 'pt4', hp: 160, x: 7, y: 7 } : null; },
        getCombatStats: function () { return { range: 4, damage: 18, cooldown: 0.75, maxHp: 160 }; }
      },
      now: 0, gameTime: 0
    });
  });

  expect(result, 'Result should not be null').not.toBeNull();
  expect(result.action, 'Intel-rally tank should NOT get defend_hq').not.toBe('defend_hq');
  expect(result.ruleName, 'Intel-rally tank should NOT get defend_hq rule').not.toBe('defend_hq_if_base_threatened');
  // Should fall through to idle since no attack target and no other rule matches
  expect(result.action, 'Should fall through to idle').toBe('idle');
});

// ---------------------------------------------------------------------------
// Test 8: Result shape validation via isValidDecisionResult
// ---------------------------------------------------------------------------

test('all evaluateTankDecision results pass isValidDecisionResult', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const validations = await page.evaluate(() => {
    var td = window.FE_TANK_DECIDER;
    var baseCtx = {
      tank: {
        id: 'et7', type: 'light_tank', hp: 120, maxHp: 160, x: 5, y: 5,
        state: 'idle', command: null,
        attackTargetId: null, attackApproachTargetId: null, attackTarget: null,
        hasPath: false,
        _attack10WaveLocked: false, _attack11IntelRally: null,
        _fe10h1Role: null, _attackCommanded: false
      },
      botState: { phase: 'build', homeX: 3, homeY: 3, _attack02HqPush: false },
      homeBase: { x: 3, y: 3, hp: 500, id: 'ehq' },
      threatsNearHome: [],
      nearbyThreats: [],
      helpers: {
        isAlive: function (o) { return o && (o.hp || 0) > 0; },
        distTiles: function (a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); },
        resolveTarget: function () { return null; },
        getCombatStats: function () { return { range: 4, damage: 18, cooldown: 0.75, maxHp: 160 }; }
      },
      now: 0, gameTime: 0
    };

    // Test idle result
    var idleResult = td.evaluateTankDecision(baseCtx);
    var idleValid = td.isValidDecisionResult(idleResult);

    // Test invalid context
    var badResult = td.evaluateTankDecision(null);
    var badValid = td.isValidDecisionResult(badResult);

    // Test invalid context validation
    var ctxValid = td.isValidContext(null);

    return {
      idleResultValid: idleValid,
      badResultValid: badValid,
      nullContextInvalid: ctxValid === false,
      idleHasAction: !!idleResult && typeof idleResult.action === 'string',
      idleHasPriority: !!idleResult && typeof idleResult.priority === 'number',
      idleHasRuleName: !!idleResult && typeof idleResult.ruleName === 'string',
      idleHasSuppress: !!idleResult && typeof idleResult.suppressLegacyOrders === 'boolean'
    };
  });

  expect(validations.idleResultValid, 'Idle result should be valid').toBe(true);
  expect(validations.badResultValid, 'Null-context result should be valid (returns idle fallback)').toBe(true);
  expect(validations.nullContextInvalid, 'Null context should fail isValidContext').toBe(true);
  expect(validations.idleHasAction, 'Result should have action field').toBe(true);
  expect(validations.idleHasPriority, 'Result should have priority field').toBe(true);
  expect(validations.idleHasRuleName, 'Result should have ruleName field').toBe(true);
  expect(validations.idleHasSuppress, 'Result should have suppressLegacyOrders field').toBe(true);
});
