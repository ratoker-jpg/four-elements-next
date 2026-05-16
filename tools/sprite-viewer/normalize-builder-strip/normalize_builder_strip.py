from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

from PIL import Image


FRAME_COUNT = 8
BACKGROUND_SWATCHES = ((243, 243, 243), (247, 247, 247), (254, 254, 254))
ALPHA_SOFT_MIN = 8.0
ALPHA_SOFT_MAX = 26.0
BBOX_MARGIN = 3
EDGE_NEIGHBOR_RADIUS = 2
SOURCE_COMPONENT_MIN_AREA = 5000
DEFAULT_CELL_SIZE = 256
DEFAULT_ANCHOR_X_RATIO = 0.5
DEFAULT_ANCHOR_Y_RATIO = 0.84
DEFAULT_FILL_WIDTH_RATIO = 0.72
DEFAULT_SAFE_MARGIN = 6
SCALE_STEP = 0.02
MIN_SCALE_FACTOR = 0.68


def clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, value))


def color_distance(pixel: tuple[int, int, int], swatch: tuple[int, int, int]) -> float:
    return sum((pixel[index] - swatch[index]) ** 2 for index in range(3)) ** 0.5


def nearest_background(pixel: tuple[int, int, int]) -> tuple[tuple[int, int, int], float]:
    distances = [(swatch, color_distance(pixel, swatch)) for swatch in BACKGROUND_SWATCHES]
    return min(distances, key=lambda item: item[1])


def alpha_from_distance(distance: float) -> int:
    if distance <= ALPHA_SOFT_MIN:
        return 0
    if distance >= ALPHA_SOFT_MAX:
        return 255
    ratio = (distance - ALPHA_SOFT_MIN) / (ALPHA_SOFT_MAX - ALPHA_SOFT_MIN)
    return max(0, min(255, round(ratio * 255)))


def unblend_channel(channel: int, background: int, alpha: int) -> int:
    if alpha <= 0:
        return 0
    alpha_ratio = alpha / 255.0
    value = (channel - ((1.0 - alpha_ratio) * background)) / alpha_ratio
    return max(0, min(255, round(value)))


def pixel_to_rgba(pixel: tuple[int, int, int]) -> tuple[int, int, int, int]:
    background, distance = nearest_background(pixel)
    alpha = alpha_from_distance(distance)
    if alpha == 0:
        return (0, 0, 0, 0)
    red = unblend_channel(pixel[0], background[0], alpha)
    green = unblend_channel(pixel[1], background[1], alpha)
    blue = unblend_channel(pixel[2], background[2], alpha)
    return (red, green, blue, alpha)


