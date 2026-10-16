// Un jeu = un dossier src/<jeu>/. Le build produit un seul fichier HTML (images et données incluses),
// copié dans docs/index.html pour GitHub Pages et dans dist/carnet.html pour l'artifact Claude.
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { copyFileSync, readFileSync, renameSync } from 'node:fs';
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
      // singlefile n'intègre pas les icônes <link rel="icon"> : on les met en data URI
      name: 'icones',
      apply: 'build',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replace(/(<link rel="(?:icon|apple-touch-icon)"[^>]*href=")([^"]+\.(svg|png))"/g, (_, before, href, ext) => {
          const mime = ext === 'svg' ? 'image/svg+xml' : 'image/png';
          const data = readFileSync(resolve(root, 'src', game, href)).toString('base64');
          return `${before}data:${mime};base64,${data}"`;
        }),
      },
    },
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
