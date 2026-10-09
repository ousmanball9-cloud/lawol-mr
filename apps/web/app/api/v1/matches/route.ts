import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy GET /api/v1/matches → API Railway
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const res = await fetch(`${API_URL}/api/v1/matches${searchParams ? `?${searchParams}` : ""}`);
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}
