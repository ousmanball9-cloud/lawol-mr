# LAWOL.mr — Métriques & KPIs

## North Star Metric

⭐ **Matches envoyés / semaine**
> Nombre de messages WhatsApp envoyés aux étudiants avec une offre matchée.

## Métriques secondaires

| Catégorie | Métrique | Cible v1 | Mesure |
|---|---|---|---|
| **Acquisition** | Étudiants inscrits | 50 | API |
| **Acquisition** | Entreprises ayant publié | 10 | API |
| **Activation** | Profils complets / inscrits | > 80% | API |
| **Engagement** | Matches / étudiant / semaine | 1-3 | API |
| **Engagement** | Taux de réponse aux messages | > 30% | WhatsApp |
| **Rétention** | Étudiants actifs à J+30 | > 40% | API |
| **Supply** | Offres collectées / semaine | > 20 | Scraper |
| **Qualité** | Taux de pertinence des matches | > 80% | Feedback |

## Tableau de bord (S3)

Le dashboard admin affichera :
- North Star (matches/semaine) avec courbe
- Inscriptions par jour
- Offres par source (beta.mr, manuel, WhatsApp)
- Top filières demandées
- Top villes

## Revue hebdomadaire

Chaque semaine : North Star + 3 métriques secondaires → décision (pivoter / persister / arrêter).
