/**
 * Preuve de rendu RÉEL de la fiche bourse `/offres/[id]` — anonyme.
 *
 * Chrome headless (CDP, sans dépendance) sur un `next dev` local, contre les
 * VRAIES données de l'API (offres réelles) :
 *   1. financement affiché honnêtement (bourse connue + bourse « inconnu ») ;
 *   2. bloc « dossier » : pièces usuelles génériques + lien coffre-fort ;
 *   3. non connecté → invitation à se connecter, et `detail-cta` toujours là.
 *
 * Usage : `node scripts/verify-fiche-bourse.mjs [baseUrl]`
 *   (attendu : `next dev` déjà lancé — défaut http://127.0.0.1:3011)
 * Sortie : `.verify-fiche/*.png` + rapport JSON, code retour 1 si un cas échoue.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] || "http://127.0.0.1:3011").replace(/\/$/, "");
const API = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";
const OUT_DIR = path.join(__dirname, "..", ".verify-fiche");
const CDP_PORT = 9331;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Navigateur ---------- */
function findBrowser() {
  return [
    process.env.VERIFY_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ]
    .filter(Boolean)
    .find((c) => existsSync(c));
}

async function waitFor(url, timeoutMs) {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(300);
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
  const listeners = new Set();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const l of [...listeners]) l(msg);
    }
  });
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const msgId = ++id;
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      }),
    on: (fn) => listeners.add(fn),
    close: () => ws.close(),
  };
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

/** Attend que la fiche soit chargée (titre + financement rendus). */
async function attendreFiche(cdp, timeoutMs = 25000) {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) {
    const pret = await evaluate(
      cdp,
      `!!document.querySelector('[data-probe="detail-titre"]') && !!document.querySelector('[data-probe="detail-financement-valeur"]')`
    );
    if (pret) return true;
    await sleep(400);
  }
  return false;
}

