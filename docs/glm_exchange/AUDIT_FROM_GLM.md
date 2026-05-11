# AUDIT_FROM_GLM — BOT-PROGRESSION-01

**Task:** BOT-PROGRESSION-01 — audit why enemy economy/production seems to stall around ~3 tanks
**Lane:** Audit only
**Date:** 2026-05-12

---

## 1. Root cause / цель аудита

Enemy bot appears to stop progressing around ~3 light_tanks and does not clearly scale economy/production during a match. After deep audit of the codebase, there are **three root causes** working together to create this stall:

### Primary cause: `FE_ENEMY_LIGHT_TANK_CAP = 3` (L9572)

```javascript
window.FE_ENEMY_LIGHT_TANK_CAP = 3;
```

This is an **ATTACK-09 experimental production cap** that hard-limits enemy light_tank count (alive + queued) to 3. Once the enemy has 3 tanks alive or in queue, `FE_PATCH_09ECanStartLightTankProduction()` (L9632) returns `{ ok: false, reason: 'attack09_tank_cap' }` and no further tanks are produced. The cap never increases over time, never scales with game progress, and has no mechanism to adapt. It was introduced as an experimental safeguard in BOT-ATTACK-09 but was never tuned or removed.

This is the **dominant cause** of the stall. Once 3 tanks exist, the factory goes idle. The bot cannot grow its army beyond this hard ceiling regardless of economy, game time, or player pressure.

### Secondary cause: No additional economy buildings

The enemy bot has no logic to build additional separators, storage buildings, or a second factory. The BRAIN-01 priority loop (L9977) only checks:

1. `build_separator` — only if **no** separator exists yet (`FE_PATCH_09C2EnemySeparatorExistsOrQueued()`)
2. `build_factory` — only if **no** factory exists yet (`FE_PATCH_09DEnemyFactoryExistsOrQueued()`)

Once one separator and one factory are built, BRAIN-01 never orders another. This means:

- **One separator** processes 15 minerals → 10 energy + 1 element every 6 seconds. Maximum element production rate: ~10 elements/min.
- **No additional storage**: enemy starts with BASE_STORAGE (purple: 20). Element storage caps at 20. With one separator producing 1 element per 6 sec, storage fills in ~2 minutes and the separator pauses (`element_storage_full`).
- **No second factory**: even if resources were unlimited, only one factory can produce units at a time, and `FE_PATCH_09E_FACTORY_MAX_QUEUE = 1` limits queue depth to 1.

### Tertiary cause: Element income bottleneck

A single separator producing 1 element per 6 seconds gives ~10 elements/min. A light_tank costs 2 elements with a 35-second build time. The element production rate supports roughly one tank every 12 seconds (2 elements × 6 sec = 12 sec), which is actually faster than the build time (35 sec). But the **storage cap of 20 elements** means the separator pauses frequently when the cap is hit and tanks aren't being produced (because of the TANK_CAP). This creates a feedback loop:

1. Tank cap reached → factory stops consuming elements.
2. Element storage fills to 20 → separator pauses.
3. Enemy economy stalls completely — no production, no conversion, no spending.

---

## 2. Функции economy/production

