/**
 * Vérification de l'espace client (dashboard) — rejouable en une commande.
 *
 *   node scripts/verify-espace.mjs
 *
 * Exigence centrale : à l'entrée, AUCUNE info profil visible (identité,
 * téléphone, filière, niveau, ville, université) — la sidebar ne contient
 * que la navigation (Tableau de bord / Profil / Paramètres). Le profil ne
 * s'affiche que derrière l'onglet « Profil ».
 *
 * Matrice : 2 viewports (desktop 1440 + mobile 375) × profil caché, nav,
 * onglet Profil, onglet Paramètres (sauvegarde PATCH 200), modale d'offre,
 * deep-link ?onglet=, 0 erreur console.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(WEB_ROOT, ".verify-espace");
const PORT = await portLibre(4950);
const CDP_PORT = await portLibre(9950);

function portLibre(depart) {
  return new Promise((resolve) => {
    const essai = (n) => {
      const srv = net.createServer();
      srv.once("error", () => essai(n + 1 + Math.floor(Math.random() * 50)));
      srv.once("listening", () => srv.close(() => resolve(n)));
      srv.listen(n, "127.0.0.1");
    };
    essai(depart);
  });
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
  else try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch {} }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, delaiMs) {
  const debut = Date.now();
  while (Date.now() - debut < delaiMs) {
    try { await fetch(url); return true; } catch { await sleep(400); }
  }
  return false;
}

function findBrowser() {
  if (process.env.VERIFY_BROWSER) return process.env.VERIFY_BROWSER;
  const candidats = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidats.find((c) => existsSync(c)) ?? null;
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pend = new Map();
  const listeners = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pend.has(msg.id)) { pend.get(msg.id)(msg); pend.delete(msg.id); }
    else listeners.forEach((f) => f(msg));
  };
  const pret = new Promise((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error("CDP WS")); });
  return pret.then(() => ({
    send: (method, params = {}) => new Promise((res, rej) => {
      const i = ++id;
      pend.set(i, (msg) => (msg.error ? rej(new Error(msg.error.message)) : res(msg.result)));
      ws.send(JSON.stringify({ id: i, method, params }));
    }),
    on: (f) => listeners.push(f),
    close: () => { try { ws.close(); } catch {} },
  }));
}

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`evaluate: ${JSON.stringify(r.exceptionDetails).slice(0, 200)}`);
  return r.result?.value;
}

/* ---------- Mesures ---------- */
const checks = [];
function check(label, ok, detail = "") {
  checks.push({ label, ok: !!ok, detail: String(detail).slice(0, 160) });
  console.log(`  ${ok ? "OK " : "KO "} ${label}${detail ? `  [${String(detail).slice(0, 120)}]` : ""}`);
  return !!ok;
}

