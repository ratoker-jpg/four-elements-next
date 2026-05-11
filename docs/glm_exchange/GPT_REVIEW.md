# GPT_REVIEW

Task: BOT-DEFENSE-RETREAT-01 — fix enemy retreat/defense oscillation near base

Verdict: APPROVED_FOR_PHASE_2

## 1. Что в аудите ок

- Root cause выглядит правдоподобно: oscillation возникает не из damage/combat, а из 10H1 retreat/defense overwrite активных attack orders.
- Правильно найден ключевой риск: `FE_10H1_startRetreat()` очищает attack orders через `FE_10H1_clearAttackOrder()`, даже когда tank уже near home и retreat бесполезен.
- Правильно найден второй риск: `FE_10H1_defendHqWithAvailableTanks()` может перекидывать tank с текущей валидной цели на primaryThreat, создавая дерготню.
- Хороший минимальный принцип: не переписывать retreat, а добавить stand-and-fight guard у точек overwrite.
- Нормальный риск: Medium-Low.

## 2. Что вызывает сомнения

- Нельзя делать новую state machine.
- Нельзя переписывать 10H1 целиком.
- Нельзя лезть в pathfinding / findPath / passable.
- Нельзя менять damage/range/cooldown.
- Нельзя менять BOT-ATTACK-11/12, scout, economy, production.
- Signature change `FE_10H1_startRetreat()` допустим только если функция реально вызывается из одного места и diff остаётся маленьким.
- Guard должен быть узким: near home + valid current target + in/almost in range + player pressure near base.

## 3. Как сделать лучше

Approved implementation should:

1. Add a small helper, e.g. `FE_DEFENSE_RETREAT01ShouldStandAndFight(unit, state, threats, now)`.
2. Use this helper in:
   - `FE_10H1_startRetreat()` before `FE_10H1_clearAttackOrder(unit)`;
   - `FE_10H1_defendHqWithAvailableTanks()` before reassigning a tank away from its current valid target.
3. Keep helper read-only except telemetry when guard fires.
4. Avoid new movement commands unless existing defend logic already issues them.
5. Add minimal telemetry only when guard fires:
   - `game._botDefenseRetreat01.standAndFightGuardCount`
   - `lastStandAndFightAt`
   - `lastGuardUnitId`
   - `lastGuardTargetDist`
   - `lastGuardDistToHome`
6. Keep targeted smoke only. Full manual match QA deferred to BATCH QA.

## 4. Вердикт

Approved for Phase 2 with the constraints above.

Use `docs/glm_exchange/PHASE2_COMMAND.md` as the implementation command.
