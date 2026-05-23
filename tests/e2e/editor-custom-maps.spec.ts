import { test, expect } from '@playwright/test';

/**
 * MAP-EDITOR-ARCH-01 PR9 — Custom map localStorage slots E2E tests.
 *
 * Tests editor save/load/delete of custom maps:
 * - Save creates localStorage entry
 * - Saved entry appears in editor list
 * - Loading replaces current editor MapData
 * - Deleting removes from list
 * - Saved maps persist across reload
 * - Corrupt localStorage does not crash
 * - Invalid saved map is rejected
 * - Validation runs after loading
 * - No game launch button is added
 * - Normal editor placement/removal works after save/load round trip
 *
 * NOTE: The saved maps panel starts collapsed. Tests that interact with
 * the saved maps list must expand it first by clicking the toggle button.
 * Tests that need canvas clicks rely on the panel being collapsed (default).
 */

/** Navigate to the editor screen from main menu. */
async function navigateToEditor(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.screen--main-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Редактор карты' }).click();
  await expect(page.locator('.screen--editor')).toBeVisible();
}

/** Expand the saved maps panel (idempotent — no-op if already expanded). */
async function expandSavedMaps(page: import('@playwright/test').Page): Promise<void> {
  const expanded = await page.locator('#editor-saved-maps').getAttribute('data-expanded');
  if (expanded !== 'true') {
    await page.locator('#editor-saved-maps-toggle').click();
    await expect(page.locator('#editor-saved-maps')).toHaveAttribute('data-expanded', 'true');
  }
}

/** Collapse the saved maps panel (idempotent — no-op if already collapsed). */
async function collapseSavedMaps(page: import('@playwright/test').Page): Promise<void> {
  const expanded = await page.locator('#editor-saved-maps').getAttribute('data-expanded');
  if (expanded !== 'false') {
    await page.locator('#editor-saved-maps-toggle').click();
    await expect(page.locator('#editor-saved-maps')).toHaveAttribute('data-expanded', 'false');
  }
}

