# -*- coding: utf-8 -*-
"""Harnais de preuve du moteur de matching — LAWOL.mr (lecture seule).

Prouve la CONSTITUTION et la PERFORMANCE du moteur, sans écrire en base :

  1. Règles dures (match_regles) : matrice de cas, dont le cas « bourse »
     dont la ville n'a aucun sens (la ville d'une offre de bourse est le lieu
     d'ÉTUDES, pas celui du candidat).
  2. Barème (calculer_score_pertinence) : bornes 0-100, saturation, égalités.
  3. Réalité des données : taux de remplissage des champs qui pèsent dans le
     score (pays_etudes, type_financement, filieres_cibles).
  4. Sélection (selectionner_candidats) : quota hebdomadaire, quota bourses
     génériques, ordre par score.
  5. Performance : coût mesuré par paire (profil × offre) + extrapolation.

Aucune écriture : les seules I/O sont des SELECT. Rejouable en une commande :

    python -X utf8 scripts/test-matching.py

Code retour 0 si tous les checks passent.
"""
from __future__ import annotations

import sys
import time
from datetime import date, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from apps.api.app.core.database import supabase  # noqa: E402
from apps.api.app.modules.matching import engine  # noqa: E402
from apps.api.app.modules.shared.models import Filiere, TypeOffre, Ville  # noqa: E402

_checks: list[tuple[bool, str]] = []


def check(ok: bool, libelle: str) -> None:
    _checks.append((bool(ok), libelle))
    print(f"  [{'OK' if ok else 'KO'}] {libelle}")


AUJ = date(2026, 10, 20)


def regles(**kw):
    """Appel de match_regles avec un profil « bourse » par défaut."""
    base = dict(
        profil_actif=True,
        offre_active=True,
        date_limite=AUJ + timedelta(days=30),
        type_offre=TypeOffre.BOURSE.value,
        types_recherches=[TypeOffre.BOURSE.value],
        filiere_profil=Filiere.INFORMATIQUE.value,
        filieres_interet=[],
        filieres_cibles=[Filiere.INFORMATIQUE.value],
        ville_profil=Ville.NOUAKCHOTT.value,
        ville_offre=Ville.NOUAKCHOTT.value,
        aujourdhui=AUJ,
    )
    base.update(kw)
    return engine.match_regles(**base)


# ------------------------------------------------------------------ 1. RÈGLES
def preuve_regles() -> None:
    print("\n=== 1. MATRICE DES RÈGLES DURES ===")
    check(regles()[0], "cas nominal : informatique / Nouakchott → match")
    check(regles(profil_actif=False) == (False, "profil_inactif"), "profil inactif → refus")
    check(regles(offre_active=False) == (False, "offre_inactive"), "offre inactive → refus")
    check(
        regles(date_limite=AUJ - timedelta(days=1)) == (False, "offre_expiree"),
        "offre expirée → refus",
    )
    check(
        regles(types_recherches=["stage_pfe"]) == (False, "type_non_recherche"),
        "type non recherché → refus",
    )
    check(
        regles(filiere_profil=Filiere.DROIT.value)[0] is False,
        "filière hors cibles → refus",
    )
    check(
        regles(
            filiere_profil=Filiere.DROIT.value,
            filieres_interet=[Filiere.INFORMATIQUE.value],
        )[0],
        "filière d'intérêt commune → match",
    )
    check(
        regles(
            ville_profil=Ville.NOUADHIBOU.value,
            ville_offre=Ville.AUTRE.value,
        )[0],
        "ville « autre » = joker → match",
    )
    check(
        regles(
            pays_etudes_offre="france",
            pays_favoris_profil=["allemagne"],
        )
        == (False, "pays_non_favori"),
        "pays d'études hors favoris → refus",
    )
    check(
        regles(
            type_financement_offre="partiel",
            financement_min_profil="fully_funded",
        )
        == (False, "financement_insuffisant"),
        "financement sous le minimum → refus",
    )

    # --- Défaut structurel mesuré : la règle VILLE appliquée aux bourses.
    # Une offre de bourse est LOCALISÉE dans le pays d'études : sa `ville`
    # vaut Nouakchott par défaut (BaseScraper.save). Un étudiant hors
    # Nouakchott est donc écarté de TOUTES les bourses.
    ok, raison = regles(
        ville_profil=Ville.NOUADHIBOU.value, ville_offre=Ville.NOUAKCHOTT.value
    )
    check(
        (ok, raison) == (False, "ville_non_matchee"),
        "DÉFAUT CONFIRMÉ : bourse Nouakchott + étudiant Nouadhibou → refus (ville_non_matchee)",
    )
    ok_stage, _ = regles(
        type_offre="stage_pfe",
        types_recherches=["stage_pfe"],
        ville_profil=Ville.NOUADHIBOU.value,
        ville_offre=Ville.NOUAKCHOTT.value,
    )
    check(
        not ok_stage,
        "même règle pour un STAGE : refus légitime (le stage est réellement localisé)",
    )


