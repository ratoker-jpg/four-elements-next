# ASSET-PIPELINE-ARCH-01 — Map/Environment Asset Pipeline Spec

Status: **PR1 — docs/spec only.** No code, no tests, no assets, no manifests changed.

Last updated: 2026-05-23.

This document defines the asset pipeline specification for new map and environment assets in Four Elements Next. It covers asset categories, visual style rules, source generation conventions, sprite slicing rules, footprint/visual classes, variant strategy, chroma key processing, and a per-asset validation checklist.

The purpose is to establish a repeatable, reviewable pipeline from source generation through normalization to production integration, so that future PRs can generate, validate, and integrate environment asset variants without ad-hoc decisions.

This spec does **not** replace or modify the existing building asset block, unit sprites, or the general visual pipeline defined in `docs/visual/VISUAL_ASSET_PIPELINE.md`. It scopes only map/environment assets.

## 1. Scope

**In scope for ASSET-PIPELINE-ARCH-01:**

- Terrain/sand tile variants
- Resource/mineral node variants (small, medium, large, infinite)
- Obstacle/rock variants (rock clusters)
- Obstacle/mountain variants (small, medium, large)
- Decor/bush variants
- Decor/sand detail variants (bumps, dry details)
- Pipeline rules for generating, normalizing, and validating these assets
- Variant naming conventions and integration strategy

**Explicitly out of scope for this ARCH phase:**

- Building assets (frozen by `docs/project/BUILDING_ASSETS_CHECKPOINT_20260519.md`)
- Unit sprites (builder, harvester — covered by `docs/assets/CIVIL_SPRITE_SHEET_SPEC.md`)
- Combat units, tanks, turrets (future `COMBAT-VISUAL-ARCH-01`)
- VFX, effects, projectiles (future `VFX-AI-01`)
- Runtime code for variant randomization
- Calibration UI or debug overlays for asset tuning
- Volcano assets (deprecated for current visual direction)
- Manifest/index.json generation (future `ASSET-INDEX-01`)

## 2. Asset Categories

### 2.1 Terrain / Sand Tiles

Current assets:
- `sand_tile.png` — base terrain
- `sand_tile_dark.png` — darker variant
- `sand_tile_light.png` — lighter variant

Target: 2–4 additional sand tile variants to reduce visual repetition across the map. Each variant must tile seamlessly with the existing tiles. Variants may include subtle texture differences: fine grain, slight color temperature shifts, micro-detail patterns. No disruptive patterns that break the flat desert base.

Category code: `terrain`

### 2.2 Resources / Minerals

Current assets and profiles:

| Type | Asset key | Profile size | groundOffset | Footprint |
|---|---|---|---|---|
| Small | `mineral_small` | 42×42 | -8 | 1×1 |
| Medium | `mineral_medium` | 58×58 | -12 | 1×1 |
| Large | `mineral_large` | 74×74 | -16 | 1×1 |
| Infinite | `mineral_infinite` | 170×170 | -52 | 3×3 |

Target: 2–4 variants per size. Minerals must feature **saturated blue crystals** as their primary visual identifier. The blue/cyan color is reserved for minerals and must not appear on rocks, mountains, or decor. Larger mineral nodes should have more crystal clusters, bigger formations, and stronger visual presence. Infinite mineral must be immediately recognizable as a major strategic deposit due to its size, crystal density, and 3×3 footprint.

Category code: `mineral`

### 2.3 Obstacles / Rocks

Current assets and profiles:

| Type | Asset key | Profile size | groundOffset | Footprint |
|---|---|---|---|---|
| Rock cluster | `rock_cluster_small_01` | 58×46 | -8 | 1×1 |

Target: 2–4 rock cluster variants. Rocks must look like **weathered desert stone** — warm sandy-grays, brownish-tans, dusty earth tones. Rocks must **not** contain bright blue crystals, glowing mineral veins, or any blue/cyan accent details. The visual distinction between rocks and minerals must be immediate: rocks are stone, minerals are blue crystal. If a player confuses a rock for a mineral, the asset has failed the readability test.

Category code: `rock`

### 2.4 Obstacles / Mountains

Current assets and profiles:

| Type | Asset key | Profile size | groundOffset | Footprint |
|---|---|---|---|---|
| Mountain small | `mountain_small_01` | 80×72 | 0 | 1×1 |
| Mountain medium | `mountain_medium_01` | 120×96 | 12 | 2×2 |
| Mountain large | `mountain_large_01` | 160×142 | 28 | 3×3 |

