# Brief P5-A — Backend : dashboard client, favoris, candidatures, préférences

Objectif : exposer l'API du futur espace client enrichi (page d'accueil avec
résumé hebdo + compteur « offres par poste cette année », favoris, statut de
candidature enrichi, historique, préférences avancées).

## 1. `GET /api/v1/dashboard/{telephone}` — résumé hebdo

Réponse (404 si profil introuvable) :
```json
{
  "profil": { "id": "uuid", "nom": "...", "prenom": "...", "score_profil": 75 },
  "resume": {
    "offres_dispo": 12,      // matches: postule=false + offre active + date_limite >= today
    "nouvelles_7j": 3,       // matches: date_match >= today - 7 jours
    "postules_total": 8,     // matches: postule=true
    "en_cours": 2            // statut_candidature non nul et non terminé (pas accepte/refuse)
  },
  "postes_annee": [          // offres créées depuis le 1er janvier de l'année en cours,
    { "poste": "Développeur", "count": 14 },   // filtrées sur filière principale +
    { "poste": "Comptable", "count": 6 }       // filieres_interet + types_recherches du profil
  ]
}
```
- `score_profil` : % de complétion simple et documenté (ex : email +20,
  filieres_interet non vide +20, types_recherches >1 +20, optin +20,
  universite/niveau/ville toujours remplis +20 → plafond 100).
- `postes_annee` : charger les offres éligibles de l'année (`.gte("created_at", f"{annee}-01-01")`)
  et **grouper en Python** avec une fonction `extract_poste(titre)` (dict de
  mots-clés FR : développeur, comptable, ingénieur, technicien, commercial,
  data/analyste, marketing, juriste, médecin, enseignant, assistant,
  électricien, mécanicien, consultant… → sinon « Autre »). **Zéro migration**
  pour cet agrégat, calcul à la volée.

## 2. Favoris (enregistrer une offre)

- Migration idempotente : `alter table matches add column if not exists favori boolean default false;`
- `PATCH /api/v1/matches/{match_id}/favori` body `{"favori": true|false}`.

## 3. Statut de candidature enrichi

- Migration idempotente :
  `alter table matches add column if not exists statut_candidature text;`
  (valeurs attendues : `postule`, `en_cours`, `reponse_recue`, `entretien`,
  `accepte`, `refuse` — nullable = pas encore de statut. Pas de CHECK pour
  rester évolutif ; validation côté Pydantic.)
- `PATCH /api/v1/matches/{match_id}/statut` body `{"statut": "entretien" | null}`.
- `GET /api/v1/profils/{telephone}/historique` : matches du profil (tri
  `date_match` desc) avec offre étendue (comme /matches) + `favori` +
  `statut_candidature` + `postule`.

## 4. Préférences avancées

- `PATCH /api/v1/profils/{telephone}/preferences` body partiel
  `{"villes_exclues": ["nouadhibou"], "types_masques": ["stage_ete"],
    "seuil_pertinence": 60}` → stocké dans `profils.metadata` sous clé
  `prefs_avancees` (jsonb existant, **pas de migration**).
- **Matching engine** (`modules/matching/engine.py`) : appliquer les prefs —
  exclure les villes listées, sauter les types masqués, rejeter les matches
  sous le seuil. Prefs absentes = comportement actuel inchangé.

## 5. Résilience (règle D8 — IMPÉRATIF)

Si les colonnes `favori`/`statut_candidature` n'existent pas encore (erreur
SQL « column not found »), l'API doit **répondre en fallback** (favori=false,
statut=null, écritures en 503 clair) au lieu de 500. Le code tourne avant
comme après application de la migration.

## 6. Livrables migration

Écrire `infra/supabase/migrations/002_p5.sql` avec les deux `alter table`
idempotents (même style que les migrations précédentes du schema.sql).

## 7. Vérifications OBLIGATOIRES (liste résultats honnêtes)

1. API locale uvicorn (127.0.0.1:8000) démarrée : `GET /health` ok.
2. **Tests réels** de chaque nouvel endpoint (httpx/curl) avec un profil de
   test existant ou créé : dashboard 200 + payload conforme, 404 téléphone
   inconnu, favori PATCH ok, statut PATCH ok + validation (statut invalide →
   422), historique 200, preferences PATCH ok, fallback sans colonnes.
3. Le matching engine existant ne régresse pas : `POST /api/v1/matching/run`
   s'exécute sans erreur.
4. Nettoyage : supprimer les données de test créées (règle workspace).

## 8. Garde-fous

- Pas de git. Ne touche à **aucun** fichier apps/web (un agent y travaille).
- Ne casse aucun endpoint existant. Pydantic : validation stricte (patterns).
- Pas de secret dans le code ; la clé service reste en env.
