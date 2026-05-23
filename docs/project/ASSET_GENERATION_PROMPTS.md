# ASSET-PIPELINE-ARCH-01 — Asset Generation Prompt Templates

Status: **Reference templates for future use.** Do not run these prompts in PR1. PR1 is docs/spec only — no images generated.

Last updated: 2026-05-23.

This document contains template AI image generation prompts for each environment asset category defined in `docs/project/ASSET_PIPELINE_ARCH_01.md`. These prompts are designed to produce source images that conform to the pipeline spec: chroma purple background, isolated objects, isometric camera, soft sci-fi desert RTS style.

When generating assets in future PRs, use these templates as a starting point and adjust variant descriptions as needed.

## Global Style Prefix

All prompts should start with this style prefix to ensure consistency:

```
Isometric 2.5D view, fixed isometric camera angle, soft sci-fi desert RTS style.
Clean readable silhouette for mobile RTS zoom level.
Warm desert palette: sandy yellows, tans, dusty browns.
No harsh outlines, no photorealism, no thick black borders.
Bright chroma purple background (#9900FF) for chroma key removal.
Object isolated with spacing, no sand base or pedestal underneath.
No UI, no labels, no text, no frame numbers, no checkerboard.
Transparent-destined output — no baked shadows.
```

## Global Negative Prompt

All prompts should include this negative prompt to avoid common issues:

```
photorealistic, harsh black outlines, sand pedestal, sand mound,
baked shadow, checkerboard, text, labels, UI elements, blue crystals
on rocks, mineral veins on stone, ground plane, floating, blurry,
low contrast, noisy detail, oversaturated, underwater, snow, ice,
volcano, lava, green grass, forest
```

Note: "blue crystals on rocks" and "mineral veins on stone" are in the negative prompt for rock/mountain/decor categories. For mineral prompts, remove these negative terms.

---

## 1. Terrain / Sand Tile Prompts

### sand_tile variant

```
[STYLE PREFIX]
Single flat sand terrain tile for isometric RTS game.
Subtle sand texture with fine grain, [variant description].
Warm sandy yellow base color with slight tonal variation.
Fills a diamond-shaped isometric tile seamlessly.
Must tile with other sand variants without visible seams.

Variant descriptions:
  02: slightly warmer tone, fine wind-ripple pattern
  03: subtle cross-hatch crack pattern, drier look
  04: very faint pebble speckle, slightly cooler tone
```

### Negative (terrain)

```
[GLOBAL NEGATIVE], object, crystal, rock, building, unit, shadow
```

---

## 2. Mineral / Resource Prompts

### mineral_small variant

```
[STYLE PREFIX]
Small mineral crystal deposit for isometric RTS game.
2–3 saturated blue/cyan crystal shards emerging from sandy ground.
Crystals are bright, glowing slightly, clearly blue.
Crystal height: small, fits in a 42px profile at game scale.
No sand base underneath the crystal cluster.

Variant descriptions:
  02: three thin crystal shards fanning outward
  03: two chunky crystal blocks side by side
  04: single tall narrow crystal spike
```

### mineral_medium variant

```
[STYLE PREFIX]
Medium mineral crystal deposit for isometric RTS game.
4–6 saturated blue/cyan crystal shards forming a cluster.
Crystals are bright blue with slight glow, clearly identifiable as resource.
Crystal height: medium, fits in a 58px profile at game scale.
No sand base underneath the crystal cluster.

Variant descriptions:
  02: wide crystal fan with mixed shard sizes
  03: dense vertical crystal cluster, taller than wide
  04: two crystal groups with a gap between them
```

### mineral_large variant

```
[STYLE PREFIX]
Large mineral crystal deposit for isometric RTS game.
6–10 saturated blue/cyan crystal shards forming a substantial cluster.
Crystals are vivid blue with visible internal glow.
Crystal height: large, fits in a 74px profile at game scale.
No sand base underneath the crystal cluster.

Variant descriptions:
  02: broad crystal formation, wider than tall
  03: tall crystal spire cluster with side crystals
```

### mineral_infinite variant

```
[STYLE PREFIX]
Infinite mineral crystal deposit for isometric RTS game — the largest resource node.
10–16 saturated blue/cyan crystal shards forming a massive glowing crystal formation.
Central crystal cluster is large, radiant, and visually dominant.
Fits in a 170px profile at game scale.
3×3 gameplay footprint — this is a major strategic point.
No sand base underneath the crystal formation.

Variant descriptions:
  02: wide crystal plateau with multiple peaks
  03: towering central crystal with radiating smaller clusters
```

### Negative (minerals)

```
[GLOBAL NEGATIVE minus "blue crystals on rocks" and "mineral veins on stone"],
rock, stone, earth tone, brown, gray boulder, sandstone
```

