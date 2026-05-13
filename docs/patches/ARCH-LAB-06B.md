# ARCH-LAB-06B — Economy / Construction Wrapper Delegation

**Date:** 2026-05-14
**PR:** #98
**Branch:** glm/arch-lab-06b-wrapper-delegation
**Scope:** Wrapper delegation — connect main.js to #97 contract modules, reduce main.js by eliminating duplicated pure logic.
**Risk:** MEDIUM-LOW — behavior-preserving wrapper delegation, no gameplay changes
**Depends on:** ARCH-LAB-06-BUNDLE (merged PR #97)
**Next:** ARCH-LAB-06C — Tier 2 delegation (powerConfig, factoryCanAffordAnyUnit, buildCostForBuilding)

## Summary

This PR implements wrapper delegation from `src/main.js` to the contract modules created in PR #97. Pure logic (cost extraction, affordability checks, refund calculation, separator cycle checks, HP lookups) is moved into `FE_ECONOMY_SYSTEM` and `FE_CONSTRUCTION_SYSTEM`. Main.js functions become thin wrappers that gather game state and delegate. Runtime behavior is identical.

## 1. Changes to `src/economy/economy_system.js`

- **Added** `canRunSeparatorCycle(resources, limits, elKey)` — pure predicate that checks minerals >= 15, energy remaining capacity >= 10, faction element remaining capacity >= 1. Mirrors main.js `canRunSeparatorCycle()` logic exactly.
- **Added** `DEFAULT_UNIT_UPKEEP_MW = 1` — matches `FE_POWER_UNIT_MW` in runtime_flags.js. Used as fallback in `powerConfig()`.

## 2. Changes to `src/construction/construction_system.js`

- **Added** `getBuildCost(buildingType)` — extracts build cost from `FE_BUILDINGS` with the same multi-field normalization as main.js (cost/costEnergy/energy/energyCost/minerals/mineralCost/cost-object).
- **Added** `canAffordBuildDetailed(buildingType, resources)` — detailed affordability check returning `{ ok, resource, amount, have, cost }` matching main.js result shape exactly.
- **Added** `calculateMultiResourceRefund(cost, rate)` — pure refund calculation for multi-resource cost objects. Returns `{ refunded: { resource: amount }, total }`. No mutation.

## 3. Changes to `src/production/production_system.js`

- **Added** `PLAYER_FACTORY_MAX_QUEUE = 2` — matches actual runtime queue limit (main.js uses `factory.queue.length >= 2`).
- **Modified** `canAffordUnit(unitType, snapshot, elKey)` — added optional `elKey` parameter. When provided, checks only that specific faction element. When omitted, checks all element types (backward compatible).

## 4. Changes to `src/main.js`

### 4.1 createBuilding() HP lookup (lines 1708-1710)

**Before:** Hardcoded ternary `type === 'hq_base' ? 1000 : type === 'defense_tower' ? 420 : 320`

**After:** `type === 'hq_base' ? FE_CONSTRUCTION_SYSTEM.HQ_HP : (BUILDINGS[type]?.hp || FE_CONSTRUCTION_SYSTEM.DEFAULT_BUILDING_HP)`

Values unchanged: hq_base=1000, defense_tower=420, default=320.

### 4.2 canRunSeparatorCycle() delegation (lines 2279-2283)

**Before:** Inline logic checking `game.resources.minerals >= 15`, `resourceSpace('energy') >= 10`, `resourceSpace(elKey) >= 1`.

**After:** `return FE_ECONOMY_SYSTEM.canRunSeparatorCycle(game.resources, getStorageLimits(), factionElementKey());`

### 4.3 updateProduction() separator constants (lines 2403-2412)

**Before:** Magic numbers `6.0`, `-15`, `10`, `1`.

**After:** Named constants `FE_ECONOMY_SYSTEM.SEPARATOR_CYCLE_SECONDS`, `SEPARATOR_INPUT_MINERALS`, `SEPARATOR_OUTPUT_ENERGY`, `SEPARATOR_OUTPUT_ELEMENT`.

### 4.4 getBuildCost() delegation (lines 10731-10734)

**Before:** 22-line function with multi-field normalization.

**After:** `return FE_CONSTRUCTION_SYSTEM.getBuildCost(type);`

### 4.5 canAffordBuild() delegation (lines 10736-10739)

**Before:** 17-line function iterating cost against `game.resources`.

**After:** `return FE_CONSTRUCTION_SYSTEM.canAffordBuildDetailed(type, game.resources);`

### 4.6 refundCostByRate() delegation (lines 11066-11086)

**Before:** Inline calculation loop `Math.floor(amount * rate)` + `changeResource` + `debugLog`.

**After:** Delegates calculation to `FE_CONSTRUCTION_SYSTEM.calculateMultiResourceRefund(cost, rate)`, then applies mutations (`changeResource`, `debugLog`).

### 4.7 Remove FE_POWER_01A_HQ_MW / FE_POWER_01A_UNIT_MW (lines 2053-2054)

**Before:** Local constants `FE_POWER_01A_HQ_MW = 15`, `FE_POWER_01A_UNIT_MW = 1` used as fallbacks in `powerConfig()`.

**After:** Replaced with `FE_ECONOMY_SYSTEM.HQ_POWER_SUPPLY_MW` and `FE_ECONOMY_SYSTEM.DEFAULT_UNIT_UPKEEP_MW`.

## 5. main.js line-count impact

- Before: **15,602** lines
- After: **15,557** lines
- **Delta: -45 lines**

## 6. Tests added

7 new deterministic e2e tests (Tests 16-22):
- Test 16: `canRunSeparatorCycle` exact pass/fail/boundary/invalid cases
- Test 17: `getBuildCost` correct cost objects for known/unknown/invalid types
- Test 18: `canAffordBuildDetailed` correct result shape for success/failure/unknown
- Test 19: `calculateMultiResourceRefund` single/multi/zero/default/empty/null cases
- Test 20: HP constants remain 1000/420/320 after delegation
- Test 21: Separator constants remain 15/10/1/6.0, PLAYER_FACTORY_MAX_QUEUE=2
- Test 22: `canAffordUnit` with elKey parameter faction-specific check

## 7. What this PR does NOT do

- No production runtime delegation (factoryCanAffordAnyUnit, productionSpeedForUnit, queueUnitProduction, updateUnitProduction)
- No construction runtime delegation (orderBuild, updateBuilder, cancelBuildOrder, findBuildPlan, canPlaceBuilding)
- No power evaluation delegation (evaluatePowerState, calculatePowerTotal)
- No changes to runtime_flags.js
- No changes to addResource/changeResource behavior
- No changes to separator formula (15/10/1/6.0)
- No changes to HP values (1000/420/320)
- No changes to refund rate (0.75)
- No AI/bot/scout/attack/combat/pathfinding changes
