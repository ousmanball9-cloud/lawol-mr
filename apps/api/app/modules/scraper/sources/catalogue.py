"""Catalogue des sources à scraper — modifiable sans toucher au code.

Sources vivantes vérifiées par DNS + HTTP (2026-10-07).
Les domaines morts (anpe.mr, chinguittybank.mr, ooredoo.mr) sont retirés.
"""
from apps.api.app.modules.shared.models import Ville
from apps.api.app.modules.scraper.sources.base import BaseScraper
from apps.api.app.modules.scraper.sources.entreprises import EntrepriseScraper
from apps.api.app.modules.scraper.sources.beta_mr import BetaMrScraper

# Sources génériques (sites d'entreprises)
CATALOGUE: list[tuple[str, list[str], Ville]] = [
    ("mauritel", ["https://www.mauritel.mr/", "https://mauritel.mr/"], Ville.NOUAKCHOTT),
    ("snim", ["https://www.snim.mr/", "https://snim.mr/"], Ville.NOUADHIBOU),
    ("bnm", ["https://www.bnm.mr/", "https://bnm.mr/"], Ville.NOUAKCHOTT),
    ("totalenergies", ["https://totalenergies.mr/"], Ville.NOUAKCHOTT),
]

# Sources spécifiques (portails d'emploi)
SPECIFIQUES: list[BaseScraper] = [
    BetaMrScraper(),
]


def get_scrapers() -> list:
    generiques = [EntrepriseScraper(nom, urls, ville) for nom, urls, ville in CATALOGUE]
    return generiques + SPECIFIQUES
