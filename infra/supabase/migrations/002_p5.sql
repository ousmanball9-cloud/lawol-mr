-- P5-A : favoris + statut de candidature (migrations idempotentes, relancer sans danger)
alter table matches add column if not exists favori boolean default false;
alter table matches add column if not exists statut_candidature text;
