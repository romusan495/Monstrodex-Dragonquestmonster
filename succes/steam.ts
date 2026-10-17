// Lecture locale des succès Steam : appcache/stats (schéma + progression du compte), sans clé API.
import { HKCU, regDword, regTexte } from "./windows.ts";

const BASE_STEAMID = 76561197960265728n;

export type Succes = {
  id: string; nom: string; desc: string; cache: boolean;
  fait: boolean; date: number | null;
  icone: string; iconeGrise: string;
  progres: { val: number; max: number } | null;
  rarete: number | null;
};
export type Jeu = { appid: number; nom: string; succes: Succes[] };
export type JeuListe = { appid: number; nom: string; faits: number; total: number; joue: number };

// ---- KeyValues binaires de Steam ----
const dec = new TextDecoder();
// deno-lint-ignore no-explicit-any
export function lireKV(buf: Uint8Array): any {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let i = 0;
  const str = () => { const d = i; while (i < buf.length && buf[i] !== 0) i++; const r = dec.decode(buf.subarray(d, i)); i++; return r; };
  const wstr = () => { let s = ""; for (;;) { const c = dv.getUint16(i, true); i += 2; if (!c) return s; s += String.fromCharCode(c); } };
 
  const obj = (): any => {
    const o: Record<string, unknown> = {};
    while (i < buf.length) {
      const t = buf[i++];
      if (t === 8 || t === 11) return o;
      const k = str();
      switch (t) {
        case 0: o[k] = obj(); break;
        case 1: o[k] = str(); break;
        case 5: o[k] = wstr(); break;
        case 2: case 4: case 6: o[k] = dv.getInt32(i, true); i += 4; break;
        case 3: o[k] = dv.getFloat32(i, true); i += 4; break;
        case 7: o[k] = Number(dv.getBigUint64(i, true)); i += 8; break;
        case 10: o[k] = Number(dv.getBigInt64(i, true)); i += 8; break;
        default: throw new Error(`KeyValues : type ${t} inconnu (octet ${i})`);
      }
    }
    return o;
  };
  return obj();
}

// ---- Emplacements ----
export const dossierSteam = (regTexte(HKCU, "Software\\Valve\\Steam", "SteamPath") ?? "C:/Program Files (x86)/Steam").replaceAll("/", "\\");
const dossierStats = `${dossierSteam}\\appcache\\stats`;

/** Identifiant du jeu lancé dans Steam (0 si aucun). */
export const jeuLance = () => regDword(HKCU, "Software\\Valve\\Steam", "RunningAppID") ?? 0;

function lireTexte(f: string) { try { return Deno.readTextFileSync(f); } catch { return ""; } }
const mtime = (f: string) => { try { return Deno.statSync(f).mtime?.getTime() ?? 0; } catch { return 0; } };

/** Compte Steam : le plus récent de loginusers.vdf, sinon celui du dernier fichier de stats. */
function trouverCompte(): string {
  const vdf = lireTexte(`${dossierSteam}\\config\\loginusers.vdf`);
  const comptes = [...vdf.matchAll(/"(\d{17})"\s*\{([^}]*)\}/g)].map((m) => ({ id: m[1], recent: /"MostRecent"\s*"1"/.test(m[2]) }));
  const c = comptes.find((x) => x.recent) ?? comptes[0];
  if (c) return String(BigInt(c.id) - BASE_STEAMID);
  let meilleur = "", t = 0;
  for (const e of Deno.readDirSync(dossierStats)) {
    const m = e.name.match(/^UserGameStats_(\d+)_\d+\.bin$/);
    if (m && mtime(`${dossierStats}\\${e.name}`) > t) { t = mtime(`${dossierStats}\\${e.name}`); meilleur = m[1]; }
  }
  return meilleur;
}
export const compte = trouverCompte();

