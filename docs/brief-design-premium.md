# Brief — Refonte visuelle « Épuré premium » (v2)

Direction **validée par l'utilisateur** : Épuré premium (références : Stripe, Linear, Vercel).
Objectif dur : un visiteur doit penser « produit sérieux, international » —
**jamais** « template SaaS violet ». Le site actuel = 3/10 (propre mais générique),
cible : le meilleur possible sans casser le fonctionnel.

## 1. Design system

### 1.1 Palette (tokens dans globals.css)

- **Neutres** : fond de site `#FAFAFA`, cartes/blancs `#FFFFFF`, texte principal
  `#0A0A0A`, texte secondaire `#52525B`, bordures fines `#E4E4E7` (1px).
- **UNE seule couleur signature** — choisir **bleu électrique `#2563EB`** (ou vert
  émeraude `#059669` si meilleur rendu) et l'appliquer avec **parcimonie** :
  CTA principal, liens, focus rings, un mot-clé maximum par grand titre, hairline
  de surlignage. **Jamais** en dégradé criard, **jamais** en fond de carte coloré.
- **Sections sombres** : hero de la landing + bloc CTA final en near-black
  `#0A0A0A` (texte blanc) = ancrage premium. L'accent signature uniquement sur
  le bouton CTA de ces blocs.
- **Supprimer** : dégradés indigo→violet, ombres colorées (`shadow-primary/10`),
  fonds `bg-primary/10` généralisés, halo violet derrière l'avatar.

### 1.2 Typographie (next/font Google Fonts — zéro dépendance npm)

- **Titres** : fonte display avec caractère (ex. `Sora` ou `Space Grotesk` via
  next/font), poids 600-700, `letter-spacing: -0.02em` sur les gros titres.
- **Texte** : `Inter` (déjà utilisé) ou `Manrope` — lisibilité FR impeccable.
- **Hiérarchie** : hero en `clamp()` fluide (≈ 2.5rem → 4rem), interlignage
  aéré, « overline labels » (petites capitales, tracking large) pour les
  eyebrows/étapes.

### 1.3 Détails de finition

- **Rayons** : `rounded-lg` pour cartes/champs (bordure 1px) ; **plus** de
  `rounded-2xl` systématique.
- **Ombres** : quasi nulles. La profondeur vient des **bordures fines** ; au
  survol d'une carte : la bordure prend la couleur signature (transition douce).
- **Boutons** : CTA plein (signature) + secondary outline fin ; hover = légère
  élévation sobre ou inversion. Boutons d'action secondaires du profil idem.
- **Espacements** : sections `py-24`/`py-32`, contenu `max-w-5xl` aligné, grille
  régulière.
- **Badges types d'offres** (PFE/junior/bourse/été/alternance) : version
  **épurée** — petites capitales + bordure fine neutre ou teinte très douce.
  **Zéro** rainbow de 5 couleurs vives.
- **Modale détail offre** : même langage (bordure fine, fond blanc, CTA
  signature) — restyler sans toucher à la logique.
- **Icônes** : lucide-react déjà présent — garder, strokes fins.

## 2. Pages à refondre (même langage partout)

`app/page.tsx` (landing), `app/inscription/page.tsx`,
`app/inscription/confirmation/page.tsx`, `app/profil/[telephone]/page.tsx`,
`app/profil/[telephone]/edit/page.tsx`, `components/offre-detail-modal.tsx`,
`app/layout.tsx` (fonts), `app/globals.css` (tokens).

## 3. Garde-fous IMPÉRATIFS

- **Ne rien casser** : tous les fetch, handlers (`handlePostule`,
  `handleDesinscrire`, `handlePartager`, `handleActualiser`), filtres, modale,
  formulaires, validation `^222\d{8}$`, opt-in, états vides/erreur.
- Apostrophes en `&apos;` (lint Next) ; `<Link>` jamais `<a>` pour routes internes.
- **Zéro dépendance npm**.
- **Outils de mesure** : si le markup change, adapter les **probes** de
  `scripts/verify-design.mjs` (cibler le NOUVEL élément équivalent) et les paires
  de `runContrastChecks` (couvrir la NOUVELLE palette : texte/noir, CTA/signature,
  badges, sections sombres). **Jamais** affaiblir un `expect` pour faire passer
  un test — changer le probe, pas le seuil.
- Contraste **WCAG AA minimum partout** (l'outil mesure, 19+ paires attendues).
- **Pas de git** (commit fait par le pilote).

## 4. Vérifications OBLIGATOIRES (liste les 4 avec résultats)

1. `npm run lint` → 0 erreur
2. `npm run build` → 0 erreur
3. `npm run verify:design` → **TOUT VERT** (21/21, budget 10 min)
4. `npm run verify:modal` → **27/27** (modale restylée mais logique inchangée)

Livrable : fichiers modifiés + les 4 vérifications listées + 1 phrase par page
décrivant le nouveau rendu + les 2 couleurs retenues (signature + surlignage).
