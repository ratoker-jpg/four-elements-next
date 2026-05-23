import { defineConfig } from 'vite';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: isGitHubPages ? '/four-elements-next/spikes/phaser-rts-spike/' : '/',
  publicDir: 'public',
  server: {
    fs: {
      // Allow serving from spike public/ only; assets are copied, not symlinked
      allow: ['.'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
