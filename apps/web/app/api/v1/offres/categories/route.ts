import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

/**
 * Proxy GET /api/v1/offres/categories → comptage réel des catégories de bourse
 * (`{"gouvernementale": n, "institutionnelle": n, …}`).
 *
 * Segment STATIQUE : il prime sur `app/api/v1/offres/[id]/route.ts`, donc
 * `categories` n'est jamais interprété comme un identifiant d'offre.
 * `cache: no-store` : la landing ne doit pas afficher un comptage périmé.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/offres/categories`, { cache: "no-store" });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}
