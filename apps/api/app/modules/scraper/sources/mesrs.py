# -*- coding: utf-8 -*-
"""Scraper des bourses GOUVERNEMENTALES publiées par le MESRS mauritanien.

Source vérifiée en réel le 20/10/2026 : le Ministère de l'Enseignement supérieur
et de la Recherche scientifique relaie les appels des gouvernements étrangers
(Brésil, Mexique, Maroc, Corée, Chine/UNESCO, Thaïlande, Algérie…) :

  · liste   : https://www.mesrs.gov.mr/en/announcements?type=student  (HTTP 200,
              12 annonces uniques dans `div.card > h3 a` ; AUCUNE pagination —
              aucun lien `?page=` dans la page, vérifié le 20/10/2026) ;
  · détail  : /en/announcement/<id> — `<article>` avec `<h1>` (titre),
              « Publié le 29/06/2026 à 11:40 » et `div.announcement-content`
              (corps). Les variantes /fr/ et /ar/ renvoient 404 → on reste sur /en/.

Règles (identiques à la famille `bourses.py`) :
  · une offre n'est émise QUE si le corps porte une date limite EXPLICITE et
    FUTURE, ancrée par un mot-clé de clôture (« Application Deadline: … until
    July 6, 2026 », « Date limite : 06/07/2026 », « avant le 6 juillet 2026 »).
    Un simple millésime (« 2026–2027 academic year ») n'est JAMAIS une date
    limite : aucune date n'est inventée, aucune offre morte n'est publiée ;
  · les pièces jointes (PDF/images « Fichiers joints ») ne sont pas parsées :
    une annonce dont la date ne vit QUE dans la pièce jointe est ignorée ;
  · `pays_etudes` mappé sur l'enum `PaysEtudes` (`autre` si le pays est absent
    de l'enum), `pays financeur` déduit du titre puis du corps ;
  · dédoublonnage par `source_url` (la page liste affiche certaines annonces
    deux fois : section « For Students » + corps de page).

Robustesse HTTP (2026-10-27) :
  - timeout 30 s (au lieu de 10 s par défaut de `_get` bourses)
  - 2 tentatives avec pause 1 s
  - verify=certifi.where() (pas de chaîne cassée connue pour mesrs.gov.mr)
"""
import re
import time
from datetime import date
from typing import Iterable

import certifi
import httpx
from apps.api.app.modules.scraper.sources.base import BaseScraper
from apps.api.app.modules.scraper.sources.bourses import (
    _extraire_financement,
    _filieres,
    _nettoie,
    _parse_date,
    _resume,
)
from apps.api.app.modules.shared.models import (
    OffreStageCreate,
    PaysEtudes,
    SourceType,
    TypeOffre,
    Ville,
)
from bs4 import BeautifulSoup

SOURCE_NAME = "MESRS Mauritanie"
BASE_URL = "https://www.mesrs.gov.mr"
LISTE_URL = "https://www.mesrs.gov.mr/en/announcements?type=student"

# --- Robustesse HTTP pour MESRS ---
_MESRS_TIMEOUT_S = 30.0
_MAX_TENTATIVES = 2
_PAUSE_ENTRE_TENTATIVES_S = 1.0

ENTETES_MESRS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) LawolMrBot/0.1 (+https://lawol.mr)",
    "Accept-Language": "fr,fr-FR;q=0.9,ar;q=0.6",
}


def _get_mesrs(url: str) -> httpx.Response | None:
    """GET robuste pour MESRS : 2 tentatives, pause 1s, timeout 30s."""
    for tentative in range(1, _MAX_TENTATIVES + 1):
        try:
            r = httpx.get(
                url,
                headers=ENTETES_MESRS,
                timeout=_MESRS_TIMEOUT_S,
                follow_redirects=True,
                verify=certifi.where(),
            )
            r.raise_for_status()
            return r
        except httpx.RequestError as e:
            if tentative < _MAX_TENTATIVES:
                time.sleep(_PAUSE_ENTRE_TENTATIVES_S)
                continue
            print(f"⚠️ MESRS: fetch impossible {url} → {e}")
            return None
        except httpx.HTTPStatusError as e:
            print(f"⚠️ MESRS: HTTP {e.response.status_code} {url} → {e}")
            return None
        except Exception as e:  # noqa: BLE001
            if tentative < _MAX_TENTATIVES:
                time.sleep(_PAUSE_ENTRE_TENTATIVES_S)
                continue
            print(f"⚠️ MESRS: fetch impossible {url} → {type(e).__name__}: {e}")
            return None
    return None

