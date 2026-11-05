"""Preuve MOCKÉE de l'inscription d'un profil — zéro réseau, zéro migration.

Régression corrigée le 05/11/2026 : `POST /api/v1/profils` insérait
`pays_etudes` comme une colonne de `profils`. Or cette colonne n'existe pas
(schema.sql) : PostgREST répondait PGRST204 « Could not find the
'pays_etudes' column of 'profils' in the schema cache », l'API laissait
remonter l'APIError et le navigateur affichait une erreur serveur 500.

Règle 2 du dépôt : toute donnée additionnelle vit dans `profils.metadata`.
Ce harnais simule PostgREST en REFUSANT toute clé inconnue de `profils` :
il échouerait donc si `pays_etudes` repartait en colonne.

Usage : python -X utf8 scripts/test-inscription-profil.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import copy
import os
import sys
import types
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)


# ------------------------- Faux Supabase (zéro réseau) -------------------------
# Colonnes réelles de profils (infra/supabase/schema.sql) — la liste est
# volontairement fermée : une clé inconnue = PGRST204, comme en production.
COLONNES_PROFILS = {
    "id",
    "telephone",
    "nom",
    "prenom",
    "email",
    "universite",
    "filiere",
    "niveau",
    "ville",
    "types_recherches",
    "filieres_interet",
    "optin_at",
    "optin_texte",
    "actif",
    "date_inscription",
    "preferences_notif",
    "metadata",
    "created_at",
    "updated_at",
}


class _ErreurPostgrest(Exception):
    """Reproduit postgrest.exceptions.APIError (code PGRST204)."""


class _Resultat:
    def __init__(self, data):
        self.data = data


class _FauxTable:
    def __init__(self, base, nom):
        self._base, self._nom, self._mode = base, nom, "select"
        self._filtres, self._donnees = [], None

    def select(self, colonnes="*", count=None):
        self._mode = "select"
        return self

    def eq(self, colonne, valeur):
        self._filtres.append((colonne, valeur))
        return self

    def insert(self, donnees):
        self._mode, self._donnees = "insert", donnees
        return self

    def update(self, donnees):
        self._mode, self._donnees = "update", donnees
        return self

    def execute(self):
        lignes = [
            ligne
            for ligne in self._base.tables.setdefault(self._nom, [])
            if all(ligne.get(c) == v for c, v in self._filtres)
        ]
        if self._mode == "select":
            return _Resultat([copy.deepcopy(ligne) for ligne in lignes])
        if self._mode == "insert":
            inconnues = sorted(set(self._donnees) - COLONNES_PROFILS)
            if inconnues:
                raise _ErreurPostgrest(
                    f"Could not find the '{inconnues[0]}' column of 'profils' in "
                    "the schema cache"
                )
            ligne = {
                "id": str(uuid4()),
                "ville": "nouakchott",
                "types_recherches": ["bourse"],
                "filieres_interet": [],
                "actif": True,
                "date_inscription": datetime.now(timezone.utc).date().isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "metadata": {},
            }
            ligne.update(copy.deepcopy(self._donnees))
            self._base.tables.setdefault(self._nom, []).append(ligne)
            return _Resultat([copy.deepcopy(ligne)])
        if self._mode == "update":
            inconnues = sorted(set(self._donnees) - COLONNES_PROFILS)
            if inconnues:
                raise _ErreurPostgrest(
                    f"Could not find the '{inconnues[0]}' column of 'profils' in "
                    "the schema cache"
                )
            for ligne in lignes:
                ligne.update(copy.deepcopy(self._donnees))
            return _Resultat([copy.deepcopy(ligne) for ligne in lignes])
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

TEL = "22200000000"

ECHECS = []


def check(libelle, condition, detail=""):
    print(f"  [{'OK' if condition else 'KO'}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


def entete(tel):
    jeton, _ = creer_token(tel)
    return {"Authorization": f"Bearer {jeton}"}


def corps(reponse):
    try:
        return reponse.json()
    except ValueError:
        return {}


# ================== 1. Inscription : pays_etudes → metadata ==================
print("\n1. POST /api/v1/profils — pays_etudes rangé dans metadata (pas en colonne)")
reponse = client.post(
    "/api/v1/profils",
    json={
        "telephone": TEL,
        "code_pin": "1234",
        "nom": "Test",
        "prenom": "Diagnostic",
        "universite": "Universite de Nouakchott",
        "filiere": "informatique",
        "niveau": "licence",
        "pays_etudes": "france",
        "optin_at": "2026-11-05T10:00:00.000Z",
        "optin_texte": "J'accepte de recevoir les offres sur WhatsApp",
    },
)
check("statut 201 (plus de 500 PGRST204)", reponse.status_code == 201, reponse.text[:300])
fiche = corps(reponse)
check("réponse expose pays_etudes", fiche.get("pays_etudes") == "france", str(fiche))
check("aucun metadata dans la réponse", "metadata" not in fiche, str(sorted(fiche)))

ligne = FAUX.tables["profils"][0]
check("ligne SQL sans clé pays_etudes", "pays_etudes" not in ligne, str(sorted(ligne)))
check(
    "pays_etudes persisté dans metadata",
    (ligne.get("metadata") or {}).get("pays_etudes") == "france",
    str(ligne.get("metadata")),
)
check(
    "hash du PIN dans metadata, jamais en clair",
    str((ligne.get("metadata") or {}).get("code_pin_hash", "")).startswith("pbkdf2"),
    str(ligne.get("metadata")),
)
check("code_pin jamais stocké en clair", "code_pin" not in ligne, str(sorted(ligne)))

# ================== 2. Relecture : pays_etudes restitué ======================
print("\n2. GET /api/v1/profils/{tel} — pays_etudes relu depuis metadata")
reponse = client.get(f"/api/v1/profils/{TEL}", headers=entete(TEL))
check("statut 200", reponse.status_code == 200, reponse.text[:300])
check("pays_etudes restitué", corps(reponse).get("pays_etudes") == "france", reponse.text[:300])
check("metadata jamais exposé", "metadata" not in corps(reponse), reponse.text[:300])

# ================== 3. Doublon : 409, pas d'écrasement ======================
print("\n3. POST /api/v1/profils — numéro déjà inscrit → 409")
reponse = client.post(
    "/api/v1/profils",
    json={
        "telephone": TEL,
        "code_pin": "9999",
        "nom": "Autre",
        "prenom": "Personne",
        "universite": "Universite de Nouadhibou",
        "filiere": "gestion",
        "niveau": "M1",
        "pays_etudes": "canada",
        "optin_texte": "J'accepte de recevoir les offres sur WhatsApp",
    },
)
check("statut 409", reponse.status_code == 409, reponse.text[:300])
check(
    "profil existant intact",
    len(FAUX.tables["profils"]) == 1
    and FAUX.tables["profils"][0]["nom"] == "Test",
    str(FAUX.tables["profils"]),
)

# ================== 4. Mise à jour : metadata fusionnée ======================
print("\n4. PUT /api/v1/profils/{tel} — pays_etudes mis à jour sans perdre le PIN")
reponse = client.put(
    f"/api/v1/profils/{TEL}",
    json={"pays_etudes": "allemagne", "niveau": "master"},
    headers=entete(TEL),
)
check("statut 200", reponse.status_code == 200, reponse.text[:300])
check("pays_etudes renvoyé", corps(reponse).get("pays_etudes") == "allemagne", reponse.text[:300])
metadata = FAUX.tables["profils"][0].get("metadata") or {}
check("nouveau pays dans metadata", metadata.get("pays_etudes") == "allemagne", str(metadata))
check("hash du PIN conservé", "code_pin_hash" in metadata, str(metadata))

# ================================ Bilan ======================================
print()
if ECHECS:
    print(f"ECHEC — {len(ECHECS)} check(s) KO : {', '.join(ECHECS)}")
    sys.exit(1)
print("OK — inscription, relecture, doublon et mise à jour conformes (metadata, zéro migration).")
