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
    # --- GOUVERNEMENTALE : ambassades, consulats, ministères, bourses d'État ---
    "daad": CategorieBourse.GOUVERNEMENTALE.value,
    "eiffel": CategorieBourse.GOUVERNEMENTALE.value,
    "campus_france": CategorieBourse.GOUVERNEMENTALE.value,
    # Ambassades / consulats / ministères identifiés par source
    "ambassade_france": CategorieBourse.GOUVERNEMENTALE.value,
    "ambassade_usa": CategorieBourse.GOUVERNEMENTALE.value,
    "ambassade_allemagne": CategorieBourse.GOUVERNEMENTALE.value,
    "ambassade_chine": CategorieBourse.GOUVERNEMENTALE.value,
    "ambassade_maroc": CategorieBourse.GOUVERNEMENTALE.value,
    "ambassade_senegal": CategorieBourse.GOUVERNEMENTALE.value,
    "ambassade_tunisie": CategorieBourse.GOUVERNEMENTALE.value,
    "consulat_france": CategorieBourse.GOUVERNEMENTALE.value,
    "consulat_allemagne": CategorieBourse.GOUVERNEMENTALE.value,
    "ministere_enseignement_superieur": CategorieBourse.GOUVERNEMENTALE.value,
    "ministere_affaires_etrangeres": CategorieBourse.GOUVERNEMENTALE.value,
    "gouvernement_mauritanie": CategorieBourse.GOUVERNEMENTALE.value,
    "mesrs": CategorieBourse.GOUVERNEMENTALE.value,
    "mesrs_mauritanie": CategorieBourse.GOUVERNEMENTALE.value,
    # Programmes "government scholarship" explicites
    "chevening": CategorieBourse.GOUVERNEMENTALE.value,
    "fulbright": CategorieBourse.GOUVERNEMENTALE.value,
    "australia_awards": CategorieBourse.GOUVERNEMENTALE.value,
    "new_zealand_awards": CategorieBourse.GOUVERNEMENTALE.value,
    "swiss_government_excellence": CategorieBourse.GOUVERNEMENTALE.value,
    "hungary_scholarship": CategorieBourse.GOUVERNEMENTALE.value,
    "turkiye_burslari": CategorieBourse.GOUVERNEMENTALE.value,
    "chinese_government_scholarship": CategorieBourse.GOUVERNEMENTALE.value,
    "japanese_government_scholarship": CategorieBourse.GOUVERNEMENTALE.value,
    "korean_government_scholarship": CategorieBourse.GOUVERNEMENTALE.value,
    "mext": CategorieBourse.GOUVERNEMENTALE.value,
    "kgsp": CategorieBourse.GOUVERNEMENTALE.value,
    "csc_scholarship": CategorieBourse.GOUVERNEMENTALE.value,

    # --- INSTITUTIONNELLE : universités, agences, programmes intergouvernementaux ---
    "erasmus": CategorieBourse.INSTITUTIONNELLE.value,
    "erasmus_plus": CategorieBourse.INSTITUTIONNELLE.value,
    "erasmus_mundus": CategorieBourse.INSTITUTIONNELLE.value,
    "eacea": CategorieBourse.INSTITUTIONNELLE.value,
    # Commonwealth
    "commonwealth_scholarship": CategorieBourse.INSTITUTIONNELLE.value,
    "commonwealth_split_site": CategorieBourse.INSTITUTIONNELLE.value,
    "commonwealth_shared": CategorieBourse.INSTITUTIONNELLE.value,
    # Universités / agences connues
    "universite_paris": CategorieBourse.INSTITUTIONNELLE.value,
    "universite_lyon": CategorieBourse.INSTITUTIONNELLE.value,
    "universite_bordeaux": CategorieBourse.INSTITUTIONNELLE.value,
    "sciences_po": CategorieBourse.INSTITUTIONNELLE.value,
    "institut_agro": CategorieBourse.INSTITUTIONNELLE.value,
    "onema": CategorieBourse.INSTITUTIONNELLE.value,
    "anr": CategorieBourse.INSTITUTIONNELLE.value,
    "cnrs": CategorieBourse.INSTITUTIONNELLE.value,
    "inserm": CategorieBourse.INSTITUTIONNELLE.value,
    "ird": CategorieBourse.INSTITUTIONNELLE.value,
    "cirad": CategorieBourse.INSTITUTIONNELLE.value,
    "afd": CategorieBourse.INSTITUTIONNELLE.value,
    "expertise_france": CategorieBourse.INSTITUTIONNELLE.value,
    "giz": CategorieBourse.INSTITUTIONNELLE.value,
    "usaid": CategorieBourse.INSTITUTIONNELLE.value,
    "jica": CategorieBourse.INSTITUTIONNELLE.value,
    "koica": CategorieBourse.INSTITUTIONNELLE.value,
    "unicef": CategorieBourse.INSTITUTIONNELLE.value,
    "unesco": CategorieBourse.INSTITUTIONNELLE.value,
    "banque_mondiale": CategorieBourse.INSTITUTIONNELLE.value,
    "bid": CategorieBourse.INSTITUTIONNELLE.value,
    "bdeac": CategorieBourse.INSTITUTIONNELLE.value,
    "badi": CategorieBourse.INSTITUTIONNELLE.value,
    "onudi": CategorieBourse.INSTITUTIONNELLE.value,
    "fao": CategorieBourse.INSTITUTIONNELLE.value,
    "pnud": CategorieBourse.INSTITUTIONNELLE.value,
    "oim": CategorieBourse.INSTITUTIONNELLE.value,
    "hcr": CategorieBourse.INSTITUTIONNELLE.value,
    "ocha": CategorieBourse.INSTITUTIONNELLE.value,
    "unwomen": CategorieBourse.INSTITUTIONNELLE.value,
    "unfpa": CategorieBourse.INSTITUTIONNELLE.value,
    "unhabitat": CategorieBourse.INSTITUTIONNELLE.value,

    # --- FONDATION : fondations privées / philanthropiques ---
    "mastercard_foundation": CategorieBourse.FONDATION.value,
    "mastercard_foundation_scholars": CategorieBourse.FONDATION.value,
    "ford_foundation": CategorieBourse.FONDATION.value,
    "gates_foundation": CategorieBourse.FONDATION.value,
    "bill_melinda_gates_foundation": CategorieBourse.FONDATION.value,
    "rockefeller_foundation": CategorieBourse.FONDATION.value,
    "carnegie_foundation": CategorieBourse.FONDATION.value,
    "mellon_foundation": CategorieBourse.FONDATION.value,
    "soros_foundation": CategorieBourse.FONDATION.value,
    "open_society_foundations": CategorieBourse.FONDATION.value,
    "wellcome_trust": CategorieBourse.FONDATION.value,
    "chan_zuckerberg_initiative": CategorieBourse.FONDATION.value,
    "a_gha_khan_foundation": CategorieBourse.FONDATION.value,
    "m_foundation": CategorieBourse.FONDATION.value,
    "al_ghurair_foundation": CategorieBourse.FONDATION.value,
    "sawiris_foundation": CategorieBourse.FONDATION.value,
    "nasseef_foundation": CategorieBourse.FONDATION.value,
    "drosos_foundation": CategorieBourse.FONDATION.value,
    "africa_leadership_university": CategorieBourse.FONDATION.value,
    "mfwa": CategorieBourse.FONDATION.value,

    # --- ENTREPRISE : programmes de bourses d'entreprises ---
    "total_energies": CategorieBourse.ENTREPRISE.value,
    "bn_m": CategorieBourse.ENTREPRISE.value,
    "attijariwafa": CategorieBourse.ENTREPRISE.value,
    "bmci": CategorieBourse.ENTREPRISE.value,
    "bci": CategorieBourse.ENTREPRISE.value,
    "sgb": CategorieBourse.ENTREPRISE.value,
    "cimr": CategorieBourse.ENTREPRISE.value,
    "ocp": CategorieBourse.ENTREPRISE.value,
    "maroc_telecom": CategorieBourse.ENTREPRISE.value,
    "inwi": CategorieBourse.ENTREPRISE.value,
    "orange": CategorieBourse.ENTREPRISE.value,
    "airtel": CategorieBourse.ENTREPRISE.value,
    "moov": CategorieBourse.ENTREPRISE.value,
    "shell": CategorieBourse.ENTREPRISE.value,
    "bp": CategorieBourse.ENTREPRISE.value,
    "exxonmobil": CategorieBourse.ENTREPRISE.value,
    "chevron": CategorieBourse.ENTREPRISE.value,
    "eni": CategorieBourse.ENTREPRISE.value,
    "repsol": CategorieBourse.ENTREPRISE.value,
    "glencore": CategorieBourse.ENTREPRISE.value,
    "kinross": CategorieBourse.ENTREPRISE.value,
    "barrick": CategorieBourse.ENTREPRISE.value,
    "anglogold": CategorieBourse.ENTREPRISE.value,
    "newmont": CategorieBourse.ENTREPRISE.value,
    "riotinto": CategorieBourse.ENTREPRISE.value,
    "bhp": CategorieBourse.ENTREPRISE.value,
    "vale": CategorieBourse.ENTREPRISE.value,

    # --- ATTENTION : daadscholarship.com = BLOG privé, PAS le DAAD officiel ---
    # (daad.de) — ses articles parlent de n'importe quel pays. Le classer
    # « gouvernementale » affichait 25 offres mensongères. Il reste « inconnu ».
    "daad_scholarship": CategorieBourse.INCONNU.value,
    "daad_scholarship_com": CategorieBourse.INCONNU.value,

    # --- Sources d'EMPLOI : aucune bourse → inconnu (pas une catégorie de bourse) ---
    "beta_mr": CategorieBourse.INCONNU.value,
    "linkedin": CategorieBourse.INCONNU.value,
    "anpe": CategorieBourse.INCONNU.value,
    # Ces entreprises publient des RECRUTEMENTS (emploi/stage) — pas de bourse.
    # Leur catégorie de FINANCEUR reste "inconnu" (ce ne sont pas des bourses).
    "mauritel": CategorieBourse.INCONNU.value,
    "snim": CategorieBourse.INCONNU.value,
    "bnm": CategorieBourse.INCONNU.value,
    "totalenergies": CategorieBourse.INCONNU.value,
}

