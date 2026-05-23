#!/usr/bin/env python3
"""Slice a sprite sheet with chroma purple background into normalized 256x256 transparent PNGs.

Reads a source image with bright chroma purple (#9900FF) background, slices it
into a grid of cells, removes the chroma to alpha, and outputs each cell as a
256x256 transparent PNG with bottom-center anchor alignment.

Usage:
    python3 tools/assets/normalize_asset_sheet.py source.png \
        --rows 3 --cols 4 --prefix mineral_small \
        --start-variant 1 --output-dir ./output

See tools/assets/README.md for full documentation.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

# Chroma purple: #9900FF = RGB(153, 0, 255)
CHROMA_RGB = (153, 0, 255)
DEFAULT_CELL_SIZE = 256
DEFAULT_CHROMA_THRESHOLD = 80.0
DEFAULT_ANCHOR_Y_RATIO = 0.88
DEFAULT_BOTTOM_PADDING = 8


def color_distance(rgb_a: tuple[int, int, int], rgb_b: tuple[int, int, int]) -> float:
    """Euclidean distance between two RGB tuples."""
    return sum((a - b) ** 2 for a, b in zip(rgb_a, rgb_b)) ** 0.5


def remove_chroma(image: Image.Image, chroma_rgb: tuple[int, int, int] = CHROMA_RGB,
                  threshold: float = DEFAULT_CHROMA_THRESHOLD) -> Image.Image:
    """Remove chroma key background, converting chroma pixels to transparent alpha.

    Pixels whose RGB color is within *threshold* Euclidean distance of the chroma
    color are set to fully transparent. Pixels near the threshold boundary receive
    proportional alpha based on their distance, which helps reduce fringe artifacts
    around the object edges.
    """
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    soft_min = threshold * 0.4

    for y in range(height):
        for x in range(width):
            r, g, b, _a = pixels[x, y]
            dist = color_distance((r, g, b), chroma_rgb)
            if dist <= soft_min:
                pixels[x, y] = (0, 0, 0, 0)
            elif dist <= threshold:
                alpha = round(((dist - soft_min) / (threshold - soft_min)) * 255)
                pixels[x, y] = (r, g, b, alpha)
            # else: keep original pixel (foreground)

    return rgba


def alpha_bbox(image: Image.Image, alpha_cutoff: int = 1) -> tuple[int, int, int, int] | None:
    """Return (left, top, right, bottom) bounding box of non-transparent pixels.

    Returns None if the image has no opaque pixels.
    """
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


def normalize_cell(cell: Image.Image, target_size: int = DEFAULT_CELL_SIZE,
                   anchor_y_ratio: float = DEFAULT_ANCHOR_Y_RATIO,
                   bottom_padding: int = DEFAULT_BOTTOM_PADDING) -> Image.Image:
    """Normalize a single cell to target_size x target_size with bottom-center anchor.

    The object is placed so its bottom edge sits at
    ``(target_size - bottom_padding)`` from the top, centered horizontally.
    If the object is larger than the cell, it is scaled down to fit with the
    bottom anchor preserved.
    """
    bbox = alpha_bbox(cell)
    if bbox is None:
        return Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))

    left, top, right, bottom = bbox
    cropped = cell.crop((left, top, right, bottom))
    obj_w, obj_h = cropped.size

    max_h = target_size - bottom_padding
    max_w = target_size

    scale = 1.0
    if obj_h > max_h:
        scale = min(scale, max_h / obj_h)
    if obj_w > max_w:
        scale = min(scale, max_w / obj_w)

    if scale < 1.0:
        new_w = max(1, round(obj_w * scale))
        new_h = max(1, round(obj_h * scale))
        cropped = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    else:
        new_w, new_h = obj_w, obj_h

    canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    dest_x = (target_size - new_w) // 2
    dest_y = target_size - bottom_padding - new_h
    canvas.alpha_composite(cropped, (dest_x, dest_y))
    return canvas


def slice_sheet(source: Image.Image, rows: int, cols: int,
                cell_w: int | None = None, cell_h: int | None = None) -> list[Image.Image]:
    """Slice source image into rows*cols cells in row-major order.

    If cell_w or cell_h is None, it is derived from the source image dimensions
    divided by cols or rows respectively.
    """
    src_w, src_h = source.size
    cw = cell_w if cell_w is not None else src_w // cols
    ch = cell_h if cell_h is not None else src_h // rows

    cells: list[Image.Image] = []
    for row in range(rows):
        for col in range(cols):
            box = (col * cw, row * ch, (col + 1) * cw, (row + 1) * ch)
            cells.append(source.crop(box))
    return cells


def format_variant(index: int, start_variant: int) -> str:
    """Format variant number as two-digit string.

    Example: start_variant=2, index=0 -> "02"
    """
    return f"{start_variant + index:02d}"


def process_sheet(
    source_path: Path,
    rows: int,
    cols: int,
    prefix: str,
    start_variant: int = 1,
    output_dir: Path = Path("."),
    cell_w: int | None = None,
    cell_h: int | None = None,
    target_size: int = DEFAULT_CELL_SIZE,
    chroma_threshold: float = DEFAULT_CHROMA_THRESHOLD,
    anchor_y_ratio: float = DEFAULT_ANCHOR_Y_RATIO,
    bottom_padding: int = DEFAULT_BOTTOM_PADDING,
    report_path: Path | None = None,
) -> dict:
    """Main processing pipeline: load, slice, remove chroma, normalize, save."""
    source = Image.open(source_path).convert("RGBA")
    cells = slice_sheet(source, rows, cols, cell_w, cell_h)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict] = []
    output_files: list[str] = []

    for idx, cell in enumerate(cells):
        cleaned = remove_chroma(cell, CHROMA_RGB, chroma_threshold)
        normalized = normalize_cell(cleaned, target_size, anchor_y_ratio, bottom_padding)

        variant_str = format_variant(idx, start_variant)
        filename = f"{prefix}_{variant_str}.png"
        filepath = output_dir / filename
        normalized.save(filepath, "PNG")
        output_files.append(filename)

        cell_bbox = alpha_bbox(normalized)
        has_content = cell_bbox is not None

        results.append({
            "index": idx,
            "filename": filename,
            "has_content": has_content,
            "bbox": list(cell_bbox) if cell_bbox else None,
        })

    report = {
        "source": str(source_path),
        "source_size": list(source.size),
        "rows": rows,
        "cols": cols,
        "prefix": prefix,
        "start_variant": start_variant,
        "target_size": target_size,
        "chroma_threshold": chroma_threshold,
        "anchor_y_ratio": anchor_y_ratio,
        "bottom_padding": bottom_padding,
        "output_dir": str(output_dir),
        "output_files": output_files,
        "cells": results,
        "total_cells": len(cells),
        "cells_with_content": sum(1 for r in results if r["has_content"]),
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
        description="Slice a chroma-purple sprite sheet into normalized 256x256 transparent PNGs."
    )
    parser.add_argument("source", type=Path, help="Path to source sprite sheet PNG.")
    parser.add_argument("--rows", type=int, required=True, help="Number of rows in the sheet grid.")
    parser.add_argument("--cols", type=int, required=True, help="Number of columns in the sheet grid.")
    parser.add_argument("--prefix", type=str, required=True,
                        help="Output filename prefix, e.g. 'mineral_small'.")
    parser.add_argument("--start-variant", type=int, default=1,
                        help="Starting variant number (default: 1).")
    parser.add_argument("--output-dir", type=Path, default=Path("."),
                        help="Directory for output PNGs (default: current dir).")
    parser.add_argument("--cell-width", type=int, default=None,
                        help="Cell width in pixels (default: source_width / cols).")
    parser.add_argument("--cell-height", type=int, default=None,
                        help="Cell height in pixels (default: source_height / rows).")
    parser.add_argument("--target-size", type=int, default=DEFAULT_CELL_SIZE,
                        help="Output cell size in pixels (default: 256).")
    parser.add_argument("--chroma-threshold", type=float, default=DEFAULT_CHROMA_THRESHOLD,
                        help="Color distance threshold for chroma removal (default: 80).")
    parser.add_argument("--anchor-y-ratio", type=float, default=DEFAULT_ANCHOR_Y_RATIO,
                        help="Vertical anchor ratio within cell (default: 0.88).")
    parser.add_argument("--bottom-padding", type=int, default=DEFAULT_BOTTOM_PADDING,
                        help="Pixels of padding from bottom edge (default: 8).")
    parser.add_argument("--report", type=Path, default=None,
                        help="Path for JSON report output (optional).")
    args = parser.parse_args()

    if not args.source.exists():
        print(f"Error: source file not found: {args.source}", file=sys.stderr)
        sys.exit(1)

    report = process_sheet(
        source_path=args.source,
        rows=args.rows,
        cols=args.cols,
        prefix=args.prefix,
        start_variant=args.start_variant,
        output_dir=args.output_dir,
        cell_w=args.cell_width,
        cell_h=args.cell_height,
        target_size=args.target_size,
        chroma_threshold=args.chroma_threshold,
        anchor_y_ratio=args.anchor_y_ratio,
        bottom_padding=args.bottom_padding,
        report_path=args.report,
    )

    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
