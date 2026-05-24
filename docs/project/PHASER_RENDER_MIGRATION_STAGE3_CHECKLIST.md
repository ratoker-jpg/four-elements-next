# PHASER-RENDER-MIGRATION-01 Stage 3 — Acceptance Checklist

**Strategy:** B — Phaser render layer only. Not full Phaser migration.
**Canvas remains default.** Phaser is opt-in via `FE_PHASER_RENDERER_ENABLED` / `renderer=phaser`.

---

## Automated E2E Coverage (Stage 3)

| Test | What it verifies |
|---|---|
| Render count increments | `renderCount` increases over time — renderer is actively processing frames |
| Terrain cache stable | `terrainBuildCount` stays at 1 while `renderCount` grows — cache is not rebuilt per frame |
| Object count stable | `totalObjectCount` does not grow unboundedly over a short window — no object leaks |
| Render duration measurable | `lastRenderDurationMs` is non-negative and sub-second — no pathological stalls |
| Harvester movement no leak | Harvester registry count stays constant during movement — no duplicate objects per frame |
| No console errors | Pan/zoom interaction produces zero runtime errors |

## Manual Acceptance Checklist

### Boot and default renderer

- [ ] Game boots with Canvas as default renderer (no Phaser flag set)
- [ ] Game boots with Phaser flag enabled (localStorage or URL param)
- [ ] `data-renderer` attribute on game screen matches selected renderer
- [ ] HUD (economy, build menu) is visible in both renderers

### Full isometric map

- [ ] Complete isometric diamond visible — left, right, top, bottom sides all render
- [ ] No clipping of terrain on the negative-X side of the map
- [ ] Pan left/right/up/down shows terrain across the entire map area
- [ ] Zoom in/out maintains terrain alignment

### Entity alignment and animation

- [ ] HQ renders at correct position, aligned with terrain
- [ ] Resources render at correct tile positions
- [ ] Obstacles render at correct tile positions
- [ ] Decor renders at correct tile positions
- [ ] Harvesters are visible and move between tiles
- [ ] Builders are visible and animate when busy
- [ ] Construction sites appear when build action is taken
- [ ] Construction progress bar updates visually

### Stability

- [ ] No console errors during normal gameplay (5+ minutes)
- [ ] Terrain does not flicker or rebuild during play
- [ ] Object count stays reasonable (check `__rendererStats.totalObjectCount`)
- [ ] `terrainBuildCount` stays at 1 after initial build
- [ ] `renderCount` increments steadily

### HUD and dev tools

- [ ] Economy HUD updates (raw/matter/active)
- [ ] Build panel works (can start construction)
- [ ] Dev panel tools work (Max All, +Harvester, etc.)
- [ ] Dev overlay toggles work (if enabled)

### Rollback

- [ ] Turning Phaser flag off and refreshing returns to Canvas renderer
- [ ] Canvas renderer still works correctly after Phaser session
- [ ] No residual Phaser state after flag removal

### Visual comparison: Canvas vs Phaser

- [ ] Terrain layout matches between Canvas and Phaser
- [ ] Entity positions match between Canvas and Phaser
- [ ] Shadows render in both (may differ in style, but present in both)
- [ ] Territory overlay renders in both (when territory system active)

---

## Default Switch Decision Gate

Before switching Phaser to default renderer, **all** of the following must be true:

1. **E2E green**: All Phaser renderer E2E tests pass consistently (no undocumented flakes)
2. **Manual QA passed**: Every item in the manual acceptance checklist above is verified
3. **No gameplay changes**: Phaser renderer does not alter any simulation, economy, construction, harvesting, or pathfinding behavior
4. **Civil loop visuals complete**: Phaser renderer supports all required civil-loop visual elements (terrain, HQ, buildings, construction sites, harvesters, builders, resources, obstacles, decor, territory)
5. **Performance smoke acceptable**: Render duration is sub-second, terrain cache does not rebuild every frame, object count stays stable, no memory leaks observed
6. **Canvas rollback path retained**: Canvas renderer remains functional and can be selected by turning the flag off; no code path makes Canvas unusable
7. **No editor blocking issue**: Map editor (if used) works correctly under both Canvas and Phaser, or has a documented limitation
8. **User approval required**: The default switch requires explicit user/owner approval — it is not automatic

### Criteria not yet met (as of Stage 3)

- VFX (dust, inertia, active feedback) not yet ported — deferred to future stage
- Performance benchmarking under large maps (64x64) not yet done
- Territory tile progress animation not yet implemented in Phaser renderer
- Long-duration memory profiling not yet done
- Editor preview renderer compatibility not yet validated

### Recommended next steps after Stage 3

1. Run manual acceptance checklist above
2. If all items pass, consider VFX port from spike (dust, inertia) as Stage 4
3. If performance is acceptable and civil loop is complete, prepare default switch proposal
4. Do NOT switch default until user approval is given