# ---------- Pays financeur : libellé FR, article grammatical, enum PaysEtudes ----------
# Ordre = priorité de lecture (formes les plus longues d'abord pour éviter
# « corée » avant « corée du sud »). Un pays absent de `PaysEtudes` → `autre`.
PAYS_FINANCEURS: dict[str, tuple[str, str, PaysEtudes]] = {
    "corée du sud": ("Corée du Sud", "de la ", PaysEtudes.AUTRE),
    "south korea": ("Corée du Sud", "de la ", PaysEtudes.AUTRE),
    "arabie saoudite": ("Arabie saoudite", "de l'", PaysEtudes.AUTRE),
    "saudi arabia": ("Arabie saoudite", "de l'", PaysEtudes.AUTRE),
    "états-unis": ("États-Unis", "des ", PaysEtudes.USA),
    "etats-unis": ("États-Unis", "des ", PaysEtudes.USA),
    "united states": ("États-Unis", "des ", PaysEtudes.USA),
    "thaïlande": ("Thaïlande", "de la ", PaysEtudes.AUTRE),
    "thailand": ("Thaïlande", "de la ", PaysEtudes.AUTRE),
    "allemagne": ("Allemagne", "de l'", PaysEtudes.ALLEMAGNE),
    "germany": ("Allemagne", "de l'", PaysEtudes.ALLEMAGNE),
    "allemand": ("Allemagne", "de l'", PaysEtudes.ALLEMAGNE),
    "australie": ("Australie", "de l'", PaysEtudes.AUTRE),
    "australia": ("Australie", "de l'", PaysEtudes.AUTRE),
    "algérie": ("Algérie", "de l'", PaysEtudes.ALGERIE),
    "algeria": ("Algérie", "de l'", PaysEtudes.ALGERIE),
    "algérien": ("Algérie", "de l'", PaysEtudes.ALGERIE),
    "brésil": ("Brésil", "du ", PaysEtudes.AUTRE),
    "brazil": ("Brésil", "du ", PaysEtudes.AUTRE),
    "brazilian": ("Brésil", "du ", PaysEtudes.AUTRE),
    "bresil": ("Brésil", "du ", PaysEtudes.AUTRE),
    "canada": ("Canada", "du ", PaysEtudes.CANADA),
    "canadien": ("Canada", "du ", PaysEtudes.CANADA),
    "chinois": ("Chine", "de la ", PaysEtudes.AUTRE),
    "chinoise": ("Chine", "de la ", PaysEtudes.AUTRE),
    "chine": ("Chine", "de la ", PaysEtudes.AUTRE),
    "china": ("Chine", "de la ", PaysEtudes.AUTRE),
    "chinese": ("Chine", "de la ", PaysEtudes.AUTRE),
    "corée": ("Corée du Sud", "de la ", PaysEtudes.AUTRE),
    "korea": ("Corée du Sud", "de la ", PaysEtudes.AUTRE),
    "korean": ("Corée du Sud", "de la ", PaysEtudes.AUTRE),
    "égypte": ("Égypte", "de l'", PaysEtudes.AUTRE),
    "egypt": ("Égypte", "de l'", PaysEtudes.AUTRE),
    "espagne": ("Espagne", "de l'", PaysEtudes.ESPAGNE),
    "spain": ("Espagne", "de l'", PaysEtudes.ESPAGNE),
    "espagnol": ("Espagne", "de l'", PaysEtudes.ESPAGNE),
    "france": ("France", "de la ", PaysEtudes.FRANCE),
    "français": ("France", "de la ", PaysEtudes.FRANCE),
    "french": ("France", "de la ", PaysEtudes.FRANCE),
    "inde": ("Inde", "de l'", PaysEtudes.AUTRE),
    "india": ("Inde", "de l'", PaysEtudes.AUTRE),
    "indien": ("Inde", "de l'", PaysEtudes.AUTRE),
    "italie": ("Italie", "de l'", PaysEtudes.ITALIE),
    "italy": ("Italie", "de l'", PaysEtudes.ITALIE),
    "italien": ("Italie", "de l'", PaysEtudes.ITALIE),
    "japon": ("Japon", "du ", PaysEtudes.AUTRE),
    "japan": ("Japon", "du ", PaysEtudes.AUTRE),
    "japonais": ("Japon", "du ", PaysEtudes.AUTRE),
    "maroc": ("Maroc", "du ", PaysEtudes.MAROC),
    "morocco": ("Maroc", "du ", PaysEtudes.MAROC),
    "moroccan": ("Maroc", "du ", PaysEtudes.MAROC),
    "marocain": ("Maroc", "du ", PaysEtudes.MAROC),
    "mexique": ("Mexique", "du ", PaysEtudes.AUTRE),
    "mexico": ("Mexique", "du ", PaysEtudes.AUTRE),
    "mexican": ("Mexique", "du ", PaysEtudes.AUTRE),
    "qatar": ("Qatar", "du ", PaysEtudes.AUTRE),
    "russie": ("Russie", "de la ", PaysEtudes.AUTRE),
    "russia": ("Russie", "de la ", PaysEtudes.AUTRE),
    "russe": ("Russie", "de la ", PaysEtudes.AUTRE),
    "sénégal": ("Sénégal", "du ", PaysEtudes.SENEGAL),
    "senegal": ("Sénégal", "du ", PaysEtudes.SENEGAL),
    "tunisie": ("Tunisie", "de la ", PaysEtudes.TUNISIE),
    "tunisia": ("Tunisie", "de la ", PaysEtudes.TUNISIE),
    "tunisien": ("Tunisie", "de la ", PaysEtudes.TUNISIE),
    "turquie": ("Turquie", "de la ", PaysEtudes.TURQUIE),
    "turkey": ("Turquie", "de la ", PaysEtudes.TURQUIE),
    "turc": ("Turquie", "de la ", PaysEtudes.TURQUIE),
}

