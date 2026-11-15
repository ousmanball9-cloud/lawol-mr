# Diagnostic — moteur de matching LAWOL.mr

**Date** : 15/11/2026 · **Nature** : diagnostic seul, aucun code applicatif modifié.
**Question posée** : l'algorithme donne-t-il à chaque étudiant inscrit les bourses qu'il lui faut ?
**Critère retenu** : 0 faux positif d'éligibilité + rappel maximal.

---

## 1. Verdict

> L'algorithme **existe, calcule juste et ne livre pas**.
> Le barème v3 est sain et prouvé (60/61 checks). Ce qui casse la promesse n'est pas le
> score : c'est **l'émission** (aucun envoi planifié) et **deux angles morts d'éligibilité**
> (niveau traité comme un bonus, `types_recherches` comparé tel quel).

Mesure sur les données réelles au 15/11/2026 :

| Indicateur | Valeur | Lecture |
|---|---|---|
| Bourses actives non expirées | **309** | le catalogue ne manque pas |
| Profils actifs | **2** | la promesse ne peut pas être prouvée à l'échelle |
| Matches valides en base | **13** | calculés correctement |
| Matches valides **réellement envoyés** | **3 (23 %)** | **77 % de la valeur meurt en base** |
| Bourses éligibles par profil (moy.) | **163** | 185 (gestion) · 142 (génie civil) |
| Rappel effectif (matches corrects / éligibles) | **4,0 %** | 13/327 |
| Faux positifs d'éligibilité constatés | **1/35** | PhD-only proposée à un M2 |
| Faux positifs potentiels (catalogue) | **55/317 (17,4 %)** | bourses doctorat-only non exclues |

---

## 2. Méthode (rejouable)

Toutes les mesures sont des scripts en lecture seule, exécutés contre la base de production
(clé de service lue dans `.env`, jamais affichée) :

| Script (98-SANDBOX/lawol-matching-diag/) | Mesure |
|---|---|
| `audit-prod.py` | volumes, couverture, scores, bourses jamais matchées |
| `audit-cas-reels.py` | éligibilité recalculée indépendamment pour les 2 profils actifs |
| `audit-staleness.py` | âge des matches, règle d'origine (v1/v3), état actuel de l'offre |
| `audit-quota.py` | quota de bourses génériques cumulé sur les matches morts |
| `audit-echeances.py` | pression des échéances vs capacité du quota |
| `audit-niveau.py` | bourses doctorat-only proposées à des non-docteurs |
| `audit-blocages.py` | `types_recherches`, email manquant, préférences |
| `audit-pollution.py` | offres d'emploi déguisées en bourses (0 trouvée) |

Harnais du dépôt rejoué : `python scripts/test-matching.py` → **60/61 checks verts**, 1 KO.

---

## 3. Ce qui marche (à ne pas casser)

1. **Barème v3 normalisé** (`engine.py:445-449`) : `100 × Σ(poids × satisfaction) / Σ(poids applicables)`.
   Pas de saturation, critère sans donnée retiré du dénominateur. Prouvé : 210/210 combinaisons
   filière × niveau × ville atteignent ≥ 5 offres à ≥ 60.
2. **Filtres durs corrects** : actif, non expiré, filière, pays favoris, financement minimum
   (`engine.py:154-209`).
3. **Départage déterministe** score → échéance → identifiant (`engine.py:523-530`).
4. **Anti-spam hebdo** 5 matches/semaine et **quota génériques** 3/profil (`engine.py:83-85`).
5. **Bourses génériques** détectées et déclassées (satisfaction 0,35) au lieu de saturer.
6. **Le front ne montre jamais une offre morte** (`main.py:556-557`, jointure `!inner` + `date_limite >= today`).

---

## 4. Défauts, par gravité

### P0 — la promesse est rompue aujourd'hui

#### P0-1 · Aucun envoi de match n'est planifié en production
- **Preuve** : `git ls-files .github/workflows` → seuls `resume-hebdo.yml` et `scraper-cron.yml`
  sont suivis. `collecte.yml` (qui appelle `collecte_auto.py` → `run_notification_job`)
  **n'est pas dans le dépôt** : `gh run list --workflow collecte.yml` → **HTTP 404**.
- `scraper-cron.yml:131` appelle `/api/v1/matching/run` mais **jamais** `/api/v1/notifications/run`.
- **Conséquence mesurée** : 13 matches valides en base, **3 envoyés**.
  Profil `566d99ba` (actif) : 5 matches valides, **0 envoyé**.

#### P0-2 · Le seul canal planifié est cassé depuis le 09/11 — **déjà corrigé, à prouver**
- `resume-hebdo.yml:33` pointait `https://lawol-mr-production.up.railway.app` (infra morte) :
  run `42663413263` → **HTTP 404 `Application not found`**.
