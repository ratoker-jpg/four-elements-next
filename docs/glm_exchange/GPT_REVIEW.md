# GPT_REVIEW

Task: BOT-PROGRESSION-01 — audit why enemy economy/production stalls around ~3 tanks

Verdict: APPROVED_FOR_PHASE_2

## 1. Что в аудите ок

- Root cause найден: enemy light_tank production hard-capped by `FE_ENEMY_LIGHT_TANK_CAP = 3`.
- Аудит объясняет, почему игрок видит stall около 3 танков: factory stops producing, elements stop being consumed, storage fills, separator pauses.
- Второй найденный баг тоже важен: cap check can short-circuit `FE_PATCH_BASELINE_01_ChooseFactoryUnitType()` before worker replenishment checks.
- Scope можно держать маленьким: only production cap + worker-priority ordering.
- Не нужно трогать economy expansion, new buildings, pathfinding, combat, scout, BOT-ATTACK-11/12.

## 2. Что вызывает сомнения

- Не надо в этом патче строить дополнительные separators/storages/factories.
- Не надо менять build order / BRAIN-01 action list.
- Не надо добавлять time-based tank cap scaling сейчас.
- Не надо добавлять новую telemetry, если существующих `game._attack09EnemyTankCap` и `game._enemyFactoryProductionStatus` достаточно.
- Disabling the cap can allow more tanks over time, but current natural limits still constrain production: one factory, queue depth 1, element cost, build time, ATTACK-12 gate.

## 3. Как сделать лучше

Approved implementation should:

1. Disable the experimental enemy light_tank cap:
   - change `window.FE_ENEMY_LIGHT_TANK_CAP = 3` to `0`, or the existing disabled-cap value used by the code.
   - Do not introduce dynamic cap scaling in this patch.

2. Fix `FE_PATCH_BASELINE_01_ChooseFactoryUnitType()` ordering:
   - worker/scout replacement checks must happen before any tank cap early-return;
   - if cap is enabled again later, it must block only tank production, not worker replenishment.

3. Keep all other systems unchanged:
   - no economy expansion;
   - no storage/factory/separator construction changes;
   - no combat changes;
   - no attack gate changes;
   - no pathfinding changes.

4. Prefer no new telemetry.
   Existing telemetry should be enough:
   - `game._attack09EnemyTankCap`
   - `game._enemyFactoryProductionStatus`

## 4. Вердикт

Approved for Phase 2 with the constraints above.

Use `docs/glm_exchange/PHASE2_COMMAND.md` as the implementation command.
