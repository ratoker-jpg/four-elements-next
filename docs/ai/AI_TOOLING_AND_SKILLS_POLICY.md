# AI Tooling and Skills Policy

Status: working policy.

This document records how Four Elements Next may use AI-assisted tools, external skills, and asset-generation services without weakening architecture, asset quality, licensing discipline, or PR hygiene.

## 1. Core principle

Four Elements Next is not an AI-runtime game.

The current strategy is AI-assisted production:

- AI may help with code, tests, audits, docs, asset candidates, VFX candidates, audio placeholders, and QA summaries.
- AI output is not automatically accepted.
- Code must pass scope review and tests.
- Assets must pass candidate gates, normalization, preview, and manual approval.
- External services are optional helpers, not the project foundation.

## 2. Approved AI usage lanes

| Lane | Allowed use | Gate |
|---|---|---|
| Code | scoped patch proposals, tests, refactors, diff review | architecture rules + tests |
| Architecture | Phase 1 audit, risk analysis, stage planning | user approval before implementation |
| QA | Playwright/Vitest failure triage, artifact summaries | verify against real logs/reports |
| Assets | candidate images, props, UI icons, VFX candidates | asset candidate gate |
| Audio | placeholder SFX/ambience only | license review before production |
| Localization | draft translation/subtitles/transcription QA | human review before production |
| Runtime AI | debug/helper overlays only for now | not core gameplay |

Do not use AI/LLM in combat, economy, pathfinding, or core gameplay tick logic at this project stage.

## 3. Recommended minimal stack

These are allowed/recommended tools, not mandatory project dependencies.

### Dev core

- Aider — local git-first helper for small scoped patches and tests.
- Cline or similar IDE agent — read-only audit, decomposition, rules, checkpoints.
- GLM — primary executor for large approved code tasks.
- Codex — rare helper for read-only QA, local reproduction, asset-only operations, or small approved fixes.
- Playwright / Vitest / TypeScript checks — mandatory verification layer.

### Asset core

- Blender — controlled source for production-grade 2.5D renders.
- ComfyUI workflows — candidate generation and controlled visual experiments.
- Qwen-Image or similar image models — candidate generation pilot only.
- rembg / Pillow — cleanup, bbox, padding, fixed canvas, anchor checks.
- rectpack / PyTexturePacker — future atlas packing candidates.
- `index.json` / manifests — asset contract and accounting.

### Map core

- Tiled JSON export — candidate map authoring/exchange format.
- Custom map generator/validator — runtime-specific generation and path validation.

### Audio / localization core

- Whisper — transcription/subtitle QA.
- Placeholder audio tools — internal prototyping only unless license is reviewed.

## 4. Tools not approved as core

| Tool / approach | Status | Why |
|---|---|---|
| LLM NPC in gameplay loop | not now | performance, debugging, architecture risk |
| WebLLM/ONNX in combat/pathfinding/economy | not now | wrong priority for current stability |
| AI-generated production assets directly in `public/assets` | forbidden | bypasses QA/anchor/license gates |
| Random community workflows without audit | risky | unknown nodes, licenses, reproducibility |
| Non-commercial / research-only models for shipping assets | restricted | license risk |
| Codex as default task executor | forbidden | wastes limits and weakens process discipline |

## 5. Code-agent rules

Any code-agent task must state:

- target repo: `ratoker-jpg/four-elements-next`;
- target branch: `main` or an explicit feature branch;
- current architecture: TypeScript/Vite, not old sandbox;
- owner system / touched files;
- what not to touch;
- tests to run;
- whether this is audit-only or implementation.

Minimum architecture prompt block:

```text
Do not change `src/main.ts` except wiring/composition.
Do not add gameplay, economy, combat, render, or mapgen logic to `main.ts`.
Do not put gameplay logic in render/UI files.
Systems must not import render/screens.
Render must not mutate gameplay state.
If the task requires breaking these rules, stop and return an architecture risk report.
```

## 6. Asset-agent rules

AI/external asset output is candidate-stage by default.

Candidate output must record, where available:

- source tool/service;
- prompt;
- source image/reference;
- model/workflow;
- seed/settings;
- generated date;
- license note;
- candidate/rejected/approved status;
- target game use.

Production is allowed only after:

```text
candidate
→ cleanup
→ normalize
→ validate bbox/padding/anchor/frame count/naming
→ index.json or manifest when applicable
→ QA report/contact sheet when applicable
→ asset preview or in-game preview
→ manual approval
→ scoped asset PR
```

