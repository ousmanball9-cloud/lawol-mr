#!/usr/bin/env python3
"""Harnais de test pour la détection de pays et la robustesse des sources.

ZÉRO RÉSEAU — tout est mocké localement.

Tests couverts :
1. Mapping pays : cas positifs, négatifs, ambigus -> None
2. Non-écrasement d'un pays déjà renseigné
3. --dry-run n'écrit rien (testé via backfill-pays.py --dry-run)
4. Vérification que les URLs corrigées sont bien dans le catalogue
"""
import argparse
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

# Ajouter le répertoire racine au path pour imports
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.api.app.modules.scraper.pays import pays_depuis_texte
from apps.api.app.modules.scraper.sources.base import BaseScraper
from apps.api.app.modules.scraper.sources.catalogue import CATALOGUE
from apps.api.app.modules.shared.models import (
    OffreStageCreate,
    PaysEtudes,
    SourceType,
    TypeOffre,
    Ville,
)


# ------------------------------- Faux Supabase --------------------------------
class _Res:
    def __init__(self, data):
        self.data = data


class _Table:
    def __init__(self, base, nom):
        self.base, self.nom = base, nom
        self.filtres: list[tuple] = []
        self.mode = "select"
        self.donnees = None
        self.conflit = None
        self.bornes = None

    def select(self, *_a, **_k):
        self.mode = "select"
        return self

    def range(self, debut, fin):
        # Le faux doit PAGINER comme Supabase : sans ça `backfill-pays.py`
        # (boucle `while True` sur les pages) tourne indéfiniment sur la
        # première page — mesuré le 27/10/2026, harnais bloqué > 5 minutes.
        self.bornes = (debut, fin)
        return self

    def eq(self, colonne, valeur):
        self.filtres.append((colonne, valeur))
        return self

    def upsert(self, donnees, on_conflict=None):
        self.mode, self.donnees, self.conflit = "upsert", donnees, on_conflict
        return self

    def update(self, donnees):
        self.mode, self.donnees = "update", donnees
        return self

    def insert(self, donnees):
        self.mode, self.donnees = "insert", donnees
        return self

    def in_(self, colonne, valeurs):
        self.filtres.append((colonne, list(valeurs)))
        return self

    def execute(self):
        if self.mode == "upsert":
            self.base.upserts.append((self.nom, self.donnees, self.conflit))
            return _Res([{"id": "faux"}])
        if self.mode == "update":
            self.base.updates.append((self.nom, dict(self.donnees), list(self.filtres)))
            return _Res([{"id": "faux"}])
        if self.mode == "insert":
            self.base.inserts.append((self.nom, self.donnees))
            return _Res([])
        lignes = self.base.rows.get(self.nom, [])
        if self.bornes is not None:
            debut, fin = self.bornes
            lignes = lignes[debut : fin + 1]
        return _Res([dict(ligne) for ligne in lignes])


class FauxSupabase:
    """Supabase en mémoire : enregistre TOUT ce qui serait écrit."""

    def __init__(self, rows=None):
        self.rows = rows or {}
        self.upserts: list[tuple] = []
        self.updates: list[tuple] = []
        self.inserts: list[tuple] = []

    def table(self, nom):
        return _Table(self, nom)

# --- Tests pays_depuis_texte ---

