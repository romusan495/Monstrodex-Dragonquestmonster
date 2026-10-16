// Un jeu = un dossier src/<jeu>/. Le build produit un seul fichier HTML par jeu (images et données incluses),
// copié vers les cibles de SORTIES : dist/ (artifact Claude) et docs/ (GitHub Pages).
// Jeu choisi par la variable JEU (défaut dqm3) ; `deno task build` construit tous les jeux.
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const game = process.env.JEU || 'dqm3';
const tmp = resolve(root, 'dist', `.build-${game}`);

// Jeu → fichiers publiés (relatifs à la racine du projet)
const SORTIES = {
  dqm3: ['dist/carnet.html', 'docs/index.html'],
  mw4: ['dist/mw4.html', 'docs/mw4/index.html'],
};

export default defineConfig({
  root: resolve(root, 'src', game),
  base: './',
  server: { fs: { allow: [root] } },
  build: { outDir: tmp, emptyOutDir: true },
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
        for (const cible of SORTIES[game] ?? [`dist/${game}.html`]) {
          mkdirSync(dirname(resolve(root, cible)), { recursive: true });
          copyFileSync(resolve(tmp, 'index.html'), resolve(root, cible));
        }
        rmSync(tmp, { recursive: true, force: true });
      },
    },
  ],
});
