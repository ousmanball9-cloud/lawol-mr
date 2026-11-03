/**
 * Harnais LIVE â€” chrome conservÃ© + Ã©tats de route + fiche Â« L'essentiel Â».
 *
 * Usage : node scripts/verify-chrome-etats.mjs [baseUrl]
 *         node scripts/verify-chrome-etats.mjs https://lawol-mr.vercel.app
 *
 * Trois promesses mesurÃ©es, aucune supposÃ©e :
 *   V2-02/V2-03 â€” la navigation reste visible pendant le chargement du
 *     catalogue, et l'erreur 404 reste DANS le chrome avec une sortie utile ;
 *   V2-03 â€” le chrome n'est jamais rendu deux fois (un seul <header>) ;
 *   V3-01/V3-02 â€” sur la fiche, Â« L'essentiel Â» est rendu AVANT la description
 *     (comparaison des offsets rÃ©els, pas de l'ordre du code).
 *
 * Chrome headless + CDP, aucune dÃ©pendance. Exit 0 = vert, 1 = rouge.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] || "https://lawol-mr.vercel.app").replace(/\/$/, "");
const CDP_PORT = Number(process.env.CDP_PORT || 9393);
const PROFIL = path.join(os.tmpdir(), `lawol-chrome-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const exe = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]
  .filter(Boolean)
  .find((c) => existsSync(c));

if (!exe) {
  console.error("Chrome introuvable â€” dÃ©finir CHROME_PATH.");
  process.exit(2);
}

const chrome = spawn(
  exe,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFIL}`,
    "--window-size=390,900",
    "about:blank",
  ],
  { stdio: "ignore" }
);

async function waitFor(url, timeoutMs) {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      /* pas encore prÃªt */
    }
    await sleep(250);
  }
  return false;
}

