# AUDIT_FROM_GLM — BOT-DEFENSE-RETREAT-01

**Task:** BOT-DEFENSE-RETREAT-01 — fix enemy retreat/defense oscillation near base
**Lane:** Review (src/main.js)
**Date:** 2026-05-12

---

## 1. Root cause / цель изменения

Enemy light_tanks near their own base oscillate between attack and retreat/defend phases:

1. Attack phase: tank has attack order, engages player tank.
2. 10H1 retreat/defense check runs every bot tick (~1.2 sec), detects player threat near HQ → `FE_10H1_defendHqWithAvailableTanks` or `FE_10H1_startRetreat` fires.
3. `FE_10H1_startRetreat` calls `FE_10H1_clearAttackOrder(unit)` which nullifies `attackTargetId`, `attackApproachTargetId`, etc. → tank stops shooting.
4. `FE_10H1_moveToSafePoint` sends tank toward home (but tank is already at/near home).
5. Next bot tick: 10H1 doesn't see threats (tank just returned, player moved slightly), or regroup cooldown expires → phase returns to `prepare_attack` → `attack`.
6. Tank gets new attack order → starts shooting again.
7. Cycle repeats.

The **key missing guard**: when an enemy tank is near its own base, is under player pressure, has a valid target in or near attack range, and retreat destination is at/near the tank's current position (retreat is useless), the tank should **stand and fight** instead of dropping its attack order and oscillating.

---

## 2. Функции retreat/defense/regroup

| Функция | Линия | Роль |
|---------|-------|------|
| `FE_10H1_updateEnemyRetreatAndDefenseMvp()` | L6758 | Main entry point. Called each bot tick. Decides defend vs retreat vs idle. |
| `FE_10H1_shouldRetreat()` | L6642 | Evaluates retreat conditions: last_tank, lost_tank, strength disadvantage, outnumbered. |
| `FE_10H1_startRetreat()` | L6672 | Clears attack orders on all tanks, moves them to safe point, sets phase='regroup'. |
| `FE_10H1_defendHqWithAvailableTanks()` | L6717 | Issues defend orders against player threats near HQ, sets phase='defend'. |
| `FE_10H1_getLocalPlayerThreatsNearHq()` | L6609 | Finds player light_tanks within radius=10 of enemy HQ. |
| `FE_10H1_clearAttackOrder()` | L6580 | Nullifies attackTargetId, attackApproachTargetId, attackTarget, _attackCommanded. |
| `FE_10H1_moveToSafePoint()` | L6592 | Sends tank toward home via FE_PATCH_08BReturnUnitHome. |
| `FE_PATCH_08BShouldKeepUnitNearHome()` | L5038 | Checks if unit is farther than radius from home. |
| `FE_PATCH_08BReturnUnitHome()` | L2852 | Moves tank toward homeX/homeY. |
| `FE_PATCH_08BOverChasing()` | L5050 | Checks if any tank is > maxChaseDistanceTiles (18) from home. |

---

## 3. Где активные attack orders перезаписываются retreat/defense

**Critical overwrite point: L7282 in bot tick**

```javascript
var _a11H1Result = !_a04HqBlock && _a11H1Tanks.length > 0
  && FE_10H1_updateEnemyRetreatAndDefenseMvp(state, _a11H1Tanks, now);
```

This calls the full 10H1 pipeline on `_a11H1Tanks` (enemy tanks excluding intel-rally tanks). Inside:

1. `FE_10H1_getLocalPlayerThreatsNearHq(enemyHQ, 10)` — finds player tanks near enemy HQ.
2. If threats found → `FE_10H1_defendHqWithAvailableTanks()` — issues `defend` order via `FE_PATCH_08BCommandEnemyTankAttack(unit, primaryThreat, state, 'defend')`. This **reassigns** the attack target to the primary threat, overwriting the previous attack order.
3. If no threats but shouldRetreat → `FE_10H1_startRetreat()` — **clears** all attack orders via `FE_10H1_clearAttackOrder(unit)` then sends tanks home.

**The oscillation cycle:**

