# GPT_REVIEW

Task: POWER-SYSTEM-01 — audit power capacity and upkeep for units/buildings

Verdict: APPROVED_FOR_PHASE_2_WITH_REDUCED_SCOPE

Approved implementation task:

POWER-SYSTEM-01A — shared unit upkeep + enemy power_plant response

## 1. Что в аудите ок

- Root cause верный: after removing the enemy tank cap, there is no natural ongoing limiter for army/unit scaling.
- `power_plant` currently has weak strategic value because one plant gives too much headroom and units do not consume power.
- Audit correctly found the asymmetry: existing `evaluatePowerState()` is player-only, while enemy separator/factory ignore power.
- Audit correctly warns that this is core gameplay and balance risk, not a tiny tweak.

## 2. Что вызывает сомнения

GLM recommendation "Fix A only for player" is not acceptable for this project goal.

Why:
- It makes player more constrained while enemy remains unconstrained.
- It does not solve the user's main problem: enemy can keep scaling tanks without power pressure.
- It makes the system asymmetric and harder to reason about.

Do NOT implement player-only unit upkeep.

Also do NOT implement full complex power system now:
- no UI warning/toast work;
- no save/load changes unless strictly required by derived-state bug;
- no building disable logic beyond existing power pause style;
- no damage/combat/pathfinding changes;
- no differentiated per-unit costs yet;
- no power penalties for already existing units.

## 3. Approved reduced scope

Implement one coherent MVP:

1. Shared unit power upkeep:
   - player units consume power;
   - enemy units consume power;
   - initial unit cost can be simple and uniform: 1 MW per active unit.

2. Avoid early-game softlock:
   - ensure baseline HQ power can support starter workers + separator + factory.
   - Preferred: increase `FE_POWER_HQ_MW` from 10 to 15, or use equivalent minimal change.
   - Do not add grace periods.

3. Player power:
   - extend existing player `evaluatePowerState()` to include player unit upkeep in `powerUsed`.
   - keep existing separator/factory pause behavior.
   - do not add new UI warning/toast in this patch.

4. Enemy power:
   - add minimal enemy power evaluation for enemy buildings + enemy units.
   - enemy HQ provides power, enemy power_plant adds capacity.
   - enemy separator/factory should respect enemy power pressure using the same simple pause/allow logic.

5. Bot response:
   - BRAIN-01 can choose `build_power_plant` when enemy power usage is near capacity, e.g. >= 80%.
   - Add preflight checks before choosing the action:
     - no currently queued power_plant build order;
     - free enemy builder exists;
     - enemy can afford power_plant;
     - avoid repeated impossible action loops.
   - Allow multiple power_plants over time if power keeps filling, but never queue duplicates simultaneously.

## 4. Allowed file

- `src/main.js`

Only touch config file if absolutely required to adjust existing power constants. Prefer runtime override in `src/main.js` if that is already how current constants are read.

## 5. Do NOT touch

- combat damage/range/cooldown;
- pathfinding/findPath/passable;
- scout lifecycle;
- BOT-ATTACK-11/12;
- BOT-COMBAT-AWARENESS-01;
- BOT-DEFENSE-RETREAT-01;
- BOT-PROGRESSION-01;
- VISUAL-COMBAT-FX-01;
- BOT-ECONOMY-01A elements_storage logic;
- harvester mining state machine;
- separator conversion formula;
- save/load unless a clear derived-state issue requires a tiny fix;
- render/fog/mapgen;
- factory queue depth;
- emergency builder;
- target chaining after kill;
- advanced UI warnings/toasts.

## 6. Telemetry

Add minimal non-noisy debug state:

- `game._powerSystem01.playerUnitPowerUsed`
- `game._powerSystem01.playerBuildingPowerUsed`
- `game._powerSystem01.playerPowerTotal`
- `game._powerSystem01.enemyUnitPowerUsed`
- `game._powerSystem01.enemyBuildingPowerUsed`
- `game._powerSystem01.enemyPowerTotal`
- `game._powerSystem01.enemyPowerPlantOrderCount`
- `game._powerSystem01.enemyLastPowerPlantOrderAt`
- `game._powerSystem01.enemyLastPowerReason`

## 7. Вердикт

Approved for Phase 2 with reduced scope only.

Use `docs/glm_exchange/PHASE2_COMMAND.md` as the implementation command.
