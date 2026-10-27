import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy GET /api/v1/admin/sante-collecte → API Railway (endpoint ADMIN GARDÉ).
//
// Contrat : {statut: "ok"|"degrade"|"retard"|"jamais", message, derniere_collecte,
// age_heures, seuil_heures, sources, sources_en_erreur, offres_ajoutees,
// offres_actives, prochaine_collecte}.
//
// L'identité admin est RELAYÉE telle quelle (Cookie `lawol_admin`,
// `x-admin-token`, `Authorization: Bearer`) : sans elle l'API répond 401 —
// patron imposé par AGENTS.md pour `/api/v1/admin/*`.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cookie = request.headers.get("cookie");
    const authHeader = request.headers.get("authorization");
    const xAdminToken = request.headers.get("x-admin-token");
    const headers: Record<string, string> = {};
    if (cookie) headers["Cookie"] = cookie;
    if (authHeader) headers["Authorization"] = authHeader;
    if (xAdminToken) headers["X-Admin-Token"] = xAdminToken;

    const res = await fetch(`${API_URL}/api/v1/admin/sante-collecte`, {
      headers,
      cache: "no-store",
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}
