from pathlib import Path

def main():
    root = Path.cwd()
    print("[INFO] Placeholder patch.py in canonical WORK folder.")
    print("[INFO] Supply a task-specific GPT-generated patch.py before using 02_RUN_PATCH_AND_CHECK.bat.")
    print(f"[INFO] Project root: {root}")
    print("[INFO] This placeholder intentionally makes no file changes.")

if __name__ == "__main__":
    main()
