# Prototypage LAWOL — « Boucle de promesse » (Option A)

> But : valider l'hypothèse non prouvée du PRD — **« un étudiant reçoit une notification et réagit »** — avant d'investir dans l'ingestion de masse.
> North Star : candidatures déclarées / semaine. Seuil de décision PRD §9 : > 30 % de réponse → continuer (Meta, bot) ; < 30 % → problème offre/matching, pas de canal.

## Contexte (état mesuré, pas supposé)

- **0 notification jamais délivrée** (0 %) — Meta bloqué (vérification entreprise en cours).
- La tuyauterie est déjà là : `whatsapp/{webhook,sender,notifier,textes}.py`, `notifications/{canal.py,email_sender*.py,resume_hebdo.py}`, anti-spam hebdo `MAX_MATCHES_PAR_SEMAINE`, opt-in lisible (`optin_at`/`optin_texte`).
- Ce qui manque : **preuve live d'un envoi + mesure**.

## Règles non négociables (AGENTS.md — rappel)

1. Tout nouvel endpoint `/api/v1/*` exige sa route proxy Next locale + relais `Authorization` (admin : cookie `lawol_admin` + `x-admin-token` + `Authorization`).
2. **Zéro migration SQL** : colonnes additionnelles via `profils.metadata` (jsonb).
3. Tous les endpoints du profil sont gardés (`garde_profil`, `session_profil`, `_admin_autorise`). Bucket Storage = privé.
4. Pas de build courant : `py_compile` + `ruff` (API) et `tsc --noEmit` + `eslint` (web).
5. Harnais `test-*.py` avant commit + preuve live `verify-*.mjs` après déploiement.
6. Catalogue 100 % bourses (règle par source : `emploi_junior` ou `stage_pfe`, jamais `bourse` pour une source d'emploi).
7. Jamais `lawol.mr` comme URL fonctionnelle (DNS = NXDOMAIN). URL publique : `https://lawol-mr.vercel.app`.

## Plan — 5 lots bornés, ordre strict

| Lot | Titre | Durée | Dépend de |
|-----|-------|-------|-----------|
| P1 | État des lieux mesuré | 1 h | — |
| P2 | Preuve du canal email en live | 2 h | P1 |
| P3 | Opt-in, anti-spam et STOP tracés | 2 h | P2 |
| P4 | Run en prod + première métrique | 1,5 h | P2 |
| P5 | WhatsApp manuel + seuil de décision | 1,5 h | P4 |

**Dépendance stricte** : P4 exige P2 (on ne mesure pas un canal non prouvé).

---

## Livrables attendus

### P1 — `scripts/couverture-notifications.py` + ce document

Fichiers créés :
- `scripts/couverture-notifications.py` — modes `--self-test` (mock, zéro réseau) + `--supabase` (réel)
- `docs/prototypage-promesse.md` — ce document (plan + contraintes)

Compteurs mesurés :
- Profils actifs, avec `optin_at` présent, avec email valide
- Matches `notifie=false` (en attente d'envoi)
- Distribution des scores de matching (proxy de pertinence)
- Présence des vars `SMTP_*` / `META_WHATSAPP_*` (noms seulement, jamais les valeurs)

Contrôle négatif : 3 pièges injectés doivent faire tomber le harnais (ex. : validateur qui confond "présent" et "conforme").

---

### P2 — Preuve du canal email en live

Fichier : `scripts/verify-envoi-live.py` (mode `--live`, 1 destinataire de test)

Vérification :
- 1 notification réelle envoyée par le chemin de prod
- `matches.notifie = true` en base après envoi
- Contrôle négatif : destinataire invalide → harnais KO
- Zéro modification de règle de matching

---

### P3 — Opt-in, anti-spam, STOP

Fichiers : `apps/api/app/modules/whatsapp/notifier.py`, `apps/api/app/modules/matching/engine.py`, `scripts/test-notifications.py` (étendu)

Vérifications (tests `test-*.py` verts + contrôles négatifs sur chacune des 3 règles) :
- (a) Seuls les profils `optin_at` présent sont notifiés
- (b) `actif=false` (STOP/désinscription) bloque tout envoi
- (c) Quota hebdo `MAX_MATCHES_PAR_SEMAINE` s'applique
- Zéro migration SQL (tout en `metadata` jsonb)

---

### P4 — Run en production + première métrique

Fichier : `apps/web/app/api/v1/notifications/run/route.ts` (proxy Next, relais `Cookie lawol_admin` + `x-admin-token` + `Authorization`)

Vérifications :
- 401 sans identité valide
- 403 ancien cookie
- 200 avec identité valide (garde `_admin_autorise` en 1ʳᵉ instruction)
- Preuve live `verify-live-public.mjs` vert après déploiement

---

### P5 — WhatsApp manuel + seuil de décision

Fichier : `docs/prototypage-promesse.md` (section runbook, à compléter)

- Envoi manuel des 3 meilleures offres aux étudiants de la cohorte (numéro classique, en attendant la vérification Meta)
- Comptage des réponses
- **Seuil PRD écrit** : > 30 % → continuer ; < 30 % → problème offre/matching

---

## Gates communs à chaque lot

- `py_compile` + `ruff check` (API) · `npx tsc --noEmit` + `npx eslint` (web)
- `scripts/test-*.py` avant chaque commit
- Aucun nouvel endpoint sans proxy Next
- Aucune colonne SQL (tout en `metadata` jsonb)
- Aucun build dans les tâches courantes
