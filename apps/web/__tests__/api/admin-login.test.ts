/**
 * Route `/api/admin/login` — les entrées invalides répondent 400, jamais 500.
 *
 * Preuve visée : un corps JSON sans `password` (ou malformé) ne fait plus
 * planter `createHash` (500 mesuré en prod le 20/10/2026), le mauvais mot de
 * passe reste 401 et le bon pose le cookie de session admin.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const MOT_DE_PASSE = "mot-de-passe-de-test";
const HASH = createHash("sha256").update(MOT_DE_PASSE).digest("hex");

async function chargerRoute() {
  vi.resetModules();
  vi.stubEnv("ADMIN_PASSWORD_HASH", HASH);
  return import("@/app/api/admin/login/route");
}

function requete(corps: string) {
  return new Request("https://lawol-mr.vercel.app/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: corps,
  });
}

beforeEach(() => vi.stubEnv("ADMIN_PASSWORD_HASH", HASH));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("POST /api/admin/login", () => {
  it("corps JSON sans champ password → 400 (plus de 500)", async () => {
    const { POST } = await chargerRoute();
    const res = await POST(requete(JSON.stringify({ mot_de_passe: "x" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Mot de passe requis" });
  });

  it("JSON malformé → 400 explicite", async () => {
    const { POST } = await chargerRoute();
    const res = await POST(requete("{ceci n'est pas du json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Corps JSON invalide" });
  });

  it("password non chaîne (objet) → 400", async () => {
    const { POST } = await chargerRoute();
    const res = await POST(requete(JSON.stringify({ password: { $ne: null } })));
    expect(res.status).toBe(400);
  });

  it("mauvais mot de passe → 401 sans cookie", async () => {
    const { POST } = await chargerRoute();
    const res = await POST(requete(JSON.stringify({ password: "faux" })));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("bon mot de passe → 200 + cookie lawol_admin httpOnly", async () => {
    const { POST } = await chargerRoute();
    const res = await POST(requete(JSON.stringify({ password: MOT_DE_PASSE })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("lawol_admin=authenticated");
    expect(cookie.toLowerCase()).toContain("httponly");
  });
});