/** Date de dernière partie par jeu, lue dans userdata/<compte>/config/localconfig.vdf (rechargée si le fichier change). */
let dernieresParties = { t: -1, m: new Map<number, number>() };
function lireDernieresParties() {
  const f = `${dossierSteam}\\userdata\\${compte}\\config\\localconfig.vdf`;
  const t = mtime(f);
  if (t === dernieresParties.t) return dernieresParties.m;
  const m = new Map<number, number>();
  // Parcours du VDF texte : on garde la pile des clés pour repérer …/apps/<appid>/LastPlayed.
  const pile: string[] = [];
  let cle: string | null = null;
  for (const [, chaine, acc] of lireTexte(f).matchAll(/"((?:[^"\\]|\\.)*)"|([{}])/g)) {
    if (acc === "{") { pile.push(cle ?? ""); cle = null; }
    else if (acc === "}") { pile.pop(); cle = null; }
    else if (cle === null) cle = chaine;
    else {
      if (cle === "LastPlayed" && pile.at(-2)?.toLowerCase() === "apps") m.set(+pile.at(-1)!, +chaine * 1000);
      cle = null;
    }
  }
  dernieresParties = { t, m };
  return m;
}

// Noms des jeux installés (appmanifest_*.acf de chaque bibliothèque).
const nomsInstalles = new Map<number, string>();
for (const m of lireTexte(`${dossierSteam}\\steamapps\\libraryfolders.vdf`).matchAll(/"path"\s*"([^"]+)"/g)) {
  const dossier = `${m[1].replaceAll("\\\\", "\\")}\\steamapps`;
  try {
    for (const e of Deno.readDirSync(dossier)) {
      const a = e.name.match(/^appmanifest_(\d+)\.acf$/);
      const nom = a && lireTexte(`${dossier}\\${e.name}`).match(/"name"\s*"([^"]+)"/)?.[1];
      if (a && nom) nomsInstalles.set(+a[1], nom);
    }
  } catch { /* bibliothèque absente */ }
}