- Tick N: tank has attack order on player tank A. 10H1 detects player tank B near HQ → `defendHqWithAvailableTanks` reassigns tank to attack B instead of A. Tank drops target A, moves toward B.
- Tick N+1: tank approaches B. 10H1 detects threats again → reassigns. Or threats disappear → `shouldRetreat` fires → clears attack orders → retreats home.
- Tick N+2: no threats near HQ → `shouldRetreat` returns null → idle_monitoring → phase reverts → tank gets new attack order.
- Repeat.

**Important**: `defendHqWithAvailableTanks` iterates ALL enemy tanks and reassigns them to the primaryThreat. Even tanks that already have a valid attack order on a nearby player tank get their order overwritten to target the primaryThreat.

---

## 4. Как "near enemy home/base" вычисляется

Currently:

- `state.homeX / state.homeY` — set from `FE_PATCH_08BHomeAnchorFromBase(base)` (center of enemy HQ). Set once and updated each tick via `FE_PATCH_08BEnsureBotState()`.
- `FE_10H1_getLocalPlayerThreatsNearHq(enemyHQ, radius=10)` — uses distance from enemyHQ center, radius 10 tiles. This is the "near base" detection for threats.
- `FE_PATCH_08BShouldKeepUnitNearHome(unit, state, radius=12)` — uses distance from state.homeX/homeY, default radius = defendRadiusTiles = 12. Used for pulling units back to base.
- `FE_10H1_moveToSafePoint` → `FE_PATCH_08BReturnUnitHome` → moves tank to `FE_PATCH_08BHomeDestinationCell` near homeX/homeY.

**Gap**: there is no "is this tank already at/near home" check before retreat. A tank standing 2 tiles from home can be told to "retreat to home" — which is essentially a no-op in terms of position, but it **clears the attack order**, which is the harmful action.

---

## 5. Можно ли определить "no useful retreat" с существующими данными

Yes, with existing data:

- **Tank is near home**: `unitDistanceCells(unit, { x: state.homeX, y: state.homeY }) <= threshold` (e.g., 4–6 tiles). Already have `state.homeX/homeY` and `unitDistanceCells`.
- **Retreat destination is at/near current position**: `FE_PATCH_08BHomeDestinationCell(unit, state)` returns the destination. Compare with current position. If within 2–3 tiles, retreat is useless.
- **Player target in or near range**: `FE_PATCH_08BTargetInRange(attacker, target)` checks exact range (1 tile). "Almost in range" can be checked with `unitDistanceCells(unit, target) <= range + 2` using existing helpers.
- **Threat is near base**: Already computed in `FE_10H1_getLocalPlayerThreatsNearHq`.

All needed data is available. No new pathfinding or vision checks required.

---

## 6. Как проверить "player target in range / almost in range"

Existing helpers:

- `FE_PATCH_08BTargetInRange(attacker, target)` (L2748) — exact range check using `getLightTankCombatStats(attacker).range` (1 tile).
- `unitDistanceCells(unit, target)` (L904) — Manhattan distance in tile cells.
- `getLightTankCombatStats(unit).range` — returns 1 (attack range).

"Almost in range" check (proposed, not yet existing):

```javascript
function FE_PATCH_08BTargetNearRange(attacker, target, margin) {
  const targetKind = FE_PATCH_07BGetHostileLightTankTargetKind(attacker, target);
  if (!targetKind) return false;
  const stats = getLightTankCombatStats(attacker);
  const distance = targetKind === 'building'
    ? FE_PATCH_06BDistanceToBuilding(attacker, target)
    : unitDistanceCells(attacker, target);
  return distance <= stats.range + (margin || 2);
}
```

---

## 7. Предлагаемый минимальный guard/fallback

**Proposal: "stand-and-fight" guard in `FE_10H1_startRetreat` and `FE_10H1_defendHqWithAvailableTanks`**

When 10H1 is about to clear/reassign an attack order on an enemy tank, check if the tank should "stand and fight" instead:

### Guard conditions (all must be true):

