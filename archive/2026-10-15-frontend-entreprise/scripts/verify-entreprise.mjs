/**
 * Vérification des pages Entreprises (Sprint 2 Jobteaser) — rejouable.
 *
 *   node scripts/verify-entreprise.mjs
 *
 * Éprouve le chemin réel : annuaire /entreprises (filtres + cartes + pagination)
 * → fiche /entreprises/[id] (description + offres actives).
 * Backend simulé par interception CDP (mocks déterministes).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(WEB_ROOT, ".verify-entreprise");
const PORT = await portLibre(4965);
const CDP_PORT = await portLibre(9965);

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

/* ---------- Mocks ---------- */
const ENTREPRISES = [
  { id: "e1", nom: "Mauritel", ville: "nouakchott", secteur: "Telecoms", nb_offres_actives: 2 },
  { id: "e2", nom: "SNIM", ville: "nouadhibou", secteur: "Mines", nb_offres_actives: 1 },
  { id: "e3", nom: "BNM", ville: "nouakchott", secteur: "Banque", nb_offres_actives: 1 },
];

const FICHES = {
  e1: {
    id: "e1", nom: "Mauritel", ville: "nouakchott", secteur: "Telecoms", nb_offres_actives: 2,
    description: "Premier opérateur télécom de Mauritanie, plus de 4 millions d'abonnés.",
    site_url: "https://mauritel.mr", telephone: "2221234567", email_contact: "rh@mauritel.mr",
    logo_url: null, verifiee: true, created_at: "2024-01-15",
    offres: [
      { id: "o1", titre: "Stage PFE — Développement web", ville: "nouakchott", type_offre: "stage_pfe", date_limite: "2026-11-30", statut_publication: "active", active: true, url_publique: "https://mauritel.mr/offres/o1", nb_matches: 5, nb_postules: 2 },
      { id: "o4", titre: "Alternance — Gestion de projet", ville: "nouakchott", type_offre: "alternance", date_limite: "2026-12-05", statut_publication: "active", active: true, url_publique: "https://mauritel.mr/offres/o4", nb_matches: 3, nb_postules: 1 },
    ],
  },
  e2: {
    id: "e2", nom: "SNIM", ville: "nouadhibou", secteur: "Mines", nb_offres_actives: 1,
    description: "Société nationale industrielle et minière, fer de Zouérat.",
    site_url: "https://snim.mr", telephone: null, email_contact: "rh@snim.mr",
    logo_url: null, verifiee: true, created_at: "2023-06-01",
    offres: [
      { id: "o5", titre: "Stage été — Maintenance", ville: "rosso", type_offre: "stage_ete", date_limite: "2026-12-20", statut_publication: "active", active: true, url_publique: null, nb_matches: 2, nb_postules: 0 },
    ],
  },
  e3: {
    id: "e3", nom: "BNM", ville: "nouakchott", secteur: "Banque", nb_offres_actives: 1,
    description: "Banque nationale de Mauritanie, banque commerciale et de développement.",
    site_url: null, telephone: null, email_contact: "contact@bnm.mr",
    logo_url: null, verifiee: false, created_at: "2025-02-10",
    offres: [
      { id: "o2", titre: "Data Analyst junior", ville: "nouadhibou", type_offre: "emploi_junior", date_limite: "2026-12-15", statut_publication: "active", active: true, url_publique: null, nb_matches: 4, nb_postules: 1 },
    ],
  },
};

/* ---------- Scénarios ---------- */
async function scenario(cdp) {
  // 1. Annuaire /entreprises
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/entreprises` });
  await sleep(2600);
  const liste = await evaluate(cdp, `(() => ({
    cartes: document.querySelectorAll('[data-probe="entreprise-carte"]').length,
    titre: document.querySelector("h1")?.textContent?.trim() ?? "",
    filtres: !!document.querySelector('[data-probe="entreprises-filtres"]'),
  }))()`);
  check("annuaire /entreprises : 3 cartes entreprise", liste.cartes === 3, `${liste.cartes}`);
  check("annuaire /entreprises : filtres présents", liste.filtres);

  // 2. Clic première carte → fiche
  await evaluate(cdp, `document.querySelector('[data-probe="entreprise-carte"]').click()`);
  await sleep(1200);

  // 3. Fiche /entreprises/[id]
  const fiche = await evaluate(cdp, `(() => ({
    url: location.pathname,
    nom: document.querySelector('[data-probe="fiche-nom"]')?.textContent?.trim() ?? "",
    secteur: document.querySelector('[data-probe="fiche-secteur"]')?.textContent?.trim() ?? "",
    description: !!document.querySelector('[data-probe="fiche-description"]'),
    offres: document.querySelectorAll('[data-probe="fiche-offre"]').length,
    verifiee: document.body.textContent.includes("Vérifiée") || document.body.textContent.includes("verifiée"),
  }))()`);
  check("fiche : navigation vers /entreprises/[id]", /\/entreprises\/.+/.test(fiche.url), fiche.url);
  check("fiche : nom + secteur + description", fiche.nom === "Mauritel" && fiche.secteur === "Telecoms" && fiche.description, fiche.nom);
  check("fiche : 2 offres actives listées", fiche.offres === 2, `${fiche.offres}`);

  // 4. Retour annuaire
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/entreprises` });
  await sleep(2200);
  const retour = await evaluate(cdp, `document.querySelectorAll('[data-probe="entreprise-carte"]').length`);
  check("retour /entreprises : 3 cartes à nouveau", retour === 3, `${retour}`);
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

    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*api/v1/entreprises*", requestStage: "Request" }] });
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
        if (request.method === "GET" && /\/api\/v1\/entreprises\/[^/?#]+/.test(url)) {
          const id = url.match(/\/api\/v1\/entreprises\/([^/?#]+)/)[1];
          corps = FICHES[id] ?? null;
        } else if (request.method === "GET" && url.includes("/api/v1/entreprises")) {
          corps = ENTREPRISES;
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

    console.log(`\n=== Entreprises (Sprint 2) — annuaire + fiche (port ${PORT}) ===`);
    await scenario(cdp);

    const erreurs = consoleErrors.filter((t) => !/facebook|favicon|404|Failed to load resource/i.test(t));
    check("0 erreur console", erreurs.length === 0, erreurs.slice(0, 2).join(" | "));
    cdp.close();
  } finally {
    killTree(server.pid);
    killTree(chrome.pid);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }

  const passes = checks.filter((c) => c.ok).length;
  console.log(`\n=== SYNTHÈSE ===`);
  console.log(`  mesures vertes         : ${passes}/${checks.length}`);
  console.log(`  RÉSULTAT               : ${passes === checks.length ? "TOUT VERT ✅" : "ÉCHEC ❌"}`);
  process.exit(passes === checks.length ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