Target: 2–3 variants per size. Mountains are large rock formations — the same palette rules as rocks apply: warm sandy-grays, brownish-tans, dusty earth tones, no blue/cyan mineral accents. Mountains should feel like solid geological formations, not crystal deposits. Larger mountains can have layered rock faces, crevices, and weathering detail, but must remain clearly stone-colored and distinct from the blue mineral nodes.

Category code: `mountain`

### 2.5 Decor / Bushes

Current assets and profiles:

| Type | Asset key | Profile size | groundOffset | Footprint |
|---|---|---|---|---|
| Dry bush | `dry_bush_01` | 34×28 | -8 | 1×1 (non-blocking) |

Target: 2–4 dry bush variants. Bushes are small, non-blocking desert vegetation — dry scrub, thorny twigs, withered grass clusters. Must **not** include a sand base or pedestal underneath the object. The bush sits on the terrain directly, not on a visible sand mound. Colors should be muted yellows, dry greens, pale browns — fitting a desert environment.

Category code: `bush`

### 2.6 Decor / Sand Details

Current assets and profiles:

| Type | Asset key | Profile size | groundOffset | Footprint |
|---|---|---|---|---|
| Sand bump | `sand_bump_01` | 50×28 | -8 | 1×1 (non-blocking) |

Target: 2–4 sand detail variants. These are subtle terrain details — small sand ripples, dry cracks, tiny pebble clusters, wind-blown patterns. They add visual texture to the map without cluttering it. Must **not** include a sand base or pedestal under the object. All isolated decor objects must avoid baked sand patches underneath — the terrain tile itself provides the ground.

Category code: `sand_detail`

## 3. Camera and Style Rules

### 3.1 Camera

- **Fixed isometric camera** — the same angle used for all current buildings, units, and environment objects.
- All assets must be authored for this specific isometric projection. Do not use top-down, side-view, or perspective angles.
- The isometric angle matches the existing game foundation: diamond-grid tiles where the x-axis goes south-east and the y-axis goes south-west.

### 3.2 Visual Style

- **Clean soft sci-fi desert RTS** — not photorealistic, not cartoon-flat, not pixel-art-retro.
- **Readable mobile RTS silhouettes** — assets must read clearly at gameplay zoom (~0.6–0.8x of native resolution). A player should identify an object's type and size within half a second of glancing at it.
- **Warm desert palette** — sandy yellows, warm tans, dusty browns, earth tones dominate the base terrain and obstacles.
- **Blue/cyan accents reserved for minerals** — the saturated blue crystal look is the mineral identity. Rocks, mountains, bushes, and sand details must not use this accent.
- **No photorealism** — stylized, readable, slightly painterly.
- **No harsh outlines** — soft edge treatment, no thick black borders around objects.
- **Consistent scale across variants within a category** — all `mineral_small` variants must feel like the same size class; all `mountain_medium` variants must occupy the same visual mass.

### 3.3 Visual Distinction Rules

| Category | Primary visual identifier | Must not contain |
|---|---|---|
| Minerals | Saturated blue crystals, cyan glow | Sand/stone textures, earth-tone base |
| Rocks | Weathered stone, sandy-gray tones | Blue/cyan crystals, glowing veins |
| Mountains | Large stone formations, earth tones | Blue/cyan crystals, mineral accents |
| Bushes | Dry vegetation, muted greens/yellows | Blue accents, sand pedestal underneath |
| Sand details | Subtle terrain texture | Blue accents, sand pedestal underneath |

## 4. Source Generation Rules

### 4.1 Source Image Format

Source images for asset generation may use a 16:9 landscape sheet format containing multiple variants or multiple objects side by side. Individual objects are later sliced into normalized cells.

### 4.2 Chroma Purple Background

- Use **bright chromatic purple** (`#9900FF`) as the background in source generation images.
- Purple is chosen specifically because it has maximum visual separation from:
  - warm desert tones (yellows, tans, browns),
  - cyan/blue mineral accents,
  - green vegetation tones,
  - neutral grays of rocks.
- Do **not** use red/magenta, green, or blue chroma keys — they risk confusion with desert reds, vegetation greens, or mineral blues.
- The chroma purple is removed to alpha during the pipeline normalization step.

### 4.3 Object Isolation

