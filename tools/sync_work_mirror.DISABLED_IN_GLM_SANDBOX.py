from __future__ import annotations

import datetime as dt
import hashlib
import os
from pathlib import Path
import shutil
import sys

MIRROR_FOLDER_NAME = "FourElements_WORK_MIRROR"

ROOT_REQUIRED = ["src", "index.html", "AGENTS.md", "01_BUILD_GPT_CONTEXT_WORK.bat"]
GPT_STATE_FILES = [
    "FILETREE.txt",
    "HASHES.txt",
    "LAST_SYNC.txt",
    "LAST_PATCH_REPORT.txt",
    "ASSET_MANIFEST.txt",
    "BAT_MANIFEST.txt",
    "README_MIRROR_PLAN.txt",
]
ROOT_FILES_FOR_CODE_SNAPSHOT = [
    "AGENTS.md",
    "index.html",
    "README.md",
    "THIS_IS_WORK_PROJECT.txt",
    "PATCH_REPORT.txt",
    "package.json",
    "package-lock.json",
    "playwright.config.js",
    "00_START_GAME_WORK_8010.bat",
    "01_BUILD_GPT_CONTEXT_WORK.bat",
    "02_RUN_PATCH_AND_CHECK.bat",
    "03_PREPARE_GPT_STATE.bat",
    "04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat",
]


def log(msg: str) -> None:
    print(msg, flush=True)


def fail(msg: str) -> None:
    print(f"[ERROR] {msg}", flush=True)
    sys.exit(1)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_project_root(root: Path) -> None:
    missing = [x for x in ROOT_REQUIRED if not (root / x).exists()]
    if missing:
        fail("Run from Four Elements project root. Missing: " + ", ".join(missing))


def detect_mirror(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit).expanduser()

    env = os.environ.get("FOUR_ELEMENTS_GDRIVE_MIRROR")
    if env:
        return Path(env).expanduser()

    candidates: list[Path] = []
    for drive in ["G", "H", "I", "D", "C"]:
        candidates.extend([
            Path(f"{drive}:/Мой диск/{MIRROR_FOLDER_NAME}"),
            Path(f"{drive}:/My Drive/{MIRROR_FOLDER_NAME}"),
        ])

    # Prefer an already created mirror folder.
    for c in candidates:
        if c.exists():
            return c

    # Otherwise create under an existing Google Drive My Drive folder.
    for c in candidates:
        if c.parent.exists():
            return c

    fail(
        "Google Drive mirror folder was not found. "
        "Create G:\\Мой диск\\FourElements_WORK_MIRROR or pass an explicit path."
    )
    raise AssertionError("unreachable")


def reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def copy_file(src: Path, dst: Path) -> bool:
    if not src.exists() or not src.is_file():
        return False

    dst.parent.mkdir(parents=True, exist_ok=True)

    # Google Drive virtual disks can fail on copy2() while copying metadata
    # (copystat/utime), even though a plain file copy is allowed. Use a safe
    # fallback sequence so mirror sync does not break on that metadata step.
    try:
        shutil.copy2(src, dst)
        return True
    except Exception:
        pass

    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        return True
    except Exception:
        pass

    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        try:
            if dst.exists():
                dst.unlink()
        except Exception:
            pass
        with src.open("rb") as fsrc, dst.open("wb") as fdst:
            shutil.copyfileobj(fsrc, fdst, 1024 * 1024)
        return True
    except Exception:
        try:
            if dst.exists():
                dst.unlink()
        except Exception:
            pass
        raise

def copy_tree_filtered(src: Path, dst: Path, allowed_suffixes: tuple[str, ...] | None = None) -> int:
    if not src.exists():
        return 0
    count = 0
    for p in src.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(src)
        parts = set(rel.parts)
        if any(x in parts for x in ["node_modules", ".git", "test-results", "_gpt_export_tmp"]):
            continue
        if allowed_suffixes and p.suffix.lower() not in allowed_suffixes:
            continue
        copy_file(p, dst / rel)
        count += 1
    return count


