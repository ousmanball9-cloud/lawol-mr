"""Preuve du scraper MESRS Mauritanie — 100 % mockée, ZÉRO réseau.

Le Ministère mauritanien de l'Enseignement supérieur publie les appels des
gouvernements étrangers (Brésil, Mexique, Maroc, Corée, Chine/UNESCO…). Ce
harnais prouve les règles du scraper `sources/mesrs.py` sur des pages HTML
reconstituées d'après la structure VÉRIFIÉE en réel le 20/10/2026
(`div.card > h3 a` en liste, `<article><header><h1>… « Publié le »` +
`div.announcement-content` en détail) :

  1. extraction titre + pays financeur + date limite (EN/FR, numérique, ISO) ;
  2. émission UNIQUEMENT si la date limite est explicite ET future — sinon
     l'annonce est ignorée avec sa raison (jamais de date inventée) ;
  3. un millésime (« 2026–2027 academic year ») n'est jamais une date limite ;
  4. dédoublonnage par `source_url` (la page liste répète certaines annonces) ;
  5. `pays_etudes` mappé sur l'enum existant, `autre` si absent ;
  6. enregistrement dans `sources/catalogue.py` + classification écriture
     (`type_offre` = bourse, catégorie financeur = gouvernementale).

Modes :
  python -X utf8 scripts/test-mesrs-scraper.py            # mocké (défaut)
  python -X utf8 scripts/test-mesrs-scraper.py --dry-run  # RÉEL, zéro écriture

Code retour : 0 si tous les checks sont verts (et si le site répond en --dry-run).
"""
import copy
import os
import sys
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
if str(RACINE) not in sys.path:
    sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)


# ------------------------- Faux Supabase (zéro réseau) -------------------------
class _Resultat:
    def __init__(self, data):
        self.data = data


class _FauxTable:
    def __init__(self, base, nom):
        self._base, self._nom = base, nom

    def upsert(self, donnees, on_conflict=None):
        self._base.upserts.append((self._nom, copy.deepcopy(donnees), on_conflict))
        return self

    def insert(self, donnees):
        self._base.inserts.append((self._nom, copy.deepcopy(donnees)))
        return self

    def execute(self):
        return _Resultat([{"id": "00000000-0000-0000-0000-000000000000"}])


class _FauxSupabase:
    def __init__(self):
        self.upserts = []
        self.inserts = []

    def table(self, nom):
        return _FauxTable(self, nom)


FAUX = _FauxSupabase()
if "supabase" not in sys.modules:
    import types

    _module_supabase = types.ModuleType("supabase")
    _module_supabase.Client = object
    _module_supabase.create_client = lambda url, key=None, **kwargs: FAUX
    sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Imports --------------------------------------
from apps.api.app.modules.scraper.engine import (
    categorie_bourse_pour_source,
    type_offre_pour_source,
)
from apps.api.app.modules.scraper.sources import mesrs
from apps.api.app.modules.scraper.sources.catalogue import get_scrapers
from apps.api.app.modules.scraper.sources.mesrs import (
    MesrsMauritanieScraper,
    dates_limites,
)
from apps.api.app.modules.shared.models import (
    PaysEtudes,
    SourceType,
    TypeFinancement,
    TypeOffre,
    Ville,
)

AUJOURD_HUI = date(2026, 6, 1)

# ------------------------- Pages HTML de synthèse ------------------------------
PAGES: dict[str, str] = {}


class _Reponse:
    def __init__(self, texte):
        self.text = texte
        self.status_code = 200


APPELS: list[str] = []


def _get_factice(url):
    """Remplace `mesrs._get_mesrs` : aucune socket ouverte, URL inconnue = échec.

    Piège mesuré le 27/10/2026 : ce harnais patchait `mesrs._get`, or le scraper
    n'utilise plus cette fonction — la robustesse HTTP du 27/10 a introduit
    `_get_mesrs` (timeout 30 s, 2 tentatives). Le mock ne servait donc plus à
    rien : le harnais « zéro réseau » ouvrait de vraies sockets, attendait
    2 × 30 s par URL et rendait des résultats faux (0 offre). Un harnais qui
    patche un nom que le code n'appelle plus est un harnais DÉBRANCHÉ : il faut
    vérifier le point d'entrée réel, pas seulement le nom qui « existait avant ».
    """
    APPELS.append(url)
    page = PAGES.get(url)
    return _Reponse(page) if page is not None else None


