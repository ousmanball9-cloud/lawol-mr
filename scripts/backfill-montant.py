#!/usr/bin/env python3
"""Backfill de `offres.metadata['montant']` (contrat §2.1, lot V4-B).

Usage :
    python scripts/backfill-montant.py              # dry-run (defaut) : mesure + echantillon
    python scripts/backfill-montant.py --apply      # ecrit dans Supabase
    python scripts/backfill-montant.py --limite 20  # taille de l'echantillon affiche

Regles :
- n'ecrit QUE `metadata.montant`, en FUSION (les autres cles sont preservees) ;
- n'ecrase jamais une valeur deja CONFORME au contrat ;
- remplace une valeur stockee NON conforme (elle ne doit pas rester) ;
- aucune suppression, aucune autre colonne touchee ;
- aucun montant devine : tout vient de `montant_depuis_texte` (gardes du harnais
  `scripts/test-montant.py`).
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.api.app.modules.matching.extraction import (
    _texte_offre,
    montant_depuis_texte,
)

PAGE = 1000


def lignes() -> list[dict]:
    from apps.api.app.core.database import supabase

    sortie: list[dict] = []
    offset = 0
    while True:
        reponse = (
            supabase.table("offres")
            .select("id, titre, description, source_name, metadata")
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        lot = reponse.data or []
        sortie.extend(lot)
        if len(lot) < PAGE:
            break
        offset += PAGE
    return sortie


def deja_conforme(meta: dict) -> bool:
    stocke = meta.get("montant")
    if not isinstance(stocke, dict):
        return False
    valeur = stocke.get("valeur")
    return (
        isinstance(valeur, (int, float))
        and not isinstance(valeur, bool)
        and valeur > 0
        and isinstance(stocke.get("devise"), str)
        and len(stocke["devise"]) == 3
        and stocke.get("periode") in ("mois", "an", "total")
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill metadata.montant")
    parser.add_argument("--apply", action="store_true", help="ecrit en base (sinon dry-run)")
    parser.add_argument("--limite", type=int, default=15, help="taille de l'echantillon")
    args = parser.parse_args()

    offres = lignes()
    a_ecrire: list[tuple[dict, dict]] = []
    conformes = 0
    for offre in offres:
        meta = offre.get("metadata")
        meta = meta if isinstance(meta, dict) else {}
        if deja_conforme(meta):
            conformes += 1
            continue
        montant = montant_depuis_texte(_texte_offre(offre))
        if montant:
            a_ecrire.append((offre, montant))

    print(f"Lignes lues           : {len(offres)}")
    print(f"Deja conformes        : {conformes}")
    print(f"Montants extraits     : {len(a_ecrire)} "
          f"({100.0 * len(a_ecrire) / len(offres):.1f} % du total)")
    print(f"Periode               : {dict(Counter(m['periode'] for _, m in a_ecrire))}")
    print(f"Devise                : {dict(Counter(m['devise'] for _, m in a_ecrire))}")
    sources = Counter((o.get('source_name') or '?') for o, _ in a_ecrire)
    print(f"Sources               : {sources.most_common(6)}")
    print()
    print(f"Echantillon ({min(args.limite, len(a_ecrire))}) :")
    for offre, montant in a_ecrire[: args.limite]:
        titre = " ".join((offre.get("titre") or "").split())[:74]
        print(f"  [{montant['devise']} {montant['periode']:<5} {montant['valeur']:>10}] {titre}")

    if not args.apply:
        print("\nDRY-RUN : rien n'a ete ecrit. Relancer avec --apply pour ecrire.")
        return 0

    from apps.api.app.core.database import supabase

    ecrits = 0
    for offre, montant in a_ecrire:
        meta = offre.get("metadata")
        meta = dict(meta) if isinstance(meta, dict) else {}
        meta["montant"] = montant
        supabase.table("offres").update({"metadata": meta}).eq("id", offre["id"]).execute()
        ecrits += 1
    print(f"\nAPPLY : {ecrits} offres mises a jour (cle 'montant' uniquement, en fusion).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
