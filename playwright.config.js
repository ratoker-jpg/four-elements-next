const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90000,

  use: {
    baseURL: 'http://127.0.0.1:8010',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'retain-on-failure'
  },

  reporter: [
    ['list'],
    ['html', { outputFolder: '_reports/playwright/html', open: 'never' }]
  ],

  webServer: {
    // Node-based static server — cross-platform (Windows + Linux/CI).
    // Replaces `py -m http.server` which requires `py` on Windows
    // and `python3` on Linux.
    command: 'node tests/e2e/static_server.cjs 8010',
    url: 'http://127.0.0.1:8010/index.html',
    reuseExistingServer: true,
    timeout: 10000
  }
});
