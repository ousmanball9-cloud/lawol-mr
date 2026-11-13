# Vision long terme — LAWOL

> Ce document est vivant. Il sera complété au fil de nos discussions entrepreneuriales.

## 1. Le problème (défini)

Dans de nombreux pays dont la Mauritanie, les étudiants et jeunes diplômés rencontrent trois difficultés majeures :
- **Accès** : difficile de trouver les bourses et stages internationaux pertinents (sources dispersées, langues, critères d'éligibilité opaques) ;
- **Postulation** : ne savent pas postuler seuls (processus fragmentés, dossiers complexes, deadlines manqués) ;
- **Suivi** : aucune visibilité sur l'état de leur candidature (relances, réponses, statut opaque).

LAWOL se positionne comme une plateforme bourses/stages 100 % dédiée aux étudiants mauritaniens (refonte « Jobteaser 100 % bourses »).

## 2. La solution LAWOL (état actuel)

- **Stack** : FastAPI + Supabase (Postgres + Storage) · Next 15 App Router + React 19
- **URL publique** : `https://lawol-mr.vercel.app` (Vercel)
- **API** : `https://lawol-api.onrender.com` (Render, plan free)
- **Charte** : « Nuit d'Indigo » — zéro noir, tokens existants uniquement
- **Règle métier clé** : catalogue 100 % bourses. Une source d'emploi ne produit jamais `bourse` → `emploi_junior` ou `stage_pfe`.
- **Canal email** : opérationnel depuis plusieurs jours (P2 validé dans les faits)

## 3. Vision à long terme (définie)

- **Cible** : bacheliers, licenciés, et tous élèves et étudiants mauritaniens
- **Horizon 6-12 mois** : plateforme fonctionnelle avec accès gratuit aux bourses, accompagnement et suivi payants ; premier seuil de réponse > 30 %
- **Horizon 1-3 ans** : plateforme et application mobile de bourse pour les Mauritaniens ; extension possible à d'autres pays (Sénégal, Mali, Côte d'Ivoire) après validation
- **Horizon 3-5 ans** : hub éducatif panafricain ou plateforme de référence pour les étudiants mauritaniens à l'étranger
- **Modèle économique** : **gratuit pour l'accès aux bourses disponibles** ; **l'accompagnement de postulation et le suivi de candidature sont payants**
- **Canaux de notification** : WhatsApp (canal principal, Meta en attente de vérification), email (opérationnel), in-app

## 4. Métriques de succès (5 KPIs retenus)

| KPI | Définition | Objectif |
|-----|------------|----------|
| **KPI 1 — North Star** | Candidatures déclarées / semaine | À définir après premier run |
| **KPI 2 — Seuil de réponse** | % d'étudiants qui lisent/répondent aux notifications | > 30 % (seuil go/no-go PRD §9) |
| **KPI 3 — Taux de conversion** | % d'étudiants qui prennent l'accompagnement payant (postulation + suivi) | À définir |
| **KPI 4 — Couverture offre** | Nombre de bourses affichées / mois | Croissance mensuelle |
| **KPI 5 — Base active** | Nombre d'étudiants inscrits actifs (opt-in + connectés) | Croissance mensuelle |

**Seuils de décision** : si KPI 2 < 30 % → problème offre/matching, pas de canal. Si KPI 2 > 30 % → continuer (Meta WhatsApp, bot).

**Tableaux de bord** : à construire après validation des 5 lots P1..P5.

## 5. Décisions structurantes déjà prises

| Date | Décision | Rationale | Statut |
|------|----------|-----------|--------|
| 06/11/2026 | Option A "Boucle de promesse" pour le prototypage | Valider l'hypothèse "un étudiant reçoit et réagit" avant ingestion de masse | En cours (P1 fait, P2 fait) |
| 16/10/2026 | Catalogue 100 % bourses (règle par source) | Éviter la confusion bourse/emploi, respecter le positionnement | Actif |
| 06/11/2026 | Modèle économique : accès gratuit, accompagnement + suivi payants | Séparer l'information (gratuite) du service (payant) | Actif |

## 6. Questions restantes pour notre discussion

1. Quels sont les **3 premiers indicateurs de succès (KPI)** que tu veux suivre ? (North Star, seuil de réponse, taux de conversion accompagnement payant…)
2. Quel **prix** envisages-tu pour l'accompagnement de postulation et le suivi ?
3. Quels **partenaires locaux** (universités, ambassades, ONG) pourraient diffuser LAWOL auprès des bacheliers et licenciés ?

---
*Ce document est le point de départ de notre réflexion entrepreneuriale. Complète-le ou pose-moi des questions pour qu'on l'enrichisse ensemble.*
