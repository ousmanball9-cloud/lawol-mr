/**
 * Harnais LIVE — santé de la collecte visible dans le dashboard admin.
 *
 * Usage :
 *   $env:ADMIN_PASSWORD_HASH="..."   # jamais en argument de commande (historique)
 *   node scripts/verify-sante-collecte.mjs [baseUrl]
 *
 * Pourquoi ce harnais : les 20-26/10/2026, la collecte est restée muette
 * 7 jours sans que personne ne le voie — la fraîcheur n'existait que dans
 * l'onglet Actions de GitHub. Le bandeau du dashboard est la correction ; un
 * bandeau qu'on n'a jamais VU rendu n'est pas une preuve, c'est une intention.
 *
 * Ce que le harnais prouve (sur la VRAIE prod) :
 *   1. le proxy `/api/v1/admin/sante-collecte` répond 401 SANS identité ;
 *   2. avec un cookie admin dérivé du secret serveur, le dashboard `/admin`
 *      affiche le bandeau : un des 4 états (ok / partielle / retard / jamais) ;
 *   3. le bandeau porte les faits mesurables : « Dernière collecte »,
 *      nombre de sources, nombre d'offres traitées, « prochaine à » ;
 *   4. les 6 cartes de statistiques sont toujours rendues (non-régression) ;
 *   5. aucune erreur console.
 *
 * Le cookie est DÉRIVÉ (sha256("lawol-admin|" + ADMIN_PASSWORD_HASH)), formule
 * identique à `modules/auth/admin.py::cookie_admin_attendu` et à
 * `app/api/admin/login/route.ts` — le mot de passe en clair n'est jamais requis.
 *
 * Chrome headless + CDP, aucun paquet externe. Exit 0 = vert, 1 = rouge.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.argv[2] || "https://lawol-mr.vercel.app").replace(/\/$/, "");
const HOTE = new URL(BASE).hostname;
const SECRET = process.env.ADMIN_PASSWORD_HASH || "";
const CDP_PORT = Number(process.env.CDP_PORT || 9391);
const PROFIL = path.join(os.tmpdir(), `lawol-sante-${Date.now()}`);
const CAPTURE = process.env.CAPTURE_PATH || path.join(os.tmpdir(), `lawol-sante-${Date.now()}.png`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!SECRET) {
  console.error(
    "ADMIN_PASSWORD_HASH absent : le harnais ne peut pas dériver le cookie admin.\n" +
      'Set-Item Env:ADMIN_PASSWORD_HASH (valeur du secret serveur) puis relancer.'
  );
  process.exit(2);
}

const cookie = createHash("sha256").update(`lawol-admin|${SECRET}`, "utf8").digest("hex");

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

const CAS = [];
const cas = (libelle, ok, valeur) => CAS.push([libelle, Boolean(ok), valeur]);

// 1) Sans identité, l'endpoint doit refuser — mesuré AVANT d'ouvrir le navigateur.
const sansIdentite = await fetch(`${BASE}/api/v1/admin/sante-collecte`).catch(() => null);
cas(
  "proxy santé : 401 sans identité admin",
  sansIdentite?.status === 401,
  sansIdentite ? sansIdentite.status : "réseau KO"
);

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

let code = 0;
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
  await send("Network.enable");

  // Le cookie admin : posé pour le domaine réel, jamais stocké sur disque.
  await send("Network.setCookie", {
    name: "lawol_admin",
    value: cookie,
    domain: HOTE,
    path: "/",
    secure: BASE.startsWith("https"),
    httpOnly: false,
  });

  await send("Page.navigate", { url: `${BASE}/admin` });
  // Le dashboard charge ses données en client : on attend que le bandeau existe.
  let rendu = null;
  for (let essai = 0; essai < 24; essai++) {
    await sleep(1000);
    const res = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const texte = document.body.innerText;
        return {
          url: location.href,
          connecte: /Dashboard/i.test(texte),
          bandeau: (texte.match(/(Collecte automatique à jour|Collecte partielle|Collecte en retard|Aucune collecte enregistrée)/) || [])[1] || "",
          texte,
          cartes: [...document.querySelectorAll("span.text-2xl")].filter((s) => /^\\d+$/.test(s.textContent.trim())).length,
          taux: /Taux de notification des matches : \\d+([.,]\\d+)? %/.test(texte),
        };
      })()`,
    });
    rendu = res.result.value;
    if (rendu.bandeau) break;
  }

  const texte = rendu?.texte || "";
  cas("session admin reconnue (titre Dashboard rendu)", rendu?.connecte === true, rendu?.url);
  cas(
    "bandeau de santé rendu (un des 4 états)",
    Boolean(rendu?.bandeau),
    rendu?.bandeau || "(aucun bandeau)"
  );
  cas("mention « Dernière collecte » présente", /Dernière collecte/.test(texte), "");
  cas("nombre de sources affiché", /\d+\s+sources?/i.test(texte), "");
  cas("offres traitées affichées", /\d+\s+offres?\s+traitées?/i.test(texte), "");
  cas("prochaine échéance affichée", /prochaine à \d{2}:\d{2}/i.test(texte), "");
  cas(
    "échéance en UTC affichée (heure de Mauritanie)",
    /prochaine à \d{2}:\d{2} UTC/i.test(texte),
    ""
  );
  // Le piège du 27/10 : 6 cartes rendues mais 3 vides (clés inexistantes côté
  // API). On exige donc 6 VALEURS NUMÉRIQUES, pas 6 balises.
  cas("6 cartes de statistiques avec une VALEUR chiffrée", rendu?.cartes === 6, rendu?.cartes);
  cas("taux de notification affiché", rendu?.taux === true, "");
  // Le filet interne (modules/scraper/rattrapage.py) : sans cette ligne,
  // « collecte en retard » laisse croire qu'il faut intervenir à la main.
  cas(
    "filet interne annoncé (armé ou désactivé, jamais muet)",
    /Filet interne\s*:\s*(armé|désactivé)/i.test(texte),
    (texte.match(/Filet interne[^\n]*/) || [])[0] ?? ""
  );

  const erreurs = messages.filter((m) => !/favicon|facebook|DevTools|401/i.test(m));
  cas("aucune erreur console", erreurs.length === 0, erreurs[0] ?? "");

  const capture = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(CAPTURE, Buffer.from(capture.data, "base64"));
  cas("capture écrite", existsSync(CAPTURE), CAPTURE);
} catch (e) {
  cas("harnais exécuté sans exception", false, String(e?.message || e));
} finally {
  chrome.kill();
}

console.log(`\nHarnais santé de collecte (${BASE})`);
let ko = 0;
for (const [libelle, ok, valeur] of CAS) {
  if (!ok) ko++;
  const extra = valeur === "" || valeur === undefined ? "" : `  → ${JSON.stringify(valeur)}`;
  console.log(`  [${ok ? "OK" : "KO"}] ${libelle}${extra}`);
}
console.log("");
if (ko) {
  console.log(`RESULTAT : ROUGE — ${CAS.length - ko}/${CAS.length} cas verts (${ko} KO)`);
  code = 1;
} else {
  console.log(`RESULTAT : VERT — ${CAS.length}/${CAS.length} cas verts`);
  console.log(`Capture : ${CAPTURE}`);
}
process.exit(code);
