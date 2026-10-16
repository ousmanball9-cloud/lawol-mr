import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy GET /api/v1/parametres → API Railway
// (endpoint PUBLIC : objet plat {cle: valeur} des seules clés publiques).
// `force-dynamic` + `no-store` : un réglage modifié en admin doit être visible
// au rechargement suivant, jamais servi depuis le cache de route Next.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/parametres`, { cache: "no-store" });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}
