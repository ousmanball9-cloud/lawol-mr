# Brief P5-B — Frontend : espace client enrichi (accueil + paramètres)

Design **GELÉ** (tokens/langage actuels, l'utilisateur attend son template).
Backend déjà livré et poussé (commit 473f95d) — les endpoints existent sur
l'API Railway ; le web les atteint via les **route handlers proxy** (pattern
`app/api/v1/**/route.ts` existant : suivre exactement ce pattern pour les 5
nouvelles routes).

## 1. Nouvelles routes proxy ( Next.js → Railway )

Dans `apps/web/app/api/v1/` (même helper/forwarding que les routes existantes) :
- `dashboard/[telephone]/route.ts` → `GET /api/v1/dashboard/{tel}`
- `matches/[matchId]/favori/route.ts` → `PATCH .../favori`
- `matches/[matchId]/statut/route.ts` → `PATCH .../statut`
- `profils/[telephone]/historique/route.ts` → `GET .../historique`
- `profils/[telephone]/preferences/route.ts` → `PATCH .../preferences`

## 2. Accueil client = `app/profil/[telephone]/page.tsx` enrichi

Conserver TOUT l'existant (fetch matches, filtres, handlers, modale) et ajouter
**au-dessus** de la liste :

1. **Bandeau résumé hebdo** (3 cartes `bg-card border-border rounded-lg`) :
   - « À postuler » : `resume.offres_dispo`
   - « Nouvelles (7 jours) » : `resume.nouvelles_7j`
   - « Postulées » : `resume.postules_total`
   Fetch `GET /api/v1/dashboard/{tel}` au chargement. En cas d'erreur API :
   bandeau masqué silencieusement (la page reste utilisable).
2. **Bloc « Marché des postes — cette année »** : les `postes_annee[]`
   (poste + count) en liste compacte (ex : « Développeur — 14 offres »).
   Vider le bloc si tableau vide.
3. **Score de profil** : jauge horizontale simple (barre) + « Profil complété
   à X % » (depuis `profil.score_profil`). Si < 100 : lien « Compléter mon
   profil » → `/profil/{tel}/edit`.
4. **☆ Favori** sur chaque carte d'offre (icône lucide `Star`, outline →
   fill `text-surlignage` si `favori`). Clic → `PATCH favori` + état optimiste.
   **Gestion 503** (migration pas encore appliquée) : message discret 3 s
   « Favoris en cours d'activation » + retour à l'état initial. Jamais de crash.
5. **Sélecteur de statut** sur les offres postulées (`postule=true`) : menu
   déroulant inline (Postulé / En cours / Réponse reçue / Entretien / Accepté /
   Refusé) → `PATCH statut`. Même gestion 503.
6. **Onglets** discrets en haut : « Offres » (actif) / « Historique » →
   nouvelle vue dans la même page ou route `app/profil/[telephone]/historique/page.tsx`
   utilisant le proxy historique (liste triée date desc avec statut + date).

## 3. Page `app/profil/[telephone]/parametres/page.tsx` (nouvelle)

Bouton « ⚙ Paramètres » visible dans l'en-tête du profil → cette page :
- **Profil** : lien « Modifier mon profil » → `/edit` (formulaire existant).
- **Préférences avancées** : formulaire — villes exclues (multi-select `Ville`),
  types d'offres à masquer (multi-select `TypeOffre`), seuil de pertinence
  (slider 0-100, pas 10). Sauvegarde → `PATCH preferences`. Feedback succès.
  Préchargement depuis `metadata.prefs_avancees` si présent.
- **Parrainage** : bouton « Recommander à un camarade » → lien wa.me pré-rempli
  (texte existant du site) + bouton copier le lien du profil.
- **Liens** : Conditions d'utilisation, Confidentialité, Mentions, Contact.
- **Désinscription** : bouton rouge discret (existant) → confirmation →
  `POST desinscription` → redirection landing.

## 4. Outils de mesure

`scripts/verify-design.mjs` : ajouter les cas —
`accueil` (mock : dashboard + matches enrichis OFFRES_EXTRAS avec favori/statut)
× 3 viewports, et `parametres` × 3 viewports. Adapter les probes existants si
le markup du profil change (cartes résumé = éléments additionnels, la liste
offres reste). Le total sera 30/30.

## 5. Garde-fous IMPÉRATIFS

- **Aucune logique existante cassée** : handlers, filtres, modale, opt-in,
  validation, désinscription, fetch existants intacts.
- **503 = dégradation propre** partout (favoris/statut) tant que la migration
  `002_p5.sql` n'est pas appliquée — tester les DEUX cas (200 simulé + 503).
- Apostrophes `&apos;`, `<Link>` routes internes, zéro dépendance npm.
- Probes/paires de contraste : adapter si markup change, **jamais** affaiblir
  un expect.
- Pas de git.

## 6. Vérifications OBLIGATOIRES (liste résultats)

1. `npm run lint` → 0
2. `npm run build` → 0
3. `npm run verify:design` → tout vert (30/30)
4. `npm run verify:modal` → 27/27
5. Test manuel documenté : parcours accueil (bandeau, bloc postes, ★, statut,
   onglet historique, paramètres) — liste ce qui est vérifié et comment.
