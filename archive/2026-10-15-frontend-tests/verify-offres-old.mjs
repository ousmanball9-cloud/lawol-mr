/**
 * Vérification des pages Offres publiques (Sprint 1 Jobteaser) — rejouable.
 *
 *   node scripts/verify-offres.mjs
 *
 * Éprouve le chemin réel : liste /offres (recherche + filtres + pagination)
 * → détail /offres/[id] (description organisée, CTA candidater, similaires).
 * Backend simulé par interception CDP (mocks déterministes).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(WEB_ROOT, ".verify-offres");
const PORT = await portLibre(4960);
const CDP_PORT = await portLibre(9960);

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
const OFFRES_LISTE = [
  { id: "o1", titre: "Stage PFE — Développement web", entreprise: "Mauritel", ville: "nouakchott", filieres_cibles: ["informatique"], type_offre: "stage_pfe", description: "Mission encadrée : refonte du portail client, stack React/Node, encadrement par un senior.", date_limite: "2026-11-30", contact_email: "rh@mauritel.mr", contact_whatsapp: null, source_name: "Mauritel", source_url: "https://mauritel.mr", active: true },
  { id: "o2", titre: "Data Analyst junior", entreprise: "BNM", ville: "nouadhibou", filieres_cibles: ["informatique", "gestion"], type_offre: "emploi_junior", description: "Analyse des données de vente, tableaux de bord SQL, reporting hebdomadaire.", date_limite: "2026-12-15", contact_email: "recrutement@bnm.mr", contact_whatsapp: null, source_name: "BNM", source_url: null, active: true },
  { id: "o3", titre: "Bourse d'études 2027", entreprise: "ANPE", ville: "kaedi", filieres_cibles: ["informatique", "genie_civil", "electrique", "mecanique", "gestion", "finance", "droit", "medecine", "agronomie"], type_offre: "bourse", description: "Bourse complète pour étudiants mauritaniens, niveau Master.", date_limite: "2027-01-10", contact_email: null, contact_whatsapp: "2221234567", source_name: "ANPE", source_url: null, active: true },
  { id: "o4", titre: "Alternance — Gestion de projet", entreprise: "Ooredoo", ville: "nouakchott", filieres_cibles: ["gestion"], type_offre: "alternance", description: "Alternance 12 mois, gestion de projet digital, rythme 3j/4j.", date_limite: "2026-12-05", contact_email: "rh@ooredoo.mr", contact_whatsapp: null, source_name: "Ooredoo", source_url: "https://ooredoo.mr", active: true },
  { id: "o5", titre: "Stage été — Maintenance", entreprise: "SNIM", ville: "rosso", filieres_cibles: ["mecanique", "electrique"], type_offre: "stage_ete", description: "Stage été 3 mois sur site minier, maintenance préventive.", date_limite: "2026-12-20", contact_email: "stages@snim.mr", contact_whatsapp: null, source_name: "SNIM", source_url: null, active: true },
  { id: "o6", titre: "Stage PFE — Réseaux télécom", entreprise: "Mauritel", ville: "nouakchott", filieres_cibles: ["informatique", "electrique"], type_offre: "stage_pfe", description: "Déploiement fibre optique, supervision des équipements réseau.", date_limite: "2026-11-25", contact_email: "rh@mauritel.mr", contact_whatsapp: null, source_name: "Mauritel", source_url: null, active: true },
  { id: "o7", titre: "Emploi junior — Comptabilité", entreprise: "BNM", ville: "nouakchott", filieres_cibles: ["gestion", "finance"], type_offre: "emploi_junior", description: "Tenue des journaux, rapprochements bancaires, clôtures mensuelles.", date_limite: "2026-12-10", contact_email: "recrutement@bnm.mr", contact_whatsapp: null, source_name: "BNM", source_url: null, active: true },
  { id: "o8", titre: "Stage PFE — Génie civil", entreprise: "SNIM", ville: "nouadhibou", filieres_cibles: ["genie_civil"], type_offre: "stage_pfe", description: "Études de structure, suivi de chantier, rapport d'avancement.", date_limite: "2026-11-28", contact_email: "stages@snim.mr", contact_whatsapp: null, source_name: "SNIM", source_url: null, active: true },
  { id: "o9", titre: "Alternance — Marketing digital", entreprise: "Ooredoo", ville: "nouakchott", filieres_cibles: ["gestion"], type_offre: "alternance", description: "Community management, campagnes publicitaires, analyse des performances.", date_limite: "2026-12-01", contact_email: "rh@ooredoo.mr", contact_whatsapp: null, source_name: "Ooredoo", source_url: null, active: true },
  { id: "o10", titre: "Stage été — Logistique", entreprise: "Port Autonome", ville: "nouakchott", filieres_cibles: ["gestion"], type_offre: "stage_ete", description: "Suivi des opérations portuaires, gestion des flux conteneurs.", date_limite: "2026-12-18", contact_email: "rh@port.mr", contact_whatsapp: null, source_name: "Port Autonome", source_url: null, active: true },
  { id: "o11", titre: "Emploi junior — Service client", entreprise: "Ooredoo", ville: "nouadhibou", filieres_cibles: ["gestion"], type_offre: "emploi_junior", description: "Gestion des réclamations, fidélisation, reporting qualité.", date_limite: "2026-12-12", contact_email: "rh@ooredoo.mr", contact_whatsapp: null, source_name: "Ooredoo", source_url: null, active: true },
  { id: "o12", titre: "Stage PFE — Cybersécurité", entreprise: "Mauritel", ville: "nouakchott", filieres_cibles: ["informatique"], type_offre: "stage_pfe", description: "Audit de sécurité, tests d'intrusion, durcissement des systèmes.", date_limite: "2026-11-22", contact_email: "rh@mauritel.mr", contact_whatsapp: null, source_name: "Mauritel", source_url: null, active: true },
  { id: "o13", titre: "Stage été — Environnement", entreprise: "SNIM", ville: "rosso", filieres_cibles: ["genie_civil"], type_offre: "stage_ete", description: "Suivi environnemental du site minier, conformité réglementaire.", date_limite: "2026-12-22", contact_email: "stages@snim.mr", contact_whatsapp: null, source_name: "SNIM", source_url: null, active: true },
  { id: "o14", titre: "Emploi junior — Ressources humaines", entreprise: "CNASS", ville: "nouakchott", filieres_cibles: ["gestion", "droit"], type_offre: "emploi_junior", description: "Gestion des dossiers salariés, paie, recrutement.", date_limite: "2026-12-08", contact_email: "rh@cnass.mr", contact_whatsapp: null, source_name: "CNASS", source_url: null, active: true },
];

/** Cliche la valeur d'un input/select CONTROLE par React : le setter natif
 * + événement input/change (sinon React ignore l'affectation directe). */
