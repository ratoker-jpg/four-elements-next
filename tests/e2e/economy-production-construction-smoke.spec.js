// ARCH-LAB-06-BUNDLE — Economy / Production / Construction deterministic smoke test
//
// Verifies that the economy_system, production_system, and construction_system
// contract modules load correctly, expose expected APIs, and produce correct
// results for factory, validator, and decision helper functions.
//
// Design:
//   - 100% deterministic — no timing, no bot progression, no RNG
//   - Uses window.FE_ECONOMY_SYSTEM, FE_PRODUCTION_SYSTEM, FE_CONSTRUCTION_SYSTEM
//     APIs directly via page.evaluate
//   - No gameplay code changes required
//   - Also verifies config enrichment in FE_BUILDINGS and FE_UNITS

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Test 1: All three modules are available on window after page load
// ---------------------------------------------------------------------------

test('FE_ECONOMY_SYSTEM, FE_PRODUCTION_SYSTEM, FE_CONSTRUCTION_SYSTEM are available', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const modules = await page.evaluate(() => {
    return {
      economy:     !!window.FE_ECONOMY_SYSTEM,
      production:  !!window.FE_PRODUCTION_SYSTEM,
      construction:!!window.FE_CONSTRUCTION_SYSTEM
    };
  });

  expect(modules.economy,      'window.FE_ECONOMY_SYSTEM should exist').toBe(true);
  expect(modules.production,   'window.FE_PRODUCTION_SYSTEM should exist').toBe(true);
  expect(modules.construction, 'window.FE_CONSTRUCTION_SYSTEM should exist').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 2: Economy system constants and factory shapes
// ---------------------------------------------------------------------------

test('FE_ECONOMY_SYSTEM has correct constants and factory shapes', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var eco = window.FE_ECONOMY_SYSTEM;

    // Check separator constants
    var sepConstants = {
      inputMinerals: eco.SEPARATOR_INPUT_MINERALS,
      outputEnergy:  eco.SEPARATOR_OUTPUT_ENERGY,
      outputElement: eco.SEPARATOR_OUTPUT_ELEMENT,
      cycleSeconds:  eco.SEPARATOR_CYCLE_SECONDS
    };

    // Check RESOURCE_TYPES
    var rt = eco.RESOURCE_TYPES;
    var resourceTypes = !!(rt && rt.MINERALS && rt.ENERGY && rt.PURPLE && rt.GREEN_EL && rt.CYAN_EL && rt.YELLOW_EL);

    // Check POWER_STATES
    var ps = eco.POWER_STATES;
    var powerStates = !!(ps && ps.NOMINAL && ps.DEFICIT && ps.OFFLINE);

    // Check SEPARATOR_STATES
    var ss = eco.SEPARATOR_STATES;
    var separatorStates = !!(ss && ss.ACTIVE && ss.IDLE && ss.POWERED_DOWN);

    // Check factory functions exist
    var factories = {
      createResourceSnapshot:   typeof eco.createResourceSnapshot === 'function',
      createPowerStateSnapshot: typeof eco.createPowerStateSnapshot === 'function',
      createSeparatorState:     typeof eco.createSeparatorState === 'function'
    };

    // Check validator functions exist
    var validators = {
      isValidResourceSnapshot:  typeof eco.isValidResourceSnapshot === 'function',
      isValidPowerStateSnapshot:typeof eco.isValidPowerStateSnapshot === 'function'
    };

    // Check decision helpers exist
    var helpers = {
      canAffordResource:       typeof eco.canAffordResource === 'function',
      calculateRemainingCapacity:typeof eco.calculateRemainingCapacity === 'function',
      isSeparatorCycleReady:   typeof eco.isSeparatorCycleReady === 'function'
    };

    return { sepConstants, resourceTypes, powerStates, separatorStates, factories, validators, helpers };
  });

  // Separator constants
  expect(result.sepConstants.inputMinerals, 'SEPARATOR_INPUT_MINERALS should be 15').toBe(15);
  expect(result.sepConstants.outputEnergy,  'SEPARATOR_OUTPUT_ENERGY should be 10').toBe(10);
  expect(result.sepConstants.outputElement,  'SEPARATOR_OUTPUT_ELEMENT should be 1').toBe(1);
  expect(result.sepConstants.cycleSeconds,  'SEPARATOR_CYCLE_SECONDS should be 6.0').toBe(6.0);

  // Enum-like constants
  expect(result.resourceTypes,   'RESOURCE_TYPES should have all keys').toBe(true);
  expect(result.powerStates,     'POWER_STATES should have all keys').toBe(true);
  expect(result.separatorStates, 'SEPARATOR_STATES should have all keys').toBe(true);

  // Factory functions
  expect(result.factories.createResourceSnapshot,   'createResourceSnapshot should be function').toBe(true);
  expect(result.factories.createPowerStateSnapshot, 'createPowerStateSnapshot should be function').toBe(true);
  expect(result.factories.createSeparatorState,     'createSeparatorState should be function').toBe(true);

  // Validators
  expect(result.validators.isValidResourceSnapshot,   'isValidResourceSnapshot should be function').toBe(true);
  expect(result.validators.isValidPowerStateSnapshot, 'isValidPowerStateSnapshot should be function').toBe(true);

  // Helpers
  expect(result.helpers.canAffordResource,        'canAffordResource should be function').toBe(true);
  expect(result.helpers.calculateRemainingCapacity,'calculateRemainingCapacity should be function').toBe(true);
  expect(result.helpers.isSeparatorCycleReady,     'isSeparatorCycleReady should be function').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 3: Economy factory functions produce valid shapes
