# src/systems/ — Gameplay Systems

**Owner:** ARCH-LAB (architecture migration)
**Status:** Skeleton — no modules extracted yet
**Roadmap step:** ARCH-LAB-03, ARCH-LAB-04

## Purpose

Core gameplay systems extracted from main.js. Each module encapsulates
a self-contained game subsystem with a clear API surface.

## Planned modules

### ARCH-LAB-03 extraction targets

| Module | Source zone | Lines (est.) | Description |
|--------|-----------|-------------|-------------|
| `pathfinding.js` | Z12 | ~700 | A* pathfinding, grid traversal, obstacle avoidance |
| `territory_system.js` | Z18 | ~400 | Territory spread, building radius, fog of war |
| `shared_helpers.js` | mixed | ~300 | Coordinate transforms, math utilities, shared predicates |

### ARCH-LAB-04 extraction targets

| Module | Source zone | Lines (est.) | Description |
|--------|-----------|-------------|-------------|
| `movement_system.js` | Z14 | ~570 | Unit movement, path following, arrival detection |
| `combat_system.js` | Z7 combat | ~500 | Attack, damage, death, target selection |
| `command_system.js` | Z22 partial | ~400 | Move/attack/stop orders, attack-approach state machine |
| `economy_system.js` | Z11 | ~550 | Resource gathering, production, power grid |
| `construction_system.js` | Z17 partial | ~800 | Building placement, builder AI, construction progress |
| `production_system.js` | Z17 partial | ~400 | Unit production queues, factory logic |

## Dependencies

- `src/core/*` — constants, storage, asset loading
- `src/config/*` — building/unit/faction definitions
- `src/game/*` — game state (ARCH-LAB-02)
- `src/ai/*` — AI deciders (for combat/production integration)

## Contract

All modules in this directory must:
- Register on `window.FE_MODULE_NAME` pattern
- Accept game state + dependencies via `window.FE_CORE` bridge
- Expose a clear public API (no direct state mutation from outside)
- Never call back into main.js functions directly — use FE_CORE bridge
- Be testable in isolation with a mock game object

## Current contents

None — directory is a skeleton placeholder awaiting ARCH-LAB-03 extraction.