1. **Tank is near home**: `unitDistanceCells(unit, { x: state.homeX, y: state.homeY }) <= NEAR_HOME_RADIUS` (e.g., 6 tiles).
2. **Player pressure is near base**: threats.length > 0 from `FE_10H1_getLocalPlayerThreatsNearHq` (already computed).
3. **Tank has a valid attack target**: `unit.attackTargetId || unit.attackApproachTargetId`, and the target is alive.
4. **Target is in range or almost in range**: `unitDistanceCells(unit, resolvedTarget) <= stats.range + 2` (1 + 2 = 3 tiles).
5. **Retreat is useless**: tank is already at/near home, so retreating would not improve its position. Verified by `unitDistanceCells(unit, { x: state.homeX, y: state.homeY }) <= NEAR_HOME_RADIUS`.

If all 5 conditions are true → **skip clearAttackOrder for this tank**. Keep its current attack order. Do not move it to safe point.

### Implementation approach:

**Option A (preferred — minimal guard in `FE_10H1_startRetreat`):**

Inside `FE_10H1_startRetreat` (L6672), before `FE_10H1_clearAttackOrder(unit)` at L6693, add a guard check:

```javascript
// BOT-DEFENSE-RETREAT-01: stand-and-fight guard.
// If tank is near home, has a valid target in/near range, and player pressure is near base,
// skip clearing the attack order — tank should fight instead of retreating uselessly.
if (attacking && threats && threats.length > 0
    && unitDistanceCells(unit, { x: state.homeX, y: state.homeY }) <= NEAR_HOME_RADIUS) {
  var _currentTarget = FE_PATCH_06BResolveAttackTarget(unit)
    || FE_PATCH_06BResolveApproachTarget(unit);
  if (_currentTarget && (_currentTarget.hp || 0) > 0) {
    var _stats = getLightTankCombatStats(unit);
    var _tDist = unitDistanceCells(unit, _currentTarget);
    if (_tDist <= _stats.range + NEAR_RANGE_MARGIN) {
      // Tank is fighting a nearby target near home — let it fight, don't retreat.
      continue; // skip clearAttackOrder + moveToSafePoint for this tank
    }
  }
}
```

This requires passing `threats` to `FE_10H1_startRetreat` (currently not passed). Alternative: compute threats inside `FE_10H1_startRetreat` using `FE_10H1_getLocalPlayerThreatsNearHq`.

**Option B (guard in `FE_10H1_updateEnemyRetreatAndDefenseMvp` before calling retreat/defend):**

Before calling `FE_10H1_startRetreat` at L6777, check if any of the tanks should stand-and-fight. If so, exclude them from the retreat pool and let them keep their attack orders.

**Recommendation: Option A** — the guard is closest to the point where the attack order is actually cleared, making it the most targeted and least risky change. It also naturally applies to both retreat and defend scenarios.

### Constants to add:

```javascript
var FE_DEFENSE_RETREAT_01_NEAR_HOME_RADIUS = 6;  // tiles from home to count as "near base"
var FE_DEFENSE_RETREAT_01_NEAR_RANGE_MARGIN = 2;  // tiles beyond attack range to count as "almost in range"
```

---

## 8. Точные файлы/функции для изменения

**Единственный файл:** `src/main.js`

| # | Функция | Линия | Изменение |
|---|---------|-------|-----------|
| 1 | Constants block (near L2362) | After FE_ATTACK12 constants | Add `FE_DEFENSE_RETREAT_01_NEAR_HOME_RADIUS = 6`, `FE_DEFENSE_RETREAT_01_NEAR_RANGE_MARGIN = 2` |
| 2 | `FE_10H1_startRetreat()` | L6672 | Add `enemyHQ` and `state` params (or compute them inside). Add stand-and-fight guard before `FE_10H1_clearAttackOrder(unit)` at L6693. |
| 3 | `FE_10H1_defendHqWithAvailableTanks()` | L6717 | Add stand-and-fight guard: if tank already has an attack order on a nearby valid target near home, skip reassigning to primaryThreat. |
| 4 | `FE_10H1_updateEnemyRetreatAndDefenseMvp()` | L6777 | Pass `enemyHQ` and `state` to `FE_10H1_startRetreat` if needed. |

