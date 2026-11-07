import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy GET /api/v1/offres → API publique (filtres + pagination forwardés tels quels)
//
// PAGINATION (05/11/2026) : le catalogue demande `limit`/`offset` (12 + 1 sonde)
// et l'API répond une LISTE NUE — pas de `total`, pas d'en-tête de comptage.
// Rien à traduire ici : le proxy ne fait que relayer. C'est cette absence de
// total qui impose la pagination « Précédent · Page N · Suivant » côté page
// (voir `components/offres/pagination-offres.tsx`).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const res = await fetch(`${API_URL}/api/v1/offres${searchParams ? `?${searchParams}` : ""}`);
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}
