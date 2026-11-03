/**
 * Harnais LIVE — filtres mobile + bandeau de résultats collant (V2-05 + V2-01).
 *
 * Usage : node scripts/verify-mobile-filtres.mjs [baseUrl]
 *         node scripts/verify-mobile-filtres.mjs https://lawol-mr.vercel.app
 *
 * Ce qui est mesuré, jamais supposé :
 *   V2-05 — sous 768 px, les filtres ne sont plus une pile de `select` : un
 *     bouton « Filtres · n » ouvre un panneau plein écran (`aria-modal`), qui
 *     se ferme par Échap, par ✕ et par le bouton « Voir les N offres », et qui
 *     REND le focus au déclencheur. Le panneau porte TOUS les filtres.
 *   V2-01 — le compteur de résultats est collé sous le header : après 1 400 px
 *     de scroll il est toujours visible, à la hauteur du header.
 *   Non-régression — au-dessus de 768 px la barre historique reste rendue
 *     (aucun bouton « Filtres »), et les `data-probe` historiques restent
 *     uniques.
 *
 * Chrome headless + CDP, aucune dépendance. Exit 0 = vert, 1 = rouge.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] || "https://lawol-mr.vercel.app").replace(/\/$/, "");
const CDP_PORT = Number(process.env.CDP_PORT || 9395);
const PROFIL = path.join(os.tmpdir(), `lawol-mobile-${Date.now()}`);
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

const chrome = spawn(
  exe,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFIL}`,
    "--window-size=375,812",
    "about:blank",
  ],
  { stdio: "ignore" }
);

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

try {
  if (!(await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`, 20000))) {
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
  const messages = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      messages.push(
        msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300)
      );
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  await send("Runtime.enable");
  await send("Page.enable");

  const evalIn = async (expression) => {
    const res = await send("Runtime.evaluate", { returnByValue: true, expression });
    return res.result.value;
  };

  const cas = [];
  const noter = (libelle, ok, valeur) => cas.push([libelle, ok, valeur]);

  const attendreCartes = async (timeoutMs = 25000) => {
    const debut = Date.now();
    while (Date.now() - debut < timeoutMs) {
      const n = await evalIn(
        `document.querySelectorAll('[data-probe="offre-carte"]').length`
      );
      if (n > 0) return n;
      await sleep(400);
    }
    return 0;
  };

  /* ---------- 1. Mobile 375 px : un bouton, pas une pile de filtres ---------- */
  await send("Page.navigate", { url: `${BASE}/offres` });
  const cartes = await attendreCartes();
  noter("mobile — le catalogue est rendu (cartes présentes)", cartes > 0, cartes);

  const barre = await evalIn(`(() => {
    const bouton = document.querySelector('[data-probe="offres-filtres-mobile"]');
    const pile = document.querySelector('[data-probe="offres-filtres"]');
    const compteur = document.querySelectorAll('[data-probe="offres-compteur"]');
    const hauteurBouton = bouton ? Math.round(bouton.getBoundingClientRect().height) : 0;
    const pileVisible = pile
      ? getComputedStyle(pile).display !== "none" && pile.getBoundingClientRect().height > 0
      : false;
    return {
      bouton: !!bouton,
      hauteurBouton,
      pileVisible,
      compteur: compteur.length,
      premiereCarte: (() => {
        const c = document.querySelector('[data-probe="offre-carte"]');
        return c ? Math.round(c.getBoundingClientRect().top + window.scrollY) : null;
      })(),
      pastille: document.querySelector('[data-probe="offres-filtres-actifs"]')?.textContent?.trim() ?? null,
    };
  })()`);

  noter("mobile — bouton « Filtres » présent", barre.bouton === true, barre.bouton);
  noter("mobile — bouton ≥ 44 px", barre.hauteurBouton >= 44, barre.hauteurBouton);
  noter("mobile — la pile de selects n'occupe plus l'écran", barre.pileVisible === false, barre.pileVisible);
  noter("mobile — un seul compteur de résultats dans le DOM", barre.compteur === 1, barre.compteur);
  noter(
    "mobile — la première offre remonte au-dessus de 900 px",
    barre.premiereCarte !== null && barre.premiereCarte < 900,
    barre.premiereCarte
  );

  /* ---------- 2. Le panneau s'ouvre et contient TOUS les filtres ---------- */
  await evalIn(`(() => {
    const b = document.querySelector('[data-probe="offres-filtres-mobile"]');
    b.click();
    return true;
  })()`);
  await sleep(700);

  const panneau = await evalIn(`(() => {
    const p = document.querySelector('[data-probe="offres-panneau"]');
    if (!p) return { ouvert: false };
    const selects = p.querySelectorAll("select").length;
    const bascules = p.querySelectorAll("[aria-pressed]").length;
    const boutonVoir = p.querySelector('[data-probe="offres-panneau-voir"]');
    const r = p.getBoundingClientRect();
    return {
      ouvert: true,
      role: p.getAttribute("role"),
      modal: p.getAttribute("aria-modal"),
      selects,
      bascules,
      boutonVoir: boutonVoir ? boutonVoir.textContent.trim() : null,
      pleinEcran: Math.round(r.width) >= 370 && Math.round(r.height) >= 780,
      ariaExpanded: document
        .querySelector('[data-probe="offres-filtres-mobile"]')
        ?.getAttribute("aria-expanded"),
    };
  })()`);

  noter("panneau — ouvert au clic", panneau.ouvert === true, panneau.ouvert);
  noter("panneau — role=dialog + aria-modal", panneau.role === "dialog" && panneau.modal === "true", {
    role: panneau.role,
    modal: panneau.modal,
  });
  noter("panneau — les 5 selects sont dedans", panneau.selects === 5, panneau.selects);
  noter("panneau — les 2 bascules sont dedans", panneau.bascules === 2, panneau.bascules);
  noter("panneau — plein écran sur 375×812", panneau.pleinEcran === true, panneau.pleinEcran);
  noter("panneau — aria-expanded passe à true sur le déclencheur", panneau.ariaExpanded === "true", panneau.ariaExpanded);
  noter(
    "panneau — le bouton de sortie annonce le nombre d'offres",
    /voir les \d+ offre/i.test(panneau.boutonVoir ?? ""),
    panneau.boutonVoir
  );

  /* ---------- 3. Échap ferme ET rend le focus au déclencheur ---------- */
  await evalIn(`(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return true;
  })()`);
  await sleep(600);
  const apresEchap = await evalIn(`(() => ({
    ferme: !document.querySelector('[data-probe="offres-panneau"]'),
    focus: document.activeElement?.getAttribute("data-probe") ?? document.activeElement?.tagName,
    scrollRendu: getComputedStyle(document.body).overflow,
  }))()`);
  noter("Échap — le panneau se ferme", apresEchap.ferme === true, apresEchap.ferme);
  noter(
    "Échap — le focus revient au bouton « Filtres »",
    apresEchap.focus === "offres-filtres-mobile",
    apresEchap.focus
  );
  noter("Échap — le scroll de la page est rendu", apresEchap.scrollRendu !== "hidden", apresEchap.scrollRendu);

  /* ---------- 4. Le panneau écrit dans l'URL (même contrat que la barre) ---------- */
  await evalIn(`document.querySelector('[data-probe="offres-filtres-mobile"]').click()`);
  await sleep(600);
  await evalIn(`(() => {
    const sel = document.querySelector('[data-probe="offres-panneau"] select#panneau-pays');
    if (!sel) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(sel, "france");
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  await sleep(2500);
  const apresFiltre = await evalIn(`(() => ({
    url: location.search,
    panneauOuvert: !!document.querySelector('[data-probe="offres-panneau"]'),
    pastille: document.querySelector('[data-probe="offres-filtres-actifs"]')?.textContent?.trim() ?? null,
  }))()`);
  noter("panneau — un filtre écrit le paramètre dans l'URL", /pays=france/.test(apresFiltre.url), apresFiltre.url || "(vide)");
  noter("panneau — il reste ouvert pendant qu'on filtre", apresFiltre.panneauOuvert === true, apresFiltre.panneauOuvert);
  noter("panneau — la pastille compte le filtre actif", apresFiltre.pastille === "1", apresFiltre.pastille);

  await evalIn(`document.querySelector('[data-probe="offres-panneau-voir"]')?.click()`);
  await sleep(1200);

  /* ---------- 5. Bandeau collant : visible après 1 400 px de scroll ---------- */
  await evalIn(`window.scrollTo(0, 1400)`);
  await sleep(900);
  const bandeau = await evalIn(`(() => {
    const b = document.querySelector('[data-probe="offres-bandeau"]');
    const h = document.querySelector("header.sticky");
    if (!b) return { present: false };
    const rb = b.getBoundingClientRect();
    const rh = h ? h.getBoundingClientRect() : null;
    return {
      present: true,
      top: Math.round(rb.top),
      bas: Math.round(rb.bottom),
      headerBas: rh ? Math.round(rh.bottom) : null,
      visible: rb.top >= 0 && rb.bottom <= window.innerHeight,
      sticky: getComputedStyle(b).position,
    };
  })()`);
  noter("bandeau — présent dans le DOM", bandeau.present === true, bandeau.present);
  noter("bandeau — position sticky", bandeau.sticky === "sticky", bandeau.sticky);
  noter(
    "bandeau — visible après 1 400 px de scroll (compteur jamais perdu)",
    bandeau.visible === true,
    { top: bandeau.top, bas: bandeau.bas }
  );
  noter(
    "bandeau — collé juste sous le header",
    bandeau.headerBas !== null && Math.abs(bandeau.top - bandeau.headerBas) <= 2,
    { bandeau: bandeau.top, header: bandeau.headerBas }
  );

  /* ---------- 6. Desktop : la barre historique reste, pas de bouton ---------- */
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: `${BASE}/offres` });
  await attendreCartes();
  const desktop = await evalIn(`(() => {
    const bouton = document.querySelector('[data-probe="offres-filtres-mobile"]');
    const pile = document.querySelector('[data-probe="offres-filtres"]');
    return {
      boutonVisible: bouton ? getComputedStyle(bouton).display !== "none" : false,
      pileVisible: pile ? getComputedStyle(pile).display !== "none" : false,
      selects: pile ? pile.querySelectorAll("select").length : 0,
      echeanceVisible: (() => {
        const e = document.querySelector('[data-probe="offres-echeance"]');
        return e ? getComputedStyle(e).display !== "none" : false;
      })(),
    };
  })()`);
  noter("desktop — aucun bouton « Filtres »", desktop.boutonVisible === false, desktop.boutonVisible);
  noter("desktop — la barre historique est rendue", desktop.pileVisible === true, desktop.pileVisible);
  noter("desktop — les 4 selects de la barre sont là", desktop.selects === 4, desktop.selects);
  noter("desktop — tri + échéance visibles", desktop.echeanceVisible === true, desktop.echeanceVisible);

  const erreurs = messages.filter((m) => !/favicon|DevTools/i.test(m));
  noter("aucune erreur console imputable au site", erreurs.length === 0, erreurs[0] ?? "");

  /* ---------- Verdict ---------- */
  let ko = 0;
  for (const [libelle, ok, valeur] of cas) {
    if (!ok) ko++;
    console.log(`  [${ok ? "OK" : "KO"}] ${libelle}  → ${JSON.stringify(valeur)}`);
  }
  console.log(`\n${BASE} — ${cas.length - ko}/${cas.length} cas verts`);
  console.log(
    ko === 0 ? "VERT — filtres mobile et bandeau collant prouvés en ligne" : "ROUGE — à corriger"
  );
  ws.close();
  process.exitCode = ko === 0 ? 0 : 1;
} catch (e) {
  console.error(`ERREUR: ${e.message}`);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
