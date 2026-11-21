#!/usr/bin/env python3
"""Backfill de `offres.metadata['origine_eligible']` (contrat §2.2, lot V4-D).

Usage :
    python scripts/backfill-origine.py              # dry-run (defaut) : mesure + echantillon
    python scripts/backfill-origine.py --apply      # ecrit dans Supabase
    python scripts/backfill-origine.py --limite 20  # taille de l'echantillon affiche

Perimetre : les offres SERVIES aujourd'hui (actives + `date_limite` future),
soit 313 lignes mesurees le 20/11/2026 — une offre close n'est vue par aucun
eleve : la remplir ne prouverait rien.

Regles :
- n'ecrit QUE `metadata.origine_eligible`, en FUSION (les autres cles sont
  preservees) ;
- n'ecrase jamais une valeur deja CONFORME au contrat (`origine_stockee`) ;
- remplace une valeur stockee NON conforme (elle ne doit pas rester : `inconnu`
  ou une preuve absente ne sont pas affichables) ;
- aucune suppression, aucune autre colonne touchee ;
- aucun indice devine : tout vient de `origine_depuis_texte` (gardes du harnais
  `scripts/test-origine-eligible.py`). Jamais d'`incompatible` deduit : le
  silence du texte reste un silence.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.api.app.modules.matching.extraction import (
    _texte_offre,
    origine_depuis_texte,
    origine_stockee,
)

PAGE = 1000


def lignes() -> list[dict]:
    from apps.api.app.core.database import supabase

    aujourdhui = datetime.now(timezone.utc).date().isoformat()
    sortie: list[dict] = []
    offset = 0
    while True:
        reponse = (
            supabase.table("offres")
            .select("id, titre, description, source_name, metadata")
            .eq("active", True)
            .gte("date_limite", aujourdhui)
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        lot = reponse.data or []
        sortie.extend(lot)
        if len(lot) < PAGE:
            break
        offset += PAGE
    return sortie


def main() -> int:
    # Console Windows cp1252 : un titre non latin ferait tomber le dry-run.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Backfill metadata.origine_eligible")
    parser.add_argument("--apply", action="store_true", help="ecrit en base (sinon dry-run)")
    parser.add_argument("--limite", type=int, default=15, help="taille de l'echantillon")
    args = parser.parse_args()

    offres = lignes()
    a_ecrire: list[tuple[dict, dict]] = []
    conformes = 0
    non_conformes = 0
    for offre in offres:
        meta = offre.get("metadata")
        meta = meta if isinstance(meta, dict) else {}
        if origine_stockee(meta):
            conformes += 1
            continue
        if "origine_eligible" in meta:
            non_conformes += 1
        indice = origine_depuis_texte(_texte_offre(offre))
        if indice:
            a_ecrire.append((offre, indice))

    total = len(offres)
    pourcentage = (100.0 * len(a_ecrire) / total) if total else 0.0
    print(f"Lignes lues           : {total} (actives, date_limite future)")
    print(f"Deja conformes        : {conformes}")
    print(f"Indices extraits      : {len(a_ecrire)} ({pourcentage:.1f} % du total)")
    print(f"Dont valeurs non conformes remplacees : {non_conformes}")
    print(
        "Indice / preuve       : "
        f"{dict(Counter(f'{i['indice']}/{i['preuve']}' for _, i in a_ecrire))}"
    )
    sources = Counter((o.get("source_name") or "?") for o, _ in a_ecrire)
    print(f"Sources               : {sources.most_common(6)}")
    print()
    print(f"Echantillon ({min(args.limite, len(a_ecrire))}) :")
    for offre, indice in a_ecrire[: args.limite]:
        titre = " ".join((offre.get("titre") or "").split())[:74]
        print(f"  [{indice['indice']:<10} {indice['preuve']:<6}] {titre}")

    if not args.apply:
        print("\nDRY-RUN : rien n'a ete ecrit. Relancer avec --apply pour ecrire.")
        return 0

    from apps.api.app.core.database import supabase

    ecrits = 0
    for offre, indice in a_ecrire:
        meta = offre.get("metadata")
        meta = dict(meta) if isinstance(meta, dict) else {}
        meta["origine_eligible"] = indice
        supabase.table("offres").update({"metadata": meta}).eq("id", offre["id"]).execute()
        ecrits += 1
    print(f"\nAPPLY : {ecrits} offres mises a jour (cle 'origine_eligible' uniquement, en fusion).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