---

## 3. Rock / Obstacle Prompts

### rock_cluster variant

```
[STYLE PREFIX]
Small rock cluster obstacle for isometric RTS game.
2–4 weathered desert rocks clustered together.
Warm sandy-gray and brownish-tan stone colors.
NO blue crystals, NO cyan accents, NO mineral veins.
Rocks look like natural desert stone, not crystal deposits.
Fits in a 58×46px profile at game scale.
No sand base underneath the rocks.

Variant descriptions:
  02: three rounded boulders in a tight triangle
  03: two angular flat rocks stacked slightly
  04: single large rock with two small pebbles beside it
```

### Negative (rocks)

```
[GLOBAL NEGATIVE], blue crystal, cyan, mineral, glowing, ice, snow,
metallic, reflective, wet
```

---

## 4. Mountain Prompts

### mountain_small variant

```
[STYLE PREFIX]
Small mountain obstacle for isometric RTS game.
Single small rocky peak, weathered desert stone.
Warm sandy-gray and earth-tone colors.
NO blue crystals, NO cyan accents, NO mineral veins.
Mountain looks like solid rock, not crystal deposit.
Fits in an 80×72px profile at game scale.
1×1 footprint.

Variant descriptions:
  02: rounded dome-shaped small mountain
  03: sharp rocky peak with visible crevice
```

### mountain_medium variant

```
[STYLE PREFIX]
Medium mountain obstacle for isometric RTS game.
Larger rocky formation with layered rock faces.
Warm sandy-gray, dusty brown, earth-tone colors.
NO blue crystals, NO cyan accents, NO mineral veins.
Solid geological formation, not crystal deposit.
Fits in a 120×96px profile at game scale.
2×2 footprint.

Variant descriptions:
  02: twin peaks with a saddle between them
  03: wide flat-topped mesa with eroded sides
```

### mountain_large variant

```
[STYLE PREFIX]
Large mountain obstacle for isometric RTS game.
Massive rocky formation dominating the surrounding terrain.
Layered rock faces, crevices, weathering detail.
Warm sandy-gray, dusty brown, earth-tone colors.
NO blue crystals, NO cyan accents, NO mineral veins.
Solid stone, not crystal deposit.
Fits in a 160×142px profile at game scale.
3×3 footprint.

Variant descriptions:
  02: broad mountain with multiple weathered ridges
  03: steep craggy peak with deep crevices
```

### Negative (mountains)

```
[GLOBAL NEGATIVE], blue crystal, cyan, mineral vein, glowing,
ice cap, snow cap, volcano, lava, forest, vegetation
```

---

## 5. Bush / Decor Prompts

### dry_bush variant

```
[STYLE PREFIX]
Dry desert bush decor for isometric RTS game.
Small withered shrub, dry twigs, sparse leaves.
Muted yellow, pale green, dry brown tones.
Non-blocking decor — small and unobtrusive.
NO sand base or pedestal underneath the bush.
NO blue or cyan accents.
Fits in a 34×28px profile at game scale.

Variant descriptions:
  02: round bush with dry leaf clusters
  03: tall thin thorny twig bush
  04: low spreading ground cover with tiny dry flowers
```

### Negative (bushes)

```
[GLOBAL NEGATIVE], blue, cyan, crystal, rock, mineral,
lush green, tropical, flower pot, sand pedestal
```

---

## 6. Sand Detail Prompts

### sand_bump variant

```
[STYLE PREFIX]
Small sand terrain detail for isometric RTS game.
Subtle sand formation: ripple, crack, pebble cluster, or wind pattern.
Very small, barely raised from ground, non-blocking.
Warm sandy tones matching base terrain.
NO sand base or pedestal — this IS the terrain detail, not sitting on one.
NO blue or cyan accents.
Fits in a 50×28px profile at game scale.

Variant descriptions:
  02: small wind ripple line across sand
  03: tiny cracked earth patch
  04: cluster of 3–5 small pebbles on sand
```

### Negative (sand details)

```
[GLOBAL NEGATIVE], blue, cyan, crystal, mineral, rock, bush,
plant, object, tall feature, sand pedestal, mound
```

---

## Usage Notes

1. **Do not run these prompts in PR1.** PR1 establishes the spec and templates only.
2. When generating assets in future PRs, produce source images with chroma purple background first, then run the normalization pipeline to produce transparent 256×256 PNGs.
3. Each generation session should produce all variants for a category at once to ensure style consistency.
4. After generation, every variant must pass the validation checklist in `ASSET_PIPELINE_ARCH_01.md` section 9.
5. Assets remain candidate-stage until they pass the asset candidate gate in `docs/ASSET_POLICY.md`.
6. Record the exact prompt, model, settings, and seed for each generated variant for reproducibility.
