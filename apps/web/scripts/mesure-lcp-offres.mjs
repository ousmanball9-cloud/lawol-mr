/**
 * Harnais — OÙ partent les secondes du LCP de `/offres` (V2-06). MESURE SEULE.
 *
 * Usage :
 *   node scripts/mesure-lcp-offres.mjs                         # prod par défaut
 *   node scripts/mesure-lcp-offres.mjs https://lawol-mr.vercel.app 5
 *   node scripts/mesure-lcp-offres.mjs http://127.0.0.1:3000 5
 *
 * Ce qu'il mesure, sur 5 passages, sans dépendre du code instrumenté :
 *   1. LCP réel (`PerformanceObserver` sur `largest-contentful-paint`, buffered) ;
 *   2. TTFB (Navigation Timing, `responseStart`) ;
 *   3. durée du/des fetch `/api/v1/offres` (Resource Timing, lots de 500) ;
 *   4. temps jusqu'à la 1re carte (`data-probe="offre-carte"`, MutationObserver
 *      + double `requestAnimationFrame` pour viser la peinture) ;
 *   5. poids JS (CDP `Network.loadingFinished`, repli sur les tailles décodées).
 *
 * Puis il décompose le LCP en étapes qui doivent sommer au total :
 *   TTFB · JS/hydratation avant le fetch · fetch API · rendu des cartes ·
 *   après la 1re carte → LCP · non attribué.
 *
 * ⚠️ Ce script ne promet AUCUN gain : il répond à « où part le temps ? ».
 *    Il ne modifie rien, ne clique rien, ne filtre rien.
 *
 * Reproductibilité : Chrome headless neuf (profil temporaire), viewport 390×844
 * mobile (même cadre que `docs/chasse/05-mobile-perf.md`), même URL `/offres`
 * à chaque passage. Le passage 1 est le seul au cache navigateur FROID ; les
 * passages 2-5 sont à chaud (c'est la valeur comparable aux 2,9-3,6 s connus).
 *
 * Chrome + CDP, aucun paquet externe. Exit 0 = mesure complète, 1 = trou.
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] || "https://lawol-mr.vercel.app").replace(/\/$/, "");
const PASSAGES = Math.max(1, Number(process.argv[3] || 5));
const CIBLE = `${BASE}/offres`;
const CDP_PORT = Number(process.env.CDP_PORT || 9391);
const PROFIL = path.join(os.tmpdir(), `lawol-lcp-${Date.now()}`);
const LARGEUR = 390;
const HAUTEUR = 844;
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
  console.error("Chrome introuvable — définir CHROME_PATH.");
  process.exit(2);
}

/**
 * Sonde injectée AVANT tout script de page (document neuf) : elle observe le
 * LCP et la première carte sans dépendre du module `lib/perf-offres.ts`, qui
 * peut ne pas être déployé. `buffered: true` rattrape les entrées déjà peintes.
 */
const SONDE = `(() => {
  const etat = {
    lcp: null,
    elementLcp: null,
    urlLcp: null,
    premiereCarteDom: null,
    premiereCartePeinte: null,
    cartes: 0,
    erreur: null,
  };
  window.__mesureOffres = etat;
  try {
    new PerformanceObserver((liste) => {
      for (const e of liste.getEntries()) {
        etat.lcp = e.startTime;
        etat.elementLcp = e.element && e.element.tagName ? e.element.tagName.toLowerCase() : null;
        etat.urlLcp = e.url || null;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (err) {
    etat.erreur = String(err);
  }
  const noter = () => {
    if (etat.premiereCarteDom !== null) return;
    if (!document.querySelector('[data-probe="offre-carte"]')) return;
    etat.premiereCarteDom = performance.now();
    // Double rAF : on vise la frame où la carte est réellement peinte.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      etat.premiereCartePeinte = performance.now();
      etat.cartes = document.querySelectorAll('[data-probe="offre-carte"]').length;
    }));
  };
  new MutationObserver(noter).observe(document, { childList: true, subtree: true });
  // Marques posées par le module de la page (si déployé) — contrôle croisé.
  window.__lireMarquesOffres = () => performance
    .getEntriesByType("mark")
    .filter((m) => m.name.indexOf("offres:") === 0)
    .map((m) => ({ nom: m.name, t: m.startTime }));
})();`;

