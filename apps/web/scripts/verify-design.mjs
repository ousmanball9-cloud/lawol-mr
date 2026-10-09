/**
 * Vérification visuelle LAWOL.mr — une seule commande, tout le reste suit.
 *
 *   node scripts/verify-design.mjs
 *
 * Étapes : 1) next lint  2) next build  3) contraste WCAG statique
 *          4) matrice de rendu réel (navigateur headless via CDP, sans dépendance)
 *          5) synthèse + code retour (0 = tout vert).
 *
 * Matrice : 6 pages × 3 viewports (mobile 375 / tablette 768 / desktop 1440) = 18 cas.
 * Par cas : débordement horizontal, erreur console, probe de contenu, capture PNG
 * dans apps/web/.verify/ pour contrôle visuel.
 * Les pages /profil utilisent l'interception CDP : le VRAI chemin (fetch de la page)
 * avec backend simulé, pour couvrir l'état « profil chargé » sans toucher au code applicatif.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(WEB_ROOT, ".verify");
const PORT = await portLibre();
const CDP_PORT = await portLibre(9600);

/** Port réellement libre (un `next start` zombie bloquerait un port fixe). */
function portLibre(depart = 4500) {
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

/** Arrête le processus ET ses enfants (npm -> next -> node), sinon zombie sur le port. */
function killTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
  else try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch {} }
}

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812, mobile: true },
  { name: "tablette", width: 768, height: 1024, mobile: true },
  { name: "desktop", width: 1440, height: 900, mobile: false },
];

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
};

/** Champs enrichis du backend (vue détail) : un cas par canal de candidature + un sans canal. */
const OFFRES_EXTRAS = {
  m1: {
    contact_email: "recrutement@mauritel.mr",
    source_url: "https://mauritel.mr/offres/pfe-analyse",
    source_name: "Mauritel",
    filieres_cibles: ["informatique", "telecoms"],
  },
  m2: { contact_whatsapp: "+222 45 25 25 25" },
  m3: { source_url: "https://anpe.mr/bourses/2026", source_name: "ANPE", filieres_cibles: ["informatique"] },
  m4: { contact_whatsapp: "0022244445555", contact_email: "rh@ooredoo.mr" },
  m5: {}, // aucun canal → message de repli « Aucun canal de candidature »
};

const OFFRES_MOCK = [
  ["m1", false, "Stage PFE — Analyse de données réseau", "Mauritel", "nouakchott", "stage_pfe", "30/11/2026"],
  ["m2", true, "Data Analyst junior (H/F)", "BNM", "nouadhibou", "emploi_junior", "15/12/2026"],
  ["m3", false, "Bourse d'études excellence 2026", "ANPE", "kaedi", "bourse", "10/01/2027"],
  ["m4", false, "Alternance développement web", "Ooredoo", "nouakchott", "alternance", "05/12/2026"],
  ["m5", false, "Stage été — Ingénierie terrain", "SNIM", "rosso", "stage_ete", "20/12/2026"],
].map(([id, postule, titre, entreprise, ville, type_offre, date_limite]) => ({
  id,
  postule,
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
})).map((m) => ({ ...m, offre: { ...m.offre, ...(OFFRES_EXTRAS[m.id] ?? {}) } }));

