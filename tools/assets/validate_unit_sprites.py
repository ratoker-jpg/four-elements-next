from __future__ import annotations

from datetime import datetime
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
REPORT_DIR = ROOT / "_reports" / "assets"


def safe_print(message: str) -> None:
    try:
        print(message)
    except UnicodeEncodeError:
        print(message.encode("utf-8", errors="replace").decode("utf-8"))


def usage() -> str:
    return (
        "Usage:\n"
        "  py tools\\assets\\validate_unit_sprites.py <folder>\n\n"
        "Example:\n"
        "  py tools\\assets\\validate_unit_sprites.py assets\\factions\\green\\units\\builder_8dirs"
    )


def detect_expected_idle_files(folder: Path, png_names: set[str]) -> list[str]:
    if not folder.name.endswith("_8dirs"):
        return []
    unit_name = folder.name.removesuffix("_8dirs")
    expected = [f"{unit_name}_idle_dir{i}_0.png" for i in range(8)]
    return [name for name in expected if name not in png_names]


def make_report_name(folder: Path) -> Path:
    parts = folder.parts
    report_base = folder.name
    try:
        factions_index = parts.index("factions")
        if len(parts) > factions_index + 3 and parts[factions_index + 2] == "units":
            faction_name = parts[factions_index + 1]
            report_base = f"{faction_name}_{folder.name}"
    except ValueError:
        pass

    report_name = f"validate_unit_sprites_{report_base}.txt"
    return REPORT_DIR / report_name


def validate(folder: Path) -> tuple[int, str]:
    try:
        from PIL import Image
    except ModuleNotFoundError:
        message = (
            "[ERROR] Pillow is required for PNG validation.\n"
            "Install Pillow: py -m pip install pillow\n"
        )
        return 1, message

    if not folder.exists():
        return 1, f"[ERROR] Folder not found: {folder}\n"
    if not folder.is_dir():
        return 1, f"[ERROR] Path is not a folder: {folder}\n"

    png_files = sorted(folder.glob("*.png"))
    if not png_files:
        return 1, f"[ERROR] No PNG files found in: {folder}\n"

    warnings: list[str] = []
    failures: list[str] = []
    sizes: list[str] = []
    png_names = {path.name for path in png_files}
    missing_idle = detect_expected_idle_files(folder, png_names)
    if missing_idle:
        warnings.append("Missing expected idle frames:")
        warnings.extend([f"  - {name}" for name in missing_idle])

    edge_threshold = 1
    for png_path in png_files:
        try:
            with Image.open(png_path) as image:
                rgba = image.convert("RGBA")
                alpha = rgba.getchannel("A")
                bbox = alpha.getbbox()
                alpha_min, alpha_max = alpha.getextrema()
                width, height = rgba.size
                sizes.append(f"- {png_path.name}: {width}x{height}")

                if bbox is None:
                    failures.append(f"{png_path.name}: fully empty alpha image")
                    continue

                if alpha_max == 0:
                    failures.append(f"{png_path.name}: alpha channel is fully transparent")
                if alpha_min == 255 and alpha_max == 255:
                    warnings.append(f"{png_path.name}: fully opaque across the whole canvas")

                left, top, right, bottom = bbox
                warnings_bbox: list[str] = []
                if left <= edge_threshold:
                    warnings_bbox.append("left")
                if top <= edge_threshold:
                    warnings_bbox.append("top")
                if (width - right) <= edge_threshold:
                    warnings_bbox.append("right")
                if (height - bottom) <= edge_threshold:
                    warnings_bbox.append("bottom")
                if warnings_bbox:
                    warnings.append(
                        f"{png_path.name}: bbox is very close to edges ({', '.join(warnings_bbox)}) -> {bbox}"
                    )
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{png_path.name}: failed to inspect ({exc})")

    unique_sizes = sorted({entry.split(": ", 1)[1] for entry in sizes})
    if len(unique_sizes) > 1:
        warnings.append("PNG sizes are not identical across all frames.")

    status = "PASS"
    if failures:
        status = "FAIL"
    elif warnings:
        status = "WARN"

    report_lines = [
        "Four Elements unit sprite validation",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Folder: {folder}",
        f"PNG count: {len(png_files)}",
        "",
        "Sizes:",
    ]
    report_lines.extend(sizes)
    report_lines.extend(["", "Unique sizes:"])
    report_lines.extend([f"- {size}" for size in unique_sizes])
    report_lines.extend(["", "Missing expected idle frames:"])
    if missing_idle:
        report_lines.extend([f"- {name}" for name in missing_idle])
    else:
        report_lines.append("- none")
    report_lines.extend(["", "Warnings:"])
    report_lines.extend([f"- {line}" for line in warnings] if warnings else ["- none"])
    report_lines.extend(["", "Failures:"])
    report_lines.extend([f"- {line}" for line in failures] if failures else ["- none"])
    report_lines.extend(["", f"Status: {status}"])
    return 0 if status != "FAIL" else 1, "\n".join(report_lines) + "\n"


def main() -> int:
    if len(sys.argv) < 2:
        safe_print(usage())
        return 1

    folder = Path(sys.argv[1])
    if not folder.is_absolute():
        folder = (ROOT / folder).resolve()

    code, report = validate(folder)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = make_report_name(folder)
    report_path.write_text(report, encoding="utf-8")
    safe_print(report.rstrip())
    safe_print("")
    safe_print(f"[OK] Report saved to: {report_path}")
    return code


if __name__ == "__main__":
    sys.exit(main())