// ---------------------------------------------------------------------------

test('Economy factory functions produce valid snapshots', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var eco = window.FE_ECONOMY_SYSTEM;

    var snapshot = eco.createResourceSnapshot(
      { minerals: 100, energy: 50, purple: 3, greenEl: 0, cyanEl: 1, yellowEl: 0 },
      { minerals: 400, energy: 600, purple: 40, greenEl: 40, cyanEl: 40, yellowEl: 40 }
    );
    var snapValid = eco.isValidResourceSnapshot(snapshot);

    var powerSnap = eco.createPowerStateSnapshot({ supplyMw: 35, demandMw: 20 });
    var powerValid = eco.isValidPowerStateSnapshot(powerSnap);

    var sepState = eco.createSeparatorState({ state: 'active', cycleProgress: 0.5, cyclesCompleted: 3 });

    return { snapshot, snapValid, powerSnap, powerValid, sepState };
  });

  // Resource snapshot
  expect(result.snapshot.minerals, 'snapshot.minerals should be 100').toBe(100);
  expect(result.snapshot.energy,   'snapshot.energy should be 50').toBe(50);
  expect(result.snapshot.caps.minerals, 'snapshot.caps.minerals should be 400').toBe(400);
  expect(result.snapValid, 'resource snapshot should be valid').toBe(true);

  // Power snapshot
  expect(result.powerSnap.supplyMw, 'power supplyMw should be 35').toBe(35);
  expect(result.powerSnap.demandMw, 'power demandMw should be 20').toBe(20);
  expect(result.powerSnap.state,    'power state should be nominal').toBe('nominal');
  expect(result.powerValid,         'power snapshot should be valid').toBe(true);

  // Separator state
  expect(result.sepState.state,           'separator state should be active').toBe('active');
  expect(result.sepState.cycleProgress,   'separator progress should be 0.5').toBe(0.5);
  expect(result.sepState.cyclesCompleted, 'separator cycles should be 3').toBe(3);
});

// ---------------------------------------------------------------------------
// Test 4: Economy canAffordResource and calculateRemainingCapacity
// ---------------------------------------------------------------------------

