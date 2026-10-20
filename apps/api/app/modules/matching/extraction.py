"""Extraction de signaux depuis le TEXTE d'une offre — fonctions pures, sans I/O.

Pourquoi ce module existe (mesuré le 21/10/2026 sur 260 bourses actives) :

- `pays_etudes` rempli sur 100/260 (38 %), `type_financement` connu sur 98/260
  (38 %) : deux critères de pertinence étaient donc ignorés sur ~60 % du
  catalogue. Mais les descriptions contiennent l'information : médiane 1 669
  caractères, 2 vides sur 260.
- `niveau` : absent de la table, détectable dans le texte d'après la sonde
  (216/260, 83 %). Or `profils.niveau` existe déjà (`M2`, `L3`…) : c'est le
  seul critère d'ADÉQUATION disponible sans nouvelle saisie utilisateur.
- `langue` (58/260, 22 %) et `montant` (11/260, 4 %) restent sous le seuil
  d'activation de 80 % : ils ne sont PAS extraits ici (ne pas pondérer une
  donnée qu'on ne remplit pas).

Règle de conception : on lit le texte, on ne devine jamais. Pas de score de
confiance inventé — une valeur extraite est un fait textuel, la satisfaction
du barème porte la nuance.
"""

from __future__ import annotations

import re

# --------------------------------------------------------------------- niveaux
# L'ordre importe : licence < master < doctorat (progression académique).
NIVEAUX_ORDONNES = ("licence", "master", "doctorat")

# Un motif = une famille de mots réellement observée dans le catalogue.
_MOTIFS_NIVEAU: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("doctorat", re.compile(r"\b(ph\.?d|doctorat|doctoral|doctorate)\b", re.I)),
    (
        "master",
        re.compile(
            r"\b(master'?s?|mast[eè]re|msc|mba|postgraduate|ma[iî]trise|graduate research)\b",
            re.I,
        ),
    ),
    (
        "licence",
        re.compile(
            r"\b(bachelor'?s?|undergraduate|licence|licenciatura|bac\s?\+?\s?[1-3]\b|"
            r"high school diploma|terminale)\b",
            re.I,
        ),
    ),
)

# Niveaux déclarés côté profil → famille du barème.
_NIVEAU_PROFIL: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^(d|doc|doctorat|phd)", re.I), "doctorat"),
    (re.compile(r"^(m|master|mast[eè]re)", re.I), "master"),
    (re.compile(r"^(l|licence|bac)", re.I), "licence"),
)


def niveau_profil(valeur: str | None) -> str | None:
    """Normalise `profils.niveau` (`M2`, `L3`, `Doctorat`…) en famille du barème.

    Renvoie None si la valeur n'est pas reconnue : un niveau inconnu ne doit
    ni favoriser ni pénaliser (règle du barème).
    """
    if not valeur:
        return None
    texte = str(valeur).strip()
    for motif, famille in _NIVEAU_PROFIL:
        if motif.match(texte):
            return famille
    return None


def extraire_niveaux(texte: str | None) -> frozenset[str]:
    """Familles de niveaux citées dans le texte (`licence`/`master`/`doctorat`).

    Une bourse peut couvrir plusieurs niveaux (« master and PhD ») : on renvoie
    l'ENSEMBLE, jamais une valeur unique arbitraire.
    """
    if not texte:
        return frozenset()
    return frozenset(
        famille for famille, motif in _MOTIFS_NIVEAU if motif.search(texte)
    )


# ---------------------------------------------------------------- financement
# Marqueurs explicites seulement : « tuition » ou « stipend » seuls ne disent
# pas si les frais sont couverts (80 bourses mentionnent « tuition » sans
# préciser qui paie).
_RE_FULLY = re.compile(
    r"(fully[\s-]?funded|full[\s-]?scholarship|100\s?%\s?(?:funded|financement|bourse|"
    r"financ[eé]e?)|covers?\s+(?:all|tuition)\b|all\s+expenses\s+covered|"
    r"prise\s+en\s+charge\s+(?:totale|int[eé]grale)|"
    # « Full tuition fees » + un complément de vie = financement complet.
    r"(?:full|entire)\s+tuition(?:\s+fees?)?[^.]{0,120}(?:stipend|grant|allowance|"
    r"air\s?fare|living|maintenance)|"
    r"(?:tuition|frais\s+de\s+scolarit[eé])[^.]{0,120}(?:stipend|grant|allowance|"
    r"air\s?fare|living|maintenance)\s*(?:and|et)?)",
    re.I,
)
_RE_PARTIEL = re.compile(
    r"(?:\b(?:stipends?|allocation|allocations|allowances?|tuition\s+(?:fee|waiver)|"
    r"frais\s+de\s+scolarit[eé]|partial|partielle?ment?|monthly\s+payment|"
    r"cash\s+stipends?|prizes?)\b|"
    r"\bfull\s+tuition(?:\s+fees)?(?=[\s.,;]|$))",
    re.I,
)
_RE_AUTO = re.compile(
    r"\b(unfunded|non[\s-]?funded|self[\s-]?funded|[aà]\s+(?:votre|sa)\s+charge|"
    r"not\s+funded|sans\s+financement)\b",
    re.I,
)
# Négation locale : « Is the scholarship fully funded? No, … » (cas réel du
# catalogue) ou « not fully funded » ne sont PAS des financements complets.
_RE_NEGATION = re.compile(
    r"\b(not|non|no|n'est\s+pas|pas)\b[^.]{0,25}(fully|full)\b|"
    r"(fully|full)[^.]{0,25}\b(not|pas)\b",
    re.I,
)


