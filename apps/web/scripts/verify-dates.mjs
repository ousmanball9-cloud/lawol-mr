// Harnais « dates » — Lot B « bourses 100 % » : prouve qu'aucune offre MORTE
// (date de clôture passée ou absente) n'est servie par l'API.
//
//   node scripts/verify-dates.mjs
//
// Critère : TOUTE offre exposée par /api/v1/offres a une date_limite future.
// Sortie non-verte (exit 1) si une seule offre est morte ou sans date.
// Déterministe (données API réelles), rejouable en 1 commande.

const API = (process.env.API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const AUJOURDHUI = new Date();
AUJOURDHUI.setHours(0, 0, 0, 0); // comparaison à minuit local

function échec(msg) {
  console.error(`  KO  ${msg}`);
  process.exit(1);
}

async function main() {
  let offres;
  try {
    const r = await fetch(`${API}/api/v1/offres?limit=1000`);
    if (!r.ok) échec(`API /offres -> HTTP ${r.status}`);
    offres = await r.json();
  } catch (e) {
    échec(`API injoignable sur ${API} — démarre uvicorn (port 8000). ${e.message}`);
  }
  if (!Array.isArray(offres)) échec(`réponse inattendue: ${typeof offres}`);
  if (offres.length === 0) échec("aucune offre en base (collecte non lancée ?)");

  const mortes = [];
  const sansDate = [];
  for (const o of offres) {
    if (!o.date_limite) {
      sansDate.push(o);
      continue;
    }
    const d = new Date(o.date_limite);
    if (Number.isNaN(d.getTime())) {
      sansDate.push(o);
      continue;
    }
    d.setHours(0, 0, 0, 0);
    if (d < AUJOURDHUI) mortes.push(o);
  }

  // Répartition par type (contexte du rapport)
  const parType = {};
  for (const o of offres) parType[o.type_offre] = (parType[o.type_offre] || 0) + 1;
  const types = Object.entries(parType)
    .map(([t, n]) => `${t}=${n}`)
    .join("  ");

  console.log(`  offres totales        : ${offres.length}  (${types})`);
  console.log(`  offres mortes (passé) : ${mortes.length}`);
  console.log(`  offres sans date      : ${sansDate.length}`);

  if (mortes.length > 0) {
    for (const o of mortes.slice(0, 5)) {
      console.error(`    morte → ${o.date_limite}  « ${o.titre?.slice(0, 60)} »`);
    }
    échec(`${mortes.length} offre(s) morte(s) servie(s) — Lot B non respecté`);
  }
  if (sansDate.length > 0) {
    for (const o of sansDate.slice(0, 5)) {
      console.error(`    sans date → « ${o.titre?.slice(0, 60)} »`);
    }
    échec(`${sansDate.length} offre(s) sans date_limite — Lot B non respecté`);
  }

  console.log("  RÉSULTAT              : TOUT VERT ✅ (zéro offre morte)");
}

main();
