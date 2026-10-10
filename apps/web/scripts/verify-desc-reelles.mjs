/**
 * Vérification de la modale détail sur VRAIES descriptions (base réelle).
 *
 *   node scripts/verify-desc-reelles.mjs     (API locale requise : uvicorn :8000)
 *
 * Trop de vérifications vivent sur des mocks propres : ce script prend les
 * VRAIES offres en base (une par famille de source), les injecte dans la page
 * profil par le chemin réel (clic carte → modale) et mesure la qualité du
 * rendu : zéro menu scrapé, info clé en grille (pas noyée dans la prose),
 * aucun paragraphe mur de texte, aucun mot perdu.
 *
 * Familles : beta_mr (nettoyage lourd), scholar-africa (lignes structurées),
 * 4 blogs WP (prose longue), prose courte (snim/linkedin).
 * Échec non nul tant qu'une famille n'est pas à 100 %.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(WEB_ROOT, ".verify-desc-reelles");
const API = process.env.API_REELLE ?? "http://127.0.0.1:8000";
const PORT = await portLibre(4900);
const CDP_PORT = await portLibre(9900);

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
  const pret = new Promise((res, rej) => { ws.onopen = () => res(); ws.onerror = (e) => rej(new Error(`CDP WS: ${e.message ?? e}`)); });
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

/** Comparaison insensible au format : accents/espaces/ponctuation ignorés. */
const alnum = (t) => (t ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();

/** Menus/briques connus des scrapers — leur présence = description pourrie. */
const RE_JUNK = /Suivez-nous|Se connecter|Pré-Inscription|Tests psycho|vc_column|Accueil Beta|Contactez nous|Partager cette offre|Premier portail|أول بوابة|Base CV|Témoignez/i;

const PROFILE = {
  id: "p1", telephone: "2221234567", nom: "Ould Ahmed", prenom: "Fatimetou",
  universite: "Université de Nouakchott", filiere: "informatique", niveau: "M2",
  ville: "nouakchott", types_recherches: ["bourse", "stage_pfe"],
};
const DASHBOARD_MOCK = {
  profil: { id: "p1", nom: "Ould Ahmed", prenom: "Fatimetou", score_profil: 80 },
  resume: { offres_dispo: 7, nouvelles_7j: 3, postules_total: 1, en_cours: 1 },
  postes_annee: [{ poste: "bourse", count: 4 }],
};

/* ---------- Famille des offres réelles ---------- */
const SOURCES_BOURSE = [
  "beta_mr", "scholar-africa", "opportunity-for-africa",
  "opportunities-for-africans", "opportunities-corners", "opportunity-desk",
];

async function chargerFamilles() {
  const brut = await (await fetch(`${API}/api/v1/offres?limit=200`)).json();
  const liste = Array.isArray(brut) ? brut : brut.offres ?? brut.items ?? [];
  if (!liste.length) throw new Error(`API ${API} : aucune offre (uvicorn lancé ?).`);
  const familles = [];
  for (const src of SOURCES_BOURSE) {
    const o = liste.find((x) => x.source_name === src && (x.description ?? "").length > 80);
    if (o) familles.push({ nom: src, offre: o });
  }
  const courte = liste.find(
    (x) => ["snim", "linkedin"].includes(x.source_name) && (x.description ?? "").length < 150
  );
  if (courte) familles.push({ nom: `prose-courte/${courte.source_name}`, offre: courte });
  // Couverture stricte : chaque source bourse doit être représentée — la
  // disparition d'une famille entière ne doit jamais passer en silence.
  const manquantes = SOURCES_BOURSE.filter((s) => !familles.some((f) => f.nom === s));
  if (manquantes.length) {
    throw new Error(
      `Source(s) réelle(s) manquante(s) : ${manquantes.join(", ")} — collecte lancée ? (les 6 familles bourses sont exigées)`
    );
  }
  return familles;
}

/* ---------- Scénario ---------- */
async function scenario(cdp, familles) {
  const matches = familles.map((f, i) => ({
    id: `r${i}`,
    postule: false,
    offre: {
      id: f.offre.id ?? `o-r${i}`,
      titre: f.offre.titre,
      entreprise: f.offre.entreprise ?? "",
      ville: f.offre.ville ?? "nouakchott",
      type_offre: f.offre.type_offre ?? "bourse",
      date_limite: f.offre.date_limite ?? "",
      description: f.offre.description ?? "",
      source_name: f.offre.source_name ?? null,
      source_url: f.offre.source_url ?? null,
      filieres_cibles: f.offre.filieres_cibles ?? [],
      contact_email: f.offre.contact_email ?? null,
      contact_whatsapp: f.offre.contact_whatsapp ?? null,
    },
  }));

  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/profil/2221234567` });
  await sleep(2600);

  const nbCartes = await evaluate(cdp, `document.querySelectorAll('[aria-label^="Voir le détail"]').length`);
  check(`${familles.length} offres réelles injectées (cartes)`, nbCartes === familles.length, `${nbCartes} cartes`);

  for (let i = 0; i < familles.length; i++) {
    const f = familles[i];
    await evaluate(cdp, `document.querySelector('[role=dialog]') && document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))`);
    await sleep(250);
    await evaluate(cdp, `document.querySelectorAll('[aria-label^="Voir le détail"]')[${i}].click()`);
    await sleep(550);
    const m = await evaluate(cdp, `(() => {
      const d = document.querySelector("[role=dialog]");
      if (!d) return null;
      const paras = [...d.querySelectorAll('[data-probe="desc-para"]')].map((n) => n.textContent ?? "");
      // Toutes les grilles rendues (plusieurs blocs infos possibles)
      const grille = [...d.querySelectorAll('[data-probe="desc-infos"]')].flatMap((dl) => {
        const dts = [...dl.querySelectorAll("dt")];
        const dds = [...dl.querySelectorAll("dd")];
        return dts.map((n, i) => [n.textContent ?? "", dds[i]?.textContent ?? ""]);
      });
      return {
        texte: d.textContent ?? "",
        grille,
        paraMax: paras.reduce((a, b) => Math.max(a, b.length), 0),
      };
    })()`);

    check(`[${f.nom}] modale ouverte`, m !== null);
    if (!m) continue;
    const brut = f.offre.description ?? "";

    check(`[${f.nom}] zéro menu/brique scrapé`, !RE_JUNK.test(m.texte));

    // Toute description contenant « mot : valeur » (hors URL qui contient aussi
    // un « : ») doit présenter une grille d'infos
    const attendGrille = /\w{3,}\s*:\s*\S/.test(brut.replace(/https?:\/\/\S+/gi, " "));
    if (attendGrille) {
      check(
        `[${f.nom}] info clé en grille (≥1 paire, hors prose)`,
        m.grille.length >= 1,
        `${m.grille.length} paires${m.grille.length ? ` (${m.grille.map(([k, v]) => `${k}=${v}`).join(" | ")})` : ` || brut: ${brut.slice(0, 90)}`}`
      );
    }

    check(`[${f.nom}] aucun paragraphe mur de texte (≤400 car.)`, m.paraMax <= 400, `max ${m.paraMax} car.`);

    // Aucun mot perdu, DU DÉBUT À LA FIN : le texte brut entier (normalisé)
    // doit figurer dans la modale — pas seulement sa tête.
    const attendu = alnum(brut);
    const present = attendu.length <= 20 || alnum(m.texte).includes(attendu);
    check(
      `[${f.nom}] rien de perdu (texte brut entier présent)`,
      present,
      present
        ? `${attendu.length} car. vérifiés`
        : `brut « ${brut.slice(0, 90)} » || grille ${JSON.stringify(m.grille)}`
    );
  }
}

/* ---------- Principal ---------- */
async function main() {
  const browser = findBrowser();
  if (!browser) throw new Error("Aucun Chrome/Edge trouvé (variable VERIFY_BROWSER).");
  const familles = await chargerFamilles();
  console.log(`Familles réelles : ${familles.map((f) => f.nom).join(", ")}`);

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

    const MATCHES = familles.map((f, i) => ({
      id: `r${i}`, postule: false,
      offre: {
        id: f.offre.id ?? `o-r${i}`, titre: f.offre.titre, entreprise: f.offre.entreprise ?? "",
        ville: f.offre.ville ?? "nouakchott", type_offre: f.offre.type_offre ?? "bourse",
        date_limite: f.offre.date_limite ?? "", description: f.offre.description ?? "",
        source_name: f.offre.source_name ?? null, source_url: f.offre.source_url ?? null,
        filieres_cibles: f.offre.filieres_cibles ?? [],
        contact_email: f.offre.contact_email ?? null, contact_whatsapp: f.offre.contact_whatsapp ?? null,
      },
    }));

    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*api/v1*", requestStage: "Request" }] });
    cdp.on((msg) => {
      if (msg.method !== "Fetch.requestPaused") return;
      const { requestId, request } = msg.params;
      (async () => {
        const url = request.url;
        let corps = null;
        if (request.method === "GET" && url.includes("/api/v1/dashboard/")) corps = DASHBOARD_MOCK;
        else if (request.method === "GET" && url.includes("/historique")) corps = MATCHES;
        else if (request.method === "GET" && url.includes("/api/v1/profils/")) corps = PROFILE;
        else if (request.method === "GET" && url.includes("/api/v1/matches")) corps = MATCHES;
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

    console.log(`\n=== Modale sur descriptions RÉELLES — ${familles.length} familles (port ${PORT}) ===`);
    await scenario(cdp, familles);
    cdp.close();
  } finally {
    killTree(server.pid);
    killTree(chrome.pid);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }

  const passes = checks.filter((c) => c.ok).length;
  console.log(`\n=== SYNTHÈSE ===`);
  console.log(`  familles réelles       : ${familles.length}`);
  console.log(`  mesures vertes         : ${passes}/${checks.length}`);
  console.log(`  RÉSULTAT               : ${passes === checks.length ? "TOUT VERT ✅" : "ÉCHEC ❌"}`);
  process.exit(passes === checks.length ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
