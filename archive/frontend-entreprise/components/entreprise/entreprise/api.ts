import type { CandidatureEntreprise, LoginReponse, OffreCreateBody, OffreEntreprise } from "./types";

const BASE = "/api/v1/entreprises";

async function requete<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const corps = await res.json().catch(() => ({}));
    throw new Error((corps as { detail?: string }).detail || `Erreur ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function apiLogin(email: string, password: string): Promise<LoginReponse> {
  return requete<LoginReponse>(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function apiLogout(token: string): Promise<unknown> {
  return requete<unknown>(`${BASE}/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

export function apiOffres(token: string): Promise<OffreEntreprise[]> {
  return requete<OffreEntreprise[]>(`${BASE}/offres?token=${encodeURIComponent(token)}`);
}

export function apiCandidatures(token: string): Promise<CandidatureEntreprise[]> {
  return requete<CandidatureEntreprise[]>(`${BASE}/candidatures?token=${encodeURIComponent(token)}`);
}

export function apiCreerOffre(corps: OffreCreateBody): Promise<{ id: string; statut_publication: string }> {
  return requete(`${BASE}/offres`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
}
