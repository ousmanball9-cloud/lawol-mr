/**
 * Harnais « montant annoncé » — lot V4-C (contrat docs/contrat-metadata-offres.md §2.1).
 *
 *   node apps/web/scripts/verify-montant.mjs [baseUrl] [apiUrl]
 *   node apps/web/scripts/verify-montant.mjs https://lawol-mr.vercel.app
 *
 * Ce que le harnais PROUVE, sur le rendu réel (DOM, pas une intention) :
 *
 *   CATALOGUE `/offres`
 *     1. au moins un `[data-probe="offre-montant"]` VISIBLE dans les cartes
 *        (critère absolu : c'est lui qui échoue si l'affichage n'est pas déployé) ;
 *     2. chaque montant rendu est bien formé (nombre + devise, périodicité
 *        optionnelle) — aucun texte libre, aucun « € » orphelin ;
 *     3. ZÉRO « non communiqué » dans une carte : sur le catalogue, l'absence
 *        se traduit par le SILENCE, jamais par un texte ;
 *     4. aucun montant rendu au-delà du nombre d'offres de l'API qui en portent
 *        (mesure croisée : on n'invente pas un montant que l'API ne sert pas) ;
 *     5. la carte garde sa cible ≤ 210 px (le montant ne doit pas ajouter
 *        de hauteur — il vit sur la ligne du financement).
 *
 *   FICHE `/offres/{id}`
 *     6. offre AVEC montant  → `essentiel-montant` visible, texte identique à
 *        la valeur attendue, et JAMAIS « non communiqué » ;
 *     7. offre SANS montant  → `essentiel-montant` affiche « non communiqué »
 *        (la fiche nomme l'absence ; elle n'affiche pas un fait vide) ;
 *     8. zéro erreur console sur les deux pages.
 *
 * Code retour : 0 = vert · 1 = au moins un écart (imprimé) · 2 = mesure impossible.
 *
 * ⚠ À jouer APRÈS déploiement : sur la prod qui n'a pas encore le code, le
 * critère 1 échoue volontairement (contrôle négatif).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { API_URL } from "../lib/api-url.ts";

const BASE = (process.argv[2] ?? "https://lawol-mr.vercel.app").replace(/\/$/, "");
const API = (process.argv[3] ?? API_URL).replace(/\/$/, "");
const LARGEUR = 390;
const HAUTEUR = 844;
const HAUTEUR_MAX_CARTE = 210;
const ATTENTE_CARTES_MS = 25000;
const STABILISATION_MS = 1800;
const NON_COMMUNIQUE = "non communiqu";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const candidats = [
    process.env.VERIFY_BROWSER,
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  return candidats.find((c) => existsSync(c)) ?? null;
}

function portLibre(debut) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(portLibre(debut + 1)));
    srv.listen(debut, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitFor(url, timeoutMs) {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(250);
  }
  return false;
}

async function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const erreursConsole = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      erreursConsole.push(
        msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300)
      );
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      erreursConsole.push((d.exception?.description ?? d.text ?? "exception").slice(0, 300));
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  return { send, erreursConsole, close: () => ws.close() };
}

async function evaluate(cdp, expression) {
  const res = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
  }
  return res.result.value;
}

/** Sonde catalogue : montants rendus, forme, silence, hauteur des cartes. */
const SONDE_CATALOGUE = `(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const txt = (el) => (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 60);
  const cartes = [...document.querySelectorAll('[data-probe="offre-carte"]')];
  const montants = [...document.querySelectorAll('[data-probe="offre-montant"]')]
    .filter(vis)
    .map((el) => txt(el));
  const hauteurs = cartes.map((el) => Math.round(el.getBoundingClientRect().height));
  // « non communiqué » ne doit JAMAIS apparaître dans une carte (silence).
  const bavards = cartes
    .filter((el) => /non communiqu/i.test(el.textContent || ""))
    .map((el) => txt(el));
  // Un montant rendu sans nombre, ou réduit à une devise seule = écran cassé.
  const suspects = montants.filter((t) => !/\\d/.test(t) || !/(€|\\$|£|[A-Z]{3})/.test(t));
  return {
    cartes: cartes.length,
    hauteurMax: hauteurs.length ? Math.max(...hauteurs) : 0,
    montants,
    bavards,
    suspects,
    probesFinancement: [...document.querySelectorAll('[data-probe="offre-financement"]')].filter(vis).length,
  };
})()`;

