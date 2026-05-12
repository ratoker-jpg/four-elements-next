# ARCH_PROGRESS_CHECKPOINT_2026-05-13

**Date:** 2026-05-13
**After:** ARCH-LAB-05A (PR #82) — enemy_intel contract-only module
**Purpose:** Architecture progress checkpoint so future chats/GLM sessions understand what has been completed, what remains, and how to measure progress.

---

## 1. Current status

Architecture Migration Mode is active (DOCS-ARCH-00). The project is in the middle of a systematic extraction of gameplay logic from `src/main.js` into separate modules. The sandbox/main branch remains playable at every merge-back milestone — this is a hard rule verified by Playwright E2E smoke tests (6/6 passing).

As of this checkpoint, 15 architecture PRs have been merged into sandbox/main, creating module contracts and safe runtime delegations across game state, geometry, commands, movement, combat, and enemy intel. The combat pure-helper phase (04C1–04C4) is verified by Codex QA. The enemy intel contract (05A) is the first step into the AI/intel block.

Main.js is still large (~15,654 lines), but key contracts now exist that define the boundary between extracted systems and legacy code. Each contract establishes the API shape, default values, and validation rules that future extraction work can safely delegate to.

---

## 2. Completed architecture work

| PR | ARCH | What changed | Main.js touched? | Runtime behavior changed? |
|----|------|-------------|-----------------|--------------------------|
| #68 | ARCH-LAB-00 | Big roadmap audit | no | no |
| #69 | ARCH-LAB-00B | Roadmap corrections | no | no |
| #70 | ARCH-LAB-00C | Risk clarifications | no | no |
| #71 | ARCH-LAB-01A | Playwright E2E smoke baseline | no | test infra only |
| #72 | ARCH-LAB-01 | Skeleton contracts + unit_controller archive | no | no |
| #73 | ARCH-LAB-02 | game_state / blankGame extraction | yes, wrapper delegation | should preserve behavior |
| #74 | ARCH-LAB-03 | Geometry helpers extraction | yes, wrapper delegation | should preserve behavior |
| #75 | ARCH-LAB-04A | command_system pure command boundary | no | no |
| #76 | ARCH-LAB-04B1 | movement_system pure movement contract | no | no |
| #77 | ARCH-LAB-04B2 | ATTACK-06 movement decision delegation | yes, 2 ATTACK-06 blocks | preserved |
| #78 | ARCH-LAB-04C1 | combat_system pure contract | no | no |
| #79 | ARCH-LAB-04C2 | combat geometry/state helpers | yes, 3 wrappers | preserved |
| #80 | ARCH-LAB-04C3 | combat classification helpers | yes, 2 wrappers | preserved |
| #81 | ARCH-LAB-04C4 | combat range decision helper | yes, 1 wrapper | preserved |
| #82 | ARCH-LAB-05A | enemy_intel contract-only module | no | no |

Additionally, 6 architecture/docs PRs were merged earlier:
- #63 DOCS-ARCH-00 — Architecture Migration Workflow
- #64 DOCS-ARCH-00B — Workflow clarifications
- #65 ARCH-MAP-01 — Main systems map
- #66 ARCH-AI-DESIGN-01 — Enemy tank decision model
- #67 ARCH-AI-01 — Tank Decider MVP

---

## 3. What has actually been achieved

- **E2E smoke baseline exists** — 6 Playwright specs covering boot, menu, faction select, game start, enemy bot alive, and bot AI behavior scenarios. Every merge-back PR runs these tests.
- **Module ownership skeleton exists** — 6 ownership READMEs define which system owns which zone of main.js. The `src/systems/` and `src/ai/` directories have clear READMEs.
- **Game state factory extracted** — `src/game/game_state.js` exposes `window.FE_GAME_STATE.createBlankGame(sizeKey)`. `blankGame()` in `src/main.js` delegates to `FE_GAME_STATE.createBlankGame(sizeKey)`.
- **Geometry helpers extracted** — `src/core/geometry.js` provides `clamp`, `dist`, `rectsOverlap`, `safeNum`, `formatTime`, `normalizeVec` with delegation in main.js.
- **Command system exists** — `src/systems/command_system.js` provides COMMAND_TYPES, command factories, and predicates. Contract-only, not yet wired for delegation.
- **Movement system exists** — `src/systems/movement_system.js` provides MOVEMENT_STATES, RESULTS, REASONS, RECOVERY_REQUESTS, factories, predicates. ATTACK-06 decision delegation is wired through two main.js wrapper functions.
- **Combat system exists and is wired through safe wrappers** — `src/systems/combat_system.js` provides combat contracts plus six pure helpers/predicates: `targetCenter`, `distanceToBuilding`, `isDeadBuilding`, `classifyHostileTarget`, `isAttackableEnemyBuilding`, `isTargetInRange`. Six wrapper functions in main.js delegate to these helpers with legacy fallbacks.
- **Enemy intel contract exists** — `src/ai/enemy_intel.js` provides SCOUT_LIFECYCLE_STATES, INTEL_SOURCES, SCOUT_RETURN_REASONS, createEnemyKnowledgeShell, createEnemyIntelSnapshot, isValidEnemyKnowledge, isValidEnemyIntelSnapshot. Contract-only, not yet wired for delegation.
- **04C pure combat-helper phase is verified by Codex QA** — all four 04C PRs passed syntax checks, E2E tests, and Codex review.
- **Main.js is still large**, but key contracts now exist that define the boundary for each system. The responsibility reduction is real even if the line count has not shrunk significantly yet.

---

## 4. Why the ARCH count did not shrink as expected

The initial roadmap estimate used large blocks (7 steps: LAB-00 through LAB-06+). The actual implementation process splits large risky blocks into smaller, safer PRs. This is a feature, not a bug — each sub-PR is independently testable, reversible, and verifiable.

Examples of splitting:
- **ARCH-LAB-04C** was originally one block. It became four PRs: 04C1 (combat contract), 04C2 (target geometry), 04C3 (target classification), 04C4 (range decision). Each PR was small enough to review in one pass and safe enough that a bug in one wouldn't cascade.
- **ARCH-LAB-05A** is the first step of what was originally one "05 AI/intel/bot" block. It may become 05A2 (factory delegation), 05B (targeting boundary), 05C-DESIGN (attack/retreat/defense Priority Stack spec), 05C (tank decision migration), 05D (enemy brain cleanup).

Therefore, progress should be tracked by **completed architecture blocks**, not only by the remaining PR count. A block like "04 command/movement/combat boundary" being "mostly done" with 7 sub-PRs is more meaningful than "12 micro-ARCH left."

The original estimate of "10–12 ARCH left" was based on large-block counting. When those large blocks are split for safety, the count of remaining micro-PRs naturally increases, but the actual remaining work has not increased — it is simply more granular and more visible.

---

## 5. Progress by large blocks

| Block | Status | Notes |
|-------|--------|-------|
| 00 Roadmap/docs | ✅ Done | #68–#70 + #63–#66 docs/design PRs |
| 01 Baseline/skeleton | ✅ Done | #71 E2E baseline, #72 skeleton + archive |
| 02 Game state | ✅ Done | #73 game_state / blankGame extraction |
| 03 Geometry | ✅ Done | #74 geometry helpers extraction |
| 04 Command/movement/combat boundary | ⚡ Mostly done | #75–#81; combat mutation/death not yet extracted; command/movement not yet wired for full delegation |
| 05 AI/intel/bot | 🔵 Started | #82 enemy_intel contract; runtime wiring pending |
| 06 Economy/production/construction | ⬜ Not started | Old gameplay patches exist (BOT-*, POWER-*), not modularized |
| 07 Render/input/UI cleanup | ⬜ Not started | Z22 input/selection + Z20 render still in main.js |
| 08 Final cleanup/QA | ⬜ Not started | FE_PATCH cleanup, dead flags, script tag cleanup, final QA |

---

## 6. Remaining work — honest estimate

### Large blocks remaining (4)

1. **05 AI/intel/bot** — enemy_intel contract exists but needs factory delegation, targeting boundary, attack/retreat Priority Stack, tank decision migration, enemy brain cleanup
2. **06 Economy/production/construction** — no architecture extraction started; Z17 builder/construction (2,660 lines) and Z11 economy/power (545 lines) still in main.js
3. **07 Render/input/UI cleanup** — no architecture extraction started; Z22 input/selection (1,629 lines) and Z20 render (1,266 lines) still in main.js
4. **08 Final cleanup/QA** — FE_PATCH reference cleanup, dead flag removal, script tag cleanup, manual playtest, Codex QA checkpoint

### Micro-ARCH estimate (12–18 PRs)

| ID | Description | Main.js touched? | Risk |
|----|-------------|-----------------|------|
| 05A2 | enemy_intel factory delegation (FE_INTEL01Init, FE_PATCH_10BCreateEnemyKnowledge) | yes, 2 wrappers | Medium |
| 05B | enemy targeting boundary (attack intelligence, attack-12 intel gate) | yes, wrappers | High |
| 05C-DESIGN | attack/retreat/defense Priority Stack spec | no, docs only | Low |
| 05C | tank decision migration (FE_TANK_DECIDER_ENABLED → true path) | yes | High |
| 05D | enemy brain cleanup (state machine extraction) | yes, major | High |
| 06A | economy/production/construction boundary contract | no | Low |
| 06B | power/economy runtime delegation if safe | yes, wrappers | Medium |
| 06C | construction/builder boundary if safe | yes, wrappers | High |
| 07A | render/UI/input split audit | no, audit only | Low |
| 07B | render/input module extraction | yes, wrappers | High |
| 07C | FE_PATCH/dead flags/script cleanup | yes, cleanup | Medium |
| 08A | full Codex/local QA checkpoint | no | Low |
| 08B | manual playtest fixes | depends on findings | Medium |

**Estimated remaining:**
- 4 large blocks
- 12–18 micro-ARCH PRs, depending on coupling and QA findings

This estimate is intentionally a range, not a fixed number. Actual PR count depends on how many sub-splits are needed when we encounter coupling issues during extraction.

---

## 7. Next recommended step

**ARCH-LAB-05A2 — Phase 1 Audit Only**

Goal: Audit whether `FE_INTEL01Init` and `FE_PATCH_10BCreateEnemyKnowledge` can delegate to `FE_ENEMY_INTEL` factories safely.

This is an audit, not implementation. The audit should answer:
1. Does `createEnemyIntelSnapshot()` produce an object structurally identical to `FE_INTEL01Init(game).enemyIntel`?
2. Does `createEnemyKnowledgeShell()` produce an object structurally identical to `FE_PATCH_10BCreateEnemyKnowledge()`?
3. Are there any hidden side effects in `FE_INTEL01Init` beyond object creation (e.g., writing to `game.enemyIntel`)?
4. Can the delegation be done with a simple guard pattern (like combat_system wrappers)?
5. What are the risks?

**Hard limits for 05A2:**
- No scout lifecycle behavior changes
- No pathfinding changes
- No attack policy changes
- No production/cap changes
- No FE_ATTACK11/12 behavior changes
- No tank_decider behavior changes

---

## 8. Review rule going forward

**Do not use "number of ARCH left" as the main progress metric.**

This number is misleading because:
- Large blocks split into multiple safe micro-PRs, inflating the count
- A "completed block" with 4 sub-PRs is more meaningful than 4 individual PRs
- The count does not reflect the complexity or risk of remaining work

Instead, use these metrics:

| Metric | Why it matters |
|--------|---------------|
| Completed large blocks | Shows real structural progress (4 blocks done, 1 mostly done, 1 started, 3 not started) |
| Completed contracts | Shows API boundary definition progress |
| Number of safe runtime delegations | Shows actual wiring progress (6 wrappers in main.js) |
| Main.js responsibility reduction | Shows how many zones have an owner system |
| Playable QA status | Shows whether the game still works (6/6 E2E) |

Progress is not about counting PRs — it is about reducing the responsibility and coupling of main.js while keeping the game playable.
