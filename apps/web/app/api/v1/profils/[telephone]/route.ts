import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Proxy GET /api/v1/profils/[telephone] → API Railway
export async function GET(request: Request, { params }: { params: Promise<{ telephone: string }> }) {
  try {
    const { telephone } = await params;
    const res = await fetch(`${API_URL}/api/v1/profils/${telephone}`);
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}

// Proxy PUT /api/v1/profils/[telephone] → API Railway
export async function PUT(request: Request, { params }: { params: Promise<{ telephone: string }> }) {
  try {
    const { telephone } = await params;
    const body = await request.text();
    const res = await fetch(`${API_URL}/api/v1/profils/${telephone}`, {
      method: "PUT",
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
