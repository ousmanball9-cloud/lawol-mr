"""Moteur de classification des offres par source — règle durable LAWOL.mr.

Décision produit (16/10/2026) : le catalogue public est « 100 % bourses ».
Les sources d'EMPLOI (portail de recrutement beta.mr, LinkedIn, sites carrières
d'entreprises : mauritel, snim, bnm, totalenergies…) ne doivent JAMAIS produire
de `bourse` : leurs annonces sont des recrutements (`emploi_junior`) ou, si
l'intitulé décrit un stage, des stages (`stage_pfe`).

Cette table est la SEULE source de vérité. Elle est appliquée à l'écriture par
`sources/base.py::BaseScraper.save` (point de passage unique de tous les
scrapers) : une source d'emploi ne peut donc plus réinjecter `bourse` en base,
même si le modèle d'écriture Pydantic (`TypeOffre`) reste par ailleurs bridé à
`bourse` (voir AGENTS.md § 6 : l'écriture bridée ne doit jamais gêner la
classification réelle ; la base, elle, accepte l'union SQL `TypeOffreDb`).

Reprise des lignes déjà en base : `scripts/backfill-type-offre.py`
(même règle, zéro suppression, ne change que `type_offre`).
"""
from __future__ import annotations

import re

BOURSE = "bourse"
EMPLOI_JUNIOR = "emploi_junior"
STAGE_PFE = "stage_pfe"

# Catégorie d'une source : "emploi" (recrutements/stages) ou "bourse" (défaut).
# Toute source absente de cette table est considérée « bourse ».
CATEGORIE_PAR_SOURCE: dict[str, str] = {
    # Portails d'offres / réseaux professionnels
    "beta_mr": "emploi",
    "linkedin": "emploi",
    "anpe": "emploi",
    # Sites carrières d'entreprises (catalogue générique)
    "mauritel": "emploi",
    "snim": "emploi",
    "bnm": "emploi",
    "totalenergies": "emploi",
}

_CATEGORIE_DEFAUT = "bourse"

# Un intitulé / une description qui parle d'un stage ⇒ `stage_pfe` (jamais `emploi_junior`).
# \b est Unicode-aware sous Python : « études », « mémoire » sont correctement bordés.
_MOTS_STAGE = re.compile(
    r"\b(?:stage|stages|stagiaire|pfe|internship|alternance|"
    r"apprenti(?:ssage|e)?|fin\s+d[’'`]?\s*études|mémoire|projet\s+de\s+fin)\b",
    re.IGNORECASE,
)


def categoriser_source(source_name: str | None) -> str:
    """Catégorie d'une source : « emploi » ou « bourse » (défaut)."""
    return CATEGORIE_PAR_SOURCE.get((source_name or "").strip().lower(), _CATEGORIE_DEFAUT)


def est_source_emploi(source_name: str | None) -> bool:
    """Vrai si la source publie des recrutements/stages (jamais des bourses)."""
    return categoriser_source(source_name) == "emploi"


def type_offre_pour_source(
    source_name: str | None,
    titre: str = "",
    description: str = "",
) -> str:
    """Type d'offre à écrire en base pour une offre issue de `source_name`.

    · source d'emploi + intitulé décrivant un stage → ``stage_pfe`` ;
    · source d'emploi (sinon)                      → ``emploi_junior`` ;
    · toute autre source                           → ``bourse``.
    """
    if not est_source_emploi(source_name):
        return BOURSE
    if _MOTS_STAGE.search(f"{titre or ''} {description or ''}"):
        return STAGE_PFE
    return EMPLOI_JUNIOR
