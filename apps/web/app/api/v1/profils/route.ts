import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api-url";

// Proxy POST /api/v1/profils → API Railway
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const res = await fetch(`${API_URL}/api/v1/profils`, {
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
