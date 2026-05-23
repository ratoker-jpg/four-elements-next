# Asset Pipeline Tools

Offline Python tooling for slicing, normalizing, previewing, and validating sprite sheet assets for the Four Elements Next map/environment pipeline.

These tools do **not** modify runtime code, game assets, or manifests. They are standalone utilities for artists and developers preparing asset variants.

**Do not commit generated output files** (PNGs, preview sheets, JSON reports, or temporary output folders) to the repository.

## Scripts

| Script | Purpose |
|---|---|
| `normalize_asset_sheet.py` | Slice a chroma-purple sprite sheet into normalized 256x256 transparent PNGs |
| `render_asset_preview.py` | Render a contact/preview sheet from a directory of PNGs |
| `validate_asset_outputs.py` | Validate output PNGs against the pipeline spec |
| `test_normalize.py` | Self-tests using in-memory generated images |

## Requirements

- Python 3.10+
- Pillow (already available in the project environment)
- No additional dependencies

## 1. normalize_asset_sheet.py

### Overview

Takes a source sprite sheet with a **chroma purple** (`#9900FF`) background, slices it into a grid of cells, removes the chroma to alpha, and outputs each cell as a 256x256 transparent PNG with bottom-center anchor alignment.

### Usage

```bash
python3 tools/assets/normalize_asset_sheet.py SOURCE.png \
    --rows ROWS --cols COLS --prefix PREFIX \
    [--start-variant N] \
    [--output-dir DIR] \
    [--cell-width W] [--cell-height H] \
    [--target-size SIZE] \
    [--chroma-threshold T] \
    [--anchor-y-ratio R] \
    [--bottom-padding P] \
    [--report report.json]
```

### Arguments

| Argument | Required | Default | Description |
|---|---|---|---|
| `SOURCE` | Yes | — | Path to source sprite sheet PNG |
| `--rows` | Yes | — | Number of rows in the sheet grid |
| `--cols` | Yes | — | Number of columns in the sheet grid |
| `--prefix` | Yes | — | Output filename prefix (e.g. `mineral_small`) |
| `--start-variant` | No | 1 | Starting variant number |
| `--output-dir` | No | `.` | Directory for output PNGs |
| `--cell-width` | No | auto | Cell width in pixels (default: source_width / cols) |
| `--cell-height` | No | auto | Cell height in pixels (default: source_height / rows) |
| `--target-size` | No | 256 | Output cell size in pixels |
| `--chroma-threshold` | No | 80 | Color distance threshold for chroma removal |
| `--anchor-y-ratio` | No | 0.88 | Vertical anchor ratio within cell |
| `--bottom-padding` | No | 8 | Pixels of padding from bottom edge |
| `--report` | No | — | Path for JSON report output |

### 4x3 Sheet Example

Source: a 1024x768 sprite sheet with 4 columns and 3 rows of mineral small variants on chroma purple background.

```bash
python3 tools/assets/normalize_asset_sheet.py minerals_source.png \
    --rows 3 --cols 4 \
    --prefix mineral_small \
    --start-variant 2 \
    --output-dir ./output_minerals \
    --report ./output_minerals/report.json
```

Output files:

```
output_minerals/
  mineral_small_02.png
  mineral_small_03.png
  mineral_small_04.png
  mineral_small_05.png
  mineral_small_06.png
  mineral_small_07.png
  mineral_small_08.png
  mineral_small_09.png
  mineral_small_10.png
  mineral_small_11.png
  mineral_small_12.png
  mineral_small_13.png
  report.json
```

### Chroma Removal

The script uses Euclidean color distance to detect chroma purple (`#9900FF` = RGB 153, 0, 255). Pixels within the threshold distance are made transparent. Pixels near the boundary receive proportional alpha, which reduces fringe artifacts.

Increase `--chroma-threshold` if purple fringe remains. Decrease it if foreground colors near purple are being incorrectly removed.

## 2. render_asset_preview.py

### Overview

Reads all PNG files from a directory, sorts them by filename, and arranges them into a grid on a single output image for visual review.

### Usage

```bash
python3 tools/assets/render_asset_preview.py INPUT_DIR \
    [--output preview.png] \
    [--cols 8] \
    [--cell-size 256] \
    [--labels]
```

### Preview Example

```bash
python3 tools/assets/render_asset_preview.py ./output_minerals \
    --output ./output_minerals/preview.png \
    --cols 4 \
    --labels
```

**Warning:** Preview sheets are for local review only. Do not commit them to the repository.

## 3. validate_asset_outputs.py

### Overview

Validates that output PNGs conform to the pipeline specification. Checks:

- **Size:** image is 256x256 pixels
- **Alpha channel:** image has RGBA mode
- **No chroma fringe:** no pixels near chroma purple `#9900FF`
- **Non-empty:** image has opaque pixels
- **Warnings:** clipping at edges, excessive padding, horizontal anchor deviation

### Usage

```bash
python3 tools/assets/validate_asset_outputs.py INPUT_DIR \
    [--report validation.json]
```

### Validation Example

```bash
python3 tools/assets/validate_asset_outputs.py ./output_minerals \
    --report ./output_minerals/validation.json
```

Exit code 0 = all pass, exit code 1 = any failure.

### Validation Report

The JSON report contains per-file results with individual check statuses:

```json
{
  "status": "pass",
  "total_files": 12,
  "passed": 12,
  "failed": 0,
  "files": [
    {
      "file": "mineral_small_02.png",
      "status": "pass",
      "checks": []
    }
  ]
}
```

## 4. test_normalize.py

Self-tests using in-memory generated Pillow images. No binary fixtures needed.

```bash
python3 tools/assets/test_normalize.py
```

Tests cover:

- Chroma removal correctness
- Sheet slicing
- 256x256 normalization with bottom-center anchor
- Naming convention (`{prefix}_{NN}.png`)
- Full pipeline integration
- Validator catching bad output (wrong size, no alpha, empty, chroma fringe)
- Preview renderer

## Workflow

```text
1. Generate source image with chroma purple (#9900FF) background
2. Run normalize_asset_sheet.py to slice, clean, and normalize
3. Run validate_asset_outputs.py to check outputs
4. Run render_asset_preview.py to create a visual contact sheet
5. Review preview sheet and validation report
6. Manually approve assets for production integration
```

## Important Warnings

- **Do not commit** generated PNGs, preview sheets, JSON reports, or output folders to the repository.
- These tools do **not** modify runtime code, game assets, sprite profiles, or manifests.
- Assets remain candidate-stage until they pass the asset candidate gate in `docs/ASSET_POLICY.md`.
- The pipeline spec is defined in `docs/project/ASSET_PIPELINE_ARCH_01.md`.
