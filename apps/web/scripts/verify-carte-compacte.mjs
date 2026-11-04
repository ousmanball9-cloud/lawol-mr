/**
 * Harnais « carte d'offre compacte » LAWOL.mr — backlog V3-03.
 *
 *   node apps/web/scripts/verify-carte-compacte.mjs [baseUrl]
 *   node apps/web/scripts/verify-carte-compacte.mjs https://lawol-mr.vercel.app
 *
 * Mesure à 390 × 844 (mobile réel, DPR 2) sur la PREMIÈRE carte du catalogue
 * `/offres`, contre la cible du backlog « ≤ 210 px, 3 zones, un seul badge de
 * confiance » :
 *
 *   1. hauteur de la 1re `[data-probe="offre-carte"]`          ≤ 210 px
 *   2. zones déclarées `[data-zone]` dans la carte              = 3
 *   3. éléments de confiance rendus en PASTILLE dans la carte  = 1
 *      (une pastille = `[data-probe="offre-echeance"]`,
 *       `offre-financement`, `offre-categorie` ou `.badge-offre`
 *       dont la classe porte `rounded-full` ; les mêmes signaux en texte
 *       simple sont des FAITS, ils ne comptent pas comme badges)
 *   4. cibles cliquables dans la carte                          ≥ 44 × 44 px
 *   5. textes visibles dans la carte                            ≥ 12 px
 *   6. erreurs console / exceptions JS                          = 0
 *
 * Code retour : 0 = les 6 critères sont verts · 1 = au moins un écart (imprimé)
 *               · 2 = mesure impossible (Chrome absent, aucune carte rendue…).
 *
 * Sans dépendance : Chrome/Edge headless piloté en CDP (même client minimal que
 * scripts/verify-cibles.mjs). À jouer APRÈS déploiement : en local la prod n'a
 * pas encore ce code.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] ?? "https://lawol-mr.vercel.app").replace(/\/$/, "");
const ROUTE = "/offres";
const LARGEUR = 390;
const HAUTEUR = 844;
const HAUTEUR_MAX_CARTE = 210;
const SEUIL_CIBLE = 44;
const SEUIL_TEXTE = 12;
const ATTENTE_CARTES_MS = 25000;
const STABILISATION_MS = 1800;

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

/** Client CDP minimal : une socket, des messages id → promesse. */
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
    // Preuve « 0 erreur console » : seules les erreurs du site comptent.
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      erreursConsole.push(
        msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300)
      );
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      erreursConsole.push(
        (d.exception?.description ?? d.text ?? "exception").slice(0, 300)
      );
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

/**
 * Sonde exécutée DANS la page. Tout est calculé sur les rects réels (pas une
 * impression) et scopé à la première carte.
 */