/* ---------- Mocks (backend simulé — même forme que verify-design.mjs) ---------- */
const PROFILE = {
  id: "p1",
  telephone: "2221234567",
  nom: "Ould Ahmed",
  prenom: "Fatimetou",
  universite: "Université de Nouakchott",
  filiere: "informatique",
  niveau: "M2",
  ville: "nouakchott",
  types_recherches: ["stage_pfe", "emploi_junior", "bourse"],
  metadata: {
    prefs_avancees: { villes_exclues: ["rosso"], types_masques: ["bourse"], seuil_pertinence: 60 },
  },
};
const DASHBOARD_MOCK = {
  profil: { id: "p1", nom: "Ould Ahmed", prenom: "Fatimetou", score_profil: 62 },
  resume: { offres_dispo: 12, nouvelles_7j: 4, postules_total: 3, en_cours: 1 },
  postes_annee: [
    { poste: "développeur", count: 14 },
    { poste: "data analyst", count: 9 },
  ],
};
const OFFRES_ENRICHIES = [
  ["m1", true, "Stage PFE — Analyse de données réseau", "Mauritel", "nouakchott", "stage_pfe", "30/11/2026", { favori: true, statut_candidature: null, date_match: "2026-10-05" }],
  ["m2", true, "Data Analyst junior (H/F)", "BNM", "nouadhibou", "emploi_junior", "15/12/2026", { favori: false, statut_candidature: "entretien", date_match: "2026-10-02" }],
  ["m3", false, "Bourse d'études excellence 2026", "ANPE", "kaedi", "bourse", "10/01/2027", { favori: false, statut_candidature: null, date_match: "2026-09-28" }],
  ["m4", false, "Alternance développement web", "Ooredoo", "nouakchott", "alternance", "05/12/2026", { favori: true, statut_candidature: null, date_match: "2026-09-21" }],
  ["m5", false, "Stage été — Ingénierie terrain", "SNIM", "rosso", "stage_ete", "20/12/2026", { favori: false, statut_candidature: null, date_match: "2026-09-14" }],
].map(([id, postule, titre, entreprise, ville, type_offre, date_limite, enrichi]) => ({
  id,
  postule,
  favori: enrichi.favori,
  statut_candidature: enrichi.statut_candidature,
  date_match: enrichi.date_match,
  offre: {
    id: `o-${id}`,
    titre,
    entreprise,
    ville,
    type_offre,
    date_limite,
    description:
      "Mission encadrée en entreprise, missions concrètes dès la première semaine et possibilité d'embauche à l'issue du stage.",
  },
}));

/** Sonde « profil caché » : aucune info personnelle dans le texte VISIBLE.
 * innerText (pas textContent) : le HTML embarque les données de vol RSC
 * (params de route) qui ne sont pas du texte rendu. */
const SONDE_CACHE = `!/Fatimetou|Ould|2221234567|informatique|M2|Université/.test(document.body.innerText)`;

