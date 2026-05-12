# ARCH-LAB-01 — Skeleton Contracts & unit_controller Archive

**Дата:** 2026-05-13
**Тип:** Architecture skeleton / docs + archive
**Риск:** Low — no code extraction, no gameplay changes
**PR:** TBD
**Roadmap ref:** ARCH-LAB-00 step 01 (reduced scope)

---

## Summary

Создание структурного скелета модульной архитектуры и архивация неактивного модуля unit_controller.js. Никакой код не извлечён из main.js, поведение игры не изменено.

## Changes

### New files

| File | Type | Description |
|------|------|-------------|
| `src/game/README.md` | docs | Ownership skeleton — game state & session directory |
| `src/systems/README.md` | docs | Ownership skeleton — gameplay systems directory |
| `src/render/README.md` | docs | Ownership skeleton — rendering & visual systems directory |
| `src/input/README.md` | docs | Ownership skeleton — input & interaction directory |
| `src/ai/README.md` | docs | Ownership skeleton — AI & decision systems directory (existing dir, new README) |
| `src/core/README.md` | docs | Ownership skeleton — core infrastructure directory (existing dir, new README) |
| `src/core/_archived/unit_controller.js` | archive | Moved from `src/core/unit_controller.js` + WARNING deprecation header |
| `docs/project/ARCH_LAB_01_SKELETON_CONTRACTS.md` | docs | Full skeleton contracts document — module boundaries, FE_CORE bridge, load order, ownership contracts |

### Modified files

| File | Change |
|------|--------|
| `src/config/runtime_flags.js` | Added deprecation comment for `FE_UNIT_CONTROLLER_ENABLED` (flag value unchanged — still `false`) |
| `index.html` | Updated script tag path: `src/core/unit_controller.js` → `src/core/_archived/unit_controller.js` (no other changes) |

### Deleted files

| File | Reason |
|------|--------|
| `src/core/unit_controller.js` | Moved to `src/core/_archived/unit_controller.js` — not deleted, just relocated |

### NOT touched (hard limits)

- `src/main.js` — no changes
- `package.json` — no changes
- `playwright.config.js` — no changes
- `tests/` — no changes
- Gameplay behavior — unchanged
- Movement/pathfinding/combat/economy/AI/render/save/load — unchanged

## Rationale

### Why skeleton READMEs now?

ARCH-LAB-02 (game state + bootstrap extraction) needs to know where to put extracted modules. Each README defines:
- What the directory is for
- What modules are planned for extraction
- What dependencies are allowed (dependency direction)
- What contract the modules must follow (FE_MODULE_NAME, FE_CORE bridge)

Without these contracts, LAB-02 would have to invent directory structure on the fly, increasing review time and risk of inconsistent conventions.

### Why archive unit_controller.js now?

ARCH-LAB-00B decided to archive (not delete) unit_controller.js because:
1. It was never activated — `FE_UNIT_CONTROLLER_ENABLED` has always been `false`
2. The production movement code is in main.js Z14 (~568 lines)
3. Keeping an inactive 878-line module in `src/core/` is confusing — it looks like production code
4. Moving to `_archived/` makes deprecation status explicit without losing the design record
5. The file is still loaded by index.html (now from `_archived/` path) so the guard in main.js continues to work

### Why not extract coordinates/constants (original LAB-01 scope)?

The user narrowed the scope to exclude main.js extraction. Coordinates and game_constants extraction is deferred to a future step. This is consistent with the "do NOT touch main.js" hard limit.

## Checks

```
node --check src/config/runtime_flags.js           → PASS
node --check src/core/_archived/unit_controller.js  → PASS
```

E2E smoke: UNVERIFIED (no browser available in this session)
- index.html script path is the only functional change (path update for unit_controller.js)
- Since FE_UNIT_CONTROLLER_ENABLED=false, the archived module is never called
- Risk assessment: negligible — same file content, different path, guard still reads the same flag

## Next steps

- ARCH-LAB-02: Game state + bootstrap extraction from main.js
- ARCH-AI-01 Phase 2: Tank decider activation (still pending, approved with constraints)
