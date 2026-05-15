CODE_SUMMARY POWER-SYSTEM-01A
Branch: glm/power-system-01a
PR: #62
SHA: 110f90f
Files: src/main.js, src/config/runtime_flags.js
Checks: node --check src/main.js — PASSED, node --check src/config/runtime_flags.js — PASSED
Changes:
- Shared unit power upkeep (player + enemy, 1 MW per active unit)
- FE_POWER_HQ_MW raised from 10 to 15 to avoid early-game softlock
- Player evaluatePowerState() extended with unit upkeep in powerUsed
- Enemy power evaluation: enemy HQ + power_plant capacity, unit upkeep, separator/factory power
- Enemy separator reserves cfg.separatorMw only when FE_PATCH_09C3EnemySeparatorCycleCheck().ok (minerals available, storage not full)
- Resource-stalled separators do not consume power and are not marked _enemyPowerPaused; stall marking handled by FE_PATCH_09C3UpdateEnemySeparatorMarks
- Enemy factory power: only reserves when queue has items
- Enemy separator/factory respect enemy power pressure (pause/allow)
- BRAIN-01 build_power_plant action with preflight checks (no duplicate build, free builder, can afford)
- Telemetry: game._powerSystem01.*