def is_hard_foreground(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    luma = (red + green + blue) / 3.0
    chroma = max(pixel) - min(pixel)
    return luma < 236.0 or chroma > 12


def hard_mask(image: Image.Image) -> list[list[bool]]:
    return [[is_hard_foreground(image.getpixel((x, y))) for x in range(image.width)] for y in range(image.height)]


def has_hard_neighbor(mask: list[list[bool]], x: int, y: int) -> bool:
    height = len(mask)
    width = len(mask[0]) if height else 0
    for y_offset in range(-EDGE_NEIGHBOR_RADIUS, EDGE_NEIGHBOR_RADIUS + 1):
        ny = y + y_offset
        if ny < 0 or ny >= height:
            continue
        for x_offset in range(-EDGE_NEIGHBOR_RADIUS, EDGE_NEIGHBOR_RADIUS + 1):
            nx = x + x_offset
            if nx < 0 or nx >= width:
                continue
            if mask[ny][nx]:
                return True
    return False


def rgb_frame_to_rgba(image: Image.Image) -> Image.Image:
    mask = hard_mask(image)
    rgba = Image.new("RGBA", image.size, (0, 0, 0, 0))
    for y in range(image.height):
        for x in range(image.width):
            pixel = image.getpixel((x, y))
            alpha_pixel = pixel_to_rgba(pixel)
            if mask[y][x]:
                rgba.putpixel((x, y), alpha_pixel)
                continue
            if alpha_pixel[3] > 0 and has_hard_neighbor(mask, x, y):
                rgba.putpixel((x, y), alpha_pixel)
    return rgba


def alpha_bbox(image: Image.Image, alpha_cutoff: int = 1) -> tuple[int, int, int, int]:
    width, height = image.size
    left = width
    top = height
    right = -1
    bottom = -1
    for y in range(height):
        for x in range(width):
            if image.getpixel((x, y))[3] >= alpha_cutoff:
                if x < left:
                    left = x
                if y < top:
                    top = y
                if x > right:
                    right = x
                if y > bottom:
                    bottom = y
    if right < left or bottom < top:
        raise ValueError("No foreground pixels detected after alpha extraction.")
    return (left, top, right + 1, bottom + 1)


def bottom_anchor_x(image: Image.Image, sample_depth: int = 20, alpha_cutoff: int = 20) -> float:
    width, height = image.size
    x_values: list[int] = []
    for y in range(max(0, height - sample_depth), height):
        for x in range(width):
            if image.getpixel((x, y))[3] >= alpha_cutoff:
                x_values.append(x)
    if not x_values:
        return width / 2.0
    return sum(x_values) / len(x_values)


def find_foreground_components(mask: list[list[bool]], min_area: int) -> list[tuple[int, int, int, int, int]]:
    height = len(mask)
    width = len(mask[0]) if height else 0
    visited = [[False] * width for _ in range(height)]
    components: list[tuple[int, int, int, int, int]] = []

    for y in range(height):
        for x in range(width):
            if not mask[y][x] or visited[y][x]:
                continue

            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[y][x] = True
            left = right = x
            top = bottom = y
            area = 0

            while queue:
                current_x, current_y = queue.popleft()
                area += 1
                if current_x < left:
                    left = current_x
                if current_x > right:
                    right = current_x
                if current_y < top:
                    top = current_y
                if current_y > bottom:
                    bottom = current_y

                for next_x, next_y in (
                    (current_x + 1, current_y),
                    (current_x - 1, current_y),
                    (current_x, current_y + 1),
                    (current_x, current_y - 1),
                ):
                    if 0 <= next_x < width and 0 <= next_y < height and mask[next_y][next_x] and not visited[next_y][next_x]:
                        visited[next_y][next_x] = True
                        queue.append((next_x, next_y))

            if area >= min_area:
                components.append((left, top, right + 1, bottom + 1, area))

    components.sort(key=lambda item: item[0])
    return components


def expand_bbox(bbox: tuple[int, int, int, int], width: int, height: int, margin: int) -> tuple[int, int, int, int]:
    left, top, right, bottom = bbox
    return (
        max(0, left - margin),
        max(0, top - margin),
        min(width, right + margin),
        min(height, bottom + margin),
    )


def extract_frames(source: Image.Image) -> tuple[list[Image.Image], int, int]:
    mask = hard_mask(source)
    components = find_foreground_components(mask, SOURCE_COMPONENT_MIN_AREA)
    if not components:
        raise ValueError("Could not find Builder components in the source strip.")

    frames: list[Image.Image] = []
    for left, top, right, bottom, _area in components[:FRAME_COUNT]:
        source_bbox = expand_bbox((left, top, right, bottom), source.width, source.height, BBOX_MARGIN)
        rgba = rgb_frame_to_rgba(source.crop(source_bbox))
        tight_bbox = alpha_bbox(rgba, alpha_cutoff=20)
        frames.append(rgba.crop(tight_bbox))

    source_component_count = len(frames)
    duplicated_frame_count = 0
    while len(frames) < FRAME_COUNT:
        frames.append(frames[-1].copy())
        duplicated_frame_count += 1

    return frames, source_component_count, duplicated_frame_count


def build_sheet(
    frames: list[Image.Image],
    scale: float,
    cell_size: int,
    anchor_x: int,
    anchor_y: int,
    safe_margin: int,
) -> tuple[Image.Image, list[tuple[int, int]]]:
    sheet = Image.new("RGBA", (cell_size * FRAME_COUNT, cell_size), (0, 0, 0, 0))
    normalized_sizes: list[tuple[int, int]] = []

    for frame_index, frame in enumerate(frames):
        scaled_width = max(1, round(frame.width * scale))
        scaled_height = max(1, round(frame.height * scale))
        resized = frame.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)
        normalized_sizes.append((scaled_width, scaled_height))

        scaled_anchor_x = bottom_anchor_x(frame) * scale
        dest_x = round(anchor_x - scaled_anchor_x)
        dest_x = clamp(dest_x, safe_margin, cell_size - safe_margin - scaled_width)
        dest_y = clamp(anchor_y - scaled_height, safe_margin, cell_size - safe_margin - scaled_height)

        cell = Image.new("RGBA", (cell_size, cell_size), (0, 0, 0, 0))
        cell.alpha_composite(resized, (dest_x, dest_y))
        sheet.alpha_composite(cell, (frame_index * cell_size, 0))

    return sheet, normalized_sizes


def validate_sheet(sheet: Image.Image, cell_size: int, safe_margin: int) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for frame_index in range(FRAME_COUNT):
        cell = sheet.crop((frame_index * cell_size, 0, (frame_index + 1) * cell_size, cell_size))
        bbox = alpha_bbox(cell, alpha_cutoff=1)
        left, top, right, bottom = bbox
        margins = {
            "left": left,
            "top": top,
            "right": cell_size - right,
            "bottom": cell_size - bottom,
        }
        results.append(
            {
                "frame": frame_index,
                "bbox": [left, top, right, bottom],
                "margins": margins,
                "pass": all(value >= safe_margin for value in margins.values()),
            }
        )
    return results


