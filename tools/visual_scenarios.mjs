import fs from "node:fs";
import path from "node:path";

async function loadChromium() {
  try {
    const mod = await import("@playwright/test");
    return mod.chromium;
  } catch (e1) {
    try {
      const mod = await import("playwright");
      return mod.chromium;
    } catch (e2) {
      console.error("[ERROR] Playwright is not installed or not available.");
      console.error("Install/restore project dependencies, then retry.");
      console.error("Original errors:", e1?.message || e1, ";", e2?.message || e2);
      process.exit(1);
    }
  }
}

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "_reports", "screenshots", "latest");
const BASE_URL = process.env.FE_VISUAL_BASE_URL || "http://127.0.0.1:8010/index.html";
const requested = (process.argv[2] || "all").trim().toLowerCase();
const scenarios = requested === "all" ? ["hud", "victory", "defeat"] : [requested];
const allowed = new Set(["hud", "victory", "defeat"]);

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const name of fs.readdirSync(OUT_DIR)) {
  if (/\.(png|jpg|jpeg|webp|txt|json)$/i.test(name)) {
    fs.rmSync(path.join(OUT_DIR, name), { force: true });
  }
}

const chromium = await loadChromium();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
});

const manifest = {
  patch: "PATCH-INFRA-PLAYWRIGHT-VISUAL-SCENARIOS-MVP",
  createdAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  requested,
  files: [],
};

async function waitForGame(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.waitForTimeout(1000);
}

async function forceResult(page, result) {
  await page.evaluate(({ result }) => {
    const reason = result === "victory" ? "Enemy base destroyed" : "Main base destroyed";

    if (typeof window.FE_DEBUG_FORCE_RESULT === "function") {
      window.FE_DEBUG_FORCE_RESULT(result, reason);
      return;
    }
    if (result === "victory" && typeof window.FE_DEBUG_FORCE_VICTORY === "function") {
      window.FE_DEBUG_FORCE_VICTORY(reason);
      return;
    }
    if (result === "defeat" && typeof window.FE_DEBUG_FORCE_DEFEAT === "function") {
      window.FE_DEBUG_FORCE_DEFEAT(reason);
      return;
    }

    const id = "fe-playwright-result-overlay";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }
    const victory = result === "victory";
    el.innerHTML = `
      <div class="fe-pw-result-card">
        <div class="fe-pw-result-title">${victory ? "VICTORY" : "DEFEAT"}</div>
        <div class="fe-pw-result-subtitle">${reason}</div>
        <div class="fe-pw-result-hint">Playwright visual scenario</div>
      </div>`;
    Object.assign(el.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.62)",
      pointerEvents: "none",
      fontFamily: "Arial, sans-serif",
    });
    const card = el.querySelector(".fe-pw-result-card");
    Object.assign(card.style, {
      minWidth: "420px",
      maxWidth: "680px",
      padding: "36px 52px",
      borderRadius: "18px",
      border: victory ? "3px solid #65f08a" : "3px solid #ff6b6b",
      background: victory ? "rgba(16, 64, 32, 0.90)" : "rgba(70, 24, 24, 0.90)",
      boxShadow: victory ? "0 0 34px rgba(101, 240, 138, 0.35)" : "0 0 34px rgba(255, 90, 90, 0.35)",
      textAlign: "center",
      color: "#f6ffe8",
    });
    Object.assign(el.querySelector(".fe-pw-result-title").style, {
      fontSize: "48px",
      fontWeight: "900",
      letterSpacing: "2px",
      marginBottom: "16px",
      color: victory ? "#b8ffc4" : "#ffd0d0",
    });
    Object.assign(el.querySelector(".fe-pw-result-subtitle").style, {
      fontSize: "22px",
      fontWeight: "700",
      marginBottom: "24px",
    });
    Object.assign(el.querySelector(".fe-pw-result-hint").style, {
      fontSize: "14px",
      opacity: "0.72",
    });
  }, { result });
  await page.waitForTimeout(500);
}

async function runScenario(name) {
  if (!allowed.has(name)) {
    throw new Error(`Unknown scenario: ${name}. Use all/victory/defeat/hud.`);
  }
  const page = await context.newPage();
  await waitForGame(page);

  if (name === "victory") await forceResult(page, "victory");
  if (name === "defeat") await forceResult(page, "defeat");

  const out = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  manifest.files.push({ scenario: name, path: path.relative(ROOT, out).replace(/\\/g, "/") });
  console.log(`[OK] ${name}: ${out}`);
  await page.close();
}

try {
  for (const scenario of scenarios) {
    await runScenario(scenario);
  }
} finally {
  await browser.close();
}

const manifestPath = path.join(OUT_DIR, "visual_scenarios_manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
console.log("[INFO] Sandbox mode: screenshots remain local in _reports/screenshots/latest.");