test('Economy canAffordResource and calculateRemainingCapacity work correctly', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var eco = window.FE_ECONOMY_SYSTEM;

    var snapshot = eco.createResourceSnapshot(
      { minerals: 100, energy: 50, purple: 3, greenEl: 0, cyanEl: 0, yellowEl: 0 },
      { minerals: 400, energy: 600, purple: 40, greenEl: 40, cyanEl: 40, yellowEl: 40 }
    );

    // Can afford
    var canAffordCheap  = eco.canAffordResource(snapshot, { energy: 30 });
    var canAffordExact  = eco.canAffordResource(snapshot, { minerals: 100 });
    var cannotAffordExpensive = eco.canAffordResource(snapshot, { energy: 200 });
    var cannotAffordMissing   = eco.canAffordResource(snapshot, { purple: 5 });

    // Remaining capacity
    var mineralsCap = eco.calculateRemainingCapacity(snapshot, 'minerals');
    var energyCap   = eco.calculateRemainingCapacity(snapshot, 'energy');
    var purpleCap   = eco.calculateRemainingCapacity(snapshot, 'purple');

    return { canAffordCheap, canAffordExact, cannotAffordExpensive, cannotAffordMissing,
             mineralsCap, energyCap, purpleCap };
  });

  expect(result.canAffordCheap,          'should afford 30 energy with 50').toBe(true);
  expect(result.canAffordExact,          'should afford 100 minerals with 100').toBe(true);
  expect(result.cannotAffordExpensive,   'should NOT afford 200 energy with 50').toBe(false);
  expect(result.cannotAffordMissing,     'should NOT afford 5 purple with 3').toBe(false);
  expect(result.mineralsCap, 'minerals remaining should be 300').toBe(300);
  expect(result.energyCap,   'energy remaining should be 550').toBe(550);
  expect(result.purpleCap,   'purple remaining should be 37').toBe(37);
});

// ---------------------------------------------------------------------------
// Test 5: Economy isSeparatorCycleReady
// ---------------------------------------------------------------------------

test('Economy isSeparatorCycleReady returns correct value', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var eco = window.FE_ECONOMY_SYSTEM;
    var ready   = eco.isSeparatorCycleReady({ cycleProgress: 1.0 });
    var notReady = eco.isSeparatorCycleReady({ cycleProgress: 0.75 });
    var nullCheck = eco.isSeparatorCycleReady(null);
    return { ready, notReady, nullCheck };
  });

  expect(result.ready,    'progress 1.0 should be cycle ready').toBe(true);
  expect(result.notReady, 'progress 0.75 should NOT be cycle ready').toBe(false);
  expect(result.nullCheck,'null should NOT be cycle ready').toBe(false);
});

// ---------------------------------------------------------------------------
// Test 6: Production system constants and factory shapes
// ---------------------------------------------------------------------------

test('FE_PRODUCTION_SYSTEM has correct constants and factory shapes', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var prod = window.FE_PRODUCTION_SYSTEM;

    // Check PRODUCTION_STATES
    var ps = prod.PRODUCTION_STATES;
    var prodStates = !!(ps && ps.QUEUED && ps.BUILDING && ps.PAUSED && ps.COMPLETED && ps.CANCELLED);

    // Check UNIT_TYPES
    var ut = prod.UNIT_TYPES;
    var unitTypes = !!(ut && ut.HARVESTER && ut.BUILDER && ut.LIGHT_TANK && ut.HEAVY_TANK && ut.BOMBER && ut.SCOUT);

    // Queue constants
    var queueMax = prod.MAX_QUEUE_SIZE;
    var cancelRate = prod.CANCEL_REFUND_RATE;

    // Factory functions
    var factories = {
      createProductionQueueItem: typeof prod.createProductionQueueItem === 'function',
      createProductionState:     typeof prod.createProductionState === 'function'
    };

    // Validators
    var validators = {
      isValidProductionQueueItem: typeof prod.isValidProductionQueueItem === 'function',
      isValidProductionState:     typeof prod.isValidProductionState === 'function'
    };

    // Helpers
    var helpers = {
      canAffordUnit:          typeof prod.canAffordUnit === 'function',
      calculateProductionTime:typeof prod.calculateProductionTime === 'function',
      isQueueFull:            typeof prod.isQueueFull === 'function'
    };

    return { prodStates, unitTypes, queueMax, cancelRate, factories, validators, helpers };
  });

  expect(result.prodStates, 'PRODUCTION_STATES should have all keys').toBe(true);
  expect(result.unitTypes,  'UNIT_TYPES should have all keys').toBe(true);
  expect(result.queueMax,   'MAX_QUEUE_SIZE should be 5').toBe(5);
  expect(result.cancelRate, 'CANCEL_REFUND_RATE should be 0.75').toBe(0.75);

  expect(result.factories.createProductionQueueItem, 'createProductionQueueItem should be function').toBe(true);
  expect(result.factories.createProductionState,     'createProductionState should be function').toBe(true);
  expect(result.validators.isValidProductionQueueItem,'isValidProductionQueueItem should be function').toBe(true);
  expect(result.validators.isValidProductionState,   'isValidProductionState should be function').toBe(true);
  expect(result.helpers.canAffordUnit,          'canAffordUnit should be function').toBe(true);
  expect(result.helpers.calculateProductionTime,'calculateProductionTime should be function').toBe(true);
  expect(result.helpers.isQueueFull,            'isQueueFull should be function').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 7: Production factory functions and validators
