# -*- coding: utf-8 -*-
"""Scrapers de bourses d'études (TypeOffre.BOURSE).

Le type bourse existait déjà partout (enum, inscription, matching) mais aucune
source ne le collectait : ce module comble le trou avec 5 portails internationaux
ouverts aux étudiants africains/mauritaniens, vérifiés en réel (2026-10-10) :

  1. scholar.africa             : page HTML SSR, lignes `a.row` + date de clôture.
  2. opportunityforafrica.org   : API REST WordPress (JSON), `Deadline: <date>`
                                  dans le contenu de chaque article.
  3. opportunitiesforafricans   : API REST WP, catégorie Scholarships,
                                  « Application Deadline: <date> ».
  4. opportunitiescorners       : API REST WP, catégories bourses BS/MS/PhD +
                                  « Scholarships in <pays> », dates ordinales
                                  (« 6th July 2026 ») normalisées.
  5. opportunitydesk            : API REST WP, catégorie Scholarships,
                                  « Deadline: <date> » en tête d'article.

Les sources 3 à 5 exigent une date de clôture EXPLICITE et lisible dans
l'article (pas de repli today+60) : un billet de blog ou un digest
hebdomadaire sans deadline exploitable n'est pas une bourse.

Règles communes (bon citoyen réseau) :
  - User-Agent honnête, throttle global 1 requête/s, timeout 10 s.
  - Erreurs isolées par source : `_get()` renvoie None, fetch() continue.
  - date_limite : date de clôture future parsée (EN/FR), sinon today+60 ;
    une bourse déjà clôturée est ignorée (jamais de date passée en base).
  - filieres_cibles : détectées par mots-clés, sinon TOUTES les filières
    (règle du brief : le matching engine exclut les offres à filières vides).
"""
import html
import json
import re
import time
from datetime import date, timedelta
from typing import Iterable

import certifi
import httpx
from apps.api.app.modules.scraper.sources.base import BaseScraper
from apps.api.app.modules.scraper.sources.entreprises import FILIERE_MOTS_CLES
from apps.api.app.modules.shared.models import (
    Filiere,
    OffreStageCreate,
    SourceType,
    TypeOffre,
    Ville,
)
from bs4 import BeautifulSoup

# ---------- Réseau : UA honnête, throttle 1 req/s, timeout 10 s ----------
USER_AGENT = "LawolMrBot/0.1 (+https://lawol.mr; bourses-etudes)"
ENTETES = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en,fr;q=0.8",
}
TIMEOUT_S = 10.0
ENTRE_REQUETES_S = 1.0  # throttle : 1 requête/seconde maximum

_derniere_requete = 0.0


def _get(url: str) -> httpx.Response | None:
    """GET avec throttle global + timeout court. None = échec isolé (on continue)."""
    global _derniere_requete
    attente = ENTRE_REQUETES_S - (time.monotonic() - _derniere_requete)
    if attente > 0:
        time.sleep(attente)
    try:
        r = httpx.get(
            url,
            headers=ENTETES,
            timeout=TIMEOUT_S,
            follow_redirects=True,
            verify=certifi.where(),
        )
        r.raise_for_status()
        return r
    except Exception as e:  # noqa: BLE001 — source morte/timeout = on signale et on saute
        print(f"⚠️ bourses: fetch impossible {url} → {type(e).__name__}: {e}")
        return None
    finally:
        _derniere_requete = time.monotonic()


# ---------- Parsing de dates (EN + FR, formats variés) ----------
MOIS = {
    # EN
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12,
    "december": 12,
    # FR
    "janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4, "mai": 5,
    "juin": 6, "juillet": 7, "aout": 8, "août": 8, "septembre": 9,
    "octobre": 10, "novembre": 11, "decembre": 12, "décembre": 12,
}
_RE_ENTIER = re.compile(r"\b(\d{1,2})\s+([a-zéûô]+)\.?,?\s+(\d{4})\b", re.I)
_RE_MOIS_DABORD = re.compile(
    r"\b([a-zéûô]+)\.?\s+(\d{1,2}),?\s+(\d{4})\b", re.I
)
_RE_ISO = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")

# Motif « période lisible » tel qu'on le rencontre après « Deadline : »
_PERIODE = (
    r"(?:\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}\s+[A-Za-zéûô]{3,10}\.?,?\s+\d{4}"
    r"|[A-Za-zéûô]{3,10}\.?\s+\d{1,2},?\s+\d{4})"
)


