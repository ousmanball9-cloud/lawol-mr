"""Reprise rejouable — recalculer `metadata['categorie_bourse']` pour TOUTES les offres.

Décision (20/10/2026) : l'axe FINANCEUR (`categorie_bourse` dans `metadata` jsonb)
est distinct de l'enum `type_offre` (NATURE). Ce script applique la règle durable
`apps/api/app/modules/scraper/engine.py::categorie_bourse_pour_source` à toutes
les lignes existantes.

Garanties :
    · ne SUPPRIME aucune offre, ne change QUE `metadata['categorie_bourse']` ;
    · idempotent — une seconde exécution ne trouve plus rien à corriger ;
    · PRESERVE toutes les autres clés de `metadata` ;
    · sans argument = DRY-RUN : liste les offres à corriger + répartition avant/après.

Usage :
    python -X utf8 scripts/backfill-categorie.py                  # dry-run (aucune écriture)
    python -X utf8 scripts/backfill-categorie.py --apply          # écrit en base
    python -X utf8 scripts/backfill-categorie.py --source daad    # restreint à une source
"""
from __future__ import annotations

import argparse
import copy
import sys
from collections import Counter
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from apps.api.app.modules.scraper.engine import (
    CATEGORIE_BOURSE_DEFAUT,
    CATEGORIES_BOURSE,
    categorie_bourse_pour_source,
)

PAGE = 1000  # plafond Supabase par requête


def lire_offres(supabase) -> list[dict]:
    """Toutes les offres (paginé) : id, source_name, entreprise, metadata, type_offre."""
    lignes: list[dict] = []
    offset = 0
    while True:
        res = (
            supabase.table("offres")
            .select("id, titre, source_name, entreprise, metadata, type_offre")
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
    """Liste des corrections à appliquer (`id`, source, entreprise, de, vers).

    Une correction = une ligne dont `metadata['categorie_bourse']` courant diffère
    de la règle. La règle ne s'applique qu'aux offres de type `bourse` — les
    offres `emploi_junior` et `stage_pfe` n'ont pas de catégorie de financeur.
    """
    plan: list[dict] = []
    for ligne in lignes:
        source = ligne.get("source_name")
        if filtre_source and source != filtre_source:
            continue

        # Ne recalculer que pour les bourses — les emplois/stages n'ont pas de financeur
        if ligne.get("type_offre") != "bourse":
            continue

        entreprise = ligne.get("entreprise") or ""
        metadata = ligne.get("metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}

        # Valeur actuelle (peut être absente, invalide, ou legacy)
        actuelle = metadata.get("categorie_bourse")
        if not isinstance(actuelle, str) or actuelle.strip().lower() not in CATEGORIES_BOURSE:
            actuelle = CATEGORIE_BOURSE_DEFAUT
        else:
            actuelle = actuelle.strip().lower()

        # Valeur correcte selon la règle (titre inclus : les agrégateurs ne
        # nomment le financeur que dans l'intitulé)
        vers = categorie_bourse_pour_source(source, entreprise, ligne.get("titre") or "")

        if vers != actuelle:
            plan.append(
                {
                    "id": ligne.get("id"),
                    "source_name": source,
                    "entreprise": entreprise,
                    "de": actuelle,
                    "vers": vers,
                    "metadata_actuel": metadata,
                }
            )
    return plan


def compter(lignes: list[dict]) -> Counter:
    """Compte les catégories de bourse actuelles (toutes offres, même non-bourses)."""
    compteur = Counter()
    for ligne in lignes:
        metadata = ligne.get("metadata") or {}
        if not isinstance(metadata, dict):
            compteur[CATEGORIE_BOURSE_DEFAUT] += 1
            continue
        val = metadata.get("categorie_bourse")
        if isinstance(val, str) and val.strip().lower() in CATEGORIES_BOURSE:
            compteur[val.strip().lower()] += 1
        else:
            compteur[CATEGORIE_BOURSE_DEFAUT] += 1
    return compteur


def _afficher_comptes(titre: str, comptes: Counter) -> None:
    total = sum(comptes.values())
    details = ", ".join(f"{k}={n}" for k, n in comptes.most_common())
    print(f"{titre} : total={total} ({details})")


def _afficher_repartition_par_source(plan: list[dict]) -> None:
    """Affiche le nombre de corrections par source."""
    par_source = Counter(p["source_name"] for p in plan)
    print(f"\nCorrections par source ({len(plan)} offre(s) au total) :")
    for s, n in par_source.most_common():
        print(f"  - source={s!r:30} n={n}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Recalcule metadata['categorie_bourse'] par source (rejouable, idempotent)"
    )
    parser.add_argument("--apply", action="store_true", help="écrit réellement en base")
    parser.add_argument("--source", help="ne traiter qu'une source_name")
    args = parser.parse_args(argv)

    from apps.api.app.core.database import supabase

    lignes = lire_offres(supabase)
    print(f"offres lues : {len(lignes)}")
    avant = compter(lignes)
    _afficher_comptes("AVANT ", avant)

    plan = planifier(lignes, args.source)
    _afficher_repartition_par_source(plan)

    if not plan:
        print("\nRien à corriger (idempotent).")
        return 0

    if not args.apply:
        print("\n--- DRY-RUN : liste des offres à corriger ---")
        for p in plan:
            ent = p["entreprise"][:60] if p["entreprise"] else "(vide)"
            print(f"  [{p['id']}] source={p['source_name']:30} : {p['de']:15} → {p['vers']:15}  organisme={ent}")

        # Simuler l'après
        apres = Counter(avant)
        for p in plan:
            apres[p["de"]] -= 1
            apres[p["vers"]] += 1
        _afficher_comptes("\nAPRÈS (simulé)", apres)
        print("\nDRY-RUN : aucune écriture. Relancer avec --apply pour appliquer.")
        return 0

    # Mode réel : écrit uniquement metadata['categorie_bourse'], préserve le reste
    ecrits = 0
    for p in plan:
        # Reconstruire metadata complet : on part de l'existant et on ne change QUE la clé cible
        nouveau_metadata = copy.deepcopy(p["metadata_actuel"])
        if not isinstance(nouveau_metadata, dict):
            nouveau_metadata = {}
        nouveau_metadata["categorie_bourse"] = p["vers"]

        res = (
            supabase.table("offres")
            .update({"metadata": nouveau_metadata})
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