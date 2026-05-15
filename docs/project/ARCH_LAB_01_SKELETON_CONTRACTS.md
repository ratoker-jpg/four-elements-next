# ARCH-LAB-01 — Skeleton Contracts & unit_controller Archive

**Дата:** 2026-05-13
**Тип:** Architecture skeleton / docs-only + archive
**Статус:** Активный
**PR:** TBD
**Roadmap ref:** ARCH-LAB-00 step 01 (reduced scope — no main.js extraction)

---

## 1. Purpose

ARCH-LAB-01 creates the **structural skeleton** for the modular architecture migration. This is a docs-and-structure-only step: no code is extracted from main.js, no gameplay behavior changes. The goal is to establish:

1. **Ownership README files** — each target directory gets a README defining its purpose, planned modules, dependencies, and contract.
2. **Skeleton contracts document** — this file, recording the API contracts and module boundaries that future LAB steps must respect.
3. **unit_controller.js archive** — formally deprecate and move the inactive alternative controller to `_archived/`.
4. **runtime_flags.js clarification** — document that `FE_UNIT_CONTROLLER_ENABLED` is permanently false.

This step is a prerequisite for ARCH-LAB-02 (game state + bootstrap extraction) because LAB-02 needs to know which directories exist, what their contracts are, and where to place extracted modules.

---

## 2. Directory structure

### Current (before ARCH-LAB-01)

```
src/
  main.js
  main_before_restore_04a.js
  main_broken_04c3.js
  main_broken_04c5.js
  ai/
    tank_decider.js
  config/
    buildings.js
    units.js
    factions.js
    environment.js
    sprite_profiles.js
    runtime_flags.js
  core/
    standalone_constants.js
    storage_guard.js
    asset_loader.js
    save_manager.js
    unit_controller.js
  dev/
    combat_debug_overlay.js
    enemy_economy_debug_panel.js
    snapshot_export.js
  modules/
    debug/
      debug_tools.js
      render_debug.js
    render/
      visual_anchor.js
      sprite_alpha.js
      visual_calibrator.js
  ui/
    screen_manager.js
```

### After ARCH-LAB-01

```
src/
  main.js                    (UNCHANGED — hard limit)
  main_before_restore_04a.js  (UNCHANGED)
  main_broken_04c3.js         (UNCHANGED)
  main_broken_04c5.js         (UNCHANGED)
  ai/
    README.md                 (NEW — ownership skeleton)
    tank_decider.js           (UNCHANGED)
  config/
    buildings.js              (UNCHANGED)
    units.js                  (UNCHANGED)
    factions.js               (UNCHANGED)
    environment.js            (UNCHANGED)
    sprite_profiles.js        (UNCHANGED)
    runtime_flags.js          (MODIFIED — comment update only)
  core/
    README.md                 (NEW — ownership skeleton)
    standalone_constants.js   (UNCHANGED)
    storage_guard.js          (UNCHANGED)
    asset_loader.js           (UNCHANGED)
    save_manager.js           (UNCHANGED)
    _archived/                (NEW — archive directory)
      unit_controller.js      (MOVED from src/core/ + WARNING header)
  dev/
    combat_debug_overlay.js   (UNCHANGED)
    enemy_economy_debug_panel.js (UNCHANGED)
    snapshot_export.js        (UNCHANGED)
  game/
    README.md                 (NEW — ownership skeleton, no modules yet)
  input/
    README.md                 (NEW — ownership skeleton, no modules yet)
  modules/
    debug/                    (UNCHANGED)
    render/                   (UNCHANGED — migration to src/render/ in LAB-04)
  render/
    README.md                 (NEW — ownership skeleton, no modules yet)
  systems/
    README.md                 (NEW — ownership skeleton, no modules yet)
  ui/
    screen_manager.js         (UNCHANGED)
```

---

## 3. Module registration contract (FE_MODULE_NAME)

Every external module must register itself on `window.FE_MODULE_NAME` where `MODULE_NAME` matches its file purpose. This allows main.js and other modules to detect whether a dependency loaded successfully.

