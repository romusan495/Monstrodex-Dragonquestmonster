// Scan de l'écran de jeu : un PowerShell caché (scan.ps1) capture l'écran et lit le texte ;
// ici on rapproche ce texte des succès (noms propres des descriptions, mots-clés des fiches) et des étapes.
// Rien n'est conservé : la capture est effacée aussitôt, seul le dernier texte lu reste dans scan.json.
import { dossierDonnees, type Jeu } from "./steam.ts";
import { lancerCache } from "./windows.ts";
import type { Fiche } from "./fiches.ts";

const fichierConfig = `${dossierDonnees}\\scan-config.json`;
const fichierScan = `${dossierDonnees}\\scan.json`;
const RETENUE = 5 * 60_000; // un succès repéré reste affiché 5 min après sa dernière apparition

type Config = { voulu: boolean; actif: boolean; intervalle: number; ecran: string; demande: number };
let config: Config = { voulu: true, actif: false, intervalle: 60, ecran: "", demande: 0 };
try { config = { ...config, ...JSON.parse(Deno.readTextFileSync(fichierConfig)) }; } catch { /* réglages par défaut */ }
const ecrireConfig = () => Deno.writeTextFileSync(fichierConfig, JSON.stringify(config));

export function demarrerScan() {
  // Le script est intégré à l'exe ; PowerShell a besoin d'un vrai fichier (avec BOM pour les accents).
  const script = `${dossierDonnees}\\scan.ps1`;
  const src = Deno.readTextFileSync(`${import.meta.dirname}/scan.ps1`).replace(/^\uFEFF/, "");
  Deno.writeTextFileSync(script, "\uFEFF" + src);
  config.actif = false;
  ecrireConfig();
  const ps = `${Deno.env.get("SystemRoot") ?? "C:\\Windows"}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
  return lancerCache(`"${ps}" -NoProfile -ExecutionPolicy Bypass -File "${script}" -Dossier "${dossierDonnees}" -Parent ${Deno.pid}`);
}

/** Le scan ne tourne que si l'utilisateur le veut et qu'un jeu est lancé. */
export function majJeuLance(lance: boolean) {
  const actif = config.voulu && lance;
  if (actif !== config.actif) { config.actif = actif; ecrireConfig(); }
}
export function reglerScan(r: { voulu?: boolean; ecran?: string; maintenant?: boolean }) {
  if (r.voulu !== undefined) config.voulu = r.voulu;
  if (r.ecran !== undefined) config.ecran = r.ecran;
  if (r.maintenant) config.demande = Date.now();
  ecrireConfig();
}

// ---- Rapprochement ----
const norm = (s: string) => " " + s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
const MOTS_VIDES = new Set(norm(`vous avez decerne decernee gagner gagnez terminer terminez termine obtenir obtenez obtenu tuer tuez battre battez vaincre
  vaincu trouver trouvez finir finissez atteindre atteignez collecter collectez recuperer recuperez ouvrir ouvrez utiliser utilisez completer completez
  debloquer debloquez acheter achetez remporter remportez devenir devenez faire faites jouer jouez reussir reussissez les le la un une des en dans pour
  avec sans tous toutes tout toute mode chapitre niveau partie jeu mission succes difficulte normal facile difficile`).trim().split(" "));

/** Noms propres d'un texte : suites de mots à majuscule (« Colibron Plaza », « Frère Cardoza »), sans le mot de début de phrase. */
export function nomsPropres(texte: string): string[] {
  const res: string[] = [];
  const re = /\p{Lu}[\p{L}’'-]+(?:\s+(?:(?:de|du|des|la|le)\s+|d[’'])?\p{Lu}[\p{L}’'-]+)*/gu;
  for (const m of texte.matchAll(re)) {
    let mots = m[0].split(/\s+/);
    const debutPhrase = m.index === 0 || /[.!?:]\s*$/.test(texte.slice(0, m.index));
    if (debutPhrase || MOTS_VIDES.has(norm(mots[0]).trim())) mots = mots.slice(1);
    while (mots.length && MOTS_VIDES.has(norm(mots[0]).trim())) mots = mots.slice(1);
    const p = mots.join(" ");
    if (norm(p).trim().length >= 4) res.push(p);
  }
  return res;
}

type Scan = { t: number; ecran?: string; lignes: string[]; erreur?: string; ecrans?: { nom: string; largeur: number; hauteur: number; principal: boolean }[] };
let scan: Scan | null = null, scanMtime = 0;
function lireScan() {
  try {
    const m = Deno.statSync(fichierScan).mtime?.getTime() ?? 0;
    if (m !== scanMtime) { scanMtime = m; scan = JSON.parse(Deno.readTextFileSync(fichierScan).replace(/^\uFEFF/, "")); }
  } catch { /* pas encore de scan */ }
  return scan;
}

const reperes = new Map<number, Map<string, { mot: string; t: number; cle: boolean }>>();
// Mots vus à presque chaque scan (interface du jeu, pouvoir toujours affiché…) : ignorés, ils ne disent rien de l'endroit.
const vusParScan = new Map<number, { scans: number; vus: Map<string, number> }>();
const permanent = (appid: number, mot: string) => {
  const v = vusParScan.get(appid);
  return !!v && v.scans >= 5 && (v.vus.get(mot) ?? 0) / v.scans > 0.6;
};
const etapeVue = new Map<number, string>();
const traite = new Map<number, number>(); // dernier scan traité, par jeu

export function etatEcran(jeu: Jeu | null, fiche: Fiche | null) {
  const s = lireScan();
  const info = {
    voulu: config.voulu, actif: config.actif, intervalle: config.intervalle, ecran: config.ecran,
    t: s?.t ?? null, ecranLu: s?.ecran ?? null, ecrans: s?.ecrans ?? [], erreur: s?.erreur ?? null, lignes: s?.lignes.length ?? 0,
    reperes: {} as Record<string, string>, etape: null as string | null,
  };
  if (!jeu) return info;
  const r = reperes.get(jeu.appid) ?? new Map();
  reperes.set(jeu.appid, r);
  if (s && config.actif && traite.get(jeu.appid) !== s.t && s.lignes.length) {
    traite.set(jeu.appid, s.t);
    const texte = norm(s.lignes.join(" "));
    const vu = (k: string) => norm(k).trim().length >= 4 && texte.includes(norm(k));
    const stats = vusParScan.get(jeu.appid) ?? { scans: 0, vus: new Map<string, number>() };
    vusParScan.set(jeu.appid, stats);
    stats.scans++;
    const vusCeScan = new Set<string>();
    for (const a of jeu.succes) {
      if (a.fait) continue;
      // Les mots-clés de la fiche sont choisis à la main : jamais ignorés. Les noms propres trouvés seuls, si.
      const cles = (fiche?.succes[a.id]?.motsCles ?? []).filter(vu);
      const noms = nomsPropres(a.desc).filter(vu);
      noms.forEach((m) => vusCeScan.add(m));
      const mot = cles[0] ?? noms.find((m) => !permanent(jeu.appid, m));
      if (mot) r.set(a.id, { mot, t: s.t, cle: !!cles[0] });
    }
    for (const m of vusCeScan) stats.vus.set(m, (stats.vus.get(m) ?? 0) + 1);
    // Étape : la plus avancée dont un mot-clé est à l'écran.
    for (const sec of fiche?.sections ?? []) if ((sec.motsCles ?? []).some(vu)) etapeVue.set(jeu.appid, sec.id);
  }
  const maintenant = Date.now();
  for (const [id, v] of r) {
    const perime = maintenant - v.t > RETENUE || (!v.cle && permanent(jeu.appid, v.mot)) || jeu.succes.find((a) => a.id === id)?.fait;
    if (perime) r.delete(id); else info.reperes[id] = v.mot;
  }
  info.etape = etapeVue.get(jeu.appid) ?? null;
  return info;
}
