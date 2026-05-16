import { defineConfig } from 'vite';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  root: '.',
  base: isGitHubPages ? '/four-elements-next/' : '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
