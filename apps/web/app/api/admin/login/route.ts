import { NextResponse } from "next/server";
import { createHash } from "crypto";

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";

export async function POST(request: Request) {
  // Entrée non validée = 400, jamais un 500 (mesuré le 20/10 : un corps sans
  // `password` faisait planter createHash sur `undefined`).
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  const password =
    corps && typeof corps === "object" && typeof (corps as { password?: unknown }).password === "string"
      ? (corps as { password: string }).password
      : null;
  if (password === null || password === "") {
    return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
  }

  const hash = createHash("sha256").update(password).digest("hex");

  if (hash !== ADMIN_PASSWORD_HASH) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("lawol_admin", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
    path: "/",
  });

  return response;
}
