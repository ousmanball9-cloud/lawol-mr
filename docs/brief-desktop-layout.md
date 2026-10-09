# Brief — Adaptation desktop (layout riche grand écran)

Feedback utilisateur : « la vue sur ordinateur doit être grande, pas comme sur
smartphone, l'app doit s'adater ». Objectif : chaque page exploitte la largeur
disponible sur desktop (>1024px) au lieu d'une colonne centrée type mobile.

## Principe commun

- **Mobile** : inchangé (1 colonne, max-w étroits actuels).
- **Tablette (768px+)** : grilles 2 colonnes où pertinent.
- **Desktop (1024px+)** : conteneurs élargis `max-w-6xl`/`max-w-7xl`,
  grilles multi-colonnes, colonnes latérales, densité visuelle augmentée.
  Rien ne doit « flotter » au milieu avec des km de vide latéral.

## Pages concernées

### 1. Landing `app/page.tsx`
- Hero : conteneur élargi `max-w-6xl`, titre plus imposant sur desktop.
- Sections (étapes, avantages, sources) : grilles 3 colonnes sur desktop
  (actuellement 1 colonne ou 2 max).
- Footer : 3-4 colonnes sur desktop.

### 2. Espace client `app/profil/[telephone]/page.tsx` (le plus important)
Sur desktop, passer d'une colonne à **un vrai layout d'application** :
- **Colonne gauche** (≈300px, sticky) : en-tête profil (avatar initiales,
  nom, université), score de profil (jauge), bouton Paramètres, bouton
  éditer, désinscription.
- **Colonne droite (fluid)** : bandeau résumé (3 cartes côte à côte),
  bloc « Marché des postes » (2 colonnes de chips), onglets
  Offres/Historique, et la **grille d'offres en 2-3 colonnes** (cartes
  d'offres actuelles en colonne unique).
- Filtres : barre horizontale au-dessus de la grille sur desktop.
- La modale reste centrée `max-w-2xl` (inchangée).

### 3. `app/profil/[telephone]/parametres/page.tsx`
- Desktop : `max-w-4xl`, sections en 2 colonnes (préférences | compte/liens).

### 4. Pages formulaire (`inscription`, `connexion`, `edit`, `admin-login`)
- Pattern double-panneau desktop : panneau gauche branding/illustration texte
  (fond `bg-ink`, slogan + points forts, masqué en mobile) + formulaire à
  droite. Mobile : formulaire seul (inchangé).

### 5. Pages légales (`mentions`, `contact`, `confidentialite`, `conditions`)
- Inchangées ou `max-w-3xl` (lecture longue : centré = correct).

## Outils de mesure

- `scripts/verify-design.mjs` : la matrice a déjà 3 viewports. **Ajouter au
  probe des cas existants** (landing, accueil, profil-edit…) un check
  desktop de largeur exploitée : ex. sur landing desktop, le hero fait
  ≥ 70 % de la largeur viewport (mesuré via boundingClientRect du conteneur
  principal). Objectif : prouver que le layout s'élargit, pas seulement qu'il
  ne déborde pas.
- Les probes existants ne doivent PAS être affaiblis : s'ils ciblent un
  conteneur max-w-2xl qui devient max-w-6xl, le adapter (cibler le nouvel
  élément équivalent).

## Garde-fous

- **Aucune logique touchée** : handlers, fetch, filtres, modale, favoris,
  statut, paramètres — uniquement le JSX/classNames de mise en page.
- Zéro régression mobile : les 3 viewports verts, overflow 0 partout.
- Contraste AA maintenu (l'outil mesure).
- Design tokens actuels (pas de refonte, juste de l'espace).
- `<Link>` routes internes, `&apos;`, pas de git.

## Vérifications OBLIGATOIRES

1. `npm run lint` → 0
2. `npm run build` → 0
3. `npm run verify:design` → tout vert (30/30 + nouveaux checks desktop)
4. `npm run verify:modal` → 27/27
5. Description en 1 phrase par page du layout desktop retenu.
