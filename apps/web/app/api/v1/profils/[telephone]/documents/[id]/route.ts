import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy DELETE /api/v1/profils/[telephone]/documents/[id] → API Railway
// (endpoint MUTANT : le Bearer injecté par middleware.ts part vers l'API)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ telephone: string; id: string }> }
) {
  try {
    const { telephone, id } = await params;
    const authorization = request.headers.get("authorization");
    const res = await fetch(`${API_URL}/api/v1/profils/${telephone}/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authorization ? { Authorization: authorization } : {},
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