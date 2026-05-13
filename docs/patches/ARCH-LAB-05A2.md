# ARCH-LAB-05A2 — Enemy Intel Factory Delegation

**Date:** 2026-05-13
**PR:** #84
**Branch:** `glm/arch-lab-05a2-enemy-intel-delegation`
**Scope:** Minimal delegation wiring — two main.js functions delegate to FE_ENEMY_INTEL factories

## Summary

Wire `FE_PATCH_10BCreateEnemyKnowledge()` and `FE_INTEL01Init(g)` in `src/main.js` to delegate
object creation to `window.FE_ENEMY_INTEL` factory functions when the module is available.
Legacy inline fallback code is preserved exactly for when the module is missing.

This PR does **not** change any runtime behavior. When `enemy_intel.js` is loaded (which it
always is in current builds), the factories produce objects with identical shape and defaults
to the legacy inline code. When the module is missing, the game falls back to inline creation.

## What changed

### FE_PATCH_10BCreateEnemyKnowledge() (main.js line ~2720)

Before:
```javascript
function FE_PATCH_10BCreateEnemyKnowledge() {
    return { updatedAt: 0, visibleUnitIds: [], ... };
}
```

After:
```javascript
function FE_PATCH_10BCreateEnemyKnowledge() {
    if (window.FE_ENEMY_INTEL && typeof window.FE_ENEMY_INTEL.createEnemyKnowledgeShell === 'function') {
      return window.FE_ENEMY_INTEL.createEnemyKnowledgeShell();
    }
    // Legacy fallback — preserve exact shape if module missing
    return { updatedAt: 0, visibleUnitIds: [], ... };
}
```

### FE_INTEL01Init(g) (main.js line ~3727)

Before:
```javascript
function FE_INTEL01Init(g) {
    if (g.enemyIntel) return g.enemyIntel;
    g.enemyIntel = { playerHqSeen: false, ... };
    return g.enemyIntel;
}
```

After:
```javascript
function FE_INTEL01Init(g) {
    if (g.enemyIntel) return g.enemyIntel;
    if (window.FE_ENEMY_INTEL && typeof window.FE_ENEMY_INTEL.createEnemyIntelSnapshot === 'function') {
      g.enemyIntel = window.FE_ENEMY_INTEL.createEnemyIntelSnapshot();
    } else {
      g.enemyIntel = { playerHqSeen: false, ... };
    }
    return g.enemyIntel;
}
```

## What was NOT changed

- `src/ai/enemy_intel.js` — untouched
- `index.html` — untouched
- `FE_PATCH_10BEnsureEnemyKnowledge` — untouched (guard function, not a factory)
- `FE_PATCH_10BRefreshEnemyKnowledge` — untouched
- `FE_PATCH_10BPruneEnemyKnowledge` — untouched
- `FE_INTEL01UpdateFromScout` — untouched
- `FE_INTEL01UpdateFromTankVision` — untouched
- `FE_INTEL01UpdateFromCombatContact` — untouched
- `FE_ATTACK11ChooseIntelTarget` — untouched
- `FE_ATTACK12EvaluateAttackDecision` — untouched
- All scout lifecycle functions — untouched
- `updateEnemyBot` — untouched
- Pathfinding, production, economy, render, input, save/load — untouched

## Files changed

| File | Action | Description |
|------|--------|-------------|
| `src/main.js` | MOD | Added delegation guards to FE_PATCH_10BCreateEnemyKnowledge and FE_INTEL01Init |
| `docs/patches/ARCH-LAB-05A2.md` | NEW | This document |
| `docs/patches/INDEX.md` | MOD | Added ARCH-LAB-05A2 entry |

## Architecture KPI

| Metric | Value |
|--------|-------|
| main.js lines before | 15,719 |
| main.js lines after | 15,730 |
| net delta | +11 |
| functions changed | 2 |
| functions removed | 0 |

**Why main.js did not shrink:** This PR adds delegation guards (the `if (window.FE_ENEMY_INTEL ...)` checks) plus their comments, while preserving the legacy fallback inline code. The net +11 lines represent wiring overhead that is necessary to establish the delegation contract. The legacy fallback code can be removed in a future cleanup PR (LAB-07/08) once all systems consistently use the module factories.

## Field-by-field verification

The Phase 1 audit (ARCH-LAB-05A2 Phase 1) confirmed exact shape match between:

- `FE_PATCH_10BCreateEnemyKnowledge()` ↔ `FE_ENEMY_INTEL.createEnemyKnowledgeShell()`: 6 fields, all match
- `FE_INTEL01Init(g)` inline ↔ `FE_ENEMY_INTEL.createEnemyIntelSnapshot()`: 20+ fields, all match

Key default preserved: `intelSource: 'scout'` (not `'none'`).

## Verification

- `node --check src/main.js` — pass
- `node --check src/ai/enemy_intel.js` — pass (unchanged)
- `node --check src/config/runtime_flags.js` — pass
- `npm run test:e2e` — 6/6 pass