# Références réelles conservées AVANT le remplacement (mode `--dry-run`).
_GET_MESRS_REEL = mesrs._get_mesrs
_HTTPX_REEL = mesrs.httpx
mesrs._get_mesrs = _get_factice


class _ReseauInterdit:
    """Toute sortie réseau lève immédiatement, avec la cause exacte.

    Sans ce garde-fou, renommer le point d'entrée HTTP de la source ne fait pas
    ÉCHOUER ce harnais : il attend 2 × 30 s puis rend « 0 offre » (défaut mesuré
    le 27/10/2026). Mieux vaut une erreur immédiate et explicite qu'un faux vert
    ou une attente muette.
    """

    def __getattr__(self, nom):
        raise AssertionError(
            f"appel réseau interdit ici (mesrs.httpx.{nom}) : le faux "
            "`_get_mesrs` n'est plus branché sur ce que la source appelle"
        )


def carte(url, titre, badge="For Students"):
    return (
        '<div class="card">'
        f'<span class="badge">{badge}</span>'
        f'<h3 class="card-title"><a href="{url}">{titre}</a></h3>'
        f'<a class="btn btn-primary" href="{url}">Lire</a>'
        "</div>"
    )


def liste(*cartes):
    return '<html><body><div class="cards">' + "".join(cartes) + "</div></body></html>"


def detail(titre, corps, publie="29/06/2026 à 11:40"):
    return (
        "<html><body><main><article>"
        f'<header><h1>{titre}</h1><span>Publié le {publie}</span></header>'
        f'<div class="announcement-content">{corps}</div>'
        '<section><h3>Fichiers joints (2)</h3></section>'
        "</article></main></body></html>"
    )


def installer(pages):
    """Remplace l'ensemble des pages servies par le faux `_get` (zéro réseau)."""
    PAGES.clear()
    PAGES.update(pages)


def scenario(annonces, aujourd_hui=AUJOURD_HUI):
    """annonces = [(url, titre, corps_html)] → (offres, rapport, scraper)."""
    pages = {MesrsMauritanieScraper.LISTE_URL: liste(*[carte(u, t) for u, t, _ in annonces])}
    for url, titre, corps in annonces:
        pages[url] = detail(titre, corps)
    installer(pages)
    scraper = MesrsMauritanieScraper(aujourd_hui=aujourd_hui)
    offres = list(scraper.fetch())
    return offres, scraper.rapport, scraper


# ------------------------------- Micro-harnais --------------------------------
CHECKS = []


def verifier(nom, condition, detail_echec=""):
    CHECKS.append((nom, bool(condition), detail_echec))
    etat = "OK " if condition else "KO "
    print(f"[{etat}] {nom}" + ("" if condition else f"  → {detail_echec}"))


def raisons(rapport):
    return " | ".join(i["raison"] for i in rapport["ignorees"])