// ---------------------------------------------------------------------------

test('Production factory functions produce valid items', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var prod = window.FE_PRODUCTION_SYSTEM;

    var item = prod.createProductionQueueItem({
      unitType: 'light_tank', state: 'building', progress: 0.4
    });
    var itemValid = prod.isValidProductionQueueItem(item);

    var state = prod.createProductionState({
      queue: [item], activeUnitType: 'light_tank', factoryId: 'factory_1'
    });
    var stateValid = prod.isValidProductionState(state);

    // Invalid item
    var badItem = prod.createProductionQueueItem({ unitType: '', state: 'queued' });
    var badItemValid = prod.isValidProductionQueueItem(badItem);

    return { item, itemValid, state, stateValid, badItem, badItemValid };
  });

  expect(result.item.unitType, 'item.unitType should be light_tank').toBe('light_tank');
  expect(result.item.state,    'item.state should be building').toBe('building');
  expect(result.item.progress, 'item.progress should be 0.4').toBeCloseTo(0.4);
  expect(result.itemValid,     'item should be valid').toBe(true);

  expect(result.state.queue.length,       'state.queue should have 1 item').toBe(1);
  expect(result.state.activeUnitType,     'state.activeUnitType should be light_tank').toBe('light_tank');
  expect(result.stateValid,               'production state should be valid').toBe(true);

  expect(result.badItemValid, 'empty unitType item should be invalid').not.toBe(true);
});

// ---------------------------------------------------------------------------
// Test 8: Production isQueueFull and canAffordUnit
// ---------------------------------------------------------------------------

test('Production isQueueFull and canAffordUnit work correctly', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var prod = window.FE_PRODUCTION_SYSTEM;
    var eco  = window.FE_ECONOMY_SYSTEM;

    // isQueueFull
    var emptyState = prod.createProductionState({ queue: [] });
    var fullState  = prod.createProductionState({
      queue: [
        prod.createProductionQueueItem({ unitType: 'harvester' }),
        prod.createProductionQueueItem({ unitType: 'builder' }),
        prod.createProductionQueueItem({ unitType: 'light_tank' }),
        prod.createProductionQueueItem({ unitType: 'scout' }),
        prod.createProductionQueueItem({ unitType: 'heavy_tank' })
      ]
    });
    var emptyFull = prod.isQueueFull(emptyState);
    var fullFull  = prod.isQueueFull(fullState);

    // canAffordUnit — need elements
    var richSnapshot = eco.createResourceSnapshot(
      { minerals: 500, energy: 500, purple: 10, greenEl: 10, cyanEl: 10, yellowEl: 10 }
    );
    var poorSnapshot = eco.createResourceSnapshot(
      { minerals: 0, energy: 0, purple: 0, greenEl: 0, cyanEl: 0, yellowEl: 0 }
    );
    var canAffordRich = prod.canAffordUnit('light_tank', richSnapshot);
    var canAffordPoor = prod.canAffordUnit('light_tank', poorSnapshot);

    return { emptyFull, fullFull, canAffordRich, canAffordPoor };
  });

  expect(result.emptyFull,   'empty queue should NOT be full').toBe(false);
  expect(result.fullFull,    '5-item queue should be full').toBe(true);
  expect(result.canAffordRich, 'rich player should afford light_tank').toBe(true);
  expect(result.canAffordPoor, 'poor player should NOT afford light_tank').toBe(false);
});

// ---------------------------------------------------------------------------
// Test 9: Construction system constants and factory shapes
// ---------------------------------------------------------------------------

