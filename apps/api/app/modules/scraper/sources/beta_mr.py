"""Scraper spécifique beta.mr — portail d'emploi mauritanien.

Structure :
  - Accueil + /beta/recrutement + /beta/liste_offres/{n} : listes d'offres
  - /beta/offre/{slug}/{id} : page détail avec entreprise, titre, date, lieu
"""
import re
from datetime import date
from typing import Iterable

import certifi
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
from apps.api.app.modules.scraper.sources.entreprises import (
    _detect_filieres,
    _detect_ville,
)

MOIS_FR = {
    'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
    'juillet': 7, 'août': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12,
}

ENTETES = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) LawolMrBot/0.1 (+https://lawol.mr)',
    'Accept-Language': 'fr,fr-FR;q=0.9,ar;q=0.6',
}


def _parse_date_fr(texte: str) -> date | None:
    """Parse '20 octobre 2026' ou '20 oct. 2026' → date."""
    m = re.search(r'(\d{1,2})\s+([a-zéûô]+)\.?\s+(\d{4})', texte.lower())
    if not m:
        return None
    jour, mois, annee = int(m.group(1)), m.group(2), int(m.group(3))

    # Normalisation : minuscules + suppression du point final ("oct." → "oct")
    mois_norm = mois.lower().rstrip('.').strip()

    # 1. Équivalence exacte ("octobre" → 10)
    if mois_norm in MOIS_FR:
        num = MOIS_FR[mois_norm]
    else:
        # 2. Préfixe complet ou 3 premières lettres
        #    ("sept" → "septembre", "oct" → "octobre", "juil" → "juillet")
        #    tri du nom le plus long au plus court pour éviter "juin" vs "juillet"
        candidats = sorted(MOIS_FR.items(), key=lambda kv: -len(kv[0]))
        num = next(
            (
                n
                for nom, n in candidats
                if nom.startswith(mois_norm) or mois_norm[:3] == nom[:3]
            ),
            None,
        )
    if num is None:
        return None
    try:
        return date(annee, num, jour)
    except ValueError:
        return None


# --- Nettoyage des descriptions : le site entier ne doit PAS finir dans l'offre ---
_JUNK_EXACT = {
    'accueil', 'outils', 'contact', 'services rh', 'tests psycho', 'base cv',
    'se connecter (presto)', 'pré-inscription', 'témoignez', 'beta 2',
    'recrutement', 'conseils rh', 'assistance emploi', 'options', 'liens utiles',
}
_JUNK_CONTIENT = re.compile(
    r'(Suivez-nous|العربية|Partager cette offre|Voir la liste complète|'
    r'Voir toutes les annonces|Contactez nous|Premier portail de recrutement|'
    r'أول بوابة|بريستو|برستو)',
    re.IGNORECASE,
)
_FINS_DESC = re.compile(
    r'(Partager cette offre|Voir la liste complète|Voir toutes les annonces|Contactez nous)',
    re.IGNORECASE,
)


def _ligne_junk(ligne: str) -> bool:
    """Ligne de menu/pied de page (jamais une vraie phrase d'offre)."""
    bas = ligne.lower().strip(' .:')
    return bas in _JUNK_EXACT or bool(_JUNK_CONTIENT.search(ligne))


# Marques en tête à retirer d'un titre : "(Presto)", mots de marque latins…
# (les mots arabes ne sont retirés que s'ils précèdent un « - » bilingue :
#  « توظيف … - Responsable Marketing » → la partie française, le titre seul
#  en arabe est conservé tel quel)
_BRUIT_TITRE = re.compile(
    r'^\s*(?:\([^)]{1,40}\)|Presto|beta\.mr|Beta|Nouveau|Offre)\s*',
    re.IGNORECASE,
)
_TITRE_AR_ENTETE = re.compile(r'^(?:[\u0600-\u06FF]+\s*){1,5}[-–—]\s*')
# Connecteurs en minuscules = morceau du nom d'entreprise, pas du titre
_CONNECTEURS = {'et', 'des', 'de', 'du', 'd', 'la', 'le', 'les', 'en', 'a', 'au'}


