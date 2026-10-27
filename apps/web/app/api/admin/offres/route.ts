import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy GET /api/admin/offres → API `/api/v1/admin/offres` (endpoint ADMIN).
//
// Différence avec l'ancienne version (27/10/2026) : elle relisait la liste
// PUBLIQUE (`/api/v1/offres`), qui ne rend que les offres actives à échéance
// future, plafonnées à 50. L'admin ne voyait donc que 200 offres sur 298 et
// AUCUNE offre clôturée (impossible à réactiver). Ici :
//   · on transmet l'identité admin (Cookie `lawol_admin`, `x-admin-token`,
//     `Authorization`) — sans elle l'API répond 401 ;
//   · on relaie `limit`/`offset`/`q` pour paginer proprement.
export async function GET(request: Request) {
  try {
    const entrant = new URL(request.url).searchParams;
    const sortant = new URLSearchParams();
    for (const cle of ["limit", "offset", "q", "inclure_inactives"]) {
      const valeur = entrant.get(cle);
      if (valeur !== null) sortant.set(cle, valeur);
    }
    const suffixe = sortant.toString();

    const cookie = request.headers.get("cookie");
    const authorization = request.headers.get("authorization");
    const xAdminToken = request.headers.get("x-admin-token");
    const headers: Record<string, string> = {};
    if (cookie) headers["Cookie"] = cookie;
    if (authorization) headers["Authorization"] = authorization;
    if (xAdminToken) headers["X-Admin-Token"] = xAdminToken;

    const res = await fetch(
      `${API_URL}/api/v1/admin/offres${suffixe ? `?${suffixe}` : ""}`,
      { headers },
    );
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}