// Noms français des jeux : demandés à la boutique Steam un par un, gardés sur le disque.
export const dossierDonnees = `${Deno.env.get("LOCALAPPDATA") ?? "."}\\AntreRomusan\\Succes`;
const fichierNoms = `${dossierDonnees}\\noms.json`;
const nomsBoutique = new Map<number, string>(Object.entries(JSON.parse(lireTexte(fichierNoms) || "{}")).map(([k, v]) => [+k, String(v)]));
const aDemander: number[] = [];
let demandeEnCours = false;
async function demanderNoms() {
  if (demandeEnCours) return;
  demandeEnCours = true;
  while (aDemander.length) {
    const appid = aDemander.shift()!;
    try {
      const j = await (await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=french&filters=basic`, { signal: AbortSignal.timeout(8000) })).json();
      const nom = j?.[appid]?.data?.name;
      nomsBoutique.set(appid, nom ?? "");
      Deno.mkdirSync(dossierDonnees, { recursive: true });
      Deno.writeTextFileSync(fichierNoms, JSON.stringify(Object.fromEntries(nomsBoutique)));
      for (const c of cache.values()) if (c.jeu.appid === appid && nom) c.jeu.nom = nom;
    } catch { /* hors ligne : on réessaiera au prochain lancement */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  demandeEnCours = false;
}
function nomDuJeu(appid: number, interne?: string, prioritaire = false) {
  // Nom français de la boutique en priorité ; en attendant, celui du jeu installé. Le jeu affiché passe en tête de file.
  if (!nomsBoutique.has(appid)) {
    const i = aDemander.indexOf(appid);
    if (i >= 0 && prioritaire) aDemander.splice(i, 1);
    if (i < 0 || prioritaire) { prioritaire ? aDemander.unshift(appid) : aDemander.push(appid); demanderNoms(); }
  }
  return nomsBoutique.get(appid) || nomsInstalles.get(appid) || interne || `Jeu ${appid}`;
}

const fichierSchema =(appid: number) => `${dossierStats}\\UserGameStatsSchema_${appid}.bin`;
const fichierStats = (appid: number) => `${dossierStats}\\UserGameStats_${compte}_${appid}.bin`;

const texte = (v: unknown): string =>
  typeof v === "string" ? v : v && typeof v === "object"
    ? String((v as Record<string, unknown>).french ?? (v as Record<string, unknown>).english ?? Object.values(v).find((x) => typeof x === "string") ?? "")
    : "";
const estSucces = (t: unknown) => ["ACHIEVEMENTS", "GROUPACHIEVEMENTS", "4", "5"].includes(String(t));
const f32 = (n: number) => new Float32Array(new Int32Array([n]).buffer)[0];
const CDN = "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps";

// ---- Rareté (API publique, sans clé), gardée en mémoire ----
const raretes = new Map<number, Promise<Map<string, number>>>();
function rarete(appid: number) {
  if (!raretes.has(appid)) {
    raretes.set(appid, fetch(`https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appid}`, { signal: AbortSignal.timeout(8000) })
      .then((r) => r.json())
      .then((j) => new Map<string, number>((j?.achievementpercentages?.achievements ?? []).map((a: { name: string; percent: string | number }) => [a.name, +a.percent])))
      .catch(() => { setTimeout(() => raretes.delete(appid), 60_000); return new Map<string, number>(); }));
  }
  return raretes.get(appid)!;
}

// ---- Lecture d'un jeu, en cache tant que les fichiers ne changent pas ----
const cache = new Map<number, { cle: string; jeu: Jeu }>();

export async function lireJeu(appid: number, avecRarete = true): Promise<Jeu | null> {
  const cle = `${mtime(fichierSchema(appid))}/${mtime(fichierStats(appid))}`;
  const r = avecRarete ? await rarete(appid) : new Map<string, number>();
  const c = cache.get(appid);
  if (c && c.cle === cle) {
    for (const s of c.jeu.succes) s.rarete ??= r.get(s.id) ?? null;
    c.jeu.nom = nomDuJeu(appid, c.jeu.nom, avecRarete);
    return c.jeu;
  }

  let schema;
  try { schema = Object.values(lireKV(Deno.readFileSync(fichierSchema(appid))))[0] as Record<string, any>; } catch { return null; }
  let donnees: Record<string, any> = {};
  try { donnees = lireKV(Deno.readFileSync(fichierStats(appid))).cache ?? {}; } catch { /* jamais lancé avec ce compte */ }

  const stats = (schema.stats ?? {}) as Record<string, any>;
  const valeurStat = new Map<string, number>();
  for (const [id, s] of Object.entries(stats)) {
    if (estSucces(s.type) || !s.name) continue;
    const brut = donnees[id]?.data ?? s.default ?? 0;
    valeurStat.set(s.name, String(s.type) === "FLOAT" || String(s.type) === "2" ? f32(brut) : brut);
  }

  const succes: Succes[] = [];
  for (const [id, s] of Object.entries(stats)) {
    if (!estSucces(s.type)) continue;
    const bits = donnees[id]?.data ?? 0, dates = donnees[id]?.AchievementTimes ?? {};
    for (const [b, a] of Object.entries(s.bits ?? {}) as [string, any][]) {
      const d = a.display ?? {}, p = a.progress;
      const op = p?.value?.operation === "statvalue" ? valeurStat.get(p.value.operand1) : undefined;
      succes.push({
        id: a.name, nom: texte(d.name) || a.name, desc: texte(d.desc),
        cache: String(d.hidden) === "1",
        fait: ((bits >>> +b) & 1) === 1, date: dates[b] ?? null,
        icone: d.icon ? `${CDN}/${appid}/${d.icon}` : "", iconeGrise: d.icon_gray ? `${CDN}/${appid}/${d.icon_gray}` : "",
        progres: op !== undefined && p.max_val > 0 ? { val: Math.min(op, p.max_val), max: p.max_val } : null,
        rarete: r.get(a.name) ?? null,
      });
    }
  }
  const jeu = { appid, nom: nomDuJeu(appid, schema.gamename, avecRarete), succes };
  cache.set(appid, { cle, jeu });
  return jeu;
}

/** Jeux du compte qui ont des succès, du plus récemment joué au plus ancien. */
export async function listerJeux(): Promise<JeuListe[]> {
  const liste: JeuListe[] = [];
  const prefixe = `UserGameStats_${compte}_`;
  const parties = lireDernieresParties();
  for (const e of Deno.readDirSync(dossierStats)) {
    if (!e.name.startsWith(prefixe)) continue;
    const appid = +e.name.slice(prefixe.length, -4);
    const j = await lireJeu(appid, false);
    if (j && j.succes.length) liste.push({ appid, nom: j.nom, faits: j.succes.filter((s) => s.fait).length, total: j.succes.length, joue: parties.get(appid) ?? 0 });
  }
  return liste.sort((a, b) => b.joue - a.joue);
}