def choose_scale(
    frames: list[Image.Image],
    cell_size: int,
    anchor_x_ratio: float,
    anchor_y_ratio: float,
    fill_width_ratio: float,
    safe_margin: int,
) -> tuple[Image.Image, list[tuple[int, int]], float, list[dict[str, object]], bool]:
    anchor_x = round(cell_size * anchor_x_ratio)
    anchor_y = round(cell_size * anchor_y_ratio)
    max_frame_width = round(cell_size * fill_width_ratio)
    max_frame_height = anchor_y - safe_margin
    max_width = max(frame.width for frame in frames)
    max_height = max(frame.height for frame in frames)
    base_scale = min(max_frame_width / max_width, max_frame_height / max_height)

    best_sheet: Image.Image | None = None
    best_sizes: list[tuple[int, int]] = []
    best_scale = base_scale
    best_validation: list[dict[str, object]] = []
    validation_passed = False

    scale_factor = 1.0
    while scale_factor >= MIN_SCALE_FACTOR:
        scale = base_scale * scale_factor
        sheet, normalized_sizes = build_sheet(frames, scale, cell_size, anchor_x, anchor_y, safe_margin)
        validation = validate_sheet(sheet, cell_size, safe_margin)
        best_sheet = sheet
        best_sizes = normalized_sizes
        best_scale = scale
        best_validation = validation
        if all(item["pass"] for item in validation):
            validation_passed = True
            break
        scale_factor -= SCALE_STEP

    if best_sheet is None:
        raise ValueError("Could not build a sprite sheet from the provided frames.")

    return best_sheet, best_sizes, best_scale, best_validation, validation_passed


def normalize_strip(
    source_path: Path,
    output_path: Path,
    cell_size: int,
    anchor_x_ratio: float,
    anchor_y_ratio: float,
    fill_width_ratio: float,
    safe_margin: int,
) -> dict[str, object]:
    source = Image.open(source_path).convert("RGB")
    frames, source_component_count, duplicated_frame_count = extract_frames(source)

    sheet, normalized_sizes, scale, validation, validation_passed = choose_scale(
        frames,
        cell_size,
        anchor_x_ratio,
        anchor_y_ratio,
        fill_width_ratio,
        safe_margin,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)

    alpha_bytes = sheet.getchannel("A").tobytes()
    transparent_pixels = sum(1 for alpha in alpha_bytes if alpha == 0)
    opaque_pixels = len(alpha_bytes) - transparent_pixels

    return {
        "source_size": source.size,
        "source_component_count": source_component_count,
        "duplicated_frame_count": duplicated_frame_count,
        "raw_frame_sizes": [(frame.width, frame.height) for frame in frames],
        "normalized_sizes": normalized_sizes,
        "sheet_size": sheet.size,
        "cell_size": cell_size,
        "anchor": [round(cell_size * anchor_x_ratio), round(cell_size * anchor_y_ratio)],
        "fill_width_ratio": fill_width_ratio,
        "safe_margin": safe_margin,
        "transparent_pixels": transparent_pixels,
        "opaque_pixels": opaque_pixels,
        "has_alpha": "A" in sheet.getbands(),
        "scale": scale,
        "validation_passed": validation_passed,
        "frame_validations": validation,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize Builder strip art into a single-row sprite sheet.")
    parser.add_argument("source", type=Path, help="Path to the raw Builder strip PNG.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("tools/sprite-viewer/samples/builder_poc_2048x256.png"),
        help="Output path for the normalized sprite sheet PNG.",
    )
    parser.add_argument("--cell-size", type=int, default=DEFAULT_CELL_SIZE, help="Cell size for each frame.")
    parser.add_argument(
        "--anchor-x-ratio",
        type=float,
        default=DEFAULT_ANCHOR_X_RATIO,
        help="Horizontal anchor ratio within each cell.",
    )
    parser.add_argument(
        "--anchor-y-ratio",
        type=float,
        default=DEFAULT_ANCHOR_Y_RATIO,
        help="Vertical anchor ratio within each cell.",
    )
    parser.add_argument(
        "--fill-width-ratio",
        type=float,
        default=DEFAULT_FILL_WIDTH_RATIO,
        help="Approximate fraction of cell width that the widest frame should occupy.",
    )
    parser.add_argument(
        "--safe-margin",
        type=int,
        default=DEFAULT_SAFE_MARGIN,
        help="Minimum transparent margin required around each cell.",
    )
    args = parser.parse_args()

    summary = normalize_strip(
        args.source,
        args.output,
        args.cell_size,
        args.anchor_x_ratio,
        args.anchor_y_ratio,
        args.fill_width_ratio,
        args.safe_margin,
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
