# L'antre de Romusan : carnet et astuces pour mes jeux

Projet de Romuald (francophone). Le site s'appelle « L'antre de Romusan ». Il regroupe, par jeu, les astuces et outils que les autres sites donnent mal ou pas du tout. Un dossier par jeu, et la racine du site est la page d'accueil :
- `/` : accueil (une carte par jeu) ;
- `/dqm3/` : Dragon Quest Monsters : Le Prince des Ténèbres ;
- `/mw4/` : Call of Duty: Modern Warfare 4.
Chaque page de jeu a la pastille « L'antre de Romusan » (lien vers l'accueil) et un sélecteur de jeu, avec des liens absolus vers https://romusan495.github.io/antre-de-romusan/… (ils marchent aussi dans l'artifact).

## Règles de travail
- Tout le texte du site est en **français**. Utiliser les **noms officiels français du jeu** (wiki wikidragonquest.fr, exports HTML/JSON fournis par Romuald). Le wiki bloque les robots : ne pas contourner, demander les exports.
- Les règles de jeu non confirmées sont signalées « à confirmer » dans le site.
- Ne pas copier de captures ni de textes d'autres sites (droits d'auteur). Citer les sources avec lien. Pas d'illustrations officielles des jeux : les fonds sont originaux.
- Exception voulue par Romuald : la page MW4 reprend la tier list et les classes (accessoires, niveaux) de wzstats.gg, avec un lien vers la page d'origine sur chaque arme. Ne pas reprendre leurs textes ni leurs articles.
- Répondre en français, sobrement, résultat d'abord.

## Structure
- `src/<jeu>/index.html` + `style.css` + `main.js` (+ données JSON) pour chaque jeu ; `src/accueil/` pour la page d'accueil.
- `src/dqm3/data.json` : données (M monstres, T traits, A compétences, K/W talents, I objets, P lieux, S sprite).
- `src/mw4/data.json` : catégories, noms d'emplacements et de styles de classe en français. `src/mw4/classes.json` : généré par la veille (ne pas éditer à la main).
- `assets/<jeu>/scene.webp` : fond du jeu (FLUX, voir plus bas) ; `assets/accueil/` : vignettes des cartes ; `assets/site/` : icône du site (SVG + PNG 180 px rendu par `tools/icon_png.js`).
- `vite.config.mjs` : Vite + `vite-plugin-singlefile` → un fichier HTML par page (images, données et icônes incluses), copié selon `SORTIES` : accueil → `docs/index.html` ; dqm3 → `dist/carnet.html` + `docs/dqm3/index.html` ; mw4 → `dist/mw4.html` + `docs/mw4/index.html`. `deno task build` construit tout ; `deno task dev` (dqm3), `deno task dev:mw4`, ou `JEU=<jeu>`.
- Veille méta MW4 : `tools/mw4_veille.ts` lit le JSON `ng-state` de https://wzstats.gg/fr/mw4/meta, relit les pages d'armes dont la classe a changé (`--tout` pour toutes), écrit `src/mw4/classes.json` (seulement s'il change), `veille/mw4-etat.json` et `veille/mw4-rapport.md` (`veille/` non versionné). Dernières lignes de sortie : `SITE_MODIFIE=` et `CHANGEMENTS=`. Tâche programmée `veille-meta-mw4` (app Claude, tous les jours à 19h).
- Node n'est pas installé : tout passe par Deno (`deno install`, `deno task dev`, `deno task build`, `deno run -A tests/t5.js`). Chromium Playwright : `deno run -A npm:playwright install chromium`. Si un test échoue avec « Descripteur non valide (os error 6) », c'est le lancement du navigateur par Deno : relancer.
- Git : dépôt https://github.com/romusan495/antre-de-romusan (branche `main`). Git est dans `C:\Program Files\Git\cmd` (pas forcément dans le PATH d'une session déjà ouverte). GitHub Pages sert `main` / `/docs` (https://romusan495.github.io/antre-de-romusan/) : `deno task build` puis commit + push de `docs/` met le site à jour.
- `tests/*.js` : tests Playwright (DQM3 : t5 à t20 sur `dist/carnet.html` et `docs/dqm3/index.html` ; MW4 + accueil : t21). Lancer le build avant.

## À savoir
- DQM3, onglets : Carnet, Synthèse (Fusionner, Obtenir un monstre, Faisables, Monstre ultime), Talents, Astuces.
- Moteur « Monstre ultime » : table de coûts minimaux par masque de talents (max 3), fusion +3, fusion à 4 monstres +6, monstre déjà possédé = 0. Évolutions de talents via la table PRE.
- Un monstre « possédé » se coche aussi depuis les arbres de l'onglet Synthèse.
- DQM3 existe aussi comme artifact Claude (https://claude.ai/artifact/J9V6qUXhNybjy5iAnWCRFg), publié depuis `dist/carnet.html`.
- MW4, onglets : Armes (triées par tier, filtre par catégorie, classes avec accessoires et niveaux, lien source), Veille méta.
- Animations CSS désactivées si `prefers-reduced-motion`.
- Fonds FLUX.1 schnell : ComfyUI dans `J:\Outil\IA\ComfyUI_windows_portable` (lancer `python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build`), puis `deno run -A tools/flux_gen.ts <prompts.json> <dossier>`. Modèle chargé en fp8 (16 Go de VRAM). Pas de personnages ni de logos officiels dans les prompts. Propositions dans `assets/<jeu>/propositions/` (non versionné).

## Prévu
- Ajouter d'autres jeux : un dossier `src/<jeu>/`, une entrée dans `SORTIES`, une carte sur l'accueil et un lien dans le sélecteur de chaque page.