/* ---------- Scénario ---------- */
async function scenario(cdp, { largeur, mobile = false } = {}) {
  const tag = mobile ? "mobile" : "desktop";
  if (mobile) await cdp.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  else await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  const probeAccueil = `(() => ({
    profilCache: ${SONDE_CACHE},
    navVisible: [...document.querySelectorAll('[data-probe^="nav-"]')].filter((el) => el.getBoundingClientRect().width > 0).length,
    salut: document.querySelector("h1")?.textContent?.includes("Salut") ?? false,
    cartes: document.querySelectorAll(".group").length,
    bandeau: document.querySelectorAll('[data-probe="resume-carte"]').length,
  }))()`;

  // 1. Entrée : profil caché + navigation présente
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/profil/2221234567` });
  await sleep(2600);
  const accueil = await evaluate(cdp, probeAccueil);
  check(`[${tag}] entrée : profil 100 % caché (identité/tél/filière/niveau/ville/univ)`, accueil.profilCache);
  check(`[${tag}] entrée : 3 options de navigation visibles`, accueil.navVisible === 3, `${accueil.navVisible}`);
  check(`[${tag}] entrée : salutation sans info perso`, accueil.salut);
  check(`[${tag}] entrée : 5 offres + bandeau 3 cartes`, accueil.cartes === 5 && accueil.bandeau === 3, `cartes=${accueil.cartes} bandeau=${accueil.bandeau}`);

  // 2. Onglet Profil : identité + infos visibles, offres masquées
  await evaluate(cdp, `document.querySelector('[data-probe="nav-profil"]').click()`);
  await sleep(500);
  const profil = await evaluate(cdp, `(() => ({
    initiales: document.querySelector('[data-profil="avatar"]')?.textContent?.trim() ?? "",
    nom: document.querySelector("h1")?.textContent?.trim() ?? "",
    chips: document.querySelectorAll("div.rounded-lg.bg-muted").length,
    grilleMasquee: document.querySelectorAll(".group").length === 0,
  }))()`);
  check(`[${tag}] onglet Profil : initiales + nom complet visibles`, profil.initiales.length >= 2 && profil.nom.includes("Fatimetou"), profil.nom);
  check(`[${tag}] onglet Profil : 4 infos (filière/niveau/ville/téléphone)`, profil.chips === 4, `${profil.chips}`);
  check(`[${tag}] onglet Profil : offres masquées`, profil.grilleMasquee);

  // 3. Onglet Paramètres : prefs préchargées + sauvegarde
  await evaluate(cdp, `document.querySelector('[data-probe="nav-parametres"]').click()`);
  await sleep(500);
  const prefs = await evaluate(cdp, `(() => ({
    form: !!document.querySelector('[data-probe="prefs-form"]'),
    villes: document.querySelectorAll('[data-probe="pref-ville"]').length,
    types: document.querySelectorAll('[data-probe="pref-type"]').length,
    seuil: document.querySelector('[data-probe="pref-seuil"]')?.value ?? "",
    rossauCoche: document.querySelector('[data-probe="pref-ville"][data-cle="rosso"]')?.checked ?? false,
    bourseMasquee: document.querySelector('[data-probe="pref-type"][data-cle="bourse"]')?.checked ?? false,
    desinscription: !!document.querySelector('[data-probe="desinscription"]'),
  }))()`);
  check(`[${tag}] onglet Paramètres : formulaire + 6 villes + 5 types`, prefs.form && prefs.villes === 6 && prefs.types === 5, `villes=${prefs.villes} types=${prefs.types}`);
  check(`[${tag}] onglet Paramètres : prefs préchargées (seuil 60, rossau, bourse)`, prefs.seuil === "60" && prefs.rossauCoche && prefs.bourseMasquee, `seuil=${prefs.seuil}`);

  // 3b. Sauvegarde : cocher kaédi + submit → message OK (PATCH 200 mocké)
  await evaluate(cdp, `document.querySelector('[data-probe="pref-ville"][data-cle="kaedi"]').click()`);
  await sleep(200);
  await evaluate(cdp, `document.querySelector('[data-probe="prefs-form"] button[type=submit]').click()`);
  await sleep(900);
  const sauvegarde = await evaluate(cdp, `(() => ({
    ok: document.body.textContent.includes("Préférences enregistrées"),
    kaedi: document.querySelector('[data-probe="pref-ville"][data-cle="kaedi"]')?.checked ?? false,
  }))()`);
  check(`[${tag}] onglet Paramètres : sauvegarde PATCH 200 + retour visuel`, sauvegarde.ok && sauvegarde.kaedi);

  // 4. Retour Tableau de bord : profil re-caché
  await evaluate(cdp, `document.querySelector('[data-probe="nav-accueil"]').click()`);
  await sleep(500);
  const retour = await evaluate(cdp, `({ profilCache: ${SONDE_CACHE}, cartes: document.querySelectorAll(".group").length })`);
  check(`[${tag}] retour Tableau de bord : profil re-caché + offres visibles`, retour.profilCache && retour.cartes === 5);

  // 5. Modale détail (chemin réel : clic carte → contenu → fermeture)
  await evaluate(cdp, `document.querySelector('button[aria-label^="Voir le détail"]').click()`);
  await sleep(550);
  const modale = await evaluate(cdp, `(() => ({
    ouverte: !!document.querySelector('[role="dialog"]'),
    titre: document.querySelector('[role="dialog"] h2')?.textContent?.trim() ?? "",
    badge: document.querySelector('[role="dialog"] span')?.textContent?.trim() ?? "",
  }))()`);
  check(`[${tag}] modale détail : ouverte avec titre + badge`, modale.ouverte && modale.titre.includes("Stage PFE") && modale.badge === "Stage PFE", modale.titre);
  await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await sleep(400);
  const fermee = await evaluate(cdp, `!document.querySelector('[role="dialog"]')`);
  check(`[${tag}] modale détail : fermeture Échap`, fermee);
}

/* ---------- Principal ---------- */
async function main() {
  const browser = findBrowser();
  if (!browser) throw new Error("Aucun Chrome/Edge trouvé (variable VERIFY_BROWSER).");

  await rm(OUT_DIR, { recursive: true, force: true }).catch(() => {});
  await mkdir(OUT_DIR, { recursive: true });

  const server = spawn(
    process.execPath,
    [path.join(WEB_ROOT, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)],
    { cwd: WEB_ROOT, stdio: "ignore" }
  );
  const profileDir = path.join(OUT_DIR, "chrome-profile");
  const chrome = spawn(browser, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    "--disable-extensions", `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`, "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });

  try {
    const up = await waitFor(`http://127.0.0.1:${PORT}/`, 60000);
    if (!up) throw new Error(`Serveur de prod non démarré (port ${PORT}).`);
    const cdpReady = await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`, 20000);
    if (!cdpReady) throw new Error("CDP indisponible.");

    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const target = targets.find((t) => t.type === "page");
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*api/v1*", requestStage: "Request" }] });
    const consoleErrors = [];
    cdp.on((msg) => {
      if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
      }
      if (msg.method !== "Fetch.requestPaused") return;
      const { requestId, request } = msg.params;
      (async () => {
        const url = request.url;
        let corps = null;
        if (request.method === "GET" && url.includes("/api/v1/profils/2221234567/historique")) corps = OFFRES_ENRICHIES;
        else if (request.method === "GET" && url.includes("/api/v1/dashboard/")) corps = DASHBOARD_MOCK;
        else if (request.method === "GET" && url.includes("/api/v1/profils/")) corps = PROFILE;
        else if (request.method === "GET" && url.includes("/api/v1/matches")) corps = OFFRES_ENRICHIES;
        else if (request.method === "PATCH" && url.includes("/preferences")) {
          await cdp.send("Fetch.fulfillRequest", {
            requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify({ ok: true })).toString("base64"),
          });
          return;
        } else if (request.method === "PATCH" && (url.includes("/favori") || url.includes("/statut"))) {
          await cdp.send("Fetch.fulfillRequest", {
            requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify({ ok: true })).toString("base64"),
          });
          return;
        }
        if (corps !== null) {
          await cdp.send("Fetch.fulfillRequest", {
            requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify(corps)).toString("base64"),
          });
        } else {
          await cdp.send("Fetch.continueRequest", { requestId });
        }
      })().catch(() => {});
    });

    console.log(`\n=== Espace client (dashboard) — profil caché + onglets (port ${PORT}) ===`);
    await scenario(cdp);
    await scenario(cdp, { largeur: 375, mobile: true });

    // 6. Deep-link ?onglet=parametres : les préférences s'affichent à l'arrivée
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/profil/2221234567?onglet=parametres` });
    await sleep(2600);
    const deep = await evaluate(cdp, `(() => ({
      form: !!document.querySelector('[data-probe="prefs-form"]'),
      profilCache: ${SONDE_CACHE},
    }))()`);
    check("[desktop] deep-link ?onglet=parametres : prefs affichées à l'arrivée", deep.form);
    check("[desktop] deep-link ?onglet=parametres : profil toujours caché", deep.profilCache);

    const erreurs = consoleErrors.filter((t) => !/facebook|favicon|404|Failed to load resource/i.test(t));
    check("0 erreur console (desktop + mobile)", erreurs.length === 0, erreurs.slice(0, 2).join(" | "));
    cdp.close();
  } finally {
    killTree(server.pid);
    killTree(chrome.pid);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }

  const passes = checks.filter((c) => c.ok).length;
  console.log(`\n=== SYNTHÈSE ===`);
  console.log(`  viewports couverts      : desktop 1440 + mobile 375`);
  console.log(`  mesures vertes         : ${passes}/${checks.length}`);
  console.log(`  RÉSULTAT               : ${passes === checks.length ? "TOUT VERT ✅" : "ÉCHEC ❌"}`);
  process.exit(passes === checks.length ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