def _mois_vers_num(mot: str) -> int | None:
    mot = mot.lower().rstrip(".")
    if mot in MOIS:
        return MOIS[mot]
    # préfixe ("oct" → octobre) — le plus long d'abord pour « juin » vs « juillet »
    for nom in sorted(MOIS, key=len, reverse=True):
        if nom.startswith(mot) and len(mot) >= 3:
            return MOIS[nom]
    return None


def _parse_date(texte: str) -> date | None:
    """Parse les dates de clôture rencontrées : '12 OCT 2026', 'October 26, 2026',
    '30 septembre 2026', '2026-10-12' → date, sinon None."""
    t = (texte or "").lower()
    m = _RE_ISO.search(t)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    m = _RE_ENTIER.search(t)
    if m:
        num = _mois_vers_num(m.group(2))
        if num:
            try:
                return date(int(m.group(3)), num, int(m.group(1)))
            except ValueError:
                return None
    m = _RE_MOIS_DABORD.search(t)
    if m:
        num = _mois_vers_num(m.group(1))
        if num:
            try:
                return date(int(m.group(3)), num, int(m.group(2)))
            except ValueError:
                return None
    return None


def _date_limite(texte: str) -> date | None:
    """Date de clôture exploitable : future = telle quelle, passée = None (on
    ignore la bourse close), illisible = today+60 (jamais une date passée)."""
    d = _parse_date(texte)
    if d is None:
        return date.today() + timedelta(days=60)
    if d < date.today():
        return None
    return d


# ---------- Filtre de pertinence + filières ----------
MOTS_GEO = (
    "afrique", "africa", "african", "mauritanie", "mauritania", "mauritanien",
    "global south", "developing countr", "low-income", "sub-saharan",
)
MOTS_NIVEAU = (
    "master", "bachelor", "undergrad", "postgrad", "phd", "doctor",
    "graduate", "fellowship", "scholarship", "scholar", "bourse", "bursary",
    "degree", "licence", "etudes", "études",
)


def _pertinente(texte: str) -> bool:
    """Garde une bourse ouverte aux étudiants africains/mauritaniens, de niveau
    licence/master/doctorat (règle du brief : geo OU niveau)."""
    t = (texte or "").lower()
    return any(m in t for m in MOTS_GEO) or any(m in t for m in MOTS_NIVEAU)


def _nettoie(texte: str) -> str:
    """Déséchappe les entités HTML puis neutralise « & » : le sanitiseur du
    modèle (bleach) ré-échappe « & » en « &amp; », on évite le double passage."""
    t = html.unescape(texte or "")
    t = t.replace("&", " et ")
    return re.sub(r"\s+", " ", t).strip()


def _matche_mot_cle(texte: str, mot: str) -> bool:
    """Mot-clé de filière. Les mots très courts (≤3 car.) exigent une frontière
    de mot : sinon « ia » matche au milieu de n'importe quel titre (bug connu
    du dict partagé, non modifiable ici)."""
    mot = mot.strip()
    if len(mot) <= 3:
        return re.search(rf"(?<!\w){re.escape(mot)}(?!\w)", texte) is not None
    return mot in texte


# Filières partagées + Médecine (absente du dict des entreprises)
FILIERES_BOURSE: dict[Filiere, tuple[str, ...]] = {
    **FILIERE_MOTS_CLES,
    Filiere.MEDECINE: (
        "medicine", "medecine", "medical", "health", "sante", "santé",
        "nursing", "pharma", "biologie", "biology", "public health",
    ),
}


def _filieres(texte: str) -> list[Filiere]:
    """Filières détectées par mots-clés ; sinon TOUTES les filières — le moteur
    de matching exclut les offres à filieres_cibles vides (vérifié dans engine.py)."""
    t = (texte or "").lower()
    trouvees = [
        f for f, mots in FILIERES_BOURSE.items()
        if any(_matche_mot_cle(t, m) for m in mots)
    ]
    return trouvees or list(Filiere)


def _resume(texte: str, max_car: int = 700) -> str:
    texte = re.sub(r"\s+", " ", texte).strip()
    return texte[:max_car]


