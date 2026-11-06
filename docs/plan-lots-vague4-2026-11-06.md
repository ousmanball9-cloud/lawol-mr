# Plan par lots — vagues en cours (écrit le 06/11/2026)

> But : **ne plus jamais tomber en limite de requêtes au milieu d'un lot.**
> Un lot = une session = un commit = une ligne KPI. Si la limite arrive, elle
> arrive **entre deux lots**, jamais dans le ventre d'un lot.

## 0. Où on en est (mesuré, pas supposé)

| Vague | État | Preuve |
|---|---|---|
| Vague 1 (design sûr) | **CLOSE** 01/11 | 33 → 0 cible < 44 px, 16 → 0 texte < 12 px, 38 ombres → 0 |
| Vague 2 (trouver vite) | **CLOSE** 03/11 | facettes 11/11, chrome 24/24, mobile 28/28, LCP instrumenté (fetch = 78 %) |
| Vague 3 (comprendre & oser) | **CLOSE** 04/11 | V3-01→V3-08 livrés ; V3-09/V3-10 **requalifiés** (donnée absente) |
| Vague 4 (décisions produit) | **EN COURS** | thème sombre **retiré** (06/11, `e8a0b65`) ; 4 sujets restants = **ingestion** |

`main` = `e8a0b65`, branche de travail `design/vague3-suite`, arbre propre.

**Le vrai reste à faire des vagues n'est plus du design : c'est la DONNÉE.**
Les 4 sujets restants de la vague 4 (montant, éligibilité par origine,
calendrier V3-09, dates par pays V3-10) et les dettes ouvertes des vagues 2/3
(filtres lents, LCP dominé par le fetch) se ramènent tous à : *extraire,
stocker et prouver des champs qui n'existent pas encore.*

## 1. Principe anti-limite (la règle qui répond à la demande)

1. **Une session ne commence jamais sans lot nommé** (« je fais LOT B »).
2. **Un lot ≤ 2 h de travail agent**, 1 branche, 1 commit, 1 harnais rejouable.
3. **Découpage à la sous-étape** : tout lot qui déborde se coupe en `B1/B2`,
   et la coupe se fait **avant** l'épuisement, pas pendant.
4. **Note de reprise obligatoire** en fin de session, même si le lot est fini :
   *état d'entrée du lot suivant + 3 fichiers à ouvrir en premier*. Une
   session neuve ne relit jamais le backlog entier.
5. **Aucun lot ne mêle ingestion et affichage** : deux preuves différentes,
   deux harnais différents. Les mélanger rend la vérification floue.
6. **KPI par lot** : `mesure-tokens.ps1 -Snap` avant / `-Diff` après →
   `kpi-suivi.md`. Un lot > 100 k tokens frais sans part déléguée → post-mortem.

## 2. Lots de la vague 4 (dans l'ordre — dépendances respectées)

| Lot | Contenu | Livrable / preuve | Durée | Dépend de |
|---|---|---|---|---|
| **V4-A** | **Contrat `metadata`** : écrire noir sur blanc les 4 clés (`montant`, `origine_eligible`, `calendrier`, `dates_par_pays`), + `scripts/couverture-metadata.py` qui imprime le **taux de remplissage réel** du catalogue par clé | 1 doc de contrat + 1 harnais rejouable, sortie chiffrée | **1 h** | — |
| **V4-B** | **Extraction montant** (option b validée) : extracteurs purs `up to €10,000`, `1.200 EUR/mois`, `full tuition + stipend` → `{valeur, devise, periode}` + `--dry-run` sur le catalogue | tests unitaires + compteur « X/274 extraits avec certitude » | **2 h 30** | V4-A |
| **V4-C** | **Affichage montant** carte + fiche, **silence si absent** (jamais de « non communiqué » sur 12 cartes) | harnais live + **contrôle négatif** joué avant déploiement | **1 h 30** | V4-B |
| **V4-D** | **Éligibilité par origine** (option b : indice « compatible », jamais masquer) : ingestion du critère sur les sources qui le publient | taux de couverture + fiche qui affiche l'indice seulement si sourcé | **2 h 30** | V4-A |
| **V4-E** | **V3-09 calendrier de sélection** : n'afficher que si ≥ 2 étapes datées extraites, sinon rien | décision écrite + harnais (ou « non faisable, preuve ») | **2 h** | V4-D |
| **V4-F** | **V3-10 dates multiples par pays** : idem, affichage conditionnel | harnais de non-régression échéance | **1 h 30** | V4-E |

**Sous-total vague 4 : ~11 h** (5 à 6 sessions bornées).