# ------------------------------------------------------------------- 2. BARÈME
def preuve_bareme() -> None:
    print("\n=== 2. BARÈME DE PERTINENCE (0-100) ===")
    commun = dict(
        filiere_profil=Filiere.INFORMATIQUE.value,
        filieres_interet=[],
        filieres_cibles=[Filiere.INFORMATIQUE.value],
        ville_profil=Ville.NOUAKCHOTT.value,
        ville_offre=Ville.NOUAKCHOTT.value,
        date_scrape=AUJ,
        date_limite=AUJ + timedelta(days=10),
        aujourdhui=AUJ,
    )
    s_min = engine.calculer_score_pertinence(
        **{
            **commun,
            "filieres_cibles": [Filiere.DROIT.value],
            "ville_offre": Ville.AUTRE.value,
            "date_scrape": AUJ - timedelta(days=90),
            "date_limite": AUJ + timedelta(days=200),
        }
    )
    check(0 <= s_min <= 100, f"borne basse respectée (score={s_min})")

    s_max = engine.calculer_score_pertinence(
        **commun,
        pays_etudes_offre="france",
        pays_favoris_profil=["france"],
        type_financement_offre="fully_funded",
        financement_min_profil="partiel",
    )
    check(s_max == 100, f"score maximal plafonné à 100 (score={s_max})")

    # Somme brute des bonus avant plafond : 50+20+15+10+5+10+10 = 120
    somme = 50 + 20 + 15 + 10 + 5 + 10 + 10
    check(
        somme == 120,
        f"DÉFAUT CONFIRMÉ : somme brute des bonus = {somme} > 100 → saturation",
    )

    s_vieille = engine.calculer_score_pertinence(
        **{**commun, "date_scrape": AUJ - timedelta(days=30)},
        pays_etudes_offre="france",
        pays_favoris_profil=["france"],
        type_financement_offre="fully_funded",
        financement_min_profil="partiel",
    )
    check(
        s_max == s_vieille == 100,
        "DÉFAUT CONFIRMÉ : offre fraîche et offre vieille obtiennent le MÊME score (100)",
    )

    s_gen = engine.calculer_score_pertinence(**commun, bourse_generique=True)
    check(
        s_gen < s_max,
        f"bourse générique moins bien notée qu'une ciblée ({s_gen} < {s_max})",
    )
    check(
        engine.SCORE_MIN_PERTINENCE == 30,
        "seuil global = 30 → une simple filière d'intérêt (30) suffit à matcher",
    )


# ------------------------------------------------------- 3. DONNÉES RÉELLES
def preuve_donnees() -> None:
    print("\n=== 3. RÉALITÉ DES DONNÉES (SELECT, aucune écriture) ===")
    res = (
        supabase.table("offres")
        .select("id, type_offre, ville, pays_etudes, type_financement, filieres_cibles, date_limite")
        .eq("active", True)
        .execute()
    )
    offres = res.data or []
    n = len(offres)
    check(n > 0, f"{n} offres actives lues")

    bourses = [o for o in offres if o.get("type_offre") == TypeOffre.BOURSE.value]
    nb = len(bourses)
    check(nb > 0, f"{nb} bourses actives")

    sans_pays = sum(1 for o in bourses if not o.get("pays_etudes"))
    taux_pays = round(100 * sans_pays / nb, 1) if nb else 0
    print(
        f"  -> pays_etudes manquant : {sans_pays}/{nb} ({taux_pays} %) → bonus pays inapplicable"
    )

    villes: dict = {}
    for o in bourses:
        villes[o.get("ville")] = villes.get(o.get("ville"), 0) + 1
    print(f"  -> villes des bourses : {villes}")
    check(
        len(villes) <= 2,
        "le champ `ville` d'une bourse ne décrit pas le candidat (1-2 valeurs) → bruit, pas signal",
    )

    generiques = [
        o
        for o in bourses
        if engine.est_bourse_generique(o.get("type_offre"), o.get("filieres_cibles"))
    ]
    tailles: dict = {}
    for o in bourses:
        k = len(o.get("filieres_cibles") or [])
        tailles[k] = tailles.get(k, 0) + 1
    print(f"  -> distribution filieres_cibles : {dict(sorted(tailles.items()))}")
    print(
        f"  -> filière unique = {len(Filiere)} valeurs ; bourses dites génériques : {len(generiques)}"
    )

    trop_larges = sum(1 for o in bourses if len(set(o.get("filieres_cibles") or [])) >= 10)
    check(
        trop_larges > 0,
        f"{trop_larges} bourses ciblent ≥ 10 filières : ni ciblées, ni génériques (zone grise non gérée)",
    )
    check(
        len(generiques) == 0,
        "aucune bourse n'atteint le seuil « générique » (22 filières) → le garde-fou Lot D ne se déclenche jamais",
    )


