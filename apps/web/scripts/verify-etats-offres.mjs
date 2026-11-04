/**
 * Harnais LIVE — états du catalogue `/offres` (V3-04 + B7/A7).
 *
 * Usage : node scripts/verify-etats-offres.mjs [baseUrl]
 *         node scripts/verify-etats-offres.mjs https://lawol-mr.vercel.app
 *
 * Ce qui est prouvé, et pourquoi ce n'est pas un contrôle statique :
 *  1. **Chargement** — l'état de chargement n'existe que pendant l'attente des
 *     données. On PROVOQUE l'attente (requête `/api/v1/offres` retenue 4 s via
 *     CDP), puis on lit le DOM : squelette présent, `offre-carte` absente, une
 *     seule annonce `role="status"`. Sans provocation, on mesurerait la prod
 *     rapide et le test ne prouverait rien (leçon V3-06 : `non communiqué` = 0
 *     sur une prod saine).
 *  2. **Vide filtré** — `?q=` sans résultat doit rendre le bloc guidant, le bon
 *     message (« ne correspond à ces filtres », pas « aucune offre publiée »),
 *     un bouton de réinitialisation ≥ 44 px, et rester compact (< 700 px de
 *     haut) : l'illustration ne doit pas repousser le contenu hors écran.
 *
 * Chrome headless + CDP, aucune dépendance. Exit 0 = vert, 1 = rouge.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] || "https://lawol-mr.vercel.app").replace(/\/$/, "");
const PORT = 9421;
const PROFIL = path.join(os.tmpdir(), `v304-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exe = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((c) => existsSync(c));
if (!exe) {
  console.error("KO — Chrome introuvable");
  process.exit(1);
}
const chrome = spawn(
  exe,
  ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFIL}`, "--window-size=390,844", "about:blank"],
  { stdio: "ignore" }
);

/** Retient chaque appel `/api/v1/offres` pendant RETENUE_MS, puis le libère. */
const RETENUE_MS = 4000;
let retenues = 0;

try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {}
    await sleep(250);
  }
  const cible = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json())
    .find((t) => t.type === "page");
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
      return;
    }
    // Requête API retenue : on la libère après RETENUE_MS, hors du flux principal.
    if (m.method === "Fetch.requestPaused") {
      retenues += 1;
      setTimeout(() => { send("Fetch.continueRequest", { requestId: m.params.requestId }).catch(() => {}); }, RETENUE_MS);
    }
  });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*api/v1/offres*", requestStage: "Request" }] });
  const ev = async (expression) =>
    (await send("Runtime.evaluate", { returnByValue: true, expression })).result.value;
  const attendre = async (expression, ms = 20000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      if (await ev(expression)) return true;
      await sleep(200);
    }
    return false;
  };

  const cas = [];
  const noter = (label, ok, valeur) => cas.push([label, ok, valeur]);

  // ── 1. Chargement provoqué ────────────────────────────────────────────────
  await send("Page.navigate", { url: `${BASE}/offres` });
  const vuSquelette = await attendre(`!!document.querySelector('[data-probe="offres-squelette"]')`, 12000);
  const etatPendant = await ev(`(() => ({
    squelettes: document.querySelectorAll('[data-probe^="skeleton-"]').length,
    cartes: document.querySelectorAll('[data-probe="offre-carte"]').length,
    statuts: document.querySelectorAll('[role="status"]').length,
    annonce: (document.body.innerText.match(/Chargement des offres/gi) || []).length,
  }))()`);
  noter("attente réelle provoquée (requêtes retenues > 0)", retenues > 0, `${retenues} requête(s)`);
  noter("squelette affiché pendant l'attente", vuSquelette, vuSquelette ? "oui" : "non");
  noter("aucune carte pendant l'attente", etatPendant.cartes === 0, String(etatPendant.cartes));
  noter("une seule annonce role=status", etatPendant.statuts === 1, String(etatPendant.statuts));
  noter("blocs de squelette >= 12", etatPendant.squelettes >= 12, String(etatPendant.squelettes));

  // ── 2. Sortie de chargement : les cartes arrivent ────────────────────────
  await send("Fetch.disable");
  const cartesArrivees = await attendre(`document.querySelectorAll('[data-probe="offre-carte"]').length > 0`, 25000);
  const nbCartes = await ev(`document.querySelectorAll('[data-probe="offre-carte"]').length`);
  const squeletteParti = await ev(`!document.querySelector('[data-probe="offres-squelette"]')`);
  noter("cartes affichées après l'attente", cartesArrivees, String(nbCartes));
  noter("squelette retiré une fois les données là", squeletteParti, squeletteParti ? "oui" : "non");

  // ── 3. État vide filtré ──────────────────────────────────────────────────
  await send("Page.navigate", { url: `${BASE}/offres?q=zzzzzzzzzz` });
  const vuVide = await attendre(`!!document.querySelector('[data-probe="offres-vide"]')`, 20000);
  const vide = await ev(`(() => {
    const bloc = document.querySelector('[data-probe="offres-vide"]');
    if (!bloc) return null;
    const bouton = [...bloc.querySelectorAll('button')].find((b) => /initialiser/i.test(b.innerText));
    const guide = bloc.querySelector('[data-probe="empty-guidant"]');
    const lienMort = bloc.querySelector('a[href*="[telephone]"]');
    return {
      texte: bloc.innerText.replace(/\\s+/g, ' ').trim().slice(0, 160),
      hauteur: Math.round(bloc.getBoundingClientRect().height),
      guide: !!guide,
      idTitre: guide ? guide.getAttribute('aria-labelledby') : null,
      titrePresent: guide && guide.getAttribute('aria-labelledby')
        ? !!document.getElementById(guide.getAttribute('aria-labelledby'))
        : false,
      boutonHauteur: bouton ? Math.round(bouton.getBoundingClientRect().height) : 0,
      lienMort: !!lienMort,
      cartes: document.querySelectorAll('[data-probe="offre-carte"]').length,
    };
  })()`);
  noter("état vide rendu", vuVide && vide !== null, vuVide ? "oui" : "non");
  noter("message « ne correspond à ces filtres »", !!vide && /ne correspond . ces filtres/i.test(vide.texte), vide ? vide.texte.slice(0, 60) : "—");
  noter("aucune carte affichée", !!vide && vide.cartes === 0, vide ? String(vide.cartes) : "—");
  noter("bloc guidant présent", !!vide && vide.guide, vide && vide.guide ? "oui" : "non");
  noter("titre relié à un id réel (aria-labelledby)", !!vide && vide.titrePresent, vide ? String(vide.idTitre) : "—");
  noter("bouton réinitialiser >= 44 px", !!vide && vide.boutonHauteur >= 44, vide ? `${vide.boutonHauteur} px` : "—");
  noter("aucun lien mort [telephone]", !!vide && !vide.lienMort, vide && vide.lienMort ? "lien cassé" : "aucun");
  noter("bloc vide compact (< 700 px)", !!vide && vide.hauteur > 0 && vide.hauteur < 700, vide ? `${vide.hauteur} px` : "—");

  console.log(`\n=== états /offres — ${BASE} (390x844) ===`);
  let ko = 0;
  for (const [label, ok, valeur] of cas) {
    if (!ok) ko += 1;
    console.log(`${ok ? "OK  " : "KO  "} ${label} : ${valeur}`);
  }
  console.log(`\n${cas.length - ko}/${cas.length} verts`);
  process.exitCode = ko === 0 ? 0 : 1;
} catch (e) {
  console.error("KO — harnais en échec :", e?.message ?? e);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
