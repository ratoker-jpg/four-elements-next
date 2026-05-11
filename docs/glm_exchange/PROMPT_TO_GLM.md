# PROMPT_TO_GLM

Task: BOT-DEFENSE-RETREAT-01 — fix enemy retreat/defense oscillation near base

Lane: Audit only.
Do not edit files.
Do not write code.
Do not commit.
Do not push.
Do not create PR.

Repository: ratoker-jpg/glm-game-sandbox
Base branch: sandbox/main

Read first:
- AGENTS.md
- docs/project/AI_READ_FIRST.md
- docs/patches/INDEX.md
- docs/project/GLM_PATCH_WORKFLOW_RULES_20260511.md
- latest DOCS_SYNC_* checkpoint if present
- docs/glm_exchange/README.md

Context:
After recent QA, enemy retreat/defense mostly works when enemy is weaker, but a bad oscillation appears when player tanks pressure enemy tanks near the enemy base / corner:

Observed behavior:
- enemy tank attacks;
- then retreat/defense logic overrides it;
- then it attacks again;
- then retreats again;
- sometimes it stops shooting even though retreat no longer helps.

Hypothesis:
10H1 retreat/defense or pressure-near-home logic keeps overwriting active combat engagement. Missing fallback:

If enemy tank is near home / base, player pressure is near base, retreat path is bad/useless, and a player target is in range or almost in range, then the tank should stand and fight instead of dropping attack order.

Goal:
Audit the current retreat/defense decision flow and propose a minimal patch that prevents attack/retreat oscillation near enemy base while keeping existing retreat behavior for normal losing fights.

Scope:
Audit only. No code changes.

Required audit:
1. Identify current retreat / defense / regroup functions involved in enemy light_tank behavior.
2. Identify where active attack orders are overwritten by retreat/defense logic.
3. Identify how "near enemy home/base" is computed, or where it should be computed minimally.
4. Identify whether retreat path quality / no useful retreat can be detected with existing data.
5. Identify how to check if player target is in range / almost in range using existing combat helpers.
6. Propose a minimal guard/fallback:
   - if enemy tank is near home/base;
   - and player pressure is near base;
   - and target is in range or almost in range;
   - and retreat is useless/bad or tank is already at/near home;
   - then maintain or assign fight-back behavior instead of retreat oscillation.
7. List exact files/functions that would be touched.
8. List what must NOT be touched.
9. Risk level.
10. Telemetry/debug plan.
11. Targeted smoke test plan.

Important constraints:
- Do not rewrite retreat system.
- Do not rewrite combat.
- Do not rewrite pathfinding/findPath/passable.
- Do not change combat damage/range/cooldown.
- Do not change enemy production/economy.
- Do not change scout lifecycle.
- Do not change BOT-ATTACK-11/12 attack gate.
- Do not add omniscient hidden targeting.
- Prefer one small guard near the retreat/defense overwrite point, not a new state machine.

Expected behavior after future patch:
- Enemy tanks can still retreat/regroup when weaker in open field.
- Enemy tanks near their own base under direct pressure should not endlessly attack/retreat/attack/retreat.
- If a player tank is nearby/in range and retreat is not useful, enemy tank should fight back.
- Existing scout/intel/attack/progression logic should remain unchanged.

QA mode:
No full-match QA required after this patch. Targeted smoke only; if skipped, mark Manual QA: UNVERIFIED / BATCH QA.

Expected Phase 1 output:
Write audit only to docs/glm_exchange/AUDIT_FROM_GLM.md and end that file with:

Жду «Делай».

Then answer in chat only with:

AUDIT_WRITTEN
File: docs/glm_exchange/AUDIT_FROM_GLM.md
Status: waiting for GPT review / waiting for “Делай”
