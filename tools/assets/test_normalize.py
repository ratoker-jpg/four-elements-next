#!/usr/bin/env python3
"""Self-tests for the asset pipeline scripts.

Generates small in-memory Pillow images to test:
  - chroma removal
  - slicing
  - 256x256 normalization
  - naming convention
  - validator catches bad output

Run:
    python3 tools/assets/test_normalize.py

No binary fixtures required. All images are generated in memory.
"""

from __future__ import annotations

import io
import json
import os
import sys
import tempfile
from pathlib import Path

from PIL import Image

# Add tools/assets to path so we can import the modules
TOOLS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS_DIR))

import normalize_asset_sheet as norm
import validate_asset_outputs as val
import render_asset_preview as preview

CHROMA_RGB = (153, 0, 255)
PASSED = 0
FAILED = 0


def test(name: str, condition: bool, detail: str = "") -> None:
    """Report a single test result."""
    global PASSED, FAILED
    status = "PASS" if condition else "FAIL"
    if not condition:
        FAILED += 1
    else:
        PASSED += 1
    msg = f"  [{status}] {name}"
    if detail and not condition:
        msg += f" — {detail}"
    print(msg)


def make_chroma_sheet(rows: int, cols: int, cell_w: int = 64, cell_h: int = 64,
                      object_color: tuple[int, int, int] = (200, 100, 50)) -> Image.Image:
    """Create a test sprite sheet with chroma purple background and simple colored objects."""
    sheet_w = cols * cell_w
    sheet_h = rows * cell_h
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (*CHROMA_RGB, 255))

    for row in range(rows):
        for col in range(cols):
            cx = col * cell_w + cell_w // 2
            cy = row * cell_h + cell_h // 2
            # Draw a small filled rectangle as the "object"
            obj_w = cell_w // 3
            obj_h = cell_h // 3
            for dy in range(-obj_h, obj_h + 1):
                for dx in range(-obj_w, obj_w + 1):
                    x = cx + dx
                    y = cy + dy
                    if 0 <= x < sheet_w and 0 <= y < sheet_h:
                        sheet.putpixel((x, y), (*object_color, 255))

    return sheet


def test_chroma_removal() -> None:
    """Test that chroma purple is removed and foreground is preserved."""
    print("\n[test_chroma_removal]")
    sheet = make_chroma_sheet(2, 3, 64, 64, object_color=(200, 100, 50))
    cleaned = norm.remove_chroma(sheet, CHROMA_RGB, threshold=80.0)

    # The chroma pixels should be transparent
    center_x, center_y = 0, 0  # top-left corner — should be chroma
    r, g, b, a = cleaned.getpixel((center_x, center_y))
    test("chroma pixel becomes transparent", a == 0,
         f"got alpha={a} at chroma pixel")

    # A foreground pixel should remain opaque
    # Center of first cell
    cx, cy = 32, 32
    r, g, b, a = cleaned.getpixel((cx, cy))
    test("foreground pixel stays opaque", a == 255,
         f"got alpha={a} at foreground pixel (r={r},g={g},b={b})")
    test("foreground color preserved", (r, g, b) == (200, 100, 50),
         f"got ({r},{g},{b}) expected (200,100,50)")


def test_slicing() -> None:
    """Test that a sheet is sliced into the correct number of cells."""
    print("\n[test_slicing]")
    rows, cols = 3, 4
    sheet = make_chroma_sheet(rows, cols, 80, 80)
    cells = norm.slice_sheet(sheet, rows, cols)
    test("correct cell count", len(cells) == rows * cols,
         f"got {len(cells)} expected {rows * cols}")

    for i, cell in enumerate(cells):
        test(f"cell {i} has expected size", cell.size == (80, 80),
             f"got {cell.size}")


def test_normalization() -> None:
    """Test that cells are normalized to 256x256 with bottom-center anchor."""
    print("\n[test_normalization]")
    # Create a cell with a small object at center
    cell = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    # Draw a 20x20 object centered
    for y in range(22, 42):
        for x in range(22, 42):
            cell.putpixel((x, y), (180, 80, 40, 255))

    normalized = norm.normalize_cell(cell, target_size=256, bottom_padding=8)

    test("output is 256x256", normalized.size == (256, 256),
         f"got {normalized.size}")

    bbox = norm.alpha_bbox(normalized)
    test("normalized cell has content", bbox is not None)

    if bbox:
        left, top, right, bottom = bbox
        # Object should be near bottom
        test("object near bottom of cell", bottom > 200,
             f"bottom={bottom}")
        # Object should be roughly centered horizontally
        center_x = (left + right) / 2
        deviation = abs(center_x - 128) / 256
        test("object centered horizontally", deviation < 0.1,
             f"center_x={center_x}, deviation={deviation:.3f}")


def test_naming() -> None:
    """Test variant naming convention: {prefix}_{NN}.png"""
    print("\n[test_naming]")
    test("variant 01", norm.format_variant(0, 1) == "01")
    test("variant 02 from start=2", norm.format_variant(0, 2) == "02")
    test("variant 10 from start=1", norm.format_variant(9, 1) == "10")

    # Full naming test via process_sheet with temp dir
    sheet = make_chroma_sheet(1, 3, 64, 64, object_color=(100, 150, 200))
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        # Save sheet to a temp file
        sheet_path = tmpdir_path / "source.png"
        sheet.save(sheet_path)

        output_dir = tmpdir_path / "output"
        report = norm.process_sheet(
            source_path=sheet_path,
            rows=1,
            cols=3,
            prefix="mineral_small",
            start_variant=2,
            output_dir=output_dir,
            target_size=256,
        )

        expected_names = ["mineral_small_02.png", "mineral_small_03.png", "mineral_small_04.png"]
        test("output files named correctly", report["output_files"] == expected_names,
             f"got {report['output_files']}")

        # Check actual files exist
        for name in expected_names:
            test(f"file {name} exists", (output_dir / name).exists())


