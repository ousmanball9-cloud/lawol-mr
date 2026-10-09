/**
 * Vérification de la modale détail d'offre — rejouable en une commande.
 *
 *   node scripts/verify-offre-modal.mjs
 *
 * Le script de verify-design.mjs ne couvre que la page profil FERMÉE (la sonde
 * ne clique jamais sur une carte). Ce script éprouve la modale par le chemin
 * réel : clic sur la carte → contenu → postuler → Échap → clic backdrop →
 * cas mobile (hauteur 85vh + scroll) → cas « aucun canal ». 0 erreur console.
 * Captures PNG dans apps/web/.verify-offre-modal/ pour contrôle visuel.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(WEB_ROOT, ".verify-offre-modal");
const PORT = await portLibre(4800);
const CDP_PORT = await portLibre(9800);

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

const PROFILE = {
  id: "p1",
  telephone: "2221234567",
  nom: "Ould Ahmed",
  prenom: "Fatimetou",
  universite: "Université de Nouakchott",
  filiere: "informatique",
  niveau: "M2",
  ville: "nouakchott",
  types_recherches: ["stage_pfe"],
};

/** Bandeau P5 minimal (mock local : la page profil le fetch aussi). */
const DASHBOARD_MOCK = {
  profil: { id: "p1", nom: "Ould Ahmed", prenom: "Fatimetou", score_profil: 80 },
  resume: { offres_dispo: 2, nouvelles_7j: 1, postules_total: 1, en_cours: 1 },
  postes_annee: [{ poste: "développeur", count: 3 }],
};

const DESCRIPTION_LONGUE =
  "Mission encadrée en entreprise sur la durée du semestre. Vous participerez à " +
  "l'analyse du trafic réseau, à la production de tableaux de bord et à la " +
  "rédaction d'un rapport technique en français. Les missions concrètes démarrent " +
  "dès la première semaine, sous la supervision d'un ingénieur référent. " +
  "Possibilité d'embauche à l'issue du stage pour les profils qui confirment. " +
  "Candidature ouverte aux étudiants en M2 informatique ou génie électrique " +
  "mais volontaires, maîtrisant au minimum les bases de Python et des " +
  "tableurs avancés. Une lettre de motivation et un CV sont demandés.";

const OFFRES_MOCK = [
  {
    id: "m1",
    postule: false,
    offre: {
      id: "o-m1",
      titre: "Stage PFE — Analyse de données réseau",
      entreprise: "Mauritel",
      ville: "nouakchott",
      type_offre: "stage_pfe",
      date_limite: "30/11/2026", // format français des scrapers
      description: DESCRIPTION_LONGUE,
      // Sans préfixe : prouve le nettoyage + ajout du 222 mauritanien
      contact_whatsapp: "45 67 89 12",
      contact_email: "recrutement@mauritel.mr",
      source_url: "javascript:alert(1)", // doit être REJETÉ (garde http/https)
      source_name: "Beta-MR",
      filieres_cibles: ["informatique", "electrique"],
    },
  },
  {
    id: "m2",
    postule: true,
    offre: {
      id: "o-m2",
      titre: "Bourse d'études excellence 2026",
      entreprise: "ANPE",
      ville: "kaedi",
      type_offre: "bourse",
      date_limite: "10/01/2027",
      description: "Bourse complète pour master 2.",
      contact_email: null,
      contact_whatsapp: null,
      source_url: null,
      source_name: "ANPE",
      filieres_cibles: [],
    },
  },
];

/* ---------- CDP minimal (copie du pattern de verify-design.mjs) ---------- */

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* pas encore prêt */ }
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

/* ---------- Checks ---------- */

const checks = [];
function check(nom, condition, detail = "") {
  checks.push({ nom, ok: Boolean(condition) });
  console.log(`  ${condition ? "OK " : "KO "} ${nom}${detail ? `  [${detail}]` : ""}`);
}

/* ---------- Scénario ---------- */

