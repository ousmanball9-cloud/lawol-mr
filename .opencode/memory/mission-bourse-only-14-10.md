# Mission : Passage à "Bourses uniquement" + Pays au lieu de Villes

**Date** : 2026-10-14
**Objectif** : Site 100% bourses d'études, pays au lieu de villes, changements visibles dans l'espace client

## Tâches

| # | Tâche | Fichiers | Statut |
|---|---|---|---|
| 1 | Backend: TypeOffre = BOURSE uniquement, Ville → PaysEtudes | models.py, engine.py, bourses.py, entreprises.py | 🔄 |
| 2 | Frontend types: supprimer VILLES, TYPES_OFFRES (sauf bourse), ajouter PAYS_ETUDES | types.ts, barre-filtres.tsx, page.tsx | ⏳ |
| 3 | Inscription: supprimer type offre, ville → pays | inscription/page.tsx | ⏳ |
| 4 | Espace client: prefs pays_favoris (déjà fait), supprimer ville | form-prefs.tsx | ⏳ |
| 5 | Scrapers: extraction pays uniquement | bourses.py, entreprises.py | ⏳ |
| 6 | Build + tests | npm run build, py_compile | ⏳ |
| 7 | Commit + push + redeploy | git, railway, vercel | ⏳ |

## Décisions
- TypeOffre = enum avec une seule valeur BOURSE
- Ville enum supprimé, remplacé par PaysEtudes partout
- Matching: filtre ville → filtre pays_etudes
- Frontend: filtres "Pays" + "Financement" uniquement
- Inscription: champ "Pays d'études visé" au lieu de Ville