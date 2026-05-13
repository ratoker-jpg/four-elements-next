# ARCH-LAB-06-BUNDLE — Economy / Production / Construction Pure Contracts

**Date:** 2026-05-14
**PR:** #96
**Branch:** glm/arch-lab-06-bundle-contracts
**Scope:** Pure contract modules + config enrichment + deterministic tests. No runtime behavior changes.
**Risk:** LOW — new modules load but are not called by runtime logic
**Depends on:** ARCH-AI-05C6 (merged PR #95)
**Next:** ARCH-LAB-06B — Wrapper delegation (economy/production/construction)

## Summary

This PR introduces pure contract modules for the economy, production, and construction subsystems, plus config enrichment for buildings.js and units.js. No runtime behavior is changed — the new modules load onto `window` but are not yet called by main.js. Deterministic e2e tests verify all API surfaces.

This is the **Path B** approach: one combined low-risk pure contracts/modules PR, with wrapper delegation deferred to a follow-up PR (06B).

---

## 1. New contract modules

### 1.1 `src/economy/economy_system.js` → `window.FE_ECONOMY_SYSTEM`

Constants:
- `RESOURCE_TYPES` — { MINERALS, ENERGY, PURPLE, GREEN_EL, CYAN_EL, YELLOW_EL }
- `POWER_STATES` — { NOMINAL, DEFICIT, OFFLINE }
- `SEPARATOR_STATES` — { ACTIVE, IDLE, POWERED_DOWN }
- `SEPARATOR_INPUT_MINERALS` = 15
- `SEPARATOR_OUTPUT_ENERGY` = 10
- `SEPARATOR_OUTPUT_ELEMENT` = 1
- `SEPARATOR_CYCLE_SECONDS` = 6.0
- `DEFAULT_MINERALS_CAP` = 200
- `DEFAULT_ENERGY_CAP` = 300
- `DEFAULT_ELEMENT_CAP` = 20
- `HQ_POWER_SUPPLY_MW` = 15

Factory functions:
- `createResourceSnapshot(amounts, caps)` → plain object
- `createPowerStateSnapshot({ supplyMw, demandMw, state })` → plain object
- `createSeparatorState({ state, cycleProgress, cyclesCompleted })` → plain object

Validators:
- `isValidResourceSnapshot(value)` → true | error string
- `isValidPowerStateSnapshot(value)` → true | error string

Decision helpers:
- `canAffordResource(snapshot, cost)` → boolean
- `calculateRemainingCapacity(snapshot, resourceType)` → number
- `isSeparatorCycleReady(separatorState)` → boolean

### 1.2 `src/production/production_system.js` → `window.FE_PRODUCTION_SYSTEM`

Constants:
- `PRODUCTION_STATES` — { QUEUED, BUILDING, PAUSED, COMPLETED, CANCELLED }
- `UNIT_TYPES` — { HARVESTER, BUILDER, LIGHT_TANK, HEAVY_TANK, BOMBER, SCOUT }
- `MAX_QUEUE_SIZE` = 5
- `DEFAULT_PRODUCTION_SPEED` = 1.0
- `CANCEL_REFUND_RATE` = 0.75

Factory functions:
- `createProductionQueueItem({ unitType, state, progress, queuedAt, startedAt })` → plain object
- `createProductionState({ queue, activeUnitType, factoryId })` → plain object

Validators:
- `isValidProductionQueueItem(value)` → true | error string
- `isValidProductionState(value)` → true | error string

Decision helpers:
- `canAffordUnit(unitType, snapshot)` → boolean
- `calculateProductionTime(unitType, speedMultiplier)` → number (seconds)
- `isQueueFull(productionState)` → boolean

### 1.3 `src/construction/construction_system.js` → `window.FE_CONSTRUCTION_SYSTEM`

Constants:
- `BUILDING_STATES` — { ACTIVE, DAMAGED, DESTROYED, PLANNED }
- `CONSTRUCTION_STATES` — { NOT_STARTED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED }
- `BUILD_ORDER_STATES` — { PENDING, ASSIGNED, BUILDING, DONE, FAILED }
- `DEFAULT_BUILDING_HP` = 500
- `HQ_HP` = 500
- `DEFAULT_CANCEL_REFUND_RATE` = 0.75
- `DEFAULT_DESTROY_REFUND_RATE` = 0.0

Factory functions:
- `createBuildCostResult({ energyCost, buildTime, refundAmount, buildingType })` → plain object
- `createBuildOrderState({ state, buildingType, builderId, tileX, tileY })` → plain object
- `createConstructionState({ state, progress, currentHp, maxHp, buildingType })` → plain object

Validators:
- `isValidBuildCostResult(value)` → true | error string
- `isValidBuildOrderState(value)` → true | error string

Decision helpers:
- `canAffordBuild(buildingType, snapshot)` → boolean
- `calculateRefund(energyCost, refundRate)` → number
- `isConstructionComplete(constructionState)` → boolean

---

## 2. Config enrichment

### 2.1 `src/config/buildings.js`

Additive fields added to each building entry:
- `hp` — default HP for the building type
- `powerMw` — power consumption/supply in MW

Separator-specific fields added:
- `separatorInputMinerals` = 15
- `separatorOutputEnergy` = 10
- `separatorOutputElement` = 1
- `separatorCycleSeconds` = 6.0

Fix: separator description changed from "20 сырья" to "15 сырья" to match actual constant.

**No existing fields were changed** (costEnergy, buildTime, asset, storageBonus, desc unchanged except for the description fix).

### 2.2 `src/config/units.js`

Additive production-safe fields added to each unit entry:
- `productionCategory` — 'civilian' or 'military'
- `queueGroup` — 'default' (all units share the same queue for now)
- `role` — 'worker', 'combat', or 'recon'

**No combat fields were added** (no attackDamage, attackCooldown, attackRange).

---

## 3. index.html changes

Three new script tags added before `src/main.js`:
```html
<script src="src/economy/economy_system.js?v=arch_lab_06_bundle"></script>
<script src="src/production/production_system.js?v=arch_lab_06_bundle"></script>
<script src="src/construction/construction_system.js?v=arch_lab_06_bundle"></script>
```

---

## 4. E2E tests

`tests/e2e/economy-production-construction-smoke.spec.js` — 15 deterministic tests:
1. All three modules available on window
2. Economy system constants and factory shapes
3. Economy factory functions produce valid shapes
4. Economy canAffordResource and calculateRemainingCapacity
5. Economy isSeparatorCycleReady
6. Production system constants and factory shapes
7. Production factory functions and validators
8. Production isQueueFull and canAffordUnit
9. Construction system constants and factory shapes
10. Construction factories and validators
11. Construction canAffordBuild and calculateRefund
12. Config enrichment — buildings.js separator fields
13. Config enrichment — buildings.js has hp/powerMw on all buildings
14. Config enrichment — units.js has production-safe fields (no combat fields)
15. Production calculateProductionTime reads from FE_UNITS

---

## 5. What this PR does NOT do

- No changes to `src/main.js`
- No changes to `src/config/runtime_flags.js`
- No wrapper delegation (deferred to ARCH-LAB-06B)
- No construction placement logic (deferred)
- No combat stats added to units.js
- No runtime behavior changes

---

## 6. Verification

Expected changed files (10):

```text
src/economy/economy_system.js           (NEW)
src/production/production_system.js     (NEW)
src/construction/construction_system.js (NEW)
src/config/buildings.js                 (MODIFIED — additive fields + desc fix)
src/config/units.js                     (MODIFIED — additive production fields)
index.html                              (MODIFIED — 3 script tags)
tests/e2e/economy-production-construction-smoke.spec.js (NEW)
docs/patches/ARCH-LAB-06-BUNDLE-DESIGN.md (NEW)
docs/patches/INDEX.md                   (MODIFIED — add entry)
```

Required checks:
```bash
git diff --name-only origin/sandbox/main...HEAD
git diff origin/sandbox/main...HEAD -- src/main.js
node --check src/economy/economy_system.js
node --check src/production/production_system.js
node --check src/construction/construction_system.js
node --check src/config/buildings.js
node --check src/config/units.js
node --check src/main.js
node --check src/config/runtime_flags.js
npm run test:e2e
```
