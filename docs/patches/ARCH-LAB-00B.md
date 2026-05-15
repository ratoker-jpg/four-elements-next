# ARCH-LAB-00B — Roadmap corrections after merge

**Date:** 2026-05-12
**PR:** TBD
**Type:** docs-only (roadmap corrections)

## Problem

PR #68 ARCH-LAB-00 was merged as roadmap source-of-truth. After review, several important concerns emerged that require follow-up corrections.

## What changed

Updated `docs/project/ARCH_LAB_00_BIG_ROADMAP_AUDIT.md` with 6 corrections.

## Corrections added

1. **Split LAB-05** — Original LAB-05 was too large (~6,000 lines, Very High risk). Split into 4 sub-steps: ARCH-LAB-05A (scout+intel), 05B (targeting), 05C (tank decider Priority Stack migration), 05D (brain+economy+guard cleanup). Each has its own risk, dependencies, merge-back criteria, and smoke checks.

2. **Playwright E2E smoke baseline** — Added ARCH-LAB-01A step before LAB-01. Minimum smoke: boot → main menu → new game → faction select → game starts → enemy bot starts. Leverages existing Playwright infrastructure (5 specs, 590 lines). Every merge-back must PASS this smoke. Without it, merge-back = high-risk.

3. **unit_controller.js decision** — Recommended variant C (archive/deprecate) before LAB-04. 878 lines, disabled by default, duplicates movement. Cannot be used as basis for movement_system (conflicts with main.js model). Will be archived to `src/core/_archived/`. FE_UNIT_CONTROLLER_ENABLED=false documented as permanent.

4. **Line count tracking table** — Added historical data: 11,358 (refactor sprint) → 15,379 (ARCH-MAP-01, +4,021 from merged gameplay/bot/economy patches) → 15,611 (ARCH-AI-01, +232 wiring).

5. **Wiring/bridge budget** — Explained why main.js target is 5,000–8,000 lines (not 1,600). Permanent wiring budget: 2,000–3,000 lines. Temporary bridges: 1,000–2,000 lines (removed in LAB-07). Progress metric: not only line count but responsibility count.

6. **Updated roadmap order** — Added LAB-01A as first step. Updated dependency graph, summary table, and next recommended arch to LAB-01A.

## Updated roadmap

| Step | Goal | Expected reduction |
|------|------|-------------------:|
| LAB-01A | E2E smoke baseline | +80 lines test |
| LAB-01 | Skeleton + unit_controller archive | ~400 lines |
| LAB-02 | Bootstrap + game loop | ~350 lines |
| LAB-03 | Pathfinding + territory | ~700 lines |
| LAB-04 | Command + movement + combat | ~3,000 lines |
| LAB-05A | Scout + enemy_intel | ~2,000 lines |
| LAB-05B | Enemy_targeting | ~1,000 lines |
| LAB-05C | Tank decider Priority Stack migration | ~1,500 lines |
| LAB-05D | Enemy_brain + economy + guard cleanup | ~1,500 lines |
| LAB-06 | Render + UI + player economy | ~3,500 lines |
| LAB-07 | Cleanup + merge-back readiness | Cleanup only |

## Next recommended arch

ARCH-LAB-01A — Playwright E2E smoke baseline (before any code extraction)

## What was NOT touched

- No JS code changed
- No index.html changed
- No src/ files modified
- docs-only task

## Checks

- Markdown headers verified (all 14 sections present)
- No code touched
- node--check not needed (only .md files)

## Risks

- LAB-05 split increases number of merge-back milestones (7→11) but reduces per-step risk
- E2E smoke test requires running http server (already configured in playwright.config.js)
- unit_controller archive requires LAB-01 code work (not in this docs-only PR)
