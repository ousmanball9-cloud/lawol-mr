-- 005 — Aligner l'enum PostgreSQL `filiere` sur le code (35 filières)
--
-- Constat du 26/10/2026 : `apps/api/app/modules/shared/models.py` déclare 35
-- filières, mais l'enum SQL `filiere` est resté sur les 10 valeurs de
-- `infra/supabase/schema.sql`. Mesure en collecte réelle :
--   scholar-africa → 58 offres lues, 3 insérées, 55 REFUSÉES (22P02)
-- parce qu'une offre « générique » porte TOUTES les filières : une seule
-- valeur absente de l'enum fait sauter l'offre entière.
-- Effet produit plus grave : `profils.filiere` utilise le même enum, donc un
-- étudiant de ces filières ne peut pas s'inscrire.
--
-- Le code tolère désormais (BaseScraper.save élague et TRACE la valeur refusée
-- dans `metadata.filieres_ignorees_base`), mais la donnée reste incomplète :
-- ce fichier est le correctif de fond.
--
-- Application : Supabase → SQL Editor → coller TOUT ce fichier → Run.
-- `add value if not exists` = idempotent (relançable sans effet de bord).
-- À exécuter SEUL (ne pas mélanger avec des requêtes qui utilisent ces
-- valeurs dans la même transaction).
--
-- Contrôle après application :
--   select unnest(enum_range(null::filiere)) as valeur_bd order by 1;
--   → doit renvoyer 35 valeurs, identiques à Filiere dans models.py.

alter type filiere add value if not exists 'informatique';
alter type filiere add value if not exists 'genie_civil';
alter type filiere add value if not exists 'electrique';
alter type filiere add value if not exists 'mecanique';
alter type filiere add value if not exists 'gestion';
alter type filiere add value if not exists 'finance';
alter type filiere add value if not exists 'droit';
alter type filiere add value if not exists 'medecine';
alter type filiere add value if not exists 'agronomie';
alter type filiere add value if not exists 'genie_procedes';
alter type filiere add value if not exists 'environnement';
alter type filiere add value if not exists 'genie_chimique';
alter type filiere add value if not exists 'genie_industriel';
alter type filiere add value if not exists 'telecoms';
alter type filiere add value if not exists 'reseaux';
alter type filiere add value if not exists 'cybersecurite';
alter type filiere add value if not exists 'data_science';
alter type filiere add value if not exists 'intelligence_artificielle';
alter type filiere add value if not exists 'mathematiques';
alter type filiere add value if not exists 'physique';
alter type filiere add value if not exists 'chimie';
alter type filiere add value if not exists 'biologie';
alter type filiere add value if not exists 'geologie';
alter type filiere add value if not exists 'hydraulique';
alter type filiere add value if not exists 'topographie';
alter type filiere add value if not exists 'architecture';
alter type filiere add value if not exists 'urbanisme';
alter type filiere add value if not exists 'sciences_politiques';
alter type filiere add value if not exists 'sociologie';
alter type filiere add value if not exists 'psychologie';
alter type filiere add value if not exists 'langues';
alter type filiere add value if not exists 'lettres';
alter type filiere add value if not exists 'histoire';
alter type filiere add value if not exists 'geographie';
alter type filiere add value if not exists 'autre';
