# Brief Bourses — finir le pipeline « bourses d'études »

Priorité utilisateur : **finir les bourses d'études avant tout**. Audit fait :
le type bourse existe partout (enum, inscription, modale, badges, matching)
MAIS **aucune source ne collecte de bourses** → un étudiant qui coche
« bourse » ne recevra jamais rien. Le trou est côté scrapers + visibilité.

## 1. Scraper de bourses (PIÈCE MAÎTRESSE)

Créer `apps/api/app/modules/scraper/sources/bourses.py` en suivant
**exactement** le pattern de `beta_mr.py` (BaseScraper, fetch() → yield
OffreStageCreate, erreurs isolées par source) et l'enregistrer dans
`catalogue.py` (SPECIFIQUES).

Sources à implémenter (VÉRIFIER la disponibilité réelle avec webfetch AVANT
d'écrire les selectors, et s'adapter au HTML observé) :
- Aggrégateurs de bourses internationales ouvertes aux étudiants
  africains/mauritaniens (ex : opportunitycorner.com, scholarshipscorner
  ou équivalents fonctionnels trouvés — priorité à des pages simples et
  stables). Filtrer par mots-clés : Mauritanie/Africa/African + master /
  bachelor / PhD / undergraduate.
- 2 à 3 sources maximum — la qualité résiliente vaut mieux que la quantité.

Mapping vers OffreStageCreate :
- `type_offre=TypeOffre.BOURSE`, `source=SourceType.AUTRE`,
  `source_name` = nom du portail (ex "opportunities-corner").
- `titre` = titre de la bourse, `entreprise` = organisme financeur (ou nom
  du portail si absent), `description` = résumé + critères.
- `date_limite` : parser la date de clôture (FR/EN, formats variés) ;
  **fallback : today + 60 jours** (jamais une date passée — Pydantic refuse).
- `source_url` : URL unique de la bourse (clé d'idempotence upsert).
- `filieres_cibles` : inférer par mots-clés (informatique/finance/gestion…),
  sinon `[]` — **vérifier dans engine.py le comportement des offres à
  filieres vides** et s'assurer qu'elles peuvent matcher un étudiant
  (si le engine les exclut, mettre la liste complète des filières).
- `contact_email`/`contact_whatsapp` : None.
- `ville` : Ville.NOUAKCHOTT par défaut (les bourses sont souvent hors-lieu).

## 2. Dashboard : classement des bourses

`apps/api/app/modules/dashboard/summary.py` → `extract_poste` : toute offre
de `type_offre == "bourse"` est classée **« Bourse d'études »** dans
`postes_annee` (au lieu de « Autre »).

## 3. Tests RÉELS (obligatoires)

1. Lancer le scraper en réel (réseau autorisé) : vérifier que des bourses
   réelles sont insérées en base avec type=bourse, date_limite future,
   source_url unique. **GARDER ces offres** (vrai catalogue, pas des tests).
2. `POST /api/v1/matching/run` : un étudiant de test avec bourse dans
   types_recherches reçoit le match d'une bourse collectée → preuve par le
   payload. Supprimer le profil de test après.
3. `extract_poste` : offre bourse → « Bourse d'études ».
4. Chaque source : si une source est morte/timeout, les autres continuent
   (pattern run() existant) — le prouver (rapporter le statut par source).
5. Nettoyage : aucune donnée de test résiduelle (offres réelles gardées,
   profils/offres fictifs supprimés).

## 4. Garde-fous IMPÉRATIFS (conflit d'agents)

- **Un autre agent travaille sur apps/api en ce moment** : NE TOUCHE à
  `main.py`, `models.py`, `engine.py`, ni à aucun fichier
  `modules/entreprises/` ni migrations. Tes fichiers autorisés :
  `modules/scraper/sources/bourses.py` (nouveau), `catalogue.py`,
  `modules/dashboard/summary.py`.
- Si tu dois lancer uvicorn pour tester : **port 8001** (8000 est pris).
- Zéro dépendance pip (stdlib + deps déjà présentes : requests/httpx selon
  ce qui existe dans le projet).
- Pas de git.
- User-Agent honnête dans les requêtes, throttle raisonnable (1 req/s max),
  timeouts courts (10 s) — bon citoyen.

## 5. Hors périmètre (rapporté, fait après par le pilote)

Landing : ajouter la Bourse dans la liste des types affichés + carte
dédiée — fait séparément par le pilote une fois l'agent desktop fini.
