// Fiches par jeu : étapes du jeu, et pour chaque succès l'étape où il devient faisable (et celle après laquelle il est raté).
// Fiches intégrées à l'exe (fiches/<appid>.json) ; une fiche du même nom dans %LOCALAPPDATA%\AntreRomusan\Succes\fiches la remplace.
import { dossierDonnees } from "./steam.ts";
import dqm3 from "./fiches/2175540.json" with { type: "json" };

export type Section = { id: string; nom?: string; atteinte?: string };
export type InfoSucces = { depuis?: string; jusqua?: string; conseil?: string; lien?: string; aConfirmer?: boolean };
export type Fiche = { jeu: string; sources?: { titre: string; url: string }[]; note?: string; sections: Section[]; succes: Record<string, InfoSucces> };

const integrees: Record<number, Fiche> = { 2175540: dqm3 };

export function fiche(appid: number): Fiche | null {
  try { return JSON.parse(Deno.readTextFileSync(`${dossierDonnees}\\fiches\\${appid}.json`)); } catch { /* pas de fiche perso */ }
  return integrees[appid] ?? null;
}

/** Étape atteinte d'après les succès débloqués : la plus avancée dont le succès « atteinte » est obtenu. */
export function positionAuto(f: Fiche, faits: Set<string>): string | null {
  let pos: string | null = null;
  for (const s of f.sections) if (s.atteinte && faits.has(s.atteinte)) pos = s.id;
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
