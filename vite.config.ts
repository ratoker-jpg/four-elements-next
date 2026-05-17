import { copyFile, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

function publishSpriteViewer() {
  const viewerFiles = ['index.html', 'sprite-manifest.json'];
  let outDir = path.resolve(repoRoot, 'dist');

  return {
    name: 'publish-sprite-viewer',
    apply: 'build',
    configResolved(config: { build: { outDir: string } }) {
      outDir = path.resolve(repoRoot, config.build.outDir);
    },
    async closeBundle() {
      const sourceDir = path.resolve(repoRoot, 'tools', 'sprite-viewer');
      const targetDir = path.resolve(outDir, 'tools', 'sprite-viewer');
      const sourceSamplesDir = path.resolve(sourceDir, 'samples');
      const targetSamplesDir = path.resolve(targetDir, 'samples');

      await mkdir(targetDir, { recursive: true });

      await Promise.all(
        viewerFiles.map((fileName) =>
          copyFile(path.resolve(sourceDir, fileName), path.resolve(targetDir, fileName)),
        ),
      );

      await cp(sourceSamplesDir, targetSamplesDir, { recursive: true });
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
