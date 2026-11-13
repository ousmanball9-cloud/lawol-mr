import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api-url";

// Proxy PATCH /api/v1/matches/[matchId]/statut → API Railway
export async function PATCH(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params;
    const body = await request.text();
    const res = await fetch(`${API_URL}/api/v1/matches/${matchId}/statut`, {
      method: "PATCH",
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
