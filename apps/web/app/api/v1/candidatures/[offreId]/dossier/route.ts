import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

/**
 * Proxy POST /api/v1/candidatures/[offreId]/dossier → API Railway.
 *
 * Endpoint GARDÉ : le `Authorization` injecté par middleware.ts (cookie de
 * session) doit être relayé tel quel, sinon l'espace client reçoit 401.
 * La réponse contient une URL SIGNÉE de 60 s : jamais de cache.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ offreId: string }> }
) {
  try {
    const { offreId } = await params;
    const corps = await request.text();
    const authorization = request.headers.get("authorization");
    const res = await fetch(
      `${API_URL}/api/v1/candidatures/${encodeURIComponent(offreId)}/dossier`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: corps || "{}",
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