def copy_latest_backup_reports(root: Path, dst: Path, limit: int = 5) -> int:
    backup = root / "backup"
    if not backup.exists():
        return 0
    reports = sorted(backup.rglob("PATCH_REPORT.txt"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]
    count = 0
    for i, report in enumerate(reports, 1):
        folder = report.parent.name
        safe = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in folder)
        copy_file(report, dst / f"{i:02d}_{safe}_PATCH_REPORT.txt")
        count += 1
    return count


def write_readme(root: Path, mirror: Path, counts: dict[str, int]) -> None:
    text = f"""FourElements_WORK_MIRROR
Generated: {dt.datetime.now().isoformat(timespec='seconds')}
Source: {root}
Mirror: {mirror}

Purpose:
This folder is a lightweight Google Drive mirror for ChatGPT/Codex context reading.
It is NOT the source of truth and must not be patched directly.
The source of truth remains the local WORK folder:
{root}

Layout:
- code_snapshot/: readable current source/control files without binary assets
- project_docs/: AGENTS.md, workflow reglament, new chat prompt, roadmap, README
- gpt_exports/: latest GPT_WORK_SEND_THIS_CONTEXT.zip
- patch_reports/: root PATCH_REPORT.txt and latest selected backup reports
- gpt_state/: FILETREE, HASHES, LAST_SYNC, ASSET_MANIFEST, BAT_MANIFEST

Counts:
{chr(10).join(f'- {k}: {v}' for k, v in counts.items())}

Rules:
- Do not edit mirror files manually.
- Do not treat this mirror as a replacement for the local WORK folder.
- After each patch, run 04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat from the WORK root.
"""
    (mirror / "README_SYNC.txt").write_text(text, encoding="utf-8")


