# Backlog priorisé — chasse design & system design (29/10/2026)

> Synthèse des chasses **0** (état des lieux), **1** (tokens), **2** (carte & fiche),
> **3** (recherche & filtres), **4** (parcours & confiance) et **5** (mobile & perf).
> Les chasses 4 et 5 ont été **réalisées par le régisseur** après l'échec quota des agents —
> mêmes mesures, mêmes scripts rejouables ; limites détaillées en §5.
>
> **RICE** = (Impact × Confiance) / Effort. Impact 1-5 = gain pour « trouver et
> comprendre la bonne offre vite » (priorité produit validée). Effort en jours-homme.
> Confiance : 1.0 = mesuré au DOM dans le code LAWOL, 0.8 = inféré d'un concurrent.

## 1. Vague 1 — sûr et rapide (≤ 2 j, aucun risque fonctionnel)

| ID | Action | Source | I | C | E | RICE |
|---|---|---|---|---|---|---|
| V1-01 | **Supprimer les 3 violations « zéro noir »** : `bg-black/50` → `bg-nuit/40`, `#0A0A0A` du `themeColor` dark → `#1E1B4B`, `bg-gray-900/50` admin → `bg-nuit-deep/50` | 0·C1 | 5 | 1.0 | 1 | **5.0** |
| V1-02 | **CTA collant en bas de fiche mobile** (absent chez *les deux* concurrents — gain immédiat) | 2·C-JT-08, C-HS-08 | 5 | 1.0 | 1 | **5.0** |
| V1-03 | `admin/profils` : ajouter `.catch` + état d'erreur (aujourd'hui spinner permanent) | 0·B3 | 4 | 1.0 | 1 | **4.0** |
| V1-04 | **Type de financement + financeur visibles sur la carte** (champs déjà dans le payload) | 3·SP-05, 0·A5 | 4 | 0.9 | 1 | **3.6** |
| V1-05 | `prefers-reduced-motion` : couvrir `derive-nuit`, `respire-lueur`, `monte-doux` | 0·C6 | 3 | 1.0 | 1 | **3.0** |
| V1-06 | Afficher **« non communiqué »** au lieu de masquer une donnée absente | 2·C-JT-07 | 3 | 1.0 | 1 | **3.0** |
| V1-07 | Un seul parseur de date (`date-limite.ts`), supprimer la copie de la modale | 0·A1 | 3 | 1.0 | 1 | **3.0** |
| V1-08 | Composant `Spinner` unique, remplacer les 4 copies ad hoc | 0·B4 | 3 | 1.0 | 1 | **3.0** |
| V1-09 | Tokens `shadow-card/lift/panel` + `spacing` + `fontSize` ; remplacer les 38 ombres en dur | 1·T-01/T-03, 0·C2 | 4 | 1.0 | 1.5 | **2.7** |
| V1-10 | Supprimer les composants morts (`offre/OffreCard|Accordion|Tabs`) et les 2 classes mortes (`animate-slide-in`, `text-surlignage-deep`) | 0·A6, B6 | 2 | 1.0 | 1 | **2.0** |
| V1-11 | `primary` ≡ `signature` : garder `signature` comme source, alias documenté | 0·C7 | 2 | 1.0 | 1 | **2.0** |
| V1-12 | Unifier `TYPES_OFFRES` (Record vs tableau) et les 2 libellés de financement | 0·A4, A5 | 2 | 1.0 | 1 | **2.0** |
| V1-13 | **Cibles tactiles ≥ 44 px sur `/offres`** : 33 sur 45 sont sous le seuil | 5·M-01 | 5 | 1.0 | 2 | **2.5** |
| V1-14 | **Éliminer les textes < 12 px** de `/offres` (16 occurrences, 0 sur l'accueil) via l'échelle typo | 5·M-02, 1·T-03 | 4 | 1.0 | 1 | **4.0** |

**Définition de fait** : `lint` 0 · `tsc` 0 · `verify:design` vert · zéro-noir `grep` = **0**
(aujourd'hui 3) · `verify-live-public` vert après déploiement.

## 2. Vague 2 — « trouver la bonne offre vite » (priorité produit)

| ID | Action | Source | I | C | E | RICE |
|---|---|---|---|---|---|---|
| V2-01 | **Bandeau de résultats collant** (compteur + tri) sous le header | 3·SP-03, DA-06 | 4 | 1.0 | 1.5 | **2.67** |
| V2-02 | **États de route Next** : `loading.tsx`, `error.tsx`, `not-found.tsx` | 0·B1 | 4 | 1.0 | 2 | **2.0** |
| V2-03 | **Chrome conservé pendant chargement/erreur/404** (états précoces rendus hors `<Chrome>`) | 0·B2 | 4 | 1.0 | 2 | **2.0** |
| V2-04 | **Facettes dans l'URL** (`pays`, `filiere`, `financement`, `categorie`, `tri`) → partage WhatsApp | 3·SP-06 | 4 | 1.0 | 2 | **2.0** |
| V2-05 | **Panneau de filtres mobile** : bouton flottant « Filtres · n » + panneau plein écran | 3·SP-04, CF-04, DA-02 | 5 | 1.0 | 3 | **1.67** |
| V2-06 | **Instrumenter le LCP de `/offres`** (3,8 s stable vs 1,36 s accueil) : `performance.mark` avant/après le fetch + 5 passages à froid — *mesurer avant d'optimiser* | 5·M-03 | 4 | 0.8 | 1 | **3.2** |

**Test d'acceptation V2-04** (leçon JobTeaser C-JT-05) : un lien `?pays=allemagne&tri=urgence`
collé dans un navigateur neuf doit rendre **exactement** les offres filtrées — sinon la
facette ne compte pas comme faite.

**État au 03/11/2026** (`main` = `577e780`, Vercel READY) :

| ID | État | Preuve live |
|---|---|---|
| V2-02 | ✅ livré | `verify-chrome-etats` 23/23 — `loading/error/not-found` dans le chrome |
| V2-03 | ✅ livré | même harnais — `header.sticky` unique sur `/`, `/offres`, `/connexion` ; header présent AVANT les données |
| V2-04 | ✅ livré | `verify-facettes-url` **5/11 → 11/11** : `?pays=france&tri=recentes` = 9 cartes, **0 hors filtre** (avant : 11/12 hors filtre) |
| V2-01 | ✅ livré | `verify-mobile-filtres` — bandeau `sticky` à top 65 px (= bas du header) toujours visible après 1 400 px de scroll |
| V2-05 | ✅ livré | même harnais — 28/28 : 1ʳᵉ offre **862 → 437 px**, panneau `aria-modal` avec les 5 selects, Échap rend le focus, filtre → URL |
| V2-06 | ⏳ en cours | instrumentation LCP — **aucun gain de vitesse annoncé** tant qu'elle n'est pas faite |

## 3. Vague 3 — « comprendre & oser postuler »

**État au 03/11/2026** : V3-01, V3-02 et V3-08 livrés et prouvés en ligne
(`verify-chrome-etats` 24/24 : essentiel à y≈420 px, description à y≈1400 px,
pièces à préparer entre les deux).

| ID | Action | Source | I | C | E | RICE |
|---|---|---|---|---|---|---|
| V3-01 | **Bloc « L'essentiel »** en tête de fiche : 5-6 faits (financement, lieu/langue, dates exactes, niveau requis, éligibilité Mauritanie) avant toute prose | 2·C-HS-01 | 5 | 1.0 | 3 | **1.67** |
| V3-02 | **Critères éliminants remontés avant la description** (niveau, nationalité, date limite) | 2·C-JT-06 | 5 | 1.0 | 2 | **2.5** |
| V3-03 | Carte ≤ 210 px, 3 zones, **un seul** badge de confiance | 2·C-HS-05, C-JT-04 | 3 | 0.8 | 2 | **1.2** |
| V3-04 | Brancher la bibliothèque d'états existante (`EmptyGuidant`, `SkeletonCard`, `SkeletonEspace`) au lieu de « Chargement… » en texte | 0·A7, B7 | 4 | 0.9 | 2 | **1.8** |
| V3-05 | Référentiels uniques (filières, villes, niveaux) — 5 copies aujourd'hui | 0·A3 | 4 | 1.0 | 3 | **1.33** |
| V3-06 | Sections landing qui s'évaporent (compteurs, types de bourses) : repli visuel au lieu de `null` | 0·B5 | 3 | 0.9 | 1.5 | **1.8** |
| V3-07 | Palettes brutes admin/légal → tokens | 0·C3, C4 | 3 | 1.0 | 3 | **1.0** |
| V3-08 | **Checklist des pièces en tête de fiche** (pas après la description) — `DossierPieces` existe déjà | 4·P-TR-02, P-SH-02 | 5 | 1.0 | 2 | **2.5** |
| V3-09 | **Calendrier de sélection daté** : candidature → présélection → entretien → résultat | 4·P-CV-03, P-TR-01 | 4 | 1.0 | 3 | **1.33** |
| V3-10 | **Date limite par pays** quand la bourse en a plusieurs (sinon on fabrique de faux retardataires) | 4·P-CV-04 | 4 | 1.0 | 2 | **2.0** |

## 4. Vague 4 — décisions produit (à trancher, pas à coder)

| Sujet | Question | Pourquoi maintenant |
|---|---|---|
| **Montant chiffré** sur la carte/fiche | Aucun champ « montant » en base : le créer (extraction + colonne) ou s'en tenir au **type** de financement ? | Les concurrents l'affichent (« Grant 1200 EUR ») ; c'est le critère n°1, mais effort réel ~4 |
| **Thème sombre** | Bloc `.dark` complet, 0 basculeur, 9 variantes orphelines : **câbler** ou **retirer** ? | Un demi-thème est une dette qui se paie à chaque écran |
| **Éligibilité par origine** | Exposer « Je candidate depuis… » en premier filtre (DAAD, Campus France le font) | Touche l'enum d'écriture/lecture — règle 6 du dépôt |

## 5. Chasses 4 et 5 : réalisées par le régisseur (et leurs limites)

- **Chasse 4 — parcours & confiance** : ✅ **faite** (`04-parcours.md`), 11 constats mesurés
  à 390 px sur Chevening (éligibilité 17 critères, échéance par pays), Türkiye Bursları
  (« 5 étapes », 61 `<li>`, bloc « REQUIRED DOCUMENTS ») et Stipendium Hungaricum
  (premier champ à **y = 7 402 px**). Limite : le dépôt de dossier réel exige un compte
  sur les 3 sites — non contourné, donc **le tunnel de candidature complet n'est pas mesuré**.
- **Chasse 5 — mobile & perf** : ✅ **faite** (`05-mobile-perf.md`), 3 passages sur `/offres`
  + accueil. Résultat utile : LCP stable **≈ 3,8 s** sur `/offres` contre 1,36 s sur
  l'accueil, **33/45 cibles sous 44 px**, **16 textes < 12 px**, CLS = 0.
  Limites : mesure **labo** (pas de données terrain), et les concurrents **ne sont pas
  comparables** (JobTeaser 0 cliquable détecté, Handshake 2) — aucune comparaison de
  vitesse n'est affirmée.
- **Reste ouvert** : aucune mesure INP/TBT, aucune donnée CrUX, tunnel de candidature
  bout-en-bout non observé. Ce n'est pas un manque de la campagne : c'est hors de portée
  sans compte sur les sites concurrents.

## 6. État d'exécution — vague 1 (30/10/2026)

> Commit `87a4f88` (branche `design/vague1-systeme`). Gates rejouées : `npx tsc --noEmit` = 0,
> `npx eslint app components` = 0, assertion zéro-noir = **0 occurrence**. Aucune de ces preuves
> n'est une preuve **live** : la prod ne contient pas encore ces changements.

| ID | État | Preuve dans le code | Reste à prouver |
|---|---|---|---|
| V1-01 | fait | `bg-black/50` → `bg-nuit-deep/60` (`offre-detail-modal.tsx`), `bg-gray-900/50` → `bg-nuit-deep/60` (`admin/layout.tsx`), `themeColor` dark `#1E1B4B` (`app/layout.tsx`) | mesure live après déploiement |
| V1-02 | fait | `data-probe="detail-cta-collant"` + `sm:hidden` + `env(safe-area-inset-bottom)`, page en `pb-28` (`app/offres/[id]/page.tsx`) | capture mobile après déploiement |
| V1-03 | fait | `.catch` + état `erreur` + bouton « Réessayer » (`app/admin/profils/page.tsx`) | scénario réseau coupé |
| V1-04 | fait | `data-probe="offre-financement"` (type connu seulement) ; nature du financeur déjà rendue par `data-probe="offre-categorie"` | — |
| V1-05 | fait | `.fond-nuit-anime` / `.lueur-nuit` / `.entree-douce` + `motion-reduce` sur le spinner (noms réels ≠ noms du backlog, corrigé) | — |
| V1-06 | **partiel assumé** | la fiche écrit « Financement non précisé » sitôt que la valeur est absente ; la **carte** n'annonce pas une absence (12 × « non précisé » = du bruit) — décision du 29/10 | arbitrage utilisateur si besoin |
| V1-07 | fait | parseurs dupliqués supprimés de `offre-detail-modal.tsx`, import `components/offres/date-limite.ts` | — |
| V1-08 | fait | `components/ui/spinner.tsx` + 4 usages (`offres`, `fiche`, `profil`, `coffre`) | — |
| V1-09 | fait **sauf `fontSize`** | `boxShadow.card/lift/panel` + `spacing.section/gutter` ; **38** ombres `rgba(10,10,10,…)` → 0 (17 fichiers) | `fontSize` volontairement absent : l'échelle Tailwind suffit, le défaut mesuré était le `text-[11px]` ad hoc |
| V1-10 | fait | `OffreCard`/`OffreAccordion`/`OffreTabs` + dossier `offre/` en corbeille ; `animate-slide-in` et `text-surlignage-deep` supprimées | — |
| V1-11 | fait | commentaire d'alias `--primary` ≡ `--signature` (`globals.css`) | — |
| V1-12 | fait | `TYPES_OFFRES` unique via `TYPES_OFFRES_CHARTE` ; libellé de financement unique (`labelFinancement` → `labelFinancementHonteux`) | — |
| V1-13 | fait **côté code** | `min-h-11` : 11 liens footer, 7 n° + 2 flèches pagination, 5 selects, 2 bascules, champ recherche, logo, « S'inscrire », burger, « Se connecter », lien retour fiche | **33 → ? mesuré à l'écran**, exige le déploiement |
| V1-14 | fait | `text-[11px]` : **18 → 0** (9 fichiers, remplacés par `text-xs` 12 px) | — |

**Vague 1 CLOSE le 01/11/2026** (commit `9910b95`, déploiement Vercel `dpl_4PWGm5S8ZzFW9EuVEeBx1pisJA8B` READY).

Preuves live (prod, 390 px) :

| Mesure | Avant (29/10) | Après (01/11) |
|---|---|---|
| cibles sous 44 px sur `/offres` | **33 / 45** | **0 / 45** |
| textes sous 12 px sur `/offres` | **16** | **0** |
| cibles sous 44 px sur l'accueil | 2 / 23 | **0 / 23** |
| ombres `rgba(10,10,10,…)` | 38 | **0** |
| `text-[11px]` | 18 | **0** |
| LCP `/offres` (3 passages, à chaud) | 3,84 s | 2,9 – 3,6 s |
| TTFB `/offres` | 0,48 – 1,19 s | 0,52 – 0,65 s |
| poids transféré `/offres` | 298 Ko (151 Ko JS) | 297 Ko (151 Ko JS) |
| CLS | 0 | 0 |

Harnais : `node scripts/verify-cibles.mjs https://lawol-mr.vercel.app` (VERT, exit 0).
`verify:design` : lint 0, build 0, contraste 22/22, matrice **42/45**.

**Ce qui n'est PAS un gain** : la performance. LCP et TTFB sont dans la même
fourchette qu'avant — l'attente de `/offres` vient des données (fetch client),
pas du JS. Toute annonce de « site plus rapide » serait fausse.

**Ce qui reste ouvert** : les 3 KO `profil-onglet` de `verify:design` (le harnais
voit `/connexion`) — famille hors périmètre de la vague, code du profil non
touché par la refonte, middleware réel prouvé sain en prod (`/profil/{tel}`
anonyme → 307). À traiter comme un défaut de session factice du harnais.

