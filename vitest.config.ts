import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
