"""Scraper générique pour sites d'entreprises / institutions mauritaniennes.

Stratégie (v1) :
  1. Fetch de la page (listes de carrières / accueil)
  2. Extraction des liens dont l'ancre ou l'URL évoque un stage/emploi/recrutement
  3. Classification basique : ville, filières, type d'offre (mots-clés)
  4. Rendu d'OffreStageCreate (validation Pydante avant insertion)

Robustesse HTTP (2026-10-27) :
  - timeout 30 s
  - 2 tentatives avec pause 1 s
  - repli verify=False UNIQUEMENT pour un hôte dont la chaîne de certificats est
    cassée (log d'avertissement explicite ; jamais pour un endpoint authentifié).
"""
import time
from datetime import date, timedelta
from typing import Iterable
from urllib.parse import urljoin

import certifi
import httpx
from apps.api.app.modules.scraper.sources.base import BaseScraper
from apps.api.app.modules.shared.models import (
    Filiere,
    OffreStageCreate,
    SourceType,
    TypeFinancement,
    TypeOffre,
    Ville,
)
from bs4 import BeautifulSoup

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
    Filiere.ELECTRIQUE: (
        "electrique", "électrique", "electronique", "instrumentation", "energie", "énergie"
    ),
    Filiere.MECANIQUE: ("mecanique", "mécanique", "maintenance", "industriel", "production"),
    Filiere.GESTION: (
        "ressources humaines", "rh ", "gestion", "assistant", "admin", "secretaire", "bureau"
    ),
    Filiere.FINANCE: (
        "finance", "audit", "compta", "comptab", "banque", "tresorer", "trésorer", "risk"
    ),
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
    TypeOffre.BOURSE: (
        "pfe", "fin d'etudes", "fin d'études", "stage de fin", "memoire", "mémoire",
        "stage d'ete", "stage d'été", "stage ete", "vacances",
        "alternance", "apprentissage", "contrat de professionnalisation",
        "jeune diplome", "jeune diplômé", "junior", "premier emploi", "0-2 ans",
        "debutant", "débutant",
    ),
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
    return TypeOffre.BOURSE  # défaut cible du produit


# --- Robustesse HTTP ---
_TIMEOUT_S = 30.0
_MAX_TENTATIVES = 2
_PAUSE_ENTRE_TENTATIVES_S = 1.0

# Hôtes connus avec chaîne de certificats cassée (mesuré 2026-10-27) :
# mauritel.mr → CERTIFICATE_VERIFY_FAILED (certifi incomplet)
# Seul ce(s) hôte(s) bénéficie(nt) du repli verify=False avec log explicite.
_HOTES_CHAINE_CASSEE: set[str] = {
    "www.mauritel.mr",
    "mauritel.mr",
}


def _extraire_hote(url: str) -> str:
    """Extrait l'hôte (host) d'une URL pour décision verify."""
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc.lower()
    except Exception:
        return ""


def _fetch_robuste(url: str, entetes: dict, timeout: float) -> httpx.Response | None:
    """GET robuste : 2 tentatives, pause, repli verify=False pour hôtes connus cassés.

    Retourne la Response ou None si échec définitif.
    """
    hote = _extraire_hote(url)
    hote_casse = hote in _HOTES_CHAINE_CASSEE

    for tentative in range(1, _MAX_TENTATIVES + 1):
        try:
            verify = certifi.where() if not hote_casse else False
            resp = httpx.get(
                url,
                headers=entetes,
                timeout=timeout,
                follow_redirects=True,
                verify=verify,
            )
            resp.raise_for_status()
            if hote_casse and tentative == 1:
                print(
                    f"⚠️ {hote}: chaîne de certificats cassée — repli verify=False "
                    f"(tentative {tentative}/{_MAX_TENTATIVES})"
                )
            return resp
        except httpx.RequestError as e:
            # Erreur réseau/timeout → on réessaie si tentative restante
            if tentative < _MAX_TENTATIVES:
                time.sleep(_PAUSE_ENTRE_TENTATIVES_S)
                continue
            print(f"⚠️ {hote}: fetch impossible après {_MAX_TENTATIVES} tentative(s) → {e}")
            return None
        except httpx.HTTPStatusError as e:
            # Erreur HTTP (4xx, 5xx) → pas de retry, on log et on abandonne
            print(f"⚠️ {hote}: HTTP {e.response.status_code} → {e}")
            return None
        except Exception as e:  # noqa: BLE001
            # Autre erreur (ex: SSL verify) → si hôte connu cassé et 1ère tentative,
            # le verify=False a déjà été tenté ci-dessus. Sinon on abandonne.
            if tentative < _MAX_TENTATIVES:
                time.sleep(_PAUSE_ENTRE_TENTATIVES_S)
                continue
            print(f"⚠️ {hote}: fetch impossible → {type(e).__name__}: {e}")
            return None
    return None


class EntrepriseScraper(BaseScraper):
    """Scrape une page donnée d'une entreprise/institution et en extrait les offres."""

    def __init__(
        self,
        nom: str,
        urls: list[str],
        ville_defaut: Ville = Ville.NOUAKCHOTT,
        delai_max_jours: int = 90,
        timeout: float = _TIMEOUT_S,
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
            resp = _fetch_robuste(url_page, entetes, self.timeout)
            if resp is None:
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

                # Type de contrat : le catalogue générique ne sert QUE des
                # sources d'emploi → la règle durable (`scraper/engine.py`,
                # appliquée par `BaseScraper.save`) écrit `emploi_junior` (ou
                # `stage_pfe` pour un stage), jamais `bourse`. Placeholder bridé :
                type_offre = TypeOffre.BOURSE
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
                    type_financement=TypeFinancement.INCONNU,
                    description=texte[:500],
                    date_limite=date.today() + timedelta(days=self.delai_max_jours),
                )
