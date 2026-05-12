# src/ai/ — AI & Decision Systems

**Owner:** ARCH-LAB (architecture migration)
**Status:** Partial — tank_decider.js extracted (ARCH-AI-01)
**Roadmap step:** ARCH-LAB-02, ARCH-LAB-05

## Purpose

All AI decision-making, enemy bot logic, and autonomous agent behavior.
This directory will contain the complete enemy AI brain extracted from
main.js Z13 (5 255 lines, 34% of main.js — the single largest zone).

## Existing modules

| Module | Lines | PR | Description |
|--------|-------|-----|-------------|
| `tank_decider.js` | 276 | #67 | Priority Stack decision layer for enemy light_tank (ARCH-AI-01 MVP) |

## Planned modules

### ARCH-LAB-02 (bootstrap extraction)

| Module | Source zone | Lines (est.) | Description |
|--------|-----------|-------------|-------------|
| `enemy_brain.js` | Z13 core | ~800 | Enemy bot state machine, phase transitions, tick loop |

### ARCH-LAB-05 (full AI extraction)

| Module | Source zone | Lines (est.) | Description |
|--------|-----------|-------------|-------------|
| `enemy_economy.js` | Z13 partial | ~600 | Enemy resource management, building priorities |
| `enemy_production.js` | Z13 partial | ~400 | Enemy unit production, factory management |
| `enemy_scout.js` | Z13 partial | ~500 | Scout dispatch, observation, cooldown, intel collection |
| `enemy_attack.js` | Z13 partial | ~600 | Attack wave composition, dispatch, group movement |
| `enemy_intel.js` | Z13 partial | ~300 | Intel persistence, player strength estimation |
| `targeting.js` | Z7 partial | ~300 | Target selection, threat assessment, attack priority |

## Dependencies

- `src/config/runtime_flags.js` — FE_TANK_DECIDER_ENABLED, AI tuning flags
- `src/game/*` — game state for world queries
- `src/systems/movement_system.js` — move orders (ARCH-LAB-04)
- `src/systems/combat_system.js` — attack execution (ARCH-LAB-04)
- `src/systems/economy_system.js` — resource queries (ARCH-LAB-04)

## Contract

All modules in this directory must:
- Register on `window.FE_MODULE_NAME` pattern
- Accept game state + API via `window.FE_CORE` bridge
- Never directly mutate player units — go through command_system
- Guard all new behavior behind `FE_*_ENABLED` runtime flags
- Preserve 1:1 legacy behavior when flag is false

## Feature flag convention

Each AI module extracted from main.js must have a corresponding
runtime flag (e.g., `FE_TANK_DECIDER_ENABLED`) that defaults to `false`
until the module is verified to produce identical gameplay behavior.
When a module passes all acceptance criteria, its flag is flipped to
`true` in a separate, low-risk PR.

## Current contents

- `tank_decider.js` — extracted and active (ARCH-AI-01)
