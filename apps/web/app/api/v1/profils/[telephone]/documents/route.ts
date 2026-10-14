import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy GET /api/v1/profils/[telephone]/documents → API Railway
// (endpoint MUTANT : le Bearer injecté par middleware.ts part vers l'API)
export async function GET(request: Request, { params }: { params: Promise<{ telephone: string }> }) {
  try {
    const { telephone } = await params;
    const authorization = request.headers.get("authorization");
    const res = await fetch(`${API_URL}/api/v1/profils/${telephone}/documents`, {
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

// Proxy POST /api/v1/profils/[telephone]/documents → API Railway
// (endpoint MUTANT : le Bearer injecté par middleware.ts part vers l'API)
export async function POST(request: Request, { params }: { params: Promise<{ telephone: string }> }) {
  try {
    const { telephone } = await params;
    const body = await request.formData();
    const authorization = request.headers.get("authorization");
    const res = await fetch(`${API_URL}/api/v1/profils/${telephone}/documents`, {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
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