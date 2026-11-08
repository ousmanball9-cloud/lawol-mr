-- Migration idempotente pour offres : pays_etudes + type_financement
-- Exécute dans Supabase Dashboard → SQL Editor

-- 1. Colonnes
ALTER TABLE offres
ADD COLUMN IF NOT EXISTS pays_etudes TEXT,
ADD COLUMN IF NOT EXISTS type_financement TEXT DEFAULT 'inconnu';

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_offres_pays_etudes ON offres(pays_etudes);
CREATE INDEX IF NOT EXISTS idx_offres_type_financement ON offres(type_financement);

-- 3. Valeur par défaut pour lignes existantes
UPDATE offres
SET type_financement = 'inconnu'
WHERE type_financement IS NULL;

-- 4. Contrainte CHECK (idempotente : drop si existe, puis create)
ALTER TABLE offres DROP CONSTRAINT IF EXISTS chk_type_financement;

ALTER TABLE offres
ADD CONSTRAINT chk_type_financement
CHECK (type_financement IN ('fully_funded','partiel','auto_finance','inconnu'));

-- 5. Vérification rapide
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'offres' AND column_name IN ('pays_etudes','type_financement');

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'offres'::regclass AND conname = 'chk_type_financement';