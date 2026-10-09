# Brief — Intégration template Flowbite Admin Dashboard (section admin)

Template validé (scan sécurité : MIT, aucun pattern malveillant, pas de
postinstall). Référence clonée en local :
`C:\Users\ousman\AppData\Local\Temp\opencode\flowbite-admin`
(lire `layouts/` et `content/` pour le markup de référence : sidebar, topbar,
cards, tables).

Objectif : la **section admin** de LAWOL (actuellement brutale : page stats
texte, tables simples) prend le look et le ressenti du template Flowbite
Admin Dashboard : sidebar de navigation, topbar, cartes de statistiques,
tables stylées, page de login admin.

## 1. Dépendance

- `npm install flowbite-react` dans `apps/web` (bibliothèque React officielle
  Flowbite, MIT). Utiliser ses composants (Sidebar, Navbar, Card, Table,
  Button, Badge, Alert, Dropdown…).
- **Fallback** si conflit de version avec Next 15/Tailwind 3 : écrire les
  pages en JSX avec les classes Tailwind du template de référence (markup
  copié/adapté) + état React local pour sidebar ouvrante/dropdowns. Dans ce
  cas, zéro dépendance ajoutée.
- **PAS de apexcharts/grafiques** pour l'instant (hors scope, vitesse).

## 2. Pages à reconstruire (LOGIQUE INTACTE, design nouveau)

- `app/admin/page.tsx` : layout admin (sidebar + topbar) + cartes de stats
  (offres actives, total offres, profils actifs, total profils, matches,
  notifiés) depuis le GET `/api/admin/stats` existant.
- `app/admin/offres/page.tsx` : même layout + table Flowbite des offres
  (colonnes existantes), recherche si déjà présente, badges type.
- `app/admin/profils/page.tsx` : même layout + table Flowbite des profils.
- `app/admin-login/page.tsx` : page sign-in du template (carte centrée,
  logo LAWOL, champ mot de passe) — **logique inchangée** : POST
  `/api/admin/login` → cookie → redirect `/admin`.
- Composant partagé `components/admin/layout.tsx` (sidebar + topbar) pour
  éviter la copier-coller entre les 3 pages admin.
- Sidebar : liens Dashboard / Offres / Profils + « Déconnexion » (route
  `/api/admin/logout` existante) + lien « Voir le site ».

## 3. Garde-fous IMPÉRATIFS

- **Aucun changement de logique** : fetch, cookie `lawol_admin`, routes
  `/api/admin/*`, redirections, états loading/error. Uniquement le JSX/design.
- **Ne touche PAS** : apps/api, pages publiques (landing, profil client,
  inscription, connexion…), la matrice verify:design doit rester 30/30.
- Les routes `/api/admin/*` (Next) sont inchangées.
- Apostrophes `&apos;`, `<Link>` routes internes.
- Responsive : sidebar collapse en drawer sur mobile (comme le template).
- Pas de git.

## 4. Vérifications OBLIGATOIRES (liste résultats)

1. `npm run lint` → 0
2. `npm run build` → 0
3. `npm run verify:design` → 30/30 (les pages publiques ne régressent pas)
4. `npm run verify:modal` → 27/27
5. Test admin manuel documenté : `next start` local + login admin avec le mot
   de passe du `.env` local (ADMIN_PASSWORD_HASH) — si indisponible, mock de
   la route login + parcours des 3 pages admin (sidebar, cartes, tables),
   logout. Liste ce qui est vérifié.
