# V4-F — verdict « non faisable, preuve » (18/11/2026)

> Lot V4-F du plan `docs/plan-lots-vague4-2026-11-06.md` (V3-10 : date limite par pays).
> Le plan autorise explicitement ce verdict à la place d'un écran vide.

## Décision

**Aucun écran n'est livré pour `dates_par_pays`.** La clé reste au contrat (§2.4) mais
n'est pas affichée, parce que le catalogue ne contient **aucune** échéance distincte
par pays. Afficher une date unique comme si elle valait par pays fabriquerait de faux
retardataires — exactement ce que la vague 3 a refusé le 03/11.

## Preuve mesurée (18/11/2026, lecture seule)

| Mesure | Commande | Résultat |
|---|---|---|
| Couverture catalogue public | `python -X utf8 scripts/couverture-metadata.py` | population **305** offres ; `dates_par_pays` présent **0**, conforme **0**, affichable **0 (0,0 %)** |
| Extractibilité sur toutes les lignes | `python -X utf8 scripts/backfill-calendrier.py` (dry-run) | 601 lignes lues ; refus `aucune échéance par pays` = **601 / 601** ; `Dates par pays : 0` ; `A écrire : 8` (tous des `calendrier`, aucun `dates_par_pays`) |

Lecture : ce n'est pas un défaut d'écriture ni d'extraction — c'est une **absence de
donnée dans les sources**. L'extracteur strict rejette ce qui n'existe pas (31/31 des
cas du harnais `test-calendrier.py` couvrent ces refus, dont « même étape à deux dates »).

## Non-régression de l'échéance (exigence du lot)

Le bloc calendrier est **additif** : il ne lit jamais `date_limite` et ne modifie pas la
section Échéance. Preuves disponibles sans déploiement :

| Garde | Preuve |
|---|---|
| Le bloc ne rend rien sans donnée conforme (0, 1 étape, date fausse, ordre inversé) | `apps/web/__tests__/offres/calendrier.test.ts` **15/15** (rejoué par le régisseur le 18/11) |
| Le bloc n'est monté qu'après la section Échéance, aucun remplacement | diff `922136d` : `app/offres/[id]/page.tsx` = **+6 lignes**, aucune ligne supprimée |
| L'échéance garde ses sondes historiques | `verify-fiche-bourse.mjs` / `verify-live-public.mjs` inchangés (à rejouer après déploiement) |

## Ce qui n'est PAS prouvé

- Aucun contrôle navigateur du rendu (la fiche est rendue côté client, `playwright` absent du dépôt) — preuve au build uniquement.
- Aucune preuve live : rien n'est déployé (`main` n'a ni V4-G ni V4-E).
- La valeur produit de V4-E est quasi nulle aujourd'hui : **1 offre / 305** affiche un calendrier, alors que 8 sont extractibles → 7 valeurs ont disparu en base entre le 17/11 et le 18/11. **Bug de persistance ouvert**, instruit séparément (agent `debogueur`), à trancher avant de considérer la vague 4 comme close.