/** Sonde fiche : le 3e fait « Montant annoncé ». */
const SONDE_FICHE = `(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const el = document.querySelector('[data-probe="essentiel-montant"]');
  if (!el) return { present: false };
  return {
    present: true,
    visible: vis(el),
    texte: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 80),
  };
})()`;

const FORMATEUR = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const SYMBOLES = { EUR: "€", USD: "$", GBP: "£", HKD: "HK$", NZD: "NZ$", CAD: "CA$", AUD: "AU$", SGD: "S$", BRL: "R$" };
const SUFFIXES = { mois: " / mois", an: " / an", total: "" };

/** Même règle que apps/web/lib/montant.ts — le harnais ne juge pas autrement.
 *  La sonde normalise `\s+` en espace simple (U+202F / U+00A0 → " ") : l'attendu
 *  subit la MÊME normalisation, sinon on compare deux encodages, pas deux textes. */
function attendu(montant) {
  if (!montant || !(montant.valeur > 0) || !/^[A-Z]{3}$/.test(montant.devise ?? "")) return null;
  if (!(montant.periode in SUFFIXES)) return null;
  const texte = `${FORMATEUR.format(montant.valeur)} ${SYMBOLES[montant.devise] ?? montant.devise}${SUFFIXES[montant.periode]}`;
  return texte.replace(/\s+/g, " ");
}