def test_pays_positifs():
    """Cas positifs : détection non ambiguë."""
    cas = [
        # France
        ("Bourse Eiffel France 2026", "Etudiez en France a Paris", "", PaysEtudes.FRANCE),
        ("Master a Lyon", "Universite de Lyon", "", PaysEtudes.FRANCE),
        ("Sorbonne Universite", "Campus Paris", "", PaysEtudes.FRANCE),
        # Canada
        ("Bourse Vanier Canada", "Etudes a Toronto", "", PaysEtudes.CANADA),
        ("Universite de Montreal", "Quebec", "", PaysEtudes.CANADA),
        # USA
        ("Fulbright USA", "Study in United States", "", PaysEtudes.USA),
        ("Harvard Scholarship", "Boston Massachusetts", "", PaysEtudes.USA),
        # Allemagne
        ("DAAD Allemagne", "Etudiez a Berlin", "", PaysEtudes.ALLEMAGNE),
        ("DAAD Scholarship Germany", "Munich", "", PaysEtudes.ALLEMAGNE),
        # Royaume-Uni
        ("Chevening UK", "Study in London", "", PaysEtudes.ROYAUME_UNI),
        ("Oxford Scholarship", "United Kingdom", "", PaysEtudes.ROYAUME_UNI),
        # Espagne
        ("Bourse Espagne", "Madrid Barcelona", "", PaysEtudes.ESPAGNE),
        # Italie
        ("Bourse Italie", "Rome Milan", "", PaysEtudes.ITALIE),
        # Belgique
        ("Bourse Belgique", "Bruxelles", "", PaysEtudes.BELGIQUE),
        # Suisse
        ("Swiss Government Scholarship", "Zurich Geneva", "", PaysEtudes.SUISSE),
        # Pays-Bas
        ("Holland Scholarship", "Amsterdam Rotterdam", "", PaysEtudes.PAYS_BAS),
        # Maroc
        ("Bourse Maroc", "Rabat Casablanca", "", PaysEtudes.MAROC),
        # Tunisie
        ("Bourse Tunisie", "Tunis Sfax", "", PaysEtudes.TUNISIE),
        # Algerie
        ("Bourse Algerie", "Alger Oran", "", PaysEtudes.ALGERIE),
        # Senegal
        ("Bourse Senegal", "Dakar Thies", "", PaysEtudes.SENEGAL),
        # Cote d'Ivoire
        ("Bourse Cote d'Ivoire", "Abidjan", "", PaysEtudes.COTE_IVOIRE),
        # URL comme indice (france dans le path)
        ("Bourse generique", "Etudiez a l'etranger", "https://www.example.com/france/bourse", PaysEtudes.FRANCE),
    ]

    print("[TEST] Tests cas positifs...")
    for titre, desc, url, attendu in cas:
        resultat = pays_depuis_texte(titre, desc, url)
        assert resultat == attendu, f"ECHEC: {titre} | {desc} | {url} -> {resultat} (attendu: {attendu})"
    print(f"  OK {len(cas)} cas positifs OK")


def test_pays_negatifs():
    """Cas négatifs : aucun indice -> None."""
    cas = [
        ("Bourse générique", "Étudiez à l'étranger", ""),
        ("Scholarship for African Students", "Open to all", ""),
        ("Master Program", "Apply now", ""),
        ("", "", ""),
        ("Stage PFE", "Entreprise locale", "https://www.mauritel.mr/carrieres"),
        ("Emploi Junior", "Nouakchott", ""),
    ]

    print("[TEST] Tests cas négatifs (None attendu)...")
    for titre, desc, url in cas:
        resultat = pays_depuis_texte(titre, desc, url)
        assert resultat is None, f"ÉCHEC: {titre} | {desc} | {url} -> {resultat} (attendu: None)"
    print(f"  OK {len(cas)} cas négatifs OK")


def test_pays_ambigus():
    """Cas ambigus : plusieurs pays détectés -> None (jamais deviné)."""
    # "France" et "Canada" dans le même texte -> ambigu
    cas = [
        ("Bourse France Canada", "Étudiez en France ou au Canada", ""),
        ("Programme USA Germany", "Berlin et New York", ""),
        ("Scholarship UK France", "London Paris", ""),
    ]

    print("[TEST] Tests cas ambigus (None attendu)...")
    for titre, desc, url in cas:
        resultat = pays_depuis_texte(titre, desc, url)
        assert resultat is None, f"ÉCHEC: {titre} | {desc} | {url} -> {resultat} (attendu: None)"
    print(f"  OK {len(cas)} cas ambigus OK")


