"""Diag hors-ligne : reproduit la validation OffreStagePublic sur la vraie base.

Interroge Supabase avec EXACTEMENT la requête de main.py:105-118 puis valide
chaque ligne avec OffreStagePublic.model_validate — la 1re ligne qui lève
donne la cause racine (champ + valeur). Lecture seule, zéro écriture.

Usage : python -X utf8 scripts/diag-offres-500.py [limit]   (limit défaut 1000)
"""
import sys
from datetime import UTC, datetime

sys.path.insert(0, ".")

from pydantic import ValidationError

from apps.api.app.core.database import supabase
from apps.api.app.modules.shared.models import OffreStagePublic

LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 1000

res = (
    supabase.table("offres")
    .select("*")
    .eq("active", True)
    .gte("date_limite", datetime.now(UTC).date().isoformat())
    .order("date_scrape", desc=True)
    .range(0, LIMIT - 1)
    .execute()
)
print(f"{len(res.data)} lignes recuperes (limit={LIMIT})")

erreurs = []
for i, ligne in enumerate(res.data):
    try:
        OffreStagePublic.model_validate(ligne)
    except ValidationError as e:
        erreurs.append((i, ligne.get("id"), str(e)))

print(f"{len(erreurs)} lignes en echec de validation sur {len(res.data)}")
for i, oid, err in erreurs[:5]:
    print(f"\n--- index {i} (id={oid}) ---")
    print(err[:1200])
