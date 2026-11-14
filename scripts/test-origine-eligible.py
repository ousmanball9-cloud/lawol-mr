#!/usr/bin/env python3
"""Harnais de l'ELIGIBILITE PAR ORIGINE (contrat metadata §2.2, lot V4-D)."

Zero reseau par defaut. Chaque cas est une chaine REELLE du catalogue LAWOL
(relevee le 07/11/2026 via `--mesure`), pas un exemple d'ecole.

Regle du lot (option b arbitree) : on affiche un indice « compatible » SEULEMENT
quand la source publie le critere d'origine. Tout le reste est SILENCE. On ne
deduit JAMAIS l'eligibilite de `pays_etudes` : cette colonne dit OU l'on etudie,
pas QUI peut candidater (decision produit du 05/11/2026).

Sortie : N/N checks verts, exit 1 si un seul KO.

Usage :
    python scripts/test-origine-eligible.py            # harnais hors ligne
    python scripts/test-origine-eligible.py --mesure   # + taux de couverture
                                                       #   (lecture seule Supabase)
"""

from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Le client Supabase est instancie a l'import de `core.database` : le harnais
# d'ecriture fournit des valeurs factices AVANT (aucun appel reseau).
os.environ.setdefault("SUPABASE_URL", "https://exemple.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "cle-factice-pour-harnais")

if hasattr(sys.stdout, "reconfigure"):  # console cp1252 : jamais de crash d'affichage
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_checks: list[tuple[bool, str]] = []


def check(ok: bool, libelle: str) -> None:
    _checks.append((bool(ok), libelle))
    if not ok:
        print(f"  KO : {libelle}")


# --------------------------------------------------------------------- cas reels
# (titre + description, attendu) - attendu None = le contrat exige le SILENCE.
COMPATIBLE = {"indice": "compatible"}

CAS: list[tuple[str, dict | None]] = [
    # --- ce que la source PUBLIE (indice affichable) -------------------------
    # 1. UGHE / Mastercard Foundation : citoyennete d'un pays africain.
    (
        (
            "Fully Funded UGHE Mastercard Foundation Scholarship for Africans 2027 "
            "(MSc-HPE). Who can Apply: Applicants must be 35 years old or younger at "
            "the time of application. Must be residents and citizens or hold refugee "
            "status in an African country. Must hold a Bachelor's degree in a "
            "health-related field."
        ),
        dict(COMPATIBLE, preuve="texte"),
    ),
    # 2. Erasmus Mundus EDISS : champ « Who can Apply? » + toutes nationalites.
    (
        (
            "Erasmus Mundus EDISS Scholarships in Europe 2027 (Fully Funded). "
            "Who can Apply?: Applicants of all nationalities holding a relevant "
            "bachelor's degree (or equivalent of at least 180 ECTS)."
        ),
        dict(COMPATIBLE, preuve="source"),
    ),
    # 3. Erasmus Mundus MAPP : ouverture explicite, aucune nationalite exclue.
    (
        (
            "Erasmus Mundus MAPP Scholarship 2027/29 (Fully Funded). Eligibility "
            "Criteria The Scholarship is open to all Nationals. Applicants must hold "
            "a bachelor's degree or equivalent."
        ),
        dict(COMPATIBLE, preuve="texte"),
    ),
    # 4. Radboud : cible « non-EU/EEA » — la Mauritanie est hors UE/EEE.
    (
        (
            "Radboud Scholarship Programme for International Students. Target group: "
            "Non-EU/EEA International Students Scholarship value/inclusions/duration: "
            "A partial scholarship will reduce your tuition fee."
        ),
        dict(COMPATIBLE, preuve="source"),
    ),
    # 5. Anzisha : champ « Eligible Countries: African countries ».
    (
        (
            "Anzisha Fellowship 2027 for Young African Entrepreneurs. Eligible "
            "Countries: African countries Program Duration: Multi-year programme. "
            "Funding/Benefits: $40 000 USD worth of support."
        ),
        dict(COMPATIBLE, preuve="source"),
    ),
    # 6. Nordic Africa Institute : PIEGE. « based in Sweden » n'est pas une
    #    condition d'origine ; la phrase dit « regardless of citizenship ».
    (
        (
            "Nordic Africa Institute's Nordic Scholarship Programme 2027/2028 for "
            "early-career researchers (Fully Funded). You may apply regardless of "
            "citizenship, but you must be affiliated to and based at a university or "
            "research centre in Sweden."
        ),
        dict(COMPATIBLE, preuve="texte"),
    ),
    # --- ce qui doit rester SILENCIEUX --------------------------------------
    # 7. Novo Nordisk : la source PUBLIE un critere ferme (Danemark) → silence,
    #    et surtout AUCUN repli sur la prose alentour.
    (
        (
            "Novo Nordisk Foundation Postdoctoral Fellowships at the University of "
            "Oxford 2027. Date de cloture : 29 January 2027. Eligible Countries: "
            "Denmark Program Duration: Three years total."
        ),
        None,
    ),
    # 8. University of Rwanda : phrase de MISSION (« intended to expand access
    #    ... for 1,400 talented young Africans »), pas un critere de candidature.
    (
        (
            "University of Rwanda Mastercard Foundation Scholars Program 2026-2027. "
            "According to the official call, the programme is intended to expand "
            "access to quality higher education for 1,400 talented young Africans "
            "with limited access to opportunities."
        ),
        None,
    ),
    # 9. DAAD : le mot « nationality » sans critere d'origine.
    (
        (
            "15 Highest Stipend Paying PhD Scholarships 2027 for International "
            "Students. Choose the awards where your research, nationality, funding "
            "needs, and career plans line up."
        ),
        None,
    ),
    # 10. Banque asiatique de developpement : liste fermee de pays membres.
    (
        (
            "Asian Development Bank Scholarship. Eligibility is restricted to "
            "citizens of eligible Asian Development Bank developing member countries "
            "and territories who satisfy the programme's academic criteria."
        ),
        None,
    ),
    # 11. Aucun critere d'origine du tout.
    (
        (
            "Bourse de recherche en informatique. Le dossier se compose d'un CV, "
            "d'une lettre de motivation et de deux references academiques."
        ),
        None,
    ),
]


def preuve_cas() -> None:
    from apps.api.app.modules.matching.extraction import origine_depuis_texte

    print("--- cas reels du catalogue ---")
    for index, (texte, attendu) in enumerate(CAS, start=1):
        obtenu = origine_depuis_texte(texte)
        check(
            obtenu == attendu,
            f"cas {index} : attendu {attendu}, obtenu {obtenu} | {texte[:60]}...",
        )


def preuve_garde_forme() -> None:
    """`origine_stockee` : seule une paire (indice, preuve) du contrat s'affiche."""
    from apps.api.app.modules.matching.extraction import origine_stockee

    print("--- garde de forme de la valeur stockee (contrat §2.2) ---")
    valide = {"indice": "compatible", "preuve": "texte"}
    check(
        origine_stockee({"origine_eligible": valide}) == valide,
        "paire conforme (compatible + texte) servie telle quelle",
    )
    check(
        origine_stockee({"origine_eligible": {"indice": "incompatible", "preuve": "source"}})
        == {"indice": "incompatible", "preuve": "source"},
        "paire conforme (incompatible + source) servie telle quelle",
    )
    refus = {
        "indice inconnu = silence": {"indice": "inconnu", "preuve": "texte"},
        "preuve absente": {"indice": "compatible"},
        "preuve hors contrat": {"indice": "compatible", "preuve": "devine"},
        "indice hors contrat": {"indice": "probable", "preuve": "texte"},
        "valeur non dict": "compatible",
    }
    for libelle, valeur in refus.items():
        check(
            origine_stockee({"origine_eligible": valeur}) is None,
            f"refus : {libelle}",
        )
    check(origine_stockee({}) is None, "refus : cle absente")
    check(origine_stockee(None) is None, "refus : metadata None")
    check(origine_stockee({"origine_eligible": None}) is None, "refus : valeur nulle")


class _FauxTable:
    """Faux builder Supabase : capture le payload, ne sort jamais de la machine."""

    def __init__(self, captures: list[dict]) -> None:
        self._captures = captures

    def upsert(self, data: dict, on_conflict: str | None = None):
        self._captures.append({"data": data, "on_conflict": on_conflict})
        return self

    def execute(self):
        return type("Reponse", (), {"data": [{"id": "00000000-0000-0000-0000-000000000000"}]})()


class _FauxSupabase:
    def __init__(self, captures: list[dict]) -> None:
        self._captures = captures

    def table(self, _nom: str) -> _FauxTable:
        return _FauxTable(self._captures)


def _offre(titre: str, description: str, pays_etudes=None):
    from apps.api.app.modules.shared.models import OffreStageCreate

    return OffreStageCreate(
        source="autre",
        titre=titre,
        entreprise="Exemple Foundation",
        description=description,
        filieres_cibles=["informatique"],
        type_offre="bourse",
        date_limite="2027-12-31",
        source_name="exemple",
        source_url=f"https://exemple.mr/{abs(hash(titre))}",
        active=True,
        pays_etudes=pays_etudes,
    )


def _scraper_de_test():
    from apps.api.app.modules.scraper.sources import base

    class _Scraper(base.BaseScraper):
        source_name = "exemple"

        def fetch(self):
            return []

    return _Scraper()


def preuve_ecriture() -> None:
    """Le critere est pose au POINT D'ECRITURE UNIQUE (lecon V4-B)."""
    from apps.api.app.modules.scraper.sources import base

    print("--- metadata['origine_eligible'] pose au point d'ecriture ---")
    captures: list[dict] = []
    vrai_client = base.supabase
    base.supabase = _FauxSupabase(captures)  # type: ignore[assignment]
    try:
        _scraper_de_test().save(
            [
                _offre(
                    "Bourse Example 2027",
                    "Who can Apply: Applicants of all nationalities holding a "
                    "bachelor's degree.",
                    pays_etudes="france",
                ),
                _offre(
                    "Bourse Sans Critere 2027",
                    "Le dossier se compose d'un CV et d'une lettre de motivation.",
                    pays_etudes="france",
                ),
            ]
        )
    finally:
        base.supabase = vrai_client  # type: ignore[assignment]

    check(len(captures) == 2, f"deux upserts captures (obtenu {len(captures)})")
    if len(captures) != 2:
        return
    avec, sans = (c["data"] for c in captures)
    check(
        (avec.get("metadata") or {}).get("origine_eligible")
        == {"indice": "compatible", "preuve": "source"},
        f"critere ecrit dans metadata : {(avec.get('metadata') or {}).get('origine_eligible')}",
    )
    check(
        "origine_eligible" not in (sans.get("metadata") or {}),
        "aucune cle quand le texte ne publie aucun critere (silence)",
    )
    check(
        (avec.get("metadata") or {}).get("categorie_bourse") is not None,
        "la categorie de bourse reste ecrite (aucune regression du voisin)",
    )
    check(
        captures[0]["on_conflict"] == "source_url",
        "l'upsert garde sa cle d'idempotence `source_url`",
    )


def preuve_pas_de_deduction_pays() -> None:
    """`pays_etudes` ne fabrique JAMAIS un indice (decision produit 05/11/2026)."""
    from apps.api.app.modules.scraper.sources import base

    print("--- pays_etudes n'est pas une preuve d'origine ---")
    captures: list[dict] = []
    vrai_client = base.supabase
    base.supabase = _FauxSupabase(captures)  # type: ignore[assignment]
    try:
        _scraper_de_test().save(
            [
                _offre(
                    "Bourse en France 2027",
                    "Le dossier se compose d'un CV et d'une lettre de motivation.",
                    pays_etudes="france",
                ),
                _offre(
                    "Bourse au Senegal 2027",
                    "Le dossier se compose d'un CV et d'une lettre de motivation.",
                    pays_etudes="senegal",
                ),
            ]
        )
    finally:
        base.supabase = vrai_client  # type: ignore[assignment]

    for capture in captures:
        meta = capture["data"].get("metadata") or {}
        check(
            "origine_eligible" not in meta,
            f"aucun indice deduit du pays d'etudes ({capture['data'].get('pays_etudes')})",
        )


def preuve_guardes_neutralisees() -> None:
    """Controle negatif : chaque garde neutralisee fait TOMBER le cas attendu."

    Si un cas reste correct alors que sa garde est desactivee, c'est que le cas
    ne teste pas cette garde — donc qu'il ne prouve rien.
    """
    from apps.api.app.modules.matching import extraction

    print("--- controle negatif : gardes neutralisees ---")

    # a) Garde « phrase de mission » : cas 8 (University of Rwanda).
    vrai_but = extraction._RE_BUT_ORIGINE
    extraction._RE_BUT_ORIGINE = extraction.re.compile(r"(?!)")  # ne matche jamais
    try:
        obtenu = extraction.origine_depuis_texte(CAS[7][0])
    finally:
        extraction._RE_BUT_ORIGINE = vrai_but
    check(obtenu is not None, f"garde mission neutralisee -> faux positif visible ({obtenu})")
    check(CAS[7][1] is None, "le cas 8 attend bien le silence (garde necessaire)")

    # b) Garde « champ publie par la source » : cas 7 (Eligible Countries: Denmark).
    vrai_champ = extraction._RE_CHAMP_ORIGINE
    extraction._RE_CHAMP_ORIGINE = extraction.re.compile(r"(?!)")
    try:
        obtenu = extraction.origine_depuis_texte(CAS[6][0])
    finally:
        extraction._RE_CHAMP_ORIGINE = vrai_champ
    check(
        obtenu is not None,
        f"garde du champ source neutralisee -> le silence n'est plus garanti ({obtenu})",
    )
    check(CAS[6][1] is None, "le cas 7 attend bien le silence (champ source autoritaire)")

    # c) Garde « ouverture explicite » : sans elle, le cas 3 n'est plus reconnu.
    vrai_explicite = extraction._RE_OUVERTURE_EXPLICITE
    extraction._RE_OUVERTURE_EXPLICITE = extraction.re.compile(r"(?!)")
    try:
        obtenu = extraction.origine_depuis_texte(CAS[2][0])
    finally:
        extraction._RE_OUVERTURE_EXPLICITE = vrai_explicite
    check(
        obtenu != CAS[2][1],
        f"ouverture explicite neutralisee -> cas 3 doit tomber (obtenu {obtenu})",
    )


def mesure() -> None:
    """Taux de couverture reel du catalogue (LECTURE SEULE, zero ecriture)."""
    from datetime import datetime, timezone

    from apps.api.app.core.database import supabase
    from apps.api.app.modules.matching.extraction import (
        origine_depuis_texte,
        origine_stockee,
    )

    print("--- mesure du catalogue public (lecture seule) ---")
    lignes: list[dict] = []
    page, offset = 1000, 0
    while True:
        reponse = (
            supabase.table("offres")
            .select("id, active, date_limite, pays_etudes, metadata, titre, description")
            .range(offset, offset + page - 1)
            .execute()
        )
        lot = reponse.data or []
        lignes.extend(lot)
        if len(lot) < page:
            break
        offset += page

    auj = datetime.now(timezone.utc).date()
    publiques = []
    for ligne in lignes:
        if not ligne.get("active", True):
            continue
        limite = str(ligne.get("date_limite") or "")[:10]
        try:
            if limite and date.fromisoformat(limite) < auj:
                continue
        except ValueError:
            pass
        publiques.append(ligne)

    extractibles = 0
    stockes = 0
    for ligne in publiques:
        texte = f"{ligne.get('titre') or ''} {ligne.get('description') or ''}".strip()
        if origine_depuis_texte(texte):
            extractibles += 1
        if origine_stockee(ligne.get("metadata")):
            stockes += 1

    total = len(publiques)
    pct = (100.0 * extractibles / total) if total else 0.0
    pct_stocke = (100.0 * stockes / total) if total else 0.0
    print(f"lignes lues : {len(lignes)} | offres publiques : {total}")
    print(f"critere extractible du texte : {extractibles} ({pct:.1f} %)")
    print(f"indice deja stocke en base    : {stockes} ({pct_stocke:.1f} %)")
    print(f"dont pays_etudes = mauritanie : "
          f"{sum(1 for l in publiques if l.get('pays_etudes') == 'mauritanie')}")


def main(argv: list[str] | None = None) -> int:
    argv = list(argv if argv is not None else sys.argv[1:])
    print("Harnais eligibilite par ORIGINE - LAWOL.mr")
    preuve_cas()
    preuve_garde_forme()
    preuve_ecriture()
    preuve_pas_de_deduction_pays()
    preuve_guardes_neutralisees()

    if "--mesure" in argv:
        mesure()

    ko = [libelle for ok, libelle in _checks if not ok]
    print(f"\n=== BILAN : {len(_checks) - len(ko)}/{len(_checks)} checks verts ===")
    for libelle in ko:
        print(f"  KO : {libelle}")
    return 1 if ko else 0


if __name__ == "__main__":
    sys.exit(main())
