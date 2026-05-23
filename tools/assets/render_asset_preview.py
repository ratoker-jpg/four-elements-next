#!/usr/bin/env python3
"""Render a contact/preview sheet from a directory of normalized PNGs.

Reads all PNG files from an input directory, sorts them by filename, and
arranges them into a grid on a single output image. Optional labels show
the filename below each sprite.

Usage:
    python3 tools/assets/render_asset_preview.py ./output --output preview.png
    python3 tools/assets/render_asset_preview.py ./output --output preview.png --labels

See tools/assets/README.md for full documentation.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DEFAULT_CELL = 256
DEFAULT_COLS = 8
LABEL_HEIGHT = 20
BG_COLOR = (48, 48, 48)
LABEL_COLOR = (200, 200, 200)
GRID_COLOR = (80, 80, 80)


def render_preview(
    input_dir: Path,
    output_path: Path,
    cols: int = DEFAULT_COLS,
    cell_size: int = DEFAULT_CELL,
    labels: bool = False,
) -> dict:
    """Render a contact sheet from PNGs in input_dir."""
    png_files = sorted(input_dir.glob("*.png"))
    if not png_files:
        print(f"No PNG files found in {input_dir}", file=sys.stderr)
        return {"error": "no_png_files", "input_dir": str(input_dir)}

    count = len(png_files)
    rows = math.ceil(count / cols)
    cell_h = cell_size + (LABEL_HEIGHT if labels else 0)
    sheet_w = cols * cell_size
    sheet_h = rows * cell_h

    sheet = Image.new("RGBA", (sheet_w, sheet_h), (*BG_COLOR, 255))
    draw = ImageDraw.Draw(sheet)

    # Draw grid lines
    for col in range(cols + 1):
        x = col * cell_size
        draw.line([(x, 0), (x, sheet_h)], fill=GRID_COLOR, width=1)
    for row in range(rows + 1):
        y = row * cell_h
        draw.line([(0, y), (sheet_w, y)], fill=GRID_COLOR, width=1)

    # Try to load a font for labels; fall back to default
    label_font = None
    if labels:
        try:
            label_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        except (OSError, IOError):
            label_font = ImageFont.load_default()

    for idx, png_path in enumerate(png_files):
        col = idx % cols
        row = idx // cols
        x = col * cell_size
        y = row * cell_h

        try:
            img = Image.open(png_path).convert("RGBA")
            if img.size != (cell_size, cell_size):
                img = img.resize((cell_size, cell_size), Image.Resampling.LANCZOS)
            sheet.alpha_composite(img, (x, y))
        except Exception as exc:
            print(f"Warning: could not load {png_path}: {exc}", file=sys.stderr)

        if labels and label_font is not None:
            name = png_path.stem
            draw.text((x + 4, y + cell_size + 2), name, fill=LABEL_COLOR, font=label_font)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output_path, "PNG")

    return {
        "input_dir": str(input_dir),
        "output": str(output_path),
        "files_count": count,
        "cols": cols,
        "rows": rows,
        "cell_size": cell_size,
        "sheet_size": list(sheet.size),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render a contact/preview sheet from a directory of PNGs."
    )
    parser.add_argument("input_dir", type=Path,
                        help="Directory containing normalized PNG files.")
    parser.add_argument("--output", type=Path, default=Path("preview.png"),
                        help="Output path for the preview sheet (default: preview.png).")
    parser.add_argument("--cols", type=int, default=DEFAULT_COLS,
                        help="Number of columns in the preview grid (default: 8).")
    parser.add_argument("--cell-size", type=int, default=DEFAULT_CELL,
                        help="Cell size in pixels (default: 256).")
    parser.add_argument("--labels", action="store_true",
                        help="Show filenames below each sprite.")
    args = parser.parse_args()

    if not args.input_dir.is_dir():
        print(f"Error: input directory not found: {args.input_dir}", file=sys.stderr)
        sys.exit(1)

    result = render_preview(args.input_dir, args.output, args.cols, args.cell_size, args.labels)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
