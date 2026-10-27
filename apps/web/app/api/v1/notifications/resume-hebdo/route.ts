import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy POST /api/v1/notifications/resume-hebdo → API Railway.
// Règle locale (LAWOL.mr) : tout endpoint `/api/v1/*` du backend a sa route
// proxy Next. L'endpoint est GARDÉ côté API (401/403), le proxy doit donc
// RELAYER l'identité admin (`Cookie`, `x-admin-token`, `Authorization`) —
// sinon il ne peut jamais aboutir (mesuré 20/10 sur /matching/run).
// `?appliquer=false` par défaut côté API : un proxy qui oublierait le
// paramètre ferait une SIMULATION, jamais un envoi surprise.
export async function POST(request: Request) {
  try {
    const entetes: Record<string, string> = { "Content-Type": "application/json" };
    const cookie = request.headers.get("cookie");
    const tokenAdmin = request.headers.get("x-admin-token");
    const autorisation = request.headers.get("authorization");
    if (cookie) entetes["Cookie"] = cookie;
    if (tokenAdmin) entetes["x-admin-token"] = tokenAdmin;
    if (autorisation) entetes["Authorization"] = autorisation;

    const demandee = new URL(request.url).searchParams.get("appliquer");
    const requete = demandee === "true" ? "?appliquer=true" : "";

    const res = await fetch(`${API_URL}/api/v1/notifications/resume-hebdo${requete}`, {
      method: "POST",
      headers: entetes,
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
