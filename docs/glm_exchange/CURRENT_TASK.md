# CURRENT_TASK

Task: BOT-DEFENSE-RETREAT-01 — fix enemy retreat/defense oscillation near base

Lane: Audit only first, then Review lane implementation if approved.

Status: Phase 1 prompt prepared.

Goal:
Enemy tanks should stop oscillating between attack and retreat when cornered or pressured near enemy base. If retreat is useless and a player target is nearby/in range, enemy tanks should fight back instead of repeatedly dropping combat orders.

Current sprint context:
- PATCH-COMBAT-TARGETS-01 merged. Manual QA: UNVERIFIED / BATCH QA.
- BOT-COMBAT-AWARENESS-01 merged. Manual QA: UNVERIFIED / BATCH QA.
- Full-match QA is deferred to batch QA.