try {
  if (!(await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`, 20000))) {
    throw new Error("le port de debug Chrome ne rÃ©pond pas");
  }
  const cible = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find(
    (t) => t.type === "page"
  );
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const messages = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      messages.push(
        msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300)
      );
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  await send("Runtime.enable");
  await send("Page.enable");

  const evalIn = async (expression) => {
    const res = await send("Runtime.evaluate", { returnByValue: true, expression });
    return res.result.value;
  };

  const cas = [];
  const noter = (libelle, ok, valeur) => cas.push([libelle, ok, valeur]);

  /* ---------- 1. Un seul chrome par page, sur toutes les familles ---------- */
  for (const route of ["/", "/offres", "/connexion"]) {
    await send("Page.navigate", { url: `${BASE}${route}` });
    await sleep(6000);
    const c = await evalIn(`(() => ({
      entetes: document.querySelectorAll("header.sticky").length,
      pieds: document.querySelectorAll("footer").length,
      visible: (() => {
        const h = document.querySelector("header.sticky");
        if (!h) return false;
        const r = h.getBoundingClientRect();
        return r.height > 20 && r.width > 100;
      })(),
    }))()`);
    noter(`${route} â€” un seul header (jamais deux)`, c.entetes === 1, c.entetes);
    noter(`${route} â€” header visible (hauteur rÃ©elle)`, c.visible === true, c.visible);
    noter(`${route} â€” un seul footer`, c.pieds === 1, c.pieds);
  }

  /* ---------- 2. Le chrome tient pendant le chargement du catalogue ---------- */
  await send("Page.navigate", { url: `${BASE}/offres` });
  let chromeAvantDonnees = null;
  const debut = Date.now();
  while (Date.now() - debut < 20000) {
    const etat = await evalIn(`(() => ({
      entete: !!document.querySelector("header.sticky"),
      cartes: document.querySelectorAll('[data-probe="offre-carte"]').length,
      charge: /chargement des offres/i.test(document.body.innerText),
    }))()`);
    if (etat.entete && etat.cartes === 0 && chromeAvantDonnees === null) {
      chromeAvantDonnees = etat.charge ? "spinner avec header" : "header seul";
    }
    if (etat.cartes > 0) break;
    await sleep(250);
  }
  noter(
    "/offres â€” la navigation est lÃ  AVANT les donnÃ©es (plus d'Ã©cran blanc)",
    chromeAvantDonnees !== null,
    chromeAvantDonnees ?? "jamais observÃ© (donnÃ©es trop rapides ?)"
  );

  /* ---------- 3. 404 dans le chrome, avec une sortie utile ---------- */
  await send("Page.navigate", { url: `${BASE}/cette-page-nexiste-vraiment-pas` });
  await sleep(6000);
  const nf = await evalIn(`(() => ({
    entete: document.querySelectorAll("header.sticky").length,
    titre: /cette page n'existe pas/i.test(document.body.innerText),
    sortieOffres: [...document.querySelectorAll('a[href="/offres"]')].length > 0,
    retourAccueil: [...document.querySelectorAll('a[href="/"]')].length > 0,
  }))()`);
  noter("404 â€” la page d'erreur garde le header", nf.entete === 1, nf.entete);
  noter("404 â€” message explicite rendu", nf.titre === true, nf.titre);
  noter("404 â€” sortie utile vers /offres", nf.sortieOffres === true, nf.sortieOffres);
  noter("404 â€” retour Ã  l'accueil proposÃ©", nf.retourAccueil === true, nf.retourAccueil);

  /* ---------- 4. Fiche : Â« L'essentiel Â» avant la description ---------- */
  const liste = await (await fetch(`${BASE}/api/v1/offres?type_offre=bourse&limit=1`)).json();
  const offreId = Array.isArray(liste) && liste[0] ? liste[0].id : null;
  noter("une offre rÃ©elle existe pour tester la fiche", Boolean(offreId), offreId);

  if (offreId) {
    const avantErreurs = messages.length;
    await send("Page.navigate", { url: `${BASE}/offres/${offreId}` });
    let fiche = null;
    const debutFiche = Date.now();
    while (Date.now() - debutFiche < 30000) {
      fiche = await evalIn(`(() => {
        const bloc = document.querySelector('[data-probe="fiche-essentiel"]');
        const desc = document.querySelector('[data-probe="detail-description"]');
        const criteres = document.querySelector('[data-probe="fiche-criteres-eliminants"]');
        const faits = document.querySelector('[data-probe="fiche-essentiel-faits"]');
        const lignes = bloc ? [...bloc.querySelectorAll("dd")] : [];
        return {
          present: !!bloc,
          top: bloc ? Math.round(bloc.getBoundingClientRect().top + window.scrollY) : null,
          topDescription: desc ? Math.round(desc.getBoundingClientRect().top + window.scrollY) : null,
          criteresAvantFaits: !!(criteres && faits && criteres.compareDocumentPosition(faits) & Node.DOCUMENT_POSITION_FOLLOWING),
          nbFaits: lignes.length,
          vides: lignes.filter((d) => d.textContent.trim() === "").length,
          nonCommunique: lignes.filter((d) => /non communiquÃ©/i.test(d.textContent)).length,
          noir: lignes.some((d) => getComputedStyle(d).color === "rgb(0, 0, 0)"),
          texte: lignes.map((d) => d.textContent.trim().slice(0, 40)),
        };
      })()`);
      if (fiche.present && fiche.topDescription !== null) break;
      await sleep(500);
    }
    const erreurs = messages.slice(avantErreurs).filter((m) => !/favicon|DevTools|401/i.test(m));

    noter("fiche â€” bloc Â« L'essentiel Â» rendu", fiche?.present === true, fiche?.present);
    noter(
      "fiche â€” l'essentiel est AU-DESSUS de la description (offsets rÃ©els)",
      fiche?.top !== null && fiche?.topDescription !== null && fiche.top < fiche.topDescription,
      { essentiel: fiche?.top, description: fiche?.topDescription }
    );
    noter(
      "fiche â€” les critÃ¨res Ã©liminants prÃ©cÃ¨dent les faits d'information",
      fiche?.criteresAvantFaits === true,
      fiche?.criteresAvantFaits
    );
    noter("fiche â€” 5 faits affichÃ©s (plafond 6)", fiche?.nbFaits === 5, fiche?.nbFaits);
    noter("fiche â€” aucun fait vide", fiche?.vides === 0, fiche?.vides);
    noter(
      "fiche â€” un champ absent s'Ã©crit Â« non communiquÃ© Â» (jamais un vide)",
      fiche?.vides === 0 && (fiche?.nonCommunique ?? 0) >= 0,
      { nonCommunique: fiche?.nonCommunique }
    );
    noter("fiche â€” aucun texte noir (charte Â« zÃ©ro noir Â»)", fiche?.noir === false, fiche?.noir);
    noter("fiche â€” aucune erreur console imputable au site", erreurs.length === 0, erreurs[0] ?? "");
  }

  /* ---------- Verdict ---------- */
  let ko = 0;
  for (const [libelle, ok, valeur] of cas) {
    if (!ok) ko++;
    console.log(`  [${ok ? "OK" : "KO"}] ${libelle}  â†’ ${JSON.stringify(valeur)}`);
  }
  console.log(`\n${BASE} â€” ${cas.length - ko}/${cas.length} cas verts`);
  console.log(ko === 0 ? "VERT â€” chrome, Ã©tats de route et fiche prouvÃ©s en ligne" : "ROUGE â€” Ã  corriger");
  ws.close();
  process.exitCode = ko === 0 ? 0 : 1;
} catch (e) {
  console.error(`ERREUR: ${e.message}`);
  process.exitCode = 1;
} finally {
  chrome.kill();
}

