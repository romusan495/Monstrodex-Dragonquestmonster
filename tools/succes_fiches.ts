// Aide à l'écriture des fiches du traqueur de succès (utilisé par la tâche programmée « fiches-succes »).
//   deno run -A tools/succes_fiches.ts liste [mois=3]   jeux à traiter : file d'attente de l'exe + jeux joués récemment, non finis, sans fiche
//   deno run -A tools/succes_fiches.ts succes <appid>   succès du jeu (id, nom, description, caché, rareté) pour écrire la fiche
//   deno run -A tools/succes_fiches.ts valider [appid]  vérifie les fiches (identifiants de succès et d'étapes)
//   deno run -A tools/succes_fiches.ts retirer <appid>  retire le jeu de la file d'attente
import { dossierDonnees, lireJeu, listerJeux } from "../succes/steam.ts";
import type { Fiche } from "../succes/fiches.ts";

const DOSSIER = new URL("../succes/fiches/", import.meta.url);
const FILE = `${dossierDonnees}\\a-faire.json`;
const lireFile = (): Record<string, { nom: string; vu: string }> => { try { return JSON.parse(Deno.readTextFileSync(FILE)); } catch { return {}; } };
const aFiche = (appid: number) => { try { Deno.statSync(new URL(`${appid}.json`, DOSSIER)); return true; } catch { return false; } };

const [cmd, arg] = Deno.args;

if (cmd === "liste") {
  const mois = +(arg ?? 3), file = lireFile(), jeux = await listerJeux();
  const limite = Date.now() - mois * 30 * 864e5;
  const res = jeux
    .filter((j) => !aFiche(j.appid) && (file[j.appid] || (j.joue > limite && j.faits < j.total)))
    .map((j) => ({ appid: j.appid, nom: j.nom, faits: j.faits, total: j.total, dernierePartie: j.joue ? new Date(j.joue).toISOString().slice(0, 10) : null, enFile: !!file[j.appid] }));
  console.log(JSON.stringify(res, null, 1));
} else if (cmd === "succes") {
  const j = await lireJeu(+arg);
  if (!j) { console.error("Jeu inconnu (pas de schéma de succès en local)."); Deno.exit(1); }
  console.log(JSON.stringify({ appid: j.appid, nom: j.nom, succes: j.succes.map((s) => ({ id: s.id, nom: s.nom, desc: s.desc, cache: s.cache, rarete: s.rarete })) }, null, 1));
} else if (cmd === "valider") {
  let erreurs = 0;
  for (const e of Deno.readDirSync(DOSSIER)) {
    const appid = +e.name.replace(".json", "");
    if (!e.name.endsWith(".json") || (arg && appid !== +arg)) continue;
    const err = (m: string) => { erreurs++; console.log(`${e.name} : ${m}`); };
    let f: Fiche;
    try { f = JSON.parse(Deno.readTextFileSync(new URL(e.name, DOSSIER))); } catch (x) { err(`JSON invalide (${x})`); continue; }
    const j = await lireJeu(appid, false);
    const ids = new Set(j?.succes.map((s) => s.id) ?? []);
    const secs = new Set((f.sections ?? []).map((s) => s.id));
    if (!f.jeu) err("champ « jeu » manquant");
    if (!Array.isArray(f.sections) || typeof f.succes !== "object") err("« sections » ou « succes » manquant");
    if (!f.sansEtapes && !f.sections?.length) err("aucune étape (mettre sansEtapes: true si le jeu n'a pas d'histoire)");
    for (const s of f.sections ?? []) for (const a of [s.atteinte ?? []].flat()) if (j && !ids.has(a)) err(`étape ${s.id} : succès inconnu ${a}`);
    for (const [id, i] of Object.entries(f.succes ?? {})) {
      if (j && !ids.has(id)) err(`succès inconnu ${id}`);
      for (const k of ["depuis", "jusqua"] as const) if (i[k] && !secs.has(i[k]!)) err(`${id} : étape inconnue ${k}=${i[k]}`);
    }
    if (!j) console.log(`${e.name} : schéma Steam absent en local, identifiants non vérifiés`);
  }
  console.log(erreurs ? `${erreurs} erreur(s)` : "Fiches valides");
  Deno.exit(erreurs ? 1 : 0);
} else if (cmd === "retirer") {
  const file = lireFile();
  delete file[arg];
  Deno.writeTextFileSync(FILE, JSON.stringify(file, null, 1));
  console.log("Retiré de la file :", arg);
} else {
  console.log("Commandes : liste [mois] | succes <appid> | valider [appid] | retirer <appid>");
}
Deno.exit(0);
