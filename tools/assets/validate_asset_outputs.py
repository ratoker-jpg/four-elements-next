#!/usr/bin/env python3
"""Validate normalized asset outputs against the pipeline spec.

Checks each PNG in the input directory for:
  - 256x256 pixel size
  - alpha channel present
  - no residual chroma purple fringe
  - non-empty content (has opaque pixels)
  - warns on clipping, excessive padding, or anchor deviation

Outputs a JSON report and exits with code 0 if all pass, 1 if any fail.

Usage:
    python3 tools/assets/validate_asset_outputs.py ./output
    python3 tools/assets/validate_asset_outputs.py ./output --report validation.json

See tools/assets/README.md for full documentation.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

CHROMA_RGB = (153, 0, 255)
CHROMA_CHECK_THRESHOLD = 50.0
EXPECTED_SIZE = 256
MIN_OPAQUE_PIXELS = 10
MAX_PADDING_RATIO = 0.85
MAX_ANCHOR_X_DEVIATION = 0.15


def color_distance(rgb_a: tuple[int, int, int], rgb_b: tuple[int, int, int]) -> float:
    """Euclidean distance between two RGB tuples."""
    return sum((a - b) ** 2 for a, b in zip(rgb_a, rgb_b)) ** 0.5


def alpha_bbox(image: Image.Image, alpha_cutoff: int = 1) -> tuple[int, int, int, int] | None:
    """Return bounding box of opaque pixels, or None if empty."""
    width, height = image.size
    left = width
    top = height
    right = -1
    bottom = -1

    pixels = image.load()
    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] >= alpha_cutoff:
                if x < left:
                    left = x
                if y < top:
                    top = y
                if x > right:
                    right = x
                if y > bottom:
                    bottom = y

    if right < left or bottom < top:
        return None
    return (left, top, right + 1, bottom + 1)


def check_chroma_fringe(image: Image.Image, threshold: float = CHROMA_CHECK_THRESHOLD) -> list[dict]:
    """Check for residual chroma purple pixels in the image.

    Returns a list of findings (empty = pass).
    """
    pixels = image.load()
    width, height = image.size
    findings: list[dict] = []
    fringe_count = 0

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a > 0:
                dist = color_distance((r, g, b), CHROMA_RGB)
                if dist < threshold:
                    fringe_count += 1

    if fringe_count > 0:
        findings.append({
            "check": "chroma_fringe",
            "status": "fail",
            "fringe_pixels": fringe_count,
            "threshold": threshold,
            "message": f"Found {fringe_count} pixels with chroma purple residue",
        })

    return findings


def check_size(image: Image.Image) -> list[dict]:
    """Check image dimensions are 256x256."""
    findings: list[dict] = []
    if image.size != (EXPECTED_SIZE, EXPECTED_SIZE):
        findings.append({
            "check": "size",
            "status": "fail",
            "actual": list(image.size),
            "expected": [EXPECTED_SIZE, EXPECTED_SIZE],
            "message": f"Image size is {image.size[0]}x{image.size[1]}, expected {EXPECTED_SIZE}x{EXPECTED_SIZE}",
        })
    return findings


def check_alpha(image: Image.Image) -> list[dict]:
    """Check image has an alpha channel."""
    findings: list[dict] = []
    if image.mode != "RGBA":
        findings.append({
            "check": "alpha_channel",
            "status": "fail",
            "mode": image.mode,
            "message": f"Image mode is {image.mode}, expected RGBA",
        })
    return findings


def check_nonempty(image: Image.Image) -> list[dict]:
    """Check image has opaque pixels (not completely empty)."""
    findings: list[dict] = []
    bbox = alpha_bbox(image)
    if bbox is None:
        findings.append({
            "check": "nonempty",
            "status": "fail",
            "message": "Image has no opaque pixels",
        })
    else:
        pixels = image.load()
        w, h = image.size
        opaque = 0
        for y in range(h):
            for x in range(w):
                if pixels[x, y][3] > 0:
                    opaque += 1
        if opaque < MIN_OPAQUE_PIXELS:
            findings.append({
                "check": "nonempty",
                "status": "fail",
                "opaque_pixels": opaque,
                "minimum": MIN_OPAQUE_PIXELS,
                "message": f"Only {opaque} opaque pixels, minimum is {MIN_OPAQUE_PIXELS}",
            })
    return findings


def check_padding(image: Image.Image) -> list[dict]:
    """Warn if object is clipped or has excessive padding."""
    findings: list[dict] = []
    bbox = alpha_bbox(image)
    if bbox is None:
        return findings

    left, top, right, bottom = bbox
    w, h = image.size
    obj_w = right - left
    obj_h = bottom - top

    # Check for clipping at edges
    if left == 0 or top == 0 or right == w or bottom == h:
        findings.append({
            "check": "clipping",
            "status": "warn",
            "message": "Object touches the cell edge — may be clipped",
            "bbox": list(bbox),
        })

    # Check for excessive padding
    padding_ratio = 1.0 - (obj_w * obj_h) / (w * h)
    if padding_ratio > MAX_PADDING_RATIO:
        findings.append({
            "check": "excessive_padding",
            "status": "warn",
            "padding_ratio": round(padding_ratio, 3),
            "threshold": MAX_PADDING_RATIO,
            "message": f"Object occupies only {round(1.0 - padding_ratio, 3) * 100:.1f}% of cell — may be too small or misaligned",
        })

    return findings


def check_anchor(image: Image.Image) -> list[dict]:
    """Warn if the object's horizontal center deviates significantly from cell center."""
    findings: list[dict] = []
    bbox = alpha_bbox(image)
    if bbox is None:
        return findings

    left, top, right, bottom = bbox
    obj_center_x = (left + right) / 2.0
    cell_center_x = image.size[0] / 2.0
    deviation = abs(obj_center_x - cell_center_x) / image.size[0]

    if deviation > MAX_ANCHOR_X_DEVIATION:
        findings.append({
            "check": "anchor_deviation",
            "status": "warn",
            "deviation_ratio": round(deviation, 3),
            "threshold": MAX_ANCHOR_X_DEVIATION,
            "message": f"Object center deviates {deviation:.1%} from cell center horizontally",
        })

    return findings


