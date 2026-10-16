"""Reprise rejouable — re-classer `type_offre` des offres déjà en base par source.

Décision produit (16/10/2026) : le catalogue public est « 100 % bourses ». Des
offres issues d'une source d'EMPLOI (portail beta.mr, LinkedIn, sites carrières
d'entreprises) ont été étiquetées `bourse` à tort et polluaient le site. Ce
script les re-type selon la règle durable `apps/api/app/modules/scraper/engine.py` :

    source d'emploi + intitulé « stage » → `stage_pfe`
    source d'emploi (sinon)              → `emploi_junior`
    toute autre source                   → `bourse` (inchangée)

Garanties :
    · ne SUPPRIME aucune offre, ne change QUE `type_offre` ;
    · idempotent — une seconde exécution ne trouve plus rien à corriger ;
    · sans argument = DRY-RUN : liste les offres à corriger + comptes avant/après.

Usage :
    python -X utf8 scripts/backfill-type-offre.py                  # dry-run (aucune écriture)
    python -X utf8 scripts/backfill-type-offre.py --apply          # écrit en base
    python -X utf8 scripts/backfill-type-offre.py --source beta_mr # restreint à une source
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from apps.api.app.modules.scraper.engine import (
    est_source_emploi,
    type_offre_pour_source,
)

PAGE = 1000  # plafond Supabase par requête


def lire_offres(supabase) -> list[dict]:
    """Toutes les offres (paginé) : id, source, titre, description, type courant."""
    lignes: list[dict] = []
    offset = 0
    while True:
        res = (
            supabase.table("offres")
            .select("id, source_name, titre, description, type_offre")
            .order("id")
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        lot = res.data or []
        lignes.extend(lot)
        if len(lot) < PAGE:
            return lignes
        offset += PAGE


def planifier(lignes: list[dict], filtre_source: str | None = None) -> list[dict]:
    """Liste des corrections à appliquer (`id`, source, titre, de, vers).

    Une correction = une ligne dont le `type_offre` courant diffère de la règle.
    Aucune entrée si `source_name` ∉ sources d'emploi et type déjà `bourse`
    (le cas bourse est idempotent : on ne touche pas aux bourses légitimes).
    """
    plan: list[dict] = []
    for ligne in lignes:
        source = ligne.get("source_name")
        if filtre_source and source != filtre_source:
            continue
        titre = ligne.get("titre") or ""
        vers = type_offre_pour_source(source, titre, ligne.get("description") or "")
        de = ligne.get("type_offre")
        if vers != de:
            plan.append(
                {
                    "id": ligne.get("id"),
                    "source_name": source,
                    "titre": titre,
                    "de": de,
                    "vers": vers,
                }
            )
    return plan


def compter(lignes: list[dict]) -> Counter:
    return Counter(ligne.get("type_offre") for ligne in lignes)


def _afficher_comptes(titre: str, comptes: Counter) -> None:
    total = sum(comptes.values())
    details = ", ".join(f"{k}={n}" for k, n in comptes.most_common())
    print(f"{titre} : total={total} ({details})")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Re-classe type_offre par source (rejouable)")
    parser.add_argument("--apply", action="store_true", help="écrit réellement en base")
    parser.add_argument("--source", help="ne traiter qu'une source_name")
    args = parser.parse_args(argv)

    from apps.api.app.core.database import supabase

    lignes = lire_offres(supabase)
    print(f"offres lues : {len(lignes)}")
    avant = compter(lignes)
    _afficher_comptes("AVANT ", avant)

    plan = planifier(lignes, args.source)
    par_source = Counter(p["source_name"] for p in plan)
    print(f"\nà re-typer : {len(plan)} offre(s)")
    for s, n in par_source.most_common():
        emploi = est_source_emploi(s)
        print(f"  - source={s!r:22} n={n} (source d'emploi={emploi})")

    if not plan:
        print("\nRien à corriger (idempotent).")
        return 0

    if not args.apply:
        print("\n--- DRY-RUN : liste des offres à corriger ---")
        for p in plan:
            print(f"  [{p['id']}] {p['source_name']} : {p['de']} → {p['vers']}  « {p['titre'][:80]} »")
        apres = Counter(avant)
        for p in plan:
            apres[p["de"]] -= 1
            apres[p["vers"]] += 1
        _afficher_comptes("\nAPRÈS (simulé)", apres)
        print("\nDRY-RUN : aucune écriture. Relancer avec --apply pour appliquer.")
        return 0

    # Mode réel : écrit uniquement `type_offre`, jamais de suppression.
    ecrits = 0
    for p in plan:
        res = (
            supabase.table("offres")
            .update({"type_offre": p["vers"]})
            .eq("id", p["id"])
            .execute()
        )
        if res.data:
            ecrits += 1
        else:
            print(f"  ⚠️ non écrit : {p['id']}")

    apres_reel = compter(lire_offres(supabase))
    _afficher_comptes("\nAPRÈS (réel) ", apres_reel)
    print(f"\nécrites : {ecrits}/{len(plan)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