function setNativeValue(element, valeur) {
  const proto = element.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(element, valeur);
  else element.value = valeur;
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

function offreDetail(id) {
  const o = OFFRES_LISTE.find((x) => x.id === id);
  if (!o) return null;
  return { ...o, description: o.description + " Profil recherché : diplômé ou étudiant en fin de parcours, motivé et autonome. Référence de l'offre : " + id.toUpperCase() + "." };
}

/* ---------- Scénario ---------- */
async function scenario(cdp) {
  // 1. Liste /offres
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/offres` });
  await sleep(2600);
  const liste = await evaluate(cdp, `(() => ({
    cartes: document.querySelectorAll('[data-probe="offre-carte"]').length,
    recherche: !!document.querySelector('[data-probe="offres-recherche"]'),
    filtres: !!document.querySelector('[data-probe="offres-filtres"]'),
    pagination: !!document.querySelector('[data-probe="offres-pagination"]'),
    titre: document.querySelector("h1")?.textContent?.trim() ?? "",
  }))()`);
  check("liste /offres : 12 cartes (page 1/2)", liste.cartes === 12, `${liste.cartes}`);

  // 1b. Pagination : page 2 → 2 cartes, retour page 1 → 12
  await evaluate(cdp, `(() => {
    const p2 = [...document.querySelectorAll('[data-probe="offres-pagination"] button')].find((b) => b.textContent.trim() === "2");
    if (p2) p2.click();
  })()`);
  await sleep(500);
  const page2 = await evaluate(cdp, `document.querySelectorAll('[data-probe="offre-carte"]').length`);
  check("pagination : page 2 → 2 cartes", page2 === 2, `${page2}`);
  await evaluate(cdp, `(() => {
    const p1 = [...document.querySelectorAll('[data-probe="offres-pagination"] button')].find((b) => b.textContent.trim() === "1");
    if (p1) p1.click();
  })()`);
  await sleep(500);
  const page1 = await evaluate(cdp, `document.querySelectorAll('[data-probe="offre-carte"]').length`);
  check("pagination : retour page 1 → 12 cartes", page1 === 12, `${page1}`);
  check("liste /offres : recherche + filtres + pagination présents", liste.recherche && liste.filtres && liste.pagination);

  // 2. Recherche : « Data » → 1 carte
  await evaluate(cdp, `(() => {
    const inp = document.querySelector('[data-probe="offres-recherche"] input');
    if (!inp) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(inp, "Data"); else inp.value = "Data";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await sleep(700);
  const recherche = await evaluate(cdp, `document.querySelectorAll('[data-probe="offre-carte"]').length`);
  check("recherche « Data » → 1 carte (filtrage live)", recherche === 1, `${recherche} carte(s)`);

  // 3. Filtre type : bourse → 1 carte
  await evaluate(cdp, `(() => {
    const inp = document.querySelector('[data-probe="offres-recherche"] input');
    if (inp) {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (s) s.call(inp, ""); else inp.value = "";
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    }
  })()`);
  await sleep(400);
  await evaluate(cdp, `(() => {
    const sel = document.querySelector('[data-probe="offres-filtres"] select');
    if (!sel) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(sel, "bourse"); else sel.value = "bourse";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await sleep(700);
  const filtre = await evaluate(cdp, `document.querySelectorAll('[data-probe="offre-carte"]').length`);
  check("filtre type « Bourse » → 1 carte", filtre === 1, `${filtre} carte(s)`);

  // 4. Reset filtre → 12 cartes, puis clic première carte → détail
  await evaluate(cdp, `(() => {
    const sel = document.querySelector('[data-probe="offres-filtres"] select');
    if (!sel) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(sel, "tous"); else sel.value = "tous";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await sleep(600);
  await evaluate(cdp, `document.querySelector('[data-probe="offre-carte"]').click()`);
  await sleep(1200);

  // 5. Détail /offres/[id]
  const detail = await evaluate(cdp, `(() => ({
    url: location.pathname,
    titre: document.querySelector('[data-probe="detail-titre"]')?.textContent?.trim() ?? "",
    entreprise: document.querySelector('[data-probe="detail-entreprise"]')?.textContent?.trim() ?? "",
    description: !!document.querySelector('[data-probe="detail-description"]'),
    cta: !!document.querySelector('[data-probe="detail-cta"]'),
    similaires: document.querySelectorAll('[data-probe="detail-similaires"] [data-probe="offre-carte"]').length,
  }))()`);
  check("détail : navigation vers /offres/[id]", /\/offres\/.+/.test(detail.url), detail.url);
  check("détail : titre + entreprise + description + CTA", detail.titre.length > 3 && detail.entreprise.length > 2 && detail.description && detail.cta, detail.titre);
  check("détail : offres similaires affichées", detail.similaires >= 1, `${detail.similaires}`);

  // 6. Retour liste via navigation
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/offres` });
  await sleep(2200);
  const retour = await evaluate(cdp, `document.querySelectorAll('[data-probe="offre-carte"]').length`);
  check("retour /offres : 12 cartes à nouveau", retour === 12, `${retour}`);
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

    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*api/v1/offres*", requestStage: "Request" }] });
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
        if (request.method === "GET" && /\/api\/v1\/offres\/[^/?#]+/.test(url)) {
          const id = url.match(/\/api\/v1\/offres\/([^/?#]+)/)[1];
          corps = offreDetail(id);
        } else if (request.method === "GET" && url.includes("/api/v1/offres")) {
          corps = OFFRES_LISTE;
        }
        if (corps !== null) {
          await cdp.send("Fetch.fulfillRequest", {
            requestId, responseCode: corps ? 200 : 404,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify(corps)).toString("base64"),
          });
        } else {
          await cdp.send("Fetch.continueRequest", { requestId });
        }
      })().catch(() => {});
    });

    console.log(`\n=== Offres publiques (Sprint 1) — liste + détail (port ${PORT}) ===`);
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
