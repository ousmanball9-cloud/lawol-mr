# LAWOL.mr — PRD (Product Requirements Document)

**Version** : 3.0 · **Date** : 2026-10-09 · **Statut** : en cours

---

## 1. Vision

Envoyer aux étudiants mauritaniens **uniquement** les offres de stage/PFE/emploi junior/bourse qui correspondent à leur profil. **WhatsApp = canal de notification**, pas d'inscription. L'inscription se fait sur le web.

## 2. Objectifs

| # | Objectif | Mesure | État réel |
|---|---|---|---|
| O1 | L'étudiant reçoit des offres **pertinentes** | Taux de pertinence > 80% | ❌ jamais mesuré (2 étudiants) |
| O2 | L'étudiant s'inscrit en < 2 min | Formulaire web | ⏳ à faire |
| O3 | Les entreprises peuvent publier facilement | Envoi via WhatsApp < 1 min | ⏳ v2 |
| O4 | 100% gratuit, 0 donnée vendue | — | ✅ |

## 3. Fonctionnalités — ÉTAT RÉEL (audit 2026-10-09)

### ✅ Fonctionne
- [x] **Scraper beta.mr** : 37 offres collectées
- [x] **Matching** : règle pure (filière + ville + type + date) — 18 matches
- [x] **Dashboard admin** : login, stats, offres, profils
- [x] **Site web** : landing + pages légales (Vercel)

### ⏳ À faire (priorité haute)
- [ ] **Inscription web** : formulaire + opt-in explicite (stocké : `optin_at`, `optin_texte`)
- [ ] **Webhook parsing** : traiter les messages WhatsApp (inscription, MAJ, STOP)
- [ ] **Sender conforme** : templates Meta (pas de texte libre) + fenêtre 24h
- [ ] **Sécurité** : authentifier `GET /messages`, traiter STOP, anti-spam (max N notifs/semaine)

### ⏸️ Bloqué
- [ ] **Publication app Meta** : vérification d'entreprise requise (pas de budget)
- [ ] **Bot conversationnel** : à faire après 100 étudiants actifs

### ❌ Jamais délivré
- [ ] **Notification envoyée** : 0 notification (0%) — le produit n'a jamais délivré sa promesse centrale

## 4. Parcours utilisateur (correct)

```
1. L'étudiant va sur https://lawol-mr.vercel.app
2. Remplit le formulaire (téléphone, nom, université, filière, niveau, ville, types recherchés)
3. Case à cocher opt-in explicite → stocké en base
4. Reçoit les offres matchées sur WhatsApp (si app Meta publiée)
   OU consulte les offres sur le web
5. Peut se désinscrire (STOP ou bouton web)
```

## 5. Règles de matching (v1)

Un match existe si :
1. Profil actif ET offre active ET offre non expirée
2. `type_offre` ∈ `types_recherches` du profil
3. `filière` du profil ∈ `filieres_cibles` de l'offre OU `filieres_interet` ∩ `filieres_cibles` ≠ ∅
4. Même ville OU l'un des deux = AUTRE

**À améliorer** : score réel (fraîcheur, exactitude), limite anti-spam, déduplication.

## 6. North Star

⭐ **Candidatures déclarées / semaine** (bouton "J'ai postulé")
> Un match non lu, non cliqué, non postulé vaut zéro.

## 7. Architecture technique

| Composant | Technologie | URL | État |
|---|---|---|---|
| Frontend | Next.js 15 + Tailwind | https://lawol-mr.vercel.app | ✅ |
| API | FastAPI + Pydantic | https://lawol-mr-production.up.railway.app | ✅ |
| Base de données | Supabase (PostgreSQL) | — | ✅ |
| Bot WhatsApp | Meta Cloud API | — | ⏸️ bloqué (vérification) |
| Scraper | beta.mr | — | ✅ |

## 8. Risques majeurs (audit Diablo)

| # | Risque | Sévérité |
|---|---|---|
| R1 | Webhook vide (pas de parsing) | 🔴 critique |
| R2 | Sender non conforme (texte libre) | 🔴 critique |
| R3 | Pas d'opt-in traçable | 🔴 critique |
| R4 | Endpoint debug exposé (fuite données) | 🟠 high |
| R5 | Matching non scalable | 🟠 high |
| R6 | Offre sans demande (40 offres, 2 étudiants) | 🟠 high |
| R7 | Dépendance mono-source (beta.mr) | 🟡 medium |

## 9. Plan d'action (2 semaines, 0 €)

1. **Formulaire d'inscription web** + opt-in → 20 vrais étudiants
2. **Notification manuelle WhatsApp** des 3 meilleures offres (numéro classique)
3. **Mesurer** taux de lecture/réponse
4. Si > 30% de réponse → continuer. Si < 30% → le problème est l'offre ou le matching.