# ---------- Métadonnées des lignes scholar.africa ----------
# .meta = [organisme?] [pays] [niveau] [couverture] — séparer le financeur du
# pays d'études (sinon « Taiwan » devient l'« entreprise »).
_PAYS = {
    "taiwan", "germany", "australia", "united states", "united kingdom",
    "canada", "france", "japan", "switzerland", "singapore", "south africa",
    "netherlands", "ireland", "italy", "sweden", "norway", "new zealand",
    "china", "hong kong", "saudi arabia", "qatar", "belgium", "spain",
    "south korea", "korea", "malaysia", "india", "finland", "denmark",
    "austria", "poland", "portugal", "greece", "russia", "usa", "uk",
    "holland", "scotland", "europe", "ghana", "nigeria", "kenya", "egypt",
    "morocco", "tunisia", "rwanda", "tanzania", "uganda", "ethiopia",
    "zambia", "zimbabwe", "botswana", "america", "czech", "brazil",
    "mexico", "cote d'ivoire", "senegal", "cameroon",
}
_COUVERTURES_EXACTES = {
    "grant", "other", "fully funded", "full tuition", "partial",
    "partial tuition", "stipend", "travel grant", "scholarship",
}


def _niveau(texte: str) -> bool:
    t = texte.lower()
    return any(m in t for m in ("master", "bachelor", "undergrad", "postgrad",
                                "phd", "doctor", "postdoc", "secondary"))


def _couverture(texte: str) -> bool:
    t = texte.lower().strip()
    if t in _COUVERTURES_EXACTES:
        return True
    return any(m in t for m in ("funded", "tuition", "stipend"))


def _extraire_meta(spans: list[str]) -> tuple[str, str, str]:
    """(organisme, niveau, couverture) depuis les spans .meta d'une ligne."""
    organisme = niveau = couverture = ""
    for s in spans:
        t = s.lower().strip()
        if _niveau(t):
            niveau = niveau or s
        elif _couverture(s):
            couverture = couverture or s
        elif t in _PAYS:
            continue  # pays d'études, pas un financeur
        elif not organisme:
            organisme = s
    return organisme, niveau, couverture


# ---------- Base commune bourses ----------
class BourseScraper(BaseScraper):
    """Contrat commun : toujours TypeOffre.BOURSE, SourceType.AUTRE, Nouakchott,
    contact None (les bourses se candidatent sur le portail financeur)."""

    def _offre(
        self,
        *,
        url: str,
        titre: str,
        organisme: str,
        description: str,
        date_limite: date,
    ) -> OffreStageCreate | None:
        titre = _nettoie(titre)
        organisme = _nettoie(organisme)
        description = _nettoie(description)
        if len(titre) < 5:
            return None
        if not _pertinente(f"{titre} {description}"):
            return None
        return OffreStageCreate(
            source=SourceType.AUTRE,
            source_name=self.source_name,
            source_url=url[:500],
            titre=titre[:300],
            entreprise=(organisme or self.source_name)[:200],
            ville=Ville.NOUAKCHOTT,
            filieres_cibles=_filieres(f"{titre} {description}"),
            type_offre=TypeOffre.BOURSE,
            description=_resume(description),
            date_limite=date_limite,
            contact_email=None,
            contact_whatsapp=None,
        )


# ---------- Source 1 : scholar.africa (HTML) ----------
class ScholarAfricaScraper(BourseScraper):
    """Liste SSR https://scholar.africa/scholarships?page=N
    (lignes `a.row` : titre, organisme, niveau, date de clôture)."""

    source_name = "scholar-africa"
    BASE = "https://scholar.africa"

    def __init__(self, pages: int = 2):
        self.pages = pages

    def fetch(self) -> Iterable[OffreStageCreate]:
        vus: set[str] = set()
        for p in range(1, self.pages + 1):
            url = f"{self.BASE}/scholarships" + (f"?page={p}" if p > 1 else "")
            r = _get(url)
            if r is None:
                continue  # page morte : on passe à la suivante
            soup = BeautifulSoup(r.text, "html.parser")
            lignes = soup.select("a.row[href]")
            print(f"scholar-africa: page {p} → {len(lignes)} lignes")
            for a in lignes:
                href = a.get("href", "")
                if not href.startswith("/scholarships/"):
                    continue
                lien = f"{self.BASE}{href}"
                if lien in vus:
                    continue
                vus.add(lien)

                titre_tag = a.select_one(".title-text")
                if titre_tag is None:
                    continue
                titre = titre_tag.get_text(" ", strip=True)

                spans = [s.get_text(" ", strip=True) for s in a.select(".meta span")]
                spans = [s for s in spans if s and s != "·"]
                organisme, niveau, couverture = _extraire_meta(spans)

                dl_tag = a.select_one(".deadline-col .date")
                texte_dl = dl_tag.get_text(" ", strip=True) if dl_tag else ""

                dl = _date_limite(texte_dl)
                if dl is None:
                    continue  # bourse déjà clôturée

                description = (
                    f"Bourse d'études ouverte aux étudiants africains. "
                    f"Niveau : {niveau or 'non précisé'}. "
                    f"Couverture : {couverture or 'non précisée'}. "
                    f"Organisme : {organisme or 'Scholar Africa'}. "
                    f"Date de clôture : {texte_dl or 'voir le portail'}."
                )
                offre = self._offre(
                    url=lien,
                    titre=titre,
                    organisme=organisme or "Scholar Africa",
                    description=description,
                    date_limite=dl,
                )
                if offre:
                    yield offre