FINANCEUR_INCONNU = "Gouvernement étranger"

# Une annonce n'est une BOURSE que si elle parle de bourse : une conférence ou
# un concours d'entrée avec une date butoir n'a rien à faire au catalogue.
_MOTS_BOURSE = re.compile(
    r"\b(?:scholarships?|bourses?|bursar(?:y|ies)|fellowships?|grants?|"
    r"mobility\s+program(?:me)?|study\s+abroad|études?\s+à\s+l['’]étranger)\b",
    re.IGNORECASE,
)

# ---------- Dates limites : ancrage obligatoire ----------
# Seule une date PRÉCÉDÉE (fenêtre de 170 car.) d'un mot-clé de clôture est
# retenue : c'est ce qui empêche « 2026–2027 academic year » de devenir une
# date limite. Aucun repli « today + N » : pas de date = pas d'offre.
FENETRE_ANCRE = 170
ANCRES_DEADLINE = re.compile(
    r"(?:deadline|date\s*limite|closing\s*date|last\s*date|due\s*date|"
    r"no\s+later\s+than|not\s+later\s+than|at\s+the\s+latest|until|till|"
    r"before|submitted\s+by|apply\s+by|applications?\s+by|"
    r"avant\s+le|au\s+plus\s+tard|jusqu['’]au|cl[oô]ture|date\s+butoir)",
    re.IGNORECASE,
)

_RE_DATES = re.compile(
    r"(?P<iso>\d{4}-\d{2}-\d{2})"
    r"|(?P<num>\b\d{1,2}[/.]\d{1,2}[/.]\d{4}\b)"
    r"|(?P<jour_mois>\b\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-zÀ-ÿ]{3,12}\.?,?\s+\d{4}\b)"
    r"|(?P<mois_jour>\b[A-Za-zÀ-ÿ]{3,12}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b)",
    re.IGNORECASE,
)


