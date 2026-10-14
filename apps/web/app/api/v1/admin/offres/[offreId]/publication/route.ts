import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy PATCH /api/v1/admin/offres/[offreId]/publication → API Railway
// (endpoint ADMIN : le cookie lawol_admin ou token est transmis)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ offreId: string }> }
) {
  try {
    const { offreId } = await params;
    const body = await request.text();
    // Transmettre cookie et headers d'auth admin
    const cookie = request.headers.get("cookie");
    const authHeader = request.headers.get("authorization");
    const xAdminToken = request.headers.get("x-admin-token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cookie) headers["Cookie"] = cookie;
    if (authHeader) headers["Authorization"] = authHeader;
    if (xAdminToken) headers["X-Admin-Token"] = xAdminToken;

    const res = await fetch(`${API_URL}/api/v1/admin/offres/${offreId}/publication`, {
      method: "PATCH",
      headers,
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