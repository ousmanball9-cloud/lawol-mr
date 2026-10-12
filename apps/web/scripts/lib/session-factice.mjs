// Cookie `lawol_token` factice mais BIEN FORMÉ pour les harnais CDP.
//
//   import { poserCookieSession } from "./lib/session-factice.mjs";
//   await poserCookieSession(cdp, "2221234567", PORT);   // avant Page.navigate
//
// Pourquoi ça marche : le middleware Next (middleware.ts) exige un payload
// {tel, exp} non expiré et un tel correspondant à l'URL ; la signature HMAC
// n'est revérifiée QUE si SESSION_SECRET est exposé au runtime — or les
// harnais locaux lancent `next dev` dans apps/web, sans .env, sans secret.
// Si un secret racine est pourtant lisible, on signe proprement (HMAC-SHA256,
// base64url sans padding) : le cookie reste valide même si un .env apparaît.
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function secretRacine() {
  try {
    const txt = readFileSync(path.join(RACINE, ".env"), "utf8");
    const ligne = txt.split(/\r?\n/).find((l) => l.startsWith("SESSION_SECRET="));
    const val = ligne ? ligne.slice("SESSION_SECRET=".length).trim().replace(/^["']|["']$/g, "") : "";
    return val.length >= 32 ? val : null;
  } catch {
    return null;
  }
}

/** Token factice : payload {tel, exp} (+ signature HMAC si secret racine dispo). */
export function tokenFactice(tel, jours = 7) {
  const payload = Buffer.from(
    JSON.stringify({ tel, exp: Math.floor(Date.now() / 1000) + jours * 86400 })
  ).toString("base64url");
  const secret = secretRacine();
  const signature = secret
    ? crypto.createHmac("sha256", secret).update(payload).digest("base64url")
    : "factice";
  return `${payload}.${signature}`;
}

/** Pose le cookie de session sur l'onglet CDP — à appeler AVANT Page.navigate. */
export async function poserCookieSession(cdp, tel, port) {
  await cdp.send("Network.setCookie", {
    name: "lawol_token",
    value: tokenFactice(tel),
    url: `http://127.0.0.1:${port}`,
    path: "/",
    httpOnly: false,
    sameSite: "Lax",
  });
}
