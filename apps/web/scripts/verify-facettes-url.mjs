/**
 * Harnais LIVE — les FACETTES du catalogue vivent dans l'URL (V2-04).
 *
 * Usage : node scripts/verify-facettes-url.mjs [baseUrl]
 *         node scripts/verify-facettes-url.mjs https://lawol-mr.vercel.app
 *         node scripts/verify-facettes-url.mjs http://127.0.0.1:3011
 *
 * Pourquoi ce harnais existe (construit AVANT le correctif, règle maison) :
 * le 29/10, seul `?recherche=` et `?categorie=` étaient dans l'URL. Un lien
 * collé dans WhatsApp ne restituait donc ni le pays, ni la filière, ni le tri :
 * l'élève recevait le catalogue entier. Ce harnais mesure la promesse
 * observable, pas l'intention :
 *
 *   1. `/offres` nue ne salit pas l'URL (aucun défaut injecté) ;
 *   2. un lien `?pays=france&tri=recentes` rend les contrôles dans le bon état ;
 *   3. … et les CARTES respectent le filtre (toute carte affiche « France ») ;
 *   4. changer un filtre à la main écrit le paramètre dans l'URL ;
 *   5. le retour arrière restaure l'état précédent (URL + contrôle) ;
 *   6. un paramètre invalide ne casse rien (rendu + zéro erreur console).
 *
 * Chrome headless + CDP, aucune dépendance externe. Exit 0 = vert, 1 = rouge.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] || "https://lawol-mr.vercel.app").replace(/\/$/, "");
const CDP_PORT = Number(process.env.CDP_PORT || 9391);
const PROFIL = path.join(os.tmpdir(), `lawol-facettes-${Date.now()}`);
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
    "--window-size=1440,1200",
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

  /** Attend que le catalogue soit rendu (cartes OU état vide honnête). */
  const attendreCatalogue = async (timeoutMs = 25000) => {
    const debut = Date.now();
    while (Date.now() - debut < timeoutMs) {
      const etat = await evalIn(`(() => {
        const cartes = document.querySelectorAll('[data-probe="offre-carte"]').length;
        const barre = !!document.querySelector('[data-probe="offres-filtres"]');
        const vide = /aucune offre|aucun résultat/i.test(document.body.innerText);
        return { cartes, barre, vide };
      })()`);
      if (etat.barre && (etat.cartes > 0 || etat.vide)) return etat;
      await sleep(400);
    }
    return { cartes: 0, barre: false, vide: false, timeout: true };
  };

  const lireEtat = () =>
    evalIn(`(() => {
      // Le <select> qui contient l'option voulue : les facettes filière/pays
      // n'ont pas de data-probe propre, on les identifie par leurs valeurs.
      const selectDe = (valeur) => {
        const opt = document.querySelector('select option[value="' + valeur + '"]');
        return opt ? opt.closest("select") : null;
      };
      const cartes = [...document.querySelectorAll('[data-probe="offre-carte"]')];
      return {
        search: location.search,
        cartes: cartes.length,
        compteur: Number(document.querySelector('[data-probe="offres-compteur"]')?.textContent || NaN),
        tri: document.querySelector('[data-probe="offres-tri"]')?.value ?? null,
        pays: selectDe("france")?.value ?? null,
        filiere: selectDe("informatique")?.value ?? null,
        textesCartes: cartes.map((c) => c.innerText),
      };
    })()`);

  const naviguer = async (url, attente = 25000) => {
    await send("Page.navigate", { url });
    await sleep(1500);
    return attendreCatalogue(attente);
  };

  const cas = [];
  const noter = (libelle, ok, valeur) => cas.push([libelle, ok, valeur]);

  /* ---------- 1. URL propre : aucun défaut injecté ---------- */
  await naviguer(`${BASE}/offres`);
  const nue = await lireEtat();
  noter(
    "/offres nue laisse l'URL propre (aucun filtre par défaut injecté)",
    nue.search === "",
    nue.search || "(vide)"
  );
  const total = nue.compteur;

  /* ---------- 2. Lien partageable : contrôles dans le bon état ---------- */
  await naviguer(`${BASE}/offres?pays=france&tri=recentes`);
  const partage = await lireEtat();
  noter("?pays=france&tri=recentes → le select Pays affiche France", partage.pays === "france", partage.pays);
  noter("?tri=recentes → le select Tri affiche « recentes »", partage.tri === "recentes", partage.tri);

  /* ---------- 3. Les cartes respectent vraiment le filtre ---------- */
  const horsPays = partage.textesCartes.filter((t) => !/france/i.test(t));
  noter(
    "les cartes rendues sont toutes des offres de ce pays (aucune hors filtre)",
    partage.cartes === 0 || horsPays.length === 0,
    { cartes: partage.cartes, horsFiltre: horsPays.length }
  );
  noter(
    "le compteur filtré ne dépasse jamais le total non filtré",
    Number.isNaN(partage.compteur) || Number.isNaN(total) || partage.compteur <= total,
    { filtre: partage.compteur, total }
  );
  noter(
    "le compteur annonce le nombre de cartes réellement rendues (ou le total si paginé)",
    Number.isNaN(partage.compteur) || partage.cartes === 0 || partage.compteur >= partage.cartes,
    { compteur: partage.compteur, cartes: partage.cartes }
  );

  /* ---------- 4. Filière : même contrat ---------- */
  await naviguer(`${BASE}/offres?filiere=informatique`);
  const filiere = await lireEtat();
  noter("?filiere=informatique → le select Filière affiche informatique", filiere.filiere === "informatique", filiere.filiere);

  /* ---------- 5. Interaction : l'URL suit l'état ---------- */
  await naviguer(`${BASE}/offres`);
  const avantInteraction = await lireEtat();
  await evalIn(`(() => {
    const sel = document.querySelector('[data-probe="offres-tri"]');
    if (!sel) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(sel, "recentes");
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  await sleep(2500);
  const apresInteraction = await lireEtat();
  noter(
    "changer le tri à la main écrit le paramètre dans l'URL",
    /[?&]tri=recentes/.test(apresInteraction.search),
    apresInteraction.search || "(vide)"
  );

  /* ---------- 6. Retour arrière : les filtres reviennent ---------- */
  await evalIn(`history.back()`);
  await sleep(2500);
  await attendreCatalogue(15000);
  const retour = await lireEtat();
  noter(
    "le retour arrière restaure l'état précédent (URL + tri)",
    retour.search === avantInteraction.search && retour.tri === avantInteraction.tri,
    { url: retour.search || "(vide)", tri: retour.tri, attendu: avantInteraction.tri }
  );

  /* ---------- 7. Paramètre invalide : rien ne casse ---------- */
  const avantInvalide = messages.length;
  const rendu = await naviguer(`${BASE}/offres?pays=zzz&tri=nimporte&filiere=inconnue`);
  const invalide = await lireEtat();
  const erreursInvalide = messages.slice(avantInvalide).filter((m) => !/favicon|DevTools/i.test(m));
  noter(
    "un paramètre inconnu ou invalide ne casse pas la page",
    rendu.barre === true && !rendu.timeout,
    { barre: rendu.barre, cartes: invalide.cartes, timeout: Boolean(rendu.timeout) }
  );
  noter(
    "… et ne produit aucune erreur console imputable au site",
    erreursInvalide.length === 0,
    erreursInvalide[0] ?? ""
  );

  /* ---------- Verdict ---------- */
  let ko = 0;
  for (const [libelle, ok, valeur] of cas) {
    if (!ok) ko++;
    console.log(`  [${ok ? "OK" : "KO"}] ${libelle}  → ${JSON.stringify(valeur)}`);
  }
  console.log(`\n${BASE}/offres — ${cas.length - ko}/${cas.length} cas verts`);
  console.log(ko === 0 ? "VERT — facettes partageables et restaurables" : "ROUGE — facettes non prouvées");
  ws.close();
  process.exitCode = ko === 0 ? 0 : 1;
} catch (e) {
  console.error(`ERREUR: ${e.message}`);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
