/** Session client LAWOL : token signé stocké en cookie JS (`lawol_token`).
 *
 * Le cookie est lu par le middleware Next.js (garde des pages /profil + injection
 * du Bearer vers l'API) et par l'API FastAPI qui re-vérifie la signature HMAC.
 * Ce module ne fait que stocker/lire/attacher — aucune décision de sécurité n'en
 * dépend seule : l'autorité est le backend (`SESSION_SECRET`).
 */

export const NOM_COOKIE_SESSION = "lawol_token";

type PayloadSession = { tel?: string; exp?: number };

/** Décode le payload base64url du token (sans vérifier la signature). */
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

/** Token courant (null si absent). */
export function lireTokenSession(): string | null {
  const entree = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${NOM_COOKIE_SESSION}=`));
  return entree ? decodeURIComponent(entree.slice(NOM_COOKIE_SESSION.length + 1)) : null;
}

/** Persiste le token reçu de POST /profils/{tel}/connexion (durée portée par exp). */
export function ecrireSession(token: string): void {
  const maintenant = Math.floor(Date.now() / 1000);
  const exp = decoderPayload(token)?.exp ?? maintenant + 7 * 24 * 3600;
  const maxAge = Math.max(60, exp - maintenant);
  document.cookie = `${NOM_COOKIE_SESSION}=${encodeURIComponent(
    token
  )}; path=/; max-age=${maxAge}; samesite=lax`;
}

/** Déconnexion locale (le backend n'a pas de révocation : token à expiration courte). */
export function effacerSession(): void {
  document.cookie = `${NOM_COOKIE_SESSION}=; path=/; max-age=0; samesite=lax`;
}

/** Session valide (non expirée) ET rattachée au téléphone demandé. */
export function sessionValidePour(telephone: string): boolean {
  const token = lireTokenSession();
  if (!token) return false;
  const payload = decoderPayload(token);
  if (!payload || payload.tel !== telephone) return false;
  return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
}

/** En-tête Authorization à joindre aux appels mutants (null si pas de session). */
export function entetesSession(telephone: string): Record<string, string> | null {
  if (!sessionValidePour(telephone)) return null;
  const token = lireTokenSession();
  return token ? { Authorization: `Bearer ${token}` } : null;
}
