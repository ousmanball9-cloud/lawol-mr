import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy POST /api/v1/profils/[telephone]/connexion → API Railway
// Vérifie le code PIN et renvoie le token de session signé.
export async function POST(request: Request, { params }: { params: Promise<{ telephone: string }> }) {
  try {
    const { telephone } = await params;
    const body = await request.text();
    const res = await fetch(`${API_URL}/api/v1/profils/${telephone}/connexion`, {
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
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}
