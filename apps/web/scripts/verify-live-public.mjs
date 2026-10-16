/**
 * Harnais LIVE — preuve de déploiement par le COMPORTEMENT observable.
 *
 * Usage : node scripts/verify-live-public.mjs [baseUrl]
 *         node scripts/verify-live-public.mjs https://lawol-mr.vercel.app
 *
 * Pourquoi : le 16/10/2026, le token Railway était mort (« Not Authorized ») → le
 * dashboard n'était pas une preuve. Le déploiement a été prouvé en observant le
 * comportement réel (payload léger + rendu de l'aperçu dans un vrai navigateur).
 * Un « READY » de dashboard ne prouve pas qu'un élève voit la bonne page.
 *
 * Ce harnais teste le CATALOGUE PUBLIC en production, sur des faits vérifiables :
 *   - 12 cartes rendues (data-probe="offre-carte")
 *   - 0 carte emploi/stage/alternance (promesse « 100 % bourses »)
 *   - 12 aperçus de description rendus (prouve le contrat de liste allégée côté CLIENT)
 *   - 0 faux logo partenaire, 0 lien WhatsApp inventé
 *   - 0 erreur console imputable au site
 *
 * Chrome headless + CDP, aucun paquet externe. Sortie : OK/KO par cas + VERT/ROUGE.
 * Exit 0 = vert, 1 = rouge (utilisable en chaîne de vérification).
 *
 * ⚠️ Ne pas confondre avec `verify-*.mjs` (mockés, hors réseau) : ici on tape la VRAIE prod.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] || "https://lawol-mr.vercel.app").replace(/\/$/, "");
const CDP_PORT = Number(process.env.CDP_PORT || 9381);
const PROFIL = path.join(os.tmpdir(), `lawol-live-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Le numéro support vient de la SOURCE UNIQUE du projet — jamais recopié ici,
// sinon la mesure dériverait du code qu'elle prétend vérifier.
const sourceContact = readFileSync(new URL("../lib/contact.ts", import.meta.url), "utf8");
const NUMERO_OFFICIEL =
  (sourceContact.match(/export const CONTACT_WHATSAPP = "(\d*)"/) || [])[1] ?? "";

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

  // Mesure réelle de la disponibilité (jamais un « true » écrit en dur).
  const reponseBase = await fetch(`${BASE}/offres`).catch(() => null);
  const statutBase = reponseBase ? reponseBase.status : 0;

  await send("Page.navigate", { url: `${BASE}/offres` });
  await sleep(12000); // laisse le rendu client + les fetchs tardifs se terminer

  const res = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const cartes = [...document.querySelectorAll('[data-probe="offre-carte"]')];
      const texte = document.body.innerText;
      const apercus = cartes.filter((c) => {
        const ps = [...c.querySelectorAll("p")];
        return ps.some((p) => p.textContent.trim().length > 40 && p.className.includes("line-clamp-2"));
      }).length;
      const badges = cartes.map((c) => c.querySelector(".badge-offre")?.textContent?.trim() ?? "");
      return {
        url: location.href,
        cartes: cartes.length,
        apercus,
        badges,
        emploi_stage: badges.filter((b) => /emploi|stage|alternance/i.test(b)).length,
        bourses: badges.filter((b) => /bourse/i.test(b)).length,
        fauxLogos: /mauritel|ooredoo|\\bBNM\\b|\\bSNIM\\b/i.test(texte),
        numerosWhatsApp: [...document.querySelectorAll('a[href*="wa.me"]')]
          .map((a) => (a.href.match(/wa\\.me\\/(\\d+)/) || [])[1] || "(partage sans numero)"),
      };
    })()`,
  });
  const r = res.result.value;
  const erreurs = messages.filter((m) => !/favicon|facebook|DevTools/i.test(m));

  const cas = [
    [`base répond (${BASE})`, statutBase === 200, statutBase],
    ["12 cartes affichées", r.cartes === 12, r.cartes],
    ["0 carte emploi/stage/alternance (100 % bourses)", r.emploi_stage === 0, r.emploi_stage],
    ["12 aperçus rendus sur le payload allégé", r.apercus === 12, r.apercus],
    ["aucun faux logo partenaire", r.fauxLogos === false, r.fauxLogos],
    [
      NUMERO_OFFICIEL
        ? `liens WhatsApp : uniquement le numéro officiel (${NUMERO_OFFICIEL})`
        : "liens WhatsApp : aucun numéro (aucun numéro configuré)",
      NUMERO_OFFICIEL
        ? r.numerosWhatsApp.every((n) => n === NUMERO_OFFICIEL || n === "(partage sans numero)")
        : r.numerosWhatsApp.every((n) => n === "(partage sans numero)"),
      r.numerosWhatsApp,
    ],
    ["aucune erreur console", erreurs.length === 0, erreurs[0] ?? ""],
  ];
  let ko = 0;
  for (const [libelle, ok, valeur] of cas) {
    if (!ok) ko++;
    console.log(`  [${ok ? "OK" : "KO"}] ${libelle}  → ${JSON.stringify(valeur)}`);
  }
  console.log(`\n${r.url} — badges : ${JSON.stringify(r.badges.slice(0, 4))}`);
  console.log(`${ko === 0 ? "VERT" : "ROUGE"} — ${cas.length - ko}/${cas.length} cas verts`);
  ws.close();
  process.exitCode = ko === 0 ? 0 : 1;
} catch (e) {
  console.error("ERREUR:", e.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
