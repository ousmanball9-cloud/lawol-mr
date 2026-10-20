import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy POST /api/v1/matching/run → API Railway (relance le matching).
// L'endpoint est GARDÉ côté API (401/403) : le proxy doit donc RELAYER l'identité
// admin — Cookie `lawol_admin`, `x-admin-token` ou `Authorization` — sinon il ne
// peut plus jamais aboutir (mesuré 20/10 : 401 systématique).
export async function POST(request: Request) {
  try {
    const entetes: Record<string, string> = { "Content-Type": "application/json" };
    const cookie = request.headers.get("cookie");
    const tokenAdmin = request.headers.get("x-admin-token");
    const autorisation = request.headers.get("authorization");
    if (cookie) entetes["Cookie"] = cookie;
    if (tokenAdmin) entetes["x-admin-token"] = tokenAdmin;
    if (autorisation) entetes["Authorization"] = autorisation;

    const res = await fetch(`${API_URL}/api/v1/matching/run`, {
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
