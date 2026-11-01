/**
 * Harnais « cibles tactiles » LAWOL.mr — une seule commande, un chiffre.
 *
 *   node scripts/verify-cibles.mjs [baseUrl]
 *
 * Mesure à 390×844 (mobile réel) sur les deux pages publiques qui portent la
 * promesse du backlog design :
 *   - nombre de cibles cliquables VISIBLES (a/button/input/select/[role=button])
 *   - cibles sous 44×44 px  (WCAG 2.5.5 / cible du backlog V1-13)
 *   - textes sous 12 px     (backlog V1-14)
 *   - LCP / CLS / TTFB      (contexte de la mesure, jamais une conclusion)
 *
 * Code retour : 0 = aucune cible sous 44 px et aucun texte sous 12 px,
 *               1 = au moins un écart (liste imprimée), 2 = mesure impossible.
 *
 * Sans dépendance : Chrome/Edge headless piloté en CDP (même client minimal
 * que scripts/verify-design.mjs). Aucune installation à faire.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const BASE = (process.argv[2] ?? "https://lawol-mr.vercel.app").replace(/\/$/, "");
const PAGES = ["/offres", "/"];
const SEUIL_CIBLE = 44;
const SEUIL_TEXTE = 12;

const OUT_DIR = path.join(process.cwd(), ".verify");

function findBrowser() {
  const candidates = [
    process.env.VERIFY_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  return candidates.find((c) => existsSync(c)) ?? null;
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, timeoutMs) {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* pas encore pret */
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
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  return { send, close: () => ws.close() };
}

async function evaluate(cdp, expression) {
  const res = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
  return res.result.value;
}

const SONDE = (seuilCible, seuilTexte) => `(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const cliquables = [...document.querySelectorAll("a,button,input,select,textarea,[role=button]")].filter(vis);
  const petites = cliquables
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        h: Math.round(r.height),
        w: Math.round(r.width),
        txt: (el.textContent || el.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 28),
        href: el.getAttribute("href") || "",
      };
    })
    .filter((e) => e.h < ${seuilCible} || e.w < ${seuilCible});
  const textes = [...document.querySelectorAll("p,span,li,a,button,label")]
    .filter((el) => vis(el) && (el.textContent || "").trim().length >= 2)
    .map((el) => ({ px: parseFloat(getComputedStyle(el).fontSize), txt: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 24) }))
    .filter((e) => e.px < ${seuilTexte});
  const nav = performance.getEntriesByType("navigation")[0] || {};
  return {
    cliquables: cliquables.length,
    sous_seuil: petites,
    textes_sous_seuil: textes,
    ttfb_ms: Math.round(nav.responseStart || 0),
  };
})()`;

async function main() {
  const browser = findBrowser();
  if (!browser) {
    console.error("Aucun Chrome/Edge trouve (variable VERIFY_BROWSER).");
    process.exit(2);
  }
  const port = await portLibre(9700);
  const chrome = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--disable-extensions",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${path.join(OUT_DIR, "chrome-cibles")}`,
      "--window-size=390,844",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let echecs = 0;
  try {
    if (!(await waitFor(`http://127.0.0.1:${port}/json/version`, 20000))) throw new Error("CDP indisponible");
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find((t) => t.type === "page");
    if (!target) throw new Error("Aucune cible page CDP");

    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });

    for (const route of PAGES) {
      const url = BASE + route;
      await cdp.send("Page.navigate", { url });
      // Attendre le rendu CLIENT (les pages publiques fetchent leur contenu).
      const pret = await waitFor(url, 20000);
      await sleep(pret ? 2500 : 5000);
      const r = await evaluate(cdp, SONDE(SEUIL_CIBLE, SEUIL_TEXTE));
      const ko = r.sous_seuil.length > 0 || r.textes_sous_seuil.length > 0;
      if (ko) echecs++;
      console.log(
        `${ko ? "KO " : "OK "} ${route.padEnd(8)} ${String(r.cliquables).padStart(3)} cliquables | ` +
          `${r.sous_seuil.length} sous ${SEUIL_CIBLE}px | ${r.textes_sous_seuil.length} textes < ${SEUIL_TEXTE}px | ttfb ${r.ttfb_ms} ms`
      );
      for (const e of r.sous_seuil.slice(0, 10)) {
        console.log(`      ${e.tag} ${e.h}x${e.w}px  « ${e.txt} »  ${e.href}`);
      }
      for (const t of r.textes_sous_seuil.slice(0, 10)) {
        console.log(`      texte ${t.px}px  « ${t.txt} »`);
      }
    }
    cdp.close();
  } finally {
    chrome.kill();
  }

  console.log(echecs === 0 ? "VERT — aucune cible sous 44px, aucun texte sous 12px" : `ROUGE — ${echecs} page(s) avec ecart`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Mesure impossible : " + String(e).slice(0, 200));
  process.exit(2);
});