def write_sync_manifest(root: Path, mirror: Path, counts: dict[str, int]) -> None:
    lines = [
        f"generated={dt.datetime.now().isoformat(timespec='seconds')}",
        f"source={root}",
        f"mirror={mirror}",
    ]
    for key, value in counts.items():
        lines.append(f"{key}={value}")
    zip_path = root / "_exports" / "GPT_WORK_SEND_THIS_CONTEXT.zip"
    if zip_path.exists():
        lines.append(f"gpt_context_zip_size={zip_path.stat().st_size}")
        lines.append(f"gpt_context_zip_sha256={sha256_file(zip_path)}")
    (mirror / "SYNC_MANIFEST.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    root = Path.cwd().resolve()
    ensure_project_root(root)

    explicit = sys.argv[1] if len(sys.argv) > 1 else None
    mirror = detect_mirror(explicit).resolve()
    mirror.mkdir(parents=True, exist_ok=True)

    log(f"[INFO] Source: {root}")
    log(f"[INFO] Mirror: {mirror}")

    # Controlled mirror subfolders. Do not wipe unknown files outside these subfolders.
    code_snapshot = mirror / "code_snapshot"
    project_docs = mirror / "project_docs"
    gpt_exports = mirror / "gpt_exports"
    patch_reports = mirror / "patch_reports"
    gpt_state = mirror / "gpt_state"

    for folder in [code_snapshot, project_docs, gpt_exports, patch_reports, gpt_state]:
        reset_dir(folder)

    counts: dict[str, int] = {}

    # code_snapshot: readable source/control files, no assets binaries.
    root_count = 0
    for rel in ROOT_FILES_FOR_CODE_SNAPSHOT:
        if copy_file(root / rel, code_snapshot / rel):
            root_count += 1
    src_count = copy_tree_filtered(root / "src", code_snapshot / "src", allowed_suffixes=(".js", ".json", ".md", ".txt"))
    tools_count = 0
    for rel in ["tools/prepare_gpt_state.py", "tools/sync_work_mirror.py"]:
        if copy_file(root / rel, code_snapshot / rel):
            tools_count += 1
    counts["code_snapshot_root_files"] = root_count
    counts["code_snapshot_src_files"] = src_count
    counts["code_snapshot_tool_files"] = tools_count

    # docs/project subset.
    doc_count = 0
    for rel in [
        "AGENTS.md",
        "README.md",
        "THIS_IS_WORK_PROJECT.txt",
        "docs/project/four_elements_workflow_reglament.md",
        "docs/project/NEW_CHAT_START_PROMPT.md",
        "docs/project/four_elements_patch_roadmap_actual.docx",
        "docs/project/four_elements_patch_roadmap_actual.md",
    ]:
        if copy_file(root / rel, project_docs / rel):
            doc_count += 1
    counts["project_docs_files"] = doc_count

    # Latest GPT export.
    export_count = 0
    if copy_file(root / "_exports" / "GPT_WORK_SEND_THIS_CONTEXT.zip", gpt_exports / "GPT_WORK_SEND_THIS_CONTEXT.zip"):
        export_count += 1
    counts["gpt_export_files"] = export_count

    # Patch reports.
    report_count = 0
    if copy_file(root / "PATCH_REPORT.txt", patch_reports / "ROOT_PATCH_REPORT.txt"):
        report_count += 1
    report_count += copy_latest_backup_reports(root, patch_reports, limit=5)
    counts["patch_report_files"] = report_count

    # GPT state.
    state_count = 0
    for name in GPT_STATE_FILES:
        if copy_file(root / "_gpt_state" / name, gpt_state / name):
            state_count += 1
    counts["gpt_state_files"] = state_count

    write_readme(root, mirror, counts)
    write_sync_manifest(root, mirror, counts)

    log("[OK] Mirror sync completed.")
    for key, value in counts.items():
        log(f"[OK] {key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# FE_PATCH_VISUAL_SCREENSHOT_SYNC_START
# PATCH-INFRA-VISUAL-SCREENSHOTS-SYNC-FIX
# Keep this block independent from the main mirror sync logic.
# It copies Playwright visual screenshots into Google Drive mirror after the normal sync.
def _fe_visual_screenshot_sync_candidates():
    from pathlib import Path
    import os

    candidates = []
    for drive in ("G:", "H:"):
        candidates.append(Path(drive) / "Мой диск" / "FourElements_WORK_MIRROR")
        candidates.append(Path(drive) / "My Drive" / "FourElements_WORK_MIRROR")

    userprofile = os.environ.get("USERPROFILE")
    if userprofile:
        base = Path(userprofile)
        candidates.extend([
            base / "Google Drive" / "Мой диск" / "FourElements_WORK_MIRROR",
            base / "Google Drive" / "My Drive" / "FourElements_WORK_MIRROR",
            base / "My Drive" / "FourElements_WORK_MIRROR",
        ])

    seen = set()
    result = []
    for item in candidates:
        key = str(item).lower()
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def _fe_sync_visual_screenshots_to_mirror():
    from pathlib import Path
    import shutil

    root = Path.cwd()
    src = root / "_reports" / "screenshots" / "latest"
    if not src.exists():
        print("[INFO] visual screenshots: no _reports/screenshots/latest folder, skipped.")
        return

    files = [p for p in src.iterdir() if p.is_file()]
    if not files:
        print("[INFO] visual screenshots: latest folder is empty, skipped.")
        return

    mirror = None
    for candidate in _fe_visual_screenshot_sync_candidates():
        if candidate.exists():
            mirror = candidate
            break

    if mirror is None:
        print("[WARN] visual screenshots: Google Drive mirror path not found, skipped.")
        return

    dst = mirror / "visual_screenshots" / "latest"
    if dst.exists():
        shutil.rmtree(dst)
    dst.mkdir(parents=True, exist_ok=True)

    copied = 0
    for file in files:
        if file.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".txt", ".json"}:
            shutil.copy2(file, dst / file.name)
            copied += 1

    index = dst / "README_VISUAL_SCREENSHOTS.txt"
    index.write_text(
        "Four Elements visual screenshots\n"
        f"Source: {src}\n"
        f"Copied files: {copied}\n"
        "Use these screenshots for visual review only, not gameplay validation.\n",
        encoding="utf-8",
    )
    print(f"[OK] visual screenshots synced: {copied} file(s) -> {dst}")


try:
    _fe_sync_visual_screenshots_to_mirror()
except Exception as exc:
    print(f"[WARN] visual screenshots sync failed: {exc}")
# FE_PATCH_VISUAL_SCREENSHOT_SYNC_END
