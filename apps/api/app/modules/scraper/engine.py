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

Second axe (20/10/2026) : la CATÉGORIE de bourse décrit le FINANCEUR, pas la
nature de l'offre. Elle vit dans `offres.metadata['categorie_bourse']` (jsonb
déjà présent → aucune migration SQL) : l'enum PostgreSQL `type_offre` reste
intact. Taxonomie validée :
`gouvernementale | institutionnelle | fondation | entreprise | inconnu`.
Défaut `inconnu` : un financeur n'est JAMAIS deviné (seuls les mots-clés
publics explicites — ambassade, ministère, consulat… — classent une source
inconnue).
"""
from __future__ import annotations

import re
from enum import Enum

BOURSE = "bourse"
EMPLOI_JUNIOR = "emploi_junior"
STAGE_PFE = "stage_pfe"


class CategorieBourse(str, Enum):
    """Axe FINANCEUR d'une bourse (≠ `type_offre`, qui décrit la NATURE)."""

    GOUVERNEMENTALE = "gouvernementale"
    INSTITUTIONNELLE = "institutionnelle"
    FONDATION = "fondation"
    ENTREPRISE = "entreprise"
    INCONNU = "inconnu"


CATEGORIES_BOURSE: tuple[str, ...] = tuple(c.value for c in CategorieBourse)

# Clé jsonb dans `offres.metadata` — aucune colonne ni migration SQL.
CLE_METADATA_CATEGORIE = "categorie_bourse"

CATEGORIE_BOURSE_DEFAUT = CategorieBourse.INCONNU.value

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

# Catégorie FINANCEUR par source — clés canoniques (`-`, espaces → `_`).
# Seules les sources dont le financeur est CONNU y figurent ; tout le reste
# vaut « inconnu » (jamais deviné). Les sources d'EMPLOI existantes sont
# explicitement « inconnu » : ce ne sont pas des bourses.
CATEGORIE_BOURSE_PAR_SOURCE: dict[str, str] = {
    # Bourses d'État / programmes publics RÉELS (domaine officiel) : DAAD
    # (daad.de, service financé par l'État fédéral) et Eiffel (bourse du
    # ministère français des Affaires étrangères). Erasmus+ est un programme
    # de l'Union européenne (institution supranationale, pas un État).
    "daad": CategorieBourse.GOUVERNEMENTALE.value,
    "eiffel": CategorieBourse.GOUVERNEMENTALE.value,
    "erasmus": CategorieBourse.INSTITUTIONNELLE.value,
    "erasmus_plus": CategorieBourse.INSTITUTIONNELLE.value,
    # Campus France opère les bourses du gouvernement français (BGF).
    "campus_france": CategorieBourse.GOUVERNEMENTALE.value,
    # ATTENTION (mesuré 20/10/2026) : `daadscholarship.com` est un BLOG privé
    # WordPress, pas le DAAD officiel (daad.de) — ses articles parlent de
    # n'importe quel pays. Le classer « gouvernementale » affichait 25 offres
    # mensongères. Il reste donc « inconnu ».
    "daad_scholarship": CategorieBourse.INCONNU.value,
    # Fondation privée.
    "mastercard_foundation": CategorieBourse.FONDATION.value,
    # Sources d'EMPLOI : aucune bourse → inconnu (pas une catégorie de bourse).
    "beta_mr": CategorieBourse.INCONNU.value,
    "linkedin": CategorieBourse.INCONNU.value,
    "anpe": CategorieBourse.INCONNU.value,
    "mauritel": CategorieBourse.INCONNU.value,
    "snim": CategorieBourse.INCONNU.value,
    "bnm": CategorieBourse.INCONNU.value,
    "totalenergies": CategorieBourse.INCONNU.value,
}

# Repli sur l'ORGANISME (colonne `entreprise` des offres bourses) : seuls des
# financeurs publics explicites sont reconnus — « government scholarship »,
# « bourse du gouvernement »… Tout le reste reste « inconnu ».
_MOTS_FINANCEUR_PUBLIC = re.compile(
    r"\b(?:ambassades?|consulats?|minist[èe]res?|ministry|ministries|embassy|"
    r"government\s+scholarships?|state\s+scholarships?|"
    r"bourse\s+du\s+gouvernement|gouvernement)\b",
    re.IGNORECASE,
)

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


# ---------- Axe FINANCEUR : catégorie de bourse ----------
def _cle_source(source_name: str | None) -> str:
    """Clé canonique d'une source : minuscules, `-`/espaces → `_`.

    `daad-scholarship`, `DAAD Scholarship` et `daad_scholarship` désignent la
    même source — la table n'a donc qu'une seule entrée par financeur.
    """
    return re.sub(r"[\s\-]+", "_", (source_name or "").strip().lower())


def _variantes_db(cle: str) -> list[str]:
    """Formes réellement rencontrées en base : `daad-scholarship` ET `daad_scholarship`."""
    return sorted({cle, cle.replace("_", "-")})


def categorie_bourse_pour_source(source_name: str | None, organisme: str = "") -> str:
    """Catégorie FINANCEUR d'une offre selon sa source (jamais devinée).

    · source présente dans `CATEGORIE_BOURSE_PAR_SOURCE` → sa catégorie ;
    · sinon, l'organisme porte un mot-clé public explicite (ambassade,
      ministère, consulat, « government scholarship »…) → ``gouvernementale`` ;
    · sinon → ``inconnu`` (l'absence d'information n'est pas une catégorie).
    """
    categorie = CATEGORIE_BOURSE_PAR_SOURCE.get(_cle_source(source_name))
    if categorie is not None:
        return categorie
    if _MOTS_FINANCEUR_PUBLIC.search(organisme or ""):
        return CategorieBourse.GOUVERNEMENTALE.value
    return CATEGORIE_BOURSE_DEFAUT


def categorie_bourse_pour_offre(
    metadata: dict | None,
    source_name: str | None = None,
    organisme: str = "",
) -> str:
    """Catégorie LUE sur une offre, cohérente avec le filtre `?categorie=`.

    · `metadata['categorie_bourse']` valide → priorité (valeur écrite en base) ;
    · sinon (ligne legacy sans metadata, ou valeur hors taxonomie) → MÊME règle
      que le filtre serveur : `categorie_bourse_pour_source(...)` ;
    · source non classée et organisme muet → ``inconnu``.
    """
    if isinstance(metadata, dict):
        valeur = metadata.get(CLE_METADATA_CATEGORIE)
        if isinstance(valeur, str) and valeur.strip().lower() in CATEGORIES_BOURSE:
            return valeur.strip().lower()
    return categorie_bourse_pour_source(source_name, organisme)


def sources_classifiees(categorie: str | None) -> list[str]:
    """Sources (formes DB) dont la catégorie EXPLICITE est `categorie`.

    ``inconnu`` n'est pas une catégorie explicite : il regroupe tout le reste
    et se filtre par EXCLUSION des sources de `sources_bourse_connues()`.
    """
    if not categorie or categorie == CATEGORIE_BOURSE_DEFAUT:
        return []
    noms: set[str] = set()
    for cle, valeur in CATEGORIE_BOURSE_PAR_SOURCE.items():
        if valeur == categorie:
            noms.update(_variantes_db(cle))
    return sorted(noms)


def sources_bourse_connues() -> list[str]:
    """Toutes les sources dont la catégorie n'est PAS « inconnu » (formes DB)."""
    noms: set[str] = set()
    for cle, valeur in CATEGORIE_BOURSE_PAR_SOURCE.items():
        if valeur != CATEGORIE_BOURSE_DEFAUT:
            noms.update(_variantes_db(cle))
    return sorted(noms)