---

## 9. Что НЕ трогать

- Combat damage functions (`damageUnit`, `FE_PATCH_06BDamageBuilding`)
- Combat range/cooldown/damage values
- Pathfinding / `findPath` / `passable`
- Enemy production / economy
- Scout lifecycle (`FE_SCOUT01*`, `FE_INTEL01*`)
- BOT-ATTACK-11/12 attack gate logic
- BOT-ATTACK-12 thresholds (`FE_ATTACK12_MIN_ATTACK_TANKS`, `FE_ATTACK12_FORCE_ADVANTAGE`, `FE_ATTACK12_MAX_INTEL_AGE_SEC`)
- 10E1 strength estimate
- 10B knowledge refresh
- BOT-COMBAT-AWARENESS-01 (`FE_INTEL01UpdateFromTankVision`, `FE_INTEL01UpdateFromCombatContact`)
- ATTACK-04 hq_push protection
- ATTACK-08 invariant repair
- ATTACK-10 wave lock
- FE_PATCH_BRAIN_01 decision loop
- Save/load
- Render / fog
- Map generation

---

## 10. Риск

**Medium-Low.**

Обоснование:
- Guard only **prevents** clearing attack orders — never adds new ones.
- Guard only activates when tank is near home, has valid target, and player is pressuring near base — very specific scenario.
- If the guard is too aggressive (blocks retreat when it should happen), the worst case is that a tank fights to death instead of retreating — which is actually **better** than oscillating uselessly.
- Risk of guard not activating when needed: if tank is slightly outside near-home radius (7 tiles), it won't be protected. This is acceptable — those tanks are not in the "oscillation near base" scenario.
- Main risk: `FE_10H1_startRetreat` signature change (adding params). However, it's only called from one place (`FE_10H1_updateEnemyRetreatAndDefenseMvp`), so the impact is minimal.

---

## 11. Telemetry / debug plan

Add to `game._botDefenseRetreat01` (new minimal debug object):

```javascript
{
  standAndFightGuardCount: 0,      // how many times guard prevented retreat order clear
  lastStandAndFightAt: 0,          // game time of last guard activation
  lastGuardUnitId: null,           // unit ID of last guarded tank
  lastGuardTargetDist: -1,         // distance from guarded tank to its target
  lastGuardDistToHome: -1          // distance from guarded tank to home
}
```

This is minimal telemetry — shows guard is working, without per-frame overhead. Updated only when guard fires.

---

## 12. Targeted smoke test plan

**Сценарий 1 — Oscillation fix:**
1. Start skirmish, build 2–3 player light_tanks.
2. Move player tanks toward enemy base corner (within 6–8 tiles of enemy HQ).
3. Observe enemy tank behavior: they should engage player tanks and **not** oscillate between attack/retreat.
4. Verify `game._botDefenseRetreat01.standAndFightGuardCount > 0` in console.
5. Verify enemy tank `state` stays 'attacking' or 'attack_approach' while target is in range and tank is near home.

**Сценарий 2 — Normal retreat still works:**
1. Start skirmish, build 5 player light_tanks.
2. Send player tanks far from enemy base (mid-map) and engage enemy tanks there.
3. Enemy tanks should still retreat when outnumbered in open field.
4. Verify `standAndFightGuardCount` does NOT increment for tanks far from home.

**Сценарий 3 — Defend reassignment:**
1. Player has 2 tanks near enemy base.
2. Enemy tank A is attacking player tank 1 (in range).
3. Player tank 2 approaches enemy HQ.
4. `defendHqWithAvailableTanks` should NOT reassign tank A away from its current valid target if tank A is near home and target is in/near range.

**Сценарий 4 — Regression:**
1. Normal game flow without player pressure near enemy base — bot should behave identically to before.
2. hq_push attacks should not be affected (already protected by ATTACK-04).
3. Wave-locked tanks should not be affected (already protected by ATTACK-10).
4. Scout lifecycle unchanged.

Жду «Делай».
