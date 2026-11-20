import { NextResponse } from "next/server";

/**
 * Relais GET vers l'API Render, avec réessai sur « réveil du service ».
 *
 * MESURE (20/11/2026) : le service `lawol-api` est sur le plan free — il
 * s'endort après ~15 min d'inactivité et répond **503** pendant le réveil
 * (~30-60 s). Constaté : 3 appels 503 d'affilée, puis 200 sans aucune
 * intervention (service `not_suspended`, deploy `live`) → ce n'est pas une
 * panne, c'est un délai.
 *
 * Sans réessai, le visiteur reçoit une page d'erreur alors que l'API se
 * réveillait simplement. On réessaie donc les statuts transitoires (502/503/504)
 * en gardant le dernier statut réel quand les tentatives sont épuisées : le
 * client voit un 503 (« service en réveil »), jamais un 200 trompeur.
 */

/** Statuts qui valent un réessai : réveil Render ou aléa réseau transitoire. */
const TRANSITOIRES = new Set([502, 503, 504]);

/** 3 tentatives espacées de 4 s : ~12 s d'attente, sous la limite Vercel (60 s). */
const TENTATIVES = 3;
const ATTENTE_MS = 4000;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Relaie `url` (texte brut, statut réel relayé) avec réessai sur statuts transitoires. */
export async function relayerGetApi(url: string): Promise<NextResponse> {
  for (let essai = 1; essai <= TENTATIVES; essai++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.text();

      if (TRANSITOIRES.has(res.status) && essai < TENTATIVES) {
        await pause(ATTENTE_MS);
        continue;
      }

      return new NextResponse(data, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      if (essai < TENTATIVES) {
        await pause(ATTENTE_MS);
        continue;
      }
      return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
    }
  }

  // Inatteignable : la boucle sort par un `return` à chaque tour. Garde de type.
  return NextResponse.json({ error: "API inaccessible" }, { status: 502 });
}
