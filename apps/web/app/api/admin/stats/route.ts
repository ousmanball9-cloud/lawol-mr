import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy GET /api/admin/stats → API `/api/v1/admin/stats` (endpoint ADMIN).
//
// Mesure du 27/10/2026 : l'endpoint backend répondait **200 sans identité** et
// ce proxy n'envoyait rien — les compteurs (étudiants, matches, taux de
// notification) étaient donc publics. Les deux côtés sont corrigés : l'API
// exige l'identité admin, et ce proxy la RELAIE (Cookie `lawol_admin`,
// `x-admin-token`, `Authorization`). Sans identité : 401, aucune donnée.
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

    const res = await fetch(`${API_URL}/api/v1/admin/stats`, {
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
