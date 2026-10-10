-- P6-A : comptes entreprises, dépôt d'offres, file de validation (idempotent)
-- Relancer sans danger : toutes les instructions vérifient l'existence avant création.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1) Fiches entreprises (lecture publique)
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

-- 2) Offres liées à une entreprise (nullable : les offres scraper restent sans)
alter table offres add column if not exists entreprise_id uuid references entreprises(id) on delete set null;

-- 3) Compte entreprise (accès limité à SES offres) — v1 : sha256+sel, token uuid
create table if not exists comptes_entreprise (
  id uuid primary key default uuid_generate_v4(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  email text unique not null,
  password_hash text not null,
  actif boolean default true,
  token text,
  token_expires_at timestamptz,
  created_at timestamptz default now()
);

-- 4) File de validation des offres déposées par les entreprises
--    valeurs : active | pending_review | rejetee
alter table offres add column if not exists statut_publication text default 'active';

-- 5) Suivi employeur : le match a-t-il été vu par l'entreprise ?
alter table matches add column if not exists vu_par_entreprise boolean default false;

-- 6) trigger update_updated_at sur entreprises (fonction existante)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'update_entreprises_updated_at') then
    create trigger update_entreprises_updated_at
      before update on entreprises
      for each row execute function update_updated_at_column();
  end if;
end $$;

-- 7) RLS : entreprises en lecture publique, service_role en toutes choses ;
--    comptes_entreprise : jamais lu sans clé service.
alter table entreprises enable row level security;
alter table comptes_entreprise enable row level security;

drop policy if exists "public_read_entreprises" on entreprises;
create policy "public_read_entreprises" on entreprises for select using (true);

drop policy if exists "service_role_all_entreprises" on entreprises;
create policy "service_role_all_entreprises" on entreprises
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service_role_all_comptes_entreprise" on comptes_entreprise;
create policy "service_role_all_comptes_entreprise" on comptes_entreprise
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
