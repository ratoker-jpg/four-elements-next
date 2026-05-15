# ARCH-LAB-00C — Roadmap risk clarifications

**Date:** 2026-05-12
**PR:** TBD
**Type:** docs-only (roadmap risk clarifications)

## Problem

PR #68 ARCH-LAB-00 and PR #69 ARCH-LAB-00B were merged. Roadmap is now the source-of-truth, but after review 4 risk clarifications remained. These need to be added in a separate docs-only PR so they don't come up again before ARCH-LAB-01A.

## What changed

Updated `docs/project/ARCH_LAB_00_BIG_ROADMAP_AUDIT.md` with 4 risk clarifications.

## Clarifications added

### 1. LAB-05C pre-design required

LAB-05C is the most dangerous point in the roadmap: attack/retreat/defense Priority Stack migration, 10H1/10D1/10E1, order overwrite, oscillation.

Added rule: before implementing LAB-05C, a separate docs-only design is mandatory:

**ARCH-AI-05C-DESIGN — attack/retreat/defense Priority Stack spec**

This design must describe:
- List of Priority Stack rules
- Priorities
- Trigger conditions
- Edge cases
- Which legacy overwrite paths are replaced
- Which guards are deleted
- Telemetry
- Rollback
- Readiness criteria

Goal: when LAB-05C starts, GLM must implement a pre-approved spec, not invent architecture on the fly.

Updated dependency graph: ARCH-AI-05C-DESIGN is a required step between LAB-05B and LAB-05C. It can be created in parallel with LAB-05A/05B but LAB-05C cannot start without an approved 05C-DESIGN.

### 2. Updated review load numbers

Previous estimate: "7 lab milestones → ~10 review sessions"

After ARCH-LAB-00B, milestones increased:
- LAB-01A, LAB-01, LAB-02, LAB-03, LAB-04, LAB-05A, LAB-05B, LAB-05C, LAB-05D, LAB-06, LAB-07
- That's ~11 merge-back milestones

Updated review load:
- ~11 merge-back reviews + 2–3 strategic/design reviews = ~13–14 sessions total
- This is still ~2x better than 30 small PR reviews, but not 3x

### 3. LAB-05A fallback split

LAB-05A currently: scout + enemy_intel, approximately ~2,000 lines. This could be a heavy first sub-step for Z13.

Added fallback: if audit before LAB-05A shows high coupling, too large diff, or risk of getting stuck, LAB-05A splits into:
- LAB-05A1 — enemy_intel extraction (~482 lines, less coupled)
- LAB-05A2 — scout_lifecycle extraction (~1,934 lines, more state/risk)

Stop conditions for split:
1. Estimated diff too large
2. Scout/intel ownership unclear
3. No playable checkpoint after first extraction attempt
4. GLM cannot produce safe merge-back plan

The fallback does not increase the roadmap proactively, but provides a Plan B.

### 4. FE_TANK_DECIDER_ENABLED default=true criteria

Currently `FE_TANK_DECIDER_ENABLED = false` — safe default. Added explicit criteria for when the default can be switched to true:

1. LAB-05C completed and playable merge-back passed
2. LAB-05D cleanup deleted/isolated conflicting legacy overwrite paths
3. Playwright smoke passes
4. Manual QA enemy tank behavior accepted
5. Telemetry `game._tankDecider01` does not show mass errors/suppress/oscillation
6. Rollback via flag preserved for at least one more milestone
7. User explicitly approves default=true

Until these criteria are met, the flag stays false in sandbox/main.

## Roadmap impact

- Dependency graph updated: ARCH-AI-05C-DESIGN added as required pre-step before LAB-05C
- Review load numbers updated: ~13–14 sessions (was ~10)
- LAB-05A fallback split documented (not activated unless needed)
- FE_TANK_DECIDER_ENABLED criteria added for future flag default change
- Summary table updated with 05C-DESIGN dependency
- Parallelism diagram updated with 05C-DESIGN
- Milestone count updated: 10 → 11 merge-back milestones

## What was NOT touched

- No JS code changed
- No index.html changed
- No src/ files modified
- No gameplay logic changed
- No roadmap meaning changed outside the 4 clarifications
- No flags changed
- No tests created or modified

## Checks

- Markdown headers verified (all 14 sections present)
- No code touched
- node--check not needed (only .md files)

## Risks

- Adding 05C-DESIGN as required dependency could delay LAB-05C if design takes too long
- LAB-05A fallback split may be activated, adding 1 more merge-back milestone
- Review load ~13–14 is higher than originally estimated (~10) but still 2x better than 30

## Next recommended arch

ARCH-LAB-01A — Playwright E2E smoke baseline