/** Traverse les offres de l'API jusqu'à trouver une offre avec / sans montant. */
async function choisirOffres() {
  const res = await fetch(`${API}/api/v1/offres?limit=200`);
  if (!res.ok) throw new Error(`API offres indisponible (${res.status})`);
  const corps = await res.json();
  const offres = Array.isArray(corps) ? corps : corps.offres ?? corps.items ?? corps.data ?? [];
  const auj = new Date().toISOString().slice(0, 10);
  const futures = offres.filter((o) => String(o.date_limite ?? "").slice(0, 10) >= auj);
  const avec = futures.find((o) => attendu(o.montant) !== null) ?? null;
  const sans = futures.find((o) => attendu(o.montant) === null) ?? null;
  return { total: offres.length, publiques: futures.length, avec, sans, nbAvec: futures.filter((o) => attendu(o.montant) !== null).length };
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.error("Aucun Chrome/Edge trouve (VERIFY_BROWSER / CHROME_PATH).");
    process.exit(2);
  }

  const choix = await choisirOffres();
  const port = await portLibre(9740);
  const profil = path.join(os.tmpdir(), `lawol-montant-${Date.now()}`);
  const chrome = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--disable-extensions",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profil}`,
      `--window-size=${LARGEUR},${HAUTEUR}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  const cas = [];
  const ajouter = (libelle, ok, valeur) => cas.push([libelle, ok, valeur]);

  try {
    if (!(await waitFor(`http://127.0.0.1:${port}/json/version`, 20000))) {
      throw new Error("CDP indisponible");
    }
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find((t) => t.type === "page");
    if (!target) throw new Error("Aucune cible page CDP");

    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: LARGEUR,
      height: HAUTEUR,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });

    // ---------- CATALOGUE ----------
    const urlCatalogue = `${BASE}/offres`;
    await cdp.send("Page.navigate", { url: urlCatalogue });
    const debut = Date.now();
    let cartes = 0;
    while (Date.now() - debut < ATTENTE_CARTES_MS) {
      try {
        cartes = await evaluate(cdp, `document.querySelectorAll('[data-probe="offre-carte"]').length`);
        if (cartes > 0) break;
      } catch {
        /* contexte détruit par la navigation : on réessaie */
      }
      await sleep(400);
    }
    if (cartes === 0) throw new Error(`aucune carte sur ${urlCatalogue} (page vide ou non déployée)`);
    await sleep(STABILISATION_MS);

    const cat = await evaluate(cdp, SONDE_CATALOGUE);
    const erreursCatalogue = cdp.erreursConsole.filter((m) => !/favicon|facebook|DevTools/i.test(m));
    const attendusCarte = Math.min(choix.nbAvec, cat.cartes);

    ajouter(
      "catalogue : au moins un montant rendu",
      cat.montants.length > 0,
      `${cat.montants.length} rendu(s) sur ${cat.cartes} carte(s)`
    );
    ajouter(
      "catalogue : chaque montant est bien formé",
      cat.suspects.length === 0,
      cat.suspects
    );
    ajouter(
      "catalogue : aucun « non communiqué » dans une carte",
      cat.bavards.length === 0,
      cat.bavards
    );
    ajouter(
      "catalogue : pas plus de montants que l'API n'en sert",
      cat.montants.length <= attendusCarte,
      `${cat.montants.length} rendu(s) ≤ ${attendusCarte} (API : ${choix.nbAvec} sur ${choix.publiques} offres publiques)`
    );
    ajouter(
      `catalogue : cartes ≤ ${HAUTEUR_MAX_CARTE} px (le montant n'ajoute pas de hauteur)`,
      cat.hauteurMax <= HAUTEUR_MAX_CARTE,
      `${cat.hauteurMax} px max`
    );
    ajouter("catalogue : aucune erreur console", erreursCatalogue.length === 0, erreursCatalogue[0] ?? "");

    // ---------- FICHE AVEC MONTANT ----------
    if (!choix.avec) {
      ajouter(
        "fiche : une offre AVEC montant est servie par l'API",
        false,
        "aucune offre publique ne porte de montant — le déploiement ou le backfill manque"
      );
    } else {
      const attenduFiche = attendu(choix.avec.montant);
      await cdp.send("Page.navigate", { url: `${BASE}/offres/${choix.avec.id}` });
      await sleep(STABILISATION_MS);
      const fiche = await evaluate(cdp, SONDE_FICHE);
      const erreursFiche = cdp.erreursConsole.filter((m) => !/favicon|facebook|DevTools/i.test(m));
      ajouter(
        "fiche (avec montant) : fait « Montant annoncé » visible",
        fiche.present && fiche.visible,
        fiche
      );
      ajouter(
        "fiche (avec montant) : valeur identique au contrat",
        fiche.texte === attenduFiche,
        `attendu ${JSON.stringify(attenduFiche)} · obtenu ${JSON.stringify(fiche.texte)}`
      );
      ajouter(
        "fiche (avec montant) : aucune erreur console",
        erreursFiche.length === 0,
        erreursFiche[0] ?? ""
      );
    }

    // ---------- FICHE SANS MONTANT ----------
    if (choix.sans) {
      await cdp.send("Page.navigate", { url: `${BASE}/offres/${choix.sans.id}` });
      await sleep(STABILISATION_MS);
      const ficheVide = await evaluate(cdp, SONDE_FICHE);
      const nommeAbsence = new RegExp(NON_COMMUNIQUE, "i").test(ficheVide.texte ?? "");
      ajouter(
        "fiche (sans montant) : l'absence est nommée « non communiqué »",
        ficheVide.present && ficheVide.visible && nommeAbsence,
        ficheVide
      );
    }

    console.log(`\n${urlCatalogue} — ${LARGEUR} px (DPR 2), ${cartes} carte(s) rendue(s)`);
    console.log(`API ${API} — ${choix.publiques} offres publiques, ${choix.nbAvec} avec montant\n`);
    let echecs = 0;
    for (const [libelle, ok, valeur] of cas) {
      if (!ok) echecs++;
      console.log(`  [${ok ? "OK" : "KO"}] ${libelle}  → ${JSON.stringify(valeur)}`);
    }
    if (cat.montants.length) console.log(`\n  montants rendus : ${JSON.stringify(cat.montants)}`);

    cdp.close();
    console.log(
      echecs === 0
        ? "\nVERT — montant rendu sur le catalogue, bien formé, silencieux quand absent, fiche conforme"
        : `\nROUGE — ${echecs} critere(s) en ecart`
    );
    process.exit(echecs === 0 ? 0 : 1);
  } catch (e) {
    console.error("Mesure impossible : " + String(e).slice(0, 300));
    process.exit(2);
  } finally {
    chrome.kill();
  }
}

main().catch((e) => {
  console.error("Mesure impossible : " + String(e).slice(0, 300));
  process.exit(2);
});