### Registration pattern

```javascript
(function () {
  'use strict';
  // ... module code ...
  window.FE_TANK_DECIDER = public_api;  // example
})();
```

### Dependency bridge (FE_CORE)

`window.FE_CORE` is the shared dependency injection point. Modules publish their APIs here; main.js and other modules consume from it. No module may directly call into main.js.

```javascript
// In main.js (wiring phase):
window.FE_CORE = {
  game: game,
  debugLog: debugLog,
  passable: passable,
  // ... more APIs added as extraction proceeds
};

// In extracted module:
var core = window.FE_CORE;
core.game.enemyUnits.push(newUnit);
```

### Load order contract

Scripts in `index.html` must be ordered by dependency depth:

1. `src/config/*` — pure data, no dependencies
2. `src/core/standalone_constants.js` — frozen constants
3. `src/core/storage_guard.js` — localStorage protection
4. `src/core/asset_loader.js` — sprite loading
5. `src/core/save_manager.js` — save/load
6. `src/core/_archived/unit_controller.js` — deprecated, still loaded for backward compat
7. `src/ui/screen_manager.js` — UI screens
8. `src/modules/render/*` — render helpers
9. `src/modules/debug/*` — debug tools
10. `src/dev/*` — dev-only panels
11. `src/core/standalone_constants.js` — (already at position 2)
12. `src/ai/tank_decider.js` — AI modules
13. `src/main.js` — game logic + wiring (depends on all above)

New directories (game/, systems/, render/, input/) will be inserted
at appropriate positions when their first modules are created in LAB-02+.

---

## 4. Ownership contracts by directory

### src/game/ — Game State & Session

| Aspect | Contract |
|--------|----------|
| **Purpose** | Game object init, reset, map setup, session lifecycle |
| **Extraction step** | ARCH-LAB-02 |
| **Dependencies** | config/, core/ — no dependency on systems/ or ai/ |
| **Consumed by** | main.js wiring, systems/, ai/, render/, input/ |
| **Key invariant** | Game state is created once per session; modules read from FE_CORE.game |

### src/systems/ — Gameplay Systems

| Aspect | Contract |
|--------|----------|
| **Purpose** | Self-contained gameplay subsystems (pathfinding, movement, combat, economy) |
| **Extraction step** | ARCH-LAB-03, ARCH-LAB-04 |
| **Dependencies** | core/, config/, game/ — never import from ai/ or input/ |
| **Consumed by** | main.js game loop, ai/ (for enemy bot decisions), input/ (for command dispatch) |
| **Key invariant** | Systems are stateless transformers — they accept game state and return mutations, never hold their own state |

### src/render/ — Rendering & Visual

| Aspect | Contract |
|--------|----------|
| **Purpose** | All draw calls, camera, visual effects, sprite rendering |
| **Extraction step** | ARCH-LAB-04 |
| **Dependencies** | core/asset_loader, config/sprite_profiles, config/runtime_flags — never modify game state |
| **Consumed by** | main.js game loop (render phase) |
| **Key invariant** | Render is read-only from game data — never mutates game state or triggers gameplay effects |

### src/input/ — Input & Interaction

| Aspect | Contract |
|--------|----------|
| **Purpose** | Mouse/keyboard event handling, selection, command dispatch |
| **Extraction step** | ARCH-LAB-04 |
| **Dependencies** | core/, config/runtime_flags, game/ — dispatches through systems/, never modifies game state directly |
| **Consumed by** | main.js (event binding phase) |
| **Key invariant** | Input translates player intent to commands; systems execute commands. Input never calls game-mutation functions directly. |

### src/ai/ — AI & Decision Systems

| Aspect | Contract |
|--------|----------|
| **Purpose** | Enemy bot brain, decision layers, scout AI, attack AI |
| **Extraction step** | ARCH-LAB-02 (bootstrap), ARCH-LAB-05 (full extraction) |
| **Dependencies** | core/, config/runtime_flags, game/ (read world state), systems/ (issue commands) |
| **Consumed by** | main.js (enemy update tick) |
| **Key invariant** | AI modules are guarded by `FE_*_ENABLED` runtime flags; when flag is false, 1:1 legacy behavior is preserved in main.js |

