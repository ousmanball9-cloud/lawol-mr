# Brief P2 — Inscription web + opt-in

## Contexte
LAWOL.mr = plateforme qui envoie aux étudiants mauritaniens les offres de stage/PFE/emploi/bourse correspondant à leur profil. L'inscription se fait sur le web (pas WhatsApp). WhatsApp = canal de notification uniquement.

## Objectif
Créer un formulaire d'inscription web complet + opt-in explicite + page de confirmation.

## Spécifications

### 1. Page d'inscription (`/inscription`)
- Champs (tous requis sauf email) :
  - Téléphone (format +222 suivi de 8 chiffres, validation ^222\d{8}$)
  - Nom, Prénom
  - Université (texte libre)
  - Filière (select : informatique, genie_civil, electrique, mecanique, gestion, finance, droit, medecine, agronomie, autre)
  - Niveau (select : L1, L2, L3, M1, M2, Autre)
  - Ville (select : nouakchott, nouadhibou, kaedi, ross, aleg, autre)
  - Types recherchés (checkboxes : stage_pfe, stage_ete, emploi_junior, alternance)
- **Case à cocher opt-in explicite** (obligatoire) :
  - Texte : "J'accepte de recevoir les offres correspondant à mon profil sur WhatsApp"
  - Stocké en base : `optin_at` (timestamp), `optin_texte` (texte exact)
- Validation côté client (format téléphone, champs requis)
- Envoi à `POST /api/v1/profils`
- Gestion erreurs : téléphone invalide, doublon, serveur
- Redirection vers `/inscription/confirmation` après succès

### 2. Page de confirmation (`/inscription/confirmation`)
- Message : "Inscription réussie ! Tu recevras bientôt les offres correspondant à ton profil."
- Bouton vers la landing page

### 3. Modifications API
- `models.py` : ajouter `optin_at: Optional[datetime]`, `optin_texte: Optional[str]` à `ProfilEtudiantBase`
- `schema.sql` : ajouter colonnes `optin_at timestamptz`, `optin_texte text` à table `profils`
- `main.py` : endpoint POST /api/v1/profils accepte `optin_at` et `optin_texte`

### 4. Style
- Cohérent avec la landing page (Tailwind, indigo, font-sans)
- Responsive (mobile-first)
- Messages d'erreur en français

## Références
- `apps/api/app/modules/shared/models.py` — modèles Pydantic
- `infra/supabase/schema.sql` — schéma SQL
- `apps/web/app/page.tsx` — landing page (style)
- `apps/web/app/admin-login/page.tsx` — exemple de formulaire

## Critères de réussite
- Formulaire fonctionnel (validation, envoi, erreurs)
- Opt-in obligatoire et stocké en base
- Pages stylées et responsive
- Pas de régression (landing page, admin, API)

## Limites
- Ne pas toucher à WhatsApp (webhook, sender, notifier)
- Ne pas toucher au matching engine
- Ne pas toucher au dashboard admin
