# Contrat `offres.metadata` — LAWOL (v1, 06/11/2026)

> **Pourquoi ce document existe.** La règle locale « zéro migration SQL » fait
> passer les colonnes additionnelles par `offres.metadata` (jsonb). C'est bon
> pour la base, mauvais pour le produit : au 06/11/2026, **6 clés** vivent dans
> ce jsonb sans qu'aucun document ne dise leur forme, leur auteur ni leur règle
> d'affichage. Deux lots de la vague 4 (`V4-B` montant, `V4-D` origine
> éligible) allaient ajouter 2 clés de plus à ce désordre.
>
> **Règle fondatrice** : une clé absente n'est pas une donnée — c'est un
> silence. On n'écrit jamais une valeur « pour remplir », et l'écran ne
> compense jamais une absence par un texte inventé.

## 1. Clés existantes (relevées dans le code — ne pas renommer)

| Clé | Écrite par | Forme constatée | Règle |
|---|---|---|---|
| `categorie_bourse` | `scraper/sources/base.py::save` + `scripts/backfill-categorie.py` | `"gouvernementale" \| "institutionnelle" \| "fondation" \| "entreprise" \| "inconnu"` | Axe FINANCEUR. `inconnu` = clé absente ou valeur `inconnu` (le filtre `?categorie=` traite les deux cas). **Après bourse** : `inconnu` ne s'affiche pas. |
| `filieres_ignorees_base` | `sources/base.py` (élagage d'enum) | `["genie des procedes", …]` | **Interne**. Trace d'un refus d'écriture, jamais affichée, jamais lue par le produit. |
| `pays_financeur` | `sources/mesrs.py` | texte libre (`"inconnu"` si vide) | Pays qui finance, distinct de `offres.pays_etudes` (où l'on étudie). |
| `deadline_source` | `sources/mesrs.py` | texte tel que publié | **Preuve brute** de la date limite quand la source l'écrit en clair. Ne pas parser ici : c'est la trace. |
| `date_publication` | `sources/mesrs.py` | `YYYY-MM-DD` ou `null` | Date d'annonce d'origine, quand elle existe. |
| `relais` | `sources/mesrs.py` | `"MESRS Mauritanie"` | Qui relaie l'annonce — transparence de la source. |

## 2. Clés de la vague 4 (forme contractuelle)

Écrites **uniquement** par un extracteur de `matching/extraction.py` ou un
script `scripts/backfill-*.py`, **jamais** par un template de source ad hoc.

### 2.1 `montant`

```json
"montant": { "valeur": 1200, "devise": "EUR", "periode": "mois" }
```

| Champ | Type | Contrainte |
|---|---|---|
| `valeur` | nombre | `> 0`. Jamais une chaîne, jamais `null`. |
| `devise` | texte | Code ISO 4217 **3 lettres majuscules** (`EUR`, `USD`, `GBP`, `CAD`, `MRU`, `XOF`, `MAD`, `TRY`, `CNY`, `JPY`, `KRW`, `HUF`…). Pas de symbole (`€`, `$`), pas de mot (`euros`). |
| `periode` | texte | `"mois"` \| `"an"` \| `"total"` — *ce que le montant couvre*. |

- **Affichable** si les 3 champs sont valides. Sinon la clé est **absente**
  (pas de `null`, pas de `0`, pas de « non communiqué » sur la carte).
- **Interdit** : additionner deux périodes, convertir une devise devinée,
  extraire « full tuition + stipend » en un chiffre (ce n'est pas un montant,
  c'est une nature — elle reste dans `type_financement`).
- Un montant faux est **pire** qu'un montant absent : décision produit du
  05/11/2026.

### 2.2 `origine_eligible`

```json
"origine_eligible": { "indice": "compatible", "preuve": "texte" }
```

| Champ | Type | Contrainte |
|---|---|---|
| `indice` | texte | `"compatible"` \| `"incompatible"` \| `"inconnu"` |
| `preuve` | texte | `"texte"` (la description le dit) \| `"source"` (la source le déclare) |

- **Affichable** seulement si `indice` vaut `compatible`/`incompatible` **ET**
  que `preuve` est présente. Un indice sans preuve n'est pas affichable.
- **Ne jamais masquer** une offre sur cet indice (décision du 05/11/2026) :
  `PaysEtudes` dit *où l'on étudie*, pas *qui peut candidater*. Filtrer dessus
  cacherait des bourses auxquelles un Mauritanien a droit.
- `inconnu` = silence à l'écran, pas un badge.

### 2.3 `calendrier` (V3-09)

```json
"calendrier": [
  { "etape": "candidature", "date": "2027-01-15" },
  { "etape": "resultat",    "date": "2027-04-30" }
]
```

- Étapes autorisées : `candidature`, `preselection`, `entretien`, `resultat`.
  Une étape = une date, **pas de doublon**, ordre chronologique à l'écriture.
- **Affichable** si **au moins 2 étapes datées**. Une seule date ne fait pas un
  calendrier (elle se confond avec `date_limite` et fabrique un faux parcours).
- Dates au format `YYYY-MM-DD`, jamais relatives (« début janvier »).

### 2.4 `dates_par_pays` (V3-10)

```json
"dates_par_pays": { "france": "2027-02-10", "allemagne": "2027-03-01" }
```

- Clé = pays **en minuscules, sans accent** (même vocabulaire que la colonne
  `pays_etudes`), valeur = `YYYY-MM-DD`.
- **Affichable** si **≥ 2 pays** datés. Un seul pays = la date est déjà
  `date_limite` : l'afficher deux fois ne sert à rien.

## 3. Invariants (les 6 règles qui tiennent le contrat)

1. **Écriture en fusion** : `metadata = dict(existant)` puis ajout de la clé.
   Aucune clé d'un autre auteur n'est perdue (`sources/base.py` le fait déjà
   pour `categorie_bourse` — patron à reprendre).
2. **Absence = clé absente.** Pas de `null`, pas de `""`, pas de `0`, pas de
   `"inconnu"` pour *masquer* une extraction ratée (`inconnu` n'existe que
   dans une taxonomie explicite : `categorie_bourse`, `origine_eligible`).
3. **Une valeur = un fait textuel ou déclaré.** Pas de score de confiance
   inventé, pas de déduction par ressemblance de nom.
4. **Idempotence** : rejouer un backfill ne change rien si la clé est déjà
   valide ; il ne l'écrase que sur `--apply` explicite.
5. **Aucune clé hors contrat.** Le harnais signale toute clé inconnue
   (faute de frappe, clé d'un ancien lot) — c'est ainsi qu'on évite un
   `montants` à côté d'un `montant`.
6. **Une clé, un consommateur.** Si aucune page ne lit la clé, elle ne
   s'écrit pas (sinon on stocke de la dette). Le tableau §2 le dit clé par clé.

## 4. Ce que ce contrat ne fait pas

- Il ne crée **aucune** colonne : tout reste dans `offres.metadata` (règle
  locale n° 2, zéro migration SQL).
- Il n'implémente aucune extraction : `V4-B` (montant) et `V4-D` (origine)
  sont les lots qui écrivent dans ce cadre.
- Il ne touche pas `profils.metadata` (autre contrat : `code_pin_hash`,
  `prefs_avancees`, `documents`, `notifications_lues`, `pays_etudes`).

## 5. Mesure associée

`python scripts/couverture-metadata.py` imprime, clé par clé, le nombre
d'offres **présentes** et **affichables** (validation de forme), plus les
**clés hors contrat**. Harnais `--self-test` : 0 réseau, assertions exactes.
Seuil de décision produit : une clé sous **80 % d'affichable** ne pèse pas
dans un classement (règle du barème v3) — elle reste informative.
