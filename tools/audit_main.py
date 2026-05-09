from __future__ import annotations

from datetime import datetime
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
MAIN_JS = ROOT / "src" / "main.js"
REPORT_DIR = ROOT / "_reports" / "audit"
REPORT_FILE = REPORT_DIR / "main_audit.txt"

ZONE_KEYWORDS = {
    "render": ["draw", "render", "sprite", "canvas", "fog"],
    "movement": ["updateUnitMovement", "move", "velocity", "target", "waypoint"],
    "builder": ["builder", "build", "construction", "footprint"],
    "harvester": ["harvester", "mine", "mineral", "cargo"],
    "pathfinding": ["findPath", "path", "passable", "blocked"],
    "economy": ["resource", "energy", "production", "storage", "separator"],
    "territory": ["territory", "claim", "owned", "radius"],
    "fog": ["fog", "visible", "reveal", "vision"],
    "save/load": ["save", "load", "autosave", "localStorage"],
    "input": ["mousedown", "mouseup", "mousemove", "keydown", "click"],
    "UI": ["menu", "screen", "toast", "hud", "modal", "button"],
    "debug": ["debug", "snapshot", "diagnose", "trace", "log"],
}


def safe_print(message: str) -> None:
    try:
        print(message)
    except UnicodeEncodeError:
        print(message.encode("utf-8", errors="replace").decode("utf-8"))


def count_matches(lines: list[str], pattern: str) -> int:
    regex = re.compile(pattern)
    return sum(1 for line in lines if regex.search(line))


def find_zone(lines: list[str], keywords: list[str]) -> tuple[int | None, int | None, int]:
    hits: list[int] = []
    lowered = [line.lower() for line in lines]
    for index, line in enumerate(lowered, start=1):
        if any(keyword.lower() in line for keyword in keywords):
            hits.append(index)
    if not hits:
        return None, None, 0
    return hits[0], hits[-1], len(hits)


def build_report(text: str) -> str:
    lines = text.splitlines()
    size_kb = MAIN_JS.stat().st_size / 1024
    metrics = {
        "line_count": len(lines),
        "size_kb": f"{size_kb:.2f}",
        "function_declarations": count_matches(lines, r"\bfunction\b"),
        "arrow_functions": count_matches(lines, r"=>"),
        "lines_with_draw": count_matches(lines, r"draw"),
        "lines_with_update": count_matches(lines, r"update"),
        "lines_with_builder": count_matches(lines, r"builder"),
        "lines_with_harvester": count_matches(lines, r"harvester"),
        "lines_with_path": count_matches(lines, r"path"),
        "lines_with_save": count_matches(lines, r"save"),
        "lines_with_debug": count_matches(lines, r"debug"),
    }

    zone_lines: list[str] = []
    for zone_name, keywords in ZONE_KEYWORDS.items():
        first, last, hits = find_zone(lines, keywords)
        if first is None:
            zone_lines.append(f"- {zone_name}: not found")
        else:
            zone_lines.append(
                f"- {zone_name}: lines {first}-{last} ({hits} matching lines)"
            )

    conclusions: list[str] = []
    if metrics["line_count"] > 3000:
        conclusions.append("main.js remains large and worth auditing before any refactor.")
    if metrics["lines_with_debug"] > 50:
        conclusions.append("debug-related logic is still spread across many lines.")
    if metrics["lines_with_builder"] > 50 and metrics["lines_with_harvester"] > 50:
        conclusions.append("builder and harvester logic both appear substantial inside main.js.")
    if not conclusions:
        conclusions.append("No obvious red flags from keyword density alone.")

    report_lines = [
        "Four Elements main.js audit",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Path: {MAIN_JS}",
        "",
        "Metrics:",
    ]
    report_lines.extend([f"- {key}: {value}" for key, value in metrics.items()])
    report_lines.extend(["", "Detected zones:"])
    report_lines.extend(zone_lines)
    report_lines.extend(["", "Short conclusion:"])
    report_lines.extend([f"- {line}" for line in conclusions])
    return "\n".join(report_lines) + "\n"


def main() -> int:
    if not MAIN_JS.exists():
        safe_print(f"[ERROR] main.js not found: {MAIN_JS}")
        safe_print("Run this script from the Four Elements project root layout.")
        return 1

    try:
        text = MAIN_JS.read_text(encoding="utf-8", errors="ignore")
        report = build_report(text)
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        REPORT_FILE.write_text(report, encoding="utf-8")
        safe_print(report.rstrip())
        safe_print("")
        safe_print(f"[OK] Report saved to: {REPORT_FILE}")
        return 0
    except Exception as exc:  # noqa: BLE001
        safe_print(f"[ERROR] Failed to audit main.js: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