def _phrase_autour(texte: str, position: int, taille: int = 220) -> str:
    """Fenêtre de phrase autour d'une position (pour juger une négation)."""
    debut = max(0, position - taille)
    return texte[debut : position + taille]


def _occurrence_affirmative(motif: re.Pattern[str], texte: str) -> bool:
    """Vrai si au moins une occurrence n'est ni une question ni une négation."""
    for m in motif.finditer(texte):
        fenetre = _phrase_autour(texte, m.start())
        # Une question sur le financement n'affirme rien.
        if "?" in fenetre[max(0, 60) : 120] and not _RE_NEGATION.search(fenetre):
            # « …fully funded? No, it is … » → la réponse est dans la suite.
            apres = texte[m.end() : m.end() + 120]
            if re.match(r"\s*[?.!:]?\s*(no|non|not)\b", apres, re.I):
                continue
        if _RE_NEGATION.search(fenetre):
            continue
        return True
    return False


def _depuis_ligne_couverture(texte: str) -> str | None:
    """Lit la ligne structurée « Couverture : … » (template de la source
    Scholar Africa, 62 offres) : c'est un champ, pas de la prose.

    « Grant » n'est ni un financement complet ni une absence : c'est partiel.
    """
    m = re.search(r"couverture\s*:\s*([^.\n]{1,60})", texte, re.I)
    if not m:
        return None
    valeur = m.group(1).strip().lower()
    if not valeur:
        return None
    if re.search(
        r"\b(fully[\s-]?funded|full\s+(?:scholarship|funding)|complet|totale|int[eé]grale)",
        valeur,
    ):
        return "fully_funded"
    if re.search(
        r"\b(full\s+tuition|grant|stipend|partiel|allocation|bourse)", valeur
    ):
        return "partiel"
    if re.search(r"\b(non|aucune|unfunded|sans)", valeur):
        return "auto_finance"
    return None


def extraire_financement(texte: str | None) -> str | None:
    """Type de financement lisible dans le texte, ou None si le texte ne dit rien.

    Valeurs renvoyées = celles de l'enum `TypeFinancement` (aucune invention).
    Le champ structuré « Couverture : … » est prioritaire sur la prose : c'est
    une donnée écrite par le scraper, pas une déduction.
    """
    if not texte:
        return None
    structure = _depuis_ligne_couverture(texte)
    if structure:
        return structure
    if _occurrence_affirmative(_RE_AUTO, texte):
        return "auto_finance"
    if _occurrence_affirmative(_RE_FULLY, texte):
        return "fully_funded"
    if _occurrence_affirmative(_RE_PARTIEL, texte):
        return "partiel"
    return None


# ------------------------------------------------------- application aux offres
def _texte_offre(offre: dict) -> str:
    return f"{offre.get('titre') or ''} {offre.get('description') or ''}".strip()


def niveaux_effectifs(offre: dict) -> frozenset[str]:
    """Niveaux de l'offre : champ structuré prioritaire, sinon texte."""
    declares = offre.get("niveau_etudes")
    if isinstance(declares, str) and declares.strip():
        familles = {
            niveau_profil(part) for part in re.split(r"[,;/|]", declares) if part.strip()
        }
        familles.discard(None)
        if familles:
            return frozenset(familles)  # type: ignore[arg-type]
    if isinstance(declares, (list, tuple)) and declares:
        familles = {niveau_profil(str(x)) for x in declares}
        familles.discard(None)
        if familles:
            return frozenset(familles)  # type: ignore[arg-type]
    return extraire_niveaux(_texte_offre(offre))


def financement_effectif(offre: dict) -> str | None:
    """Financement de l'offre : champ structuré prioritaire, sinon texte.

    `inconnu` n'est pas une valeur : c'est l'absence de donnée (elle ne doit ni
    favoriser ni pénaliser), donc on tente l'extraction.
    """
    declare = offre.get("type_financement")
    if declare and declare != "inconnu":
        return declare
    return extraire_financement(_texte_offre(offre))
