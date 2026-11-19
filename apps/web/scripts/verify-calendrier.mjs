/**
 * Harnais « calendrier de sélection » — lot V4-E
 * (contrat `docs/contrat-metadata-offres.md` §2.3).
 *
 *   node apps/web/scripts/verify-calendrier.mjs [baseUrl] [apiUrl]
 *   node apps/web/scripts/verify-calendrier.mjs https://lawol-mr.vercel.app
 *
 * Ce que le harnais PROUVE, sur le rendu réel (DOM, pas une intention) :
 *
 *   FICHE `/offres/{id}` — offre AVEC calendrier
 *     1. une offre portant ≥ 2 étapes datées est TROUVÉE dans l'API
 *        (aucun id codé en dur : la sélection est faite depuis l'API) ;
 *     2. `[data-probe="detail-calendrier"]` est PRÉSENT et VISIBLE ;
 *     3. le nombre d'étapes rendues == le nombre d'étapes servies par l'API ;
 *     4. chaque date affichée (`<time datetime>`) == la date `YYYY-MM-DD`
 *        servie par l'API, dans le même ordre (aucune date inventée) ;
 *     5. le texte visible de chaque date == le formatage attendu de CETTE
 *        date (un libellé décalé d'une étape serait un fait faux) ;
 *     6. chaque étape porte le libellé métier de son étape API.
 *
 *   FICHE `/offres/{id}` — offre SANS calendrier
 *     7. AUCUN `[data-probe="detail-calendrier"]`, aucun `calendrier-etape` ;
 *     8. AUCUN texte de remplacement lié au calendrier (« non communiqué »,
 *        « non renseigné », « à venir »…) : sur ce bloc, l'absence est un
 *        SILENCE, jamais une phrase.
 *
 *   LES DEUX FICHES
 *     9. zéro erreur console (attribuée page par page).
 *
 * Code retour : 0 = vert · 1 = au moins un écart (imprimé) · 2 = mesure
 * impossible (pas de Chrome, API injoignable, fiche qui ne rend pas).
 *
 * ⚠ Ne jamais conclure sur un 2 : c'est une absence de preuve, pas un vert.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { API_URL } from "../lib/api-url.ts";

const BASE = (process.argv[2] ?? "https://lawol-mr.vercel.app").replace(/\/$/, "");
const API = (process.argv[3] ?? API_URL).replace(/\/$/, "");
const LARGEUR = 390;
const HAUTEUR = 844;
const ATTENTE_FICHE_MS = 25000;
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
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      erreursConsole.push(
        msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300)
      );
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      erreursConsole.push((d.exception?.description ?? d.text ?? "exception").slice(0, 300));
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

/** Sonde fiche : bloc calendrier, étapes datées, et textes de remplacement. */
const SONDE_FICHE = `(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const norm = (t) => (t || "").trim().replace(/\\s+/g, " ");
  const section = document.querySelector('[data-probe="detail-calendrier"]');
  const items = [...document.querySelectorAll('[data-probe="calendrier-etape"]')];
  const etapes = items.map((li) => {
    const time = li.querySelector("time");
    return {
      dateTime: time ? time.getAttribute("datetime") : null,
      texteDate: time ? norm(time.textContent) : null,
      libelle: norm((li.querySelector("p") || li).textContent).slice(0, 40),
    };
  });
  // Tout ce qui parle de « calendrier » sur la page, avec son contexte :
  // un texte de remplacement doit être VU ici s'il existe.
  const corps = document.body.innerText || "";
  const contextes = [];
  const re = /calendrier/gi;
  let m;
  while ((m = re.exec(corps))) {
    contextes.push(
      norm(corps.slice(Math.max(0, m.index - 90), m.index + m[0].length + 90))
    );
  }
  const REMPLACEMENT = /non communiqu|non renseign|non disponibl|pas disponibl|indisponibl|inconnu|à venir|a venir|non précis|non precise/i;
  return {
    ficheRendue: !!document.querySelector('[data-probe="detail-echeance"]'),
    present: !!section,
    visible: section ? vis(section) : false,
    nbEtapes: items.length,
    etapes,
    remplacements: contextes.filter((c) => REMPLACEMENT.test(c)),
    contextesCalendrier: contextes.slice(0, 5),
    titre: document.title.slice(0, 90),
  };
})()`;

/** Même règle que `apps/web/lib/calendrier.ts` : le harnais ne juge pas autrement. */
const ETAPES = ["candidature", "preselection", "entretien", "resultat"];
const LIBELLES = {
  candidature: "Candidature",
  preselection: "Présélection",
  entretien: "Entretien",
  resultat: "Résultat",
};

