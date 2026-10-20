"""Harnais de preuve du moteur de matching — LAWOL.mr (lecture seule).

Prouve la CONSTITUTION et la PERFORMANCE du moteur, sans écrire en base :

  1. Règles dures (match_regles) : matrice de cas, dont le cas « bourse »
     dont la ville n'a aucun sens (la ville d'une offre de bourse est le lieu
     d'ÉTUDES, pas celui du candidat).
  2. Barème v2 (calculer_score_pertinence) : normalisation, absence de
     saturation, critère non applicable, décroissances continues.
  3. Réalité des données : taux de remplissage des champs qui pèsent dans le
     score (pays_etudes, type_financement, filieres_cibles).
  4. Sélection (selectionner_candidats) : quota hebdomadaire, quota bourses
     génériques, ordre par score + départage déterministe.
  5. Avant/après : réplique figée du barème v1 (référence) contre le v2, sur
     les vraies bourses — nombre de matches et top 5.
  6. Performance : coût mesuré par paire (profil × offre) + extrapolation.

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
from apps.api.app.modules.shared.models import (  # noqa: E402
    Filiere,
    TypeOffre,
    Ville,
)

_checks: list[tuple[bool, str]] = []


def check(ok: bool, libelle: str) -> None:
    _checks.append((bool(ok), libelle))
    print(f"  [{'OK' if ok else 'KO'}] {libelle}")


AUJ = date(2026, 10, 20)


def regles(**kw):
    """Appel de match_regles avec un profil « bourse » par défaut."""
    base = {
        "profil_actif": True,
        "offre_active": True,
        "date_limite": AUJ + timedelta(days=30),
        "type_offre": TypeOffre.BOURSE.value,
        "types_recherches": [TypeOffre.BOURSE.value],
        "filiere_profil": Filiere.INFORMATIQUE.value,
        "filieres_interet": [],
        "filieres_cibles": [Filiere.INFORMATIQUE.value],
        "ville_profil": Ville.NOUAKCHOTT.value,
        "ville_offre": Ville.NOUAKCHOTT.value,
        "aujourdhui": AUJ,
    }
    base.update(kw)
    return engine.match_regles(**base)


def score(**kw):
    """Appel de calculer_score_pertinence (barème v2) sur un cas nominal."""
    base = {
        "filiere_profil": Filiere.INFORMATIQUE.value,
        "filieres_interet": [],
        "filieres_cibles": [Filiere.INFORMATIQUE.value],
        "ville_profil": Ville.NOUAKCHOTT.value,
        "ville_offre": Ville.NOUAKCHOTT.value,
        "date_scrape": AUJ,
        "date_limite": AUJ + timedelta(days=10),
        "type_offre": TypeOffre.BOURSE.value,
        "aujourdhui": AUJ,
    }
    base.update(kw)
    return engine.calculer_score_pertinence(**base)


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

    # --- CORRIGÉ v2 : la règle VILLE ne s'applique plus aux bourses.
    # Avant : une bourse « nouakchott » éliminait tout étudiant de Nouadhibou.
    ok, raison = regles(
        ville_profil=Ville.NOUADHIBOU.value, ville_offre=Ville.NOUAKCHOTT.value
    )
    check(
        (ok, raison) == (True, "match"),
        "CORRIGÉ v2 : bourse Nouakchott + étudiant Nouadhibou → MATCH (ville = destination)",
    )
    ok_stage, raison_stage = regles(
        type_offre="stage_pfe",
        types_recherches=["stage_pfe"],
        ville_profil=Ville.NOUADHIBOU.value,
        ville_offre=Ville.NOUAKCHOTT.value,
    )
    check(
        (ok_stage, raison_stage) == (False, "ville_non_matchee"),
        "le stage garde la règle ville (le lieu du poste est réel)",
    )
    check(
        regles(
            type_offre="stage_pfe",
            types_recherches=["stage_pfe"],
            ville_profil=Ville.NOUADHIBOU.value,
            ville_offre=Ville.AUTRE.value,
        )[0],
        "stage « autre ville » = joker → match",
    )


# ------------------------------------------------------------------- 2. BARÈME
def preuve_bareme() -> None:
    print("\n=== 2. BARÈME v2 : NORMALISÉ, SANS SATURATION ===")
    poids = [
        engine.POIDS_FILIERE,
        engine.POIDS_FINANCEMENT,
        engine.POIDS_FRAICHEUR,
        engine.POIDS_URGENCE,
        engine.POIDS_LOCALISATION,
    ]
    check(sum(poids) == 100, f"somme des poids = {sum(poids)} (cible 100)")

    s_top = score(type_financement_offre="fully_funded")
    check(
        90 <= s_top < 100,
        f"cas bon mais échéance à 10 j = {s_top} (< 100 : l'urgence manque, plus de plafond)",
    )
    s_parfait = score(
        type_financement_offre="fully_funded",
        date_limite=AUJ + timedelta(days=2),
    )
    check(s_parfait == 100, f"cas parfait (filière + fully + frais + J-2) = {s_parfait}")

    s_vieille = score(
        type_financement_offre="fully_funded",
        date_scrape=AUJ - timedelta(days=30),
    )
    check(
        s_vieille < s_top,
        f"CORRIGÉ v2 : offre vieille de 30 j ({s_vieille}) < offre fraîche ({s_top})",
    )
    s_lointaine = score(
        type_financement_offre="fully_funded",
        date_limite=AUJ + timedelta(days=60),
    )
    check(
        s_lointaine < s_top,
        f"CORRIGÉ v2 : échéance lointaine ({s_lointaine}) < échéance proche ({s_top})",
    )

    # Critère NON applicable : financement inconnu et pays absent ne changent
    # pas le score (ni bonus, ni pénalité).
    s_sans_fin = score(type_financement_offre="inconnu")
    s_avec_fin = score(type_financement_offre=None)
    check(
        s_sans_fin == s_avec_fin,
        f"financement inconnu == financement absent ({s_sans_fin}) → critère ignoré",
    )
    s_pays = score(pays_etudes_offre="france", pays_favoris_profil=["france"])
    check(
        s_pays == s_sans_fin,
        "pays favori ne donne plus de bonus (c'est un FILTRE, pas un score)",
    )

    s_gen = score(bourse_generique=True)
    check(
        s_gen < s_sans_fin,
        f"bourse générique ({s_gen}) < bourse ciblée ({s_sans_fin})",
    )
    check(
        engine.SCORE_MIN_PERTINENCE == 30,
        "seuil global = 30 (calibré : générique sans fraîcheur ni urgence tombe sous 30)",
    )
    s_gen_fade = score(
        bourse_generique=True,
        date_scrape=AUJ - timedelta(days=60),
        date_limite=AUJ + timedelta(days=90),
    )
    check(
        s_gen_fade < engine.SCORE_MIN_PERTINENCE,
        f"générique sans fraîcheur ni urgence = {s_gen_fade} < 30 → jamais poussée",
    )

    # Décroissances continues : pas de saut brutal d'un jour à l'autre.
    s_j13 = score(date_limite=AUJ + timedelta(days=13))
    s_j15 = score(date_limite=AUJ + timedelta(days=15))
    check(
        0 < s_j13 - s_j15 <= 2,
        f"urgence continue : J-13 ({s_j13}) et J-15 ({s_j15}) diffèrent de {s_j13 - s_j15} pt",
    )


# ------------------------------------------------------- 3. DONNÉES RÉELLES
def _offres_reelles() -> list[dict]:
    res = (
        supabase.table("offres")
        .select(
            "id, titre, type_offre, ville, pays_etudes, type_financement, "
            "filieres_cibles, date_limite, date_scrape"
        )
        .eq("active", True)
        .execute()
    )
    return res.data or []


def preuve_donnees(offres: list[dict]) -> None:
    print("\n=== 3. RÉALITÉ DES DONNÉES (SELECT, aucune écriture) ===")
    n = len(offres)
    check(n > 0, f"{n} offres actives lues")

    bourses = [o for o in offres if o.get("type_offre") == TypeOffre.BOURSE.value]
    nb = len(bourses)
    check(nb > 0, f"{nb} bourses actives")

    sans_pays = sum(1 for o in bourses if not o.get("pays_etudes"))
    taux_pays = round(100 * sans_pays / nb, 1) if nb else 0
    print(
        f"  -> pays_etudes manquant : {sans_pays}/{nb} ({taux_pays} %) "
        "→ AUCUN poids dans le score (filtre uniquement)"
    )

    villes: dict = {}
    for o in bourses:
        villes[o.get("ville")] = villes.get(o.get("ville"), 0) + 1
    print(f"  -> villes des bourses : {villes} → critère inapplicable (v2)")

    generiques = [
        o
        for o in bourses
        if engine.est_bourse_generique(o.get("type_offre"), o.get("filieres_cibles"))
    ]
    seuil = round(engine.SEUIL_COUVERTURE_GENERIQUE * len(Filiere), 1)
    print(f"  -> générique = ≥ {seuil} filières distinctes sur {len(Filiere)}")
    check(
        engine.est_bourse_generique(TypeOffre.BOURSE.value, list(Filiere)),
        "une bourse qui liste TOUTES les filières est bien détectée générique",
    )
    check(
        not engine.est_bourse_generique(
            TypeOffre.BOURSE.value, list(Filiere)[:10]
        ),
        "une bourse à 10 filières n'est PAS générique (couverture 29 %)",
    )
    print(f"  -> bourses génériques en base aujourd'hui : {len(generiques)}")


# ------------------------------------------------------------- 4. SÉLECTION
def preuve_selection() -> None:
    print("\n=== 4. SÉLECTION (tri + quotas + départage) ===")
    cands = [
        {
            "offre_id": f"o{i}",
            "profil_id": "p",
            "score": s,
            "_date_limite": dl,
            "metadata": {"bourse_generique": g},
        }
        for i, (s, g, dl) in enumerate(
            [
                (95, False, "2026-12-01"),
                (80, True, "2026-11-01"),
                (70, False, "2026-11-20"),
                (60, True, "2026-10-30"),
                (50, True, "2026-12-15"),
                (40, True, "2026-11-10"),
                (35, False, "2026-11-05"),
            ]
        )
    ]
    retenus, _, _ = engine.selectionner_candidats(cands, deja_semaine=0, deja_generiques=0)
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
    retenus2, spam2, _ = engine.selectionner_candidats(cands, deja_semaine=4, deja_generiques=0)
    check(
        len(retenus2) == 1 and spam2 == 6,
        "quota hebdo cumulé pris en compte (4 déjà faits → 1 place)",
    )

    # Départage déterministe : mêmes scores, entrées inversées → même ordre.
    ex = [
        {"offre_id": "b", "profil_id": "p", "score": 70,
         "_date_limite": "2026-11-20", "metadata": {}},
        {"offre_id": "a", "profil_id": "p", "score": 70,
         "_date_limite": "2026-10-28", "metadata": {}},
    ]
    r1, _, _ = engine.selectionner_candidats(ex, deja_semaine=0, deja_generiques=0)
    r2, _, _ = engine.selectionner_candidats(
        list(reversed(ex)), deja_semaine=0, deja_generiques=0
    )
    check(
        [c["offre_id"] for c in r1] == [c["offre_id"] for c in r2],
        "CORRIGÉ v2 : même ordre quelle que soit l'entrée (départage déterministe)",
    )
    check(
        r1[0]["offre_id"] == "a",
        "à score égal, l'échéance la plus proche passe devant",
    )


# ----------------------------------------------------------- 5. AVANT/APRÈS
def _score_v1(
    *,
    filiere_profil: str,
    filieres_interet: list[str],
    filieres_cibles: list[str],
    ville_profil: str,
    ville_offre: str,
    date_scrape: date,
    date_limite: date,
    bourse_generique: bool,
) -> int:
    """Réplique FIGÉE du barème v1 (référence de comparaison, jamais utilisée)."""
    score_v1 = 0
    cibles = set(filieres_cibles)
    if bourse_generique:
        score_v1 += 15
    elif filiere_profil in cibles:
        score_v1 += 50
    elif cibles & set(filieres_interet):
        score_v1 += 30
    if ville_profil == ville_offre:
        score_v1 += 20
    elif ville_profil == Ville.AUTRE.value or ville_offre == Ville.AUTRE.value:
        score_v1 += 10
    if (AUJ - date_scrape).days < 7:
        score_v1 += 10
    if (date_limite - AUJ).days < 14:
        score_v1 += 10
    return max(0, min(100, score_v1))


def preuve_avant_apres(offres: list[dict]) -> None:
    print("\n=== 5. AVANT/APRÈS (v1 figé vs v2), vraies bourses ===")
    bourses = [o for o in offres if o.get("type_offre") == TypeOffre.BOURSE.value]

    def eval_profil(ville: str, filiere: str) -> tuple[int, int, list[tuple[str, int, int]]]:
        v1: list[tuple[str, int]] = []
        v2: list[tuple[str, int]] = []
        for o in bourses:
            try:
                dl = date.fromisoformat(o["date_limite"])
                ds = date.fromisoformat(o.get("date_scrape") or "")
            except (TypeError, ValueError):
                continue
            cibles = o.get("filieres_cibles") or []
            if filiere not in cibles:
                continue
            generique = engine.est_bourse_generique(o.get("type_offre"), cibles)
            # v1 : la ville était un filtre dur
            if (
                ville != o.get("ville")
                and ville != Ville.AUTRE.value
                and o.get("ville") != Ville.AUTRE.value
            ):
                continue
            v1.append(
                (
                    o["id"],
                    _score_v1(
                        filiere_profil=filiere,
                        filieres_interet=[],
                        filieres_cibles=cibles,
                        ville_profil=ville,
                        ville_offre=o.get("ville") or "",
                        date_scrape=ds,
                        date_limite=dl,
                        bourse_generique=generique,
                    ),
                )
            )
        for o in bourses:
            try:
                dl = date.fromisoformat(o["date_limite"])
                ds = date.fromisoformat(o.get("date_scrape") or "")
            except (TypeError, ValueError):
                continue
            cibles = o.get("filieres_cibles") or []
            if filiere not in cibles:
                continue
            ok, _ = engine.match_regles(
                profil_actif=True,
                offre_active=True,
                date_limite=dl,
                type_offre=o.get("type_offre") or TypeOffre.BOURSE.value,
                types_recherches=[TypeOffre.BOURSE.value],
                filiere_profil=filiere,
                filieres_interet=[],
                filieres_cibles=cibles,
                ville_profil=ville,
                ville_offre=o.get("ville") or "",
                aujourdhui=AUJ,
            )
            if not ok:
                continue
            s = engine.calculer_score_pertinence(
                filiere_profil=filiere,
                filieres_interet=[],
                filieres_cibles=cibles,
                ville_profil=ville,
                ville_offre=o.get("ville") or "",
                date_scrape=ds,
                date_limite=dl,
                bourse_generique=engine.est_bourse_generique(o.get("type_offre"), cibles),
                type_financement_offre=o.get("type_financement"),
                type_offre=o.get("type_offre"),
                aujourdhui=AUJ,
            )
            if s >= engine.SCORE_MIN_PERTINENCE:
                v2.append((o["id"], s))
        v1.sort(key=lambda x: (-x[1], x[0]))
        v2.sort(key=lambda x: (-x[1], x[0]))
        top = [(oid, s1, dict(v2).get(oid, 0)) for oid, s1 in v1[:3]]
        return len(v1), len(v2), top

    for ville in (Ville.NOUAKCHOTT.value, Ville.NOUADHIBOU.value):
        n1, n2, top = eval_profil(ville, Filiere.INFORMATIQUE.value)
        print(
            f"  -> profil informatique / {ville} : v1 {n1} bourses éligibles, "
            f"v2 {n2}"
        )
        for oid, s1, s2 in top:
            print(f"     {oid[:8]}… v1={s1} v2={s2}")
        if ville == Ville.NOUADHIBOU.value:
            check(
                n1 == 0 and n2 > 0,
                f"CORRIGÉ v2 : étudiant de Nouadhibou — {n1} → {n2} bourses éligibles",
            )
        else:
            check(n2 >= 1, f"Nouakchott : {n2} bourses éligibles en v2")

    # Saturation v1 : combien d'offres partagent le score max ?
    s_v1 = [
        _score_v1(
            filiere_profil=Filiere.INFORMATIQUE.value,
            filieres_interet=[],
            filieres_cibles=o.get("filieres_cibles") or [],
            ville_profil=Ville.NOUAKCHOTT.value,
            ville_offre=o.get("ville") or "",
            date_scrape=date.fromisoformat(o.get("date_scrape") or "2026-10-20"),
            date_limite=date.fromisoformat(o["date_limite"]),
            bourse_generique=engine.est_bourse_generique(
                o.get("type_offre"), o.get("filieres_cibles")
            ),
        )
        for o in bourses
        if Filiere.INFORMATIQUE.value in (o.get("filieres_cibles") or [])
    ]
    if s_v1:
        max_v1 = max(s_v1)
        part = sum(1 for s in s_v1 if s == max_v1)
        print(
            f"  -> v1 : {part}/{len(s_v1)} bourses au score maximal {max_v1} "
            "(ex æquo non départageables)"
        )
        check(part >= 2, f"v1 saturait bien le score ({part} ex æquo au maximum)")


# ------------------------------------------------------------ 6. PERFORMANCE
def preuve_performance() -> None:
    print("\n=== 6. PERFORMANCE (coût par paire × volume) ===")
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
    print(f"  -> {par_paire:.1f} µs par paire (match_regles)")

    for profils in (10, 100, 1000, 10000):
        total = profils * 266 * par_paire / 1e6
        print(f"     {profils:>6} profils × 266 offres = {profils*266:>9} paires → {total:7.2f} s")

    check(par_paire < 100, f"coût unitaire acceptable ({par_paire:.1f} µs < 100 µs)")
    check(
        1000 * 266 * par_paire / 1e6 < 30,
        "1000 profils tiennent sous 30 s (marge avant vectorisation)",
    )

    mres = supabase.table("matches").select("profil_id", count="exact").execute()
    nb_matches = mres.count if mres.count is not None else len(mres.data or [])
    print(f"  -> table matches : {nb_matches} lignes")
    check(
        nb_matches < 1000,
        f"lecture complète des matches sûre aujourd'hui ({nb_matches} < 1000 lignes PostgREST)",
    )
    if nb_matches >= 1000:
        print(
            "     ATTENTION : au-delà de 1000, `deja_matchees` devient partiel → doublons"
        )


def main() -> int:
    print("Harnais matching LAWOL.mr — lecture seule")
    offres = _offres_reelles()
    preuve_regles()
    preuve_bareme()
    preuve_donnees(offres)
    preuve_selection()
    preuve_avant_apres(offres)
    preuve_performance()
    ko = [c for c in _checks if not c[0]]
    print(f"\n=== BILAN : {len(_checks) - len(ko)}/{len(_checks)} checks verts ===")
    for _, libelle in ko:
        print(f"  KO : {libelle}")
    return 1 if ko else 0


if __name__ == "__main__":
    sys.exit(main())