test('FE_CONSTRUCTION_SYSTEM has correct constants and factory shapes', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var cs = window.FE_CONSTRUCTION_SYSTEM;

    // Check BUILDING_STATES
    var bs = cs.BUILDING_STATES;
    var buildingStates = !!(bs && bs.ACTIVE && bs.DAMAGED && bs.DESTROYED && bs.PLANNED);

    // Check CONSTRUCTION_STATES
    var cos = cs.CONSTRUCTION_STATES;
    var constructionStates = !!(cos && cos.NOT_STARTED && cos.IN_PROGRESS && cos.PAUSED && cos.COMPLETED && cos.CANCELLED);

    // Check BUILD_ORDER_STATES
    var bos = cs.BUILD_ORDER_STATES;
    var buildOrderStates = !!(bos && bos.PENDING && bos.ASSIGNED && bos.BUILDING && bos.DONE && bos.FAILED);

    // HP and refund defaults
    var hpDefaults = {
      defaultHp: cs.DEFAULT_BUILDING_HP,
      hqHp:      cs.HQ_HP,
      cancelRate: cs.DEFAULT_CANCEL_REFUND_RATE,
      destroyRate:cs.DEFAULT_DESTROY_REFUND_RATE
    };

    // Factory functions
    var factories = {
      createBuildCostResult:   typeof cs.createBuildCostResult === 'function',
      createBuildOrderState:   typeof cs.createBuildOrderState === 'function',
      createConstructionState: typeof cs.createConstructionState === 'function'
    };

    // Validators
    var validators = {
      isValidBuildCostResult:  typeof cs.isValidBuildCostResult === 'function',
      isValidBuildOrderState:  typeof cs.isValidBuildOrderState === 'function'
    };

    // Helpers
    var helpers = {
      canAffordBuild:       typeof cs.canAffordBuild === 'function',
      calculateRefund:      typeof cs.calculateRefund === 'function',
      isConstructionComplete:typeof cs.isConstructionComplete === 'function'
    };

    return { buildingStates, constructionStates, buildOrderStates, hpDefaults, factories, validators, helpers };
  });

  expect(result.buildingStates,    'BUILDING_STATES should have all keys').toBe(true);
  expect(result.constructionStates,'CONSTRUCTION_STATES should have all keys').toBe(true);
  expect(result.buildOrderStates,  'BUILD_ORDER_STATES should have all keys').toBe(true);

  expect(result.hpDefaults.defaultHp,  'DEFAULT_BUILDING_HP should be 500').toBe(500);
  expect(result.hpDefaults.hqHp,       'HQ_HP should be 500').toBe(500);
  expect(result.hpDefaults.cancelRate, 'DEFAULT_CANCEL_REFUND_RATE should be 0.75').toBe(0.75);
  expect(result.hpDefaults.destroyRate,'DEFAULT_DESTROY_REFUND_RATE should be 0').toBe(0);

  expect(result.factories.createBuildCostResult,   'createBuildCostResult should be function').toBe(true);
  expect(result.factories.createBuildOrderState,   'createBuildOrderState should be function').toBe(true);
  expect(result.factories.createConstructionState, 'createConstructionState should be function').toBe(true);
  expect(result.validators.isValidBuildCostResult,  'isValidBuildCostResult should be function').toBe(true);
  expect(result.validators.isValidBuildOrderState,  'isValidBuildOrderState should be function').toBe(true);
  expect(result.helpers.canAffordBuild,        'canAffordBuild should be function').toBe(true);
  expect(result.helpers.calculateRefund,       'calculateRefund should be function').toBe(true);
  expect(result.helpers.isConstructionComplete,'isConstructionComplete should be function').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 10: Construction factories and validators
// ---------------------------------------------------------------------------

