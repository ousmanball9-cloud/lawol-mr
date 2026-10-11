import { NextResponse, type NextRequest } from "next/server";

/** Garde de l'espace client + injection du Bearer vers l'API.
 *
 * - /profil/{tel} : sans session valide appartenant à ce numéro → /connexion.
 * - /api/v1/profils/* : le token du cookie `lawol_token` part en
 *   `Authorization: Bearer` vers l'API FastAPI (qui re-vérifie la signature).
 *
 * La signature HMAC est revérifiée ici si SESSION_SECRET est exposé au runtime
 * (Vercel) ; sinon on contrôle au minimum la forme, l'expiration et le numéro —
 * l'autorité de vérification reste l'API (compare_digest côté FastAPI).
 */

const NOM_COOKIE = "lawol_token";

type PayloadSession = { tel?: string; exp?: number };

function decoderPayload(token: string): PayloadSession | null {
  const payload = token.split(".")[0];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const donnees = JSON.parse(json);
    return typeof donnees === "object" && donnees !== null
      ? (donnees as PayloadSession)
      : null;
  } catch {
    return null;
  }
}

async function signatureValide(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const cle = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(payload));
    const brut = btoa(String.fromCharCode(...new Uint8Array(mac)));
    return brut.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") === signature;
  } catch {
    return false;
  }
}

/** Payload décodé si le cookie est bien formé, non expiré (et signé si secret dispo). */
async function sessionCookieValide(
  token: string | undefined,
  telephone?: string
): Promise<PayloadSession | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const donnees = decoderPayload(token);
  if (!donnees || typeof donnees.exp !== "number") return null;
  if (donnees.exp * 1000 <= Date.now()) return null;
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) {
    if (!(await signatureValide(payload, signature, secret))) return null;
  }
  if (telephone && donnees.tel !== telephone) return null;
  return donnees;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(NOM_COOKIE)?.value;

  // Pages de l'espace client : session exigée, appartenant au profil visité
  const profilVisite = pathname.match(/^\/profil\/([^/]+)/);
  if (profilVisite) {
    const telephone = decodeURIComponent(profilVisite[1]);
    const donnees = await sessionCookieValide(token, telephone);
    if (!donnees) {
      return NextResponse.redirect(new URL("/connexion", request.url));
    }
    return NextResponse.next();
  }

  // Passerelle /api/v1/profils/* : le Bearer part vers l'API dans le même cookie
  if (pathname.startsWith("/api/v1/profils/")) {
    if (token && (await sessionCookieValide(token))) {
      const enTetes = new Headers(request.headers);
      enTetes.set("authorization", `Bearer ${token}`);
      return NextResponse.next({ request: { headers: enTetes } });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/profil/:path*", "/api/v1/profils/:path*"],
};
