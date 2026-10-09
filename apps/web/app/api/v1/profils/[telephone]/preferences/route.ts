import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy PATCH /api/v1/profils/[telephone]/preferences → API Railway
export async function PATCH(request: Request, { params }: { params: Promise<{ telephone: string }> }) {
  try {
    const { telephone } = await params;
    const body = await request.text();
    const res = await fetch(`${API_URL}/api/v1/profils/${telephone}/preferences`, {
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
