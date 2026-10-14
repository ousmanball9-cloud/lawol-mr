import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy POST /api/v1/matches/[matchId]/postule → API Railway
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const body = await request.text();
    const res = await fetch(`${API_URL}/api/v1/matches/${matchId}/${action}`, {
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

// Proxy PATCH /api/v1/matches/[matchId]/favori → API Railway
// (endpoint MUTANT : le Bearer injecté par middleware.ts part vers l'API)
export async function PATCH(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const body = await request.text();
    const authorization = request.headers.get("authorization");
    const res = await fetch(`${API_URL}/api/v1/matches/${matchId}/${action}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
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