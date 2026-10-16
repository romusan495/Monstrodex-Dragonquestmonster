// Veille de la méta MW4 (multijoueur) sur wzstats.gg : compare la tier list et les dates de mise à jour
// des classes avec le passage précédent, et écrit un rapport.
// Usage : deno run -A tools/mw4_veille.ts
// État et rapports dans veille/ (non versionné). Usage personnel : une lecture de page par passage.
const URL_META = "https://wzstats.gg/fr/mw4/meta";
const DIR = new URL("../veille/", import.meta.url);
const ETAT = new URL("mw4-etat.json", DIR);
const RAPPORT = new URL("mw4-rapport.md", DIR);
const TIERS = ["META", "A", "B", "C", "D"];

type Arme = { nom: string; tier: string; rang: number; categorie: string; maj: string };
type Etat = { date: string; armes: Record<string, Arme> };

const html = await (await fetch(URL_META, { headers: { "user-agent": "Mozilla/5.0 (veille perso antre-de-romusan)" } })).text();
const m = html.match(/<script[^>]*id="ng-state"[^>]*>([\s\S]*?)<\/script>/);
if (!m) throw new Error("données ng-state introuvables : la structure du site a changé");
const store = JSON.parse(m[1])["store:weapons-and-tier-lists-mw4"];
if (!store?.wzStatsTierList?.mw4) throw new Error("tier list MW4 introuvable : la structure du site a changé");

const armes: Record<string, Arme> = {};
const infos: Record<string, any> = Object.fromEntries(store.weapons.map((w: any) => [w.id, w]));
for (const tier of TIERS) {
  (store.wzStatsTierList.mw4[tier] ?? []).forEach((id: string, i: number) => {
    const w = infos[id] ?? {};
    armes[id] = { nom: w.name ?? id, tier, rang: i + 1, categorie: w.type?.fullName ?? "", maj: w.mostRecentUpdatedAtByType?.mw4 ?? w.mostRecentUpdatedAt ?? "" };
  });
}
const maintenant: Etat = { date: new Date().toISOString(), armes };

let avant: Etat | null = null;
try { avant = JSON.parse(await Deno.readTextFile(ETAT)); } catch { /* premier passage */ }

const lien = (id: string) => `https://wzstats.gg/fr/best-loadouts/${id}`;
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
      if (a.maj && b.maj && a.maj !== b.maj) changements.push(`- Classe du **${a.nom}** mise à jour ([voir](${lien(id)}))`);
    }
  }
  for (const [id, b] of Object.entries(avant.armes)) if (!armes[id]) changements.push(`- **${b.nom}** sort de la tier list`);
}

const lignes = [
  `# Veille méta MW4 — ${new Date().toLocaleString("fr-FR")}`,
  "",
  !avant ? "Premier passage : état de référence enregistré." : changements.length ? "## Changements depuis le dernier passage" : "Aucun changement depuis le dernier passage.",
  ...changements,
  "",
  "## Tier list actuelle (multijoueur)",
  ...TIERS.map((t) => `- **${t}** : ${Object.values(armes).filter((a) => a.tier === t).map((a) => a.nom).join(", ") || "—"}`),
  "",
  `Source : ${URL_META}`,
];
await Deno.mkdir(DIR, { recursive: true });
await Deno.writeTextFile(RAPPORT, lignes.join("\n") + "\n");
await Deno.writeTextFile(ETAT, JSON.stringify(maintenant, null, 1));
console.log(lignes.join("\n"));
console.log(`\nCHANGEMENTS=${avant ? changements.length : "premier-passage"}`);