- **Corrigé dans `main`** par le commit `aff8d47` (« scraper-cron et resume-hebdo pointent
  l'hôte Render ») : le fichier de HEAD pointe bien `lawol-api.onrender.com`.
- Reste à prouver : prochain run planifié lundi 07:00 UTC. Un garde-fou anti-régression
  (aucune URL `railway` dans les workflows) est désormais dans `scripts/test-emission-matches.py`.

#### P0-3 · Le notifier exclut les étudiants sans email
- `notifier.py:172` : `.not_.is_("profil.email", "null")` — alors que la docstring
  (l. 150-151) annonce « WhatsApp d'abord, repli email ».
- **Le canal email fonctionne** (opérateur, 15/11) : le défaut ne touche que les profils
  **sans** email — ceux qui n'ont que le téléphone.
- **Preuve** : profil `566d99ba` actif, téléphone présent, **email absent** → jamais dans le lot.
  Aujourd'hui **1 profil actif sur 2** est invisible du notifier (2/4 tous statuts confondus).
- Conséquence secondaire : les 5 matches non envoyés du profil `4260b5b6` (qui a un email)
  ne partent **pas** à cause de ce filtre, mais parce que **rien ne déclenche le notifier** (P0-1).

### P1 — faux positifs d'éligibilité (le critère « 0 » n'est pas tenu)

#### P1-4 · Le niveau est un bonus, pas un filtre
- `engine.py:307-308` : offre **au-dessus** du niveau du candidat → satisfaction **0,2**, jamais exclue.
- **Preuve réelle** : `Trinity College Dublin PhD Researcher…` (doctorat) matchée à un profil **M2**, score 80.
- **Ampleur** : **55/317 bourses actives (17,4 %)** sont doctorat-only et restent éligibles pour un master.
- Le harnais le reconnaît explicitement : « PhD jamais exclu » (`test-matching.py`, section 8).

#### P1-5 · `types_recherches` comparé tel quel, avec un défaut SQL piégeux
- `engine.py:160` : `type_offre ∈ profil.types_recherches`.
- `infra/supabase/schema.sql:9` : défaut `array['stage_pfe']` → **un profil créé sans ce champ ne
  matchera jamais aucune bourse**. Aucun backfill n'existe.
- Aujourd'hui 0/4 profil touché (tous contiennent `bourse`), mais rien ne l'empêche.

#### P1-6 · Insertion en bloc sans isolation
- `engine.py:741-742` : un seul `insert()` pour tout le lot, sans `on_conflict`, sans `try`.
  Une violation d'unicité fait perdre **tout** le lot et remonte en 500.
- `stats["matches"] = len(nouveaux)` (l. 743) compte les **tentatives**, pas les écritures confirmées.
- `main.py:437-441` n'expose que 3 des 8 compteurs → `ignores_spam`, `ignores_prefs`,
  `ignores_generiques`, `ignores_hors_active` sont **invisibles en production**.

### P2 — rappel et robustesse

#### P2-7 · Le quota hebdo rend l'urgence inatteignable
- Mesure : profil gestion → **99 bourses éligibles expirent sous 30 jours**, capacité du quota
  sur la même période ≈ **21** → **78 perdues (79 %)**. Sous 14 jours : 21 urgentes pour 10 places.

#### P2-8 · Le quota de bourses génériques se cumule à vie, matches morts compris
- `engine.py:564-574` lit **tous** les matches sans filtrer `offre.active` ni `date_limite`.
  Une bourse générique obtenue puis expirée consomme définitivement une place sur 3.
- Latent aujourd'hui (0 match générique marqué), actif dès la première campagne.

#### P2-9 · Une bourse réactivée n'est jamais re-proposée
- `engine.py:569` : `deja_matchees` inclut les matches morts → paire (offre, profil) bloquée à vie.

#### P2-10 · Lectures non paginées = troncature silencieuse
- `engine.py:550, 552, 564` : `select()` sans `limit`/`offset`. PostgREST plafonne à 1000 lignes.
- Marge actuelle : **965 lignes** sur `matches`, puis déduplication et quotas calculés sur un
  échantillon partiel, **sans aucune trace**.

#### P2-11 · Le notifier peut envoyer une bourse morte, et affame les derniers
- `notifier.py:163-174` : `.limit(20)` **sans `order`** et **sans filtre** `offre.active`/`date_limite`.
  Au-delà de 20 en attente, les suivants ne partent jamais ; une offre expirée peut être notifiée.

#### P2-12 · Une date de scrape illisible vaut « tout frais »
- `engine.py:646-649` : `date_scrape` illisible → `date.today()` **sans log** → **+10 points** offerts.

#### P2-13 · Le harnais de référence ne peut pas afficher son verdict sous Windows
- `test-matching.py:48` : `UnicodeEncodeError` cp1252 sur `→` → **exit 1 avant tout check**.
  C'est exactement la leçon AGENTS.md du 12/11, non appliquée ici. Correctif : `sys.stdout.reconfigure(encoding="utf-8")`.

#### P2-14 · Le harnais dépend de la production et son échantillon s'effrite
- `test-matching.py:35` importe le **vrai** client Supabase (contrairement à « zéro réseau » d'AGENTS.md règle 5).
- Étiquettes humaines de 19 offres réelles : **12 restantes** → KO « échantillon toujours mesurable ».
  Si 15 offres disparaissent, la précision d'extraction n'est plus mesurée du tout.

#### P2-15 · La couverture est écrite mais jamais servie
- `engine.py:714` écrit `metadata.couverture` (« un 100 sur 3 critères n'est pas un 100 sur 6 »),
  mais aucune route ne la lit (`main.py:544-550`) → l'étudiant voit un score sans savoir sur quoi.

#### P2-16 · Documentation divergente du code
- `engine.py:12` annonce « Barème v2 » ; le code écrit `"regle": "v3"` (`engine.py:705`).
- `engine.py:3-10` décrit la règle v1 (type_offre = BOURSE unique), le code compare au profil.

---

## 4bis. Mesure synthétique (moteur réel, faux Supabase)

Harnais : `mesure-eligibilite.py` — **90 profils × 64 offres = 5 760 couples**, éligibilité
définie indépendamment du code (vérité injectée dans les offres, jamais recopiée du moteur).
Compteurs du moteur : `examines 5220 · matches 419 · ignores_spam 226 · ignores_score_faible 90 ·
ignores_hors_active 90 · ignores_generiques 2`.

| Famille | Mesuré | Cible | Verdict |
|---|---|---|---|
| E1 offre fermée / expirée proposée | 0 | 0 | OK |
| E2 filière hors cible proposée | 0 | 0 | OK |
| **E3 niveau inadapté proposé** | **112** | 0 | **KO** |
| E4 pays hors favoris proposé | 0 | 0 | OK |
| E5 financement insuffisant proposé | 0 | 0 | OK |
| **E6 langue non maîtrisée proposée** | **91** | 0 | **KO (hors code)** |
| Pertes de rappel inexpliquées | 0 | 0 | OK |
| **Efficacité vs plafond du quota** | **62,0 %** | ≥ 95 % | **KO** |
| Profils éligibles à 0 match | 0/90 | 0 | OK |
| Doublons (offre, profil) | 0 | 0 | OK |
| Quotas dépassés | 0 | 0 | OK |

**Rappel** : 48,1 % brut (259/539) · plafond mécanique du quota 5/profil = 77,6 %.
Pertes : `quota_hebdo 161 · score<30 90 · quota_générique 29`.

Deux lectures à ne pas confondre :

- **E3 = défaut de code.** Le moteur connaît le niveau de l'offre et celui du profil, et choisit
  de ne pas exclure (`engine.py:307-308`). Confirmé en prod (1 cas réel, 55 bourses potentielles).
- **E6 = trou de périmètre, pas un bug.** Aucune donnée de langue n'existe : ni colonne `profils`,
  ni champ de formulaire (`models.py`, `referentiels.ts`). Le moteur ne peut pas filtrer ce que
  le produit ne collecte pas. Décision produit, pas correctif.

---

## 5. La promesse, chiffrée

| Étape | Mesure | Verdict |
|---|---|---|
| Le catalogue contient des bourses utilisables | 309 actives non expirées | OK |
| Le moteur trouve les bonnes | 13 matches corrects / 327 éligibles = 4,0 % | KO (quota + urgence) |
| Aucune bourse non éligible n'est proposée | 1 réel / 35 · 55 potentielles / 317 | KO (niveau) |
| L'étudiant reçoit ce qui le concerne | 3 envoyés / 13 valides = 23 % | KO (émission) |
| L'étudiant peut agir à temps | 99 urgentes / 30 j vs 21 places | KO (quota) |

---

## 6. Plan de correction proposé (à arbitrer — rien n'est appliqué)

**Lot A — rendre la livraison possible (P0, aucune décision produit)**
1. Tracker `collecte.yml` **ou** ajouter `/api/v1/notifications/run` + `/deadlines` à `scraper-cron.yml`.
2. Merger le correctif Render de `ci/render-workflows` (résumé hebdo).
3. Retirer le filtre email du notifier : le dispatch canal-agnostique choisit déjà WhatsApp → email.

**Lot B — tenir le critère « 0 faux positif » (P1, décision produit)**
4. Niveau : **filtre dur** quand l'offre n'affirme qu'une famille supérieure au candidat
   (doctorat-only → master exclu), ou satisfaction 0 explicite. **À arbitrer** : exclusion stricte
   vs note plancher.
5. Backfill `types_recherches` (ajouter `bourse` aux profils legacy) + garde-fou à l'inscription.
6. Insertion par lots avec isolation + `stats["matches"]` = lignes réellement écrites.

**Lot C — rappel (P2, décision produit)**
7. Quota : séparer « urgentes » (échéance ≤ 14 j) du quota hebdo, ou rendre le quota adaptatif.
8. Quota génériques : ne compter que les matches **vivants**.
9. `deja_matchees` : ne bloquer que les paires dont l'offre est encore valide.
10. Pagination explicite des 3 lectures (`profils`, `offres`, `matches`).

**Lot D — la preuve**
11. `test-matching.py` : `reconfigure(utf-8)`, et séparer le **harnais hors-ligne** (fixtures figées)
    du **contrôle prod** (lecture seule). Un harnais doit rester vert sans réseau.
12. Servir `couverture` dans l'API et exposer les 8 compteurs du job.

---

## 7. Ce qui reste à trancher (arbitrage utilisateur)

1. **Niveau** : exclure strictement une bourse doctorat-only pour un master, ou la garder
   en bas de liste ? (impact : 17,4 % du catalogue)
2. **Quota** : accepter 5/semaine (spam maîtrisé, 79 % des urgentes perdues) ou prioriser
   les échéances courtes ?
3. **Canal** : WhatsApp seul, email seul, ou les deux avec repli ? (décide P0-3)
4. **Périmètre du lot suivant** : A seul (livrer), A+B (éligibilité), ou A+B+C (rappel).
5. **Langue** : collecter le niveau de langue (IELTS/TOEFL/DELF) à l'inscription ? Sans cette
   donnée, 91 bourses sur 5 760 couples resteront des faux positifs que le moteur ne peut pas
   éviter — ce n'est pas un bug, c'est un champ manquant.

---

## 8. Lot A — exécuté le 15/11/2026 (émission)

Arbitrages appliqués : niveau **laissé** (aucune exclusion stricte) · quota → priorité aux
échéances (Lot C) · canal **email actif**, WhatsApp branché sans blocage · lots A → B → C.
Échec d'émission dans le cron → **run rouge visible**.

| # | Changement | Fichier |
|---|---|---|
| A1 | Pas « Émettre les matches » : `POST /notifications/run` puis `/deadlines`, 2 essais, 401/403 sans retry, `exit 1` si échec | `.github/workflows/scraper-cron.yml` |
| A2 | Suppression du filtre `profil.email IS NOT NULL` : le dispatch canal-agnostique choisit WhatsApp → email ; aucun canal ⇒ erreur comptée, match conservé | `apps/api/app/modules/whatsapp/notifier.py:161-176` |
| A3 | Harnais hors-ligne de l'émission (5 invariants, zéro réseau) | `scripts/test-emission-matches.py` |
| A4 | Contrôle que le Python embarqué dans les workflows **compile** (un YAML valide ne prouve rien) | `scripts/test-workflows-python.py` |

**Mesure avant / après** (même harnais, même commande) :

| Check | Avant | Après |
|---|---|---|
| match d'un profil sans email examiné | KO (0) | **OK (1)** |
| profil sans email servi par WhatsApp | KO | **OK** |
| match marqué notifié | KO | **OK** |
| échec d'envoi → erreur comptée, match conservé | OK | OK |
| quota hebdo 5 respecté | OK | OK |
| un workflow planifie `/notifications/run` | KO | **OK** |
| un workflow planifie `/deadlines` | KO | **OK** |
| aucun workflow ne pointe Railway | OK | OK |

Bilan : **5 KO → 0 KO**.

**Preuves rejouées** : `test-emission-matches.py` vert · `test-workflows-python.py` vert ·
`ruff` propre · `test-notifications` (100 %) · `test-canal-email` (30/30) ·
`test-resume-hebdo` (38/38) · `test-garde-admin` (100 %) · `test-rattrapage` (30/30) ·
`test-matches-visibilite` (vert) · `test-preferences-avancees` (100 %).

**Rouge préexistant, hors périmètre** : `test-sante-collecte.py` — 34/35, échec sur
« résultat final cohérent avec les lignes du mock ». Le test n'importe que `scraper.sante`
(aucun fichier du Lot A) : le défaut est indépendant, à instruire au Lot D.

**Non fait (volontairement)** : aucun push, aucun déploiement, aucune modification du barème.
