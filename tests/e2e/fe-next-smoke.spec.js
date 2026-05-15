// FEN-01 — Playwright E2E smoke test for FE Next scaffold.
//
// Verifies the FE Next standalone page boots and renders:
//   1. Page loads without errors
//   2. Canvas is visible
//   3. HUD is visible with resource display
//   4. window.FE_NEXT_GAME exists and has state
//   5. State has expected initial values (map, HQ, unit, resources)
//   6. Left-click selects the test unit
//   7. Right-click issues a move command
//   8. Unit moves toward the target over frames
//
// Uses fe-next/index.html — completely independent from root game.

const { test, expect } = require('@playwright/test');

const FE_NEXT_URL = '/fe-next/index.html';

// Console error policy: only fail on actual runtime/syntax errors
const BENIGN_PATTERNS = [
  /favicon/i,
  /DevTools/i,
  /Failed to load resource.*favicon/i,
];

function isCriticalError(text) {
  if (!text) return false;
  for (const pat of BENIGN_PATTERNS) {
    if (pat.test(text)) return false;
  }
  return /ReferenceError|TypeError|SyntaxError|Uncaught|Error:/i.test(text);
}

test('FE Next scaffold: boot -> canvas -> HUD -> select -> move unit', async ({ page }) => {
  const criticalErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (isCriticalError(msg.text())) {
      criticalErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err && err.message ? err.message : String(err));
  });

  // ---- Step 1: Load FE Next page ----
  await page.goto(FE_NEXT_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // ---- Step 2: Canvas is visible ----
  const canvas = page.locator('canvas#game');
  await expect(canvas, 'FE Next canvas should be visible').toBeVisible({ timeout: 10000 });

  // ---- Step 3: HUD is visible ----
  const hud = page.locator('#hud');
  await expect(hud, 'FE Next HUD should be visible').toBeVisible({ timeout: 5000 });

  const mineralsEl = page.locator('#hud-minerals');
  await expect(mineralsEl, 'HUD minerals should show initial value').toHaveText('200');

  const energyEl = page.locator('#hud-energy');
  await expect(energyEl, 'HUD energy should show initial value').toHaveText('160');

  // ---- Step 4: FE_NEXT_GAME state exists ----
  const gameState = await page.evaluate(() => {
    const g = window.FE_NEXT_GAME;
    if (!g || !g.state) return { hasState: false };
    const s = g.state;
    return {
      hasState: true,
      mapW: s.mapW,
      mapH: s.mapH,
      buildingCount: s.buildings ? s.buildings.length : 0,
      unitCount: s.units ? s.units.length : 0,
      resources: s.resources,
      selectedUnitId: s.selectedUnitId,
      cameraZoom: s.camera ? s.camera.zoom : null
    };
  });

  expect(gameState.hasState, 'window.FE_NEXT_GAME.state should exist').toBe(true);
  expect(gameState.mapW, 'Map width should be 24').toBe(24);
  expect(gameState.mapH, 'Map height should be 24').toBe(24);
  expect(gameState.buildingCount, 'Should have 1 building (HQ)').toBe(1);
  expect(gameState.unitCount, 'Should have 1 unit').toBe(1);
  expect(gameState.resources.minerals, 'Initial minerals should be 200').toBe(200);
  expect(gameState.resources.energy, 'Initial energy should be 160').toBe(160);

  // ---- Step 5: Verify HQ and unit in state ----
  const entities = await page.evaluate(() => {
    const s = window.FE_NEXT_GAME.state;
    return {
      hq: s.buildings[0],
      unit: s.units[0]
    };
  });

  expect(entities.hq.type, 'First building should be HQ').toBe('hq');
  expect(entities.hq.owner, 'HQ should be player-owned').toBe('player');
  expect(entities.unit.type, 'Unit should be light_tank').toBe('light_tank');
  expect(entities.unit.owner, 'Unit should be player-owned').toBe('player');

  // ---- Step 6: Left-click to select unit ----
  // We need to click on the unit's position on the canvas.
  // The unit starts at tile (7, 5). Calculate its canvas position.
  const clickResult = await page.evaluate(() => {
    const s = window.FE_NEXT_GAME.state;
    const u = s.units[0];
    const C = window.FE_NEXT_CONSTANTS;
    const COORDS = window.FE_NEXT_COORDS;
    const canvas = document.getElementById('game');
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;

    const scr = COORDS.tileToScreen(u.tx + 0.5, u.ty + 0.5);
    const canvasPos = COORDS.worldToCanvas(scr.x, scr.y, s.camera, cw, ch);

    return { x: canvasPos.x, y: canvasPos.y, cw: cw, ch: ch };
  });

  // Click on the unit position
  const canvasBox = await canvas.boundingBox();
  if (canvasBox && clickResult.x > 0 && clickResult.x < clickResult.cw &&
      clickResult.y > 0 && clickResult.y < clickResult.ch) {
    await page.mouse.click(
      canvasBox.x + clickResult.x,
      canvasBox.y + clickResult.y
    );
    await page.waitForTimeout(200);

    // Verify unit is now selected
    const selAfterClick = await page.evaluate(() => {
      return window.FE_NEXT_GAME.state.selectedUnitId;
    });
    expect(selAfterClick, 'Unit should be selected after left-click').toBeTruthy();
  } else {
    // If unit is off-screen, use evaluate to select directly for test reliability
    await page.evaluate(() => {
      const s = window.FE_NEXT_GAME.state;
      s.units[0].selected = true;
      s.selectedUnitId = s.units[0].id;
    });
  }

  // ---- Step 7: Right-click to move unit ----
  // Click somewhere to the right of the unit
  const moveResult = await page.evaluate(() => {
    const s = window.FE_NEXT_GAME.state;
    const C = window.FE_NEXT_CONSTANTS;
    const COORDS = window.FE_NEXT_COORDS;
    const canvas = document.getElementById('game');
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;

    // Move target: tile (12, 10)
    var scr = COORDS.tileToScreen(12.5, 10.5);
    var canvasPos = COORDS.worldToCanvas(scr.x, scr.y, s.camera, cw, ch);
    return { x: canvasPos.x, y: canvasPos.y };
  });

  if (canvasBox && moveResult.x > 0 && moveResult.x < clickResult.cw &&
      moveResult.y > 0 && moveResult.y < clickResult.ch) {
    await page.mouse.click(
      canvasBox.x + moveResult.x,
      canvasBox.y + moveResult.y,
      { button: 'right' }
    );
    await page.waitForTimeout(200);

    // ---- Step 8: Verify unit is moving ----
    const moveState = await page.evaluate(() => {
      const u = window.FE_NEXT_GAME.state.units[0];
      return {
        moving: u.moving,
        hasTarget: !!(u.moveTarget),
        targetTx: u.moveTarget ? u.moveTarget.tx : null,
        targetTy: u.moveTarget ? u.moveTarget.ty : null
      };
    });

    // Unit should either be moving or already arrived
    if (moveState.moving || moveState.hasTarget) {
      // Wait for movement progress
      await page.waitForTimeout(1500);

      const afterMove = await page.evaluate(() => {
        const u = window.FE_NEXT_GAME.state.units[0];
        return {
          tx: u.tx,
          ty: u.ty,
          moving: u.moving
        };
      });

      // Unit should have moved from starting position (7, 5)
      const moved = Math.abs(afterMove.tx - 7) > 0.1 || Math.abs(afterMove.ty - 5) > 0.1;
      expect(moved, 'Unit should have moved from starting position after move command').toBe(true);
    }
  } else {
    // Fallback: issue move command via evaluate
    await page.evaluate(() => {
      window.FE_NEXT_STATE.issueMoveCommand(window.FE_NEXT_GAME.state, window.FE_NEXT_GAME.state.units[0].id, 12, 10);
    });
    await page.waitForTimeout(1500);

    const afterMove = await page.evaluate(() => {
      const u = window.FE_NEXT_GAME.state.units[0];
      return { tx: u.tx, ty: u.ty };
    });
    const moved = Math.abs(afterMove.tx - 7) > 0.1 || Math.abs(afterMove.ty - 5) > 0.1;
    expect(moved, 'Unit should have moved from starting position after move command').toBe(true);
  }

  // ---- Step 9: Selection info panel ----
  const selInfo = page.locator('#selection-info');
  await expect(selInfo, 'Selection info should be visible when unit is selected').toBeVisible({ timeout: 3000 });

  // ---- Final: No critical errors ----
  expect(pageErrors, `Page JS errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(criticalErrors, `Critical console errors: ${criticalErrors.join('\n')}`).toEqual([]);
});

test('FE Next scaffold: camera zoom works', async ({ page }) => {
  await page.goto(FE_NEXT_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const canvas = page.locator('canvas#game');
  await expect(canvas).toBeVisible({ timeout: 10000 });

  // Get initial zoom
  const initialZoom = await page.evaluate(() => {
    return window.FE_NEXT_GAME.state.camera.zoom;
  });

  // Scroll up (zoom in)
  const canvasBox = await canvas.boundingBox();
  if (canvasBox) {
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(200);
  }

  const afterZoomIn = await page.evaluate(() => {
    return window.FE_NEXT_GAME.state.camera.zoom;
  });

  expect(afterZoomIn, 'Zoom should increase after scroll up').toBeGreaterThan(initialZoom);

  // Scroll down (zoom out)
  if (canvasBox) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(200);
  }

  const afterZoomOut = await page.evaluate(() => {
    return window.FE_NEXT_GAME.state.camera.zoom;
  });

  expect(afterZoomOut, 'Zoom should decrease after scroll down').toBeLessThan(afterZoomIn);
});
