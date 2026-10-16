import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy GET /api/v1/profils/[telephone]/documents/[id]/url → API Railway
// (endpoint MUTANT : le Bearer injecté par middleware.ts part vers l'API)
// Renvoie une URL SIGNEÉE de courte durée : jamais mise en cache.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ telephone: string; id: string }> }
) {
  try {
    const { telephone, id } = await params;
    const authorization = request.headers.get("authorization");
    const res = await fetch(
      `${API_URL}/api/v1/profils/${telephone}/documents/${encodeURIComponent(id)}/url`,
      {
        headers: authorization ? { Authorization: authorization } : {},
        cache: "no-store",
      }
    );
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}
