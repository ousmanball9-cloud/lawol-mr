# RÉORGANISATION — TRACE (passage 1, 2026-11-08)

- **Date** : 2026-11-08
- **Auteur** : inkling-2-small-free (subagent), validé utilisateur (accord explicite, périmètre "P1 — sous-ensemble sûr")
- **Contexte** : repo **actif** (FastAPI + Next, pnpm/turbo/Vercel/Railway). Un autre modèle (DeepSeek) travaille en parallèle sur `apps/api/app/main.py` (modifié avant cette réorg, NON touché).
- **Principe** : déplacement uniquement, **aucune suppression, aucune édition de contenu** (hors `.gitignore`, `AGENTS.md`, nouveaux fichiers de traçage). Tout est réversible via `git mv` inverse (fichiers trackés) ou `Move-Item` inverse (non trackés).
- **Méthode** : `git grep` + scan filesystem AVANT chaque move (voir § Greps). R100 = renommage exact 100 % (git).

## Tableau exhaustif — ancien chemin → nouveau chemin

### 1. Logs runtime racine (untracked, ignorés par `.gitignore`, déplacement filesystem)
| Ancien | Nouveau | Méthode |
|---|---|---|
| `cloudflared.log` | `logs/cloudflared.log` | Move-Item |
| `cloudflared2.log` | `logs/cloudflared2.log` | Move-Item |
| `ngrok.log` | `logs/ngrok.log` | Move-Item |

### 2. One-offs Python trackés → `archive/one-off-2026-10-14-fix-prefs/` (`git mv`)
| Ancien | Nouveau |
|---|---|
| `fix_prefs.py` | `archive/one-off-2026-10-14-fix-prefs/fix_prefs.py` |
| `fix_prefs2.py` | `archive/one-off-2026-10-14-fix-prefs/fix_prefs2.py` |
| `fix_prefs3.py` | `archive/one-off-2026-10-14-fix-prefs/fix_prefs3.py` |
| `fix_prefs4.py` | `archive/one-off-2026-10-14-fix-prefs/fix_prefs4.py` |
| `fix_prefs5.py` | `archive/one-off-2026-10-14-fix-prefs/fix_prefs5.py` |
| `fix_prefs6.py` | `archive/one-off-2026-10-14-fix-prefs/fix_prefs6.py` |
| `fix_prefs7.py` | `archive/one-off-2026-10-14-fix-prefs/fix_prefs7.py` |
| `fix_prefs8.py` | `archive/one-off-2026-10-14-fix-prefs/fix_prefs8.py` |

### 3. One-off SQL tracké → `archive/one-off-2026-10-14-sql/` (`git mv`)
| Ancien | Nouveau |
|---|---|
| `migration_offres_pays_financement.sql` | `archive/one-off-2026-10-14-sql/migration_offres_pays_financement.sql` |

⚠️ Ce fichier NE va PAS dans `infra/supabase/migrations/` (gel `infra/`).

### 4. Archives datées (`git mv`, renommage de dossier entier)
| Ancien | Nouveau | Fichiers (R100) |
|---|---|---|
| `archive/frontend-entreprise/` | `archive/2026-10-15-frontend-entreprise/` | 18 |
| `archive/frontend-tests/` | `archive/2026-10-15-frontend-tests/` | 3 |

Fichiers renommés (détail) :
- `app/entreprise/entreprise/layout.tsx`, `app/entreprise/entreprise/login/page.tsx`, `app/entreprise/entreprise/page.tsx`
- `app/entreprises/entreprises/[id]/page.tsx`, `app/entreprises/entreprises/layout.tsx`, `app/entreprises/entreprises/page.tsx`
- `components/entreprise/entreprise/api.ts`, `components/entreprise/entreprise/onglet-candidatures.tsx`, `components/entreprise/entreprise/onglet-deposer.tsx`, `components/entreprise/entreprise/onglet-offres.tsx`, `components/entreprise/entreprise/onglet-tableau.tsx`, `components/entreprise/entreprise/sidebar.tsx`, `components/entreprise/entreprise/types.ts`
- `components/entreprises/entreprises/carte-entreprise.tsx`, `components/entreprises/entreprises/carte-offre-entreprise.tsx`, `components/entreprises/entreprises/filtres-entreprises.tsx`, `components/entreprises/entreprises/types.ts`
- `scripts/verify-entreprise.mjs`
- (tests) `verify-espace-old.mjs`, `verify-offre-modal-old.mjs`, `verify-offres-old.mjs`

Préfixe `2026-10-15-` = date de la réorg d'origine constatée (contenu archivé le 2026-10-15), conformément à la convention `AAAA-MM-JJ-<sujet>`.

### 5. `new-site/` (untracked, ~46 Mo, gitignored, sans lien workspace) → `archive/` (déplacement filesystem, contenu non touché)
| Ancien | Nouveau |
|---|---|
| `new-site/` | `archive/2026-11-08-new-site-prototype/` |

