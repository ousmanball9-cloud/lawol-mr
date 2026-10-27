"""Preuve MOCKÉE de la persistance ET relecture des préférences avancées — zéro réseau.

Prouve, pour l'endpoint /api/v1/profils/{tel}/preferences :
    1. PATCH persiste bien villes_exclues + types_masques + seuil_pertinence
       (fusion, pas écrasement des autres clés metadata comme code_pin_hash) ;
    2. GET les restitue ;
    3. profil sans préférence → défauts (villes_exclues=[], types_masques=[], seuil_pertinence=0).

Usage : python -X utf8 scripts/test-preferences-avancees.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import copy
import json
import os
import sys
import time
import types
from pathlib import Path
from uuid import uuid4

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
        self._base, self._nom, self._mode = base, nom, "select"
        self._filtres, self._donnees = [], None
        self._limite = None

    def select(self, colonnes="*", count=None):
        self._mode = "select"
        return self

    def eq(self, colonne, valeur):
        self._filtres.append((colonne, valeur))
        return self

    def order(self, colonne, desc=False):
        return self

    def limit(self, n):
        self._limite = n
        return self

    def update(self, donnees):
        self._mode, self._donnees = "update", donnees
        return self

    def insert(self, donnees):
        raise AssertionError("insert non attendu dans cette preuve")

    def execute(self):
        lignes = [
            ligne
            for ligne in self._base.tables.setdefault(self._nom, [])
            if all(ligne.get(c) == v for c, v in self._filtres)
        ]
        if self._mode == "select":
            if self._limite is not None:
                lignes = lignes[: self._limite]
            return _Resultat([copy.deepcopy(l) for l in lignes])  # = aller-retour JSON
        if self._mode == "update":
            for ligne in lignes:
                ligne.update(copy.deepcopy(self._donnees))
            return _Resultat([copy.deepcopy(l) for l in lignes])
        raise AssertionError(f"mode inattendu : {self._mode}")


class _FauxSupabase:
    def __init__(self):
        self.tables = {}

    def table(self, nom):
        return _FauxTable(self, nom)


FAUX = _FauxSupabase()
_module_supabase = types.ModuleType("supabase")
_module_supabase.Client = object
_module_supabase.create_client = lambda url, key=None, **kwargs: FAUX
sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Application ----------------------------------
from fastapi.testclient import TestClient

from apps.api.app import main as main_module
from apps.api.app.modules.auth.session import creer_token

client = TestClient(main_module.app)

TEL_A = "22236000001"
ID_A = str(uuid4())

# Profil AVEC metadata existant (code_pin_hash + docs) pour tester la fusion
FAUX.tables["profils"] = [
    {
        "id": ID_A,
        "telephone": TEL_A,
        "nom": "Ould Ahmed",
        "prenom": "Fatimetou",
        "email": "fatimetou@example.mr",
        "universite": "Universite de Nouakchott",
        "filiere": "informatique",
        "niveau": "M2",
        "types_recherches": ["bourse"],
        "filieres_interet": ["data_science"],
        "optin_texte": "J'accepte de recevoir les offres sur WhatsApp",
        "date_inscription": "2026-01-05",
        "created_at": "2026-01-05T09:00:00+00:00",
        "actif": True,
        "metadata": {
            "code_pin_hash": "pbkdf2$secret-a-ne-pas-fuiter",
            "documents": [],
            "prefs_avancees": {"seuil_pertinence": 30, "pays_favoris": ["france"]}
        },
    },
]

ECHECS = []


def check(libelle, condition, detail=""):
    print(f"  [{'OK' if condition else 'KO'}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


def entete(tel):
    jeton, _ = creer_token(tel)
    return {"Authorization": f"Bearer {jeton}"}


def corps(r):
    try:
        return r.json()
    except ValueError:
        return {}


# ================== 1. PATCH fusionne sans écraser metadata existant ==========
print("\nPATCH /preferences : fusion (pas d'écrasement des autres clés metadata)")
url = f"/api/v1/profils/{TEL_A}/preferences"
body = {
    "villes_exclues": ["nouakchott", "kaedi"],
    "types_masques": ["stage_pfe"],
    "seuil_pertinence": 50,
}
r = client.patch(url, json=body, headers=entete(TEL_A))
check("PATCH → 200", r.status_code == 200, f"reçu {r.status_code} : {corps(r)}")
rep = corps(r)
check("Réponse contient telephone", "telephone" in rep)
check("Réponse contient prefs_avancees", "prefs_avancees" in rep)
check("prefs_avancees.villes_exclues = ['nouakchott','kaedi']", rep.get("prefs_avancees", {}).get("villes_exclues") == ["nouakchott", "kaedi"])
check("prefs_avancees.types_masques = ['stage_pfe']", rep.get("prefs_avancees", {}).get("types_masques") == ["stage_pfe"])
check("prefs_avancees.seuil_pertinence = 50", rep.get("prefs_avancees", {}).get("seuil_pertinence") == 50)

# Vérifier en base : metadata.code_pin_hash et docs sont conservés
profil_en_base = FAUX.tables["profils"][0]
meta = profil_en_base.get("metadata", {})
check("metadata.code_pin_hash CONSERVÉ", meta.get("code_pin_hash") == "pbkdf2$secret-a-ne-pas-fuiter")
check("metadata.documents CONSERVÉ", meta.get("documents") == [])
check("metadata.prefs_avancees fusionné (villes_exclues)", meta.get("prefs_avancees", {}).get("villes_exclues") == ["nouakchott", "kaedi"])
check("metadata.prefs_avancees fusionné (types_masques)", meta.get("prefs_avancees", {}).get("types_masques") == ["stage_pfe"])
check("metadata.prefs_avancees fusionné (seuil_pertinence)", meta.get("prefs_avancees", {}).get("seuil_pertinence") == 50)
check("metadata.prefs_avancees fusionné (pays_favoris CONSERVÉ)", meta.get("prefs_avancees", {}).get("pays_favoris") == ["france"])
check("metadata.prefs_avancees fusionné (financement_min absent = None)", meta.get("prefs_avancees", {}).get("financement_min") is None)


# ================== 2. GET restitue les préférences fusionnées =================
print("\nGET /preferences : restitue les préférences fusionnées avec défauts")
r = client.get(url, headers=entete(TEL_A))
check("GET → 200", r.status_code == 200, f"reçu {r.status_code} : {corps(r)}")
rep = corps(r)
check("Réponse contient telephone", "telephone" in rep)
check("Réponse contient prefs_avancees", "prefs_avancees" in rep)
prefs = rep.get("prefs_avancees", {})
check("villes_exclues = ['nouakchott','kaedi']", prefs.get("villes_exclues") == ["nouakchott", "kaedi"])
check("types_masques = ['stage_pfe']", prefs.get("types_masques") == ["stage_pfe"])
check("seuil_pertinence = 50", prefs.get("seuil_pertinence") == 50)
check("pays_favoris = ['france'] (conservé de l'existant)", prefs.get("pays_favoris") == ["france"])
check("financement_min = null (défaut)", prefs.get("financement_min") is None)


# ================== 3. Profil SANS préférences → défauts =======================
print("\nProfil sans prefs_avancees → défauts (villes_exclues=[], types_masques=[], seuil_pertinence=0)")
TEL_B = "22236000002"
ID_B = str(uuid4())
FAUX.tables["profils"].append({
    "id": ID_B,
    "telephone": TEL_B,
    "nom": "Mint Salem",
    "prenom": "Aicha",
    "universite": "Universite de Nouadhibou",
    "filiere": "gestion",
    "niveau": "L3",
    "types_recherches": ["bourse"],
    "filieres_interet": [],
    "date_inscription": "2026-02-10",
    "created_at": "2026-02-10T09:00:00+00:00",
    "actif": True,
    "metadata": {"code_pin_hash": "pbkdf2$secret-b-a-ne-pas-fuiter"},  # SANS prefs_avancees
})

url_b = f"/api/v1/profils/{TEL_B}/preferences"
r = client.get(url_b, headers=entete(TEL_B))
check("GET profil sans prefs → 200", r.status_code == 200, f"reçu {r.status_code} : {corps(r)}")
rep = corps(r)
prefs = rep.get("prefs_avancees", {})
check("villes_exclues = [] (défaut)", prefs.get("villes_exclues") == [])
check("types_masques = [] (défaut)", prefs.get("types_masques") == [])
check("seuil_pertinence = 0 (défaut)", prefs.get("seuil_pertinence") == 0)
check("pays_favoris = [] (défaut)", prefs.get("pays_favoris") == [])
check("financement_min = null (défaut)", prefs.get("financement_min") is None)


# ================== 4. Sécurité : 401 sans Bearer, 403 autre tel ===============
print("\nSécurité : 401 sans Bearer / 403 si token ≠ tel")
r = client.get(url)
check("GET sans Bearer → 401", r.status_code == 401, f"reçu {r.status_code}")
r = client.patch(url, json=body)
check("PATCH sans Bearer → 401", r.status_code == 401, f"reçu {r.status_code}")

TEL_C = "22236000003"
r = client.get(url, headers=entete(TEL_C))
check("GET token autre tel → 403", r.status_code == 403, f"reçu {r.status_code}")
r = client.patch(url, json=body, headers=entete(TEL_C))
check("PATCH token autre tel → 403", r.status_code == 403, f"reçu {r.status_code}")


# ================== 5. Chemins exposés par main.py ============================
print("\nLes endpoints sont bien exposés par app/main.py")
chemins = set(main_module.app.openapi().get("paths", {}))
for attendu in (
    "/api/v1/profils/{telephone}/preferences",
):
    check(f"main.py expose {attendu}", attendu in chemins, str(sorted(chemins))[:300])


# --------------------------------- Bilan --------------------------------------
print(f"\n{'=' * 60}")
if ECHECS:
    print(f"RÉSULTAT : {len(ECHECS)} échec(s) → {ECHECS}")
    sys.exit(1)
print("RÉSULTAT : 100 % des checks sont VERTS (zéro réseau, zéro migration SQL).")