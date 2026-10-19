"""Preuve MOCKÉE de la classification des offres par source — zéro réseau.

Décision 16/10/2026 : le catalogue public est « 100 % bourses » ; une offre
issue d'une source d'EMPLOI (beta.mr, LinkedIn, sites carrières) ne doit JAMAIS
être typée `bourse` — elle devient `emploi_junior` (ou `stage_pfe` pour un stage).

Prouve :
   1. `scraper/engine.py` : la règle par source (emploi vs bourse) + détection
      de stage → `stage_pfe` ; source inconnue/insensible à la casse ;
   2. le point d'écriture unique `BaseScraper.save` RÉÉCRIT `type_offre` : une
      offre beta_mr construite avec `bourse` (modèle bridé) part en base en
      `emploi_junior` ; une source « bourse » reste `bourse` (non-régression) ;
   3. `scripts/backfill-type-offre.py::planifier` : liste EXACTE des offres à
      re-typer, idempotence (2e passage = 0), filtre `--source`, et le plan ne
      porte QUE `type_offre` (aucune suppression).

Usage : python -X utf8 scripts/test-type-offre-sources.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import copy
import importlib.util
import os
import sys
import types
from datetime import UTC, datetime, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)


# ------------------------- Faux Supabase (zéro réseau) -------------------------
class _Resultat:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _FauxTable:
    def __init__(self, base, nom):
        self._base, self._nom = base, nom

    def upsert(self, donnees, on_conflict=None):
        self._base.upserts.append((self._nom, copy.deepcopy(donnees), on_conflict))
        return self

    def insert(self, donnees):
        self._base.inserts.append((self._nom, copy.deepcopy(donnees)))
        return self

    def execute(self):
        return _Resultat([{"id": "00000000-0000-0000-0000-000000000000"}])


class _FauxSupabase:
    def __init__(self):
        self.upserts = []
        self.inserts = []

    def table(self, nom):
        return _FauxTable(self, nom)


FAUX = _FauxSupabase()
_module_supabase = types.ModuleType("supabase")
_module_supabase.Client = object
_module_supabase.create_client = lambda url, key=None, **kwargs: FAUX
sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Imports --------------------------------------
from apps.api.app.modules.scraper.engine import (
    BOURSE,
    EMPLOI_JUNIOR,
    STAGE_PFE,
    categorie_bourse_pour_source,
    categoriser_source,
    est_source_emploi,
    type_offre_pour_source,
)
from apps.api.app.modules.scraper.sources.base import BaseScraper
from apps.api.app.modules.shared.models import (
    OffreStageCreate,
    SourceType,
    TypeOffre,
    Ville,
)

ECHECS = []


def check(libelle, condition, detail=""):
    print(f"  [{'OK' if condition else 'KO'}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


# ============================ 1. Règle par source ============================
print("1. engine.type_offre_pour_source — règle par source")
check("beta_mr est une source d'emploi", est_source_emploi("beta_mr") is True, "")
check("scholar-africa n'est PAS une source d'emploi", est_source_emploi("scholar-africa") is False, "")
check(
    "recrutement beta.mr → emploi_junior",
    type_offre_pour_source("beta_mr", "Recrutement d'un juriste sénior", "Avis de recrutement")
    == EMPLOI_JUNIOR,
    type_offre_pour_source("beta_mr", "Recrutement d'un juriste sénior"),
)
check(
    "offre beta.mr sans mot-stage → emploi_junior",
    type_offre_pour_source("beta_mr", "Un Ingénieur Électromécanique", "") == EMPLOI_JUNIOR,
    "",
)
check(
    "stage beta.mr (titre) → stage_pfe",
    type_offre_pour_source("beta_mr", "Stage PFE - Ingénieur Génie Civil", "") == STAGE_PFE,
    "",
)
check(
    "stage beta.mr (description « fin d'études ») → stage_pfe",
    type_offre_pour_source("beta_mr", "Projet de fin d'année", "stage de fin d’études") == STAGE_PFE,
    "",
)
check(
    "alternance → stage_pfe",
    type_offre_pour_source("beta_mr", "Contrat en alternance", "") == STAGE_PFE,
    "",
)
check(
    "linkedin (emploi) → emploi_junior",
    type_offre_pour_source("linkedin", "Data Analyst", "") == EMPLOI_JUNIOR,
    "",
)
check(
    "snim (site carrière) → emploi_junior",
    type_offre_pour_source("snim", "Ingénieur maintenance", "") == EMPLOI_JUNIOR,
    "",
)
check(
    "source bourse → bourse",
    type_offre_pour_source("scholar-africa", "Bourse d'excellence", "") == BOURSE,
    "",
)
check(
    "source inconnue → bourse (défaut)",
    type_offre_pour_source("source-inconnue-xyz", "X", "") == BOURSE,
    "",
)
check(
    "source insensible à la casse (BETA_MR) → emploi_junior",
    type_offre_pour_source("BETA_MR", "Un poste", "") == EMPLOI_JUNIOR,
    "",
)
check("categoriser_source('beta_mr') == 'emploi'", categoriser_source("beta_mr") == "emploi", "")
check("categoriser_source(None) == 'bourse'", categoriser_source(None) == "bourse", "")


# ============================ 2. Écriture (save) =============================
print("\n2. BaseScraper.save réécrit type_offre selon la source")


class _ScraperTest(BaseScraper):
    def __init__(self, nom):
        self.source_name = nom

    def fetch(self):
        return []


def _offre(titre, source_name):
    return OffreStageCreate(
        source=SourceType.ENTREPRISE,
        source_name=source_name,
        source_url=f"https://exemple.mr/{abs(hash(titre))}",
        titre=titre,
        entreprise="Exemple SARL",
        ville=Ville.NOUAKCHOTT,
        type_offre=TypeOffre.BOURSE,  # valeur bridée du modèle (placeholder)
        description="Avis de recrutement",
        date_limite=datetime.now(UTC).date() + timedelta(days=30),
    )


_ScraperTest("beta_mr").save([_offre("Recrutement d'un juriste sénior", "beta_mr")])
_nom, data, conflit = FAUX.upserts[-1]
check("upsert sur source_url (idempotent)", conflit == "source_url", str(conflit))
check("beta_mr écrit emploi_junior en base", data["type_offre"] == EMPLOI_JUNIOR, str(data["type_offre"]))
check(
    "aucune autre colonne touchée (titre/entreprise/source_name intacts)",
    data["titre"] == "Recrutement d'un juriste sénior"
    and data["entreprise"] == "Exemple SARL"
    and data["source_name"] == "beta_mr",
    str({k: data[k] for k in ("titre", "entreprise", "source_name")}),
)

_ScraperTest("beta_mr").save([_offre("Stage PFE - Développeur", "beta_mr")])
check("stage beta_mr écrit stage_pfe en base", FAUX.upserts[-1][1]["type_offre"] == STAGE_PFE, "")

_ScraperTest("scholar-africa").save([_offre("Bourse d'excellence 2026", "scholar-africa")])
check(
    "non-régression : source bourse reste bourse",
    FAUX.upserts[-1][1]["type_offre"] == BOURSE,
    str(FAUX.upserts[-1][1]["type_offre"]),
)
check(
    "le modèle d'écriture reste bridé à bourse (TypeOffre n'a que BOURSE)",
    [m.value for m in TypeOffre] == ["bourse"],
    str([m.value for m in TypeOffre]),
)


# ============================ 3. Reprise (planifier) ========================
print("\n3. backfill-type-offre.py::planifier — liste exacte, idempotent, sans suppression")
_spec = importlib.util.spec_from_file_location(
    "backfill_type_offre", RACINE / "scripts" / "backfill-type-offre.py"
)
_backfill = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_backfill)

LIGNES = [
    {"id": "1", "source_name": "beta_mr", "titre": "Recrutement d'un juriste sénior",
     "description": "Avis de recrutement", "type_offre": "bourse"},
    {"id": "2", "source_name": "beta_mr", "titre": "Stage PFE - Ingénieur Génie Civil",
     "description": "stage de fin d’études", "type_offre": "bourse"},
    {"id": "3", "source_name": "beta_mr", "titre": "Un Technicien Mécanique",
     "description": "recrute", "type_offre": "emploi_junior"},
    {"id": "4", "source_name": "scholar-africa", "titre": "Bourse d'excellence 2026",
     "description": "fully funded", "type_offre": "bourse"},
    {"id": "5", "source_name": "linkedin", "titre": "Emploi Junior - Data Analyst",
     "description": "", "type_offre": "bourse"},
]

plan = _backfill.planifier(LIGNES)
check("plan = 3 corrections", len(plan) == 3, str(len(plan)))
check("ids corrigés = {1, 2, 5}", {p["id"] for p in plan} == {"1", "2", "5"}, str([p["id"] for p in plan]))
check(
    "1 (recrutement) bourse → emploi_junior",
    (plan[0]["de"], plan[0]["vers"]) == ("bourse", "emploi_junior"),
    str(plan[0]),
)
check(
    "2 (stage) bourse → stage_pfe",
    (plan[1]["de"], plan[1]["vers"]) == ("bourse", "stage_pfe"),
    str(plan[1]),
)
check("5 (linkedin) bourse → emploi_junior", (plan[2]["de"], plan[2]["vers"]) == ("bourse", "emploi_junior"), str(plan[2]))
check(
    "le plan NE change QUE type_offre (colonnes id/de/vers/titre/source uniquement)",
    all(set(p) == {"id", "source_name", "titre", "de", "vers"} for p in plan),
    str(sorted(plan[0])),
)
check("aucune ligne supprimée du plan (5 lignes lues → plan partiel)", len(LIGNES) == 5, "")

plan_beta = _backfill.planifier(LIGNES, filtre_source="beta_mr")
check("filtre --source beta_mr → ids {1, 2}", {p["id"] for p in plan_beta} == {"1", "2"}, str([p["id"] for p in plan_beta]))

# idempotence : on applique le plan, un 2e passage ne trouve plus rien
APPLIQUEES = copy.deepcopy(LIGNES)
_par_id = {ligne["id"]: ligne for ligne in APPLIQUEES}
for p in plan:
    _par_id[p["id"]]["type_offre"] = p["vers"]
check("idempotence : 2e passage = 0 correction", _backfill.planifier(APPLIQUEES) == [], "")
check(
    "après reprise : plus AUCUNE « bourse » pour beta_mr/linkedin",
    [l for l in APPLIQUEES if l["source_name"] in ("beta_mr", "linkedin") and l["type_offre"] == "bourse"] == [],
    str(APPLIQUEES),
)
check(
    "les bourses légitimes sont intactes (scholar-africa reste bourse)",
    _par_id["4"]["type_offre"] == "bourse",
    "",
)

# ==================== 4. Axe financeur (catégorie de bourse) =================
# Second axe, indépendant de la NATURE : il vit dans offres.metadata (jsonb).
# On vérifie que les deux règles ne se contredisent jamais.
print("\n4. Cohérence nature (type_offre) × financeur (categorie_bourse)")
check(
    "source d'emploi → catégorie inconnue (ce n'est pas une bourse)",
    categorie_bourse_pour_source("beta_mr") == "inconnu",
    categorie_bourse_pour_source("beta_mr"),
)
check(
    "source de bourse non classée → inconnu (financeur jamais deviné)",
    categorie_bourse_pour_source("scholar-africa") == "inconnu",
    categorie_bourse_pour_source("scholar-africa"),
)
check(
    "DAAD officiel → gouvernementale ; blog daad-scholarship → inconnu",
    categorie_bourse_pour_source("daad") == "gouvernementale"
    and categorie_bourse_pour_source("daad-scholarship") == "inconnu",
    f"daad={categorie_bourse_pour_source('daad')} blog={categorie_bourse_pour_source('daad-scholarship')}",
)
_ScraperTest("beta_mr").save([_offre("Recrutement d'un juriste sénior", "beta_mr")])
_deux_axes = FAUX.upserts[-1][1]
check(
    "l'écriture pose les DEUX axes sans conflit (nature emploi_junior + financeur inconnu)",
    _deux_axes["type_offre"] == EMPLOI_JUNIOR
    and _deux_axes["metadata"]["categorie_bourse"] == "inconnu",
    str((_deux_axes["type_offre"], _deux_axes["metadata"])),
)
check(
    "l'axe financeur ne touche PAS la colonne type_offre d'une bourse",
    FAUX.upserts[2][1]["type_offre"] == BOURSE
    and FAUX.upserts[2][1]["metadata"]["categorie_bourse"] == "inconnu",
    str((FAUX.upserts[2][1]["type_offre"], FAUX.upserts[2][1]["metadata"])),
)

# --------------------------------- Bilan --------------------------------------
print(f"\n{'=' * 60}")
if ECHECS:
    print(f"RÉSULTAT : {len(ECHECS)} échec(s) → {ECHECS}")
    sys.exit(1)
print("RÉSULTAT : 100 % des checks sont VERTS (zéro réseau, zéro migration SQL).")
