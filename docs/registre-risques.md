# Registre des risques — LAWOL.mr

> Document vivant. Analyse critique du produit (2026-10-11). Chaque risque a un
> **statut** : 🔴 ouvert · 🟠 atténué · ✅ résolu. À mettre à jour à chaque lot
> ou incident. Sert de tableau de bord « qu'est-ce qui peut nous faire échouer ».

## 🔴 Bloqueurs (empêchent le produit de « vivre » publiquement)

| # | Risque | Statut | Impact | Action |
|---|--------|--------|--------|--------|
| 1 | **Site public MORT** — `lawol.mr` = NXDOMAIN (vérifié 11/10 : le domaine ne pointe nulle part). Le produit est **inaccessible** aux étudiants. | 🔴 ouvert | Total | Pointer le DNS vers Vercel (NS `ns1/ns2.vercel-dns.com` ou A `76.76.21.21` + CNAME `www`). **Utilisateur seul.** |
| 2 | **Canal de livraison mort** — WhatsApp Meta **401**. Les alertes (Lot C y compris) sont **théoriques** : rien n'arrive au destinataire. | 🔴 ouvert | Total | Rétablir le token WhatsApp **ou** brancher un fallback email (Lot E). Code déjà canal-agnostique. |

## 🟠 Fiabilité (ça casse ou trompe l'utilisateur)

| # | Risque | Statut | Impact | Action |
|---|--------|--------|--------|--------|
| 3 | **Scrapers fragiles** — 7 sources dépendantes du HTML/WP de tiers. Un changement de template = perte **silencieuse** d'une source. | 🔴 ouvert | Moyen | Alerting « source morte » (nb offres = 0 sur N runs). |
| 4 | **Dates estimées** (repli `today+60`) — dates potentiellement **fausses**. Lot B atténué mais des estimées persistent. | 🟠 atténué | Moyen | Purger/flagger `date_estimee` ; badge « à confirmer » côté UI. |
| 5 | **Matching trop large** — bourses génériques « toutes filières » saturaient l'étudiant (20 bourses hors-filière). | ✅ **résolu (Lot D, 11/10)** | — | **Livré + vérifié** : `est_bourse_generique()` + bonus réduit + quota ≤ 3 génériques/profil. Preuve : top-5 passe de 5/5 génériques → 0. |
| 6 | **Fraîcheur limitée** — collecte 2×/jour : bourses/rappels parfois en retard. | 🔴 ouvert | Faible | Fréquencer (si coût le permet) ou accepter. |

## 🟡 Dette / continuité (invisible, dangereux)

| # | Risque | Statut | Impact | Action |
|---|--------|--------|--------|--------|
| 7 | **Base de données de prod NON sauvegardée** — on a sauvé le **code** (GitHub) mais pas la **base** (offres, profils, état des seuils Lot C). | 🔴 ouvert | Fort | Vérifier les backups Railway ; si absents, en configurer. |
| 8 | **Observabilité nulle** — rien ne signale une panne du prod. | 🔴 ouvert | Moyen | Health-check + alerte (source morte / API hors ligne). |
| 9 | **Tests « à la demande », pas en CI** — harnais existent (ex. 15/15 Lot C/D) mais ne tournent pas à chaque commit. | 🟠 atténué | Moyen | Brancher les harnais dans GitHub Actions. |
| 10 | **Free tier (Vercel/Railway)** — cold starts, limits, pas de SLA. | 🔴 ouvert | Faible | Accepter ou upgrader plus tard. |

## 🔴 Sécurité (inconnu = risque)

| # | Risque | Statut | Impact | Action |
|---|--------|--------|--------|--------|
| 11 | **Jamais auditée en profondeur** — auth, endpoints publics, **données d'étudiants**, secrets. | 🔴 ouvert | Fort | `security-review` **avant toute ouverture publique**. |

## 🔵 Limites produit (volontaires mais réelles)

| # | Risque | Statut | Impact | Action |
|---|--------|--------|--------|--------|
| 12 | Mono-sujet bourses (stages/emplois en veille — Lot F). | 🔴 ouvert (volontaire) | Stratégique | Réévaluer après Lot E. |
| 13 | Dépendance aux **agrégateurs tiers** — anti-scraping / disparition = perte de catalogue. | 🔴 ouvert | Fort | Diversifier (sources officielles) + stock local résilient. |
| 14 | **Bus factor = 1** (utilisateur + Ciel) — aucune redondance humaine. | 🔴 ouvert | Fort | Documentation + sauvegardes (code ✔, base ✘, config). |

---

## ⚡ Plan d'action prioritaire
1. **DNS → Vercel** (#1) — rend le site **existant**.
2. **Canal** (#2) — rend le produit **vivant** (les alertes Lot C existent déjà, elles attendent juste le canal).
3. **Backup base de données** (#7) — protège la **continuité**.
4. **Security-review** (#11) — avant ouverture.
5. **Monitoring** (#3, #8) — fiabilité de confiance.

## 📝 Historique
- **2026-10-11** : création (14 risques). **Lot C/D livrés** : #5 corrigé (matching), Lot C codé mais **bloqué par #2** (canal mort). #1 vérifié mort (NXDOMAIN).
