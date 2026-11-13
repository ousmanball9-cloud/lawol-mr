import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api-url";

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/profils`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
  }
}