def test_pays_non_ecrasement():
    """PROUVÉ, plus déclaré : `BaseScraper.save` ne remplace jamais un pays déjà là.

    Cette preuve était un `assert True` commenté « la logique est dans base.py » :
    elle ne vérifiait donc rien et une régression serait passée inaperçue. Elle
    appelle maintenant `save` pour de vrai, sur un faux Supabase.
    """
    print("[TEST] Non-écrasement d'un pays déjà renseigné (vrai appel à save)...")
    from apps.api.app.modules.scraper.sources import base as module_base

    def offre(titre, pays=None):
        return OffreStageCreate(
            source=SourceType.UNIVERSITE,
            source_name="scholar-africa",
            source_url=f"https://exemple.mr/{abs(hash(titre))}",
            titre=titre,
            entreprise="Exemple",
            ville=Ville.NOUAKCHOTT,
            type_offre=TypeOffre.BOURSE,
            description="Programme complet",
            date_limite=datetime.now(UTC).date() + timedelta(days=30),
            pays_etudes=pays,
        )

    class _Scraper(BaseScraper):
        source_name = "scholar-africa"

        def fetch(self):
            return []

    faux = FauxSupabase()
    ancien = module_base.supabase
    module_base.supabase = faux
    try:
        _Scraper().save(
            [offre("University of Tokyo MEXT Scholarship in Japan", PaysEtudes.FRANCE)]
        )
        garde = faux.upserts[-1][1]["pays_etudes"]
        assert garde == "france", f"pays écrasé : {garde} (on ne réécrit JAMAIS)"

        _Scraper().save([offre("University of Tokyo MEXT Scholarship in Japan", None)])
        deduit = faux.upserts[-1][1]["pays_etudes"]
        assert deduit == "japon", f"pays vide non déduit : {deduit} (attendu japon)"
    finally:
        module_base.supabase = ancien
    print("  OK pays existant conservé, pays vide déduit du titre")


def test_pays_nouveaux():
    """Destinations ajoutées le 27/10/2026 : elles doivent être reconnues.

    Mesure qui a motivé l'ajout : 38 offres actives nommaient un de ces pays
    alors que l'enum ne les contenait pas — elles tombaient dans `autre` et
    devenaient introuvables par le filtre « Pays d'études ».
    """
    cas = [
        ("University of Tokyo MEXT Scholarship 2027 in Japan", "", PaysEtudes.JAPON),
        ("China Scholarship Council 2027", "CSC", PaysEtudes.CHINE),
        ("KGSP 2027", "Study in South Korea", PaysEtudes.COREE_SUD),
        ("ICCR Scholarship 2027", "Government of India", PaysEtudes.INDE),
        ("University of Cape Town Scholars Program", "", PaysEtudes.AFRIQUE_DU_SUD),
        ("University of Melbourne Graduate Research Scholarships", "", PaysEtudes.AUSTRALIE),
        ("University of Auckland Doctoral Scholarship", "", PaysEtudes.NOUVELLE_ZELANDE),
        ("Open Doors Scholarship 2027 in Russia", "", PaysEtudes.RUSSIE),
        ("Hamad Bin Khalifa University Scholarship", "", PaysEtudes.QATAR),
        ("KAUST Graduate Fellowship", "Saudi Arabia", PaysEtudes.ARABIE_SAOUDITE),
        ("Al Azhar Scholarship", "Egypt", PaysEtudes.EGYPTE),
        ("Bourse au Bresil", "Sao Paulo", PaysEtudes.BRESIL),
        ("UNAM Scholarship", "Mexico", PaysEtudes.MEXIQUE),
    ]
    print("[TEST] Destinations ajoutées (Japon, Chine, Corée...) ...")
    for titre, desc, attendu in cas:
        resultat = pays_depuis_texte(titre, desc, "")
        assert resultat == attendu, f"ECHEC: {titre} -> {resultat} (attendu {attendu})"
    print(f"  OK {len(cas)} destinations reconnues")


