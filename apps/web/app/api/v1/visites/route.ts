import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy POST /api/v1/visites → API Railway
// (endpoint PUBLIC best effort : {chemin} → 201 {ok: true}, jamais 500 côté API).
// Le corps part tel quel ; en cas de panne réseau on répond la MÊME forme que
// l'API (201 {ok: true}) : compter une visite ne casse jamais la page appelante.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const res = await fetch(`${API_URL}/api/v1/visites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ ok: true }, { status: 201 });
  }
}
