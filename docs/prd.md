# LAWOL.mr — PRD (Product Requirements Document)

**Version** : 1.0 · **Date** : 2026-10-07 · **Statut** : en cours

---

## 1. Vision

Envoyer aux étudiants mauritaniens **uniquement** les offres de stage/PFE/emploi junior qui correspondent à leur profil, directement sur WhatsApp. Zéro bruit, zéro stress.

## 2. Objectifs

| # | Objectif | Mesure |
|---|---|---|
| O1 | L'étudiant reçoit des offres **pertinentes** (matching profil ↔ offre) | Taux de pertinence > 80% |
| O2 | L'étudiant n'a **rien à faire** après l'inscription | Inscription < 2 min |
| O3 | Les entreprises peuvent publier facilement | Envoi via WhatsApp < 1 min |
| O4 | 100% gratuit, 0 donnée vendue | — |

## 3. Fonctionnalités

### v1 (MVP — en cours)
- [x] **Inscription étudiant** : téléphone, nom, université, filière, niveau, ville, types recherchés
- [x] **Collecte d'offres** : API admin + scraper beta.mr
- [x] **Matching** : règle pure (filière + ville + type + date)
- [ ] **Notification WhatsApp** : envoi des matches (S2)
- [ ] **Dashboard admin** : stats, gestion offres/profils (S3)

### v2 (plus tard)
- [ ] Envoi d'offres par les entreprises via WhatsApp (bot bidirectionnel)
- [ ] Scraping Facebook
- [ ] Matching avancé (score, mots-clés)
- [ ] Application mobile (PWA)

## 4. Règles de matching (v1)

Un match existe si :
1. Profil actif ET offre active ET offre non expirée
2. `type_offre` ∈ `types_recherches` du profil
3. `filiere` du profil ∈ `filieres_cibles` de l'offre OU `filieres_interet` ∩ `filieres_cibles` ≠ ∅
4. Même ville OU l'un des deux = AUTRE

## 5. Contraintes techniques

- **Stack** : Next.js 15 (web) + FastAPI (API) + Supabase (PostgreSQL) + Meta WhatsApp (bot)
- **Sécurité** : RLS Supabase, service_role côté backend, Pydantic, anti-XSS (bleach), CORS restrictif
- **Budget** : 0 € (tiers gratuits uniquement)
- **Langue** : FR + AR (Mauritanie)

## 6. Hors périmètre (v1)

- Paiement / abonnement
- Application mobile native
- Matching par IA (v2)
- International (autres pays africains)
