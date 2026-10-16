"""Modèles d'entrée des réglages + visites.

Validation AVANT tout accès Supabase :
  · ``ParametrePayload`` : ``{cle, valeur}`` — la clé est nettoyée/bornée, la
    valeur accepte n'importe quel JSON (dict, liste, booléen, nombre, chaîne,
    ``null``) ;
  · ``VisitePayload`` : ``{chemin}`` — le chemin est assaini (caractères de
    contrôle retirés) et borné à ``CHEMIN_MAX`` caractères, jamais rejeté pour
    cause de longueur (tronqué) : une visite ne doit jamais casser la page.

Un corps invalide (champ obligatoire absent) reste un 422 FastAPI standard.
"""

import re
from typing import Any

from pydantic import BaseModel, field_validator

CLE_MAX = 80
CHEMIN_MAX = 200
CHEMIN_DEFAUT = "/"  # chemin vide → racine (la colonne `chemin` est NOT NULL)

_CARACTERES_CONTROLE = re.compile(r"[\x00-\x1f\x7f]")


class ParametrePayload(BaseModel):
    """PUT /api/v1/admin/parametres — ``{cle, valeur}`` (valeur = JSON libre)."""

    cle: str
    valeur: Any  # obligatoire, mais ``null`` est une valeur JSON légitime

    @field_validator("cle")
    @classmethod
    def _cle_valide(cls, cle: str) -> str:
        propre = cle.strip()
        if not propre:
            raise ValueError("La clé du réglage est obligatoire")
        if len(propre) > CLE_MAX:
            raise ValueError(f"Clé de réglage trop longue (max {CLE_MAX} caractères)")
        return propre


class VisitePayload(BaseModel):
    """POST /api/v1/visites — ``{chemin}`` assaini et borné (jamais > 200 car.)."""

    chemin: str

    @field_validator("chemin")
    @classmethod
    def _chemin_propre(cls, chemin: str) -> str:
        propre = _CARACTERES_CONTROLE.sub("", chemin).strip()[:CHEMIN_MAX]
        return propre or CHEMIN_DEFAUT