## 3. Lots des dettes ouvertes des vagues 2 et 3 (après, ou en parallèle)

| Lot | Contenu | Livrable / preuve | Durée | Dépend de |
|---|---|---|---|---|
| **V5-A** | **Filtres `financement` + `cloture30` côté serveur** : supprimer le repli « bassin de 500 » (seul reste lent de `/offres`) | mesure avant/après sur ces 2 filtres | **2 h 30** | — |
| **V5-B** | **TTFB froid** (3,3–5,8 s au 1er passage) : instrumenter, isoler Vercel vs API | chiffres, aucune promesse de gain | **1 h 30** | — |
| **V5-C** | **Sources gouvernementales restantes** (8) : par **paires**, jamais les 8 d'un coup, avec `verify-sante-collecte` | 2 sources / lot, run réel + comptage | **2 h / paire** | — |
| **V5-D** | **Matching** : rejouer `POST /matching/run` en prod et vérifier la distribution réelle (jamais fait depuis le barème v3) | distribution + écart max par profil | **1 h** | — |
| **V5-E** | **Sécurité** : `SCRAPER_TOKEN` dédié révocable (aujourd'hui = `ADMIN_PASSWORD_HASH`) + état de la rotation des clés Supabase | jetons séparés, preuve 401/403 | **2 h** | — |

**Sous-total dettes : ~9 h** + 2 h par paire de sources.

## 4. Protocole de session (à coller en tête de chaque nouvelle session)

```text
Lot : <ID> — <titre>
Ouvrir d'abord : docs/plan-lots-vague4-2026-11-06.md, docs/chasse/backlog.md §3
Interdit : toucher un autre lot, déployer sans contrôle négatif du harnais
Sortie : commit + harnais vert + ligne KPI + note de reprise (5 lignes)
```

**Note de reprise (modèle, 5 lignes max) :**
```text
Lot <ID> : <fait / partiel / bloqué>
Preuve : <harnais + chiffre>
Prochain lot : <ID> — commencer par <fichier 1>, <fichier 2>
Piège : <ce qui a coûté du temps>
```

## 5. Ce que ce plan refuse de faire

- Ouvrir un lot « vague 5 refonte » : la campagne design est **close**, les
  mesures sont faites, il n'y a plus de gain visuel à aller chercher.
- Annoncer une vitesse gagnée : `/offres` reste dominé par le fetch API.
- Coder V3-09/V3-10 avant V4-A : sans contrat `metadata`, on fabriquerait des
  dates inventées — exactement ce que la vague 3 a refusé.

## 6. Journal d'exécution

### V4-A — FAIT le 06/11/2026 (durée réelle : ~1 h)

| Livrable | Preuve |
|---|---|
| `docs/contrat-metadata-offres.md` | 9 clés contractualisées (6 existantes + 3 de la vague 4), 6 invariants, règle « absence = silence » |
| `scripts/couverture-metadata.py` | `--self-test` **VERT** (16 offres, 9 clés, 9 pièges) ; modes `--supabase`, `--toutes`, `--json` |
| **Contrôle négatif** | 3 ouvertures de validateur injectées → **3 fois le harnais est tombé** (1 assertion KO chaque fois) |
| Gates | `ruff` 0 · `py_compile` 0 · self-test 0 |

**Mesure réelle du catalogue (06/11/2026, 505 lignes en base) :**

| Population | `categorie_bourse` présent | affichable |
|---|---|---|
| public (actives, échéance future) **281** | 268 (95 %) | **154 (54,8 %)** |
| toutes lignes **505** | 420 (83 %) | 208 (41,2 %) |

- L'écart présent → affichable est **légitime** : ce sont les `inconnu`
  (silence assumé), pas une erreur d'écriture. **0 clé hors contrat.**
- **Fait dur découvert** : `pays_financeur`, `deadline_source`,
  `date_publication`, `relais` sont à **zéro sur les 505 lignes**. Vérifié par
  comptage des sources : **`mesrs` = 0 ligne** (15 sources réelles, les plus
  grosses : afterschool-africa 110, beta_mr 101, scholar-africa 98). Ces 4 clés
  décrivent donc une **intention d'ingestion**, pas des données. Conséquence :
  les lots V4-E/V4-F ne peuvent rien afficher tant que la source MESRS ne
  produit pas de lignes — c'est un prérequis, pas un écran.

**Décision de suite (V4-B)** : l'extraction du montant se mesure sur les
**281 offres sans montant** (0/281) — le lot doit donc livrer l'extracteur ET
son taux d'extraction réel, jamais un « c'est branché ».
