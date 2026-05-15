const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('Four Elements new game standard flow capture', async ({ page }) => {
  const reportDir = path.join(process.cwd(), '_reports', 'playwright');
  const screenshotDir = path.join(reportDir, 'screenshots');

  fs.mkdirSync(screenshotDir, { recursive: true });

  const consoleLines = [];
  const pageErrors = [];

  page.on('console', msg => {
    consoleLines.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    pageErrors.push(err.stack || err.message || String(err));
  });

  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });

  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 15000 });

  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(screenshotDir, '05_main_menu.png'),
    fullPage: true
  });

  // Новая игра
  await page.mouse.click(640, 262);
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(screenshotDir, '06_map_size_screen.png'),
    fullPage: true
  });

  // Стандартная карта
  await page.mouse.click(640, 332);
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(screenshotDir, '07_after_standard_map_click.png'),
    fullPage: true
  });

  const errorLines = consoleLines.filter(line =>
    line.startsWith('[error]') ||
    line.includes('404') ||
    line.includes('Failed to load') ||
    line.includes('Uncaught') ||
    line.includes('SyntaxError') ||
    line.includes('ReferenceError') ||
    line.includes('TypeError')
  );

  const reportText = [
    'FOUR ELEMENTS PLAYWRIGHT NEW GAME STANDARD FLOW TEST',
    '',
    'Page errors:',
    pageErrors.length ? pageErrors.join('\n\n') : 'none',
    '',
    'Console:',
    consoleLines.length ? consoleLines.join('\n') : 'none',
    '',
    'Detected problematic console lines:',
    errorLines.length ? errorLines.join('\n') : 'none'
  ].join('\n');

  fs.writeFileSync(path.join(reportDir, 'new_game_standard_flow_console.txt'), reportText, 'utf8');

  expect(pageErrors, 'Page JS errors').toEqual([]);
  expect(errorLines, 'Console errors / missing assets / syntax errors').toEqual([]);
});