def _date_du_match(match: re.Match) -> date | None:
    """Date d'un match de `_RE_DATES`, ou None si le calendrier la rejette
    (31/02…) — on ne corrige jamais une date illisible."""
    brut = match.group(0)
    if match.group("num"):
        j1, j2, annee = (int(x) for x in re.split(r"[/.]", brut))
        if j1 > 12 and j2 > 12:
            return None
        if j1 > 12:  # 25/12 → JJ/MM
            jour, mois = j1, j2
        elif j2 > 12:  # 11/30 → MM/JJ (format américain, sans ambiguïté)
            jour, mois = j2, j1
        else:  # 06/07 → convention JJ/MM du site (dates publiées « 29/06/2026 »)
            jour, mois = j1, j2
        try:
            return date(annee, mois, jour)
        except ValueError:
            return None
    # « 6th July 2026 » → « 6 July 2026 » (les ordinaux ne sont pas parsés ailleurs)
    return _parse_date(re.sub(r"(?<=\d)(?:st|nd|rd|th)", "", brut))


def dates_limites(texte: str) -> list[tuple[date, str]]:
    """Toutes les dates de clôture ANCRÉES du texte, dans l'ordre du document.

    Retour : [(date, écriture d'origine)] — vide si aucune date n'est précédée
    d'un mot-clé de clôture exploitable.
    """
    plat = re.sub(r"\s+", " ", texte or "")
    trouvees: list[tuple[date, str]] = []
    for match in _RE_DATES.finditer(plat):
        debut = max(0, match.start() - FENETRE_ANCRE)
        if not ANCRES_DEADLINE.search(plat[debut:match.start()]):
            continue
        jour = _date_du_match(match)
        if jour is not None:
            trouvees.append((jour, match.group(0)))
    return trouvees


# ---------- Lecture des pages ----------
def _parser_liste(html_texte: str) -> list[tuple[str, str]]:
    """Cartes `div.card` → [(url absolue, titre)] ; les doublons d'affichage
    restent dans la liste (le dédoublonnage par URL est fait par `fetch`)."""
    soup = BeautifulSoup(html_texte, "html.parser")
    annonces: list[tuple[str, str]] = []
    for carte in soup.select("div.card"):
        lien = carte.select_one("h3 a[href]") or carte.select_one('a[href*="/announcement/"]')
        if lien is None:
            continue
        url = (lien.get("href") or "").strip()
        if "/announcement/" not in url:
            continue
        if url.startswith("/"):
            url = BASE_URL + url
        annonces.append((url, lien.get_text(" ", strip=True)))
    return annonces


def _date_publication(entete: str) -> date | None:
    """« Publié le 29/06/2026 à 11:40 » → date (métadonnée de traçabilité)."""
    match = re.search(
        r"(?:Publié|Publie|Published)\s+le\s+(\d{1,2}[/.]\d{1,2}[/.]\d{4})",
        entete or "",
        re.IGNORECASE,
    )
    if match is None:
        return None
    for candidat in _RE_DATES.finditer(match.group(1)):
        jour = _date_du_match(candidat)
        if jour is not None:
            return jour
    return None


def _parser_detail(html_texte: str) -> tuple[str, str, date | None] | None:
    """Détail → (titre, corps, date de publication). None = page sans article."""
    soup = BeautifulSoup(html_texte, "html.parser")
    article = soup.find("article")
    if article is None:
        return None
    entete = article.find("header")
    titre_el = None
    if entete is not None:
        titre_el = entete.find(["h1", "h2"])
    titre_el = titre_el or article.find(["h1", "h2"])
    titre = titre_el.get_text(" ", strip=True) if titre_el is not None else ""
    corps_el = article.select_one(".announcement-content")
    if corps_el is None:
        corps_el = article
    publication = _date_publication(entete.get_text(" ", strip=True) if entete else "")
    return titre, corps_el.get_text(" ", strip=True), publication


def _pays_financeur(texte: str) -> tuple[str, str, PaysEtudes]:
    """(libellé FR, article, enum PaysEtudes) du pays financeur, sinon inconnu."""
    bas = (texte or "").lower()
    for cle, valeur in PAYS_FINANCEURS.items():
        if re.search(rf"(?<!\w){re.escape(cle)}(?!\w)", bas):
            return valeur
    return ("", "", PaysEtudes.AUTRE)