test('Construction factory functions produce valid objects', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var cs = window.FE_CONSTRUCTION_SYSTEM;

    var costResult = cs.createBuildCostResult({
      energyCost: 30, buildTime: 25, refundAmount: 22, buildingType: 'separator'
    });
    var costValid = cs.isValidBuildCostResult(costResult);

    var order = cs.createBuildOrderState({
      state: 'pending', buildingType: 'separator', tileX: 10, tileY: 15
    });
    var orderValid = cs.isValidBuildOrderState(order);

    var constrState = cs.createConstructionState({
      state: 'in_progress', progress: 0.6, currentHp: 300, maxHp: 500, buildingType: 'separator'
    });

    return { costResult, costValid, order, orderValid, constrState };
  });

  expect(result.costResult.energyCost,   'costResult.energyCost should be 30').toBe(30);
  expect(result.costResult.buildTime,    'costResult.buildTime should be 25').toBe(25);
  expect(result.costResult.refundAmount, 'costResult.refundAmount should be 22').toBe(22);
  expect(result.costValid, 'costResult should be valid').toBe(true);

  expect(result.order.state,        'order.state should be pending').toBe('pending');
  expect(result.order.buildingType, 'order.buildingType should be separator').toBe('separator');
  expect(result.orderValid, 'order should be valid').toBe(true);

  expect(result.constrState.state,    'construction state should be in_progress').toBe('in_progress');
  expect(result.constrState.progress, 'construction progress should be 0.6').toBeCloseTo(0.6);
  expect(result.constrState.currentHp,'construction currentHp should be 300').toBe(300);
  expect(result.constrState.maxHp,    'construction maxHp should be 500').toBe(500);
});

// ---------------------------------------------------------------------------
// Test 11: Construction canAffordBuild and calculateRefund
// ---------------------------------------------------------------------------

test('Construction canAffordBuild and calculateRefund work correctly', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var cs  = window.FE_CONSTRUCTION_SYSTEM;
    var eco = window.FE_ECONOMY_SYSTEM;

    var richSnapshot = eco.createResourceSnapshot({ minerals: 500, energy: 500 });
    var poorSnapshot = eco.createResourceSnapshot({ minerals: 0, energy: 10 });

    var canAffordRich = cs.canAffordBuild('separator', richSnapshot);
    var canAffordPoor = cs.canAffordBuild('separator', poorSnapshot);
    var canAffordUnknown = cs.canAffordBuild('nonexistent_building', richSnapshot);

    var refund75 = cs.calculateRefund(30, 0.75);
    var refund0  = cs.calculateRefund(30, 0);
    var refundDefault = cs.calculateRefund(30);
    var isComplete = cs.isConstructionComplete({ state: 'completed' });
    var isIncomplete = cs.isConstructionComplete({ state: 'in_progress' });

    return { canAffordRich, canAffordPoor, canAffordUnknown,
             refund75, refund0, refundDefault, isComplete, isIncomplete };
  });

  expect(result.canAffordRich,   'rich player should afford separator').toBe(true);
  expect(result.canAffordPoor,   'poor player should NOT afford separator').toBe(false);
  expect(result.canAffordUnknown,'unknown building type should NOT be affordable').toBe(false);

  expect(result.refund75,    '75% refund of 30 should be 22').toBe(22);
  expect(result.refund0,     '0% refund of 30 should be 0').toBe(0);
  expect(result.refundDefault,'default refund of 30 should be 22 (0.75 rate)').toBe(22);
  expect(result.isComplete,   'completed state should be construction complete').toBe(true);
  expect(result.isIncomplete, 'in_progress state should NOT be construction complete').toBe(false);
});

// ---------------------------------------------------------------------------
// Test 12: Config enrichment — buildings.js separator fields
// ---------------------------------------------------------------------------

test('FE_BUILDINGS separator has enriched fields matching economy constants', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var sep = window.FE_BUILDINGS && window.FE_BUILDINGS.separator;
    var eco = window.FE_ECONOMY_SYSTEM;
    if (!sep || !eco) return { hasSep: false };

    return {
      hasSep: true,
      desc: sep.desc,
      hp: sep.hp,
      powerMw: sep.powerMw,
      separatorInputMinerals: sep.separatorInputMinerals,
      separatorOutputEnergy:  sep.separatorOutputEnergy,
      separatorOutputElement: sep.separatorOutputElement,
      separatorCycleSeconds:  sep.separatorCycleSeconds,
      matchesConstants: sep.separatorInputMinerals === eco.SEPARATOR_INPUT_MINERALS &&
                        sep.separatorOutputEnergy === eco.SEPARATOR_OUTPUT_ENERGY &&
                        sep.separatorOutputElement === eco.SEPARATOR_OUTPUT_ELEMENT &&
                        sep.separatorCycleSeconds === eco.SEPARATOR_CYCLE_SECONDS
    };
  });

  expect(result.hasSep, 'FE_BUILDINGS.separator should exist').toBe(true);
  expect(result.desc.includes('15'), 'separator desc should say 15 not 20').toBe(true);
  expect(result.desc.includes('20'), 'separator desc should NOT say 20').toBe(false);
  expect(result.hp,       'separator hp should be 500').toBe(500);
  expect(result.powerMw,  'separator powerMw should be 4').toBe(4);
  expect(result.separatorInputMinerals, 'separator separatorInputMinerals should be 15').toBe(15);
  expect(result.separatorOutputEnergy,  'separator separatorOutputEnergy should be 10').toBe(10);
  expect(result.separatorOutputElement, 'separator separatorOutputElement should be 1').toBe(1);
  expect(result.separatorCycleSeconds,  'separator separatorCycleSeconds should be 6.0').toBe(6.0);
  expect(result.matchesConstants, 'separator fields should match economy system constants').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 13: Config enrichment — buildings.js has hp/powerMw on all buildings