const SONDE = `(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const txt = (el) => (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 30);
  const carte = document.querySelector('[data-probe="offre-carte"]');
  if (!carte) return { carte: false };

  const rectCarte = carte.getBoundingClientRect();

  // Éléments de confiance : probes/candidats, séparés en pastilles vs faits texte.
  const signaux = [...carte.querySelectorAll(
    '[data-probe="offre-echeance"],[data-probe="offre-financement"],[data-probe="offre-categorie"],.badge-offre'
  )].filter(vis);
  const pastilles = signaux.filter((el) => String(el.className || "").includes("rounded-full"));

  // Cibles cliquables : la carte elle-même (c'est le <a>) + tout ce qu'elle contient.
  const selecteurCible = "a,button,input,select,textarea,[role=button]";
  const cibles = [carte, ...carte.querySelectorAll(selecteurCible)]
    .filter((el, i, arr) => arr.indexOf(el) === i)
    .filter(vis)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName.toLowerCase(), h: Math.round(r.height), w: Math.round(r.width), txt: txt(el) };
    });
  const ciblesPetites = cibles.filter((c) => c.h < ${SEUIL_CIBLE} || c.w < ${SEUIL_CIBLE});

  // Textes visibles sous 12 px (feuilles et conteneurs porteurs de texte).
  const textes = [...carte.querySelectorAll("p,span,li,a,button,label,h1,h2,h3,h4,h5,h6")]
    .filter((el) => vis(el) && (el.textContent || "").trim().length >= 2)
    .map((el) => ({
      px: parseFloat(getComputedStyle(el).fontSize),
      txt: txt(el),
    }))
    .filter((t) => t.px < ${SEUIL_TEXTE});

  return {
    carte: true,
    hauteur: Math.round(rectCarte.height),
    largeur: Math.round(rectCarte.width),
    pastilles: pastilles.map((el) => ({ probe: el.getAttribute("data-probe") || el.className, txt: txt(el) })),
    faits: signaux.filter((el) => !pastilles.includes(el)).map((el) => ({
      probe: el.getAttribute("data-probe") || "badge-offre",
      txt: txt(el),
    })),
    cibles,
    ciblesPetites,
    textes_sous_seuil: textes,
    apercu: !!carte.querySelector("p.line-clamp-2"),
    zones: [...carte.querySelectorAll("[data-zone]")].map((el) => el.getAttribute("data-zone")),
  };
})()`;

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.error("Aucun Chrome/Edge trouve (VERIFY_BROWSER / CHROME_PATH).");
    process.exit(2);
  }

  const port = await portLibre(9720);
  const profil = path.join(os.tmpdir(), `lawol-carte-${Date.now()}`);
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

  let echecs = 0;
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

    const url = BASE + ROUTE;
    await cdp.send("Page.navigate", { url });

    // Le catalogue est rendu côté CLIENT : on attend la 1re carte, puis on laisse
    // les polices/layouts se stabiliser (une mesure fausse serait pire que rien).
    const debut = Date.now();
    let cartes = 0;
    while (Date.now() - debut < ATTENTE_CARTES_MS) {
      try {
        cartes = await evaluate(
          cdp,
          `document.querySelectorAll('[data-probe="offre-carte"]').length`
        );
        if (cartes > 0) break;
      } catch {
        /* contexte détruit par la navigation : on réessaie */
      }
      await sleep(400);
    }
    if (cartes === 0) {
      throw new Error(`aucune [data-probe="offre-carte"] sur ${url} (page vide ou non déployée)`);
    }
    await sleep(STABILISATION_MS);

    const r = await evaluate(cdp, SONDE);
    if (!r || !r.carte) throw new Error("la sonde n'a pas trouvé la première carte");

    const koHauteur = r.hauteur > HAUTEUR_MAX_CARTE;
    const koZones = r.zones.length !== 3;
    const koConfiance = r.pastilles.length !== 1;
    const koCibles = r.ciblesPetites.length > 0;
    const koTextes = r.textes_sous_seuil.length > 0;
    const erreurs = cdp.erreursConsole.filter((m) => !/favicon|facebook|DevTools/i.test(m));
    const koConsole = erreurs.length > 0;

    const cas = [
      [`hauteur 1re carte ≤ ${HAUTEUR_MAX_CARTE} px`, !koHauteur, `${r.hauteur} px (largeur ${r.largeur} px)`],
      ["3 zones (identite / faits / echeance-CTA)", !koZones, r.zones],
      ["un seul element de confiance (pastille)", !koConfiance, r.pastilles],
      [`cibles ≥ ${SEUIL_CIBLE}×${SEUIL_CIBLE} px`, !koCibles, r.ciblesPetites],
      [`aucun texte < ${SEUIL_TEXTE} px`, !koTextes, r.textes_sous_seuil],
      ["aucune erreur console", !koConsole, erreurs[0] ?? ""],
    ];

    console.log(`\n${url} — 390 px (DPR 2), ${cartes} carte(s) rendue(s)\n`);
    for (const [libelle, ok, valeur] of cas) {
      if (!ok) echecs++;
      console.log(`  [${ok ? "OK" : "KO"}] ${libelle}  → ${JSON.stringify(valeur)}`);
    }
    console.log(
      `\n  faits en texte : ${r.faits.length} | apercu 2 lignes : ${r.apercu}` +
        ` | zones : ${r.zones.join(" / ")}`
    );
    console.log(`  pastilles : ${JSON.stringify(r.pastilles)}`);
    for (const c of r.cibles) console.log(`  cible ${c.tag} ${c.h}×${c.w}px « ${c.txt} »`);

    cdp.close();
  } finally {
    chrome.kill();
  }

  console.log(
    echecs === 0
      ? `\nVERT — carte ≤ ${HAUTEUR_MAX_CARTE} px, 3 zones, 1 badge de confiance, cibles ≥ ${SEUIL_CIBLE} px, textes ≥ ${SEUIL_TEXTE} px, 0 erreur console`
      : `\nROUGE — ${echecs} critere(s) en ecart`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Mesure impossible : " + String(e).slice(0, 300));
  process.exit(2);
});