- Each object in the source sheet must be **isolated with spacing** from other objects and from the sheet edges.
- Minimum spacing between objects: 32px at source resolution.
- **No sand base or pedestal** under any isolated object. Objects must not sit on a visible sand mound or ground patch. The terrain tile provides the ground; the object floats above it with transparent alpha underneath.
- **No baked shadows** in the transparent output unless explicitly approved for a specific asset. Directional shadows are rendered at runtime by the game engine (see `VISUAL-QA-ARCH-01` PR3).
- **No UI elements, labels, text, or frame numbers** in the source or output images.
- **No checkerboard patterns** — checkerboard is viewer UI only, not PNG pixels.

### 4.4 Per-Object Rules

- Objects should be centered in their expected cell space.
- Bottom-center anchor must be visually consistent — the object's ground contact point should be at the bottom-center of the normalized cell.
- Objects should face the isometric camera at the same angle as existing environment assets.

## 5. Sprite Sheet / Slicing Rules

### 5.1 Normalized Cell Size

- **Target cell: 256×256 PNG** per variant.
- Each individual object variant is stored as one 256×256 PNG file.
- The 256×256 cell provides ample padding around the object for `containFit` rendering at various zoom levels.
- Larger objects (mountain-large, mineral-infinite) that currently use profiles up to 170px will fit comfortably within 256×256 with padding.

### 5.2 Transparent Background

- After chroma removal, the output PNG must have a fully transparent alpha channel.
- No residual purple fringe, halo, or edge artifacts around the object.
- Validate by checking that no pixel with RGB values near `#9900FF` remains in the output.

### 5.3 Bottom-Center Anchor

- All environment objects share a **bottom-center anchor** convention.
- The object's visual ground contact point should be positioned near the bottom-center of the 256×256 cell.
- This matches the existing `SPRITE_PROFILES` anchor model where objects are drawn centered horizontally with a `groundOffset` applied vertically.
- **No per-frame auto-centering** that would shift the anchor point between variants. All variants within a category must share the same anchor position so they are interchangeable at runtime without profile adjustments.

### 5.4 Shared Scale per Category

- All variants within a category must share the same visual scale. A `mineral_small_02` variant must occupy the same visual mass as `mineral_small_01`, not be 30% larger or smaller.
- This ensures that runtime `SPRITE_PROFILES` entries can use the same `size` and `groundOffset` values for all variants of the same type.
- Small variations in silhouette shape are expected and desired — but overall mass, height, and width must be consistent.

### 5.5 File Naming Convention

Pattern:

```
{asset_type}_{size_or_kind}_{variant}.png
```

Where:
- `asset_type` — the category: `mineral`, `rock`, `mountain`, `bush`, `sand_bump`, `sand_tile`
- `size_or_kind` — the size class or kind: `small`, `medium`, `large`, `infinite`, `cluster`, `detail`
- `variant` — two-digit variant number: `01`, `02`, `03`, `04`

Examples:

| File name | Category | Size/Kind | Variant |
|---|---|---|---|
| `mineral_small_01.png` | mineral | small | 01 (existing) |
| `mineral_small_02.png` | mineral | small | 02 (new variant) |
| `mineral_medium_03.png` | mineral | medium | 03 (new variant) |
| `mineral_large_02.png` | mineral | large | 02 (new variant) |
| `mineral_infinite_02.png` | mineral | infinite | 02 (new variant) |
| `rock_cluster_02.png` | rock | cluster | 02 (new variant) |
| `mountain_small_02.png` | mountain | small | 02 (new variant) |
| `mountain_medium_02.png` | mountain | medium | 02 (new variant) |
| `mountain_large_03.png` | mountain | large | 03 (new variant) |
| `dry_bush_02.png` | bush | — | 02 (new variant) |
| `dry_bush_03.png` | bush | — | 03 (new variant) |
| `sand_bump_02.png` | sand_detail | — | 02 (new variant) |
| `sand_bump_03.png` | sand_detail | — | 03 (new variant) |
| `sand_tile_04.png` | terrain | — | 04 (new variant) |

The existing `_01` suffix convention extends naturally. New variants receive `_02`, `_03`, `_04` suffixes.

### 5.6 Storage Path

All environment asset variants are stored in:

```
public/assets/environment/{filename}.png
```

Same directory as existing environment assets. No subdirectory structure for variants — the naming convention distinguishes them.

## 6. Footprint vs Visual Size Classes

The relationship between **gameplay footprint** (tiles occupied) and **visual size** (pixel dimensions) is important but not identical. A visual size class describes how large the object appears on screen, while the footprint describes how many tiles it blocks.

### 6.1 Class Definitions

