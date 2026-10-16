/**
 * Preuve de la CHAÎNE CLIENT : middleware Next (injection du Bearer) + proxys
 * locaux (relais du Bearer) pour les GET profil désormais gardés côté API.
 *
 * Piège connu (AGENTS.md) : le middleware n'injectait le Bearer que sur
 * `/api/v1/profils/*`. Les GET `/api/v1/matches` et `/api/v1/dashboard/*` sont
 * maintenant gardés côté API → sans extension du matcher ET sans relais du
 * `Authorization` dans le proxy, l'espace client recevrait 401.
 *
 * Ce test prouve, sans réseau ni build :
 *   1. injection du Bearer sur les 3 familles d'URL (profil, matches, dashboard) ;
 *   2. aucune injection sans cookie de session (l'API répondra 401) ;
 *   3. la garde des PAGES /profil/{tel} est inchangée (redirect /connexion) ;
 *   4. chaque proxy GET relaie l'`Authorization` reçu vers l'API (et n'en
 *      invente pas s'il est absent).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";
import { GET as getMatches } from "@/app/api/v1/matches/route";
import { GET as getDashboard } from "@/app/api/v1/dashboard/[telephone]/route";
import { GET as getHistorique } from "@/app/api/v1/profils/[telephone]/historique/route";
import { GET as getProfil } from "@/app/api/v1/profils/[telephone]/route";

const TEL = "2221234567";

/** Token de session factice, bien formé et non expiré (signature vérifiée par l'API). */
function jeton(tel = TEL, expDansSecondes = 3600): string {
  const payload = Buffer.from(
    JSON.stringify({ tel, exp: Math.floor(Date.now() / 1000) + expDansSecondes })
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${payload}.signature-factice`;
}

function requete(pathname: string, token?: string): NextRequest {
  const entetes = new Headers();
  if (token) entetes.set("cookie", `lawol_token=${token}`);
  return new NextRequest(new URL(`http://localhost${pathname}`), { headers: entetes });
}

/** En-têtes de requête surchargés par le middleware (Next les préfixe). */
function entetesInjectes(res: Response): string {
  return res.headers.get("x-middleware-override-headers") ?? "";
}

function autorisationInjectee(res: Response): string | null {
  return res.headers.get("x-middleware-request-authorization");
}

describe("middleware — injection du Bearer sur les familles gardées", () => {
  const familles = [
    `/api/v1/profils/${TEL}`,
    `/api/v1/profils/${TEL}/historique`,
    `/api/v1/matches?profil_id=p1`,
    `/api/v1/dashboard/${TEL}`,
  ];

  it.each(familles)("injecte Authorization sur %s avec une session valide", async (chemin) => {
    const token = jeton();
    const res = await middleware(requete(chemin, token));
    expect(entetesInjectes(res)).toContain("authorization");
    expect(autorisationInjectee(res)).toBe(`Bearer ${token}`);
  });

  it("n'injecte AUCUN Bearer sans cookie de session (l'API répondra 401)", async () => {
    const res = await middleware(requete(`/api/v1/matches?profil_id=p1`));
    expect(entetesInjectes(res)).not.toContain("authorization");
    expect(autorisationInjectee(res)).toBeNull();
  });

  it("n'injecte PAS un token rattaché à un autre numéro (session expirée/invalide)", async () => {
    const res = await middleware(requete(`/api/v1/matches`, jeton(TEL, -60)));
    expect(autorisationInjectee(res)).toBeNull();
  });
});

describe("middleware — garde des pages /profil inchangée", () => {
  it("sans session → redirect /connexion", async () => {
    const res = await middleware(requete(`/profil/${TEL}`));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "http://localhost/").pathname).toBe(
      "/connexion"
    );
  });

  it("avec la session du bon numéro → la page passe", async () => {
    const res = await middleware(requete(`/profil/${TEL}`, jeton()));
    expect(res.headers.get("location")).toBeNull();
  });

  it("avec la session d'un AUTRE numéro → redirect /connexion", async () => {
    const res = await middleware(requete(`/profil/${TEL}`, jeton("2229999999")));
    expect(res.status).toBe(307);
  });
});

describe("proxys GET — relais de l'Authorization vers l'API", () => {
  let appels: Array<{ url: string; init: RequestInit | undefined }>;

  beforeEach(() => {
    appels = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        appels.push({ url: String(url), init });
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const cas: Array<[string, (r: Request) => Promise<Response>, string]> = [
    [
      "matches",
      (r) => getMatches(r),
      "/api/v1/matches?profil_id=p1",
    ],
    [
      "dashboard",
      (r) => getDashboard(r, { params: Promise.resolve({ telephone: TEL }) }),
      `/api/v1/dashboard/${TEL}`,
    ],
    [
      "historique",
      (r) => getHistorique(r, { params: Promise.resolve({ telephone: TEL }) }),
      `/api/v1/profils/${TEL}/historique`,
    ],
    [
      "profil",
      (r) => getProfil(r, { params: Promise.resolve({ telephone: TEL }) }),
      `/api/v1/profils/${TEL}`,
    ],
  ];

  it.each(cas)("proxy %s : Bearer transmis à l'API", async (_nom, handler, chemin) => {
    const req = new Request(`http://localhost${chemin}`, {
      headers: { authorization: "Bearer jeton-de-session" },
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(appels).toHaveLength(1);
    const entetes = (appels[0].init?.headers ?? {}) as Record<string, string>;
    expect(entetes.Authorization).toBe("Bearer jeton-de-session");
  });

  it.each(cas)("proxy %s : aucun Authorization inventé s'il est absent", async (_nom, handler, chemin) => {
    const res = await handler(new Request(`http://localhost${chemin}`));
    expect(res.status).toBe(200);
    const entetes = (appels[0].init?.headers ?? {}) as Record<string, string>;
    expect(entetes.Authorization).toBeUndefined();
  });
});
