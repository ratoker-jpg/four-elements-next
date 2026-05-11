# GPT_REVIEW

Task: VISUAL-COMBAT-FX-01 — minimal procedural light_tank shot and hit effects

Verdict: APPROVED_FOR_PHASE_2

## 1. Что в аудите ок

- Root cause простой и верный: combat damage happens in `updateLightTankCombat()`, but no visual event is emitted.
- Правильно найден safe insertion point: after successful damage application and cooldown reset.
- Правильно выбран подход: procedural Canvas 2D FX, no asset dependency.
- Хорошо, что existing dust system is used only as a pattern, not merged or rewritten.
- Scope can stay visual-only: shot/muzzle flash + hit burst + short lifetime + particle cap.

## 2. Что вызывает сомнения

- Не надо делать полноценную ballistic/projectile simulation.
- Не надо делать complex tracer trajectory or persistent bullets.
- Не надо менять `damageUnit()` / `FE_PATCH_06BDamageBuilding()` logic.
- Не надо трогать save/load. Combat FX are transient visual-only and must not be persisted.
- Fog visibility check is good, but must stay simple. Do not rewrite fog/render.
- Do not touch combat balance, bot AI, pathfinding, economy, unit state machine, HP bars, sprite rendering.

## 3. Как сделать лучше

Approved implementation should:

1. Add a small visual-only particle list, e.g. `game.combatFxParticles`.
2. Add spawn/update/draw functions:
   - `spawnCombatShotFx(attacker, target, isBuildingTarget)` or similar;
   - `spawnCombatHitFx(target, isBuildingTarget)` or similar;
   - `updateCombatFxParticles(dt)`;
   - `drawCombatFxParticles()`.
3. Spawn FX only when a light_tank actually fires, after damage is applied in `updateLightTankCombat()`.
4. Keep effects short and readable:
   - shot/muzzle flash around 0.12–0.20 sec;
   - hit flash around 0.18–0.30 sec;
   - hard cap around 60 particles.
5. Use procedural Canvas only: no assets, no spritesheets.
6. Respect fog simply:
   - player attacker: show;
   - enemy attacker: show only if attacker or target tile is visible.
7. Keep telemetry minimal:
   - `game._combatFx01.shotCount`
   - `game._combatFx01.hitCount`
   - `game._combatFx01.activeParticles`

## 4. Вердикт

Approved for Phase 2 with the constraints above.

Use `docs/glm_exchange/PHASE2_COMMAND.md` as the implementation command.
