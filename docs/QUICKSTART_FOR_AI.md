# AI Quickstart — Four Elements Next

Read this first. Then `agent-ctx/state.md`, then deeper docs as needed.

## Project goal

Four Elements Next is a browser isometric RTS built with TypeScript strict + Vite + Canvas 2D + HTML overlay UI + Vitest + Playwright. The current target is a stable civil sandbox: map generation, resource gathering, economy loop, construction, pathfinding, and dev tools — all working before any combat or enemy AI is started.

## Current state

Civil baseline is functional:
- economy pacing tuned for first 5-8 minutes (PR #114)
- BFS/flood-fill map reachability validation (PR #115)
- pathfinding telemetry and passability grid cache (PR #116)
- environment asset calibration complete (PR #111-#113)
- map editor, seed flow, mapgen presets, custom maps all merged
- dev panel with spawn tools, scenario buttons, overlays

## Merged recent PRs

| PR | ID | Description |
|---|---|---|
| #111 | ENV-NO-VOLCANO-01 | Removed volcanoes from active generation and editor |
| #112 | ENV-ASSET-TUNER-01 | Dev-only environment asset calibration panel |
| #113 | ENV-ASSET-PROFILE-APPLY-01 | Applied approved environment asset calibration values |
| #114 | ECONOMY-PACE-01 | First 5-8 minutes economy pacing baseline |
| #115 | VALIDATION-BFS-01 | BFS/flood-fill map reachability validation |
| #116 | PATH-TELEMETRY-CACHE-01 | Pathfinding telemetry and passability grid cache |
| #119 | PHASER-SPIKE-01 S1 | Phaser bootstrap, 48×48 isometric map, pan/zoom, static assets |
| #120 | PHASER-SPIKE-01 S2 | Harvester movement, spritesheet animation, dynamic depth sorting |
| #121 | PHASER-SPIKE-01 S3 | Render-only inertia, dust particles, active feedback |

## Current next focus

**PHASER-MIGRATION-AUDIT-01** — immediate next decision step. Must compare options A/B/C before gameplay work continues:
- **A** — keep Canvas 2D, port visual ideas from spike
- **B** — replace only render/camera/animation/VFX layer with Phaser
- **C** — full Phaser runtime migration

MAPGEN-RESOURCE-BALANCE-01 remains the next gameplay block, paused until the audit decides.

## Planned architecture sequence

1. **PHASER-MIGRATION-AUDIT-01** (immediate next) — decide renderer direction: A/B/C
2. **MAPGEN-RESOURCE-BALANCE-01** (paused until audit decides) — symmetric starter templates, center cluster cleanup, edge tuning
3. **SAVE-LOAD-MVP-01** — serialization contract, localStorage MVP, UI/dev integration
4. **VISUAL-MOTION-FEEDBACK-01** — render-only inertia, speed/mass dust, active building feedback
5. **UI-SHELL-ARCH-01** — Esc menu, save slots, HUD readability
6. **GAMEWORLD-SPLIT-01** — TestBridge, DevController, InputHandler extraction
7. **COMBAT-READINESS-01** — blocked until blocks 2–4 are merged and playtested

## Do-not-touch list

- Do not start combat yet
- Do not rewrite pathfinding / implement A*
- Do not re-enable procedural sand
- Do not delete assets without approval
- Do not change save/load schema casually
- Do not change `src/core/constants.ts` without explicit approval
- Do not change accepted building assets without scoped approval
- Do not add enemy AI, faction bonuses, or military systems
- Do not migrate production renderer without PHASER-MIGRATION-AUDIT-01

## Required workflow

1. **Large block = FULL AUDIT first.** No implementation until audit is approved.
2. **Then up to 3 STAGE PRs.** Each PR targets latest `main`. No new audit between stages unless main changed unexpectedly or a re-audit trigger fires.
3. **Small fix = FAST FIX.** No audit needed. Targeted tests only.
4. **Always open PR.** Never push directly to `main`.

Workflow modes and E2E policy: `agent-ctx/workflow.md`.
Broader process: `docs/AI_WORKFLOW_CONTRACT.md`.

## Validation commands

```bash
npm run type-check
npm run build
npm run test
npm run test:e2e        # only when required by PR tier
```

Docs-only PRs require no build or tests.

## Key references

- `docs/project/ROADMAP_CURRENT.md` — living roadmap and priorities
- `agent-ctx/state.md` — project state quick reference
- `docs/ARCHITECTURE_RULES.md` — architecture guardrails
- `docs/ASSET_POLICY.md` — asset reuse rules
- `docs/project/PHASER_SPIKE_RESULT_20260524.md` — Phaser spike result and migration decision gate
