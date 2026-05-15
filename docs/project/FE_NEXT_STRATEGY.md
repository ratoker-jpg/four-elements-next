# FE Next Strategy

## Status

Decision checkpoint after PR #98.

Current source of truth stays:

```text
ratoker-jpg/glm-game-sandbox
branch: sandbox/main
```

PR #98 is merged and reduced `src/main.js` by 45 lines through economy/construction wrapper delegation.

## Strategic decision

We will not keep refactoring `src/main.js` indefinitely as the primary path.

The preferred direction is to build **Four Elements Next** as a clean parallel version using the current project as a resource base:

- current `sandbox/main` remains playable reference and fallback;
- `fe-next/` is built next to it, not over it;
- old code is not deleted until FE Next proves useful;
- emergency fixes to current sandbox/main are still allowed;
- current staged migration may continue only for very small safe maintenance tasks.

## Reason

Current migration is safe, but too slow for the target architecture.

Important correction: current behavior is not the target behavior.

The current enemy bot is provisional and expected to be redesigned.
The current economy is provisional and may be redesigned.
Some buildings are placeholders and do not yet have final gameplay roles.
Legacy `FE_PATCH_*` chains and `FE_10H1` AI are not target behavior.

Therefore the comparison target is **target design parity**, not exact current gameplay parity.

## Target design parity

FE Next should aim for a clean playable RTS loop:

- map generation;
- camera pan/zoom;
- assets and sprite rendering;
- units;
- selection and commands;
- movement and pathfinding;
- resources;
- economy;
- construction;
- production;
- meaningful building set;
- basic combat;
- simple intentional enemy loop;
- win/lose condition;
- tests;
- maintainable architecture.

It does **not** need to preserve temporary old bot behavior, temporary economy behavior, or patch-chain behavior.

## Reuse policy

Reuse directly where safe:

- `assets/`;
- `src/config/*.js` after pruning if needed;
- clean pure modules:
  - `src/core/geometry.js`;
  - `src/core/standalone_constants.js`;
  - `src/game/game_state.js`;
  - `src/economy/economy_system.js`;
  - `src/production/production_system.js`;
  - `src/construction/construction_system.js`;
  - `src/systems/command_system.js`;
  - `src/systems/movement_system.js`;
  - `src/systems/combat_system.js`;
  - `src/ai/tank_decider.js`;
  - `src/ai/enemy_intel.js`;
  - `src/ai/enemy_targeting.js`.

Reuse only after audit/adaptation:

- `src/core/asset_loader.js`;
- `src/core/save_manager.js`;
- `src/ui/screen_manager.js`;
- render/debug/dev helpers.

Do not copy:

- `src/main.js` as a source file;
- `FE_PATCH_*` chains;
- `FE_10H1` legacy AI;
- broken backup files;
- old debug-only code unless explicitly needed.

## Architecture direction

FE Next should use a system-of-systems layout.

Expected high-level structure:

```text
fe-next/
  index.html
  src/
    main.js              # thin bootstrap / composition root
    core/
    config/
    game/
    systems/
    ai/
    render/
    input/
    ui/
    map/
  tests/
```

`fe-next/src/main.js` should stay thin and contain only:

- canvas/bootstrap;
- game state initialization;
- asset loading call;
- game loop;
- ordered system updates;
- render call;
- debug exposure for tests.

Target: keep `fe-next/src/main.js` under 500 lines for the first MVP stage.
If it grows past 1000 lines, the rewrite is failing its architecture goal.

## First implementation principle

Do not start with a full rewrite PR.

Start with small staged FE Next tasks:

1. `FEN-00` — strategy / roadmap checkpoint.
2. `FEN-01` — scaffold, map render, camera, HQ, HUD, one unit, selection, right-click movement, smoke test.
3. `FEN-02` — assets/render quality and basic pathfinding.
4. `FEN-03` — economy and construction.
5. `FEN-04` — production and combat.
6. `FEN-05` — simple enemy loop and win/lose.
7. `FEN-06` — stop/go checkpoint.

Each FEN PR must be reviewable and must not modify the root playable game unless explicitly approved.

## Safety rules

- Do not abandon `sandbox/main` until FE Next passes a stop/go checkpoint.
- Do not delete the current game.
- Do not merge `fe-next/` into the root game without explicit decision.
- Do not copy the legacy monolith into FE Next.
- Do not recreate a new monolith inside `fe-next`.
- Do not implement full feature parity before proving the architecture.
- Do not optimize for exact current parity if current behavior is provisional.

## Stop/go criteria

FE Next is promising if:

- it boots independently under `fe-next/index.html`;
- `main.js` stays thin;
- map/camera/unit loop works;
- selected unit can receive movement command;
- first systems are isolated in modules;
- tests can validate the loop;
- no large legacy chains are copied.

FE Next should be stopped or redesigned if:

- it requires copying large chunks of `src/main.js`;
- the new `main.js` becomes another 1000+ line controller early;
- systems need circular/global coupling;
- it cannot run on GitHub Pages/static server;
- it cannot produce a useful playable loop within the planned FEN steps.

## Current next action

Run or review `ARCH-COST-COMPARISON`.

If it confirms that FE Next reaches target design parity in fewer and cleaner arches than staged migration, create the first implementation prompt for:

```text
FEN-01 — FE Next scaffold + map/camera/HQ/HUD/unit movement smoke
```

For large isolated FE Next implementation, Codex may be more suitable than GLM.
For audit/scope/decision work, GLM remains useful.
GPT remains the gatekeeper for scope, risk, and merge decisions.