def validate_file(filepath: Path) -> dict:
    """Run all validation checks on a single file."""
    try:
        raw_image = Image.open(filepath)
        original_mode = raw_image.mode
        image = raw_image.convert("RGBA")
    except Exception as exc:
        return {
            "file": filepath.name,
            "status": "error",
            "message": str(exc),
            "checks": [],
        }

    all_checks: list[dict] = []
    all_checks.extend(check_size(image))
    # Check original mode — RGB images lack a true alpha channel
    if original_mode != "RGBA":
        all_checks.append({
            "check": "alpha_channel",
            "status": "fail",
            "mode": original_mode,
            "message": f"Image mode is {original_mode}, expected RGBA (no alpha channel in source)",
        })
    all_checks.extend(check_nonempty(image))
    all_checks.extend(check_chroma_fringe(image))
    all_checks.extend(check_padding(image))
    all_checks.extend(check_anchor(image))

    has_fail = any(c["status"] == "fail" for c in all_checks)
    status = "fail" if has_fail else "pass"

    return {
        "file": filepath.name,
        "status": status,
        "checks": all_checks,
    }


def validate_directory(input_dir: Path, report_path: Path | None = None) -> dict:
    """Validate all PNG files in a directory."""
    png_files = sorted(input_dir.glob("*.png"))
    if not png_files:
        return {
            "input_dir": str(input_dir),
            "status": "error",
            "message": "No PNG files found",
            "files": [],
        }

    file_results = [validate_file(f) for f in png_files]
    total = len(file_results)
    passed = sum(1 for r in file_results if r["status"] == "pass")
    failed = total - passed

    overall_status = "pass" if failed == 0 else "fail"

    report = {
        "input_dir": str(input_dir),
        "status": overall_status,
        "total_files": total,
        "passed": passed,
        "failed": failed,
        "files": file_results,
    }

    if report_path is not None:
        report_path = Path(report_path)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        report["report_path"] = str(report_path)

    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate normalized asset outputs against the pipeline spec."
    )
    parser.add_argument("input_dir", type=Path,
                        help="Directory containing PNG files to validate.")
    parser.add_argument("--report", type=Path, default=None,
                        help="Path for JSON validation report (optional).")
    args = parser.parse_args()

    if not args.input_dir.is_dir():
        print(f"Error: input directory not found: {args.input_dir}", file=sys.stderr)
        sys.exit(1)

    report = validate_directory(args.input_dir, args.report)
    print(json.dumps(report, indent=2, ensure_ascii=False))

    if report["status"] != "pass":
        sys.exit(1)


if __name__ == "__main__":
    main()
