# Brief P6-A — Backend : entreprises & pipeline offres

Objectif : poser les fondations de l'espace entreprise (grand manque du
produit, futur modèle économique) : comptes entreprises, dépôt d'offres,
suivi des candidatures côté employeur.

## 1. Migration `infra/supabase/migrations/003_p6.sql` (idempotente)

```sql
create table if not exists entreprises (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  secteur text,
  ville ville default 'nouakchott',
  description text,
  site_url text,
  telephone text,
  email_contact text,
  logo_url text,
  verifiee boolean default false,
  actif boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- offres liées à une entreprise (nullable — les offres scraper restent sans)
alter table offres add column if not exists entreprise_id uuid references entreprises(id) on delete set null;
-- compte entreprise : accès limité à SES offres
create table if not exists comptes_entreprise (
  id uuid primary key default uuid_generate_v4(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  email text unique not null,
  password_hash text not null,
  actif boolean default true,
  created_at timestamptz default now()
);
alter table offres add column if not exists statut_publication text default 'active';
-- valeurs : active | pending_review | rejetee (les offres entreprise passent en pending_review)
alter table matches add column if not exists vu_par_entreprise boolean default false;
-- trigger update_updated_at sur entreprises (fonction existante)
```

RLS : entreprises en lecture publique (comme offres), service_role all,
comptes_entreprise : lecture seule via API key service uniquement.

## 2. Endpoints (`apps/api/app/main.py` + models)

### Auth entreprise (sans JWT — hash sha256 + token simple, même philosophie
que l'admin actuel, à documenter comme v1)
- `POST /api/v1/entreprises/inscription` : {nom, secteur?, ville?, email,
  password, description?} → crée entreprise + compte → renvoie
  {entreprise_id} (201). Email existant → 409.
- `POST /api/v1/entreprises/login` : {email, password} → vérifie hash →
  renvoie {token, entreprise_id}. Token = uuid aléatoire stocké (colonne
  `token` sur comptes_entreprise, nullable, expirable 7j — ajouter la colonne
  dans la migration).
- `POST /api/v1/entreprises/logout` : {token} → nullifie le token.

### Offres entreprise (auth token)
- `POST /api/v1/entreprises/offres` : body type OffreStageCreate + token →
  crée offre avec `statut_publication='pending_review'` + `entreprise_id`.
- `GET /api/v1/entreprises/offres?token=` : liste les offres de SON
  entreprise (avec statut, nb matches, nb postulés via joins).
- `GET /api/v1/entreprises/candidatures?token=` : tous les matches de ses
  offres actives : profil étudiant (nom, prenom, telephone, universite,
  filiere, niveau, ville) + offre + statut_candidature + date_match. C'est le
  cœur de la valeur employeur.

### Fiches entreprises (public)
- `GET /api/v1/entreprises` : liste (nom, ville, secteur, nb_offres_actives).
- `GET /api/v1/entreprises/{id}` : fiche complète + offres actives.

## 3. Admin (gérant)

- `PATCH /api/v1/admin/offres/{id}/publication` : body {statut} (active /
  rejetee) → validation des offres déposées par les entreprises. Même
  protection que les endpoints admin existants (cookie).
- Le dashboard admin devra plus tard afficher la file pending_review — backend
  : le GET admin stats peut inclure `offres_en_attente`.

## 4. Règles métier

- Une offre créée par entreprise : `source='entreprise'`,
  `source_name=nom entreprise`, `source_url` = URL publique de l'offre sur
  notre site (pattern `https://lawol.mr/offres/{id}` — à confirmer côté
  frontend plus tard, mettre simplement l'identifiant).
- Le matching engine inclut les offres entreprise **pending_review ?
  NON** — seules les `active` matchent.
- Nettoyage : aucun compte entreprise de test laissé en base.

## 5. Vérifications OBLIGATOIRES (résultats réels)

1. uvicorn local + /health ok.
2. Parcours réel documenté : inscription entreprise → login → créer offre →
   elle apparaît en pending_review → admin la passe active → matching run →
   un étudiant existant reçoit le match → GET candidatures entreprise montre
   l'étudiant. Nettoyage complet après (règle workspace).
3. Sécurité : sans token → 401 ; token d'une autre entreprise → 403/vide
   (jamais les offres d'un tiers) ; email existant → 409 ; password faible →
   422 (min 8).
4. Fallback D8 maintenu si tables absentes (503 clair, jamais 500).

## 6. Garde-fous

- Pas de git. Zéro dépendance pip. apps/web intact.
- Ne casse aucun endpoint existant (rejeu des régressions : /matches,
  /dashboard, /offres, /admin/stats).
- Password hash : sha256 + sel aléatoire par compte (documenté comme v1 —
  bcrypt via passlib si déjà disponible, sinon sha256+salt).
