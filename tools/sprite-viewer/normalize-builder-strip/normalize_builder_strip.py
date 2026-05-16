from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


CELL_SIZE = 128
FRAME_COUNT = 8
ANCHOR_X = 64
ANCHOR_Y = 108
MAX_FRAME_WIDTH = 112
MAX_FRAME_HEIGHT = 104
BOUNDARY_WINDOW = 90
BACKGROUND_SWATCHES = ((243, 243, 243), (254, 254, 254))
ALPHA_SOFT_MIN = 8.0
ALPHA_SOFT_MAX = 26.0
BBOX_MARGIN = 3
EDGE_NEIGHBOR_RADIUS = 2


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


def detect_split_bounds(image: Image.Image) -> list[int]:
    width, height = image.size
    column_scores: list[int] = []
    for x in range(width):
        score = 0
        for y in range(height):
            if is_hard_foreground(image.getpixel((x, y))):
                score += 1
        column_scores.append(score)

    bounds = [0]
    for index in range(1, FRAME_COUNT):
        target = round(width * index / FRAME_COUNT)
        lower = max(0, target - BOUNDARY_WINDOW)
        upper = min(width - 1, target + BOUNDARY_WINDOW)
        best_x = min(range(lower, upper + 1), key=lambda value: column_scores[value])
        bounds.append(best_x)
    bounds.append(width)
    return bounds


def hard_foreground_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    width, height = image.size
    left = width
    top = height
    right = -1
    bottom = -1
    for y in range(height):
        for x in range(width):
            if is_hard_foreground(image.getpixel((x, y))):
                if x < left:
                    left = x
                if y < top:
                    top = y
                if x > right:
                    right = x
                if y > bottom:
                    bottom = y
    if right < left or bottom < top:
        raise ValueError("No foreground pixels detected after checkerboard removal.")
    return (
        max(0, left - BBOX_MARGIN),
        max(0, top - BBOX_MARGIN),
        min(width, right + 1 + BBOX_MARGIN),
        min(height, bottom + 1 + BBOX_MARGIN),
    )


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


def normalize_strip(source_path: Path, output_path: Path) -> dict[str, object]:
    source = Image.open(source_path).convert("RGB")
    bounds = detect_split_bounds(source)

    raw_frames: list[Image.Image] = []
    bboxes: list[tuple[int, int, int, int]] = []
    anchor_x_values: list[float] = []

    for frame_index in range(FRAME_COUNT):
        frame = source.crop((bounds[frame_index], 0, bounds[frame_index + 1], source.height))
        bbox = hard_foreground_bbox(frame)
        cropped = rgb_frame_to_rgba(frame.crop(bbox))
        raw_frames.append(cropped)
        bboxes.append(bbox)
        anchor_x_values.append(bottom_anchor_x(cropped))

    max_width = max(frame.width for frame in raw_frames)
    max_height = max(frame.height for frame in raw_frames)
    scale = min(MAX_FRAME_WIDTH / max_width, MAX_FRAME_HEIGHT / max_height)

    sheet = Image.new("RGBA", (CELL_SIZE * FRAME_COUNT, CELL_SIZE), (0, 0, 0, 0))
    normalized_sizes: list[tuple[int, int]] = []
    for frame_index, frame in enumerate(raw_frames):
        scaled_width = max(1, round(frame.width * scale))
        scaled_height = max(1, round(frame.height * scale))
        resized = frame.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)
        normalized_sizes.append((scaled_width, scaled_height))

        scaled_anchor_x = anchor_x_values[frame_index] * scale
        cell = Image.new("RGBA", (CELL_SIZE, CELL_SIZE), (0, 0, 0, 0))
        dest_x = round(ANCHOR_X - scaled_anchor_x)
        dest_y = ANCHOR_Y - scaled_height
        cell.alpha_composite(resized, (dest_x, dest_y))
        sheet.alpha_composite(cell, (frame_index * CELL_SIZE, 0))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)

    transparent_pixels = 0
    opaque_pixels = 0
    alpha_bytes = sheet.getchannel("A").tobytes()
    for alpha in alpha_bytes:
        if alpha == 0:
            transparent_pixels += 1
        else:
            opaque_pixels += 1

    return {
        "source_size": source.size,
        "split_bounds": bounds,
        "raw_frame_sizes": [(frame.width, frame.height) for frame in raw_frames],
        "normalized_sizes": normalized_sizes,
        "sheet_size": sheet.size,
        "transparent_pixels": transparent_pixels,
        "opaque_pixels": opaque_pixels,
        "has_alpha": "A" in sheet.getbands(),
        "scale": scale,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize an 8-frame Builder strip into a 1024x128 sprite sheet.")
    parser.add_argument("source", type=Path, help="Path to the raw Builder strip PNG.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("tools/sprite-viewer/samples/builder_poc_1024x128.png"),
        help="Output path for the normalized sprite sheet PNG.",
    )
    args = parser.parse_args()

    summary = normalize_strip(args.source, args.output)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
