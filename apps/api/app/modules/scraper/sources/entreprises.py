"""Scraper générique pour sites d'entreprises / institutions mauritaniennes.

Stratégie (v1) :
  1. Fetch de la page (listes de carrières / accueil)
  2. Extraction des liens dont l'ancre ou l'URL évoque un stage/emploi/recrutement
  3. Classification basique : ville, filières, type d'offre (mots-clés)
  4. Rendu d'OffreStageCreate (validation Pydante avant insertion)
"""
from datetime import date, timedelta
from typing import Iterable
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from apps.api.app.modules.shared.models import (
    Filiere,
    OffreStageCreate,
    SourceType,
    TypeOffre,
    Ville,
)
from apps.api.app.modules.scraper.sources.base import BaseScraper

# Mots-clés → critère de pertinence d'un lien
LIEN_MOTS_CLES = (
    "stage", "stages", "stagiaire", "carrieres", "carriere", "recrutement",
    "emploi", "job", "jobs", "pfe", "alternance", "concours", "offre",
    "appel", "candidature", "recruter", "vacance", "poste",
)

# Classification filière depuis le texte (d'abord spécifique, puis général)
FILIERE_MOTS_CLES: dict[Filiere, tuple[str, ...]] = {
    Filiere.INFORMATIQUE: (
        "developpeur", "développeur", "software", "informatique", "data", "cyber",
        "cloud", "devops", "fullstack", "back-end", "frontend", "mobile", "ia",
        "reseau", "réseau", "sysadmin", "digital",
    ),
    Filiere.GENIE_CIVIL: ("genie civil", "génie civil", "btp", "chantier", "vrd", "topograph"),
    Filiere.ELECTRIQUE: ("electrique", "électrique", "electronique", "instrumentation", "energie", "énergie"),
    Filiere.MECANIQUE: ("mecanique", "mécanique", "maintenance", "industriel", "production"),
    Filiere.GESTION: ("ressources humaines", "rh ", "gestion", "assistant", "admin", "secretaire", "bureau"),
    Filiere.FINANCE: ("finance", "audit", "compta", "comptab", "banque", "tresorer", "trésorer", "risk"),
    Filiere.DROIT: ("droit", "juridique", "legal", "juriste"),
    Filiere.AGRONOMIE: ("agro", "agronom", "elevage", "élevage", "filiere animale"),
}

VILLE_MOTS_CLES: dict[Ville, tuple[str, ...]] = {
    Ville.NOUAKCHOTT: ("nouakchott", "nktt", "tevragh", "ksar", "teyarett", "dar naim", "sebkha"),
    Ville.NOUADHIBOU: ("nouadhibou", "nouadhibou", " ndb"),
    Ville.KAEDI: ("kaedi", "kaédi"),
    Ville.ROSSO: ("rosso",),
    Ville.ALEG: ("aleg",),
}

TYPE_MOTS_CLES: dict[TypeOffre, tuple[str, ...]] = {
    TypeOffre.STAGE_PFE: ("pfe", "fin d'etudes", "fin d'études", "stage de fin", "memoire", "mémoire"),
    TypeOffre.STAGE_ETE: ("stage d'ete", "stage d'été", "stage ete", "vacances"),
    TypeOffre.ALTERNANCE: ("alternance", "apprentissage", "contrat de professionnalisation"),
    TypeOffre.EMPLOI_JUNIOR: ("jeune diplome", "jeune diplômé", "junior", "premier emploi", "0-2 ans", "debutant", "débutant"),
}


def _detect_filieres(texte: str) -> list[Filiere]:
    t = texte.lower()
    trouvees = [f for f, mots in FILIERE_MOTS_CLES.items() if any(m in t for m in mots)]
    return trouvees or [Filiere.AUTRE]


def _detect_ville(texte: str) -> Ville:
    t = texte.lower()
    for v, mots in VILLE_MOTS_CLES.items():
        if any(m in t for m in mots):
            return v
    return Ville.NOUAKCHOTT  # défaut : la majorité des offres sont à Nouakchott


def _detect_type(texte: str) -> TypeOffre:
    t = texte.lower()
    for typ, mots in TYPE_MOTS_CLES.items():
        if any(m in t for m in mots):
            return typ
    return TypeOffre.STAGE_PFE  # défaut cible du produit


class EntrepriseScraper(BaseScraper):
    """Scrape une page donnée d'une entreprise/institution et en extrait les offres."""

    def __init__(
        self,
        nom: str,
        urls: list[str],
        ville_defaut: Ville = Ville.NOUAKCHOTT,
        delai_max_jours: int = 90,
        timeout: int = 15,
    ):
        self.source_name = nom
        self.urls = urls
        self.ville_defaut = ville_defaut
        self.delai_max_jours = delai_max_jours
        self.timeout = timeout

    @property
    def _type_source(self) -> SourceType:
        if self.source_name in ("anpe",):
            return SourceType.ANPE
        if self.source_name in ("univ_nouakchott", "uasz", "iseri"):
            return SourceType.UNIVERSITE
        return SourceType.ENTREPRISE

    def fetch(self) -> Iterable[OffreStageCreate]:
        vus: set[str] = set()
        entetes = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) LawolMrBot/0.1 (+https://lawol.mr)",
            "Accept-Language": "fr,fr-FR;q=0.9,ar;q=0.6",
        }

        for url_page in self.urls:
            try:
                resp = httpx.get(
                    url_page,
                    headers=entetes,
                    timeout=self.timeout,
                    follow_redirects=True,
                    verify=False,  # certificats locaux mauritaniens non fiables (GET public uniquement)
                )
                resp.raise_for_status()
            except Exception as e:  # noqa: BLE001
                print(f"⚠️ {self.source_name}: fetch impossible {url_page} → {e}")
                continue

            soup = BeautifulSoup(resp.text, "html.parser")

            for lien in soup.find_all("a", href=True):
                href = lien.get("href", "").strip()
                texte = " ".join(lien.get_text(" ", strip=True).split())
                if not href or not texte or len(texte) < 5:
                    continue

                # URL absolue
                if href.startswith(("mailto:", "tel:", "javascript:", "#")):
                    continue
                url_abs = urljoin(url_page, href)

                # Filtre pertinence : ancre OU URL contient un mot-clé
                candidat = (texte + " " + url_abs).lower()
                if not any(m in candidat for m in LIEN_MOTS_CLES):
                    continue
                if url_abs in vus:
                    continue
                vus.add(url_abs)

                # Classification (sur ancre + URL, plus le contexte parent)
                contexte = candidat
                parent = lien.find_parent(["li", "article", "div", "tr"])
                if parent:
                    contexte += " " + parent.get_text(" ", strip=True).lower()[:400]

                # Type de contrat
                type_offre = TypeOffre.STAGE_PFE
                for typ, mots in TYPE_MOTS_CLES.items():
                    if any(m in contexte for m in mots):
                        type_offre = typ
                        break

                yield OffreStageCreate(
                    source=self._type_source,
                    source_name=self.source_name,
                    source_url=url_abs[:500],
                    titre=texte[:300],
                    entreprise=self.source_name.replace("_", " ").title(),
                    ville=_detect_ville(contexte) if any(
                        m in contexte for mots in VILLE_MOTS_CLES.values() for m in mots
                    ) else self.ville_defaut,
                    filieres_cibles=_detect_filieres(contexte),
                    type_offre=type_offre,
                    description=texte[:500],
                    date_limite=date.today() + timedelta(days=self.delai_max_jours),
                )