def checks_mockes():
    """Joue tous les cas mockés (zéro réseau) et remplit CHECKS."""
    # Réseau INTERDIT pendant tout le mode mocké : si le branchement ci-dessus
    # casse un jour, on obtient une AssertionError immédiate, pas 60 s d'attente.
    mesrs.httpx = _ReseauInterdit()
    # ================================ 1. CAS RÉELS =================================
    # Annonce brésilienne : structure et texte copiés du détail réel /en/announcement/28.
    BRESIL = (
        "Students interested in pursuing master’s or doctoral studies in Brazil are hereby "
        "informed that the Brazilian Embassy announces the opening of applications for the "
        "fifth cycle of the Academic Mobility Program, “GCUB-Mob.” This program offers 889 "
        "full scholarships, including 539 for master’s degrees and 350 for doctoral degrees. "
        "-Application Deadline: Applications will be accepted until July 6, 2026. "
        "Submitting Applications: https://www.gcub.org.br"
    )
    URL_BRESIL = "https://www.mesrs.gov.mr/en/announcement/28"

    offres, rapport, scraper = scenario(
        [(URL_BRESIL, "Scholarships in Brazil for Master's and Doctoral Students", BRESIL)]
    )
    verifier(
        "1. annonce avec deadline EN → 1 offre",
        len(offres) == 1 and rapport["vues"] == 1 and rapport["retenues"] == 1,
        f"offres={len(offres)} rapport={rapport}",
    )
    o = offres[0] if offres else None
    verifier(
        "2. date limite extraite « until July 6, 2026 »",
        o is not None and o.date_limite == date(2026, 7, 6),
        f"date_limite={getattr(o, 'date_limite', None)}",
    )
    verifier(
        "3. constantes de source (AUTRE / bourse / Nouakchott)",
        o is not None
        and o.source is SourceType.AUTRE
        and o.type_offre is TypeOffre.BOURSE
        and o.ville is Ville.NOUAKCHOTT
        and o.source_name == "MESRS Mauritanie",
        f"source={getattr(o, 'source', None)} type={getattr(o, 'type_offre', None)}",
    )
    verifier(
        "4. pays financeur Brésil + pays_etudes=autre (hors enum)",
        o is not None
        and o.entreprise == "Gouvernement du Brésil"
        and o.pays_etudes is PaysEtudes.AUTRE
        and o.metadata.get("pays_financeur") == "Brésil",
        f"entreprise={getattr(o, 'entreprise', None)} pays={getattr(o, 'pays_etudes', None)}",
    )
    verifier(
        "5. traçabilité (deadline_source + date de publication + url)",
        o is not None
        and o.metadata.get("deadline_source") == "July 6, 2026"
        and o.metadata.get("date_publication") == "2026-06-29"
        and o.source_url == URL_BRESIL,
        f"metadata={getattr(o, 'metadata', None)}",
    )
    verifier(
        "6. financement + filières exploitables par le matching",
        o is not None
        and o.type_financement is TypeFinancement.FULLY_FUNDED
        and len(o.filieres_cibles) > 0
        and len(o.description) > 50,
        f"financement={getattr(o, 'type_financement', None)} filieres={len(getattr(o, 'filieres_cibles', []))}",
    )

    # Annonce SANS date limite (le corps réel de /announcement/25 ne dit qu'« academic year »).
    SANS_DEADLINE = (
        "Interested parties are hereby notified that a call for applications is now open for "
        "scholarships to pursue a Master’s degree in Space Science and Technology (STE) in the "
        "Kingdom of Morocco for the 2026–2027 academic year."
    )
    offres, rapport, _ = scenario([("https://www.mesrs.gov.mr/en/announcement/25", "Scholarship in Morocco", SANS_DEADLINE)])
    verifier(
        "7. annonce SANS deadline → ignorée (0 offre)",
        len(offres) == 0 and rapport["retenues"] == 0 and rapport["ignorees"],
        f"offres={len(offres)} rapport={rapport}",
    )
    verifier(
        "8. raison = aucune date limite explicite",
        "aucune date limite explicite" in raisons(rapport),
        raisons(rapport),
    )
    verifier(
        "9. millésime « 2026–2027 academic year » JAMAIS pris pour une deadline",
        dates_limites(SANS_DEADLINE) == [],
        str(dates_limites(SANS_DEADLINE)),
    )

    # Deadline PASSÉE (date de référence postérieure au 6 juillet 2026).
    offres, rapport, _ = scenario(
        [(URL_BRESIL, "Scholarships in Brazil", BRESIL)], aujourd_hui=date(2026, 10, 20)
    )
    verifier(
        "10. deadline passée → ignorée, aucune offre morte",
        len(offres) == 0 and "date limite dépassée" in raisons(rapport),
        f"offres={len(offres)} raisons={raisons(rapport)}",
    )
    verifier(
        "11. la raison cite l'écriture d'origine",
        "July 6, 2026" in raisons(rapport),
        raisons(rapport),
    )

    # Deadline = AUJOURD'HUI → encore valable (inclusive) mais passée demain.
    offres, _, _ = scenario(
        [(URL_BRESIL, "Scholarships in Brazil", BRESIL)], aujourd_hui=date(2026, 7, 6)
    )
    verifier("12. deadline du jour → retenue (date_limite >= aujourd'hui)", len(offres) == 1, f"offres={len(offres)}")

    # Deadline expirée depuis 1 jour.
    offres, _, _ = scenario(
        [(URL_BRESIL, "Scholarships in Brazil", BRESIL)], aujourd_hui=date(2026, 7, 7)
    )
    verifier("13. deadline de la veille → ignorée", len(offres) == 0, f"offres={len(offres)}")

    # ============================ 2. FORMATS DE DATE ==============================
    FR_AVANT_LE = (
        "<p>Le Ministère annonce des bourses d'études en Algérie. Les dossiers doivent être "
        "déposés avant le 15 novembre 2026.</p>"
    )
    offres, _, _ = scenario(
        [("https://www.mesrs.gov.mr/en/announcement/40", "Bourses d'études en Algérie", FR_AVANT_LE)]
    )
    verifier(
        "14. format FR « avant le 15 novembre 2026 »",
        len(offres) == 1 and offres[0].date_limite == date(2026, 11, 15),
        f"offres={len(offres)} date={[getattr(x, 'date_limite', None) for x in offres]}",
    )
    verifier(
        "15. pays Algérie mappé sur l'enum existant",
        offres and offres[0].pays_etudes is PaysEtudes.ALGERIE
        and offres[0].entreprise == "Gouvernement de l'Algérie",
        f"pays={[str(getattr(x, 'pays_etudes', None)) for x in offres]}",
    )

    NUM_JOUR_MOIS = "<p>Bourse de Thaïlande. Date limite de candidature : 06/11/2026.</p>"
    offres, _, _ = scenario(
        [("https://www.mesrs.gov.mr/en/announcement/41", "Scholarship in Thailand", NUM_JOUR_MOIS)]
    )
    verifier(
        "16. format numérique JJ/MM « 06/11/2026 »",
        len(offres) == 1 and offres[0].date_limite == date(2026, 11, 6),
        f"date={[getattr(x, 'date_limite', None) for x in offres]}",
    )
    verifier(
        "17. pays Thaïlande (hors enum → autre)",
        offres and offres[0].pays_etudes is PaysEtudes.AUTRE
        and offres[0].metadata.get("pays_financeur") == "Thaïlande",
        f"metadata={[getattr(x, 'metadata', None) for x in offres]}",
    )

    NUM_JOUR_31 = "<p>Bourse du Mexique. Date limite : 25/12/2026.</p>"
    offres, _, _ = scenario(
        [("https://www.mesrs.gov.mr/en/announcement/42", "Scholarship in Mexico", NUM_JOUR_31)]
    )
    verifier(
        "18. format numérique avec jour > 12 « 25/12/2026 »",
        len(offres) == 1 and offres[0].date_limite == date(2026, 12, 25),
        f"date={[getattr(x, 'date_limite', None) for x in offres]}",
    )

    NUM_US = "<p>Scholarship in Korea. Application deadline: 11/30/2026.</p>"
    offres, _, _ = scenario(
        [("https://www.mesrs.gov.mr/en/announcement/43", "Korea Global Scholarship Announcement", NUM_US)]
    )
    verifier(
        "19. format numérique américain sans ambiguïté « 11/30/2026 »",
        len(offres) == 1 and offres[0].date_limite == date(2026, 11, 30),
        f"date={[getattr(x, 'date_limite', None) for x in offres]}",
    )

    ISO = "<p>Scholarship in China (UNESCO). Deadline: 2026-11-30.</p>"
    offres, _, _ = scenario(
        [("https://www.mesrs.gov.mr/en/announcement/44", "Bourses d'études UNESCO / Chine", ISO)]
    )
    verifier(
        "20. format ISO « 2026-11-30 »",
        len(offres) == 1 and offres[0].date_limite == date(2026, 11, 30),
        f"date={[getattr(x, 'date_limite', None) for x in offres]}",
    )

    verifier(
        "21. ordinal anglais « before 6th July 2026 »",
        dates_limites("Applications before 6th July 2026.") == [(date(2026, 7, 6), "6th July 2026")],
        str(dates_limites("Applications before 6th July 2026.")),
    )

    INVALIDE = "<p>Bourse de Turquie. Date limite : 31/02/2026.</p>"
    offres, rapport, _ = scenario(
        [("https://www.mesrs.gov.mr/en/announcement/45", "Scholarship in Turkey", INVALIDE)]
    )
    verifier(
        "22. date impossible « 31/02/2026 » → ignorée (aucune date inventée)",
        len(offres) == 0 and "aucune date limite explicite" in raisons(rapport),
        f"offres={len(offres)} raisons={raisons(rapport)}",
    )

    NON_ANCREE = "<p>La cérémonie se tiendra le 15 novembre 2026. Une bourse sera annoncée.</p>"
    verifier(
        "23. date NON ancrée par un mot-clé de clôture → aucune deadline",
        dates_limites(NON_ANCREE) == [],
        str(dates_limites(NON_ANCREE)),
    )

    # ===================== 3. FILTRES, DOUBLONS, INSCRIPTION ======================
    offres, rapport, _ = scenario(
        [
            (URL_BRESIL, "Scholarships in Brazil", BRESIL),
            (URL_BRESIL, "Scholarships in Brazil", BRESIL),  # répétition d'affichage
        ]
    )
    verifier(
        "24. dédoublonnage par source_url (2 cartes → 1 annonce, 1 offre)",
        rapport["vues"] == 1 and rapport["doublons"] == 1 and len(offres) == 1,
        f"rapport={rapport} offres={len(offres)}",
    )

    CONFERENCE = (
        "<p>International Conference on Higher Education. Registration deadline: "
        "15 November 2026. Programme and venue in Nouakchott.</p>"
    )
    offres, rapport, _ = scenario(
        [("https://www.mesrs.gov.mr/en/announcement/30", "International Conference", CONFERENCE)]
    )
    verifier(
        "25. annonce non-bourse (conférence) → ignorée malgré une date future",
        len(offres) == 0 and "hors périmètre bourse" in raisons(rapport),
        f"offres={len(offres)} raisons={raisons(rapport)}",
    )

    offres, rapport, _ = scenario([])
    verifier(
        "26. liste vide → 0 offre, 0 erreur",
        len(offres) == 0 and rapport == {"vues": 0, "retenues": 0, "doublons": 0, "ignorees": []},
        f"rapport={rapport}",
    )

    installer(
        {
            MesrsMauritanieScraper.LISTE_URL: liste(
                carte("https://www.mesrs.gov.mr/en/announcement/999", "Scholarship in Morocco")
            )
        }
    )
    scraper = MesrsMauritanieScraper(aujourd_hui=AUJOURD_HUI)
    offres = list(scraper.fetch())
    verifier(
        "27. détail inaccessible (404) → ignorée, le reste continue",
        len(offres) == 0 and "détail inaccessible" in raisons(scraper.rapport),
        f"rapport={scraper.rapport}",
    )

    offres, _, _ = scenario(
        [
            (URL_BRESIL, "Scholarships in Brazil", BRESIL),
            ("https://www.mesrs.gov.mr/en/announcement/42", "Scholarship in Mexico", NUM_JOUR_31),
        ]
    )
    verifier(
        "28. deux annonces valides → deux offres distinctes",
        len(offres) == 2 and {x.source_url for x in offres} == {URL_BRESIL, "https://www.mesrs.gov.mr/en/announcement/42"},
        f"offres={[(x.source_url, x.date_limite) for x in offres]}",
    )

    verifier(
        "29. scraper enregistré dans le catalogue des sources",
        any(isinstance(s, MesrsMauritanieScraper) for s in get_scrapers()),
        "absent de get_scrapers()",
    )
    verifier(
        "30. écriture : type_offre=bourse, catégorie financeur=gouvernementale",
        type_offre_pour_source("MESRS Mauritanie") == "bourse"
        and categorie_bourse_pour_source("MESRS Mauritanie", "Gouvernement du Brésil") == "gouvernementale",
        f"{type_offre_pour_source('MESRS Mauritanie')} / "
        f"{categorie_bourse_pour_source('MESRS Mauritanie', 'Gouvernement du Brésil')}",
    )
    verifier(
        "31. aucun appel réseau : le faux `_get_mesrs` a servi réellement les pages",
        # Preuve de BRANCHEMENT (et non de simple existence) : le nom que le
        # scraper appelle est bien notre faux, et il a été appelé pour des URL
        # connues de la fixture. C'est ce qui manquait le 27/10 : le mock
        # existait mais ne recevait aucun appel (le vrai réseau partait).
        mesrs._get_mesrs is _get_factice
        and len(APPELS) > 5
        and all(u.startswith("https://www.mesrs.gov.mr/") for u in APPELS),
        f"{len(APPELS)} appel(s) : {sorted(set(APPELS))}",
    )

    # Garde-fou de volume : la limite de traitement reste traçable.
    scenario(
        [
            (URL_BRESIL, "Scholarships in Brazil", BRESIL),
            ("https://www.mesrs.gov.mr/en/announcement/42", "Scholarship in Mexico", NUM_JOUR_31),
        ]
    )
    limite = MesrsMauritanieScraper(max_annonces=1, aujourd_hui=AUJOURD_HUI)
    offres = list(limite.fetch())
    verifier(
        "32. max_annonces respecté et reste des annonces compté (vues = retenues + ignorées)",
        len(offres) == 1
        and limite.rapport["vues"] == 2
        and limite.rapport["retenues"] == 1
        and "au-delà de max_annonces" in raisons(limite.rapport),
        f"offres={len(offres)} rapport={limite.rapport}",
    )