# ---------- Le scraper ----------
class MesrsMauritanieScraper(BaseScraper):
    """Bourses relayées par le Ministère mauritanien de l'Enseignement supérieur.

    `fetch()` ne rend QUE les annonces portant une date limite explicite future ;
    `self.rapport` conserve la trace des annonces vues / retenues / ignorées
    (et la raison), utilisée par `scripts/test-mesrs-scraper.py --dry-run`.
    """

    source_name = SOURCE_NAME
    LISTE_URL = LISTE_URL

    def __init__(self, max_annonces: int = 40, aujourd_hui: date | None = None):
        self.max_annonces = max_annonces
        self._aujourd_hui = aujourd_hui
        self.rapport: dict = {"vues": 0, "retenues": 0, "doublons": 0, "ignorees": []}

    @property
    def aujourd_hui(self) -> date:
        """Date de référence (injectable → tests déterministes, zéro horloge)."""
        return self._aujourd_hui or date.today()

    def fetch(self) -> Iterable[OffreStageCreate]:
        self.rapport = {"vues": 0, "retenues": 0, "doublons": 0, "ignorees": []}
        reponse = _get_mesrs(self.LISTE_URL)
        if reponse is None:
            print(f"{self.source_name}: liste inaccessible — rien à faire")
            return

        vues: set[str] = set()  # dédoublonnage par source_url
        annonces: list[tuple[str, str]] = []
        for url, titre in _parser_liste(reponse.text):
            if url in vues:
                self.rapport["doublons"] += 1
                continue
            vues.add(url)
            annonces.append((url, titre))
        self.rapport["vues"] = len(annonces)
        print(f"{self.source_name}: {len(annonces)} annonce(s) unique(s) listée(s)")

        for url, titre_liste in annonces[: self.max_annonces]:
            offre = self._traiter(url, titre_liste)
            if offre is not None:
                self.rapport["retenues"] += 1
                yield offre
        for url, titre_liste in annonces[self.max_annonces:]:
            # Une annonce non traitée est comptée « ignorée » : vues = retenues
            # + ignorées, jamais de trou silencieux dans le rapport.
            self._ignorer(url, titre_liste, "au-delà de max_annonces")

    # ---------- interne ----------
    def _ignorer(self, url: str, titre: str, raison: str):
        self.rapport["ignorees"].append({"url": url, "titre": titre, "raison": raison})
        return None

    def _traiter(self, url: str, titre_liste: str) -> OffreStageCreate | None:
        reponse = _get_mesrs(url)
        if reponse is None:
            return self._ignorer(url, titre_liste, "détail inaccessible")
        detail = _parser_detail(reponse.text)
        if detail is None:
            return self._ignorer(url, titre_liste, "page sans article")
        titre, corps, publication = detail
        return self._construire(url, titre or titre_liste, corps, publication)

    def _construire(
        self, url: str, titre_brut: str, corps_brut: str, publication: date | None
    ) -> OffreStageCreate | None:
        titre = _nettoie(titre_brut)
        corps = _nettoie(corps_brut)
        if len(titre) < 5:
            return self._ignorer(url, titre, "titre trop court")
        if not _MOTS_BOURSE.search(f"{titre} {corps}"):
            return self._ignorer(url, titre, "hors périmètre bourse (aucun mot-clé bourse)")

        candidates = dates_limites(corps)
        if not candidates:
            return self._ignorer(url, titre, "aucune date limite explicite")
        futures = [c for c in candidates if c[0] >= self.aujourd_hui]
        if not futures:
            ecritures = ", ".join(sorted({c[1] for c in candidates}))
            return self._ignorer(url, titre, f"date limite dépassée ({ecritures})")
        date_limite, ecriture = min(futures, key=lambda c: c[0])

        libelle, article, pays_enum = _pays_financeur(f"{titre} {corps}")
        entreprise = f"Gouvernement {article}{libelle}" if libelle else FINANCEUR_INCONNU
        forfait = f"{titre} {corps}"

        return OffreStageCreate(
            source=SourceType.AUTRE,
            source_name=self.source_name,
            source_url=url[:500],
            titre=titre[:300],
            entreprise=entreprise[:200],
            ville=Ville.NOUAKCHOTT,
            pays_etudes=pays_enum,
            filieres_cibles=_filieres(forfait),
            type_offre=TypeOffre.BOURSE,
            type_financement=_extraire_financement(forfait),
            description=_resume(corps),
            date_limite=date_limite,
            contact_email=None,
            contact_whatsapp=None,
            metadata={
                "pays_financeur": libelle or "inconnu",
                "deadline_source": ecriture,
                "date_publication": publication.isoformat() if publication else None,
                "relais": "MESRS Mauritanie",
            },
        )