# ---------- Source 2 : opportunityforafrica.org (API REST WordPress) ----------
class OpportunityAfricaScraper(BourseScraper):
    """API REST WP /wp-json/wp/v2/posts des catégories bourses
    (scholarships : undergraduate + masters + phd + study-abroad)."""

    source_name = "opportunity-for-africa"
    API = "https://opportunityforafrica.org/wp-json/wp/v2/posts"
    # Catégories enfants de « Scholarships » (vérifiées via /wp/v2/categories?parent=56)
    CATEGORIES = "115,117,118,120"

    def __init__(self, limite: int = 20):
        self.limite = limite

    def fetch(self) -> Iterable[OffreStageCreate]:
        url = (
            f"{self.API}?categories={self.CATEGORIES}&per_page={self.limite}"
            "&_fields=id,link,title,date,content"
        )
        r = _get(url)
        if r is None:
            return
        try:
            articles = r.json()
        except (json.JSONDecodeError, ValueError) as e:
            print(f"⚠️ opportunity-for-africa: réponse non-JSON → {e}")
            return
        if not isinstance(articles, list):
            print("⚠️ opportunity-for-africa: format inattendu", type(articles).__name__)
            return

        print(f"opportunity-for-africa: {len(articles)} articles")
        for art in articles:
            titre = (art.get("title") or {}).get("rendered", "")
            lien = art.get("link", "")
            contenu = (art.get("content") or {}).get("rendered", "")
            texte = html.unescape(BeautifulSoup(contenu, "html.parser").get_text(" ", strip=True))
            if not lien or not texte:
                continue

            m = re.search(rf"deadline\s*:?\s*{_PERIODE}", texte, re.I)
            bloc_dl = m.group(0) if m else ""
            dl = _date_limite(bloc_dl)
            if dl is None:
                continue  # bourse déjà clôturée

            # Résumé = texte après la date de clôture (la deadline s'arrête là)
            if m:
                apres = texte[m.end():].strip()
                description = (
                    f"Date de clôture : {bloc_dl.split(':', 1)[-1].strip()}. {apres}"
                )
            else:
                description = texte

            offre = self._offre(
                url=lien,
                titre=titre,
                organisme="",  # financeur rarement indiqué → nom du portail
                description=description,
                date_limite=dl,
            )
            if offre:
                yield offre


