import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy GET /api/v1/admin/stats/visites → API Railway
// (endpoint ADMIN gardé : l'authentification admin est RELAYÉE telle quelle —
// cookie `lawol_admin`, en-tête `x-admin-token` ou `Authorization: Bearer`).
// Réponse {total, par_jour: [{jour, nb}]}.
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

    const res = await fetch(`${API_URL}/api/v1/admin/stats/visites`, {
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
