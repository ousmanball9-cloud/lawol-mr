-- 004 — Réglages du site (admin) + compteur de visites
-- À coller dans Supabase → SQL Editor (comme 003_p6.sql). Aucune donnée personnelle collectée.
-- Motif : l'admin doit gérer les numéros support / email / réseaux sans redéploiement,
-- et voir le nombre de visites — aujourd'hui il n'existe AUCUNE table de réglages.

-- 1) Réglages clé/valeur
--    Clés prévues : support_whatsapp (liste), email_contact, reseaux (jsonb), mode_maintenance
create table if not exists parametres (
  cle        text primary key,
  valeur     jsonb not null default '{}'::jsonb,
  modifie_le timestamptz not null default now()
);

alter table parametres enable row level security;

drop policy if exists "service_role_all_parametres" on parametres;
create policy "service_role_all_parametres" on parametres
  for all using (auth.role() = 'service_role');

-- 2) Visites : une ligne par vue de page publique.
--    Volontairement : PAS d'IP, PAS de user-agent, PAS d'identifiant — juste le jour et le chemin.
create table if not exists visites (
  id      bigserial primary key,
  jour    date not null default current_date,
  chemin  text not null,
  cree_le timestamptz not null default now()
);

create index if not exists visites_jour_idx on visites (jour);

alter table visites enable row level security;

drop policy if exists "service_role_all_visites" on visites;
create policy "service_role_all_visites" on visites
  for all using (auth.role() = 'service_role');
