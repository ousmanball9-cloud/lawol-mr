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
- 1 notification réelle envoyée par le chemin de prod (`canal.py` -> `email_sender`, SMTP)
- `matches.notifie = true` en base après envoi
- Contrôle négatif : destinataire invalide → harnais KO (code de sortie != 0)
- Zéro modification de règle de matching
- Aucun secret affiché (noms de variables SMTP uniquement)

#### Configuration SMTP_* (Railway / Vercel)

Les vars SMTP ne sont jamais committées. Elles se définissent dans les dashboards :

**Railway (API, `apps/api`) — variables d'environnement du service :**
- `SMTP_HOST` — hôte SMTP (ex. `smtp.gmail.com`)
- `SMTP_PORT` — port (défaut `587` → STARTTLS ; `465` → SSL implicite)
- `SMTP_USER` — identifiant SMTP (optionnel si relayage autorisé)
- `SMTP_PASSWORD` — mot de passe SMTP (secret, jamais en dur)
- `EMAIL_FROM` — adresse expéditeur (doit être validée chez le provider)
- `EMAIL_FROM_NAME` — nom affiché (défaut `LAWOL.mr`)

En local, ces mêmes vars vivent dans `.env` (git-ignoré, jamais committé ; noms listés dans `.env.example`).

**Vercel (front) :** aucune var SMTP côté front (l'API est hébergée sur Railway). Ne pas dupliquer `SMTP_*` côté Vercel.

#### Execution du test live

```
python -X utf8 scripts/verify-envoi-live.py --live --dest etudiant@exemple.mr [--match-id <uuid>]
```

- `--live` : obligatoire, déclenche l'envoi veritable.
- `--dest` : email du destinataire de test (doit correspondre a un `profils.email` en base).
- `--match-id` : ID d'un match `notifie=false` a notifier (optionnel ; sinon le plus ancien non notifie du profil est selectionne).

Pre-condition : les vars `SMTP_*` doivent etre presentes. Si elles manquent, le script arrete et liste les **noms** de vars manquantes (jamais leurs valeurs), et rend un code != 0.

#### Ce qui constitue une preuve valide

Une preuve P2 valide = le script termine avec code de sortie 0 et affiche les deux checks suivants en vert :
1. `email accepte par le canal de prod (pas d'erreur SMTP)` — l'email est bien parti par `canal.py` -> `email_sender`.
2. `matches.notifie = true confirme en base` — la re-lecture de la ligne `matches` confirme le marquage.

Si l'un des deux est KO, ou si le destinataire est invalide (controle négatif), le harnais rend code != 0 : preuve non valide.

**Signaler** : si `SMTP_*` n'est pas configurable dans l'environnement cible (dashboard Railway/Vercel ou `.env` local), le test live est impossible sans vars reelles — le script arrete et liste les noms de vars manquantes.

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

### P5 — Email manuel + seuil de décision (WhatsApp non prêt)

Fichier : `docs/prototypage-promesse.md` (section runbook, à compléter)

- WhatsApp non prêt (Meta bloqué, pas de vérification entreprise) → **l'email est le canal de mesure pour P5**
- Envoi manuel des 3 meilleures offres aux étudiants de la cohorte par email (canal déjà opérationnel, P2 validé)
- Comptage des réponses (lectures, clics, réponses email)
- **Seuil PRD écrit** : > 30 % → continuer (activer WhatsApp quand prêt, puis bot) ; < 30 % → problème offre/matching, pas de canal
- Préparer le runbook WhatsApp pour activation ultérieure (dès que Meta vérifie)

---

## Gates communs à chaque lot

- `py_compile` + `ruff check` (API) · `npx tsc --noEmit` + `npx eslint` (web)
- `scripts/test-*.py` avant chaque commit
- Aucun nouvel endpoint sans proxy Next
- Aucune colonne SQL (tout en `metadata` jsonb)
- Aucun build dans les tâches courantes