# ---------- Base commune : portails WordPress (API REST /wp-json/wp/v2/posts) ----------
class WpBourseScraper(BourseScraper):
    """Variante « date de clôture explicite » du portail WordPress.

    Contrairement aux sources 1-2 (repli today+60 si la date est illisible),
    ici la deadline doit être trouvée ET parsée dans l'article : un article
    sans date exploitable (billet de blog, digest multi-bourses) n'est pas une
    bourse et n'est jamais publié — on n'invente donc jamais de date.

    Contrat des sous-classes : API, CATEGORIES (catégories WP en OR, vérifiées
    en réel) + hook facultatif `_exclus()` (articles non-bourses à écarter).
    """

    API: str = ""
    CATEGORIES: str = ""
    NB_ARTICLES: int = 20

    # « Deadline: », « Deadlines: 30 September 2026 (Embassy Track) », « Deadline for
    # <programme> : 20 October 2026 », « Deadline: (14 October 2026 …) » — le texte
    # entre le mot-clé et la date est bridé à 40 car. et aux limites de phrase (: . ;)
    # pour ne jamais sauter sur une date qui n'est pas une clôture.
    _RE_DL = rf"deadlines?\b[^:.;]{{0,40}}:?\s*(?P<date>{_PERIODE})"

    def _normalise(self, texte: str) -> str:
        """Hook : variantes de dates rencontrées avant extraction —
        ordinaux (« 6th July 2026 », « October 2nd, 2026 ») et espace parasite
        avant la virgule (« 20 October , 2026 »), sinon la deadline devient
        illisible et la bourse serait écartée à tort."""
        texte = re.sub(r"(?<=\d)(?:st|nd|rd|th)\b", "", texte)
        return re.sub(r"\s+,", ",", texte)

    def _exclus(self, titre: str, texte: str) -> bool:
        """Hook de garde : True = article à écarter (digest, billet hors bourse)."""
        return False

    def fetch(self) -> Iterable[OffreStageCreate]:
        url = (
            f"{self.API}?categories={self.CATEGORIES}&per_page={self.NB_ARTICLES}"
            "&_fields=id,link,title,content"
        )
        r = _get(url)
        if r is None:
            return
        try:
            articles = r.json()
        except (json.JSONDecodeError, ValueError) as e:
            print(f"⚠️ {self.source_name}: réponse non-JSON → {e}")
            return
        if not isinstance(articles, list):
            print(f"⚠️ {self.source_name}: format inattendu", type(articles).__name__)
            return

        print(f"{self.source_name}: {len(articles)} articles")
        for art in articles:
            titre = (art.get("title") or {}).get("rendered", "")
            lien = art.get("link", "")
            contenu = (art.get("content") or {}).get("rendered", "")
            texte = html.unescape(BeautifulSoup(contenu, "html.parser").get_text(" ", strip=True))
            if not lien or not texte:
                continue
            if self._exclus(titre, texte):
                continue
            texte = self._normalise(texte)

            m = re.search(self._RE_DL, texte, re.I)
            if not m:
                continue  # pas de date lisible → non publié (jamais de date inventée)
            bloc_dl = m.group("date")
            dl = _date_limite(bloc_dl)
            if dl is None:
                continue  # bourse déjà clôturée

            # Résumé = texte après la date de clôture (la deadline s'arrête là)
            description = f"Date de clôture : {bloc_dl}. {texte[m.end() :].strip()}"
            offre = self._offre(
                url=lien,
                titre=titre,
                organisme="",  # financeur rarement indiqué → nom du portail
                description=description,
                date_limite=dl,
            )
            if offre:
                yield offre


# ---------- Source 3 : opportunitiesforafricans.com (API REST WordPress) ----------
class OpportunitiesForAfricansScraper(WpBourseScraper):
    """Focal Afrique — catégorie « Scholarships » (12) ; chaque article commence
    par « Application Deadline: <date> » (EN ou FR, année obligatoire)."""

    source_name = "opportunities-for-africans"
    API = "https://www.opportunitiesforafricans.com/wp-json/wp/v2/posts"
    CATEGORIES = "12"  # Scholarships (vérifiée via /wp/v2/categories)

    def __init__(self, limite: int = 20):
        self.NB_ARTICLES = limite


# ---------- Source 4 : opportunitiescorners.com (API REST WordPress) ----------
class OpportunitiesCornersScraper(WpBourseScraper):
    """Bourses « Bachelor, Master, PhD » + « Scholarships in <pays> ».

    Les deadlines y sont souvent des ordinaux (« Deadline: 6th July 2026 ») :
    normalisées par `WpBourseScraper._normalise()`, sinon la date serait
    illisible et la bourse écartée à tort.
    """

    source_name = "opportunities-corners"
    API = "https://opportunitiescorners.com/wp-json/wp/v2/posts"
    # Bachelor/Master/PhD + Scholarships in Europe/China/Japan/USA/... (OR, vérifié en réel)
    CATEGORIES = "64,933,934,935,936,937,938,939,941,942,960"

    def __init__(self, limite: int = 20):
        self.NB_ARTICLES = limite


# ---------- Source 5 : opportunitydesk.org (API REST WordPress) ----------
class OpportunityDeskScraper(WpBourseScraper):
    """Catégorie « Scholarships » (6) ; article individuel = « Deadline: <date> »
    en tête. Les digest hebdomadaires (« 27 Scholarships Closing in October »)
    cumulent des dizaines de deadlines sur un seul lien : exclus par titre et
    par comptage (≥3 « Deadline: ») pour ne publier qu'une bourse par bourse."""

    source_name = "opportunity-desk"
    API = "https://opportunitydesk.org/wp-json/wp/v2/posts"
    CATEGORIES = "6"  # Scholarships (fellowships-and-scholarships)
    TITRES_DIGEST = re.compile(r"closing|currently open|apply for now|opportunities you can", re.I)

    def __init__(self, limite: int = 20):
        self.NB_ARTICLES = limite

    def _exclus(self, titre: str, texte: str) -> bool:
        if self.TITRES_DIGEST.search(titre or ""):
            return True
        return len(re.findall(r"deadlines?\s*:", texte, re.I)) >= 3
