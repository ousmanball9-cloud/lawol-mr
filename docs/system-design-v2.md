# System design v2 — parcours catalogue (priorité produit), 29/10/2026

> Périmètre : **le catalogue** — celui que l'utilisateur a désigné prioritaire
> (« trouver la bonne offre vite »). Le reste (profil, documents, admin) n'est traité
> que là où il bloque le catalogue. Aucune mesure inventée : chaque ligne renvoie à un
> constat de `00-etat-des-lieux.md`, `02-carte-fiche.md` ou `03-recherche-ia.md`.

## 1. Parcours cible (aujourd'hui vs cible)

| Étape | Aujourd'hui | Cible | Source |
|---|---|---|---|
| **Arriver** | `/offres` charge, puis perd le header pendant le chargement | les 3 états (chargement/erreur/vide) rendus **dans** le chrome | 0·B2 |
| **Chercher** | `?recherche=` seul paramètre d'URL ; 4 `select` empilés sous 768 px | barre + panneau de filtres mobile ; **toutes** les facettes dans l'URL | 3·SP-04/SP-06, CF-04 |
| **Comparer** | carte sans financement ; 3 badges dont 2 de nature différente | carte 3 zones + type de financement + **1** badge ; compteur collant au-dessus | 2·C-HS-05, C-JT-04, 3·SP-03 |
| **Comprendre** | fiche : description avant les critères éliminants | bloc « L'essentiel » (5-6 faits) → critères éliminants → description | 2·C-HS-01, C-JT-06 |
| **Oser** | « Postuler » uniquement en haut d'une fiche de 3 000 px | CTA collant en bas (les **deux** concurrents n'en ont pas) | 2·C-JT-08, C-HS-08 |
| **Revenir** | retour arrière = filtres perdus | facettes URL → le retour restaure l'état | 3·SP-06 |
| **Partager** | impossible | lien `?pays=…&tri=…` envoyable par WhatsApp | 3·SP-06 |

## 2. Décisions d'architecture d'information

1. **Le filtre est un état d'URL, pas un état React local.** Aujourd'hui seul
   `?recherche=` est poussé (`app/offres/page.tsx:86`). Conséquence : un filtre ne se
   partage pas, ne survit pas au retour arrière, et le harnais ne peut pas le vérifier.
   *Contre-exemple documenté : JobTeaser expose `?contract[]=INTERNSHIP` qui ne filtre
   rien — un paramètre qui ment. Donc test d'acceptation obligatoire (§4).*
2. **Le compteur est un élément de navigation, pas de décoration.** DAAD l'affiche même
   filtres fermés (148) ; Mastersportal écrit « Page 1 · 5778 ». Chez LAWOL il existe
   déjà (`barre-filtres.tsx:177-178`, `role="status"`) mais reste dans la carte de
   filtres → le sortir dans une barre collante.
3. **Les états appartiennent aux routes, pas aux pages.** Aucun `loading.tsx`,
   `error.tsx`, `not-found.tsx` n'existe (`0`·B1) : chaque écran réimplémente son
   chargement et deux d'entre eux oublient le chrome (`0`·B2).
4. **Un référentiel, un import.** Filières/villes/niveaux existent en **5 copies**
   (`0`·A3) : une divergence de libellé casse un filtre sans erreur visible.
5. **La donnée manquante se déclare.** Pas de champ « montant » en base : soit on
   l'extrait (effort ~4), soit on affiche le **type** de financement (déjà dans le
   payload) et « montant non communiqué ». Jamais un vide silencieux.

## 3. Ce qu'on ne fait pas (et pourquoi)

| Tentation | Refus | Raison |
|---|---|---|
| Copier le salaire/montant en carte comme Handshake | reporté | pas de donnée : afficher un montant exigerait de l'inventer |
| Mur « créez un compte pour voir le détail » (Handshake) | refusé | LAWOL est public par choix ; le contenu de décision reste ouvert |
| Tri alphabétique unique (DAAD) | refusé | LAWOL fait déjà mieux : urgence + récence |
| Facettes SEO pré-calculées par milliers de pages (Mastersportal) | refusé pour l'instant | coût de génération et de maintenance sans preuve de trafic |
| `bg-ink` en surface sombre (anciens briefs) | interdit | charte Nuit d'Indigo : `ink` = texte uniquement |

## 4. Test d'acceptation du parcours (à rejouer avant d'annoncer)

```powershell
# 1. Filtres partageables : URL neuve = résultat filtré
node apps/web/scripts/verify-live-public.mjs https://lawol-mr.vercel.app

# 2. Facette : le compteur annoncé doit égaler le nombre de cartes rendues
#    (aujourd'hui non testé — c'est exactement le défaut JobTeaser)
# 3. Retour arrière : depuis une fiche, revenir doit restaurer les filtres
# 4. Chrome : charger /offres en 3G simulée → header visible pendant le chargement
# 5. CTA collant : à 390 px, après 1 500 px de scroll sur une fiche, « Postuler » visible
```

Critère de sortie : **5/5**. Un parcours annoncé « optimisé » sans ces 5 preuves est
une opinion, pas un résultat.

**Budget de performance mesuré le 29/10** (`05-mobile-perf.md`) : LCP stable
**≈ 3,8 s** sur `/offres` contre **1,36 s** sur l'accueil, à poids transféré identique
(~285 Ko), CLS = 0. Cible : ramener `/offres` sous 2 s de LCP sans dégrader CLS = 0.

## 5. Ordre d'implémentation (dépendances réelles)

1. **Tokens + zéro noir** (V1-01, V1-09) — tout le reste se style avec eux.
2. **États de route + chrome** (V2-02, V2-03) — sans eux, chaque écran rejoue le problème.
3. **Facettes URL** (V2-04) → **panneau filtres mobile** (V2-05) → **compteur collant** (V2-01).
4. **Fiche : L'essentiel → critères → description → CTA collant** (V3-01, V3-02, V1-02).
5. **Référentiels uniques** (V3-05) avant d'ajouter un nouveau filtre (éligibilité origine).

Ne pas inverser 1 et 4 : un CTA collant stylé avec 38 ombres en dur devra être refait.