// ---------------------------------------------------------------------------

test('FE_BUILDINGS all entries have hp and powerMw fields', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var buildings = window.FE_BUILDINGS;
    if (!buildings) return { hasBuildings: false };
    var results = {};
    var keys = Object.keys(buildings);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      results[k] = {
        hasHp:      typeof buildings[k].hp === 'number',
        hasPowerMw: typeof buildings[k].powerMw === 'number'
      };
    }
    return { hasBuildings: true, results };
  });

  expect(result.hasBuildings, 'FE_BUILDINGS should exist').toBe(true);
  var keys = Object.keys(result.results);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    expect(result.results[k].hasHp,      k + ' should have hp').toBe(true);
    expect(result.results[k].hasPowerMw, k + ' should have powerMw').toBe(true);
  }
});

// ---------------------------------------------------------------------------
// Test 14: Config enrichment — units.js has production-safe fields
// ---------------------------------------------------------------------------

test('FE_UNITS all entries have productionCategory and queueGroup', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var units = window.FE_UNITS;
    if (!units) return { hasUnits: false };
    var results = {};
    var keys = Object.keys(units);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      results[k] = {
        hasProductionCategory: typeof units[k].productionCategory === 'string',
        hasQueueGroup:        typeof units[k].queueGroup === 'string',
        hasRole:              typeof units[k].role === 'string',
        // Ensure NO combat fields were added
        hasAttackDamage:   units[k].attackDamage !== undefined,
        hasAttackCooldown: units[k].attackCooldown !== undefined,
        hasAttackRange:    units[k].attackRange !== undefined
      };
    }
    return { hasUnits: true, results };
  });

  expect(result.hasUnits, 'FE_UNITS should exist').toBe(true);
  var keys = Object.keys(result.results);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    expect(result.results[k].hasProductionCategory, k + ' should have productionCategory').toBe(true);
    expect(result.results[k].hasQueueGroup,        k + ' should have queueGroup').toBe(true);
    expect(result.results[k].hasRole,              k + ' should have role').toBe(true);
    expect(result.results[k].hasAttackDamage,   k + ' should NOT have attackDamage').toBe(false);
    expect(result.results[k].hasAttackCooldown, k + ' should NOT have attackCooldown').toBe(false);
    expect(result.results[k].hasAttackRange,    k + ' should NOT have attackRange').toBe(false);
  }
});

// ---------------------------------------------------------------------------
// Test 15: Production calculateProductionTime reads from FE_UNITS
// ---------------------------------------------------------------------------

test('Production calculateProductionTime returns correct values from config', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    var prod = window.FE_PRODUCTION_SYSTEM;
    return {
      harvesterTime:  prod.calculateProductionTime('harvester'),
      lightTankTime:  prod.calculateProductionTime('light_tank'),
      unknownTime:    prod.calculateProductionTime('nonexistent'),
      doubleSpeed:    prod.calculateProductionTime('light_tank', 2.0)
    };
  });

  expect(result.harvesterTime,  'harvester production time should be 25').toBe(25);
  expect(result.lightTankTime,  'light_tank production time should be 35').toBe(35);
  expect(result.unknownTime,    'unknown unit type time should be 0').toBe(0);
  expect(result.doubleSpeed,    'light_tank at 2x speed should be 17.5').toBeCloseTo(17.5);
});
