/**
 * Proxys Next du socle « réglages + visites » (branche feat/admin-reglages-visites).
 *
 * Règle 1 locale (lawol-mr/AGENTS.md) : tout endpoint `/api/v1/*` exige sa route
 * proxy Next — et un proxy GARDÉ doit RELAYER l'authentification admin.
 *
 * Ce test prouve, sans réseau ni build :
 *   1. GET  /api/v1/parametres          → appelée vers l'API (publique) ;
 *   2. POST /api/v1/visites             → corps {chemin} transmis tel quel ;
 *   3. PUT  /api/v1/admin/parametres    → cookie/x-admin-token/Authorization RELAYÉS ;
 *   4. GET  /api/v1/admin/stats/visites → cookie admin RELAYÉ ;
 *   5. aucune panne réseau ne produit un 500 : 502 (réglages) / 201 {ok:true} (visite).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getParametres } from "@/app/api/v1/parametres/route";
import { POST as postVisite } from "@/app/api/v1/visites/route";
import { PUT as putParametreAdmin } from "@/app/api/v1/admin/parametres/route";
import { GET as getStatsAdmin } from "@/app/api/v1/admin/stats/visites/route";

type Appel = { url: string; init: RequestInit | undefined };

const URL_PARAMETRES = "/api/v1/parametres";
const URL_VISITES = "/api/v1/visites";
const URL_ADMIN_PARAMETRES = "/api/v1/admin/parametres";
const URL_ADMIN_STATS = "/api/v1/admin/stats/visites";

let appels: Appel[];

function stubFetch(corps = "{}", statut = 200, echec = false) {
  appels = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (echec) throw new Error("réseau coupé");
      appels.push({ url: String(url), init });
      return new Response(corps, {
        status: statut,
        headers: { "Content-Type": "application/json" },
      });
    })
  );
}

function entetes(call = 0): Record<string, string> {
  return (appels[call].init?.headers ?? {}) as Record<string, string>;
}

beforeEach(() => stubFetch());
afterEach(() => vi.unstubAllGlobals());

describe("proxy public GET /api/v1/parametres", () => {
  it("appelle l'API et relaie corps + statut", async () => {
    stubFetch(JSON.stringify({ support_whatsapp: "2221234567" }));
    const res = await getParametres();
    expect(res.status).toBe(200);
    expect(appels).toHaveLength(1);
    expect(appels[0].url).toContain(URL_PARAMETRES);
    expect(await res.json()).toEqual({ support_whatsapp: "2221234567" });
  });

  it("API injoignable → 502, jamais un 500", async () => {
    stubFetch("{}", 200, true);
    const res = await getParametres();
    expect(res.status).toBe(502);
  });
});

describe("proxy public POST /api/v1/visites", () => {
  it("transmet {chemin} tel quel et relaie le 201 de l'API", async () => {
    stubFetch(JSON.stringify({ ok: true }), 201);
    const res = await postVisite(
      new Request("http://localhost/api/v1/visites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chemin: "/offres" }),
      })
    );
    expect(res.status).toBe(201);
    expect(appels[0].url).toContain(URL_VISITES);
    expect(appels[0].init?.method).toBe("POST");
    expect(appels[0].init?.body).toBe(JSON.stringify({ chemin: "/offres" }));
  });

  it("panne réseau → 201 {ok:true} (compter une visite ne casse jamais la page)", async () => {
    stubFetch("{}", 200, true);
    const res = await postVisite(
      new Request("http://localhost/api/v1/visites", {
        method: "POST",
        body: JSON.stringify({ chemin: "/" }),
      })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("proxy gardé PUT /api/v1/admin/parametres — relais de l'auth admin", () => {
  it("relaie cookie + x-admin-token + Authorization et le corps {cle, valeur}", async () => {
    stubFetch(JSON.stringify({ cle: "email_contact", valeur: "a@b.mr" }));
    const res = await putParametreAdmin(
      new Request("http://localhost/api/v1/admin/parametres", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: "lawol_admin=authenticated",
          authorization: "Bearer hash-admin",
          "x-admin-token": "hash-admin",
        },
        body: JSON.stringify({ cle: "email_contact", valeur: "a@b.mr" }),
      })
    );
    expect(res.status).toBe(200);
    expect(appels[0].url).toContain(URL_ADMIN_PARAMETRES);
    const h = entetes();
    expect(h.Cookie).toBe("lawol_admin=authenticated");
    expect(h.Authorization).toBe("Bearer hash-admin");
    expect(h["X-Admin-Token"]).toBe("hash-admin");
    expect(appels[0].init?.body).toBe(
      JSON.stringify({ cle: "email_contact", valeur: "a@b.mr" })
    );
  });

  it("rien d'authentifié → aucun en-tête d'auth inventé (l'API répondra 401)", async () => {
    await putParametreAdmin(
      new Request("http://localhost/api/v1/admin/parametres", {
        method: "PUT",
        body: JSON.stringify({ cle: "reseaux", valeur: [] }),
      })
    );
    const h = entetes();
    expect(h.Cookie).toBeUndefined();
    expect(h.Authorization).toBeUndefined();
    expect(h["X-Admin-Token"]).toBeUndefined();
  });

  it("relaie le refus de l'API (403) sans le masquer", async () => {
    stubFetch(JSON.stringify({ detail: "Cookie d'administration invalide" }), 403);
    const res = await putParametreAdmin(
      new Request("http://localhost/api/v1/admin/parametres", {
        method: "PUT",
        headers: { cookie: "lawol_admin=faux" },
        body: JSON.stringify({ cle: "reseaux", valeur: [] }),
      })
    );
    expect(res.status).toBe(403);
  });
});

describe("proxy gardé GET /api/v1/admin/stats/visites — relais de l'auth admin", () => {
  it("relaie le cookie admin et le corps {total, par_jour}", async () => {
    stubFetch(JSON.stringify({ total: 152, par_jour: [{ jour: "2026-10-01", nb: 3 }] }));
    const res = await getStatsAdmin(
      new Request("http://localhost/api/v1/admin/stats/visites", {
        headers: { cookie: "lawol_admin=authenticated" },
      })
    );
    expect(res.status).toBe(200);
    expect(appels[0].url).toContain(URL_ADMIN_STATS);
    expect(entetes().Cookie).toBe("lawol_admin=authenticated");
    expect(await res.json()).toEqual({
      total: 152,
      par_jour: [{ jour: "2026-10-01", nb: 3 }],
    });
  });

  it("API injoignable → 502, jamais un 500", async () => {
    stubFetch("{}", 200, true);
    const res = await getStatsAdmin(new Request("http://localhost/api/v1/admin/stats/visites"));
    expect(res.status).toBe(502);
  });
});
