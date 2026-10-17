// Traqueur de succès Steam : détecte le jeu lancé et affiche ses succès dans une petite fenêtre au premier plan.
// Lancer : deno task succes   (option --sans-fenetre : seulement le serveur, sur http://127.0.0.1:47815)
import { dossierDonnees, jeuLance, lireJeu, listerJeux } from "./steam.ts";
import { HKLM, premierPlan, regTexte } from "./windows.ts";
import { PAGE, TITRE } from "./page.ts";
import { choisirPosition, fiche, mettreEnFile, positionAuto, positionManuelle } from "./fiches.ts";

const PORT = 47815;
const URL_PAGE = `http://127.0.0.1:${PORT}/`;
const sansFenetre = Deno.args.includes("--sans-fenetre");

Deno.mkdirSync(dossierDonnees, { recursive: true });
const journal = (m: string) => {
  try { Deno.writeTextFileSync(`${dossierDonnees}\\journal.txt`, `${new Date().toISOString()} ${m}\n`, { append: true }); } catch { /* rien */ }
};

/** Chrome ou Edge, pour ouvrir la page en mode application (fenêtre sans barre d'adresse). */
function navigateur(): string | null {
  const candidats = [
    regTexte(HKLM, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe", ""),
    regTexte(HKLM, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe", ""),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    `${Deno.env.get("LOCALAPPDATA")}\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  for (const c of candidats) { try { if (c && Deno.statSync(c).isFile) return c; } catch { /* suivant */ } }
  return null;
}

function ouvrirFenetre() {
  const nav = navigateur();
  if (!nav) {
    journal("Ni Edge ni Chrome trouvé : ouverture dans le navigateur par défaut.");
    new Deno.Command("rundll32", { args: ["url.dll,FileProtocolHandler", URL_PAGE] }).spawn();
    return;
  }
  new Deno.Command(nav, {
    args: [`--app=${URL_PAGE}`, `--user-data-dir=${dossierDonnees}\\navigateur`, "--window-size=440,820", "--no-first-run", "--no-default-browser-check"],
    stdout: "null", stderr: "null",
  }).spawn();
  // La fenêtre met un moment à apparaître : on retente l'épinglage pendant 15 s.
  let essais = 0;
  const t = setInterval(() => { if (premierPlan(TITRE, true) || ++essais > 30) clearInterval(t); }, 500);
}

// Fermeture automatique quand la fenêtre ne demande plus rien depuis 20 s.
let derniereDemande = Date.now();
if (!sansFenetre) setInterval(() => { if (Date.now() - derniereDemande > 20_000) { journal("Fenêtre fermée : arrêt."); Deno.exit(0); } }, 5000);

let listeJeux: Awaited<ReturnType<typeof listerJeux>> = [];
let listeDate = 0;
async function jeux() {
  if (Date.now() - listeDate > 60_000) { listeJeux = await listerJeux(); listeDate = Date.now(); }
  return listeJeux;
}

const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function repondre(req: Request): Promise<Response> {
  derniereDemande = Date.now();
  const url = new URL(req.url);
  switch (url.pathname) {
    case "/":
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    case "/api/jeux":
      return json(await jeux());
    case "/api/etat": {
      const lance = jeuLance();
      const jeuEnCours = lance ? await lireJeu(lance) : null;
      if (jeuEnCours?.succes.length && !fiche(lance)) mettreEnFile(lance, jeuEnCours.nom);
      const demande = url.searchParams.get("appid") ?? "auto";
      let jeu = null;
      if (demande !== "auto") jeu = await lireJeu(+demande);
      else if (jeuEnCours?.succes.length) jeu = jeuEnCours;
      else { const l = await jeux(); if (l[0]) jeu = await lireJeu(l[0].appid); }
      const f = jeu && fiche(jeu.appid);
      const etape = f && jeu ? {
        auto: positionAuto(f, new Set(jeu.succes.filter((s) => s.fait).map((s) => s.id))),
        manuelle: positionManuelle(jeu.appid),
      } : null;
      return json({ lance, nomLance: jeuEnCours?.nom ?? (lance ? `jeu ${lance} (sans succès)` : ""), jeu, fiche: f, etape });
    }
    case "/api/position": {
      const appid = +(url.searchParams.get("appid") ?? 0), section = url.searchParams.get("section");
      if (req.method !== "POST" || !appid) return new Response("Requête invalide", { status: 400 });
      choisirPosition(appid, section && section !== "auto" ? section : null);
      return json({ ok: true });
    }
    case "/api/epingler": {
      const oui = url.searchParams.get("oui") === "1";
      return json({ oui: premierPlan(TITRE, oui) ? oui : !oui });
    }
  }
  return new Response("Introuvable", { status: 404 });
}

try {
  Deno.serve({ hostname: "127.0.0.1", port: PORT, onListen: () => journal(`Démarré sur ${URL_PAGE}`) }, repondre);
} catch (e) {
  if (e instanceof Deno.errors.AddrInUse) {
    // Déjà lancé : on rouvre juste une fenêtre.
    if (!sansFenetre) ouvrirFenetre();
    setTimeout(() => Deno.exit(0), 3000);
    await new Promise(() => {});
  }
  journal(`Erreur : ${e}`);
  throw e;
}
if (!sansFenetre) ouvrirFenetre();
jeux();
