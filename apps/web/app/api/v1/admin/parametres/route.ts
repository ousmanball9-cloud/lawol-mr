import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy PUT /api/v1/admin/parametres → API Railway
// (endpoint ADMIN : l'authentification admin est RELAYÉE telle quelle —
// cookie `lawol_admin` posé par /api/admin/login, en-tête `x-admin-token` ou
// `Authorization: Bearer` ; même modèle que admin/offres/[offreId]/publication).
// Body {cle, valeur} → {cle, valeur, modifie_le}.
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const body = await request.text();
    const cookie = request.headers.get("cookie");
    const authHeader = request.headers.get("authorization");
    const xAdminToken = request.headers.get("x-admin-token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cookie) headers["Cookie"] = cookie;
    if (authHeader) headers["Authorization"] = authHeader;
    if (xAdminToken) headers["X-Admin-Token"] = xAdminToken;

    const res = await fetch(`${API_URL}/api/v1/admin/parametres`, {
      method: "PUT",
      headers,
      body,
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
