import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy POST /api/v1/matches/[matchId]/postule → API Railway
export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const res = await fetch(`${API_URL}/api/v1/matches/${matchId}/postule`, {
      method: "POST",
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