function estDateIso(valeur) {
  if (typeof valeur !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;
  const [annee, mois, jour] = valeur.split("-").map(Number);
  const date = new Date(annee, mois - 1, jour);
  return (
    date.getFullYear() === annee && date.getMonth() === mois - 1 && date.getDate() === jour
  );
}

/** Calendrier affichable, ou `null` (silence attendu). */
function calendrierAffichable(calendrier) {
  if (!Array.isArray(calendrier) || calendrier.length < 2) return null;
  const vues = new Set();
  const retenues = [];
  let precedente = null;
  for (const entree of calendrier) {
    if (typeof entree !== "object" || entree === null || Array.isArray(entree)) return null;
    const { etape, date } = entree;
    if (!ETAPES.includes(etape) || vues.has(etape)) return null;
    if (!estDateIso(date)) return null;
    if (precedente !== null && date <= precedente) return null;
    vues.add(etape);
    precedente = date;
    retenues.push({ etape, date });
  }
  return retenues;
}

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** « 17 février 2027 » — même formateur que le composant (construction locale). */
function formaterDateEtape(valeur) {
  const [annee, mois, jour] = valeur.split("-").map(Number);
  return FORMAT_DATE.format(new Date(annee, mois - 1, jour)).replace(/\s+/g, " ");
}

/** Choisit les 2 offres depuis l'API : une avec parcours, une sans (silence). */
async function choisirOffres() {
  const res = await fetch(`${API}/api/v1/offres?limit=200`);
  if (!res.ok) throw new Error(`API offres indisponible (${res.status})`);
  const corps = await res.json();
  const offres = Array.isArray(corps) ? corps : corps.offres ?? corps.items ?? corps.data ?? [];
  if (!Array.isArray(offres) || offres.length === 0) {
    throw new Error("API offres : liste vide (mesure impossible)");
  }
  const auj = new Date().toISOString().slice(0, 10);
  const futures = offres.filter((o) => String(o.date_limite ?? "").slice(0, 10) >= auj);
  const affichables = futures
    .map((o) => ({ offre: o, etapes: calendrierAffichable(o.calendrier) }))
    .filter((x) => x.etapes !== null);
  const avec = affichables[0] ?? null;
  const sans = futures.find((o) => calendrierAffichable(o.calendrier) === null) ?? null;
  return {
    total: offres.length,
    publiques: futures.length,
    avec: avec ? { offre: avec.offre, etapes: avec.etapes } : null,
    sans,
    nbAvec: affichables.length,
  };
}

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.error("Aucun Chrome/Edge trouve (VERIFY_BROWSER / CHROME_PATH).");
    process.exit(2);
  }

  const choix = await choisirOffres();
  const port = await portLibre(9750);
  const profil = path.join(os.tmpdir(), `lawol-calendrier-${Date.now()}`);
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

  const cas = [];
  const ajouter = (famille, libelle, ok, valeur) => cas.push([famille, libelle, ok, valeur]);

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

    /** Navigue vers une fiche et attend que son DOM soit rendu. */
    const ouvrirFiche = async (id) => {
      const url = `${BASE}/offres/${id}`;
      const depuis = cdp.erreursConsole.length;
      await cdp.send("Page.navigate", { url });
      const debut = Date.now();
      let rendue = false;
      while (Date.now() - debut < ATTENTE_FICHE_MS) {
        try {
          rendue = await evaluate(
            cdp,
            `document.readyState === "complete" && !!document.querySelector('[data-probe="detail-echeance"]')`
          );
          if (rendue) break;
        } catch {
          /* contexte détruit par la navigation : on réessaie */
        }
        await sleep(400);
      }
      if (!rendue) throw new Error(`fiche non rendue (${url}) — mesure impossible`);
      await sleep(STABILISATION_MS);
      const sonde = await evaluate(cdp, SONDE_FICHE);
      const erreurs = cdp.erreursConsole
        .slice(depuis)
        .filter((m) => !/favicon|facebook|DevTools/i.test(m));
      return { url, sonde, erreurs };
    };

    // ---------- FAMILLE 1 · fiche AVEC calendrier ----------
    if (!choix.avec) {
      ajouter(
        "avec",
        "une offre AVEC calendrier est servie par l'API",
        false,
        `aucune offre publique ne porte ≥ 2 étapes datées (API : ${choix.nbAvec} sur ${choix.publiques})`
      );
    } else {
      const attendues = choix.avec.etapes;
      const { sonde, erreurs } = await ouvrirFiche(choix.avec.offre.id);

      const datesApi = attendues.map((e) => e.date);
      const datesRendues = sonde.etapes.map((e) => e.dateTime);
      const libellesApi = attendues.map((e) => LIBELLES[e.etape]);
      const textesAttendus = datesApi.map(formaterDateEtape);

      ajouter(
        "avec",
        `offre choisie depuis l'API (${choix.avec.offre.id})`,
        sonde.ficheRendue,
        `${choix.avec.offre.id} · ${attendues.length} étape(s) servie(s) par l'API`
      );
      ajouter(
        "avec",
        "bloc « Calendrier de sélection » visible",
        sonde.present && sonde.visible,
        `present=${sonde.present} visible=${sonde.visible}`
      );
      ajouter(
        "avec",
        "nombre d'étapes rendues == nombre servi par l'API",
        sonde.nbEtapes === attendues.length,
        `rendu=${sonde.nbEtapes} api=${attendues.length}`
      );
      ajouter(
        "avec",
        "chaque date rendue == date YYYY-MM-DD de l'API (aucune inventée)",
        JSON.stringify(datesRendues) === JSON.stringify(datesApi),
        `api=${JSON.stringify(datesApi)} rendu=${JSON.stringify(datesRendues)}`
      );
      ajouter(
        "avec",
        "texte visible de chaque date == formatage de la date API",
        JSON.stringify(sonde.etapes.map((e) => e.texteDate)) === JSON.stringify(textesAttendus),
        `attendu=${JSON.stringify(textesAttendus)} obtenu=${JSON.stringify(sonde.etapes.map((e) => e.texteDate))}`
      );
      ajouter(
        "avec",
        "libellé de chaque étape == étape servie par l'API",
        JSON.stringify(sonde.etapes.map((e) => e.libelle)) === JSON.stringify(libellesApi),
        `attendu=${JSON.stringify(libellesApi)} obtenu=${JSON.stringify(sonde.etapes.map((e) => e.libelle))}`
      );
      ajouter("avec", "aucune erreur console sur la fiche", erreurs.length === 0, erreurs[0] ?? "");

      console.log(`\n${BASE} — ${LARGEUR} px (DPR 2)`);
      console.log(
        `API ${API} — ${choix.publiques} offres publiques / ${choix.total}, ${choix.nbAvec} avec calendrier affichable`
      );
      console.log(`\nfiche AVEC  ${choix.avec.offre.id}`);
      console.log(`  étapes API : ${JSON.stringify(datesApi)}`);
      console.log(`  rendu DOM  : ${JSON.stringify(datesRendues)}`);
    }

    // ---------- FAMILLE 2 · fiche SANS calendrier ----------
    if (!choix.sans) {
      ajouter(
        "sans",
        "une offre SANS calendrier est servie par l'API",
        false,
        "aucune offre publique silencieuse : le cas majoritaire ne peut pas être prouvé"
      );
    } else {
      const { sonde, erreurs } = await ouvrirFiche(choix.sans.id);
      const calendrierApi = calendrierAffichable(choix.sans.calendrier);

      ajouter(
        "sans",
        `offre choisie depuis l'API (${choix.sans.id})`,
        sonde.ficheRendue && calendrierApi === null,
        `${choix.sans.id} · calendrier API=${JSON.stringify(choix.sans.calendrier ?? null)}`
      );
      ajouter(
        "sans",
        "aucun bloc calendrier rendu",
        !sonde.present && sonde.nbEtapes === 0,
        `section=${sonde.present} etapes=${sonde.nbEtapes}`
      );
      ajouter(
        "sans",
        "aucun texte de remplacement lié au calendrier",
        sonde.remplacements.length === 0,
        sonde.remplacements[0] ?? `0 remplacement (${sonde.contextesCalendrier.length} mention(s) neutre(s))`
      );
      ajouter("sans", "aucune erreur console sur la fiche", erreurs.length === 0, erreurs[0] ?? "");

      console.log(`\nfiche SANS  ${choix.sans.id}  (silence attendu)`);
      console.log(`  mentions « calendrier » neutres : ${sonde.contextesCalendrier.length}`);
    }

    // ---------- Verdict ----------
    let echecs = 0;
    let famille = null;
    for (const [fam, libelle, ok, valeur] of cas) {
      if (!ok) echecs++;
      if (fam !== famille) {
        console.log(`\n[${fam === "avec" ? "FICHE AVEC CALENDRIER" : "FICHE SANS CALENDRIER"}]`);
        famille = fam;
      }
      console.log(`  [${ok ? "OK" : "KO"}] ${libelle}  → ${JSON.stringify(valeur)}`);
    }

    cdp.close();
    console.log(
      echecs === 0
        ? "\nVERT — calendrier rendu et daté à l'identique de l'API, silence quand absent, console propre (3 familles)"
        : `\nROUGE — ${echecs} critere(s) en ecart (3 familles mesurees)`
    );
    process.exit(echecs === 0 ? 0 : 1);
  } catch (e) {
    console.error("Mesure impossible : " + String(e).slice(0, 300));
    process.exit(2);
  } finally {
    chrome.kill();
  }
}

main().catch((e) => {
  console.error("Mesure impossible : " + String(e).slice(0, 300));
  process.exit(2);
});
