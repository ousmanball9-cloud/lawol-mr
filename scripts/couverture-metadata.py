#!/usr/bin/env python3
"""Couverture des cles `offres.metadata` - on mesure, on n'estime pas.

Contrat de reference : docs/contrat-metadata-offres.md
Lot : V4-A (plan-lots-vague4-2026-11-06.md)

Usage :
    python scripts/couverture-metadata.py --self-test      # harnais, zero reseau
    python scripts/couverture-metadata.py                  # Supabase, catalogue public
    python scripts/couverture-metadata.py --toutes         # toutes les lignes
    python scripts/couverture-metadata.py --json dump.json # dump hors ligne

Sortie : par cle, combien d'offres PORTENT la cle (present) et combien sont
EXPLOITABLES (affichable = forme valide au sens du contrat), plus les cles
hors contrat (faute de frappe / reliquat d'un ancien lot).

Deux notions distinctes, volontairement :
- `present`   : la cle existe et n'est pas None. Une forme invalide compte ici.
- `conforme`  : la forme respecte le contrat. Une valeur de silence assumee
  (`categorie_bourse = "inconnu"`, `origine_eligible.indice = "inconnu"`)
  est CONFORME : c'est une reponse, pas un defaut.
- `affichable`: la page peut la montrer sans mentir (regle d'affichage du
  contrat). C'est forcement <= conforme.

Ecarts a lire ainsi :
- present > conforme   = defaut d'ECRITURE (format refuse par le contrat) ;
- conforme > affichable = silence normal (calendrier a 1 etape, pays unique).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# --------------------------------------------------------------- contrat
CATEGORIES = ("gouvernementale", "institutionnelle", "fondation", "entreprise", "inconnu")
CATEGORIES_AFFICHABLES = tuple(c for c in CATEGORIES if c != "inconnu")
PERIODES = ("mois", "an", "total")
ETAPES = ("candidature", "preselection", "entretien", "resultat")
INDICES = ("compatible", "incompatible", "inconnu")
PREUVES = ("texte", "source")

# Cles decrites dans le contrat (ordre du document).
CONTRAT = (
    "categorie_bourse",
    "pays_financeur",
    "deadline_source",
    "date_publication",
    "relais",
    "montant",
    "origine_eligible",
    "calendrier",
    "dates_par_pays",
)

# Cles de service : ecrites par la machinerie, jamais lues par le produit.
CLES_INTERNES = ("filieres_ignorees_base",)

_RE_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_RE_DEVISE = re.compile(r"^[A-Z]{3}$")


def date_valide(valeur) -> bool:
    """`YYYY-MM-DD` ET une date qui existe (2027-02-30 est refuse)."""
    if not isinstance(valeur, str) or not _RE_DATE.match(valeur):
        return False
    try:
        date.fromisoformat(valeur)
    except ValueError:
        return False
    return True


def _nombre(valeur) -> bool:
    # bool est un int en Python : on l'exclut explicitement.
    return isinstance(valeur, (int, float)) and not isinstance(valeur, bool)


# ------------------------------------------------------- validation par cle
def _montant_ok(valeur) -> bool:
    if not isinstance(valeur, dict):
        return False
    if not _nombre(valeur.get("valeur")) or valeur["valeur"] <= 0:
        return False
    devise = valeur.get("devise")
    if not isinstance(devise, str) or not _RE_DEVISE.match(devise):
        return False
    return valeur.get("periode") in PERIODES


def _origine_ok(valeur) -> bool:
    if not isinstance(valeur, dict):
        return False
    if valeur.get("indice") not in ("compatible", "incompatible"):
        return False  # "inconnu" = silence a l'ecran, pas un affichage
    return valeur.get("preuve") in PREUVES


def _calendrier_conforme(valeur) -> bool:
    if not isinstance(valeur, list) or not valeur:
        return False
    etapes: list[str] = []
    for entree in valeur:
        if not isinstance(entree, dict):
            return False
        if entree.get("etape") not in ETAPES:
            return False
        if not date_valide(entree.get("date")):
            return False
        if entree["etape"] in etapes:  # une etape, une date
            return False
        etapes.append(entree["etape"])
    return True


def _dates_par_pays_conforme(valeur) -> bool:
    if not isinstance(valeur, dict) or not valeur:
        return False
    return all(
        isinstance(pays, str) and pays and date_valide(d)
        for pays, d in valeur.items()
    )


def _categorie_conforme(valeur) -> bool:
    return valeur in CATEGORIES  # "inconnu" est une valeur legitime


def _origine_conforme(valeur) -> bool:
    if not isinstance(valeur, dict):
        return False
    return valeur.get("indice") in INDICES and valeur.get("preuve") in PREUVES


def _texte_ok(valeur) -> bool:
    return isinstance(valeur, str) and bool(valeur.strip())


# Conformite au contrat : accepte les valeurs de silence assumees.
CONFORMITE = {
    "categorie_bourse": _categorie_conforme,
    "pays_financeur": _texte_ok,
    "deadline_source": _texte_ok,
    "date_publication": date_valide,
    "relais": _texte_ok,
    "montant": _montant_ok,
    "origine_eligible": _origine_conforme,
    "calendrier": _calendrier_conforme,
    "dates_par_pays": _dates_par_pays_conforme,
}


# Regles d'AFFICHAGE : au-dela de la forme, ce que la page a le droit de montrer.
def _categorie_ok(valeur) -> bool:
    return valeur in CATEGORIES_AFFICHABLES  # "inconnu" ne s'affiche pas


def _calendrier_affichable(valeur) -> bool:
    return _calendrier_conforme(valeur) and len(valeur) >= 2  # 1 date != calendrier


def _dates_par_pays_affichable(valeur) -> bool:
    return _dates_par_pays_conforme(valeur) and len(valeur) >= 2  # 1 pays = date_limite


AFFICHAGE = {
    **CONFORMITE,
    "categorie_bourse": _categorie_ok,
    "origine_eligible": _origine_ok,
    "calendrier": _calendrier_affichable,
    "dates_par_pays": _dates_par_pays_affichable,
}


# ------------------------------------------------------------- analyse
def metadata(offre: dict) -> dict:
    brut = (offre or {}).get("metadata")
    return brut if isinstance(brut, dict) else {}


def analyser(offres: list[dict]) -> dict:
    """Compte present/conforme/affichable par cle + cles hors contrat."""
    total = len(offres)
    compte = {cle: {"present": 0, "conforme": 0, "affichable": 0} for cle in CONTRAT}
    hors_contrat: dict[str, int] = {}
    connues = set(CONTRAT) | set(CLES_INTERNES)

    for offre in offres:
        meta = metadata(offre)
        for cle, valeur in meta.items():
            if cle not in connues:
                hors_contrat[cle] = hors_contrat.get(cle, 0) + 1
                continue
            if cle not in compte:  # cle interne : comptee nulle part
                continue
            if valeur is None:
                continue
            compte[cle]["present"] += 1
            if CONFORMITE[cle](valeur):
                compte[cle]["conforme"] += 1
            if AFFICHAGE[cle](valeur):
                compte[cle]["affichable"] += 1

    return {"total": total, "cles": compte, "hors_contrat": hors_contrat}


def est_publique(offre: dict, aujourd_hui: date) -> bool:
    if not offre.get("active", True):
        return False
    limite = offre.get("date_limite")
    if not limite:
        return True
    try:
        return date.fromisoformat(str(limite)[:10]) >= aujourd_hui
    except ValueError:
        return True


# ------------------------------------------------------------- sources
def charger_supabase() -> list[dict]:
    """Lit TOUTES les lignes par pages de 1000 (PostgREST plafonne)."""
    # Import paresseux : `--self-test` doit tourner sans env ni reseau.
    # ruff: I001 (ordre des imports en fonction) - volontaire, voir commentaire.
    from apps.api.app.core.database import supabase

    lignes: list[dict] = []
    page, offset = 1000, 0
    while True:
        reponse = (
            supabase.table("offres")
            .select("id, active, date_limite, metadata")
            .range(offset, offset + page - 1)
            .execute()
        )
        lot = reponse.data or []
        lignes.extend(lot)
        if len(lot) < page:
            break
        offset += page
    return lignes


def charger_json(chemin: str) -> list[dict]:
    contenu = json.loads(Path(chemin).read_text(encoding="utf-8"))
    if isinstance(contenu, dict):
        contenu = contenu.get("data") or contenu.get("offres") or []
    if not isinstance(contenu, list):
        raise SystemExit("JSON attendu : liste de lignes offres (ou {'data': [...]}).")
    return [ligne for ligne in contenu if isinstance(ligne, dict)]


# ------------------------------------------------------------- affichage
def afficher(resultat: dict, libelle: str) -> None:
    total = resultat["total"]
    print(f"Population : {libelle} = {total} offre(s)")
    print()
    print(f"{'cle':<20}{'present':>9}{'conforme':>10}{'affichable':>12}{'%aff':>8}")
    print("-" * 59)
    for cle in CONTRAT:
        c = resultat["cles"][cle]
        pct = (100.0 * c["affichable"] / total) if total else 0.0
        print(f"{cle:<20}{c['present']:>9}{c['conforme']:>10}{c['affichable']:>12}{pct:>7.1f}%")
    print()
    if resultat["hors_contrat"]:
        print("Cles HORS CONTRAT (a corriger, cf. docs/contrat-metadata-offres.md) :")
        for cle, n in sorted(resultat["hors_contrat"].items()):
            print(f"  - {cle} : {n}")
    else:
        print("Cles hors contrat : aucune")
    ecarts = [
        (cle, resultat["cles"][cle]["present"], resultat["cles"][cle]["conforme"])
        for cle in CONTRAT
        if resultat["cles"][cle]["present"] > resultat["cles"][cle]["conforme"]
    ]
    if ecarts:
        print()
        print("ECRITURE non conforme (present > conforme) :")
        for cle, present, conforme in ecarts:
            print(f"  - {cle} : {present - conforme} valeur(s) refusee(s) par le contrat")


# ------------------------------------------------------------- self-test
def self_test() -> int:
    """Assertions exactes sur un jeu construit a la main. Zero reseau."""
    offres = [
        {"metadata": {}},                                                     # 1
        {"metadata": {"categorie_bourse": "gouvernementale"}},                # 2
        {"metadata": {"categorie_bourse": "inconnu"}},                        # 3
        {"metadata": {"montant": {"valeur": 1200, "devise": "EUR", "periode": "mois"}}},   # 4
        {"metadata": {"montant": {"valeur": "1200", "devise": "euros", "periode": "mois"}}},  # 5
        {"metadata": {"montant": {"valeur": 0, "devise": "EUR", "periode": "mois"}}},      # 6
        {"metadata": {"calendrier": [{"etape": "candidature", "date": "2027-01-15"}]}},    # 7
        {"metadata": {"calendrier": [                                                     # 8
            {"etape": "candidature", "date": "2027-01-15"},
            {"etape": "resultat", "date": "2027-04-30"},
        ]}},
        {"metadata": {"dates_par_pays": {"france": "2027-02-10"}}},                        # 9
        {"metadata": {"dates_par_pays": {"france": "2027-02-10", "allemagne": "2027-03-01"}}},  # 10
        {"metadata": {"origine_eligible": {"indice": "compatible"}}},                      # 11
        {"metadata": {"origine_eligible": {"indice": "compatible", "preuve": "texte"}}},   # 12
        {"metadata": {"montanth": 5}},                                                     # 13
        {"metadata": {                                                                     # 14
            "categorie_bourse": "gouvernementale",
            "montant": {"valeur": 500, "devise": "USD", "periode": "an"},
            "relais": "MESRS Mauritanie",
            "filieres_ignorees_base": ["genie des procedes"],
        }},
        {"metadata": None},                                                                # 15
        {"metadata": {"calendrier": [                                                      # 16
            {"etape": "candidature", "date": "2027-01-15"},
            {"etape": "candidature", "date": "2027-02-15"},
        ]}},
    ]
    resultat = analyser(offres)
    attendu = {
        "total": 16,
        "cles": {
            "categorie_bourse": {"present": 3, "conforme": 3, "affichable": 2},
            "pays_financeur": {"present": 0, "conforme": 0, "affichable": 0},
            "deadline_source": {"present": 0, "conforme": 0, "affichable": 0},
            "date_publication": {"present": 0, "conforme": 0, "affichable": 0},
            "relais": {"present": 1, "conforme": 1, "affichable": 1},
            "montant": {"present": 4, "conforme": 2, "affichable": 2},
            "origine_eligible": {"present": 2, "conforme": 1, "affichable": 1},
            "calendrier": {"present": 3, "conforme": 2, "affichable": 1},
            "dates_par_pays": {"present": 2, "conforme": 2, "affichable": 1},
        },
        "hors_contrat": {"montanth": 1},
    }

    echecs: list[str] = []
    if resultat["total"] != attendu["total"]:
        echecs.append(f"total {resultat['total']} != {attendu['total']}")
    for cle, attendu_cle in attendu["cles"].items():
        obtenu = resultat["cles"][cle]
        if obtenu != attendu_cle:
            echecs.append(f"{cle} : {obtenu} != {attendu_cle}")
    if resultat["hors_contrat"] != attendu["hors_contrat"]:
        echecs.append(f"hors_contrat {resultat['hors_contrat']} != {attendu['hors_contrat']}")

    # Pieges isoles : chacun doit tomber seul si un validateur s'ouvre.
    pieges = {
        "bool refuse comme montant": not _montant_ok({"valeur": True, "devise": "EUR", "periode": "an"}),
        "date impossible refusee": not date_valide("2027-02-30"),
        "devise minuscule refusee": not _montant_ok({"valeur": 5, "devise": "eur", "periode": "an"}),
        "periode inconnue refusee": not _montant_ok({"valeur": 5, "devise": "EUR", "periode": "semaine"}),
        "indice inconnu non affichable": not _origine_ok({"indice": "inconnu", "preuve": "texte"}),
        "un seul pays non affichable": not _dates_par_pays_affichable({"france": "2027-01-01"}),
        # Le coeur du contrat : conforme != affichable. Un validateur qui
        # confond les deux ferait passer du silence assume pour un defaut.
        "categorie inconnu conforme mais non affichable": (
            _categorie_conforme("inconnu") and not _categorie_ok("inconnu")
        ),
        "calendrier 1 etape conforme mais non affichable": (
            _calendrier_conforme([{"etape": "candidature", "date": "2027-01-15"}])
            and not _calendrier_affichable([{"etape": "candidature", "date": "2027-01-15"}])
        ),
        "un seul pays conforme mais non affichable": (
            _dates_par_pays_conforme({"france": "2027-01-01"})
            and not _dates_par_pays_affichable({"france": "2027-01-01"})
        ),
    }
    echecs.extend(f"piege : {nom}" for nom, ok in pieges.items() if not ok)

    afficher(resultat, "jeu de test (16 offres)")
    print()
    if echecs:
        print(f"ECHEC : {len(echecs)} assertion(s) KO")
        for echec in echecs:
            print(f"  - {echec}")
        return 1
    print(f"SELF-TEST VERT : 16 offres, 9 cles, {len(pieges)} pieges isoles")
    return 0


# ------------------------------------------------------------- main
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Couverture de offres.metadata")
    parser.add_argument("--self-test", action="store_true", help="harnais hors ligne")
    parser.add_argument("--json", metavar="FICHIER", help="lire un dump au lieu de Supabase")
    parser.add_argument("--toutes", action="store_true", help="inclure inactives et expirees")
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()

    if args.json:
        offres = charger_json(args.json)
        libelle = f"dump {args.json}"
    else:
        offres = charger_supabase()
        libelle = "toutes les lignes Supabase"

    if not args.toutes:
        # Date UTC : la Mauritanie est a UTC+0, une date locale n'apporterait rien.
        aujourd_hui = datetime.now(timezone.utc).date()
        retenues = [o for o in offres if est_publique(o, aujourd_hui)]
        libelle = f"catalogue public (actives, echeance future) sur {len(offres)} lignes"
        offres = retenues

    afficher(analyser(offres), libelle)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
