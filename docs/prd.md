# LAWOL.mr — PRD (Product Requirements Document)

**Version** : 2.0 · **Date** : 2026-10-09 · **Statut** : en cours

---

## 1. Vision

Envoyer aux étudiants mauritaniens **uniquement** les offres de stage/PFE/emploi junior qui correspondent à leur profil, directement sur WhatsApp. Zéro bruit, zéro stress.

## 2. Objectifs

| # | Objectif | Mesure | État |
|---|---|---|---|
| O1 | L'étudiant reçoit des offres **pertinentes** (matching profil ↔ offre) | Taux de pertinence > 80% | ✅ 18 matches / 40 offres |
| O2 | L'étudiant n'a **rien à faire** après l'inscription | Inscription < 2 min | ✅ via WhatsApp |
| O3 | Les entreprises peuvent publier facilement | Envoi via WhatsApp < 1 min | ⏳ S2 en cours |
| O4 | 100% gratuit, 0 donnée vendue | — | ✅ |

## 3. Fonctionnalités

### v1 (MVP — en cours)
- [x] **Inscription étudiant** : téléphone, nom, université, filière, niveau, ville, types recherchés
- [x] **Collecte d'offres** : scraper beta.mr (37 offres collectées) + API admin
- [x] **Matching** : règle pure (filière + ville + type + date) — 18 matches
- [x] **Notification WhatsApp** : envoi de messages via Meta Cloud API
- [x] **Webhook WhatsApp** : réception des messages (configuré, en attente publication app Meta)
- [x] **Dashboard admin** : login, stats, offres, profils
- [ ] **Publication app Meta** : en pause (vérification d'entreprise requise)

### v2 (plus tard)
- [ ] Envoi d'offres par les entreprises via WhatsApp (bot bidirectionnel)
- [ ] Scraping Facebook
- [ ] Matching avancé (score, mots-clés)
- [ ] Application mobile (PWA)

## 4. Règles de matching (v1)

Un match existe si :
1. Profil actif ET offre active ET offre non expirée
2. `type_offre` ∈ `types_recherches` du profil
3. `filière` du profil ∈ `filieres_cibles` de l'offre OU `filieres_interet` ∩ `filieres_cibles` ≠ ∅
4. Même ville OU l'un des deux = AUTRE

## 5. Architecture technique

| Composant | Technologie | URL |
|---|---|---|
| Frontend (landing + admin) | Next.js 15 + Tailwind | https://lawol-mr.vercel.app |
| API | FastAPI + Pydantic | https://lawol-mr-production.up.railway.app |
| Base de données | Supabase (PostgreSQL) | — |
| Bot WhatsApp | Meta Cloud API | — |
| Scraper | beta.mr (portail d'emploi) | — |

## 6. Métriques actuelles (2026-10-09)

| Métrique | Valeur |
|---|---|
| Offres actives | 40 |
| Étudiants actifs | 2 |
| Matches totaux | 18 |
| Matches notifiés | 0 |
| Taux de notification | 0% |

## 7. Contraintes techniques

- **Stack** : Next.js 15 (web) + FastAPI (API) + Supabase (PostgreSQL) + Meta WhatsApp (bot)
- **Sécurité** : RLS Supabase, service_role côté backend, Pydantic, anti-XSS (bleach), CORS restrictif
- **Budget** : 0 € (tiers gratuits uniquement)
- **Langue** : FR + AR (Mauritanie)

## 8. Hors périmètre (v1)

- Paiement / abonnement
- Application mobile native
- Matching par IA (v2)
- International (autres pays africains)