| Class | Footprint | Visual profile range | Examples |
|---|---|---|---|
| 1×1 small | 1 tile | ~34–58px | small mineral, rock cluster, dry bush, sand bump |
| 1×1 large visual | 1 tile | ~74–80px | large mineral, mountain-small |
| 2×2 | 4 tiles | ~96–120px | mountain-medium |
| 3×3 | 9 tiles | ~142–170px | mountain-large, mineral-infinite |

### 6.2 Key Distinction

- **1×1 large visual** objects (like `mineral_large` or `mountain_small`) occupy only 1 tile of gameplay footprint but appear visually larger than 1×1 small objects. Their sprite extends beyond the tile boundary into neighboring visual space, but only the footprint tile blocks movement and construction.
- This means a `mineral_large` and a `mineral_small` block the same number of tiles, but the large variant is visually more prominent. Players can see at a glance which resource deposits are more valuable.
- The `mineral_infinite` is a special case: it has a 3×3 footprint AND the largest visual size, making it the most prominent object on the map.

### 6.3 Variants and Footprint

Variants must **not** change the gameplay footprint of their type. A `mineral_small_02` variant must still be footprint 1×1. A `mountain_medium_02` variant must still be footprint 2×2. If a future variant needs a different footprint, it must be defined as a new type in `map-types.ts`, not as a variant of an existing type.

## 7. Variant Strategy

### 7.1 Purpose

Multiple variants per category reduce visual monotony on the generated map. When a map has 12 small mineral deposits, seeing the same `mineral_small_01` sprite 12 times makes the map feel repetitive. Having 3–4 variants allows the renderer to select different sprites for different placements.

### 7.2 Variant Counts (Target)

| Category | Current | Target variants |
|---|---|---|
| Sand tiles | 3 | 4–6 |
| Mineral small | 1 | 3–4 |
| Mineral medium | 1 | 3–4 |
| Mineral large | 1 | 2–3 |
| Mineral infinite | 1 | 2–3 |
| Rock cluster | 1 | 3–4 |
| Mountain small | 1 | 2–3 |
| Mountain medium | 1 | 2–3 |
| Mountain large | 1 | 2–3 |
| Dry bush | 1 | 3–4 |
| Sand bump | 1 | 3–4 |

These are targets, not requirements for a single PR. Variants can be added incrementally across multiple PRs.

### 7.3 Variant Selection at Runtime

Variant selection is **future runtime work**, not part of this spec PR. When implemented, the expected approach is:

- Each object placement in `MapData` stores a `variantIndex` or similar field (defaulting to 0 for existing maps).
- `mapgen` selects a random variant index for each object during map generation.
- The renderer looks up the variant sprite using the asset key pattern `{asset_type}_{size_or_kind}_{variant}`.
- The `SPRITE_PROFILES` entry for a type applies to all variants equally (same `size`, same `groundOffset`).

This ensures backward compatibility: existing maps without variant data default to `_01` and continue to render identically.

### 7.4 Variant Constraints

- Variants must not change gameplay footprint (see section 6.3).
- Variants must share the same `SPRITE_PROFILES` entry (same `size`, same `groundOffset`).
- Variants must share the same visual style and color rules as their category.
- Variants should offer meaningful visual difference — different crystal cluster arrangements for minerals, different rock shapes for obstacles, different bush shapes for decor. Cosmetic variation, not gameplay variation.

## 8. Chroma Key Processing

### 8.1 Chroma Color

- **Chroma purple: `#9900FF`** (RGB: 153, 0, 255).
- This color is chosen for maximum separation from all asset palette ranges:
  - Desert warm tones (yellows, oranges, reds, browns) — far from purple in hue.
  - Mineral cyan/blue — different hue and much higher saturation.
  - Vegetation greens — complementary, no confusion.
  - Stone grays — neutral, no overlap with saturated purple.

### 8.2 Pipeline Steps

1. Source image has chroma purple background.
2. Pipeline script converts chroma purple pixels to fully transparent alpha.
3. Color distance threshold removes anti-aliased fringe pixels that blend between purple and the object.
4. Output is a transparent PNG with no purple residue.

### 8.3 Validation

After chroma removal:
- No pixel in the output should have RGB values within a threshold of `#9900FF`.
- No purple halo or fringe around object edges.
- If fringe is detected, increase the color distance threshold or add a secondary cleanup pass.
- This can be automated in a future `tools/assets/normalize_sprite.py` script.

## 9. Validation Checklist

Every asset variant must pass this checklist before production integration.

### 9.1 Format and Technical Checks

