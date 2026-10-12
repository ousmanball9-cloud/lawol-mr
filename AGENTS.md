# LAWOL.mr — spécificités locales

Workspace : plateforme bourses/stages pour étudiants mauritaniens (refonte « Jobteaser 100 % bourses »).
Stack : `apps/api` FastAPI + Supabase (Postgres + Storage) · `apps/web` Next 15 App Router + React 19.
Charte : « Nuit d'Indigo » (voir skill `design-system`) — zéro noir, tokens existants uniquement.

## Règles non négociables

1. **Tout nouvel endpoint `/api/v1/*` backend exige sa route proxy Next locale**
   (`apps/web/app/api/v1/.../route.ts`) — `middleware.ts` ne fait qu'injecter le
   `Bearer` sur `/api/v1/profils/*`, il **ne réécrit pas**. Sans proxy → 404 Next.
   Pattern : lire le corps (`request.text()`/`request.formData()`), forwarder vers
   `NEXT_PUBLIC_API_URL`, relayer statut + `Authorization` (modèles :
   `profils/[telephone]/preferences/route.ts`, `documents/route.ts`).
2. **Zéro migration SQL** : les colonnes additionnelles passent par
   `profils.metadata` (jsonb) — pattern `code_pin_hash` / `prefs_avancees` /
   `documents` / `notifications_lues` (lire dict → modifier → `.update()`).
3. **Sécurité** : endpoints profil = garde `garde_profil` (401 sans Bearer,
   403 si token ≠ {tel}). Bucket Storage = **privé**. Uploads : whitelist
   extension+MIME, taille lue par tronçons, chemin reconstruit côté serveur.
4. **Pas de build** dans les tâches courantes ; vérifications = `py_compile`
   + `ruff check` (API) et `npx tsc --noEmit` + `npx eslint` (web).
5. **Harnais de preuve** : rejouer `scripts/test-*.py` (mock Supabase, zéro
   réseau) avant chaque commit — les `data-probe` des pages sont comptés par
   `scripts/verify-*.mjs` : ne jamais les supprimer lors d'une refonte.

## Repères

- Backend : routes dans `apps/api/app/modules/*/routes.py`, enregistrées dans `main.py`.
- Frontend : Chrome (header/footer) = `components/chrome/` ; menu mobile
  (`mobile-menu.tsx`) + cloche notifications (`notifications-cloche.tsx`) rendent
  `null` sans session (cookie `lawol_token`, helper `lib/session.ts`).
- Prod : Vercel (front) + Railway (API) — vars `SESSION_SECRET`, `SMTP_*`,
  `APP_ENV` à définir dans les dashboards (jamais committées).
