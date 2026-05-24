# PHASER-SPIKE-01 — Result Document

Date: 2026-05-24
Status: Research complete. Not migration approval.

## Summary

PHASER-SPIKE-01 was a three-stage isolated research spike evaluating Phaser 3 as a render/VFX layer for the Four Elements Next isometric RTS. The spike lived entirely inside `spikes/phaser-rts-spike/` and touched no production source code.

**Phaser is useful for render/camera/animation/particles/VFX experiments.** This spike proved that Phaser can handle the core rendering tasks for a small isometric RTS scene. It did not prove that Phaser should replace the current production renderer.

**This is not migration approval.** The production game still uses the current stack: TypeScript strict + Vite + Canvas 2D + HTML overlay UI + Vitest + Playwright. No production renderer migration has started.

## What the spike proved

The following capabilities were demonstrated in the isolated spike:

- **Phaser scene bootstrap** — BootScene → GameScene transition; Vite dev server with Phaser 3.90.x; own `tsconfig.json` with strict mode.
- **48×48 isometric map rendering** — Tile-based isometric terrain rendered via `tileToScreen()` conversion; map matches production visual grid.
- **Pan and zoom** — Camera panning via right-click drag; scroll-wheel zoom; smooth camera repositioning via `moveCameraToTile()`.
- **Spritesheet animations** — 8-direction × 3-phase (idle/move/unload) animations from 8×8 256-frame spritesheet; frame-index math matching production `src/render/spritesheet.ts` direction mapping.
- **Dynamic depth sorting** — Per-frame depth key update (`tx + ty + offset`); correct overlap with rock obstacle on harvester path.
- **Render-only inertia** — Visual tilt/shift (1–3 degrees, 1–3 px) on harvester start/stop; no gameplay state change; no idle bobbing; eased spring interpolation.
- **Particles/dust** — Phaser particle emitter with generated texture; speed-based intensity; start burst stronger than sustained; particles render behind harvester via depth offset.
- **Simple active feedback** — Gathering pulse/ring at mineral via tweened graphics; unloading pulse at HQ; HQ subtle pulse; all cosmetic, no gameplay effect.
- **HTML overlay coexistence** — Debug HUD rendered as HTML overlay on top of Phaser canvas; state/direction/depth/speed/dust/inertia values displayed.

## What remains unknown

The spike did not address these questions, which must be resolved before any migration decision:

- **Performance at production scale** — The spike tested one harvester on a 48×48 map. Production runs 2+ factions, dozens of harvesters, buildings, resources, obstacles, territory overlay, and construction sites simultaneously. No performance benchmarking was done.
- **Integration with production subsystems** — The spike hardcoded a harvester loop. Production uses `GameWorld`, `GameState`, `SystemRunner`, mapgen, editor, economy, construction, harvesting, territory, and pathfinding. No integration path was explored.
- **Testing strategy with Phaser runtime** — Production uses Vitest + Playwright with Canvas 2D. Phaser runtime would require a different testing approach. No strategy was evaluated.
- **Asset sharing without copying binaries** — The spike referenced production `public/` assets via Vite `server.fs.allow`. Production integration would need a build-time asset pipeline that avoids duplicating PNGs.
- **Production UI/devtools integration** — The spike used a minimal HTML overlay. Production has a full dev panel, economy HUD, build menu, territory overlay, sprite debug, construction feedback, and game screens. No integration was tested.

## Decision gate

**No migration without PHASER-MIGRATION-AUDIT-01.**

Any future migration discussion must begin with a dedicated migration audit that compares three options:

1. **Keep Canvas 2D, port visual ideas** — Take the inertia, dust, and feedback patterns proven in the spike and implement them on the existing Canvas 2D renderer. Lowest risk; preserves all existing tests and tooling; may have particle/performance limitations.
2. **Replace only render layer with Phaser** — Swap the Canvas 2D render calls for Phaser scenes while keeping `GameWorld`, `GameState`, systems, and UI unchanged. Medium risk; requires asset pipeline and test strategy changes; decouples render from game logic.
3. **Full Phaser runtime migration** — Replace the entire game loop with Phaser's scene/system architecture. Highest risk; largest rewrite; most potential benefit but most unknowns; would require rewriting all systems, screens, and tests.

The migration audit must produce a written comparison with risk assessment, effort estimate, and rollback plan for each option. Only after the audit is reviewed and one option is approved should any migration work begin.

## Recommendation

1. **Return to MAPGEN-RESOURCE-BALANCE-01 first.** The civil gameplay loop needs mapgen balance work before visual polish. Resource distribution, starter pockets, and edge terrain are the immediate priority.
2. **Treat Phaser as validated research.** The spike confirmed that Phaser can do the render/camera/animation/particle/VFX tasks for an isometric RTS. This knowledge is available for future VISUAL-MOTION-FEEDBACK-01 implementation or for a migration discussion when the time is right.
3. **Do not start migration now.** The production renderer works, tests pass, and the game is playable. A renderer migration is a high-risk, high-effort change with no immediate gameplay benefit.

## Spike artifacts

All spike code lives in `spikes/phaser-rts-spike/`:

| File | Purpose |
|---|---|
| `src/main.ts` | Phaser.Game config, BootScene → GameScene |
| `src/scenes/BootScene.ts` | Asset preload, 24 animation definitions |
| `src/scenes/GameScene.ts` | Harvester state machine, movement, depth, debug HUD |
| `src/iso/IsoUtils.ts` | `tileToScreen()`, `screenToTile()`, `getDepthKey()` |
| `src/iso/DirectionUtils.ts` | 8-direction dot-product mapping |
| `src/profiles/PhaserProfiles.ts` | Minimal sprite profiles |
| `src/vfx/Inertia.ts` | Render-only tilt/shift inertia system |
| `src/vfx/DustEmitter.ts` | Speed-based Phaser particle emitter |
| `src/vfx/FeedbackEffects.ts` | Gathering/unloading/HQ pulse tweens |

## PR history

| PR | Stage | Description |
|---|---|---|
| #119 | Stage 1 | Phaser bootstrap, 48×48 isometric map, pan/zoom, static assets |
| #120 | Stage 2 | Harvester movement, spritesheet animation, dynamic depth sorting |
| #121 | Stage 3 | Motion inertia, dust particles, active feedback effects |
