# GPT_REVIEW

Task: BOT-ECONOMY-01 — audit enemy economy scaling and recovery path

Verdict: APPROVED_FOR_PHASE_2_WITH_REDUCED_SCOPE

Approved implementation task:

BOT-ECONOMY-01A — enemy builds elements_storage when element storage is near full

## 1. Что в аудите ок

- Root cause по экономике выглядит валидно: enemy separator can stall when element storage is full.
- BRAIN-01 currently does not build `elements_storage`, so element cap can become a hard bottleneck.
- The audit correctly identifies that broader economy scaling/recovery has multiple separate problems:
  - element storage pressure;
  - no economy scaling actions;
  - death spiral when no factory and no builder;
  - factory queue depth = 1.

## 2. Что вызывает сомнения

The full audit scope is too broad for one patch.

Do NOT include in this patch:
- emergency builder recovery;
- factory queue depth change;
- second separator;
- second factory;
- minerals_storage / energy_storage scaling;
- power/upkeep system;
- target chaining after kill;
- player economy changes.

Those are separate future tasks.

## 3. Approved reduced scope

Implement only BOT-ECONOMY-01A:

Enemy BRAIN-01 should order `elements_storage` when enemy element storage is near full.

Allowed behavior:
1. Detect enemy element storage pressure, e.g. current faction element >= 80% of limit.
2. If enemy already has or queued `elements_storage`, do nothing.
3. If enemy has separator/factory baseline and has enough energy, order one free enemy builder to build `elements_storage`.
4. Add BRAIN-01 action/case only for this one storage type.
5. Add minimal telemetry for this action.

## 4. Constraints

Allowed file:
- `src/main.js`

Do NOT touch:
- combat damage/range/cooldown;
- pathfinding/findPath/passable;
- scout lifecycle;
- BOT-ATTACK-11/12;
- BOT-COMBAT-AWARENESS-01;
- BOT-DEFENSE-RETREAT-01;
- BOT-PROGRESSION-01;
- VISUAL-COMBAT-FX-01;
- harvester mining state machine;
- separator conversion formula;
- player economy;
- save/load;
- render/fog/mapgen;
- power/upkeep system;
- factory queue depth;
- emergency builder.

## 5. Telemetry

Add minimal telemetry only for BOT-ECONOMY-01A:

- `game._economy01.elementsStorageOrderCount`
- `game._economy01.elementsStorageLastOrderAt`
- `game._economy01.elementsStorageLastReason`

No noisy per-frame telemetry.

## 6. Вердикт

Approved for Phase 2 with reduced scope only.

Use `docs/glm_exchange/PHASE2_COMMAND.md` as the implementation command.