def _nettoyer_titre(titre: str) -> str:
    """Retire les tags de marque en tête (itératif) puis l'entête arabe
    d'un titre bilingue « … - … ». Jamais de titre entièrement arabe perdu."""
    t = titre.strip()
    precedent = None
    while t and t != precedent:
        precedent = t
        t = _BRUIT_TITRE.sub('', t).strip()
    m = _TITRE_AR_ENTETE.match(t)
    if m:
        t = t[m.end():].strip()
    return t or titre.strip()


def _completer_entreprise(entreprise: str, titre: str) -> tuple[str, str]:
    """Les connecteurs minuscules en tête du titre appartiennent à l'entreprise,
    suivis éventuellement du mot capitalisé qui les termine.

    « Société des Travaux Publics » + « et des Infrastructures Des chauffeurs… »
    → (« Société des Travaux Publics et des Infrastructures », « Des chauffeurs… »).
    """
    mots = titre.split(' ')
    connectes = 0
    while entreprise and mots and mots[0].lower().strip('.,') in _CONNECTEURS and len(entreprise.split()) < 8:
        entreprise = f"{entreprise} {mots.pop(0)}".strip()
        connectes += 1
    if connectes and mots and mots[0][:1].isupper() and len(entreprise.split()) < 8:
        entreprise = f"{entreprise} {mots.pop(0)}".strip()
    return entreprise, ' '.join(mots)


def _nettoyer_texte_desc(texte: str) -> str:
    """Description nette depuis le texte du bloc d'offre.

    Commence à « Date limite » (tout ce qui précède = menus/entête),
    s'arrête au marqueur de pied de page, filtre les lignes de navigation,
    garde la structure \n (la modale en fait des blocs organisés), 600 car. max.
    """
    idx = texte.find('Date limite')
    if idx >= 0:
        texte = texte[idx:]
    fin = _FINS_DESC.search(texte)
    if fin:
        texte = texte[: fin.start()]
    lignes = [l.strip() for l in texte.split('\n') if l.strip() and not _ligne_junk(l)]
    return '\n'.join(lignes)[:600]


