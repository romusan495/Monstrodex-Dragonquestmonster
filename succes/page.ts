// Page affichée dans la fenêtre du traqueur.
export const TITRE = "Succès Steam · L'antre de Romusan";

export const PAGE = /* html */ `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITRE}</title>
<style>
:root {
  --fond: #12141a; --carte: #1b1f28; --carte2: #222734; --bord: #2c3242;
  --texte: #e8eaf0; --doux: #9aa1b2; --accent: #e3b341; --vert: #4cc38a; --rouge: #e5534b;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--fond); color: var(--texte); font: 14px/1.4 "Segoe UI", system-ui, sans-serif; }
header { position: sticky; top: 0; z-index: 2; background: var(--fond); padding: 10px 12px 8px; border-bottom: 1px solid var(--bord); }
.ligne { display: flex; gap: 6px; align-items: center; }
select, button { font: inherit; color: var(--texte); background: var(--carte2); border: 1px solid var(--bord); border-radius: 6px; padding: 4px 8px; }
select { flex: 1; min-width: 0; }
button { cursor: pointer; white-space: nowrap; }
button[aria-pressed="true"] { background: var(--accent); color: #1a1405; border-color: var(--accent); }
#etat { font-size: 12px; color: var(--doux); margin: 6px 0 4px; }
#etat b { color: var(--vert); font-weight: 600; }
.barre { height: 6px; background: var(--carte2); border-radius: 3px; overflow: hidden; }
.barre i { display: block; height: 100%; background: var(--accent); transition: width .4s; }
#total { display: flex; justify-content: space-between; font-size: 12px; color: var(--doux); margin-top: 4px; }
.filtres { margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap; }
.filtres button { padding: 2px 8px; font-size: 12px; }
main { padding: 8px 12px 16px; display: grid; gap: 6px; }
.s { display: grid; grid-template-columns: 48px 1fr; gap: 10px; background: var(--carte); border: 1px solid var(--bord); border-radius: 8px; padding: 8px; }
.s img { width: 48px; height: 48px; border-radius: 4px; background: var(--carte2); }
.s.fait { opacity: .6; }
.s.nouveau { border-color: var(--vert); animation: eclat 1.5s 3; }
@keyframes eclat { 50% { box-shadow: 0 0 0 3px #4cc38a55; } }
.nom { font-weight: 600; }
.desc { color: var(--doux); font-size: 13px; }
.meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px; color: var(--doux); margin-top: 3px; }
.rare { color: var(--accent); }
.s .barre { margin-top: 4px; height: 4px; }
.voile { cursor: pointer; font-style: italic; }
.vide { color: var(--doux); text-align: center; padding: 24px 8px; }
#ou { margin: 2px 0; font-size: 13px; }
#ou label { color: var(--doux); white-space: nowrap; }
.petit { font-size: 11px; color: var(--doux); margin-bottom: 4px; }
#ou[hidden] + .petit { display: none; }
h2 { font-size: 13px; margin: 8px 0 0; color: var(--vert); text-transform: uppercase; letter-spacing: .04em; }
h2.alerte { color: var(--rouge); }
h2.doux { color: var(--doux); }
.conseil { font-size: 12px; margin-top: 3px; color: var(--texte); }
.conseil a, .source a { color: var(--accent); }
.meta .rate { color: var(--rouge); }
.meta .aconf { color: #c9a0ff; }
.source { font-size: 11px; color: var(--doux); margin: 8px 0 0; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<header>
  <div class="ligne">
    <select id="jeu" aria-label="Jeu"></select>
    <button id="epingle" aria-pressed="true" title="Garder la fenêtre au-dessus du jeu">📌</button>
  </div>
  <div id="etat">Lecture des succès…</div>
  <div id="ou" class="ligne" hidden>
    <label for="etape">Où j'en suis</label>
    <select id="etape"></select>
  </div>
  <div id="ouinfo" class="petit"></div>
  <div class="barre"><i id="prog" style="width:0"></i></div>
  <div id="total"></div>
  <div class="filtres" role="group" aria-label="Filtre">
    <button data-f="afaire" aria-pressed="true">À faire</button>
    <button data-f="faits" aria-pressed="false">Faits</button>
    <button data-f="tous" aria-pressed="false">Tous</button>
    <button id="caches" aria-pressed="false" title="Afficher la description des succès cachés">Révéler les cachés</button>
  </div>
</header>
<main id="liste"></main>
<script>
const $ = (id) => document.getElementById(id);
const memo = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch {} };
let filtre = memo("filtre") || "afaire", revele = memo("caches") === "1", choix = "auto";
const vus = new Set(), devoiles = new Set();
let dernier = null, appidAffiche = null, faitsAvant = null;

const echap = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dateFr = (t) => new Date(t * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function majBoutons() {
  for (const b of document.querySelectorAll("[data-f]")) b.setAttribute("aria-pressed", b.dataset.f === filtre);
  $("caches").setAttribute("aria-pressed", revele);
}

// Nom d'une étape, sans divulgâcher : celui d'un succès caché pas encore obtenu reste masqué.
function nomEtape(sec, i, j) {
  if (sec.nom) return sec.nom;
  const s = j.succes.find((x) => x.id === sec.atteinte);
  if (!s) return "Étape " + (i + 1);
  return s.cache && !s.fait && !revele ? "Étape " + (i + 1) + " (cachée)" : "Après « " + s.nom + " »";
}

function carte(s, nouveaux, info, extra) {
  const voile = s.cache && !s.fait && !revele && !devoiles.has(s.id);
  const meta = [];
  if (extra) meta.push('<span class="' + extra.cls + '">' + echap(extra.txt) + "</span>");
  if (s.rarete != null) meta.push('<span class="' + (s.rarete < 10 ? "rare" : "") + '">' + s.rarete.toFixed(1).replace(".", ",") + " % des joueurs</span>");
  if (s.cache) meta.push("<span>caché</span>");
  if (s.fait && s.date) meta.push("<span>obtenu le " + dateFr(s.date) + "</span>");
  if (s.progres && !s.fait) meta.push("<span>" + Math.floor(s.progres.val) + " / " + s.progres.max + "</span>");
  if (info?.aConfirmer && !voile) meta.push('<span class="aconf">à confirmer</span>');
  return '<article class="s' + (s.fait ? " fait" : "") + (nouveaux.has(s.id) ? " nouveau" : "") + '">'
    + '<img alt="" loading="lazy" src="' + echap(s.fait ? s.icone : s.iconeGrise) + '">'
    + "<div>" + (voile
      ? '<div class="nom voile" data-id="' + echap(s.id) + '" title="Cliquer pour révéler">Succès caché</div><div class="desc voile" data-id="' + echap(s.id) + '">Cliquer pour révéler</div>'
      : '<div class="nom">' + echap(s.nom) + '</div><div class="desc">' + echap(s.desc || "—") + "</div>"
        + (info?.conseil ? '<div class="conseil">' + echap(info.conseil) + (info.lien ? ' <a href="' + echap(info.lien) + '" target="_blank" rel="noopener">Voir</a>' : "") + "</div>" : ""))
    + (s.progres && !s.fait ? '<div class="barre"><i style="width:' + (100 * s.progres.val / s.progres.max) + '%"></i></div>' : "")
    + '<div class="meta">' + meta.join("") + "</div></div></article>";
}

// Liste des étapes : reconstruite seulement si elle change, et jamais pendant que la liste est ouverte.
function majEtapes(j, f, e) {
  $("ou").hidden = !f;
  if (!f) return null;
  const iAuto = f.sections.findIndex((x) => x.id === e.auto);
  const iMan = f.sections.findIndex((x) => x.id === e.manuelle);
  const iPos = Math.max(iAuto, iMan);
  const html = '<option value="auto">Automatique : ' + echap(nomEtape(f.sections[iAuto], iAuto, j)) + "</option>"
    + f.sections.map((x, i) => '<option value="' + echap(x.id) + '"' + (i < iAuto ? " disabled" : "") + ">" + echap(nomEtape(x, i, j)) + "</option>").join("");
  const sel = $("etape");
  if (sel.dataset.html !== html && document.activeElement !== sel) { sel.innerHTML = html; sel.dataset.html = html; }
  if (document.activeElement !== sel) sel.value = iMan > iAuto ? e.manuelle : "auto";
  $("ouinfo").textContent = iMan > iAuto ? "choisie à la main" : "d'après tes succès";
  return iPos;
}

function afficher() {
  const j = dernier?.jeu;
  if (!j) { $("ou").hidden = true; $("liste").innerHTML = '<p class="vide">Aucun jeu avec des succès.</p>'; return; }
  const faits = j.succes.filter((s) => s.fait).length, total = j.succes.length;
  $("prog").style.width = (100 * faits / total) + "%";
  $("total").innerHTML = "<span>" + faits + " / " + total + " succès</span><span>" + Math.round(100 * faits / total) + " %</span>";

  // Nouveaux succès depuis le dernier passage (même jeu).
  const nouveaux = new Set();
  if (appidAffiche === j.appid && faitsAvant) for (const s of j.succes) if (s.fait && !faitsAvant.has(s.id)) nouveaux.add(s.id);
  appidAffiche = j.appid; faitsAvant = new Set(j.succes.filter((s) => s.fait).map((s) => s.id));

  const f = dernier.fiche, iPos = majEtapes(j, f, dernier.etape);
  const idx = (id) => f ? f.sections.findIndex((x) => x.id === id) : -1;
  const info = (s) => f?.succes[s.id];

  let l = j.succes.filter((s) => filtre === "tous" || (filtre === "faits") === s.fait);
  // Le plus avancé d'abord, puis le plus courant (souvent le plus facile).
  l.sort((a, b) => filtre === "faits" ? (b.date ?? 0) - (a.date ?? 0)
    : (a.fait - b.fait) || ((b.progres ? b.progres.val / b.progres.max : 0) - (a.progres ? a.progres.val / a.progres.max : 0)) || ((b.rarete ?? -1) - (a.rarete ?? -1)));
  if (!l.length) { $("liste").innerHTML = '<p class="vide">' + (filtre === "afaire" ? "Tout est fait. Bravo !" : "Rien ici pour l'instant.") + "</p>"; return; }

  if (!f || filtre !== "afaire") { $("liste").innerHTML = l.map((s) => carte(s, nouveaux, info(s))).join(""); return; }

  // Avec une fiche : regroupement selon l'étape où tu en es.
  const groupes = { derniere: [], maintenant: [], plusTard: [], rates: [] };
  for (const s of l) {
    const i = info(s) ?? {}, d = i.depuis ? idx(i.depuis) : -1, fin = i.jusqua ? idx(i.jusqua) : Infinity;
    if (iPos > fin) groupes.rates.push(carte(s, nouveaux, i, { cls: "rate", txt: "raté après : " + nomEtape(f.sections[fin], fin, j) }));
    else if (d > iPos) groupes.plusTard.push({ d, html: carte(s, nouveaux, i, { cls: "", txt: "à partir de : " + nomEtape(f.sections[d], d, j) }) });
    else if (iPos === fin) groupes.derniere.push(carte(s, nouveaux, i, { cls: "rate", txt: "dernière chance avant l'étape suivante" }));
    else groupes.maintenant.push(carte(s, nouveaux, i));
  }
  groupes.plusTard.sort((a, b) => a.d - b.d);
  const bloc = (titre, cartes, cls) => cartes.length ? '<h2 class="' + (cls || "") + '">' + titre + " (" + cartes.length + ")</h2>" + cartes.join("") : "";
  $("liste").innerHTML = bloc("Dernière chance ici", groupes.derniere, "alerte")
    + bloc("Faisables maintenant", groupes.maintenant)
    + bloc("Plus tard", groupes.plusTard.map((x) => x.html), "doux")
    + bloc("Ratés pour cette partie", groupes.rates, "doux")
    + (f.note || f.sources?.length ? '<p class="source">' + echap(f.note || "") + (f.sources || []).map((x) => ' <a href="' + echap(x.url) + '" target="_blank" rel="noopener">' + echap(x.titre) + "</a>").join(" ·") + "</p>" : "");
}

async function rafraichir() {
  try {
    const r = await fetch("/api/etat?appid=" + choix);
    dernier = await r.json();
    const e = dernier.lance;
    $("etat").innerHTML = e ? "Jeu lancé : <b>" + echap(dernier.nomLance) + "</b>"
      : "Aucun jeu lancé" + (choix === "auto" && dernier.jeu ? " — dernier joué : " + echap(dernier.jeu.nom) : "");
    if (e && dernier.jeu && dernier.jeu.appid !== e) $("etat").innerHTML += " — affiché : " + echap(dernier.jeu.nom);
    afficher();
  } catch { $("etat").textContent = "Le traqueur ne répond plus (fenêtre à fermer)."; }
}

async function chargerJeux() {
  const jeux = await (await fetch("/api/jeux")).json();
  $("jeu").innerHTML = '<option value="auto">Automatique (jeu lancé)</option>'
    + jeux.map((j) => '<option value="' + j.appid + '">' + echap(j.nom) + " — " + j.faits + "/" + j.total + "</option>").join("");
  $("jeu").value = choix;
}

$("etape").onchange = async () => {
  await fetch("/api/position?appid=" + dernier.jeu.appid + "&section=" + encodeURIComponent($("etape").value), { method: "POST" });
  $("etape").blur();
  rafraichir();
};
$("jeu").onchange = () => { choix = $("jeu").value; appidAffiche = null; rafraichir(); };
for (const b of document.querySelectorAll("[data-f]")) b.onclick = () => { filtre = b.dataset.f; memo("filtre", filtre); majBoutons(); afficher(); };
$("caches").onclick = () => { revele = !revele; memo("caches", revele ? "1" : "0"); majBoutons(); afficher(); };
$("liste").onclick = (ev) => { const id = ev.target.closest(".voile")?.dataset.id; if (id) { devoiles.add(id); afficher(); } };
$("epingle").onclick = async () => {
  const oui = $("epingle").getAttribute("aria-pressed") !== "true";
  const r = await (await fetch("/api/epingler?oui=" + (oui ? 1 : 0), { method: "POST" })).json();
  $("epingle").setAttribute("aria-pressed", r.oui);
};

majBoutons();
rafraichir();
chargerJeux();
setInterval(rafraichir, 3000);
setInterval(chargerJeux, 60000);
</script>
</body>
</html>`;