def test_full_pipeline() -> None:
    """Test the full pipeline: slice, chroma remove, normalize, save, report."""
    print("\n[test_full_pipeline]")
    rows, cols = 2, 2
    sheet = make_chroma_sheet(rows, cols, 100, 100, object_color=(50, 120, 180))

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        sheet_path = tmpdir_path / "source.png"
        sheet.save(sheet_path)

        output_dir = tmpdir_path / "output"
        report_path = tmpdir_path / "report.json"

        report = norm.process_sheet(
            source_path=sheet_path,
            rows=rows,
            cols=cols,
            prefix="rock_cluster",
            start_variant=1,
            output_dir=output_dir,
            target_size=256,
            report_path=report_path,
        )

        test("report has correct total_cells", report["total_cells"] == rows * cols,
             f"got {report['total_cells']}")
        test("all cells have content", report["cells_with_content"] == rows * cols,
             f"got {report['cells_with_content']}")
        test("report file created", report_path.exists())

        if report_path.exists():
            with open(report_path) as f:
                loaded = json.load(f)
            test("report JSON is valid", loaded["prefix"] == "rock_cluster")

        # Validate outputs
        val_report = val.validate_directory(output_dir)
        test("validation passes", val_report["status"] == "pass",
             f"status={val_report['status']}, failed={val_report.get('failed', '?')}")


def test_validator_catches_bad_output() -> None:
    """Test that the validator catches various problems."""
    print("\n[test_validator_catches_bad_output]")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Test 1: wrong size image
        bad_size = Image.new("RGBA", (128, 128), (100, 50, 50, 255))
        bad_size_path = tmpdir_path / "wrong_size.png"
        bad_size.save(bad_size_path)

        result = val.validate_file(bad_size_path)
        size_check = [c for c in result["checks"] if c["check"] == "size"]
        test("catches wrong size", len(size_check) > 0 and size_check[0]["status"] == "fail",
             f"checks: {result['checks']}")

        # Test 2: no alpha channel (RGB only)
        no_alpha = Image.new("RGB", (256, 256), (100, 50, 50))
        no_alpha_path = tmpdir_path / "no_alpha.png"
        no_alpha.save(no_alpha_path)

        result = val.validate_file(no_alpha_path)
        alpha_check = [c for c in result["checks"] if c["check"] == "alpha_channel"]
        test("catches missing alpha", len(alpha_check) > 0 and alpha_check[0]["status"] == "fail",
             f"checks: {[c['check'] for c in result['checks']]}")

        # Test 3: empty image
        empty = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        empty_path = tmpdir_path / "empty.png"
        empty.save(empty_path)

        result = val.validate_file(empty_path)
        nonempty_check = [c for c in result["checks"] if c["check"] == "nonempty"]
        test("catches empty image", len(nonempty_check) > 0 and nonempty_check[0]["status"] == "fail",
             f"checks: {[c['check'] for c in result['checks']]}")

        # Test 4: chroma fringe residue
        fringe = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        # Put a pixel that's very close to chroma purple
        for y in range(100, 120):
            for x in range(100, 120):
                fringe.putpixel((x, y), (155, 2, 253, 200))  # very close to #9900FF
        fringe_path = tmpdir_path / "fringe.png"
        fringe.save(fringe_path)

        result = val.validate_file(fringe_path)
        chroma_check = [c for c in result["checks"] if c["check"] == "chroma_fringe"]
        test("catches chroma fringe", len(chroma_check) > 0 and chroma_check[0]["status"] == "fail",
             f"checks: {[c['check'] for c in result['checks']]}")

        # Test 5: valid image should pass
        good = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        for y in range(80, 180):
            for x in range(80, 180):
                good.putpixel((x, y), (180, 120, 60, 255))
        good_path = tmpdir_path / "good.png"
        good.save(good_path)

        result = val.validate_file(good_path)
        test("valid image passes", result["status"] == "pass",
             f"status={result['status']}, checks: {[c for c in result['checks'] if c['status'] != 'pass']}")


def test_preview_render() -> None:
    """Test that the preview renderer produces a valid image."""
    print("\n[test_preview_render]")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        input_dir = tmpdir_path / "input"
        input_dir.mkdir()

        # Create a few test PNGs
        for i in range(4):
            img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
            for y in range(80, 180):
                for x in range(80, 180):
                    img.putpixel((x, y), (100 + i * 30, 80, 60, 255))
            img.save(input_dir / f"test_{i + 1:02d}.png")

        output_path = tmpdir_path / "preview.png"
        result = preview.render_preview(input_dir, output_path, cols=2, cell_size=256)

        test("preview file created", output_path.exists())
        test("preview result has files_count", result.get("files_count") == 4,
             f"got {result.get('files_count')}")
        test("preview result has sheet_size", "sheet_size" in result)

        if output_path.exists():
            preview_img = Image.open(output_path)
            test("preview image is valid", preview_img.size[0] > 0 and preview_img.size[1] > 0,
                 f"size={preview_img.size}")


def main() -> None:
    print("=" * 60)
    print("Asset Pipeline Self-Tests")
    print("=" * 60)

    test_chroma_removal()
    test_slicing()
    test_normalization()
    test_naming()
    test_full_pipeline()
    test_validator_catches_bad_output()
    test_preview_render()

    print("\n" + "=" * 60)
    print(f"Results: {PASSED} passed, {FAILED} failed out of {PASSED + FAILED}")
    print("=" * 60)

    if FAILED > 0:
        sys.exit(1)
    else:
        print("All tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()
