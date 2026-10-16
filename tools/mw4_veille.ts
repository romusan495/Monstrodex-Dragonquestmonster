// Veille de la méta MW4 (multijoueur) sur wzstats.gg.
// - lit la tier list (page méta) et, pour chaque arme dont la classe a changé, sa page de classes ;
// - compare avec le passage précédent et écrit un rapport (veille/mw4-rapport.md) ;
// - écrit src/mw4/classes.json, utilisé par la page MW4 du site (source citée sur chaque arme).
// Usage : deno run -A tools/mw4_veille.ts   (option --tout : relire toutes les pages d'armes)
const BASE = "https://wzstats.gg/fr";
const URL_META = `${BASE}/mw4/meta`;
const UA = { "user-agent": "Mozilla/5.0 (veille perso antre-de-romusan)" };
const DIR = new URL("../veille/", import.meta.url);
const ETAT = new URL("mw4-etat.json", DIR);
const RAPPORT = new URL("mw4-rapport.md", DIR);
const SORTIE = new URL("../src/mw4/classes.json", import.meta.url);
const TIERS = ["META", "A", "B", "C", "D"];
const ORDRE_SLOTS = ["optic", "muzzle", "barrel", "underbarrel", "magazine", "ammunition", "rearGrip", "stock", "laser"];

type Acc = { slot: string; nom: string; niv: number };
type Build = { style: string; apex?: string; acc: Acc[] };
type Arme = { nom: string; cat: string; tier: string; rang: number; maj: string; builds: Build[] };
type Etat = { date: string; armes: Record<string, Arme> };

async function etatNg(url: string) {
  const html = await (await fetch(url, { headers: UA })).text();
  const m = html.match(/<script[^>]*id="ng-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`données ng-state introuvables sur ${url} : la structure du site a changé`);
  return JSON.parse(m[1]);
}

function builds(state: any, id: string): Build[] {
  const b = state[`store:builds-with-attachment-mw4-mw4-${id}`]?.builds;
  if (!Array.isArray(b)) throw new Error(`classes introuvables pour ${id} : la structure du site a changé`);
  return b.filter((x: any) => x.isPublished && x.type === "mw4")
    .sort((x: any, y: any) => (x.position ?? 99) - (y.position ?? 99))
    .map((x: any) => ({
      style: x.playstyle ?? "",
      ...(x.apex?.name ? { apex: x.apex.name } : {}),
      acc: ORDRE_SLOTS.filter((s) => x[s]?.name).map((s) => ({ slot: s, nom: x[s].name, niv: x[s].unlockedAtWeaponLevel ?? 0 })),
    }));
}

const meta = await etatNg(URL_META);
const store = meta["store:weapons-and-tier-lists-mw4"];
if (!store?.wzStatsTierList?.mw4) throw new Error("tier list MW4 introuvable : la structure du site a changé");
const infos: Record<string, any> = Object.fromEntries(store.weapons.map((w: any) => [w.id, w]));

let avant: Etat | null = null;
try { avant = JSON.parse(await Deno.readTextFile(ETAT)); } catch { /* premier passage */ }
const tout = Deno.args.includes("--tout");

const armes: Record<string, Arme> = {};
let lues = 0;
for (const tier of TIERS) {
  for (const [i, id] of (store.wzStatsTierList.mw4[tier] ?? []).entries()) {
    const w = infos[id] ?? {};
    const maj = w.mostRecentUpdatedAtByType?.mw4 ?? w.mostRecentUpdatedAt ?? "";
    const prec = avant?.armes[id];
    let b = prec?.builds;
    if (tout || !b || prec?.maj !== maj) {
      if (lues++) await new Promise((r) => setTimeout(r, 1500)); // une page à la fois, sans insister
      b = builds(await etatNg(`${BASE}/best-loadouts/${id}`), id);
    }
    armes[id] = { nom: w.name ?? id, cat: w.type?.id ?? "", tier, rang: i + 1, maj, builds: b ?? [] };
  }
}

const lien = (id: string) => `${BASE}/best-loadouts/${id}`;
const changements: string[] = [];
if (avant) {
  for (const [id, a] of Object.entries(armes)) {
    const b = avant.armes[id];
    if (!b) changements.push(`- **${a.nom}** apparaît en tier ${a.tier} ([classe](${lien(id)}))`);
    else {
      if (b.tier !== a.tier) {
        const sens = TIERS.indexOf(a.tier) < TIERS.indexOf(b.tier) ? "monte" : "descend";
        changements.push(`- **${a.nom}** ${sens} : ${b.tier} → ${a.tier} ([classe](${lien(id)}))`);
      }
      if (JSON.stringify(a.builds) !== JSON.stringify(b.builds ?? a.builds)) changements.push(`- Classe du **${a.nom}** modifiée ([voir](${lien(id)}))`);
    }
  }
  for (const [id, b] of Object.entries(avant.armes)) if (!armes[id]) changements.push(`- **${b.nom}** sort de la tier list`);
}

// Données du site : stables tant que rien ne change (pas de date du jour), pour ne committer que les vrais changements.
const majSite = Object.values(armes).map((a) => a.maj).filter(Boolean).sort().pop() ?? "";
const site = {
  source: URL_META,
  maj: majSite.slice(0, 10),
  armes: Object.entries(armes).map(([id, a]) => ({ id, nom: a.nom, cat: a.cat, tier: a.tier, rang: a.rang, lien: lien(id), builds: a.builds })),
};
const siteJson = JSON.stringify(site, null, 1) + "\n";
let siteAvant = "";
try { siteAvant = await Deno.readTextFile(SORTIE); } catch { /* absent */ }
if (siteJson !== siteAvant) await Deno.writeTextFile(SORTIE, siteJson);

const lignes = [
  `# Veille méta MW4 — ${new Date().toLocaleString("fr-FR")}`,
  "",
  !avant ? "Premier passage : état de référence enregistré." : changements.length ? "## Changements depuis le dernier passage" : "Aucun changement depuis le dernier passage.",
  ...changements,
  "",
  "## Tier list actuelle (multijoueur)",
  ...TIERS.map((t) => `- **${t}** : ${Object.values(armes).filter((a) => a.tier === t).map((a) => a.nom).join(", ") || "—"}`),
  "",
  `Pages d'armes relues : ${lues}. Source : ${URL_META}`,
];
await Deno.mkdir(DIR, { recursive: true });
await Deno.writeTextFile(RAPPORT, lignes.join("\n") + "\n");
await Deno.writeTextFile(ETAT, JSON.stringify({ date: new Date().toISOString(), armes }, null, 1));
console.log(lignes.join("\n"));
console.log(`\nSITE_MODIFIE=${siteJson !== siteAvant}`);
console.log(`CHANGEMENTS=${avant ? changements.length : "premier-passage"}`);