# ============================== MODE --DRY-RUN ================================
def _argument(nom, defaut=None):
    """`--nom=valeur` → valeur (parse minimal, sans dépendance)."""
    prefixe = nom + "="
    for a in sys.argv[1:]:
        if a.startswith(prefixe):
            return a[len(prefixe):]
    return defaut


def dry_run():
    """Lecture RÉELLE du site, ZÉRO écriture (jamais `save()` ni `log()`).

    `--reference=AAAA-MM-JJ` injecte la date de référence (preuve datée d'un
    cycle passé/futur) ; par défaut : aujourd'hui.
    """
    from apps.api.app.modules.scraper.sources.bourses import _get as _get_reel

    # Le mode mocké a remplacé le point d'entrée HTTP et interdit le réseau :
    # on restaure l'état réel avant de sortir sur le site.
    mesrs.httpx = _HTTPX_REEL
    mesrs._get_mesrs = _GET_MESRS_REEL
    mesrs._get = _get_reel  # compat. anciens appelants
    brut = _argument("--reference")
    reference = date.fromisoformat(brut) if brut else None
    print("=== MESRS Mauritanie · run réel (dry-run, zéro écriture) ===")
    scraper = MesrsMauritanieScraper(aujourd_hui=reference)
    offres = list(scraper.fetch())
    rapport = scraper.rapport
    print(f"source                : {MesrsMauritanieScraper.LISTE_URL}")
    print(f"date de référence     : {scraper.aujourd_hui}")
    print(f"annonces vues         : {rapport['vues']} "
          f"(doublons d'affichage écartés : {rapport['doublons']})")
    print(f"annonces retenues     : {len(offres)}")
    print(f"annonces ignorées     : {len(rapport['ignorees'])}")
    print("écritures en base     : 0 (dry-run)")

    if offres:
        print("\n-- retenues --")
        for o in offres:
            print(f"  · {o.date_limite} | {o.metadata.get('pays_financeur')} | {o.titre[:90]}")
            print(f"    {o.source_url} | {o.entreprise} | filières={len(o.filieres_cibles)}")
    if rapport["ignorees"]:
        print("\n-- ignorées (raison | id | titre) --")
        for i in rapport["ignorees"]:
            print(f"  · {i['raison']} | {i['url'].rsplit('/', 1)[-1]} | {i['titre'][:80]}")
    return 0 if rapport["vues"] else 1


if __name__ == "__main__":
    if any(a in ("--dry-run", "--live", "--reel") for a in sys.argv[1:]):
        sys.exit(dry_run())
    checks_mockes()
    total = len(CHECKS)
    echecs = [n for n, ok, _ in CHECKS if not ok]
    print(f"\n{total - len(echecs)}/{total} checks verts")
    if echecs:
        print("ÉCHECS : " + " ; ".join(echecs))
        sys.exit(1)
    sys.exit(0)
