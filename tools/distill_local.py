import sys
import json
import urllib.request
import urllib.error

HOST = "http://127.0.0.1:1234/v1/chat/completions"
MODEL = "qwen3vl-8b-uncensored-hauhaucs-aggressive"

def main():
    user_prompt = " ".join(sys.argv[1:]).strip()
    if not user_prompt:
        user_prompt = "Summarize the input. Return only the important problems and exact file paths if present."

    raw_input = sys.stdin.read()

    if not raw_input.strip():
        print("[distill_local] No stdin input received.")
        sys.exit(1)

    payload = {
        "model": MODEL,
        "temperature": 0.1,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a log and code-output distiller. "
                    "Extract only important actionable information. "
                    "Keep exact file paths, line numbers, error names, and command results. "
                    "Do not add explanations unless needed."
                )
            },
            {
                "role": "user",
                "content": (
                    user_prompt
                    + "\n\n--- RAW INPUT START ---\n"
                    + raw_input
                    + "\n--- RAW INPUT END ---"
                )
            }
        ]
    }

    req = urllib.request.Request(
        HOST,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(data["choices"][0]["message"]["content"].strip())
    except urllib.error.URLError as e:
        print("[distill_local] Cannot connect to LM Studio.")
        print("Check that LM Studio server is running on http://127.0.0.1:1234/v1")
        print(str(e))
        sys.exit(1)
    except Exception as e:
        print("[distill_local] Error:")
        print(str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()