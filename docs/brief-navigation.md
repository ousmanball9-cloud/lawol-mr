# Brief — Navigation complète (connexion étudiant + espace gérant)

Demande utilisateur : « tout lier ». La landing doit proposer **Se connecter** →
une page d'entrée qui dirige **l'étudiant vers son profil** et **le gérant vers
le dashboard admin**. Design **GELÉ** (l'utilisateur attend un template pour
re-styler) : on utilise strictement les tokens/langage actuels, zéro refonte.

## 1. Nouvelle page `/connexion` (point d'entrée unique)

`app/connexion/page.tsx` — deux volets clairs, même carte `bg-card border-border
rounded-lg`, typo actuelle :

### Volet A — Étudiant (principal)
- Champ téléphone (préfixe visuel `+222`, saisie des 8 chiffres), validation
  identique à l'inscription (`/^222\d{8}$/` après nettoyage).
- Bouton « Accéder à mon profil » → `GET /api/v1/profils/{tel}` (route proxy
  existante) :
  - **200** → `router.push("/profil/{tel}")`
  - **404** → message « Aucun profil avec ce numéro » + lien
    « Créer mon profil » → `/inscription?tel={tel}` (l'inscription peut pré-remplir
    le champ depuis le query param `tel` — optionnel mais bienvenu).
- Lien secondaire « Pas encore inscrit ? » → `/inscription`.

### Volet B — Espace gérant (secondaire, discret)
- Bloc séparé (hairline ou carte secondaire) : « Espace gérant — réservé à
  l&apos;équipe LAWOL » avec bouton → `/admin-login` (INCHANGÉ, il fonctionne déjà :
  mot de passe → cookie → `/admin`). **Ne pas toucher à la logique de
  `/admin-login` ni aux routes `/api/admin/*`** — juste le lien.

## 2. Landing : bouton « Se connecter »

Dans `app/page.tsx` : slim header en haut du hero (hero est `bg-ink` near-black)
- logo texte « LAWOL.mr » (gauche) + bouton « Se connecter » (droite,
  `variant="outline"` style blanc translucide cohérent avec le hero) → `/connexion`.
- Ajouter aussi un lien « Déjà inscrit ? Connecte-toi » sous le CTA WhatsApp du
  hero (text-white/70, vers `/connexion`).

## 3. Lien « Déjà inscrit ? » sur l'inscription

Sous le formulaire de `app/inscription/page.tsx` : « Déjà un profil ?
**Connecte-toi** » → `/connexion`.
Si `?tel=` présent en query : pré-remplir le champ téléphone.

## 4. Réparer les liens morts du footer

Le footer de la landing lie vers `/mentions` et `/contact` qui **n'existent pas**
(404). Créer deux pages minimales, même langage que `app/confidentialite/page.tsx` :
- `app/mentions/page.tsx` : mentions légales (éditeur LAWOL.mr, contact par
  WhatsApp, hébergeur Vercel, loi mauritanienne) — contenu court et honnête.
- `app/contact/page.tsx` : bloc de contact (lien wa.me existant du site + rappel
  de l'espace gérant).

## 5. Léger alignement de `/admin-login`

La page utilise d'anciennes classes (`bg-gray-50`, `shadow-md`, `text-primary`).
La remettre au langage actuel : `bg-background`, `border-border rounded-lg
bg-card`, bouton `bg-signature text-white`. **Aucun changement de logique.**

## 6. Outils de mesure

Ajouter à `scripts/verify-design.mjs` la page `/connexion` dans la matrice
(3 cas : mobile/tablette/desktop, `mock: true` avec le mock profil existant
pour le cas « étudiant connecté », probe : champ téléphone présent + bloc
gérant présent + lien inscription présent). Le total devient 24/24.

## 7. Garde-fous

- **Zéro redesign** : uniquement tokens actuels (`bg-background`, `bg-card`,
  `border-border`, `bg-ink`, `signature`, `surlignage`, `font-display`…).
- Ne rien casser : inscription, profil, admin-login, dashboard admin,
  désinscription, modale. Aucun appel API nouveau côté serveur.
- Apostrophes `&apos;`, `<Link>` pour routes internes, zéro dépendance.
- `href` externes seulement en `<a>` avec `target="_blank" rel="noopener"`.
- Pas de git.

## 8. Vérifications obligatoires (liste les résultats)

1. `npm run lint` → 0
2. `npm run build` → 0
3. `npm run verify:design` → tout vert (24/24 après ajout des cas)
4. `npm run verify:modal` → 27/27