const PAGES = [
  {
    id: "landing",
    route: "/",
    mock: false,
    probe: `({
      h1: !!document.querySelector("h1"),
      gradient: !!document.querySelector("h1 span"),
      etapes: document.querySelectorAll("#comment-ca-marche .grid > div").length,
      avantages: document.body.textContent.includes("Pourquoi"),
      types: document.body.textContent.includes("Stage PFE"),
      footer: !!document.querySelector("footer"),
      liensFooter: document.querySelectorAll("footer a[href^='/']").length,
    })`,
    expect: (r) => r.h1 && r.gradient && r.etapes === 3 && r.avantages && r.types && r.footer && r.liensFooter >= 3,
  },
  {
    id: "inscription",
    route: "/inscription",
    mock: false,
    probe: `({
      champs: document.querySelectorAll("form input, form select").length,
      submit: !!document.querySelector("form button[type=submit]"),
      carte: !!document.querySelector("form")?.closest("div[class*='rounded-lg']"),
      titre: document.querySelector("h1")?.textContent ?? "",
    })`,
    expect: (r) => r.champs >= 9 && r.submit && r.carte && r.titre.includes("Inscription"),
  },
  {
    id: "confirmation",
    route: "/inscription/confirmation",
    mock: false,
    probe: `({
      titre: document.querySelector("h1")?.textContent ?? "",
      retour: !!document.querySelector("a[href='/']"),
      pastille: document.body.textContent.includes("Profil enregistré"),
      icone: (() => { const i = document.querySelector("div.h-20"); const c = document.querySelector("span.rounded-full");
        return !i || !c ? null : c.getBoundingClientRect().y - i.getBoundingClientRect().y >= 80; })(),
      display: (() => { const i = document.querySelector("div.h-20"); return i ? getComputedStyle(i).display : null; })(),
    })`,
    expect: (r) => r.titre.includes("réussie") && r.retour && r.pastille && r.icone === true && r.display === "flex",
  },
  {
    id: "profil-chargé",
    route: "/profil/2221234567",
    mock: true,
    probe: `({
      initiales: document.querySelector('[data-profil="avatar"]')?.textContent?.trim() ?? "",
      nom: document.querySelector("h1")?.textContent?.trim() ?? "",
      badges: document.querySelectorAll("span.badge-offre").length,
      cartes: document.querySelectorAll(".group").length,
      boutons: document.querySelectorAll("button").length,
      chips: document.querySelectorAll("div.rounded-lg.bg-muted").length,
    })`,
    expect: (r) =>
      r.initiales.length >= 2 &&
      r.nom.includes("Fatimetou") &&
      r.badges === 5 &&
      r.cartes === 5 &&
      r.boutons >= 8 &&
      r.chips === 4,
  },
  {
    id: "profil-modale",
    route: "/profil/2221234567",
    mock: true,
    // Ouvre la modale détail (clic carte) puis probe le contenu post-clic.
    action: `document.querySelector('button[aria-label^="Voir le détail"]')?.click()`,
    probe: `({
      modale: !!document.querySelector('[role="dialog"]'),
      badge: document.querySelector('[role="dialog"] span')?.textContent?.trim() ?? "",
      titre: document.querySelector('[role="dialog"] h2')?.textContent?.trim() ?? "",
      dateLimite: document.querySelector('[role="dialog"]')?.textContent?.includes("Avant le") ?? false,
      compteARebours: /J-\\d+|Dernier jour|Clôturée/.test(document.querySelector('[role="dialog"]')?.textContent ?? ""),
      description: document.querySelector('[role="dialog"]')?.textContent?.includes("Mission encadrée") ?? false,
      boutonPostuler: [...document.querySelectorAll('[role="dialog"] button')].some((b) => b.textContent.includes("J'ai postulé")),
      lienSource: !!document.querySelector('[role="dialog"] a[href^="https://mauritel.mr"]'),
      mailto: !!document.querySelector('[role="dialog"] a[href^="mailto:recrutement@mauritel.mr"]'),
      scroll: document.querySelector('[role="dialog"]').className.includes("85vh"),
    })`,
    expect: (r) =>
      r.modale &&
      r.badge === "Stage PFE" &&
      r.titre.includes("Analyse de données") &&
      r.dateLimite &&
      r.compteARebours &&
      r.description &&
      r.boutonPostuler &&
      r.lienSource &&
      r.mailto &&
      r.scroll,
  },
  {
    id: "profil-erreur",
    route: "/profil/0000000000",
    mock: false,
    // Cas de stress volontaire : le 404 de l'API EST le scénario, il n'est pas une régression.
    ignoreConsole: [/status of 4\d\d.*\/api\/v1\/profils\//],
    probe: `({
      message: document.body.textContent.includes("Erreur de chargement") || document.body.textContent.includes("Profil non trouvé"),
      retour: !!document.querySelector("a[href='/'] button"),
    })`,
    expect: (r) => r.message && r.retour,
  },
  {
    id: "profil-edit",
    route: "/profil/2221234567/edit",
    mock: true,
    probe: `({
      champs: document.querySelectorAll("form input, form select").length,
      nom: document.querySelector("#nom")?.value ?? "",
      prenom: document.querySelector("#prenom")?.value ?? "",
      submit: !!document.querySelector("button[type=submit]"),
    })`,
    expect: (r) => r.champs >= 7 && r.nom.length > 0 && r.prenom.length > 0 && r.submit,
  },
];

/* ---------- Contraste WCAG (statique, déterministe) ---------- */

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
function relativeLuminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrast(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
const blend = (fg, alpha, bg) => fg.map((v, i) => Math.round(alpha * v + (1 - alpha) * bg[i]));

const WHITE = [255, 255, 255];

/** Hex de la charte (app/globals.css + tailwind.config.ts), exact au pixel. */
const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Palette « Épuré premium » : quasi noir & blanc (fond #FAFAFA, cartes
 * #FFFFFF, encre #0A0A0A, secondaire #52525B, chips #F4F4F5) + UNE couleur
 * signature (#2563EB, survol #1D4ED8) + UN surlignage (#F59E0B).
 */
const TOK = {
  background: hex("#FAFAFA"),
  foreground: hex("#0A0A0A"),
  card: hex("#FFFFFF"),
  muted: hex("#F4F4F5"),
  mutedForeground: hex("#52525B"),
  signature: hex("#2563EB"),
  signatureDeep: hex("#1D4ED8"),
  surlignage: hex("#F59E0B"),
  destructive: hslToRgb(0, 74.7, 41),
  green50: hslToRgb(138.4, 89.2, 95.3),
  green800: hslToRgb(141.7, 63.9, 24.1),
  red50: hslToRgb(0, 86.4, 97.1),
  red700: hslToRgb(0, 74.7, 41),
  amber50: hex("#FFFBEB"),
  amber900: hex("#78350F"),
};

const CONTRAST_CASES = [
  /* — Neutres : texte sur fond de site, cartes et chips — */
  ["texte principal / fond de site", TOK.foreground, TOK.background, 4.5],
  ["texte principal / carte blanche", TOK.foreground, TOK.card, 4.5],
  ["texte secondaire / fond de site", TOK.mutedForeground, TOK.background, 4.5],
  ["texte secondaire / carte blanche", TOK.mutedForeground, TOK.card, 4.5],
  ["texte secondaire / chip muté (profil + badges)", TOK.mutedForeground, TOK.muted, 4.5],
  ["texte principal / chip muté (profil)", TOK.foreground, TOK.muted, 4.5],
  ["libellé chip muté / chip muté", blend(TOK.foreground, 0.7, TOK.muted), TOK.muted, 4.5],

  /* — Sections sombres : hero, CTA final, avatar, pastilles — */
  ["texte blanc / section near-black", WHITE, TOK.foreground, 4.5],
  ["texte blanc 70 % / hero near-black", blend(WHITE, 0.7, TOK.foreground), TOK.foreground, 4.5],
  ["texte blanc 60 % / bloc CTA near-black", blend(WHITE, 0.6, TOK.foreground), TOK.foreground, 4.5],
  ["compte à rebours J-X : blanc / pastille encre", WHITE, TOK.foreground, 4.5],
  ["mot surligné (encre) / surlignage ambre", TOK.foreground, TOK.surlignage, 4.5],
  ["pastille surlignage / section near-black", TOK.surlignage, TOK.foreground, 4.5],

  /* — Signature : CTA, liens, focus rings — */
  ["texte blanc / CTA signature", WHITE, TOK.signature, 4.5],
  ["texte blanc / CTA signature (survol)", WHITE, TOK.signatureDeep, 4.5],
  ["lien signature / fond de site", TOK.signature, TOK.background, 4.5],
  ["lien signature / carte blanche", TOK.signature, TOK.card, 4.5],
  ["lien signature / chip muté", TOK.signature, TOK.muted, 4.5],

  /* — États : erreurs, succès, échéance — */
  ["destructive / carte (astérisque, erreur)", TOK.destructive, TOK.card, 4.5],
  ["rouge erreur / fond rouge 5 %", TOK.red700, TOK.red50, 4.5],
  ["vert succès / fond vert 5 %", TOK.green800, TOK.green50, 4.5],
  ["avertissement « Dernier jour » : ambre 900 / ambre 50", TOK.amber900, TOK.amber50, 4.5],
];

function runContrastChecks() {
  return CONTRAST_CASES.map(([label, fg, bg, min]) => {
    const value = contrast(fg, bg);
    return { label, value: Number(value.toFixed(2)), min, ok: value >= min };
  });
}

/* ---------- Process ---------- */

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: WEB_ROOT, shell: true, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(400);
  }
  return false;
}

function findBrowser() {
  const candidates = [
    process.env.VERIFY_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((c) => existsSync(c)) ?? null;
}

/* ---------- Client CDP minimal (sans dépendance) ---------- */

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
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  return {
    send,
    on: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close: () => ws.close(),
  };
}

async function evaluate(cdp, expression) {
  const res = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
  return res.result.value;
}

/* ---------- Matrice ---------- */

async function runMatrix() {
  const browser = findBrowser();
  if (!browser) throw new Error("Aucun Chrome/Edge trouvé (variable VERIFY_BROWSER).");

  const profileDir = path.join(OUT_DIR, "chrome-profile");
  const chrome = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--disable-extensions",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    const ready = await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`, 20000);
    if (!ready) throw new Error("CDP indisponible (navigateur non démarré).");
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const target = targets.find((t) => t.type === "page");
    if (!target) throw new Error("Aucune cible page CDP.");

    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    let consoleErrors = [];
    let pageErrors = [];
    let mockActive = false;

    cdp.on((msg) => {
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 160);
        if (/facebook|fbq|favicon/i.test(text)) return;
        consoleErrors.push(text);
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const text = (msg.params.exceptionDetails?.exception?.description ?? "exception").slice(0, 160);
        if (/facebook|FB\./i.test(text)) return;
        pageErrors.push(text);
      }
      if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        const e = msg.params.entry;
        if (/facebook|favicon|doubleclick|google-analytics/i.test(e.url ?? "")) return;
        consoleErrors.push(`${e.source}: ${(e.text ?? "").slice(0, 120)} ${e.url ?? ""}`.trim());
      }
      if (msg.method === "Fetch.requestPaused") {
        const { requestId, request } = msg.params;
        (async () => {
          if (!mockActive) {
            await cdp.send("Fetch.continueRequest", { requestId });
            return;
          }
          const url = request.url;
          if (request.method === "GET" && url.includes("/api/v1/profils/")) {
            await cdp.send("Fetch.fulfillRequest", {
              requestId,
              responseCode: 200,
              responseHeaders: [{ name: "Content-Type", value: "application/json" }],
              body: Buffer.from(JSON.stringify(PROFILE)).toString("base64"),
            });
          } else if (request.method === "GET" && url.includes("/api/v1/matches")) {
            await cdp.send("Fetch.fulfillRequest", {
              requestId,
              responseCode: 200,
              responseHeaders: [{ name: "Content-Type", value: "application/json" }],
              body: Buffer.from(JSON.stringify(OFFRES_MOCK)).toString("base64"),
            });
          } else {
            await cdp.send("Fetch.continueRequest", { requestId });
          }
        })().catch(() => {});
      }
    });

    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*api/v1*", requestStage: "Request" }] });

    const results = [];
    for (const pageDef of PAGES) {
      mockActive = pageDef.mock;
      for (const vp of VIEWPORTS) {
        consoleErrors = [];
        pageErrors = [];
        await cdp.send("Emulation.setDeviceMetricsOverride", {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.mobile,
        });
        await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}${pageDef.route}` });
        await sleep(2600);

        let checks = { overflow: 999 };
        let probe = null;
        let probeError = null;
        try {
          checks = await evaluate(
            cdp,
            `({ overflow: document.documentElement.scrollWidth - window.innerWidth })`
          );
          if (pageDef.action) {
            await evaluate(cdp, pageDef.action);
            await sleep(500);
          }
          probe = await evaluate(cdp, pageDef.probe);
        } catch (err) {
          probeError = String(err.message).split("\n")[0];
        }
        const erreurs = [...consoleErrors, ...pageErrors].filter(
          (t) => !(pageDef.ignoreConsole ?? []).some((re) => re.test(t))
        );
        const ok =
          !probeError &&
          checks.overflow <= 2 &&
          erreurs.length === 0 &&
          pageDef.expect(probe ?? {});

        const shot = path.join(OUT_DIR, `${pageDef.id}-${vp.name}.png`);
        const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
        await writeFile(shot, Buffer.from(data, "base64"));

        // Capture pleine page (sections sous la ligne de flottaison + footer)
        const full = path.join(OUT_DIR, `${pageDef.id}-${vp.name}-full.png`);
        try {
          const metrics = await cdp.send("Page.getLayoutMetrics");
          const size = metrics.cssContentSize ?? metrics.contentSize;
          const fullShot = await cdp.send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 },
          });
          await writeFile(full, Buffer.from(fullShot.data, "base64"));
        } catch (err) {
          console.log(`        (capture pleine page impossible : ${err.message})`);
        }

        results.push({
          case: `${pageDef.id} @ ${vp.name} (${vp.width}px)`,
          ok,
          overflow: checks.overflow,
          probe,
          probeError,
          consoleErrors: erreurs,
          shot: path.relative(WEB_ROOT, shot),
        });
      }
    }

    cdp.close();
    return results;
  } finally {
    killTree(chrome.pid);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ---------- Principal ---------- */

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true }).catch(() => {});
  await mkdir(OUT_DIR, { recursive: true });

  console.log("\n=== [1/4] next lint ===");
  const lintCode = await run("npm", ["run", "lint"]);
  console.log("\n=== [2/4] next build ===");
  const buildCode = await run("npm", ["run", "build"]);

  console.log("\n=== [3/4] contraste WCAG ===");
  const contrastRows = runContrastChecks();
  for (const r of contrastRows) {
    console.log(`  ${r.ok ? "OK " : "KO "} ${String(r.value).padStart(6)} / min ${r.min}  ${r.label}`);
  }

  console.log("\n=== [4/4] matrice de rendu (navigateur réel) ===");
  let matrixResults = [];
  let matrixError = null;
  const server = spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    cwd: WEB_ROOT,
    shell: true,
    stdio: "ignore",
  });
  try {
    const up = await waitFor(`http://127.0.0.1:${PORT}/`, 60000);
    if (!up) throw new Error(`Serveur de prod non démarré sur le port ${PORT}.`);
    matrixResults = await runMatrix();
  } catch (err) {
    matrixError = err.message;
  } finally {
    killTree(server.pid);
  }

  if (matrixError) console.log(`  ERREUR matrice : ${matrixError}`);
  for (const r of matrixResults) {
    console.log(`  ${r.ok ? "OK " : "KO "} ${r.case}  (overflow ${r.overflow}px)  → ${r.shot}`);
    if (r.probeError) console.log(`        probe: ${r.probeError}`);
    if (!r.ok && r.probe) console.log(`        probe: ${JSON.stringify(r.probe)}`);
    for (const e of r.consoleErrors) console.log(`        console: ${e}`);
  }

  const total = matrixResults.length;
  const attendu = PAGES.length * VIEWPORTS.length;
  const passes = matrixResults.filter((r) => r.ok).length;
  const contrastPasses = contrastRows.filter((r) => r.ok).length;
  const allOk =
    lintCode === 0 &&
    buildCode === 0 &&
    !matrixError &&
    total === attendu &&
    passes === total &&
    contrastPasses === contrastRows.length;

  console.log("\n=== SYNTHÈSE ===");
  console.log(`  lint (exit ${lintCode})             : ${lintCode === 0 ? "0 erreur" : "ÉCHEC"}`);
  console.log(`  build (exit ${buildCode})             : ${buildCode === 0 ? "0 erreur" : "ÉCHEC"}`);
  console.log(`  contraste WCAG                    : ${contrastPasses}/${contrastRows.length} ≥ seuil AA`);
  console.log(`  matrice visuelle                  : ${passes}/${total} cas verts (attendu ${attendu})`);
  console.log(`  captures PNG                      : ${path.relative(process.cwd(), OUT_DIR)}`);
  console.log(`  RÉSULTAT                          : ${allOk ? "TOUT VERT ✅" : "ÉCHEC ❌"}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
