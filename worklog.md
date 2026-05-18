
---
Task ID: 1
Agent: Main
Task: NEXT-DOC-01 — create architecture overview document

Work Log:
- Cloned/updated four-elements-next repo on main branch (includes PR #21 NEXT-TEST-01)
- Created branch glm/next-doc-01-architecture-overview from main
- Read all 17 source files and 4 test files specified in audit
- Read existing docs/ARCHITECTURE_RULES.md for cross-reference
- Created docs/architecture/ directory
- Wrote docs/architecture/NEXT_ARCHITECTURE_OVERVIEW.md (206 lines)
- Document covers: project layers, GameState, GameWorld, tick order, systems ownership, render/UI rules, test hooks, new system checklist, Do/Don't
- Commit: 58fb845 NEXT-DOC-01: add architecture overview
- Ran all 5 CI checks locally — all pass:
  - type-check: PASS
  - build: PASS
  - unit tests: 174 passed (10 files)
  - E2E tests: 64 passed (8 files, 51.3s)
  - GITHUB_PAGES build: PASS
- Verified: docs-only change, no src/tests/config changes
- Could not push to GitHub (no authentication token/SSH key available in environment)

Stage Summary:
- Document created at docs/architecture/NEXT_ARCHITECTURE_OVERVIEW.md (206 lines)
- Commit 58fb845 on branch glm/next-doc-01-architecture-overview
- All CI checks pass locally
- Push/PR requires manual authentication setup
---
Task ID: 1
Agent: main
Task: STORAGE-SPLIT-01 — split generic storage into raw-storage and matter-storage

Work Log:
- Read all 9 source files and 8 test files referencing 'storage' building type
- Mapped all 18+ locations where 'storage' appears as BuildingType
- Changed BuildingType union: 'storage' → 'raw-storage' | 'matter-storage'
- Split building definitions: raw-storage (label: Сырьевой склад, shortCode: RSR) + matter-storage (label: Склад материи, shortCode: MST)
- Updated BUILD_MENU_ORDER: 5 → 6 items
- Split economy constants: STORAGE_RAW_BONUS → RAW_STORAGE_RAW_BONUS, STORAGE_MATTER_BONUS → MATTER_STORAGE_MATTER_BONUS, STORAGE_ELEMENT_BONUS → MATTER_STORAGE_ELEMENT_BONUS
- Changed createEconomyState signature: storageCount → rawStorageCount + matterStorageCount
- Split applyCompletedBuildingToEconomy: raw-storage boosts Raw cap only, matter-storage boosts Matter + Element caps
- Replaced getStorageCount with getRawStorageCount + getMatterStorageCount
- Updated BUILDING_POWER and POWER_PRIORITY for both storage types (both 0 power, priority 30)
- Split BUILDING_ASSET_KEYS, BUILDING_PROFILE_KEYS for both types
- Split renderStorage into renderRawStorage + renderMatterStorage (different fallback colors/labels)
- Updated renderer dispatch for both storage types
- Split SPRITE_PROFILES: building_raw_storage + building_matter_storage
- Split BUILDING_ASSET_MANIFEST: 8 entries (4 factions × 2 types), raw_storage.png + matter_storage.png
- Updated game-state.ts imports and createEconomyState call
- Updated mapgen.ts: initial building is raw-storage (replaces storage)
- Fixed debugSetMatter to also bump matterCap when value exceeds it (test-only)
- Updated all 8 unit test files for split types
- Updated 2 e2e test files: economy caps (matterCap 200, elementCap 10), units-factory robustness (expect.poll)
- Fixed economy.test.ts createEconomyState calls with new 4-param signature

Stage Summary:
- PR #36 opened: https://github.com/ratoker-jpg/four-elements-next/pull/36
- Branch: storage-split-01-raw-matter
- All 5 CI checks pass: type-check ✓, build ✓, test (177 unit) ✓, test:e2e (65 e2e) ✓, GITHUB_PAGES build ✓
- 18 files changed, 228 additions, 101 deletions
- Key behavioral change: game starts with raw-storage only (rawCap=400, matterCap=200, elementCap=10)
