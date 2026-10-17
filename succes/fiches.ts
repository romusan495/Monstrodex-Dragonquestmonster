// Fiches par jeu : étapes du jeu, et pour chaque succès l'étape où il devient faisable (et celle après laquelle il est raté).
// Fiches intégrées à l'exe (tout le dossier fiches/, inclus au build avec --include) ;
// une fiche du même nom dans %LOCALAPPDATA%\AntreRomusan\Succes\fiches la remplace sans recompiler.
import { dossierDonnees } from "./steam.ts";

export type Section = { id: string; nom?: string; atteinte?: string | string[] }; // atteinte : un succès, ou plusieurs (l'un ou l'autre)
export type InfoSucces = { depuis?: string; jusqua?: string; conseil?: string; lien?: string; aConfirmer?: boolean };
export type Fiche = {
  jeu: string; sources?: { titre: string; url: string }[]; note?: string;
  sansEtapes?: boolean; // jeu sans histoire : pas d'étapes, la fiche sert seulement à ne pas le remettre en file
  sauvegarde?: { lisible: boolean; chemin?: string; note?: string };
  sections: Section[]; succes: Record<string, InfoSucces>;
};

const lireFiche = (f: string): Fiche | null => { try { return JSON.parse(Deno.readTextFileSync(f)); } catch { return null; } };
const dossierFiches = `${import.meta.dirname}/fiches`;

export function fiche(appid: number): Fiche | null {
  return lireFiche(`${dossierDonnees}\\fiches\\${appid}.json`) ?? lireFiche(`${dossierFiches}/${appid}.json`);
}

// Jeux lancés sans fiche : notés dans a-faire.json pour la tâche programmée qui écrit les fiches.
const fichierFile = `${dossierDonnees}\\a-faire.json`;
export function mettreEnFile(appid: number, nom: string) {
  let file: Record<string, { nom: string; vu: string }> = {};
  try { file = JSON.parse(Deno.readTextFileSync(fichierFile)); } catch { /* vide */ }
  if (file[appid]) return;
  file[appid] = { nom, vu: new Date().toISOString() };
  Deno.writeTextFileSync(fichierFile, JSON.stringify(file, null, 1));
}

/** Étape atteinte d'après les succès débloqués : la plus avancée dont le succès « atteinte » est obtenu. */
export function positionAuto(f: Fiche, faits: Set<string>): string | null {
  let pos: string | null = null;
  for (const s of f.sections) if ([s.atteinte ?? []].flat().some((id) => faits.has(id))) pos = s.id;
  return pos ?? f.sections[0]?.id ?? null;
}

// Étape choisie à la main, par jeu, gardée sur le disque.
const fichierPositions = `${dossierDonnees}\\positions.json`;
let positions: Record<string, string> = {};
try { positions = JSON.parse(Deno.readTextFileSync(fichierPositions)); } catch { /* aucune */ }

export const positionManuelle = (appid: number): string | null => positions[appid] ?? null;
export function choisirPosition(appid: number, section: string | null) {
  if (section) positions[appid] = section; else delete positions[appid];
  Deno.writeTextFileSync(fichierPositions, JSON.stringify(positions, null, 1));
}