# Repli sur l'ORGANISME (colonne `entreprise` des offres bourses) : seuls des
# financeurs publics EXPLICITES sont reconnus — « government scholarship »,
# « ministry of education », « embassy of France », « bourse du gouvernement »…
# Les mots isolés (ministry, embassy, government, consulate) NE classent PAS.
_MOTS_FINANCEUR_PUBLIC = re.compile(
    r"(?:"
    r"\bambassade\s+(?:de|du|des|d')\s*[\w\u00C0-\u017F]+"
    r"|\bconsulat\s+(?:de|du|des|d')\s*[\w\u00C0-\u017F]+"
    r"|\bconsulat\s+g[eé]n[eé]ral"
    r"|\bminist[eè]re\s+(?:de|du|des|d')\s*[\w\u00C0-\u017F']+"
    r"|\bministry\s+of\s+(?:education|higher\s+education|foreign\s+affairs)"
    r"|\bembassy\s+of\s+\s*[\w\u00C0-\u017F]+"
    r"|\bgovernment\s+scholarships?"
    r"|\bstate\s+scholarships?"
    r"|\bbourse\s+du\s+gouvernement"
    r"|\bgouvernement\s+(?:du|de|d')\s*[\w\u00C0-\u017F]+"
    r")",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# AXE FINANCEUR — indices TEXTUELS (titre + organisme).
#
# Mesure du 27/10/2026 : les 11 sources réellement en base sont des agrégateurs
# (afterschool-africa, scholar-africa, opportunities-for-youth, daad-scholarship…)
# qui publient des bourses de TOUS financeurs. Classer par source ne disait donc
# rien (408/408 « inconnu »). Le financeur est en revanche souvent NOMMÉ dans le
# titre : « Government of Ireland… » (9), « University of… » (93), « Foundation »
# (32), « Erasmus » (24), « DAAD » (42).
#
# Règle : uniquement des formules EXPLICITES (« government scholarship »,
# « foundation », « university »…) — jamais un mot isolé ambigu. `fund` est
# volontairement EXCLU : « fully funded » (102 occurrences) parle du montant,
# pas d'une fondation.
# ---------------------------------------------------------------------------
_MOTS_ETAT = re.compile(
    r"(?:"
    r"\bgovernment\b"
    r"|\bgouvernement\b"
    r"|\bminist[eè]re\s+(?:de|du|des|d')\s*[\w\u00C0-\u017F']+"
    r"|\bministry\s+of\b"
    r"|\bambassade\b|\bembassy\b|\bconsulat\b|\bconsulate\b"
    r"|\bstate\s+scholarships?\b"
    r"|\bbourse\s+d[’']?\s*[eé]tat"
    r"|\bchevening\b|\bfulbright\b|\baustralia\s+awards\b"
    r"|\bmext\b|\bkgsp\b|\bcsc\s+scholarship\b|\beiffel\b"
    r")",
    re.IGNORECASE,
)

_MOTS_FONDATION = re.compile(
    r"(?:"
    r"\bfoundation\b|\bfondation\b"
    r"|\bmastercard\s+foundation\b|\bford\s+foundation\b"
    r"|\bgates\s+foundation\b|\brockefeller\b|\bwellcome\s+trust\b"
    r"|\bopen\s+society\b|\bmo\s+ibrahim\b"
    r")",
    re.IGNORECASE,
)

_MOTS_ENTREPRISE = re.compile(
    r"(?:"
    r"\bsnim\b|\bbnm\b|\bmauritel\b|\btotal\s*energies\b|\btotalenergies\b"
    r"|\bmauritanian\s+copper\s+mines\b|\bkinross\b|\biamb\b"
    r"|\bsoci[eé]t[eé]\s+mauritanienne\b|\bbanque\s+mauritanienne\b"
    r"|\bcaisse\s+nationale\s+de\s+solidarit[eé]\b"
    r"|\battijariwafa\b|\battijari\b|\bmaroc\s+telecom\b|\borange\b"
    r"|\bshell\b|\bexxonmobil\b|\bocp\b|\bdeloitte\b|\bpwc\b|\bkpmg\b"
    r")",
    re.IGNORECASE,
)

_MOTS_INSTITUTION = re.compile(
    r"(?:"
    r"\buniversit[eé]\b|\buniversity\b|\binstitut\b|\binstitute\b"
    r"|\bschool\b|\bcollege\b|\bpolytechnic\b|\bacademy\b"
    r"|\berasmus\b|\bdaad\b|\bcampus\s+france\b|\bcommonwealth\b"
    r"|\bunesco\b|\bbanque\s+mondiale\b|\bworld\s+bank\b|\bafd\b|\bgiz\b"
    r")",
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


def categorie_bourse_pour_source(
    source_name: str | None, organisme: str = "", titre: str = ""
) -> str:
    """Catégorie FINANCEUR d'une offre (jamais devinée).

    Ordre de lecture — du plus sûr au moins sûr :
      1. la SOURCE est classée explicitement (`CATEGORIE_BOURSE_PAR_SOURCE`) ;
      2. le TEXTE nomme un financeur : État/ambassade/ministère, fondation,
         entreprise connue, puis université/institution ;
      3. sinon ``inconnu`` — l'absence d'information n'est pas une catégorie.

    `titre` est indispensable pour les agrégateurs (afterschool-africa,
    scholar-africa…) : la source y est neutre, c'est l'intitulé qui nomme le
    financeur. Mesure du 27/10 : 0 % classé sans le titre, ~60 % avec.
    """
    categorie = CATEGORIE_BOURSE_PAR_SOURCE.get(_cle_source(source_name))
    if categorie is not None:
        return categorie

    texte = f"{organisme or ''} {titre or ''}".strip()
    if not texte:
        return CATEGORIE_BOURSE_DEFAUT

    # Organisme : règle STRICTE (une « Government Agency » n'est pas un
    # financeur, seule une formule explicite compte). Titre : le financeur y est
    # nommé (« Government of Ireland… », « MEXT »), donc la lecture peut être
    # plus large SANS devenir devinette.
    if _MOTS_FINANCEUR_PUBLIC.search(organisme or "") or _MOTS_ETAT.search(titre or ""):
        return CategorieBourse.GOUVERNEMENTALE.value
    if _MOTS_FONDATION.search(texte):
        return CategorieBourse.FONDATION.value
    if _MOTS_ENTREPRISE.search(texte):
        return CategorieBourse.ENTREPRISE.value
    if _MOTS_INSTITUTION.search(texte):
        return CategorieBourse.INSTITUTIONNELLE.value
    return CATEGORIE_BOURSE_DEFAUT


def categorie_bourse_pour_offre(
    metadata: dict | None,
    source_name: str | None = None,
    organisme: str = "",
    titre: str = "",
) -> str:
    """Catégorie LUE sur une offre — `metadata['categorie_bourse']`, un point.

    INVARIANT (décidé le 27/10/2026) : la valeur lue ici est EXACTEMENT celle
    sur laquelle filtre `?categorie=` et que compte `/offres/categories`. Le
    badge et le filtre ne peuvent donc plus se contredire (le repli calculé à
    la lecture produisait des cartes badgées « institutionnelle » rangées dans
    « inconnu » par le filtre).

    Conséquence assumée : une ligne sans clé (legacy, insertion manuelle) est
    ``inconnu`` — ce qui est vrai — jusqu'à ce que la règle d'écriture
    (`categorie_bourse_pour_source`) ou `scripts/backfill-categorie.py` la
    classe. `source_name`/`organisme`/`titre` restent acceptés pour ne pas
    casser les appelants, mais ne servent plus à deviner ici.
    """
    if isinstance(metadata, dict):
        valeur = metadata.get(CLE_METADATA_CATEGORIE)
        if isinstance(valeur, str) and valeur.strip().lower() in CATEGORIES_BOURSE:
            return valeur.strip().lower()
    return CATEGORIE_BOURSE_DEFAUT


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