def test_pays_financeur():
    """Un FINANCEUR n'est pas un pays d'études (erreur mesurée en base).

    « DAAD » finançait des bourses situées au Sénégal et en Afrique du Sud :
    classer par financeur rangeait des bourses africaines en Allemagne.
    Règle : le financeur seul ne produit AUCUN pays ; s'il est accompagné du
    pays d'études, c'est le pays d'études qui gagne.
    """
    cas = [
        ("DAAD Scholarship", "Programme de financement", None),
        (
            "UKUDLA Master's Scholarships 2027 in South Africa: DAAD-Funded",
            "",
            PaysEtudes.AFRIQUE_DU_SUD,
        ),
        ("DAAD EPOS Germany", "", PaysEtudes.ALLEMAGNE),
        ("Fully Funded Scholarship", "all expenses covered", None),
    ]
    print("[TEST] Piège du financeur (DAAD n'est pas l'Allemagne) ...")
    for titre, desc, attendu in cas:
        resultat = pays_depuis_texte(titre, desc, "")
        assert resultat == attendu, f"ECHEC: {titre} -> {resultat} (attendu {attendu})"
    print(f"  OK {len(cas)} cas financeur conformes")


def test_pays_frontiere_de_mot():
    """Aucun pays ne sort d'un mot plus long (faux positifs de la sonde).

    « Machine Learning » contient « chine », « Independent » contient « inde » :
    sans frontière de mot, la sonde de contrôle classait une offre sud-africaine
    en Chine et une bourse suisse en Inde.
    """
    cas = [
        (
            "South African Reserve Bank Master's in Data Science and Machine Learning",
            PaysEtudes.AFRIQUE_DU_SUD,
        ),
        ("SNSF Starting Grants 2027 for Independent Researchers", None),
        ("Bourse de recherche fondamentale", None),
    ]
    print("[TEST] Frontière de mot (« machine » ne dit pas Chine) ...")
    for titre, attendu in cas:
        resultat = pays_depuis_texte(titre, "")
        assert resultat != PaysEtudes.CHINE, f"ECHEC: {titre} -> Chine (sous-chaîne machine)"
        assert resultat != PaysEtudes.INDE, f"ECHEC: {titre} -> Inde (sous-chaîne independent)"
        assert resultat == attendu, f"ECHEC: {titre} -> {resultat} (attendu {attendu})"
    print(f"  OK {len(cas)} pièges de sous-chaîne évités")


def test_titre_prioritaire():
    """Le TITRE explicite l'emporte sur une description qui cite d'autres pays.

    Mesure : 25 offres identifiables restaient sans pays parce que la
    description d'agrégateur listait plusieurs pays (« compare with USA, UK »).
    """
    cas = [
        (
            "Bourse MEXT 2027 au Japon",
            "Comparez avec les bourses USA, UK et Canada",
            PaysEtudes.JAPON,
        ),
        (
            "University of Melbourne Scholarships in Australia",
            "Also available in Canada and Germany",
            PaysEtudes.AUSTRALIE,
        ),
    ]
    print("[TEST] Le titre explicite fait foi ...")
    for titre, desc, attendu in cas:
        resultat = pays_depuis_texte(titre, desc, "")
        assert resultat == attendu, f"ECHEC: {titre} -> {resultat} (attendu {attendu})"
    # Mais un titre qui nomme DEUX pays reste ambigu : jamais deviné.
    assert pays_depuis_texte("Bourse France Canada", "") is None
    print("  OK titre prioritaire, titre ambigu toujours écarté")


