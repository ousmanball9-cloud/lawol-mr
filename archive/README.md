# archive/ — contrat d'archivage

## On y met
- Code one-off / scripts de migration ponctuels (ex. `one-off-YYYY-MM-DD-<sujet>/`).
- Fronts ou prototypes abandonnés, conservés pour référence (ex. `2026-10-15-frontend-entreprise/`).
- Prototypes externes intégrés au repo pour traçabilité (ex. `2026-11-08-new-site-prototype/`).

## On n'y met PAS
- Code actif importé par `apps/`, `infra/` ou `scripts/` (l'archive n'est jamais sur le chemin d'exécution).
- Migrations Supabase (`infra/supabase/migrations/` — jamais détournées ici).
- Configuration CI/CD (`.github/`), manifestes racine, `.env*`.
- Données utilisateur, secrets, logs runtime (→ `logs/`).

## Convention de nommage
`AAAA-MM-JJ-<sujet>` (date d'archivage) ; préfixe `one-off-` pour les scripts/SQL à usage unique.

## Règles
- Contenu déplacé via `git mv` (ou mouvement tracé dans `REORGANISATION-TRACE.md` si non tracké).
- Rien n'est supprimé : l'archive est gelée, restauration possible via `git mv` inverse.
- Toute réorganisation passe par un commit dédié + entrée dans `REORGANISATION-TRACE.md`.