## 7. SpriteCook / external Agent Skills policy

SpriteCook skills, SpriteCook MCP, Codex plugin, and similar agent-skill systems may be used only as optional candidate generators or as examples for our own local skills.

Allowed SpriteCook-like use:

- UI icon candidates;
- props and decor candidates;
- VFX placeholders;
- style experiments;
- reference/edit iterations.

Restricted use:

- production tanks;
- production buildings;
- 16/32 direction sheets;
- body/turret/muzzle production pipeline;
- direct commit to production assets;
- default Codex-driven asset generation.

Minimum policy:

```text
1. Output is always candidate-stage.
2. Do not write output directly into production assets.
3. Record asset_id / reference_asset_id / edit_asset_id where relevant.
4. Record source, prompt, settings, status, and license_note.
5. Run cleanup, normalization, anchor validation, index/manifest, preview, and manual approval.
```

## 8. Four Elements local skills — recommended structure

Future local skills should be stored as project docs/rules, not hidden chat memory.

Recommended structure:

```text
docs/ai/skills/
  four-elements-asset-normalization/
    SKILL.md
    templates/asset_manifest.schema.json
    references/anchor_rules.md
  four-elements-isometric-sprite-export/
    SKILL.md
    references/direction_map.md
    templates/index_json_unit.schema.json
  four-elements-ai-patch-review/
    SKILL.md
    references/architecture_guardrails.md
  four-elements-map-authoring/
    SKILL.md
    references/tiled_json_rules.md
```

Recommended responsibilities:

- `four-elements-asset-normalization` — cleanup, bbox, padding, anchor, fixed canvas, manifest.
- `four-elements-isometric-sprite-export` — 8/16/32 directions, body/turret split, mount/muzzle points, alpha PNG, naming.
- `four-elements-ai-patch-review` — diff scope, architecture rules, tests, package/dist artifacts, legacy leaks.
- `four-elements-map-authoring` — Tiled JSON, resource zones, obstacle clusters, path validation.

Do not implement all of these at once. Create them through separate docs/tooling PRs when needed.

## 9. Recommended future folders and files

These are recommended future additions, not current runtime requirements:

```text
docs/ai/ARCHITECTURE_GUARDRAILS.md
docs/ai/PROMPTS/architecture_patch.md
docs/ai/PROMPTS/pr_review.md
.aider.conf.yml
.cline/rules/four-elements-architecture.md
tools/qa/summarize_playwright_artifacts.py
tools/assets/normalize_sprite.py
tools/assets/build_atlas.py
tools/assets/validate_asset_manifest.py
tools/map/generate_rts_map.py
assets/_raw/ai_candidates/
assets/_normalized/
assets/_atlases/
assets/_metadata/
audio/_raw_ai_placeholders/
audio/_placeholders/
```

Create these only through scoped PRs. Do not add empty folders or unneeded tooling just because this policy mentions them.

## 10. Visual asset architecture direction

Future combat visuals should use a layered 2.5D model, not monolithic PNG units.

For tanks:

- body/hull is separate from turret/weapon;
- body angle follows movement;
- turret angle follows target/attack logic;
- muzzle flash, projectile, impact, dust, shadow, HP bar, and selection are separate layers;
- body/turret assets must share camera, scale, anchor, and metadata.

Suggested direction counts:

- body/hull MVP: 8 directions;
- body/hull target: 16 directions;
- turret MVP: 16 directions;
- turret target: 32 directions.

This is a future combat visual milestone, not part of current civil/base-loop docs sync.

## 11. Map tooling direction

Map generation should remain logical and validated:

- base terrain;
- noise/variation;
- resource rules by distance from start/center;
- obstacle clusters;
- decor layers;
- start-zone cleanup;
- path validation to first resources and center.

Tiled JSON may be used as a future authoring/exchange format, but runtime mapgen should stay project-controlled.

## 12. Current implementation guidance

Do now:

- Keep docs current.
- Keep AI/Codex/GLM usage scoped.
- Treat generated assets as candidates.
- Protect accepted building assets.
- Add tooling only when tied to a concrete next task.

Do not do now:

- Start light tank body/turret system without Phase 1 audit.
- Add full asset factory scripts without a scoped tooling PR.
- Add empty tool folders without implementation.
- Move to Unity.
- Add LLM runtime gameplay.
