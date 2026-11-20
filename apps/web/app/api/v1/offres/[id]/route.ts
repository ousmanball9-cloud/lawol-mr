import { API_URL } from "@/lib/api-url";
import { relayerGetApi } from "@/lib/proxy-api";

// Proxy GET /api/v1/offres/[id] → API publique (détail d'une offre active)
//
// RÉVEIL RENDER (20/11/2026) : même traitement que la liste — l'API free répond
// 503 pendant son réveil, on réessaie au lieu d'afficher une fiche en erreur.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return relayerGetApi(`${API_URL}/api/v1/offres/${id}`);
}