| Функция | Линия | Роль |
|---------|-------|------|
| `FE_ATTACK09GetEnemyLightTankCountIncludingQueue()` | L9574 | Counts alive + queued enemy light_tanks. Used by cap check. |
| `FE_PATCH_09ECanStartLightTankProduction()` | L9632 | Checks if production can start: cap, queue depth, resources. |
| `FE_PATCH_09EStartLightTankProduction()` | L9663 | Starts tank production after canStart check. Deducts resources. |
| `FE_PATCH_09EUpdateEnemyFactoryProduction()` | L9738 | Main production tick. Chooses unit type, advances queue, spawns units. |
| `FE_PATCH_09ECompleteEnemyFactories()` | L9604 | Returns all complete non-destroyed enemy factories. |
| `FE_PATCH_09EEnsureFactoryQueue()` | L9609 | Lazy-init factory queue. Max depth = 1. |
| `FE_PATCH_BASELINE_01_ChooseFactoryUnitType()` | L9866 | Decides what to produce: builder < harvester < scout < light_tank. Checks tank cap. |
| `FE_PATCH_BASELINE_01_StartFactoryProduction()` | L9941 | Starts worker/scout production. |
| `FE_PATCH_BRAIN_01_ChoosePriorityAction()` | L9977 | Top-level decision: separator → factory → builder → harvester → combat → wait. |
| `FE_PATCH_BRAIN_01_ExecuteAction()` | L10020 | Executes BRAIN-01 decision. |
| `FE_PATCH_BRAIN_01_TryProduceWorker()` | L10047 | Tries to produce a worker in any free factory. |
| `FE_PATCH_09C3UpdateEnemySeparatorProduction()` | L9273 | Runs separator cycles. Pauses if storage full or not enough minerals. |
| `FE_PATCH_09C3EnemySeparatorCycleCheck()` | L9248 | Checks if separator can run: minerals, energy space, element space. |
| `FE_PATCH_09C2EnemySeparatorExistsOrQueued()` | L9078 | Checks if enemy has separator (exists or being built). |
| `FE_PATCH_09DEnemyFactoryExistsOrQueued()` | L9352 | Checks if enemy has factory (exists or being built). |
| `ensureEnemyResources()` | L1966 | Lazy-init enemy resource bucket. |
| `changeResourceForOwner()` | L9032 | Changes resources with storage cap enforcement. |
| `addResourceForOwner()` | L1991 | Adds resources with storage cap enforcement. Used by harvester unload (L8862). |
| `getStorageLimitsForOwner()` | L1948 | Returns storage caps = BASE_STORAGE + building storageBonus. |

---

## 3. Где production cap блокирует прогрессию

**Critical gate 1: `FE_PATCH_BASELINE_01_ChooseFactoryUnitType()` (L9866)**

```javascript
// ATTACK-09: if light_tank cap is reached, return null (factory waits, no builder spam).
var _a09Cap = window.FE_ENEMY_LIGHT_TANK_CAP;
if (_a09Cap != null && _a09Cap > 0) {
  var _a09Count = FE_ATTACK09GetEnemyLightTankCountIncludingQueue();
  if (_a09Count >= _a09Cap) return null;  // <-- PRODUCTION STOPS HERE
}
```

When tank cap is reached, `ChooseFactoryUnitType` returns `null`. The factory queue stays empty. The factory sits idle.

**Critical gate 2: `FE_PATCH_09ECanStartLightTankProduction()` (L9632)**

```javascript
var _a09Cap = window.FE_ENEMY_LIGHT_TANK_CAP;
if (_a09Cap != null && _a09Cap > 0) {
  var _a09Count = FE_ATTACK09GetEnemyLightTankCountIncludingQueue();
  if (_a09Count >= _a09Cap) {
    return { ok:false, reason:'attack09_tank_cap', ... };
  }
}
```

Even if somehow a tank production order got past `ChooseFactoryUnitType`, this second check blocks it at the `CanStart` level.

**Critical gate 3: Early-exit in `ChooseFactoryUnitType` (L9876–L9879)**

```javascript
if (!game) return _a09CapBlocked ? null : 'light_tank';
var now = typeof performance !== 'undefined' ? performance.now() : Date.now();
if (now - (game._baseline01LastWorkerCheck || 0) < FE_PATCH_BASELINE_01_WORKER_CHECK_COOLDOWN_MS) {
  return _a09CapBlocked ? null : 'light_tank';
}
```

The worker check has a 5-second cooldown. During those 5 seconds, if the tank cap is active, the function short-circuits to `null` without even checking if workers need replenishment. This means if a harvester or builder dies during this cooldown window, the factory won't replace it — it will just wait, because the cap check returns null before the worker check.

---

## 4. Как "progression stall" выглядит в игре

Timeline of a typical skirmish:

1. **0:00–0:30**: Skirmish start. Enemy gets: HQ, 2 harvesters, 1 builder, 1 tank. Enemy resources: minerals:0, energy:160, purple:0.
2. **0:30–1:00**: BRAIN-01 orders separator build (cost 30 energy). Builder starts building separator. Factory starts producing (builder/harvester first, then light_tank).
3. **1:00–2:00**: Separator completes. Harvester income feeds minerals → separator → purple. Tank production starts. Enemy reaches 2–3 tanks.
4. **2:00**: **TANK CAP HIT (3 tanks).** Factory stops producing tanks. `ChooseFactoryUnitType` returns `null`.
5. **2:00–3:00**: Element storage fills to 20 (no consumption). Separator pauses (`element_storage_full`).
6. **3:00+**: Enemy economy is completely idle. Factory idle, separator idle, harvesters return cargo but minerals pile up. Bot does nothing productive with its economy. Player can freely build up.