const chrome = spawn(
  exe,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--hide-scrollbars",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFIL}`,
    "--window-size=800,900",
    "about:blank",
  ],
  { stdio: "ignore" }
);

async function attendrePort(url, timeoutMs) {
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

const arrondi = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const ko = (octets) => (typeof octets === "number" && octets > 0 ? Math.round(octets / 1024) : null);
const affiche = (v) => (v === null ? "—" : String(v));
const moyenne = (valeurs) => {
  const propres = valeurs.filter((v) => typeof v === "number" && Number.isFinite(v));
  return propres.length ? propres.reduce((s, v) => s + v, 0) / propres.length : null;
};
const mediane = (valeurs) => {
  const propres = valeurs
    .filter((v) => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!propres.length) return null;
  const milieu = Math.floor(propres.length / 2);
  return propres.length % 2 ? propres[milieu] : (propres[milieu - 1] + propres[milieu]) / 2;
};

/** Tableau texte aligné (1re colonne à gauche, chiffres à droite). */
function tableau(entetes, lignes) {
  const largeurs = entetes.map((t, i) =>
    Math.max(String(t).length, ...lignes.map((l) => String(l[i]).length))
  );
  const ligne = (cellules) =>
    cellules
      .map((c, i) => (i === 0 ? String(c).padEnd(largeurs[i]) : String(c).padStart(largeurs[i])))
      .join("  ");
  console.log("  " + ligne(entetes));
  console.log("  " + largeurs.map((w) => "-".repeat(w)).join("  "));
  for (const l of lignes) console.log("  " + ligne(l));
}

try {
  if (!(await attendrePort(`http://127.0.0.1:${CDP_PORT}/json/version`, 20000))) {
    throw new Error("le port de debug Chrome ne répond pas");
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
  let collecte = null;
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      return;
    }
    if (!collecte) return;
    // Poids réseau réel par requête (indépendant du cache HTTP de la page).
    if (msg.method === "Network.requestWillBeSent") {
      collecte.requetes.set(msg.params.requestId, {
        url: msg.params.request.url,
        type: msg.params.type,
        debut: msg.params.timestamp,
      });
      collecte.nbRequetes += 1;
    } else if (msg.method === "Network.responseReceived") {
      const r = collecte.requetes.get(msg.params.requestId);
      if (r) r.type = msg.params.type;
    } else if (msg.method === "Network.loadingFinished") {
      const r = collecte.requetes.get(msg.params.requestId);
      if (!r) return;
      const octets = msg.params.encodedDataLength || 0;
      collecte.total += octets;
      if (r.type === "Script" || /\.js(\?|$)/.test(r.url)) {
        collecte.js += octets;
        collecte.nbJs += 1;
      }
      if (r.url.includes("/api/v1/offres")) collecte.api += 1;
    } else if (msg.method === "Network.loadingFailed") {
      // Un prefetch RSC annulé par la navigation est normal (`canceled: true`) :
      // on le garde pour la trace mais il ne compte pas comme échec réseau.
      const r = collecte.requetes.get(msg.params.requestId);
      collecte.echecsListe.push({
        url: r ? r.url : "?",
        erreur: msg.params.errorText || "?",
        annule: msg.params.canceled === true,
      });
      if (!msg.params.canceled) collecte.echecs += 1;
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  /** Évaluation tolérante : pendant une navigation le contexte peut disparaître. */
  const evaluer = async (expression) => {
    try {
      const res = await send("Runtime.evaluate", { expression, returnByValue: true });
      return res.result ? res.result.value : null;
    } catch {
      return null;
    }
  };

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: LARGEUR,
    height: HAUTEUR,
    deviceScaleFactor: 3,
    mobile: true,
    screenWidth: LARGEUR,
    screenHeight: HAUTEUR,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: SONDE });

  console.log(`LAWOL — mesure LCP /offres (CDP, ${LARGEUR}×${HAUTEUR} mobile, ${PASSAGES} passages)`);
  console.log(`URL : ${CIBLE}`);
  console.log("Passage 1 = cache navigateur froid ; 2-5 = à chaud.\n");

  const passages = [];
  for (let n = 1; n <= PASSAGES; n++) {
    collecte = {
      requetes: new Map(),
      js: 0,
      total: 0,
      nbJs: 0,
      nbRequetes: 0,
      api: 0,
      echecs: 0,
      echecsListe: [],
    };
    // Nuller l'état du document PRÉCÉDENT : la sonde du nouveau document le recrée.
    await evaluer("window.__mesureOffres = null");
    await send("Page.navigate", { url: CIBLE });

    // Attendre : document complet + première carte peinte (max 30 s).
    const debutAttente = Date.now();
    let pret = false;
    while (Date.now() - debutAttente < 30000) {
      const etat = await evaluer(`(() => {
        const e = window.__mesureOffres;
        return {
          present: !!e,
          carte: !!(e && (e.premiereCartePeinte !== null || e.premiereCarteDom !== null)),
          complet: document.readyState === "complete",
        };
      })()`);
      if (etat && etat.present && etat.carte && etat.complet) {
        pret = true;
        break;
      }
      await sleep(200);
    }
    // Laisse les derniers candidats LCP (images/texte tardifs) se déclarer.
    await sleep(1500);

    const m = await evaluer(`(() => {
      const e = window.__mesureOffres || {};
      const nav = performance.getEntriesByType("navigation")[0] || null;
      const res = performance.getEntriesByType("resource");
      const api = res.filter((r) => r.name.indexOf("/api/v1/offres") !== -1);
      const scripts = res.filter((r) => r.initiatorType === "script" || /\\.js(\\?|$)/.test(r.name));
      return {
        lcp: e.lcp,
        elementLcp: e.elementLcp,
        urlLcp: e.urlLcp,
        erreurSonde: e.erreur,
        premiereCarteDom: e.premiereCarteDom,
        premiereCarte: e.premiereCartePeinte !== null && e.premiereCartePeinte !== undefined
          ? e.premiereCartePeinte
          : e.premiereCarteDom,
        cartes: e.cartes || document.querySelectorAll('[data-probe="offre-carte"]').length,
        ttfb: nav ? nav.responseStart : null,
        dcl: nav ? nav.domContentLoadedEventEnd : null,
        load: nav ? nav.loadEventEnd : null,
        apiNb: api.length,
        apiDebut: api.length ? Math.min(...api.map((r) => r.startTime)) : null,
        apiFin: api.length ? Math.max(...api.map((r) => r.startTime + r.duration)) : null,
        apiDuree: api.reduce((s, r) => s + r.duration, 0),
        jsDecode: scripts.reduce((s, r) => s + (r.decodedBodySize || 0), 0),
        url: location.href,
        marques: window.__lireMarquesOffres ? window.__lireMarquesOffres() : [],
      };
    })()`);

    const brut = m || {};
    const p = {
      n,
      pret,
      lcp: arrondi(brut.lcp),
      elementLcp: brut.elementLcp || null,
      ttfb: arrondi(brut.ttfb),
      dcl: arrondi(brut.dcl),
      load: arrondi(brut.load),
      apiDebut: arrondi(brut.apiDebut),
      apiFin: arrondi(brut.apiFin),
      apiDuree: arrondi(brut.apiDuree),
      apiNb: brut.apiNb || 0,
      premiereCarte: arrondi(brut.premiereCarte),
      cartes: brut.cartes || 0,
      // Poids JS : octets réellement transférés (CDP) ; repli sur les tailles
      // décodées quand la réponse vient du cache (transfert = 0).
      jsKo: ko(collecte.js) ?? ko(brut.jsDecode),
      jsDecodeSeul: !ko(collecte.js),
      totalKo: ko(collecte.total),
      requetes: collecte.nbRequetes,
      echecs: collecte.echecs,
      echecsListe: collecte.echecsListe,
      marques: brut.marques || [],
      erreurSonde: brut.erreurSonde || null,
    };
    passages.push(p);
    console.log(
      `  passage ${n}/${PASSAGES} : LCP ${affiche(p.lcp)} ms · TTFB ${affiche(p.ttfb)} ms · ` +
        `fetch ${affiche(p.apiDuree)} ms (${p.apiNb} appel${p.apiNb > 1 ? "s" : ""}) · ` +
        `1re carte ${affiche(p.premiereCarte)} ms · ` +
        `JS ${affiche(p.jsKo)} Ko${p.pret ? "" : "  (délai de rendu dépassé)"}`
    );
  }

  const chauds = passages.filter((p) => p.n > 1);
  const reference = chauds.length ? chauds : passages;
  const moyenneLcp = moyenne(reference.map((p) => p.lcp));

  /** Décomposition additive du LCP : la somme des étapes + le reste = LCP. */
  const decomposer = (p) => {
    const bornes = [p.lcp, p.ttfb, p.apiDebut, p.apiFin, p.premiereCarte];
    if (bornes.some((v) => v === null)) return null;
    const etapes = {
      ttfb: Math.max(0, p.ttfb),
      attente: Math.max(0, p.apiDebut - p.ttfb),
      fetch: Math.max(0, p.apiFin - p.apiDebut),
      rendu: Math.max(0, p.premiereCarte - p.apiFin),
      apres: Math.max(0, p.lcp - p.premiereCarte),
    };
    const attribue = Object.values(etapes).reduce((s, v) => s + v, 0);
    return { ...etapes, nonAttribue: p.lcp - attribue };
  };
  const decompositions = reference.map(decomposer).filter(Boolean);
  const etapesMoyennes = decompositions.length
    ? {
        ttfb: moyenne(decompositions.map((d) => d.ttfb)),
        attente: moyenne(decompositions.map((d) => d.attente)),
        fetch: moyenne(decompositions.map((d) => d.fetch)),
        rendu: moyenne(decompositions.map((d) => d.rendu)),
        apres: moyenne(decompositions.map((d) => d.apres)),
        nonAttribue: moyenne(decompositions.map((d) => d.nonAttribue)),
      }
    : null;

  console.log("\nJalons bruts (ms ; Ko = transférés ; « décodé » = taille servie par le cache)");
  tableau(
    ["#", "LCP", "TTFB", "fetch API", "1re carte", "cartes", "JS Ko", "total Ko", "req."],
    passages.map((p) => [
      p.n === 1 ? "1 froid" : String(p.n),
      affiche(p.lcp),
      affiche(p.ttfb),
      affiche(p.apiDuree),
      affiche(p.premiereCarte),
      affiche(p.cartes),
      p.jsKo === null ? "—" : p.jsDecodeSeul ? `${p.jsKo} (décodé)` : String(p.jsKo),
      affiche(p.totalKo),
      affiche(p.requetes),
    ])
  );
  const etiquetteChaud = chauds.length
    ? `à chaud (${chauds[0].n}-${chauds[chauds.length - 1].n})`
    : "passage 1";
  tableau(
    ["moyenne", "LCP", "TTFB", "fetch API", "1re carte", "cartes", "JS Ko", "total Ko", "req."],
    [
      [
        etiquetteChaud,
        affiche(arrondi(moyenne(reference.map((p) => p.lcp)))),
        affiche(arrondi(moyenne(reference.map((p) => p.ttfb)))),
        affiche(arrondi(moyenne(reference.map((p) => p.apiDuree)))),
        affiche(arrondi(moyenne(reference.map((p) => p.premiereCarte)))),
        affiche(arrondi(moyenne(reference.map((p) => p.cartes)))),
        affiche(arrondi(moyenne(reference.map((p) => p.jsKo)))),
        affiche(arrondi(moyenne(reference.map((p) => p.totalKo)))),
        affiche(arrondi(moyenne(reference.map((p) => p.requetes)))),
      ],
      [
        "médiane",
        affiche(arrondi(mediane(reference.map((p) => p.lcp)))),
        affiche(arrondi(mediane(reference.map((p) => p.ttfb)))),
        affiche(arrondi(mediane(reference.map((p) => p.apiDuree)))),
        affiche(arrondi(mediane(reference.map((p) => p.premiereCarte)))),
        affiche(arrondi(mediane(reference.map((p) => p.cartes)))),
        affiche(arrondi(mediane(reference.map((p) => p.jsKo)))),
        affiche(arrondi(mediane(reference.map((p) => p.totalKo)))),
        affiche(arrondi(mediane(reference.map((p) => p.requetes)))),
      ],
    ]
  );

  if (etapesMoyennes && moyenneLcp) {
    const libelles = [
      ["TTFB (navigation → 1er octet)", etapesMoyennes.ttfb],
      ["JS + hydratation avant le fetch", etapesMoyennes.attente],
      ["fetch /api/v1/offres", etapesMoyennes.fetch],
      ["rendu des cartes", etapesMoyennes.rendu],
      ["après la 1re carte → LCP", etapesMoyennes.apres],
      ["non attribué (arrondis / recouvrements)", etapesMoyennes.nonAttribue],
    ];
    console.log(
      `\nRépartition du LCP — ${chauds.length ? "moyenne à chaud" : "passage 1"} ` +
        `(${Math.round(moyenneLcp)} ms)`
    );
    tableau(
      ["étape", "ms", "%"],
      libelles.map(([libelle, valeur]) => [
        libelle,
        affiche(valeur === null ? null : Math.round(valeur)),
        valeur === null || !moyenneLcp
          ? "—"
          : ((valeur / moyenneLcp) * 100).toFixed(1).replace(".", ","),
      ])
    );
  } else {
    console.log("\nRépartition impossible : un jalon manque sur tous les passages retenus.");
  }

  console.log(
    `\nÉlément LCP : ${passages.map((p) => `${p.n}=${p.elementLcp || "?"}`).join(" · ")}`
  );
  const avecMarques = passages.filter((p) => p.marques.length > 0);
  if (avecMarques.length) {
    console.log("\nContrôle croisé — marques posées par la page (module perf-offres) :");
    for (const p of avecMarques) {
      const par = Object.fromEntries(p.marques.map((m) => [m.nom, Math.round(m.t)]));
      const debut = par["offres:fetch-debut"];
      const fin = par["offres:fetch-fin"];
      const cartes = par["offres:premier-rendu-cartes"];
      const lcp = par["offres:lcp"];
      console.log(
        `  passage ${p.n} : fetch ${affiche(debut)}→${affiche(fin)} ` +
          `(Δ ${debut !== undefined && fin !== undefined ? fin - debut : "—"} ms) · ` +
          `1re carte ${affiche(cartes === undefined ? null : cartes)} ms · ` +
          `LCP ${affiche(lcp === undefined ? null : lcp)} ms`
      );
    }
  } else {
    console.log(
      "\nContrôle croisé : aucune marque `offres:*` — module non déployé sur cette cible " +
        "(mesure CDP seule, suffisante)."
    );
  }

  // Verdict : la mesure est complète si les 5 grandeurs existent partout.
  const manques = [];
  passages.forEach((p) => {
    if (p.lcp === null) manques.push(`passage ${p.n} : LCP`);
    if (p.ttfb === null) manques.push(`passage ${p.n} : TTFB`);
    if (!p.apiNb || p.apiDuree === null) manques.push(`passage ${p.n} : fetch /api/v1/offres`);
    if (p.premiereCarte === null) manques.push(`passage ${p.n} : 1re carte`);
    if (p.jsKo === null) manques.push(`passage ${p.n} : poids JS`);
    if (!p.cartes) manques.push(`passage ${p.n} : 0 carte rendue`);
  });
  const echecsReseau = passages.reduce((s, p) => s + p.echecs, 0);
  console.log(
    `\n${manques.length === 0 ? "VERT" : "ROUGE"} — ${passages.length - new Set(manques.map((m) => m.split(" : ")[0])).size}/${passages.length} passages complets` +
      (echecsReseau ? ` · ${echecsReseau} requête(s) en échec` : "")
  );
  if (manques.length) {
    for (const manque of manques) console.log(`  manque ${manque}`);
  }
  const annules = passages.reduce((s, p) => s + p.echecsListe.filter((e) => e.annule).length, 0);
  if (echecsReseau || annules) {
    console.log(
      `  réseau : ${echecsReseau} échec(s) réel(s), ${annules} requête(s) annulée(s) par la navigation (normal)`
    );
    for (const echec of passages.flatMap((p) => p.echecsListe).filter((e) => !e.annule).slice(0, 5)) {
      console.log(`  échec ${echec.erreur} — ${echec.url}`);
    }
  }
  console.log(
    "Aucune promesse de gain : ce tableau dit OÙ part le temps, pas comment le réduire."
  );

  ws.close();
  process.exitCode = manques.length === 0 ? 0 : 1;
} catch (e) {
  console.error("ERREUR:", e.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await sleep(500);
  try {
    rmSync(PROFIL, { recursive: true, force: true });
  } catch {
    /* profil temporaire : suppression best-effort */
  }
}
