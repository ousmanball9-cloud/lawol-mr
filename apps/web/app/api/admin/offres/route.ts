import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/offres`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}
