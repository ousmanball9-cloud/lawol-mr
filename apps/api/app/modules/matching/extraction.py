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


# --------------------------------------------------------------------- montant
# Contrat : docs/contrat-metadata-offres.md §2.1
#
# Mesure du 06/11/2026 sur le catalogue public (281 offres) : **54** contiennent
# un montant chiffré visible. L'extracteur est donc volontairement ÉTROIT —
# un montant faux est pire qu'un montant absent (décision produit 05/11).
#
# Ce qui est REFUSÉ, et pourquoi :
# - une QUESTION (« Does X really offer €55,000/Year? ») n'affirme rien ;
# - « up to €22,000 » = un plafond, pas un montant reçu ;
# - deux montants différents dans la même fenêtre (« €5,000, €10,000 or
#   €15,000 », « ($43,800 per year value) … $600 per month ») = ambiguïté de
#   périodicité, on se tait ;
# - un montant que l'étudiant PAIE (« will reduce your tuition fee to € 2,771 »,
#   « contribution is capped at ») n'est pas une bourse ;
# - « full tuition + stipend » n'a pas de chiffre : c'est `type_financement`.

_DEVISES_SYMBOLES = {
    "€": "EUR",
    "$": "USD",
    "US$": "USD",
    "£": "GBP",
    "HK$": "HKD",
    "NZ$": "NZD",
    "C$": "CAD",
    "CDN$": "CAD",
    "A$": "AUD",
    "S$": "SGD",
    "R$": "BRL",
}

# Un montant = un NOMBRE collé à une devise, dans un sens ou dans l'autre.
# Les préfixes sont EXPLICITES (`NZ$`, `CDN $`…) : un `[A-Za-z]{0,3}` générique
# avalerait « awar**d $**500 » et changerait la devise.
_RE_MONTANT = re.compile(
    r"(?P<sym>CDN\s?\$|HK\$|NZ\$|US\$|C\$|A\$|S\$|R\$|[€$£])\s?(?P<n1>\d[\d\s.,]*\d|\d)"
    r"|(?P<n2>\d[\d\s.,]*\d|\d)\s?(?P<code>EUR|USD|GBP|HKD|NZD|CAD|AUD|SGD|BRL)\b"
    r"|(?P<n3>\d[\d\s.,]*\d|\d)\s?(?P<mot>euros?|dollars?)\b",
    re.I,
)
_RE_PERIODE_MOIS = re.compile(
    r"(/\s*month|per\s+month|monthly|a\s+month|par\s+mois|/\s*mois|mensuel)", re.I
)
_RE_PERIODE_AN = re.compile(
    r"(/\s*year|per\s+year|per\s+annum|annual|annually|a\s+year|par\s+an|/\s*an|annuel)",
    re.I,
)
_RE_PLAFOND = re.compile(r"(up\s+to|jusqu'[àa]|maximum|max\.?)\s*$", re.I)
_RE_A_PAYER = re.compile(
    r"(will\s+pay|you\s+pay|pay\s+a\s+tuition|tuition\s+contribution|"
    r"contribution\s+is\s+capped|will\s+reduce|reduce\s+your\s+tuition|"
    r"r[eé]duire\s+(?:vos\s+)?frais|frais\s+de\s+scolarit[eé]\s+ramen[eé]s)",
    re.I,
)
_RE_QUALIFICATIF_DOLLAR = (
    (re.compile(r"(canad|canadian)\s*$", re.I), "CAD"),
    (re.compile(r"(austral|australian)\s*$", re.I), "AUD"),
    (re.compile(r"(hong\s?kong|hk)\s*$", re.I), "HKD"),
)

# Une ENVELOPPE de programme (« €420,000 Funding » pour tout un appel) n'est pas
# un montant étudiant. Seuil haut volontaire : un stipend annuel en HK$ ou un
# package de doctorat peuvent légitimement dépasser 100 000 dans leur devise.
_RE_ENVELOPPE = re.compile(r"(programme|program\b|budget|envelope|total\s+funding)", re.I)
SEUIL_ENVELOPPE = 100000

MONTANT_MINIMUM = 100  # en dessous : frais, arrhes, amende — pas une bourse


def _nombre_montant(brut: str) -> float | None:
    """« 21,805 » / « 36.000 » / « 1 400 » → nombre. Aucune invention."""
    texte = re.sub(r"[\s\u00a0\u202f]", "", brut or "")
    if not texte:
        return None
    # Séparateurs de milliers (1.234.567 ou 21,805) : tous les groupes = 3 chiffres.
    if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", texte):
        return float(texte.replace(".", "").replace(",", ""))
    if re.fullmatch(r"\d+[.,]\d{1,2}", texte):  # décimale réelle
        return float(texte.replace(",", "."))
    if re.fullmatch(r"\d+", texte):
        return float(texte)
    return None


