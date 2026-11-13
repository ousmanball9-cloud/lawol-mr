/**
 * URL de base de l'API — source unique de vérité.
 *
 * L'API a migré de Railway vers Render le 12/11/2026 : l'ancienne adresse
 * Railway est morte. Aucun proxy `app/api/**` ni aucun harnais
 * `scripts/verify-*.mjs` ne doit recopier une URL en dur — tous
 * lisent `API_URL`. Changer de plateforme = changer cette ligne, ou poser
 * `NEXT_PUBLIC_API_URL` dans l'environnement (aucun code à toucher).
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://lawol-api.onrender.com";