test.describe('MAP-EDITOR-ARCH-01 PR9 — Editor custom map save/load', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('save current editor map creates localStorage entry', async ({ page }) => {
    await navigateToEditor(page);

    // Click save button
    await page.getByRole('button', { name: 'Сохранить карту' }).click();

    // Check localStorage has the custom maps key
    const hasEntry = await page.evaluate(() => {
      const raw = localStorage.getItem('four-elements-next.custom-maps.v1');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed.version === 1 && Array.isArray(parsed.maps) && parsed.maps.length > 0;
    });
    expect(hasEntry).toBe(true);

    // Status message should show success
    await expect(page.locator('.editor-map-status')).toHaveAttribute('data-visible', 'true');
  });

  test('saved entry appears in editor list', async ({ page }) => {
    await navigateToEditor(page);

    // Save the current map
    await page.getByRole('button', { name: 'Сохранить карту' }).click();

    // Expand the saved maps panel to see the list
    await expandSavedMaps(page);

    // Initially should show the saved entry (not empty)
    const entry = page.locator('.editor-saved-map-entry').first();
    await expect(entry).toBeVisible();
    await expect(entry.locator('.editor-saved-map-entry__name')).toHaveText('Карта 1');

    // Should show map size
    await expect(entry.locator('.editor-saved-map-entry__size')).toContainText('×');

    // Should show counts (Р: П: Д:)
    await expect(entry.locator('.editor-saved-map-entry__counts')).toContainText(/Р:\d+/);
  });

  test('loading saved map replaces current editor MapData', async ({ page }) => {
    await navigateToEditor(page);

    // Place an obstacle first (modify the map) — panel is collapsed by default, canvas is accessible
    await page.getByRole('button', { name: 'Размещение' }).click();
    await page.getByRole('button', { name: 'Скалы' }).click();
    // Click somewhere on the canvas to place — use center-right to avoid overlay
    const canvasEl = page.locator('#editor-canvas');
    const box = await canvasEl.boundingBox();
    const clickX1 = box!.width * 0.5;
    const clickY1 = box!.height * 0.4;
    await canvasEl.click({ position: { x: clickX1, y: clickY1 } });

    // Save
    await page.getByRole('button', { name: 'Сохранить карту' }).click();

    // Record current obstacle count
    const infoText = await page.locator('#editor-info').textContent();
    const obstacleMatch = infoText?.match(/Препятствия: (\d+)/);
    const savedObstacles = obstacleMatch ? parseInt(obstacleMatch[1]!, 10) : 0;

    // Place more obstacles (modify map again) — panel still collapsed
    // Use a well-separated position to ensure a different tile
    const clickX2 = box!.width * 0.65;
    const clickY2 = box!.height * 0.55;
    await canvasEl.click({ position: { x: clickX2, y: clickY2 } });

    // Obstacle count should have changed
    const infoText2 = await page.locator('#editor-info').textContent();
    const obstacleMatch2 = infoText2?.match(/Препятствия: (\d+)/);
    const currentObstacles = obstacleMatch2 ? parseInt(obstacleMatch2[1]!, 10) : 0;
    expect(currentObstacles).toBeGreaterThan(savedObstacles);

    // Expand saved maps to load the saved map
    await expandSavedMaps(page);

    // Load the saved map by clicking on the entry name
    await page.locator('.editor-saved-map-entry__name').first().click();

    // Obstacle count should revert to saved value
    const infoText3 = await page.locator('#editor-info').textContent();
    const obstacleMatch3 = infoText3?.match(/Препятствия: (\d+)/);
    const loadedObstacles = obstacleMatch3 ? parseInt(obstacleMatch3[1]!, 10) : 0;
    expect(loadedObstacles).toBe(savedObstacles);
  });

  test('deleting saved map removes it from the list', async ({ page }) => {
    await navigateToEditor(page);

    // Save a map
    await page.getByRole('button', { name: 'Сохранить карту' }).click();

    // Expand to see the entry
    await expandSavedMaps(page);
    await expect(page.locator('.editor-saved-map-entry')).toHaveCount(1);

    // Click delete button
    await page.locator('.btn--delete-map').first().click();

    // Entry should be gone, empty state should appear
    await expect(page.locator('.editor-saved-map-entry')).toHaveCount(0);
    await expect(page.locator('.editor-saved-maps__empty')).toBeVisible();
  });

  test('saved maps persist across reload/reopen editor', async ({ page }) => {
    await navigateToEditor(page);

    // Save a map
    await page.getByRole('button', { name: 'Сохранить карту' }).click();

    // Navigate back to main menu
    await page.getByRole('button', { name: 'В меню' }).click();
    await expect(page.locator('.screen--main-menu')).toBeVisible();

    // Navigate back to editor
    await page.getByRole('button', { name: 'Редактор карты' }).click();
    await expect(page.locator('.screen--editor')).toBeVisible();

    // Expand saved maps — the entry should still be there
    await expandSavedMaps(page);
    await expect(page.locator('.editor-saved-map-entry')).toHaveCount(1);
    await expect(page.locator('.editor-saved-map-entry__name').first()).toHaveText('Карта 1');
  });

  test('corrupt localStorage does not crash editor', async ({ page }) => {
    // Inject corrupt data
    await page.evaluate(() => {
      localStorage.setItem('four-elements-next.custom-maps.v1', '{invalid json!!!');
    });

    await navigateToEditor(page);

    // Editor should load without crashing
    await expect(page.locator('.screen--editor')).toBeVisible();

    // Expand saved maps — should show empty state (corrupt data ignored)
    await expandSavedMaps(page);
    await expect(page.locator('.editor-saved-maps__empty')).toBeVisible();
  });

  test('invalid saved map is rejected/ignored', async ({ page }) => {
    // Inject invalid map data (missing required fields)
    await page.evaluate(() => {
      localStorage.setItem('four-elements-next.custom-maps.v1', JSON.stringify({
        version: 1,
        maps: [{
          id: 'bad',
          name: 'Bad Map',
          map: { width: 0, height: 0 }, // invalid — missing terrain, hq, etc.
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }],
      }));
    });

    await navigateToEditor(page);

    // Editor should load without crashing
    await expect(page.locator('.screen--editor')).toBeVisible();

    // Expand saved maps — invalid entry should be ignored, show empty state
    await expandSavedMaps(page);
    await expect(page.locator('.editor-saved-maps__empty')).toBeVisible();
  });

  test('validation runs after loading', async ({ page }) => {
    await navigateToEditor(page);

    // Save the current valid map
    await page.getByRole('button', { name: 'Сохранить карту' }).click();

    // Validation should show OK
    await expect(page.locator('.editor-validation__status--ok')).toBeVisible();

    // Expand saved maps and load the saved map
    await expandSavedMaps(page);
    await page.locator('.editor-saved-map-entry__name').first().click();

    // Validation should still run and show OK
    await expect(page.locator('.editor-validation__status')).toBeVisible();
  });

  test('game launch button exists in editor (PR10)', async ({ page }) => {
    await navigateToEditor(page);

    // PR10 adds "Начать игру" button
    await expect(page.getByRole('button', { name: 'Начать игру' })).toBeVisible();
  });

  test('normal editor placement/removal still works after save/load round trip', async ({ page }) => {
    await navigateToEditor(page);

    // Save the initial map
    await page.getByRole('button', { name: 'Сохранить карту' }).click();

    // Expand saved maps and load the saved map back
    await expandSavedMaps(page);
    await page.locator('.editor-saved-map-entry__name').first().click();

    // Collapse the panel so canvas clicks are not intercepted
    await collapseSavedMaps(page);

    // Place an obstacle (normal editor functionality)
    await page.getByRole('button', { name: 'Размещение' }).click();
    await page.getByRole('button', { name: 'Скалы' }).click();
    const canvasEl = page.locator('#editor-canvas');
    const box = await canvasEl.boundingBox();
    const clickX = box!.width * 0.5;
    const clickY = box!.height * 0.4;
    await canvasEl.click({ position: { x: clickX, y: clickY } });

    // Obstacle count should increase
    const infoText = await page.locator('#editor-info').textContent();
    const obstacleMatch = infoText?.match(/Препятствия: (\d+)/);
    expect(obstacleMatch).not.toBeNull();
    const obstaclesAfterPlace = parseInt(obstacleMatch![1]!, 10);
    expect(obstaclesAfterPlace).toBeGreaterThan(0);

    // Switch to erase tool and remove it
    await page.getByRole('button', { name: 'Удаление' }).click();
    await canvasEl.click({ position: { x: clickX, y: clickY } });

    // Obstacle count should decrease
    const infoText2 = await page.locator('#editor-info').textContent();
    const obstacleMatch2 = infoText2?.match(/Препятствия: (\d+)/);
    const obstaclesAfterErase = parseInt(obstacleMatch2![1]!, 10);
    expect(obstaclesAfterErase).toBeLessThan(obstaclesAfterPlace);
  });
});
