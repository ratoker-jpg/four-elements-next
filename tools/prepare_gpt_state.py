from __future__ import annotations

from datetime import datetime
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / '_gpt_state'
STATE.mkdir(exist_ok=True)
SKIP_HASH_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.blend', '.zip', '.docx'}
KEY_HASH_FILES = [
    'AGENTS.md',
    'README.md',
    'THIS_IS_WORK_PROJECT.txt',
    'PATCH_REPORT.txt',
    '00_START_GAME_WORK_8010.bat',
    '01_BUILD_GPT_CONTEXT_WORK.bat',
    '02_RUN_PATCH_AND_CHECK.bat',
    '03_PREPARE_GPT_STATE.bat',
    'playwright.config.js',
    'package.json',
    'package-lock.json',
    'docs/project/four_elements_workflow_reglament.md',
    'docs/project/four_elements_patch_roadmap_actual.docx',
    'src/main.js',
    'src/config/runtime_flags.js',
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def excluded(path: Path) -> bool:
    rp = rel(path)
    if rp.startswith('.git/') or '/.git/' in rp:
        return True
    if rp.startswith('node_modules/') or '/node_modules/' in rp:
        return True
    if rp.startswith('test-results/') or '/test-results/' in rp:
        return True
    if rp.startswith('_inbox/audit_context_unpack_temp/'):
        return True
    if rp.startswith('_inbox/audit_gpt_context_unpack_temp/'):
        return True
    if rp.startswith('_inbox/audit_unique_zip_unpack_temp/'):
        return True
    if rp.startswith('_inbox/generated_assets/'):
        return True
    if rp.startswith('_reports/playwright/screenshots/'):
        return True
    return False


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


files = sorted([p for p in ROOT.rglob('*') if p.is_file() and not excluded(p)], key=lambda p: rel(p))
(STATE / 'FILETREE.txt').write_text('\n'.join(rel(p) for p in files) + '\n', encoding='utf-8')

hash_lines = []
for item in KEY_HASH_FILES:
    p = ROOT / item
    if p.exists() and p.is_file():
        hash_lines.append(f'{sha256(p)}  {rel(p)}')
for p in files:
    rp = rel(p)
    if rp in KEY_HASH_FILES:
        continue
    if rp.startswith('assets/'):
        continue
    if p.suffix.lower() in SKIP_HASH_EXTS:
        continue
    hash_lines.append(f'{sha256(p)}  {rp}')
(STATE / 'HASHES.txt').write_text('\n'.join(hash_lines) + '\n', encoding='utf-8')

(STATE / 'LAST_SYNC.txt').write_text('\n'.join([
    'Four Elements canonical WORK state',
    f'Generated: {datetime.now().isoformat(timespec="seconds")}',
    'Source path: C:/Users/Den/Desktop/four elements/four_elements_core_base_v03',
    'Target path: C:/Users/Den/Desktop/four elements/four_elements_core_base',
    'Fallback note: four_elements_core_base_v03 remains untouched as fallback.',
]) + '\n', encoding='utf-8')

patch_report = ROOT / 'PATCH_REPORT.txt'
if patch_report.exists():
    (STATE / 'LAST_PATCH_REPORT.txt').write_text(patch_report.read_text(encoding='utf-8', errors='ignore'), encoding='utf-8')
else:
    (STATE / 'LAST_PATCH_REPORT.txt').write_text('PATCH_REPORT.txt not found\n', encoding='utf-8')

asset_lines = []
assets = ROOT / 'assets'
if assets.exists():
    for p in sorted([p for p in assets.rglob('*') if p.is_file()], key=lambda p: p.relative_to(assets).as_posix()):
        asset_lines.append(f'{p.relative_to(assets).as_posix()}\t{p.stat().st_size}')
(STATE / 'ASSET_MANIFEST.txt').write_text('\n'.join(asset_lines) + ('\n' if asset_lines else ''), encoding='utf-8')

bat_lines = []
for p in sorted(ROOT.rglob('*.bat'), key=lambda p: rel(p)):
    rp = rel(p)
    text = p.read_text(encoding='utf-8', errors='ignore')
    role = 'helper'
    status = 'helper'
    if rp in {'00_START_GAME_WORK_8010.bat', '01_BUILD_GPT_CONTEXT_WORK.bat', '02_RUN_PATCH_AND_CHECK.bat', '03_PREPARE_GPT_STATE.bat'}:
        role = 'primary_workflow'
        status = 'current'
    elif rp.startswith('_archive/'):
        role = 'archived'
        status = 'legacy'
    elif rp.startswith('tools/dev_bat/'):
        role = 'developer_helper'
        status = 'helper'
    port = '-'
    m = re.search(r'(?:localhost|127\.0\.0\.1):(\d+)', text)
    if m:
        port = m.group(1)
    deps = []
    for token in ['patch.py', 'src/main.js', 'index.html', 'playwright', 'prepare_gpt_state.py', 'GPT_WORK_SEND_THIS_CONTEXT.zip']:
        if token in text:
            deps.append(token)
    bat_lines.append(f'{rp}\trole={role}\tstatus={status}\tport={port}\tdeps={",".join(deps) if deps else "-"}')
(STATE / 'BAT_MANIFEST.txt').write_text('\n'.join(bat_lines) + '\n', encoding='utf-8')

(STATE / 'README_MIRROR_PLAN.txt').write_text('''FourElements_WORK_MIRROR/
- README_SYNC.txt
- project_docs/
- gpt_exports/
- patch_reports/
- gpt_state/

Recommended mirror content:
- project_docs/: AGENTS.md, workflow reglament, roadmap, selected checklists
- gpt_exports/: latest GPT_WORK_SEND_THIS_CONTEXT.zip
- patch_reports/: root PATCH_REPORT.txt plus latest selected backup PATCH_REPORT files
- gpt_state/: FILETREE.txt, HASHES.txt, LAST_SYNC.txt, LAST_PATCH_REPORT.txt, ASSET_MANIFEST.txt, BAT_MANIFEST.txt
''', encoding='utf-8')
