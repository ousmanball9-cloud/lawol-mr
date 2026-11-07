# Design system v2 — LAWOL.mr (proposition, 29/10/2026)

> Statut : **proposition issue de mesures**, rien n'est implémenté. Toute ligne dit
> d'où elle vient (`0` = état des lieux, `1` = tokens, `2` = carte/fiche, `3` = recherche).
> Vérification obligatoire avant annonce : `npm run verify:design` + zéro-noir `grep`.

## 1. Ce qui manque aujourd'hui (mesuré, pas supposé)

| Famille | État réel | Conséquence |
|---|---|---|
| Couleur | ✅ tokens complets (`ink`, `nuit`, `signature`, `surlignage`) | — |
| **Espacement** | ❌ aucun token ; `p-4/p-6/p-8` au cas par cas | pas de rythme vertical |
| **Ombre** | ❌ aucune tokenisée ; **38 occurrences** `rgba(10,10,10,…)` en dur | noir interdit + duplication |
| **Typographie** | ❌ aucune échelle ; `text-[11px]` ad hoc | hiérarchie incohérente |
| Rayon | ⚠️ `--radius` 0.5rem utilisé, mais 3 rendus de pastille différents | badge qui change de couleur selon l'écran |
| Motion | ⚠️ 4 classes de charte ; `prefers-reduced-motion` couvre 2 keyframes sur 7 | accessibilité incomplète |

## 2. Tokens v2 (à ajouter, couleur inchangée)

```ts
// tailwind.config.ts — theme.extend (couleurs : ne rien toucher)
spacing:  { 1:'4px', 2:'8px', 3:'12px', 4:'16px', 6:'24px', 8:'32px',
            12:'48px', 16:'64px', 24:'96px' },
boxShadow:{ card:  '0 1px 2px rgba(30,27,75,0.06), 0 0 0 1px rgba(30,27,75,0.06)',
            lift:  '0 2px 6px rgba(30,27,75,0.10), 0 0 0 1px rgba(37,99,235,0.35)',
            panel: '0 12px 32px rgba(30,27,75,0.16), 0 0 0 1px rgba(30,27,75,0.08)' },
fontSize: { '2xs':'11px/16px', xs:'12px/18px', sm:'14px/20px', base:'16px/24px',
            lg:'18px/26px', xl:'22px/30px', '2xl':'26px/34px', '3xl':'32px/40px' },
```

Justification chiffrée (`01-tokens.md`) : Stripe **0 ombre** au DOM, Linear uniquement des
**anneaux 1px inset**, Airbnb 1 (focus) → la profondeur vient de la **bordure**, pas du flou.
Échelle typo de 6-8 paliers maximum chez les trois.

## 3. Règles d'or (complètent celles du skill `design-system`)

1. **Zéro noir, y compris dans les ombres** : `rgba(0,0,0,…)` est une violation au même
   titre que `#0A0A0A`. La teinte d'ombre est l'indigo (`30,27,75`).
2. **Un seul rayon de carte** : `rounded-lg` (8px). Pas de 4px, pas de 12px sur une carte.
3. **44 px minimum** pour toute cible tactile (Stripe 48, Linear 44 sur ses CTA réels).
   **Mesuré le 29/10 : 33 cibles sur 45 sont sous 44 px sur `/offres`** — la règle est écrite
   mais pas tenue (`05-mobile-perf.md` M-01). Et **16 textes sous 12 px** sur cette même
   page, contre 0 sur l'accueil (M-02).
4. **Un badge de confiance par carte** : jamais « qualité du processus » + « mise en avant
   commerciale » côte à côte (leçon JobTeaser `C-JT-04`).
5. **Donnée absente = état explicite** (« non communiqué »), jamais un champ supprimé
   (leçon `C-JT-07`) — déjà pratiqué sur `financement.tsx:14-17`, à généraliser.
6. **Une pastille = un rendu** : `CarteOffre`, `BadgeEcheance` et la modale rendent
   aujourd'hui trois versions différentes de « Clôturée » (`0`·A2) → un seul composant.
7. **Rien de mort** : un composant sans consommateur est supprimé ou branché. Aujourd'hui
   9 composants sont dans cet état (`EmptyGuidant`, `SkeletonCard`, `KpiCard`,
   `CircularProgress`, `Sparkline`, `PostesBarres`, `SkeletonEspace`, `OffreCard`,
   `OffreAccordion`).

## 4. Matrice composants × états (cible)

États requis pour **chaque** composant de catalogue : `repos` · `survol` · `focus-visible`
· `chargement` · `vide` · `erreur` · `donnée absente` · `expiré`.

| Composant | Aujourd'hui | Cible |
|---|---|---|
| `CarteOffre` | repos/survol/focus/expiré ✅ · pas de financement | + financement, + « non communiqué » |
| `BarreFiltres` | desktop ✅ · mobile = 4 `select` empilés | + panneau mobile, + facettes URL |
| `BadgeEcheance` | 4 branches ✅ mais 3 rendus concurrents | un seul rendu partagé |
| `OffreDetailModal` | focus/Échap ✅ · overlay noir | overlay indigo + CTA collant |
| `DossierPieces` | chargement/vide/erreur/refus ✅ | + squelette au lieu de texte |
| Admin | 1 écran sur 5 avec erreur gérée | erreur + vide + squelette partout |

## 5. Preuve exigée (aucune annonce sans mesure)

1. `npm run lint` → 0 · `npx tsc --noEmit` → 0.
2. `npm run verify:design` → **WCAG 22/22 · matrice 39/39 · largeur 8/8**.
3. `grep -E "bg-ink|#0A0A0A|rgba\(0, ?0, ?0" apps/web/{app,components}` → **0**.
4. `node apps/web/scripts/verify-live-public.mjs https://lawol-mr.vercel.app` après déploiement.
5. Contrôle visuel d'un cas par famille (carte, fiche, filtres, admin) — capture relue.