### src/core/ — Core Infrastructure

| Aspect | Contract |
|--------|----------|
| **Purpose** | Foundational modules with zero gameplay dependencies |
| **Extraction step** | Ongoing (LAB-01 through LAB-07) |
| **Dependencies** | config/ only — never import from any other src/ directory |
| **Consumed by** | All other directories, main.js |
| **Key invariant** | Core modules are loadable before game state exists; they never call into game logic |

---

## 5. unit_controller.js deprecation

### History

`src/core/unit_controller.js` (878 lines) was created as an alternative unit movement controller, intended to replace the inline movement code in main.js. It was never activated — `FE_UNIT_CONTROLLER_ENABLED` has always been `false`. The main.js movement code (Z14, ~568 lines) remains the production path for all unit movement.

### Decision (ARCH-LAB-00B)

ARCH-LAB-00B decided: **archive, do not delete**. The file documents a design approach that was explored but not used. Moving it to `_archived/` makes its status explicit without losing the code or the design record.

### Archive actions

1. Move `src/core/unit_controller.js` → `src/core/_archived/unit_controller.js`
2. Add WARNING header at the top of the file
3. Update `index.html` script tag path from `src/core/unit_controller.js` to `src/core/_archived/unit_controller.js`
4. Update `runtime_flags.js` comment for `FE_UNIT_CONTROLLER_ENABLED` to document permanent deprecation
5. Do NOT delete `FE_UNIT_CONTROLLER_ENABLED` flag — it is still read by main.js guard code
6. Do NOT touch the legacy guard in main.js

### WARNING header

```javascript
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  WARNING — DEPRECATED MODULE — DO NOT ACTIVATE                     ║
// ║                                                                     ║
// ║  This module was an alternative unit movement controller that was   ║
// ║  never activated in production. FE_UNIT_CONTROLLER_ENABLED has      ║
// ║  always been false. The production movement code remains in         ║
// ║  main.js (Z14). This file is archived for design record only.       ║
// ║                                                                     ║
// ║  Archived: 2026-05-13 (ARCH-LAB-01)                                ║
// ║  Decision: ARCH-LAB-00B — archive, do not delete                   ║
// ║  Do NOT remove FE_UNIT_CONTROLLER_ENABLED flag — main.js reads it  ║
// ╚══════════════════════════════════════════════════════════════════════╝
```

---

## 6. Acceptance criteria

- [x] 6 ownership README.md files created (game, systems, render, input, ai, core)
- [x] ARCH_LAB_01_SKELETON_CONTRACTS.md created
- [x] unit_controller.js moved to _archived/ with WARNING header
- [x] runtime_flags.js comment updated for FE_UNIT_CONTROLLER_ENABLED
- [x] index.html script path updated for unit_controller.js
- [x] docs/patches/ARCH-LAB-01.md created
- [x] docs/patches/INDEX.md updated
- [x] main.js NOT touched (hard limit)
- [x] Gameplay behavior NOT changed (hard limit)
- [x] package.json/playwright/tests NOT changed (hard limit)
- [x] `node --check` passes for runtime_flags.js and _archived/unit_controller.js

---

## 7. Future extraction roadmap

| Step | Target directory | Source zone | Est. lines from main.js | Risk |
|------|-----------------|-----------|------------------------|------|
| LAB-02 | src/game/, src/ai/ | Z1–Z7, Z13 core | ~1 200 | Medium |
| LAB-03 | src/systems/ | Z12, Z18, shared | ~1 400 | Medium-High |
| LAB-04 | src/systems/, src/render/, src/input/ | Z14, Z20, Z22 | ~3 500 | High |
| LAB-05A–D | src/ai/ | Z13 full | ~2 500 | Medium |
| LAB-06 | Integration tests | — | +300 tests | Low |
| LAB-07 | Cleanup | — | −2 000 bridges | Low |

**Total estimated main.js reduction:** 15 611 → ~5 000–8 000 lines
