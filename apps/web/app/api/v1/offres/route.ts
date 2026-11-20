import { API_URL } from "@/lib/api-url";
import { relayerGetApi } from "@/lib/proxy-api";

// Proxy GET /api/v1/offres → API publique (filtres + pagination forwardés tels quels)
//
// PAGINATION (05/11/2026) : le catalogue demande `limit`/`offset` (12 + 1 sonde)
// et l'API répond une LISTE NUE — pas de `total`, pas d'en-tête de comptage.
// Rien à traduire ici : le proxy ne fait que relayer. C'est cette absence de
// total qui impose la pagination « Précédent · Page N · Suivant » côté page
// (voir `components/offres/pagination-offres.tsx`).
//
// RÉVEIL RENDER (20/11/2026) : le service free répond 503 pendant son réveil.
// `relayerGetApi` réessaie les statuts transitoires ; `maxDuration` laisse à
// Vercel le temps de ce réveil au lieu de couper la fonction à 10 s.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  return relayerGetApi(`${API_URL}/api/v1/offres${searchParams ? `?${searchParams}` : ""}`);
}