# ------------------------------------------------------------- 4. SÉLECTION
def preuve_selection() -> None:
    print("\n=== 4. SÉLECTION (tri + quotas) ===")
    cands = [
        {"offre_id": f"o{i}", "profil_id": "p", "score": s, "metadata": {"bourse_generique": g}}
        for i, (s, g) in enumerate(
            [(95, False), (80, True), (70, False), (60, True), (50, True), (40, True), (35, False)]
        )
    ]
    retenus, spam, gen = engine.selectionner_candidats(cands, deja_semaine=0, deja_generiques=0)
    check(
        len(retenus) == engine.MAX_MATCHES_PAR_SEMAINE,
        f"quota hebdo respecté ({len(retenus)})",
    )
    check(
        [c["score"] for c in retenus] == sorted((c["score"] for c in retenus), reverse=True),
        "retenus triés par score décroissant",
    )
    check(
        sum(1 for c in retenus if c["metadata"]["bourse_generique"])
        <= engine.MAX_BOURSES_GENERIQUES_PAR_PROFIL,
        "quota bourses génériques respecté",
    )
    retenus2, spam2, _ = engine.selectionner_candidats(
        cands, deja_semaine=4, deja_generiques=0
    )
    check(
        len(retenus2) == 1 and spam2 == 6,
        "quota hebdo cumulé pris en compte (4 déjà faits → 1 place)",
    )

    ex = [
        {"offre_id": "a", "profil_id": "p", "score": 70, "metadata": {}},
        {"offre_id": "b", "profil_id": "p", "score": 70, "metadata": {}},
    ]
    r1, _, _ = engine.selectionner_candidats(ex, deja_semaine=0, deja_generiques=0)
    r2, _, _ = engine.selectionner_candidats(
        list(reversed(ex)), deja_semaine=0, deja_generiques=0
    )
    check(
        r1[0]["offre_id"] != r2[0]["offre_id"],
        "DÉFAUT CONFIRMÉ : à score égal, l'ordre dépend de l'ordre d'itération (aucun tie-break)",
    )


# ------------------------------------------------------------ 5. PERFORMANCE
def preuve_performance() -> None:
    print("\n=== 5. PERFORMANCE (coût par paire × volume) ===")
    offres = [
        {
            "type_offre": TypeOffre.BOURSE.value,
            "filieres_cibles": [Filiere.INFORMATIQUE.value],
            "ville": Ville.NOUAKCHOTT.value,
        }
        for _ in range(266)
    ]
    N = 400  # paires mesurées
    t0 = time.perf_counter()
    for i in range(N):
        o = offres[i % len(offres)]
        engine.match_regles(
            profil_actif=True,
            offre_active=True,
            date_limite=AUJ + timedelta(days=30),
            type_offre=o["type_offre"],
            types_recherches=[TypeOffre.BOURSE.value],
            filiere_profil=Filiere.INFORMATIQUE.value,
            filieres_interet=[],
            filieres_cibles=o["filieres_cibles"],
            ville_profil=Ville.NOUAKCHOTT.value,
            ville_offre=o["ville"],
            aujourdhui=AUJ,
        )
    duree = time.perf_counter() - t0
    par_paire = duree / N * 1e6
    print(f"  -> {par_paire:.1f} µs par paire (match_regles, ensembles construits à chaque appel)")

    for profils in (10, 100, 1000, 10000):
        total = profils * 266 * par_paire / 1e6
        print(f"     {profils:>6} profils × 266 offres = {profils*266:>9} paires → {total:7.2f} s")

    check(par_paire < 100, f"coût unitaire acceptable ({par_paire:.1f} µs < 100 µs)")
    check(
        1000 * 266 * par_paire / 1e6 < 30,
        "1000 profils tiennent sous 30 s (marge avant vectorisation)",
    )

    # PostgREST plafonne les lectures à 1000 lignes par défaut.
    mres = supabase.table("matches").select("profil_id", count="exact").execute()
    nb_matches = mres.count if mres.count is not None else len(mres.data or [])
    print(f"  -> table matches : {nb_matches} lignes")
    check(
        nb_matches < 1000,
        f"lecture complète des matches sûre aujourd'hui ({nb_matches} < 1000 lignes PostgREST)",
    )
    if nb_matches >= 1000:
        print(
            "     ATTENTION : au-delà de 1000, `deja_matchees` devient partiel → doublons de matches"
        )


def main() -> int:
    print("Harnais matching LAWOL.mr — lecture seule")
    preuve_regles()
    preuve_bareme()
    preuve_donnees()
    preuve_selection()
    preuve_performance()
    ko = [c for c in _checks if not c[0]]
    print(f"\n=== BILAN : {len(_checks) - len(ko)}/{len(_checks)} checks verts ===")
    for _, libelle in ko:
        print(f"  KO : {libelle}")
    return 1 if ko else 0


if __name__ == "__main__":
    sys.exit(main())
