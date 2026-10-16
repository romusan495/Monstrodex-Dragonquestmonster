# Site-jeux : carnet et astuces pour mes jeux

Projet de Romuald (francophone). Le site regroupe, par jeu, les astuces et outils que les autres sites donnent mal ou pas du tout. Premier jeu : Dragon Quest Monsters : Le Prince des Ténèbres (DQM3).

## Règles de travail
- Tout le texte du site est en **français**. Utiliser les **noms officiels français du jeu** (wiki wikidragonquest.fr, exports HTML/JSON fournis par Romuald). Le wiki bloque les robots : ne pas contourner, demander les exports.
- Les règles de jeu non confirmées sont signalées « à confirmer » dans le site.
- Ne pas copier de captures ni de textes d'autres sites (droits d'auteur). Citer les sources avec lien. Pas d'illustrations officielles des jeux : les fonds sont originaux.
- Répondre en français, sobrement, résultat d'abord.

## Structure
- `src/dqm3/index.html` (balisage + en-tête SEO), `style.css`, `main.js` (importe `data.json` et `style.css`).
- `src/dqm3/data.json` : données (M monstres, T traits, A compétences, K/W talents, I objets, P lieux, S sprite).
- `assets/dqm3/` : sprite des monstres, fonds (`scene.webp` = fond château/lune), référencés depuis `style.css`.
- `vite.config.mjs` : Vite + `vite-plugin-singlefile` → un seul fichier `dist/carnet.html` (images et données incluses), copié dans `docs/index.html` (GitHub Pages). Jeu choisi par la variable `JEU` (défaut `dqm3`).
- Node n'est pas installé : tout passe par Deno (`deno install`, `deno task dev`, `deno task build`, `deno run -A tests/t5.js`). Chromium Playwright : `deno run -A npm:playwright install chromium`. Si un test échoue avec « Descripteur non valide (os error 6) », c'est le lancement du navigateur par Deno : relancer.
- Git : dépôt relié à https://github.com/romusan495/Monstrodex-Dragonquestmonster (branche `main`). Git est dans `C:\Program Files\Git\cmd` (pas forcément dans le PATH d'une session déjà ouverte). GitHub Pages sert `main` / `/docs` (https://romusan495.github.io/Monstrodex-Dragonquestmonster/) : `deno task build` puis commit + push de `docs/index.html` met le site à jour.
- `tools/bg_gen.py` + `tools/bg_render.js` : génèrent le fond en SVG puis en image.
- `tests/*.js` : tests Playwright sur `dist/carnet.html` et `docs/index.html` (lancer le build avant).

## À savoir
- Onglets : Carnet, Synthèse (Fusionner, Obtenir un monstre, Faisables, Monstre ultime), Talents, Astuces.
- Moteur « Monstre ultime » : table de coûts minimaux par masque de talents (max 3), fusion +3, fusion à 4 monstres +6, monstre déjà possédé = 0. Évolutions de talents via la table PRE.
- Un monstre « possédé » se coche aussi depuis les arbres de l'onglet Synthèse.
- Le site existe aussi comme artifact Claude (https://claude.ai/artifact/J9V6qUXhNybjy5iAnWCRFg) : le fichier source est le même.
- Animations CSS désactivées si `prefers-reduced-motion`.

## Prévu
- Générer des fonds illustrés avec FLUX.1 schnell (ComfyUI dans `J:\Outil\IA\ComfyUI_windows_portable`) via le serveur MCP `comfyui-mcp`.
- Ajouter d'autres jeux : un dossier `src/<jeu>/` par jeu, avec son thème et son fond.