The enemy never progresses beyond this point unless tanks die (freeing cap slots). But even when a tank dies, the replacement cycle is slow (35 sec production + element accumulation), and the cap hits again quickly.

---

## 5. Как увеличить progression минимально

There are two independent fixes needed:

### Fix A: Remove or increase `FE_ENEMY_LIGHT_TANK_CAP`

The simplest fix: raise the cap or make it scale with game time.

**Option A1 (simplest — just raise the cap):**

```javascript
window.FE_ENEMY_LIGHT_TANK_CAP = 8;  // was 3
```

Pros: One-line change. Enemy can now build 8 tanks.
Cons: Fixed cap still doesn't scale. If player turtles, enemy stalls at 8.

**Option A2 (time-based scaling):**

```javascript
function FE_ATTACK09GetTankCap(now) {
  var base = window.FE_ENEMY_LIGHT_TANK_CAP || 3;
  if (base <= 0) return Infinity; // disabled
  var gameMinutes = (game?.time || 0) / 60;
  // Scale: +1 tank every 3 minutes after minute 5, up to +5 bonus
  var bonus = Math.min(5, Math.floor(Math.max(0, gameMinutes - 5) / 3));
  return base + bonus;
}
```

Pros: Enemy grows over time. 3 tanks at start, up to 8 by minute 20.
Cons: Slightly more complex. Needs tuning.

**Option A3 (disable the cap entirely):**

```javascript
window.FE_ENEMY_LIGHT_TANK_CAP = 0;  // disable cap
```

Pros: Simplest possible change. No hard limit.
Cons: ATTACK-12 attack gate already limits attack waves. But without the cap, the enemy might stockpile too many tanks if economy is strong. However, with only 1 factory and queue depth 1, production is naturally limited to ~1 tank per 35 sec + element cost. This is self-regulating.

**Recommendation: Option A3** — disable the cap. The existing economy itself (1 separator, 1 factory, element cost) is the natural limiter. The ATTACK-12 attack gate already decides when to send waves. An artificial cap is unnecessary and causes the observed stall.

### Fix B: Fix early-exit cap check in `ChooseFactoryUnitType`

When tank cap is active and the 5-second worker check cooldown hasn't expired, the function returns `null` instead of checking workers. This prevents worker replenishment when a worker dies during the cooldown.

**Fix:** Move the cap-blocked return **after** the worker checks, not before:

```javascript
function FE_PATCH_BASELINE_01_ChooseFactoryUnitType() {
  // ... worker checks first (builder, harvester, scout) ...
  // Only check tank cap AFTER worker checks
  var _a09Cap = window.FE_ENEMY_LIGHT_TANK_CAP;
  if (_a09Cap != null && _a09Cap > 0) {
    var _a09Count = FE_ATTACK09GetEnemyLightTankCountIncludingQueue();
    if (_a09Count >= _a09Cap) return null;
  }
  return 'light_tank';
}
```

This ensures workers always get priority, even when tank cap is active. If the cap is disabled (Option A3), this fix is less critical but still good practice.

### Fix C (optional, not required for this patch): Build additional economy buildings

This is **out of scope** for BOT-PROGRESSION-01 but noted for future consideration:

- Build a second separator after game time > 5 min
- Build element/energy storage when approaching cap
- Build a second factory for faster production

These would require expanding BRAIN-01's action list and build order logic, which is a larger scope change.

---

## 6. Точные файлы/функции для изменения

**Единственный файл:** `src/main.js`

| # | Функция / блок | Линия | Изменение |
|---|---------|-------|-----------|
| 1 | `window.FE_ENEMY_LIGHT_TANK_CAP` | L9572 | Change from `3` to `0` (disable cap). Or raise to higher value. |
| 2 | `FE_PATCH_BASELINE_01_ChooseFactoryUnitType()` | L9866 | Move tank-cap early-exit returns **after** worker checks. Currently at L9876–L9879 (two early returns) and L9914–L9918 (final check). The two early returns should be removed; only the final check after worker/scout logic should remain. |

