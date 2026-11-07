/**
 * Harnais LIVE — repli des sections de la landing (V3-06).
 *
 * Usage : node scripts/verify-landing-repli.mjs [baseUrl]
 *         node scripts/verify-landing-repli.mjs https://lawol-mr.vercel.app
 *
 * La promesse V3-06 n'est PAS « il y a toujours des chiffres » : c'est « quand
 * le relevé manque, la section reste, avec un texte honnête ». Un harnais qui
 * exige « non communiqué » sur la prod saine se trompe (la donnée répond) —
 * mesuré le 03/11 : 0 occurrence, faux KO. Ici on PROVOQUE l'indisponibilité
 * en bloquant `/api/v1/offres` via CDP, puis on vérifie les deux états.
 *
 * Chrome headless + CDP, aucune dépendance. Exit 0 = vert, 1 = rouge.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] || "https://lawol-mr.vercel.app").replace(/\/$/, "");
const PORT = 9412;
const PROFIL = path.join(os.tmpdir(), `v306b-${Date.now()}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exe = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"].find((c) => existsSync(c));
const chrome = spawn(exe, ["--headless=new", "--disable-gpu", "--no-first-run",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFIL}`, "--window-size=375,812", "about:blank"],
  { stdio: "ignore" });

try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch {} await sleep(250); }
  const cible = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page");
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } });
  const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  const ev = async (e) => (await send("Runtime.evaluate", { returnByValue: true, expression: e })).result.value;
  const cas = []; const noter = (l, ok, v) => cas.push([l, ok, v]);

  const lire = () => ev(`(() => {
    const txt = document.body.innerText;
    return {
      nonCommunique: (txt.match(/non communiqué/gi) || []).length,
      chiffreZero: /\\b0\\s+(bourse|offre)/i.test(txt),
      hauteur: document.body.scrollHeight,
      pastilles: (txt.match(/non communiqué|\\d+ bourses? actives?/gi) || []).length,
    };
  })()`);

  // 1. Nominal : la donnee repond (chiffres reels attendus)
  await send("Page.navigate", { url: `${BASE}/` });
  await sleep(9000);
  const nominal = await lire();
  noter("nominal — la page rend des chiffres reels (aucun repli necessaire)", nominal.nonCommunique === 0, nominal);
  noter("nominal — jamais « 0 bourse / 0 offre » trompeur", nominal.chiffreZero === false, nominal.chiffreZero);

  // 2. Indisponible PROVOQUE : on bloque l'API avant de charger
  await send("Network.setBlockedURLs", { urls: ["*/api/v1/offres*"] });
  await send("Page.navigate", { url: `${BASE}/?cas=api-bloquee` });
  await sleep(11000);
  const panne = await lire();
  noter("API bloquee — un relevé indisponible s'écrit « non communiqué »", panne.nonCommunique >= 1, panne.nonCommunique);
  noter("API bloquee — jamais « 0 bourse / 0 offre » trompeur", panne.chiffreZero === false, panne.chiffreZero);
  noter("API bloquee — la page garde son contenu (rien ne s'évapore)", panne.hauteur > 1500, panne.hauteur);

  let ko = 0;
  for (const [l, ok, v] of cas) { if (!ok) ko++; console.log(`  [${ok ? "OK" : "KO"}] ${l}  → ${JSON.stringify(v)}`); }
  console.log(`\n${BASE} — ${cas.length - ko}/${cas.length} cas verts`);
  ws.close(); process.exitCode = ko === 0 ? 0 : 1;
} catch (e) { console.error("ERREUR: " + e.message); process.exitCode = 1; }
finally { chrome.kill(); }