Déplacé **à l'intérieur du repo** (pas hors repo) pour rester traçable et restaurable. Contenu inchangé.

### 6. Fichiers modifiés (pas déplacés)
| Fichier | Changement |
|---|---|
| `.gitignore` | + `.pytest_cache/` et + `.ruff_cache/` (section "Caches outils (non commités)"). Rien d'autre. (Note : `.pytest_cache/` et `.ruff_cache/` sont en réalité auto-ignorés par leurs `.gitignore` internes ; ajout racine = ceinture+bretelles.) |
| `AGENTS.md` | + bloc `[RÉORGANISATION 2026-11-08]` en tête (contenu existant inchangé) |

### 7. Fichiers créés
| Fichier | Rôle |
|---|---|
| `REORGANISATION-TRACE.md` | ce document |
| `archive/README.md` | contrat archive (on y met / on n'y met pas / convention datée) |
| `logs/README.md` | rappel : logs runtime jetables, non commités (⚠️ `logs/` est gitignored → ce README reste local, visible sur disque, non tracké) |

## Greps préalables (preuve zéro référence)

Commande : `git grep -n -i -E "fix_prefs|migration_offres_pays_financement|frontend-entreprise|frontend-tests|new-site|cloudflared|ngrok" -- . ':!fix_prefs*.py' ':!migration_offres_pays_financement.sql' ':!archive/frontend-entreprise' ':!archive/frontend-tests' ':!new-site' ':!logs'`

**Résultat : 3 hits, tous = motifs d'exclusion `.gitignore`/`.dockerignore` (pas des références) :**
- `.dockerignore:15` `cloudflared*.log`, `.dockerignore:16` `ngrok*.log`
- `.gitignore:39` `cloudflared*.log`, `.gitignore:40` `ngrok*.log`, `.gitignore:42` `new-site/`

Scan filesystem complémentaire (racine + `.opencode/`, hors dossiers déplacés et code actif) : seul hit = `.gitignore:42:new-site/` (motif d'exclusion). `docs/`, `scripts/`, `apps/`, `infra/` sont trackés → couverts par `git grep` (zéro hit).

**Verdict greps : CLEAN pour tous les éléments déplacés.** Aucun move bloqué.

## NON TOUCHÉ
- `apps/` (dont `apps/api/app/main.py` modifié par DeepSeek — préexistant, préservé tel quel)
- `infra/` (dont `infra/supabase/migrations/`)
- `scripts/` (dont `test-*` / `verify-*`)
- `.github/` (**gel total** — tracké malgré `.gitignore`, contrainte CI/token)
- `docs/` (réorg `docs/01-04` = phase 2, différée)
- Manifestes racine : `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `Dockerfile`, `Procfile`, `railway.json`, `vercel.json`, `README.md`, `AGENTS.md` (sauf bloc d'en-tête ajouté, ci-dessus), `.dockerignore`
- `.gitignore` (sauf ajout des 2 lignes cache)
- `.env`, `.env.example` et tout `.env*`
- `node_modules/`, `.pytest_cache/` et `.ruff_cache/` (contenu)
- `tools/` (gitignored, non listé, non touché), `.opencode/`
- `logs/` existant : `collecte-manuel-26-10.log`, `collecte.log` (non déplacés, déjà en place)

## DIFFÉRÉ (phase 2)
- Réorganisation `docs/01-…04-` (plan P2) : risque de liens cassés internes — à faire avec vérification de liens, session dédiée.
- Gel `.github/` : à lever uniquement avec token scope `workflow` ou décision utilisateur explicite.
- Décision sur `logs/README.md` (actuellement non trackable car `logs/` gitignored) : soit accepter le local-only, soit ajouter `!logs/README.md` à `.gitignore` (non fait ici — hors périmètre P1).

## OÙ TROUVER MAINTENANT
- Logs racine → `logs/` (ex. `logs/cloudflared.log`, `logs/cloudflared2.log`, `logs/ngrok.log`)
- `fix_prefs*.py` → `archive/one-off-2026-10-14-fix-prefs/`
- `migration_offres_pays_financement.sql` → `archive/one-off-2026-10-14-sql/`
- Frontend entreprise → `archive/2026-10-15-frontend-entreprise/`
- Frontend tests → `archive/2026-10-15-frontend-tests/`
- Prototype new-site → `archive/2026-11-08-new-site-prototype/`
- Contrat d'archivage → `archive/README.md`
- Cette trace → `REORGANISATION-TRACE.md` (racine)

## Restauration
Fichiers trackés : `git mv` inverse (ou `git checkout HEAD -- <ancien>` après restore). `new-site/` et logs : `Move-Item` inverse. Rien n'a été supprimé.
