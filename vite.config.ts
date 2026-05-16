import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const spriteViewerDir = path.resolve(__dirname, 'tools', 'sprite-viewer');

function publishSpriteViewer() {
  return {
    name: 'publish-sprite-viewer',
    apply: 'build' as const,
    generateBundle() {
      for (const fileName of ['index.html', 'sprite-manifest.json']) {
        this.emitFile({
          type: 'asset',
          fileName: `tools/sprite-viewer/${fileName}`,
          source: readFileSync(path.join(spriteViewerDir, fileName), 'utf8'),
        });
      }
    },
  };
}

export default defineConfig({
  root: '.',
  base: isGitHubPages ? '/four-elements-next/' : '/',
  publicDir: 'public',
  plugins: [publishSpriteViewer()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