/** Lit tous les repères de la fiche (aucune donnée interprétée côté script). */
async function lireFiche(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const texte = (sel) => { const el = document.querySelector(sel); return el ? (el.textContent || "").trim() : null; };
      const nb = (sel) => document.querySelectorAll(sel).length;
      const lien = (re) => { const a = [...document.querySelectorAll("a")].find((n) => re.test(n.textContent || "")); return a ? a.getAttribute("href") : null; };
      return {
        titre: texte('[data-probe="detail-titre"]'),
        financement: texte('[data-probe="detail-financement-valeur"]'),
        financementTexte: texte('[data-probe="detail-financement"]'),
        pieces: nb('[data-probe="detail-piece"]'),
        dossierTexte: texte('[data-probe="detail-dossier"]'),
        coffreHref: document.querySelector('[data-probe="detail-coffre-lien"]')?.getAttribute("href") ?? null,
        suiviAnonyme: !!document.querySelector('[data-probe="detail-suivi-anonyme"]'),
        suiviStatut: texte('[data-probe="detail-suivi-statut"]'),
        suiviPostule: !!document.querySelector('[data-probe="detail-suivi-postule"]'),
        connexionHref: lien(/Se connecter/),
        cta: !!document.querySelector('[data-probe="detail-cta"]'),
        cookies: document.cookie,
      };
    })()`
  );
}

async function capture(cdp, fichier) {
  const metrics = await cdp.send("Page.getLayoutMetrics");
  const hauteur = Math.min(6000, Math.ceil(metrics.cssContentSize?.height ?? 1200));
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1440, height: hauteur, scale: 1 },
  });
  writeFileSync(path.join(OUT_DIR, fichier), Buffer.from(shot.data, "base64"));
  return hauteur;
}

/* ---------- Offres réelles pour la preuve ---------- */
async function choisirOffres() {
  const res = await fetch(`${API}/api/v1/offres?limit=200`);
  if (!res.ok) throw new Error(`API offres indisponible (${res.status})`);
  const offres = await res.json();
  const financee = offres.find((o) => o.type_financement === "fully_funded");
  const inconnue = offres.find((o) => o.type_financement === "inconnu");
  if (!financee || !inconnue) throw new Error("Offres réelles introuvables (fully_funded / inconnu)");
  return { financee, inconnue };
}

/* ---------- Un cas ---------- */
function verifier(label, fiche, attendu) {
  const erreurs = [];
  const ok = (condition, message) => {
    if (!condition) erreurs.push(message);
  };
  ok(!!fiche.titre, "titre absent");
  ok(fiche.financement === attendu.financement, `financement « ${fiche.financement} » ≠ « ${attendu.financement} »`);
  if (attendu.financement === "Financement non précisé") {
    ok(!/\d+\s?%/.test(fiche.financementTexte ?? ""), "taux inventé dans le bloc financement");
    ok(!/[€$£]/.test(fiche.financementTexte ?? ""), "montant inventé dans le bloc financement");
  }
  ok(fiche.pieces >= 5, `pièces usuelles insuffisantes (${fiche.pieces})`);
  ok(/générique/i.test(fiche.dossierTexte ?? ""), "le bloc dossier ne se déclare pas générique");
  ok(fiche.suiviAnonyme === true, "aucune invitation à se connecter (anonyme)");
  ok(fiche.suiviStatut === null, "statut de candidature affiché sans session");
  ok(fiche.suiviPostule === false, "bouton « J'ai postulé » affiché sans session");
  ok(fiche.connexionHref === "/connexion", `lien de connexion inattendu (${fiche.connexionHref})`);
  ok(fiche.coffreHref === "/connexion", `lien coffre-fort anonyme inattendu (${fiche.coffreHref})`);
  ok(fiche.cta === true, "detail-cta (CTA candidater) disparu");
  return { label, offre: attendu.offreId, erreurs, fiche };
}

/* ---------- Exécution ---------- */
async function main() {
  if (!(await waitFor(`${BASE}/offres`, 60000))) {
    throw new Error(`next dev injoignable sur ${BASE} — lance-le d'abord (npx next dev -p 3011)`);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const navigateur = findBrowser();
  if (!navigateur) throw new Error("Chrome/Edge introuvable (VERIFY_BROWSER)");
  const chrome = spawn(
    navigateur,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--disable-extensions",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${path.join(OUT_DIR, "chrome-profile")}`,
      "--window-size=1440,1200",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  const resultats = [];
  try {
    if (!(await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`, 20000))) {
      throw new Error("CDP indisponible");
    }
    const cibles = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const cible = cibles.find((t) => t.type === "page");
    const cdp = await connectCdp(cible.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    const erreursConsole = [];
    cdp.on((msg) => {
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        erreursConsole.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
      }
      if (msg.method === "Runtime.exceptionThrown") {
        erreursConsole.push(
          msg.params.exceptionDetails?.exception?.description ?? "exception non décrite"
        );
      }
    });

    /** Clé de comparaison : le début du message (identifie les avertissements préexistants). */
    const cle = (texte) => texte.replace(/\s+/g, " ").slice(0, 80);

    // TÉMOIN : page publique NON touchée — tout avertissement qui y apparaît
    // (ex. SDK tiers injecté dans le layout) n'est pas imputable à la fiche.
    // Fenêtre LONGUE (8 s) obligatoire : un avertissement produit par un script
    // tiers asynchrone n'apparaît qu'après son chargement — mesuré à 3 s, le
    // témoin était déclaré propre et le même avertissement compté à tort contre
    // la fiche (faux positif du 16/10/2026).
    await cdp.send("Page.navigate", { url: `${BASE}/offres` });
    await sleep(8000);
    const preexistantes = new Set(erreursConsole.map(cle));

    const { financee, inconnue } = await choisirOffres();
    const cas = [
      ["financee", financee, "100% financée (fully funded)"],
      ["inconnue", inconnue, "Financement non précisé"],
    ];

    for (const [nom, offre, libelle] of cas) {
      erreursConsole.length = 0;
      await cdp.send("Page.navigate", { url: `${BASE}/offres/${offre.id}` });
      if (!(await attendreFiche(cdp))) throw new Error(`fiche non rendue : ${offre.id}`);
      const fiche = await lireFiche(cdp);
      const hauteur = await capture(cdp, `${nom}-1440.png`);
      const nouvelles = erreursConsole
        .filter((e) => !preexistantes.has(cle(e)))
        .map((e) => e.replace(/\s+/g, " ").slice(0, 800));
      const cas = verifier(nom, fiche, { financement: libelle, offreId: offre.id });
      if (nouvelles.length > 0) {
        cas.erreurs.push(`erreurs console imputables à la fiche : ${nouvelles.join(" || ")}`);
      }
      resultats.push({ ...cas, hauteur, nouvellesErreursConsole: nouvelles });
    }

    resultats.push({
      label: "console",
      offre: "—",
      erreurs: [],
      preexistantes: [...preexistantes].map((e) => e.slice(0, 120)),
      totalNouvelles: resultats.reduce((n, r) => n + (r.nouvellesErreursConsole?.length ?? 0), 0),
      fiche: null,
    });
    cdp.close();
  } finally {
    chrome.kill();
  }

  const echecs = resultats.filter((r) => r.erreurs.length > 0);
  const rapport = {
    base: BASE,
    api: API,
    horodatage: new Date().toISOString(),
    resultats,
    verdict: echecs.length === 0 ? "VERT" : "ROUGE",
  };
  writeFileSync(path.join(OUT_DIR, "rapport.json"), JSON.stringify(rapport, null, 2));

  for (const r of resultats) {
    const statut = r.erreurs.length === 0 ? "OK " : "KO ";
    const detail = !r.fiche
      ? `avertissements préexistants (témoin /offres) = ${r.preexistantes.length}, imputables à la fiche = ${r.totalNouvelles}`
      : `financement="${r.fiche.financement}" pièces=${r.fiche.pieces} anonyme=${r.fiche.suiviAnonyme} hauteur=${r.hauteur}px`;
    console.log(`${statut} ${r.label.padEnd(10)} ${r.erreurs.length === 0 ? detail : r.erreurs.join(" | ")}`);
  }
  console.log(
    `\nVerdict ${rapport.verdict} — ${resultats.length - echecs.length}/${resultats.length} cas verts` +
      ` (captures : ${path.relative(process.cwd(), OUT_DIR)})`
  );
  process.exitCode = echecs.length === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error("ERREUR:", e.message);
  process.exitCode = 1;
});