- [ ] Output is a **transparent PNG** file
- [ ] File is **256×256** pixels (normalized cell)
- [ ] No residual chroma purple pixels (`#9900FF` within threshold)
- [ ] No checkerboard pixels in the image
- [ ] No white matte or black halo around edges
- [ ] File size is reasonable (< 200KB for a 256×256 environment sprite)

### 9.2 Anchor and Positioning Checks

- [ ] Object is **centered** horizontally in the cell
- [ ] **Bottom-center anchor** is consistent with other variants in the same category
- [ ] Object does not appear to float, sink, or shift relative to the ground plane
- [ ] No auto-centering has shifted the anchor between variants

### 9.3 Style and Readability Checks

- [ ] Object has **no sand base or pedestal** underneath — terrain provides the ground
- [ ] Object is readable at **game zoom** (~0.6–0.8x)
- [ ] Silhouette is distinct and recognizable at gameplay scale
- [ ] **No confusion between minerals and rocks** — minerals are blue crystal, rocks are sandy stone
- [ ] **No confusion between minerals and mountains** — mountains are large stone formations, not crystal deposits
- [ ] Consistent **scale** with other variants in the same category
- [ ] Visual style matches the soft sci-fi desert RTS direction
- [ ] No harsh outlines
- [ ] No photorealistic detail that breaks at small zoom

### 9.4 Category-Specific Checks

- [ ] **Minerals:** feature saturated blue/cyan crystals as primary visual
- [ ] **Rocks:** warm sandy-gray tones only, no blue/cyan crystal accents
- [ ] **Mountains:** warm earth tones only, no blue/cyan crystal accents, no mineral veins
- [ ] **Bushes:** dry vegetation tones, no sand pedestal, no blue accents
- [ ] **Sand details:** subtle texture, no sand pedestal, no blue accents
- [ ] **No volcano assets** — volcanoes are deprecated for current visual direction

### 9.5 Source and License Checks

- [ ] Source of the asset is recorded (AI generation prompt, manual edit, Blender render, etc.)
- [ ] License/status is recorded
- [ ] Asset is marked as candidate-stage until it passes the asset candidate gate in `docs/ASSET_POLICY.md`

## 10. No Volcano Assets

Volcanoes are **deprecated for current visual direction**:

- No volcano assets in this pipeline.
- No volcano variants.
- No volcano palette items, presets, or config fields.
- Existing volcano code/types (`volcano-small`, `volcano-medium`) in `map-types.ts` are not removed, but no new volcano assets are generated.
- Use mountains and rock clusters for obstacles instead.

## 11. No Buildings/Units Replacement

This ARCH phase does **not** touch:

- Building assets (frozen by `docs/project/BUILDING_ASSETS_CHECKPOINT_20260519.md`)
- Unit sprites (builder, harvester — covered by `docs/assets/CIVIL_SPRITE_SHEET_SPEC.md`)
- Building `SPRITE_PROFILES` entries
- Building render math or `containFit` logic

Any building or unit visual changes require a separate scoped decision and a new ARCH.

## 12. Relationship to Existing Docs

| Document | Relationship |
|---|---|
| `docs/ASSET_POLICY.md` | Defines the asset candidate gate. New variants must pass this gate before production integration. |
| `docs/visual/VISUAL_ASSET_PIPELINE.md` | Defines the general visual pipeline, style, anchor, and layered model. This spec is a concrete specialization for environment assets. |
| `docs/assets/CIVIL_SPRITE_SHEET_SPEC.md` | Covers unit sprite sheets. Separate from this environment asset spec. |
| `docs/project/BUILDING_ASSETS_CHECKPOINT_20260519.md` | Frozen building block. This spec does not modify it. |
| `docs/gameplay/MAP_GENERATION_SPEC.md` | Defines mapgen rules. Variant integration in mapgen is future work. |
| `agent-ctx/state.md` | Current project state. Will be updated when variants are integrated. |

## 13. Future Work (Not in PR1)

These items are documented here for planning but are explicitly **not** part of PR1:

- Runtime variant selection in mapgen (random variant index per placement)
- `variantIndex` field in `MapData` placement types
- `SPRITE_PROFILES` updates for new variant keys
- `ASSET_KEYS` updates in `map-types.ts` for variant mapping
- Sprite normalization script (`tools/assets/normalize_sprite.py`)
- Asset manifest/index.json generation
- Calibration UI for visual profile tuning
- Sand tile variant integration in terrain renderer
- Asset preview sandbox updates for variant browsing
