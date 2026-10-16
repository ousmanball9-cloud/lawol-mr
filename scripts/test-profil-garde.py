"""Preuve MOCKÉE de la fermeture des GET non protégés de l'API profil — zéro réseau.

Trou fermé : connaître un numéro suffisait à lire la fiche, l'historique de
candidatures, le tableau de bord ET la liste complète des matches (qui contient
prénom/nom/téléphone des étudiants).

Patch : le module `supabase` est remplacé par un factice en mémoire AVANT tout
import de l'application → `create_client()` ne touche jamais le réseau et
aucun secret réel n'est utilisé (SESSION_SECRET de test bidon).

Prouve, pour CHACUN des 4 GET :
   1. GET /api/v1/profils/{tel}            → 401 sans Bearer, 403 autre tel, 200 bon tel ;
   2. GET /api/v1/profils/{tel}/historique → 401 / 403 / 200 ;
   3. GET /api/v1/dashboard/{tel}          → 401 / 403 / 200 ;
   4. GET /api/v1/matches                  → 401 sans Bearer, 403 si profil_id
      d'autrui, 200 restreint au profil de la session (zéro fuite inter-profils) ;
   5. jetons falsifiés/expirés → 401 (jamais 200) ;
   6. le hash du PIN (metadata) n'est jamais renvoyé ;
   7. NON-RÉGRESSION : les endpoints publics (offres) restent ouverts sans Bearer ;
   8. les 4 chemins sont bien exposés par app/main.py.

Usage : python -X utf8 scripts/test-profil-garde.py
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

    def gte(self, colonne, valeur):
        return self

    def order(self, colonne, desc=False):
        return self

    def limit(self, n):
        self._limite = n
        return self

    def range(self, debut, fin):
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
from apps.api.app.modules.auth import session as sess
from apps.api.app.modules.auth.session import creer_token

client = TestClient(main_module.app)

TEL_A = "22236000001"
TEL_B = "22236000002"
ID_A = str(uuid4())
ID_B = str(uuid4())

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
        # jamais exposé dans une réponse :
        "metadata": {"code_pin_hash": "pbkdf2$secret-a-ne-pas-fuiter", "documents": []},
    },
    {
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
        "metadata": {"code_pin_hash": "pbkdf2$secret-b-a-ne-pas-fuiter"},
    },
]

_OFFRE = {
    "id": str(uuid4()),
    "titre": "Bourse d'excellence 2026",
    "entreprise": "ANPE",
    "pays_etudes": "france",
    "ville": "nouakchott",
    "type_offre": "bourse",
    "description": "Bourse complete niveau master",
    "date_limite": "2099-01-01",
    "contact_email": "bourses@anpe.mr",
    "contact_whatsapp": None,
    "source_url": "https://anpe.mr",
    "source_name": "ANPE",
    "filieres_cibles": ["informatique"],
    "active": True,
}

FAUX.tables["matches"] = [
    {
        "id": str(uuid4()),
        "profil_id": ID_A,
        "score": 90,
        "notifie": True,
        "postule": False,
        "date_match": "2026-10-14",
        "offre": _OFFRE,
        "profil": {"id": ID_A, "prenom": "Fatimetou", "nom": "Ould Ahmed", "telephone": TEL_A},
    },
    {
        "id": str(uuid4()),
        "profil_id": ID_B,
        "score": 70,
        "notifie": False,
        "postule": True,
        "date_match": "2026-09-01",
        "offre": {**_OFFRE, "id": str(uuid4())},
        "profil": {"id": ID_B, "prenom": "Aicha", "nom": "Mint Salem", "telephone": TEL_B},
    },
]

FAUX.tables["offres"] = []

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


def jeton_expire(tel):
    payload = sess._b64u(
        json.dumps({"tel": tel, "exp": int(time.time()) - 60}, separators=(",", ":")).encode()
    )
    return f"{payload}.{sess._signature(payload)}"


GETS_PROFILS = [
    ("/api/v1/profils/{tel}", lambda t: f"/api/v1/profils/{t}"),
    ("/api/v1/profils/{tel}/historique", lambda t: f"/api/v1/profils/{t}/historique"),
    ("/api/v1/dashboard/{tel}", lambda t: f"/api/v1/dashboard/{t}"),
]

# ================== 1-3. Les 3 GET portant un {tel} dans l'URL ==================
for nom, url in GETS_PROFILS:
    print(f"\n{nom} : 401 / 403 / 200")
    r = client.get(url(TEL_A))
    check(f"{nom} sans Bearer → 401", r.status_code == 401, f"reçu {r.status_code} : {corps(r)}")
    r = client.get(url(TEL_A), headers=entete(TEL_B))
    check(f"{nom} Bearer d'un autre tel → 403", r.status_code == 403, f"reçu {r.status_code}")
    r = client.get(url(TEL_A), headers=entete(TEL_A))
    check(f"{nom} bon Bearer → 200", r.status_code == 200, f"reçu {r.status_code} : {corps(r)}")

# ================== 4. GET /api/v1/matches =====================================
print("\n/api/v1/matches : session obligatoire + restriction au profil possédé")
r = client.get("/api/v1/matches")
check("matches sans Bearer → 401", r.status_code == 401, f"reçu {r.status_code} : {corps(r)}")
r = client.get("/api/v1/matches", headers=entete(TEL_A))
check("matches bon Bearer → 200", r.status_code == 200, f"reçu {r.status_code} : {corps(r)}")
lignes = corps(r)
check("matches 200 ne renvoie QUE les matches du profil connecté", len(lignes) == 1, str(len(lignes)))
check(
    "…aucune ligne du profil d'autrui",
    all(m.get("profil_id") == ID_A for m in lignes),
    str([m.get("profil_id") for m in lignes]),
)
r = client.get(f"/api/v1/matches?profil_id={ID_A}", headers=entete(TEL_A))
check("matches ?profil_id=<le sien> → 200", r.status_code == 200, f"reçu {r.status_code}")
r = client.get(f"/api/v1/matches?profil_id={ID_A}", headers=entete(TEL_B))
check("matches ?profil_id=<autrui> → 403", r.status_code == 403, f"reçu {r.status_code}")
check(
    "…la réponse 403 ne contient aucune donnée de A",
    "Ould Ahmed" not in r.text and TEL_A not in r.text,
    r.text[:160],
)

# ================== 5. Jetons falsifiés / expirés ==============================
print("\nJetons falsifiés et expirés → 401 partout")
for nom, url in GETS_PROFILS:
    r = client.get(url(TEL_A), headers={"Authorization": "Bearer jeton.bidon"})
    check(f"{nom} jeton bidon → 401", r.status_code == 401, f"reçu {r.status_code}")
    r = client.get(url(TEL_A), headers={"Authorization": f"Bearer {jeton_expire(TEL_A)}"})
    check(f"{nom} jeton expiré → 401", r.status_code == 401, f"reçu {r.status_code}")
r = client.get("/api/v1/matches", headers={"Authorization": "Bearer jeton.bidon"})
check("matches jeton bidon → 401", r.status_code == 401, f"reçu {r.status_code}")

# ================== 6. Zéro fuite du hash du PIN ===============================
print("\nLa fiche 200 n'expose jamais metadata / le hash du PIN")
fiche = corps(client.get(f"/api/v1/profils/{TEL_A}", headers=entete(TEL_A)))
check("fiche sans 'metadata'", "metadata" not in fiche, str(sorted(fiche)))
check("aucun 'code_pin_hash' dans la réponse", "code_pin_hash" not in json.dumps(fiche), "")

# ================== 7. Non-régression : endpoints publics ======================
print("\nNon-régression : les endpoints publics restent ouverts")
r = client.get("/api/v1/offres")
check("GET /api/v1/offres sans Bearer → 200 (public, non touché)", r.status_code == 200, f"reçu {r.status_code}")

# ================== 8. Chemins exposés par main.py =============================
print("\nLes 4 GET gardés sont bien exposés par app/main.py")
chemins = set(main_module.app.openapi().get("paths", {}))
for attendu in (
    "/api/v1/profils/{telephone}",
    "/api/v1/profils/{telephone}/historique",
    "/api/v1/dashboard/{telephone}",
    "/api/v1/matches",
):
    check(f"main.py expose {attendu}", attendu in chemins, str(sorted(chemins))[:300])

# --------------------------------- Bilan --------------------------------------
print(f"\n{'=' * 60}")
if ECHECS:
    print(f"RÉSULTAT : {len(ECHECS)} échec(s) → {ECHECS}")
    sys.exit(1)
print("RÉSULTAT : 100 % des checks sont VERTS (zéro réseau, zéro migration SQL).")