async function scenario(cdp) {
  let consoleErrors = [];
  cdp.on((msg) => {
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 160));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push((msg.params.exceptionDetails?.exception?.description ?? "exception").slice(0, 160));
    }
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      consoleErrors.push(`${msg.params.entry.source}: ${(msg.params.entry.text ?? "").slice(0, 120)}`);
    }
  });

  // Clic Partager : la modale ne doit PAS s'ouvrir (les boutons carte sont exclus)
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/profil/2221234567` });
  await sleep(2600);
  await evaluate(cdp, `[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Partager")).click()`);
  await sleep(400);
  check("bouton Partager de la carte n'ouvre PAS la modale", (await evaluate(cdp, `!!document.querySelector("[role=dialog]")`)) === false);

  // 1. Clic sur la carte (le vrai chemin) → modale ouverte
  await evaluate(cdp, `document.querySelector('[aria-label^="Voir le détail"]').click()`);
  await sleep(500);
  const vue = await evaluate(cdp, `(() => {
    const d = document.querySelector("[role=dialog]");
    if (!d) return null;
    const lienSource = d.querySelector('a[href*="example.com"]');
    return {
      titre: d.querySelector("h2")?.textContent ?? "",
      badgeType: d.querySelector("span")?.textContent ?? "",
      entreprise: d.textContent.includes("Mauritel"),
      ville: d.textContent.includes("nouakchott"),
      source: d.textContent.includes("Beta-MR"),
      dateClair: /Avant le \\d+ [a-zéû]+\\. 2026/.test(d.textContent),
      compteRebours: /J-\\d+/.test(d.textContent),
      descriptionComplete: d.textContent.includes("embauche à l'issue") && d.textContent.includes("tableurs avancés"),
      filieres: d.querySelectorAll("span.capitalize").length,
      mailto: !!d.querySelector('a[href^="mailto:recrutement@mauritel.mr"]'),
      waMe: d.querySelector('a[href*="wa.me"]')?.href ?? "",
      lienSourceRejete: lienSource === null || lienSource === undefined,
      boutonPostule: [...d.querySelectorAll("button")].some((b) => b.textContent.trim() === "J'ai postulé"),
      scrollDialog: getComputedStyle(d).overflowY,
      scrollBody: document.body.style.overflow,
      rect: { h: Math.round(d.getBoundingClientRect().height), vh: window.innerHeight },
    };
  })()`);
  check("modale ouverte au clic sur la carte", vue !== null);
  check("badge type + titre affichés", vue.badgeType === "Stage PFE" && vue.titre.includes("Analyse de données réseau"), vue.titre);
  check("entreprise + ville + source affichés", vue.entreprise && vue.ville && vue.source);
  check("date limite en clair (« Avant le 30 nov. 2026 »)", vue.dateClair);
  check("compte à rebours J-X affiché", vue.compteRebours);
  check("description complète (pas de line-clamp)", vue.descriptionComplete);
  check("filières cibles en badges (2)", vue.filieres === 2, `${vue.filieres} badges`);
  check("bouton e-mail mailto présent", vue.mailto);
  check("WhatsApp nettoyé + préfixé 222", vue.waMe === "https://wa.me/22245678912", vue.waMe);
  check("source_url javascript: REJETÉ (garde http/https)", vue.lienSourceRejete);
  check("bouton « J'ai postulé » présent dans la modale", vue.boutonPostule);
  check("modale scrollable (overflow-y auto)", vue.scrollDialog === "auto");
  check("scroll de la page bloqué derrière la modale", vue.scrollBody === "hidden");
  check("hauteur desktop ≤ 85vh", vue.rect.h <= vue.rect.vh * 0.85 + 2, `${vue.rect.h}px / ${vue.rect.vh}px`);

  const shot = path.join(OUT_DIR, "modale-desktop.png");
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  await writeFile(shot, Buffer.from(data, "base64"));

  // 2. « J'ai postulé » dans la modale → relié au handler existant (POST + état)
  await evaluate(cdp, `[...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "J'ai postulé").click()`);
  await sleep(800);
  const apres = await evaluate(cdp, `(() => {
    const d = document.querySelector("[role=dialog]");
    const carte = document.querySelector(".group");
    return {
      modale: [...d.querySelectorAll("button")].some((b) => b.textContent.includes("Postulé")),
      carte: carte.textContent.includes("Postulé"),
    };
  })()`);
  check("clic « J'ai postulé » → modale passe en « Postulé ✅ »", apres.modale);
  check("état propagé à la carte de la liste", apres.carte);

  // 3. Touche Échap ferme la modale
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(400);
  check("touche Échap ferme la modale", (await evaluate(cdp, `!!document.querySelector("[role=dialog]")`)) === false);
  check("scroll de la page restauré après fermeture", (await evaluate(cdp, `document.body.style.overflow`)) !== "hidden");

  // 4. Clic sur le fond ferme la modale
  await evaluate(cdp, `document.querySelector('[aria-label^="Voir le détail"]').click()`);
  await sleep(400);
  await evaluate(cdp, `document.querySelector("[role=dialog]").parentElement.click()`);
  await sleep(400);
  check("clic sur le fond ferme la modale", (await evaluate(cdp, `!!document.querySelector("[role=dialog]")`)) === false);

  // 5. Mobile : modale à contenu long (m1) → hauteur + scroll, puis cas « aucun canal » (m2)
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await sleep(300);
  const cartes = await evaluate(cdp, `document.querySelectorAll('[aria-label^="Voir le détail"]').length`);
  check("2 cartes affichées (m1 + m2)", cartes === 2, `${cartes} cartes`);
  await evaluate(cdp, `document.querySelectorAll('[aria-label^="Voir le détail"]')[0].click()`);
  await sleep(500);
  const mobile = await evaluate(cdp, `(() => {
    const d = document.querySelector("[role=dialog]");
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return {
      overflow: getComputedStyle(d).overflowY,
      contenuDepasse: d.scrollHeight > d.clientHeight,
      h: Math.round(r.height),
      vh: window.innerHeight,
      debordementX: document.documentElement.scrollWidth - window.innerWidth,
    };
  })()`);
  check("mobile : hauteur ≤ 85vh avec scroll interne", mobile.h <= mobile.vh * 0.85 + 2 && mobile.overflow === "auto" && mobile.contenuDepasse, `${mobile.h}px / ${mobile.vh}px`);
  check("mobile : aucun débordement horizontal", mobile.debordementX <= 2, `${mobile.debordementX}px`);

  const shotMobile = path.join(OUT_DIR, "modale-mobile.png");
  const { data: dataMobile } = await cdp.send("Page.captureScreenshot", { format: "png" });
  await writeFile(shotMobile, Buffer.from(dataMobile, "base64"));

  // Cas « aucun canal » (offre m2, déjà postulée)
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(400);
  await evaluate(cdp, `document.querySelectorAll('[aria-label^="Voir le détail"]')[1].click()`);
  await sleep(500);
  const aide = await evaluate(cdp, `(() => {
    const d = document.querySelector("[role=dialog]");
    if (!d) return null;
    return {
      messageAide: d.textContent.includes("Aucun canal de candidature indiqué"),
      aucunLien: d.querySelectorAll("a").length === 0,
      dejaPostule: [...d.querySelectorAll("button")].some((b) => b.textContent.includes("Postulé") && b.disabled),
    };
  })()`);
  check("aucun canal → message d'aide affiché", aide.messageAide);
  check("aucun canal → aucun lien de candidature", aide.aucunLien);
  check("offre déjà postulée → bouton désactivé « Postulé ✅ »", aide.dejaPostule);

  // 6. Zéro erreur console sur tout le scénario
  const erreurs = consoleErrors.filter((t) => !/facebook|favicon|404|Failed to load resource/i.test(t));
  check("0 erreur console sur le scénario", erreurs.length === 0, erreurs.join(" | ").slice(0, 150));
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
  const chrome = spawn(
    browser,
    [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
      "--disable-extensions", `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`, "--window-size=1440,900", "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    const up = await waitFor(`http://127.0.0.1:${PORT}/`, 60000);
    if (!up) throw new Error(`Serveur de prod non démarré sur le port ${PORT}.`);
    const cdpReady = await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`, 20000);
    if (!cdpReady) throw new Error("CDP indisponible.");

    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const target = targets.find((t) => t.type === "page");
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    // Même mock backend que verify-design.mjs (profils + matches), enrichi
    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*api/v1*", requestStage: "Request" }] });
    cdp.on((msg) => {
      if (msg.method !== "Fetch.requestPaused") return;
      const { requestId, request } = msg.params;
      (async () => {
        const url = request.url;
        if (request.method === "GET" && url.includes("/api/v1/dashboard/")) {
          // P5 : la page profil charge aussi le bandeau → mock local, 0 réseau
          await cdp.send("Fetch.fulfillRequest", {
            requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify(DASHBOARD_MOCK)).toString("base64"),
          });
        } else if (request.method === "GET" && url.includes("/historique")) {
          await cdp.send("Fetch.fulfillRequest", {
            requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify(OFFRES_MOCK)).toString("base64"),
          });
        } else if (request.method === "GET" && url.includes("/api/v1/profils/")) {
          await cdp.send("Fetch.fulfillRequest", {
            requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify(PROFILE)).toString("base64"),
          });
        } else if (request.method === "GET" && url.includes("/api/v1/matches")) {
          await cdp.send("Fetch.fulfillRequest", {
            requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify(OFFRES_MOCK)).toString("base64"),
          });
        } else if (request.method === "POST" && url.includes("/postule")) {
          await cdp.send("Fetch.fulfillRequest", {
            requestId, responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(JSON.stringify({ ok: true })).toString("base64"),
          });
        } else {
          await cdp.send("Fetch.continueRequest", { requestId });
        }
      })().catch(() => {});
    });

    console.log(`\n=== Modale détail d'offre — scénario réel (port ${PORT}) ===`);
    await scenario(cdp);
    cdp.close();
  } finally {
    killTree(server.pid);
    killTree(chrome.pid);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }

  const passes = checks.filter((c) => c.ok).length;
  console.log(`\n=== SYNTHÈSE ===`);
  console.log(`  modale détail           : ${passes}/${checks.length} checks verts`);
  console.log(`  captures PNG            : ${path.relative(process.cwd(), OUT_DIR)}`);
  console.log(`  RÉSULTAT                : ${passes === checks.length ? "TOUT VERT ✅" : "ÉCHEC ❌"}`);
  process.exit(passes === checks.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