class BetaMrScraper(BaseScraper):
    """Scrape beta.mr : page d'accueil + recrutement + listes paginées."""

    source_name = 'beta_mr'

    def __init__(self, timeout: int = 20, max_pages: int = 5):
        self.timeout = timeout
        self.max_pages = max_pages

    @property
    def _type_source(self) -> SourceType:
        return SourceType.ENTREPRISE

    def _fetch(self, url: str) -> str | None:
        try:
            r = httpx.get(url, headers=ENTETES, timeout=self.timeout, follow_redirects=True, verify=certifi.where())
            r.raise_for_status()
            return r.text
        except Exception as e:  # noqa: BLE001
            print(f'⚠️ beta_mr: fetch impossible {url} → {e}')
            return None

    def _extraire_liens_offres(self, html: str) -> set[str]:
        soup = BeautifulSoup(html, 'html.parser')
        liens = set()
        for a in soup.find_all('a', href=True):
            href = a['href']
            if re.match(r'^/beta/offre/[^/]+/\d+$', href) or re.match(r'^https://beta\.mr/beta/offre/[^/]+/\d+$', href):
                liens.add(href if href.startswith('http') else f'https://beta.mr{href}')
        return liens

    def _parse_offre(self, url: str, html: str) -> OffreStageCreate | None:
        soup = BeautifulSoup(html, 'html.parser')

        # Bloc principal : div.row contenant entreprise + titre + date + lieu
        bloc = None
        bloc_div = None
        for div in soup.find_all('div', class_='row'):
            txt = div.get_text(' ', strip=True)
            if 'Date limite' in txt and 'Lieu' in txt:
                bloc = txt
                bloc_div = div
                break
        if not bloc:
            return None

        # Entreprise = texte avant le titre (le titre suit l'entreprise directement)
        # Pattern : "{entreprise} {titre} Date limite : ..."
        m = re.match(r'^(.*?)\s+Date limite\s*:', bloc)
        if not m:
            return None
        avant = m.group(1).strip()

        # L'entreprise est le premier "mot" ou groupe de mots avant le titre
        # Heuristic : l'entreprise est souvent en majuscules ou un nom connu
        # On prend tout ce qui précède le dernier mot du titre... plus simple :
        # le titre commence après l'entreprise. On split sur les majuscules ou parenthèses.
        # Approche robuste : l'entreprise = premier segment, titre = reste.
        # En pratique sur beta.mr : "Caritas Mauritanie Un(e) assistent(e) technique"
        # → entreprise = "Caritas Mauritanie", titre = "Un(e) assistent(e) technique"
        # Heuristic : l'entreprise ne contient pas de parenthèses et est court (< 4 mots)
        mots = avant.split()
        entreprise = ''
        titre = avant
        for i in range(1, min(5, len(mots))):
            candidat = ' '.join(mots[:i])
            reste = ' '.join(mots[i:])
            if '(' not in candidat and len(candidat.split()) <= 4:
                entreprise = candidat
                titre = reste
        if not entreprise:
            entreprise = 'beta.mr'
            titre = avant

        # Tag de marque en tête ("(Presto)") = nom de l'entreprise + titre assaini
        m_tag = re.match(r'^\s*\(([^)]{2,40})\)', avant)
        if m_tag and entreprise == 'beta.mr':
            entreprise = m_tag.group(1).strip()
        titre = _nettoyer_titre(titre)
        entreprise, titre = _completer_entreprise(entreprise, titre)

        # Date limite
        date_limite = _parse_date_fr(bloc) or (date.today() + __import__('datetime').timedelta(days=30))

        # Lieu
        m_lieu = re.search(r'Lieu\s*:\s*([^.]+?)(?:\s*\.|$)', bloc)
        lieu = m_lieu.group(1).strip() if m_lieu else 'Nouakchott'
        ville = _detect_ville(lieu + ' ' + bloc)

        # Type d'offre
        t = titre.lower()
        if 'stagiaire' in t or 'stage' in t or 'pfe' in t:
            type_offre = TypeOffre.STAGE_PFE
        elif 'alternance' in t:
            type_offre = TypeOffre.ALTERNANCE
        else:
            type_offre = TypeOffre.EMPLOI_JUNIOR

        # Description = uniquement le bloc de l'offre, nettoyé (pas de menus)
        desc = _nettoyer_texte_desc(bloc_div.get_text('\n', strip=True))

        return OffreStageCreate(
            source=self._type_source,
            source_name=self.source_name,
            source_url=url[:500],
            titre=titre[:300],
            entreprise=entreprise[:200],
            ville=ville,
            filieres_cibles=_detect_filieres(titre + ' ' + desc),
            type_offre=type_offre,
            description=desc,
            date_limite=date_limite,
        )

    def fetch(self) -> Iterable[OffreStageCreate]:
        # 1. Collecter les URLs d'offres depuis les listes
        urls_a_scraper = set()
        pages_liste = ['https://beta.mr/', 'https://beta.mr/beta/recrutement']
        for i in range(1, self.max_pages + 1):
            pages_liste.append(f'https://beta.mr/beta/liste_offres/{i}')

        for page_url in pages_liste:
            html = self._fetch(page_url)
            if html:
                urls_a_scraper |= self._extraire_liens_offres(html)

        print(f'beta_mr: {len(urls_a_scraper)} offres trouvées dans les listes')

        # 2. Fetcher chaque page d'offre (dédoublonnage : la même offre peut
        #    apparaître sur plusieurs listes avec des URLs différentes)
        vus: set[tuple[str, str]] = set()
        for url in sorted(urls_a_scraper):
            html = self._fetch(url)
            if not html:
                continue
            offre = self._parse_offre(url, html)
            if not offre:
                continue
            cle = (offre.titre.lower().strip(), offre.date_limite.isoformat())
            if cle in vus:
                continue
            vus.add(cle)
            yield offre
