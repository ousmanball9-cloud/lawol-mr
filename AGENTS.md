# LAWOL.mr — spécificités locales

Workspace : plateforme bourses/stages pour étudiants mauritaniens (refonte « Jobteaser 100 % bourses »).
Stack : `apps/api` FastAPI + Supabase (Postgres + Storage) · `apps/web` Next 15 App Router + React 19.
Charte : « Nuit d'Indigo » (voir skill `design-system`) — zéro noir, tokens existants uniquement.

## Règles non négociables

1. **Tout nouvel endpoint `/api/v1/*` backend exige sa route proxy Next locale**
   (`apps/web/app/api/v1/.../route.ts`) — `middleware.ts` ne fait qu'injecter le
   `Bearer` (familles `/api/v1/profils/*`, `/api/v1/matches*`, `/api/v1/dashboard/*`),
   il **ne réécrit pas**. Sans proxy → 404 Next. **Un proxy de GET gardé doit
   RELAYER `Authorization` vers l'API** (`request.headers.get("authorization")`),
   sinon l'espace client reçoit 401.
   Pattern : lire le corps (`request.text()`/`request.formData()`), forwarder vers
   `NEXT_PUBLIC_API_URL`, relayer statut + `Authorization` (modèles :
   `profils/[telephone]/preferences/route.ts`, `documents/route.ts`).
   **Admin** : un proxy `/api/v1/admin/*` relaie l'auth de la garde
   `_admin_autorise` — `Cookie` (`lawol_admin`), `x-admin-token` ET
   `Authorization` ; oublier le cookie → 401 (modèle :
   `api/v1/admin/offres/[offreId]/publication/route.ts`,
   `api/v1/admin/parametres/route.ts`, `api/v1/admin/stats/visites/route.ts`).
2. **Zéro migration SQL** : les colonnes additionnelles passent par
   `profils.metadata` (jsonb) — pattern `code_pin_hash` / `prefs_avancees` /
   `documents` / `notifications_lues` (lire dict → modifier → `.update()`).
3. **Sécurité** : TOUS les endpoints du profil sont gardés — consultation
   (`GET /api/v1/profils/{tel}`, `/{tel}/historique`) et mutations (`garde_profil` :
   401 sans Bearer, 403 si token ≠ {tel}) ; `GET /api/v1/dashboard/{tel}` idem ;
   `GET /api/v1/matches` = `session_profil` + 403 si `profil_id` ≠ profil possédé.
   Bucket Storage = **privé**. Uploads : whitelist
   extension+MIME, taille lue par tronçons, chemin reconstruit côté serveur.
4. **Pas de build** dans les tâches courantes ; vérifications = `py_compile`
   + `ruff check` (API) et `npx tsc --noEmit` + `npx eslint` (web).
5. **Harnais de preuve** : rejouer `scripts/test-*.py` (mock Supabase, zéro
   réseau) avant chaque commit — les `data-probe` des pages sont comptés par
   `scripts/verify-*.mjs` : ne jamais les supprimer lors d'une refonte.
   **Après un déploiement, la preuve est le comportement live** :
   `node apps/web/scripts/verify-live-public.mjs https://lawol-mr.vercel.app`
   (catalogue : 12 cartes, 0 emploi, 12 aperçus, 0 erreur console) + la fiche
   (`verify-fiche-bourse.mjs <url>`). Un « READY » de dashboard ne prouve pas
   qu'un élève voit la bonne page — et le harnais jetable doit devenir un
   fichier du dépôt, sinon la preuve disparaît avec la session.
6. **Enums** : réduire les valeurs à l'écriture ne réduit jamais les valeurs
   en base — le sérialiseur lecture accepte l'union SQL (enum `*Db`), seule
   l'écriture est bridée (une ligne legacy ne doit jamais faire 500 la liste).
7. **Classification des offres par source** (décision 16/10/2026) : le
   catalogue public est « 100 % bourses ». Une source d'EMPLOI (`beta_mr`,
   `linkedin`, `anpe`, sites carrières `mauritel`/`snim`/`bnm`/`totalenergies`)
   ne produit JAMAIS `bourse` : `emploi_junior`, ou `stage_pfe` si l'intitulé
   décrit un stage. Règle unique : `scraper/engine.py::type_offre_pour_source`,
   appliquée au point d'écriture unique `BaseScraper.save` (aucun scraper ne la
   contourne). Reprise des lignes existantes : `scripts/backfill-type-offre.py`
   (`--dry-run` liste, `--apply` écrit, zéro suppression, ne change que
   `type_offre`).

## Repères

- Backend : routes dans `apps/api/app/modules/*/routes.py`, enregistrées dans `main.py`.
- Frontend : Chrome (header/footer) = `components/chrome/` ; menu mobile
  (`mobile-menu.tsx`) + cloche notifications (`notifications-cloche.tsx`) rendent
  `null` sans session (cookie `lawol_token`, helper `lib/session.ts`).
- Prod : Vercel (front) + Railway (API) — vars `SESSION_SECRET`, `SMTP_*`,
  `APP_ENV` à définir dans les dashboards (jamais committées).

## Identité (immuable — ne jamais inventer d'URL)

- Site public : `https://lawol-mr.vercel.app` (projet Vercel `lawol-mr`).
- **PAS de nom de domaine actif** : ne JAMAIS présenter `lawol.mr` comme URL
  fonctionnelle (DNS public = NXDOMAIN ; ne résout qu'en IP privée locale).
- API : `https://lawol-mr-production.up.railway.app`.
