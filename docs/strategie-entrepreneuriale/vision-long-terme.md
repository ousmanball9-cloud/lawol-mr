# Vision long terme — LAWOL

> Ce document est vivant. Il sera complété au fil de nos discussions entrepreneuriales.

## 1. Le problème (à affiner ensemble)

Dans de nombreux pays dont la Mauritanie, les étudiants et jeunes diplômés rencontrent des difficultés à :
- **Trouver** des bourses et stages internationaux pertinents ;
- **Postuler** simplement (dispersion des sources, langues, critères d'éligibilité) ;
- **Suivre** leurs candidatures (relances, deadlines, réponses).

LAWOL se positionne comme une plateforme bourses/stages 100 % dédiée aux étudiants mauritaniens (refonte « Jobteaser 100 % bourses »).

## 2. La solution LAWOL (état actuel)

- **Stack** : FastAPI + Supabase (Postgres + Storage) · Next 15 App Router + React 19
- **URL publique** : `https://lawol-mr.vercel.app` (Vercel)
- **API** : `https://lawol-mr-production.up.railway.app` (Railway)
- **Charte** : « Nuit d'Indigo » — zéro noir, tokens existants uniquement
- **Règle métier clé** : catalogue 100 % bourses. Une source d'emploi ne produit jamais `bourse` → `emploi_junior` ou `stage_pfe`.

## 3. Vision à long terme (en cours de définition)

À compléter ensemble :

- [ ] **Horizon 6-12 mois** : quel usage quotidien ? quel North Star (ex. candidatures déclarées/semaine) ?
- [ ] **Horizon 1-3 ans** : quels pays additionnels ? quels types d'offres (bourses → stages → emplois juniors → formation) ?
- [ ] **Horizon 3-5 ans** : quelle place LAWOL occupe-t-il dans l'écosystème éducatif mauritanien et africain ?
- [ ] **Modèle économique** : freemium, abonnement, sponsoring institutions, frais de mise en relation ?
- [ ] **Canaux de notification** : WhatsApp (canal principal, Meta en attente de vérification), email (filet de sécurité), in-app.

## 4. Métriques de succès (à définir)

À compléter : KPIs principaux, seuils de décision, tableaux de bord.

## 5. Décisions structurantes déjà prises

| Date | Décision | Rationale | Statut |
|------|----------|-----------|--------|
| 06/11/2026 | Option A "Boucle de promesse" pour le prototypage | Valider l'hypothèse "un étudiant reçoit et réagit" avant ingestion de masse | En cours (P1 fait, P2 en cours) |
| 16/10/2026 | Catalogue 100 % bourses (règle par source) | Éviter la confusion bourse/emploi, respecter le positionnement | Actif |

## 6. Questions ouvertes pour notre discussion

1. Quel est le **problème exact** que tu veux résoudre aujourd'hui avec LAWOL ?
2. Qui est **vraiment l'utilisateur cible** (étudiant en licence ? master ? jeune diplômé ?) ?
3. Quelle est la **vision à 3 ans** : rester une plateforme bourses mauritanienne, ou devenir un hub éducatif panafricain ?
4. Quel **modèle économique** envisages-tu pour rendre le projet durable ?
5. Quels sont les **3 premiers indicateurs** de succès que tu veux suivre ?

---
*Ce document est le point de départ de notre réflexion entrepreneuriale. Complète-le ou pose-moi des questions pour qu'on l'enrichisse ensemble.*