def _devise_montant(match: re.Match[str], avant: str) -> str | None:
    symbole = match.group("sym")
    if symbole:
        cle = re.sub(r"\s+", "", symbole).upper()
        return _DEVISES_SYMBOLES.get(cle)
    code = match.group("code")
    if code:
        return code.upper()
    mot = (match.group("mot") or "").lower()
    if mot.startswith("euro"):
        return "EUR"
    if mot.startswith("dollar"):
        for motif, devise in _RE_QUALIFICATIF_DOLLAR:
            if motif.search(avant):
                return devise
        return "USD"
    return None


def _valeur_normalisee(match: re.Match[str]) -> float | None:
    brut = match.group("n1") or match.group("n2") or match.group("n3")
    return _nombre_montant(brut)


def _periode_montant(texte: str, debut: int, fin: int) -> str:
    """`mois` / `an` / `total` — lue APRES puis AVANT le montant."""
    apres = texte[fin : fin + 30]
    if _RE_PERIODE_MOIS.search(apres):
        return "mois"
    if _RE_PERIODE_AN.search(apres):
        return "an"
    avant = texte[max(0, debut - 25) : debut]
    if _RE_PERIODE_MOIS.search(avant):
        return "mois"
    if _RE_PERIODE_AN.search(avant):
        return "an"
    return "total"


def montant_depuis_texte(texte: str | None) -> dict | None:
    """Montant certain lu dans un texte, au format du contrat, ou None.

    Renvoie `{"valeur": int|float, "devise": "EUR", "periode": "mois"}`.
    Chaque refus est explicite dans le code : on préfère zéro montant à un faux.
    """
    if not texte or len(texte.strip()) < 8:
        return None

    for match in _RE_MONTANT.finditer(texte):
        debut, fin = match.start(), match.end()
        fenetre = texte[max(0, debut - 140) : fin + 140]

        if "?" in fenetre:  # une question n'affirme rien
            continue
        if _RE_A_PAYER.search(fenetre):  # ce que l'étudiant paie
            continue
        avant_court = texte[max(0, debut - 20) : debut]
        if _RE_PLAFOND.search(avant_court):  # « up to » = plafond
            continue

        valeur = _valeur_normalisee(match)
        if valeur is None or valeur < MONTANT_MINIMUM:
            continue
        if valeur > SEUIL_ENVELOPPE and _RE_ENVELOPPE.search(fenetre):
            continue  # budget d'un appel, pas la somme versée à un étudiant
        devise = _devise_montant(match, avant_court)
        if devise is None:
            continue

        # Ambiguïté : deux montants différents dans la même fenêtre.
        valeurs = {
            v
            for autre in _RE_MONTANT.finditer(fenetre)
            if (v := _valeur_normalisee(autre)) is not None
        }
        if len(valeurs) > 1:
            continue

        periode = _periode_montant(texte, debut, fin)
        entier = int(valeur) if float(valeur).is_integer() else round(valeur, 2)
        return {"valeur": entier, "devise": devise, "periode": periode}

    return None


def montant_stocke(meta) -> dict | None:
    """`metadata['montant']` si sa forme respecte le contrat §2.1, sinon None.

    Source UNIQUE de lecture pour l'API et pour le backfill : une valeur
    stockée non conforme est ignorée partout, jamais « réparée » à la volée.
    """
    if not isinstance(meta, dict):
        return None
    stocke = meta.get("montant")
    if not isinstance(stocke, dict):
        return None
    valeur = stocke.get("valeur")
    devise = stocke.get("devise")
    periode = stocke.get("periode")
    if (
        isinstance(valeur, (int, float))
        and not isinstance(valeur, bool)
        and valeur > 0
        and isinstance(devise, str)
        and re.fullmatch(r"[A-Z]{3}", devise)
        and periode in ("mois", "an", "total")
    ):
        return {"valeur": valeur, "devise": devise, "periode": periode}
    return None


def montant_effectif(offre: dict) -> dict | None:
    """Montant de l'offre : `metadata['montant']` valide prioritaire, sinon texte."""
    stocke = montant_stocke(offre.get("metadata"))
    if stocke:
        return stocke
    return montant_depuis_texte(_texte_offre(offre))