def test_backfill_modes():
    """`backfill-pays.py` : dry-run n'écrit RIEN, --apply corrige pour de vrai.

    On n'espère pas en lisant le code : on exécute le script sur un faux
    Supabase et on compte les écritures.
    """
    print("[TEST] backfill-pays : dry-run sans écriture, --apply corrige ...")
    import importlib.util

    chemin = ROOT / "scripts" / "backfill-pays.py"
    spec = importlib.util.spec_from_file_location("backfill_pays", chemin)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    lignes = [
        {
            "id": "1",
            "titre": "University of Tokyo MEXT Scholarship 2027 in Japan",
            "description": "",
            "source_url": "https://exemple.mr/1",
            "pays_etudes": None,
        },
        {
            "id": "2",
            "titre": "University of Cape Town Mastercard Foundation Scholars",
            "description": "",
            "source_url": "https://exemple.mr/2",
            "pays_etudes": "senegal",
        },
    ]

    def executer(arguments):
        faux = FauxSupabase({"offres": lignes})
        ancien = module.supabase
        module.supabase = faux
        ancien_argv = sys.argv
        sys.argv = ["backfill-pays.py", *arguments]
        try:
            module.main()
        finally:
            module.supabase = ancien
            sys.argv = ancien_argv
        return faux

    sec = executer(["--corriger"])
    assert not sec.updates, f"dry-run a écrit : {sec.updates}"

    applique = executer(["--corriger", "--apply"])
    valeurs = {
        filtres[0][1]: donnees["pays_etudes"]
        for _, donnees, filtres in applique.updates
    }
    assert valeurs.get("1") == "japon", f"pays vide non rempli : {valeurs}"
    assert valeurs.get("2") == "afrique_du_sud", f"pays faux non corrigé : {valeurs}"
    print(f"  OK dry-run muet, --apply a corrigé {len(applique.updates)} offre(s)")


def test_catalogue_urls():
    """Verifier que les URLs corrigees sont bien dans le catalogue."""
    print("[TEST] Test URLs catalogue...")

    # Verifier mauritel (www.)
    mauritel_urls = next(u for n, u, v in CATALOGUE if n == "mauritel")
    assert any("www.mauritel.mr" in url for url in mauritel_urls), f"mauritel: {mauritel_urls}"
    assert not any("mauritel.mr/" in url and not url.startswith("https://www.") for url in mauritel_urls), "mauritel: non-www present"

    # Verifier bnm (www.)
    bnm_urls = next(u for n, u, v in CATALOGUE if n == "bnm")
    assert any("www.bnm.mr" in url for url in bnm_urls), f"bnm: {bnm_urls}"

    # Verifier totalenergies (nouvelle URL)
    te_urls = next(u for n, u, v in CATALOGUE if n == "totalenergies")
    assert any("totalenergies.com/mauritania" in url for url in te_urls), f"totalenergies: {te_urls}"
    assert not any("totalenergies.mr" in url for url in te_urls), "totalenergies: ancien domaine present"

    print("  OK Catalogue URLs corrigees OK")
    print(f"     mauritel: {mauritel_urls}")
    print(f"     bnm: {bnm_urls}")
    print(f"     totalenergies: {te_urls}")


def test_backfill_dry_run():
    """Doublon retiré : la preuve réelle est `test_backfill_modes`.

    Cette fonction était un `assert True` (« Couvert par lecture du code »),
    c'est-à-dire une preuve qui ne prouvait rien.
    """
    print("[TEST] (dry-run déjà prouvé par test_backfill_modes)")


# --- Exécution ---

def run_all_tests():
    """Lance tous les tests."""
    print("=" * 60)
    print("HARNAIS TEST-SOURCES-ET-PAYS")
    print("=" * 60)

    test_pays_positifs()
    test_pays_negatifs()
    test_pays_ambigus()
    test_pays_non_ecrasement()
    test_pays_nouveaux()
    test_pays_financeur()
    test_pays_frontiere_de_mot()
    test_titre_prioritaire()
    test_backfill_modes()
    test_catalogue_urls()
    test_backfill_dry_run()

    print("\n" + "=" * 60)
    print("OK TOUS LES TESTS PASSÉS")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Harnais test sources et pays")
    parser.add_argument("--verbose", "-v", action="store_true", help="Affichage détaillé")
    args = parser.parse_args()

    run_all_tests()