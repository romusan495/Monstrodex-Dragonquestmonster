// Un jeu = un dossier src/<jeu>/. Le build produit un seul fichier HTML (images et données incluses),
// copié dans docs/index.html pour GitHub Pages et dans dist/carnet.html pour l'artifact Claude.
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { copyFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const game = process.env.JEU || 'dqm3';
const dist = resolve(root, 'dist');

export default defineConfig({
  root: resolve(root, 'src', game),
  base: './',
  server: { fs: { allow: [root] } },
  build: { outDir: dist, emptyOutDir: true },
  plugins: [
    viteSingleFile(),
    {
      name: 'publier',
      apply: 'build',
      closeBundle() {
        renameSync(resolve(dist, 'index.html'), resolve(dist, 'carnet.html'));
        if (game === 'dqm3') copyFileSync(resolve(dist, 'carnet.html'), resolve(root, 'docs', 'index.html'));
      },
    },
  ],
});
