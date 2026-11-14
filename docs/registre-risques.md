# Registre des risques — LAWOL.mr

> Document vivant. Analyse critique du produit (2026-10-11). Chaque risque a un
> **statut** : 🔴 ouvert · 🟠 atténué · ✅ résolu. À mettre à jour à chaque lot
> ou incident. Sert de tableau de bord « qu'est-ce qui peut nous faire échouer ».

## ÉTAT DU SITE (vérifié 2026-10-11)
- **Site EN LIGNE** sur `https://lawol-mr.vercel.app` → HTTP 200, chrome Jobteaser
  (nav « Offres ») présent = **nouveau design déployé**. ✅
- **`lawol.mr` n'a JAMAIS été acheté** (NXDOMAIN = normal, pas une panne). Ce n'est
  **pas un blocage** : c'est un nom de domaine **optionnel et payant**, à prendre
  plus tard si on veut une adresse jolie (un `.com` coûterait moins cher qu'un `.mr`).

## 🔴 BLOQUEURS (empêchent le produit de « vivre » publiquement)

| # | Risque | Statut | Impact | Action |
|---|--------|--------|--------|--------|
| 1 | **Canal de livraison mort** — WhatsApp Meta **401**. Les alertes (Lot C y compris) sont **théoriques** : rien n'arrive au destinataire. | 🔴 ouvert | Total | Rétablir le token WhatsApp **ou** brancher un fallback email (Lot E). Code déjà canal-agnostique. |

## 🟠 Fiabilité (ça casse ou trompe l'utilisateur)

| # | Risque | Statut | Impact | Action |
|---|--------|--------|--------|--------|
| 2 | **Scrapers fragiles** — 7 sources dépendantes du HTML/WP de tiers. Un changement de template = perte **silencieuse** d'une source. | 🔴 ouvert | Moyen | Alerting « source morte » (nb offres = 0 sur N runs). |
| 3 | **Dates estimées** (repli `today+60`) — dates potentiellement **fausses**. Lot B atténué mais des estimées persistent. | 🟠 atténué | Moyen | Purger/flagger `date_estimee` ; badge « à confirmer » côté UI. |
| 4 | **Matching trop large** — bourses génériques « toutes filières » saturaient l'étudiant (20 bourses hors-filière). | ✅ **résolu (Lot D, 11/10)** | — | **Livré + vérifié** : `est_bourse_generique()` + bonus réduit + quota ≤ 3 génériques/profil. Preuve : top-5 passe de 5/5 génériques → 0. |
| 5 | **Fraîcheur limitée** — collecte 2×/jour : bourses/rappels parfois en retard. | 🔴 ouvert | Faible | Fréquencer (si coût le permet) ou accepter. |

## 🟡 Dette / continuité (invisible, dangereux)

| # | Risque | Statut | Impact | Action |
|---|--------|--------|--------|--------|
| 6 | **Base de données de prod NON sauvegardée** — on a sauvé le **code** (GitHub) mais pas la **base** (offres, profils, état des seuils Lot C). | 🔴 ouvert | Fort | Vérifier les backups Railway ; si absents, en configurer. |
| 7 | **Observabilité nulle** — rien ne signale une panne du prod. | 🔴 ouvert | Moyen | Health-check + alerte (source morte / API hors ligne). |
| 8 | **Tests « à la demande », pas en CI** — harnais existent (ex. 15/15 Lot C/D) mais ne tournent pas à chaque commit. | 🟠 atténué | Moyen | Brancher les harnais dans GitHub Actions. |
| 9 | **Free tier (Vercel/Railway)** — cold starts, limits, pas de SLA. | 🔴 ouvert | Faible | Accepter ou upgrader plus tard. |

## 🔴 Sécurité (inconnu = risque)

| # | Risque | Statut | Impact | Action |
|---|--------|--------|--------|--------|
| 10 | **Jamais auditée en profondeur** — auth, endpoints publics, **données d'étudiants**, secrets. | 🔴 ouvert | Fort | `security-review` **avant toute ouverture publique**. |

## 🔵 Limites produit (volontaires mais réelles)

| # | Risque | Statut | Impact | Action |
|---|--------|--------|--------|--------|
| 11 | **Pas de nom de domaine perso** — le site vit en `.vercel.app` (gratuit, URL longue). `lawol.mr` jamais acheté. | 🟠 option | Cosmétique | Si on veut une jolie URL : acheter un domaine (`.com` < `.mr`) puis pointer vers Vercel. |
| 12 | Mono-sujet bourses (stages/emplois en veille — Lot F). | 🔴 ouvert (volontaire) | Stratégique | Réévaluer après Lot E. |
| 13 | Dépendance aux **agrégateurs tiers** — anti-scraping / disparition = perte de catalogue. | 🔴 ouvert | Fort | Diversifier (sources officielles) + stock local résilient. |
| 14 | **Bus factor = 1** (utilisateur + Ciel) — aucune redondance humaine. | 🔴 ouvert | Fort | Documentation + sauvegardes (code ✔, base ✘, config). |

---

## ⚡ Plan d'action prioritaire (corrigé 11/10)
1. **Canal** (#1) — rend le produit **vivant** (les alertes Lot C existent déjà, elles attendent juste le canal).
2. **Backup base de données** (#6) — protège la **continuité** (le code est sauvé, la base non).
3. **Security-review** (#10) — avant ouverture publique.
4. **Monitoring** (#2, #7) — fiabilité de confiance.
5. **Domaine perso** (#11) — optionnel, à budgéter plus tard.

## 📝 Historique
- **2026-10-11** : création (14 risques). **Lot C/D livrés** : #4 corrigé (matching), Lot C codé mais **bloqué par #1** (canal mort).
- **2026-10-11 (correction)** : vérifié que le **site est EN LIGNE** sur `lawol-mr.vercel.app` (HTTP 200, nouveau chrome). **`lawol.mr` n'a jamais été acheté** (l'utilisateur n'a payé aucun domaine) → ce n'était **pas** un « site mort » mais un nom non acquis. Risque déplacé de « bloqueur » à « limite optionnelle » (#11). Le vrai bloqueur restant = le **canal** (#1).

## MISE A JOUR 2026-11-14 (revue du 14/11, apres bascule d'hebergeur)

| # | Risque | Statut | Criticite | Reponse |
|---|---|---|---|---|
| 14 | Hebergeur unique sur plan **free sans SLA** (Render) : reveil 30-90 s apres 15 min d'inactivite, suspension possible | ouvert (accepte) | elevee | Fiche CC-2026-001 (`docs/strategie-entrepreneuriale/maitrise-changement-render.md`) : surveillance `/health/ready`, jamais appliquer `render.yaml` (doublon = 750 h/mois divisees), mesure du reveil en V5-B |
| 15 | **Credentials SMTP absents depuis le 10/11** : aucune notification ne peut partir, donc aucun seuil de reponse mesurable | ouvert, **date limite lundi 23/11** | elevee | CANAL-E ne demarre pas sans eux ; apres le 23/11, M4 glisse au 14/12 et l'ouverture G1 se fait avec un canal manuel assume (`docs/calendrier-2026-11.md` section 5) |
| 16 | **Base production sans backup verifiable** : 0 backup constate le 14/10, et depuis le 14/11 le token MCP Supabase est **invalide** (`Invalid access token`) donc plus aucun controle automatique (sante, logs, backups) | ouvert, **aggrave** | elevee | Lot BACKUP (1 h) a planifier ; fournir un nouveau token Supabase, puis re-mesurer le statut reel avant de declarer le risque ferme |
| 17 | Token MCP Supabase invalide : perte de la capacite de controle (lecture seule) de la base en session | ouvert | moyenne | Renouveler le token cote utilisateur ; en attendant, aucune affirmation sur l'etat de la base ne doit etre presentee comme mesuree |

Correction de perimetre : le risque #6 (base non sauvegardee) reste **ouvert** et n'est plus re-verifiable
automatiquement - il est repris en #16 avec sa cause.