---

## 7. Что НЕ трогать

- Combat damage/range/cooldown functions and values
- Pathfinding / `findPath` / `passable`
- Scout lifecycle (`FE_SCOUT01*`, `FE_INTEL01*`)
- BOT-ATTACK-11/12 attack gate logic
- BOT-ATTACK-12 thresholds
- BOT-COMBAT-AWARENESS-01
- BOT-DEFENSE-RETREAT-01
- ATTACK-04 hq_push protection
- ATTACK-08 invariant repair
- ATTACK-10 wave lock
- FE_PATCH_BRAIN_01 action list (do not add new actions)
- Enemy harvester mining logic (works correctly)
- Enemy separator conversion logic (works correctly — stalls due to storage cap, which is a symptom not a cause)
- Factory queue depth (`FE_PATCH_09E_FACTORY_MAX_QUEUE = 1`)
- Save/load
- Render / fog
- Map generation
- Building construction logic (`FE_PATCH_09C2*`, `FE_PATCH_09D*`)

---

## 8. Риск

**Low.**

Обоснование:

- **Fix A (disable cap)**: The tank cap was an experimental safeguard. Removing it does not change combat behavior — tanks still have the same stats. The ATTACK-12 attack gate already decides when waves attack. The only change is that the factory can keep producing instead of idling. Natural economy limits (1 separator, 1 factory, queue depth 1, element cost 2, build time 35 sec) provide a self-regulating ceiling of roughly 1 tank per 40–50 seconds.
- **Fix B (worker priority)**: This is a pure bugfix. Workers should always have production priority over tanks. Currently the cap check short-circuits worker replenishment, which can cause economy collapse if a worker dies. This is clearly wrong behavior.
- **Worst case**: If economy is too strong (unlikely with current setup), enemy could accumulate more tanks than intended. This is mitigated by ATTACK-12's attack gate sending waves, which naturally consumes tanks.
- **No risk to existing systems**: Neither fix touches combat, pathfinding, attack gates, scout, retreat, or any other system.

---

## 9. Telemetry / debug plan

The existing telemetry already covers this:

- `game._attack09EnemyTankCap` — already populated by `FE_PATCH_09EUpdateEnemyFactoryProduction` (L9754). Shows `{ cap, count, blocked, reason, at }`. After fix, `blocked` should be `false` most of the time.
- `game._enemyFactoryProductionStatus` — shows production status including `attack09_tank_cap` reason. After fix, this reason should not appear.

**Additional telemetry (minimal):**

Add to `game._botProgression01` (new debug object):

```javascript
{
  tankCapValue: 0,              // current value of FE_ENEMY_LIGHT_TANK_CAP
  lastWorkerPriorityFixAt: 0,   // game time when worker was prioritized over cap
  workerPriorityFixCount: 0     // how many times worker check overrode cap check
}
```

This is only needed if Fix B is implemented. If cap is disabled (Fix A), worker priority fix becomes moot and this telemetry is optional.

---

## 10. Targeted smoke test plan

**Сценарий 1 — Production continues past 3 tanks:**
1. Start skirmish, observe enemy production.
2. Wait for enemy to produce 3+ tanks (check `game.units` for enemy light_tanks).
3. Verify factory continues producing tanks beyond 3 (check `game._enemyFactoryProductionStatus.status` is not `'attack09_tank_cap'`).
4. Verify separator continues processing elements (not stuck at `element_storage_full`).
5. Observe enemy sends attack waves with 4+ tanks.

**Сценарий 2 — Worker replenishment still works:**
1. Start skirmish, let enemy build up economy.
2. Kill an enemy harvester (using player tanks).
3. Verify factory produces a replacement harvester even while at tank cap (or beyond).
4. Verify enemy economy does not collapse after worker loss.

**Сценарий 3 — ATTACK-12 gate still controls waves:**
1. Start skirmish, let enemy build up.
2. Verify attack waves are still gated by ATTACK-12 (check `game._attack12State`).
3. Verify enemy does not send all tanks in one giant wave.

**Сценарий 4 — Regression:**
1. Normal game flow — bot should build separator, factory, workers, tanks in correct order.
2. BRAIN-01 priority loop should work identically.
3. Scout lifecycle unchanged.
4. Retreat/defense behavior unchanged.

Жду «Делай».
