#!/usr/bin/env python3
"""Backfill de `offres.metadata['calendrier']` et `['dates_par_pays']` (lot V4-G).

Contrat de reference : docs/contrat-metadata-offres.md §2.3 / §2.4.

Usage :
    python -X utf8 scripts/backfill-calendrier.py             # dry-run (defaut)
    python -X utf8 scripts/backfill-calendrier.py --apply     # ecrit dans Supabase
    python -X utf8 scripts/backfill-calendrier.py --limite 20 # taille de l'echantillon

Regles :
- n'ecrit QUE les cles `calendrier` / `dates_par_pays`, en FUSION (les autres
  cles de `metadata` sont preservees — contrat §3 invariant 1) ;
- n'ecrase jamais une valeur deja CONFORME (idempotence, §3 invariant 4) ;
- jamais une date devinee : tout vient de `calendrier_depuis_texte` /
  `dates_par_pays_depuis_texte` (gardes du harnais `scripts/test-calendrier.py`) ;
- une etape datée dans le PASSE n'est pas ecrite : un parcours deja termine
  n'aide aucun candidat et trahit souvent deux cycles melanges.

Mesure du 16/11/2026 (321 offres actives) : 8 calendriers extractibles, 0
`dates_par_pays` — la donnee par pays n'existe pas dans ce catalogue.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.api.app.modules.matching.extraction import (
    _texte_offre,
    calendrier_depuis_texte,
    calendrier_stocke,
    dates_par_pays_depuis_texte,
    dates_par_pays_stocke,
)

PAGE = 1000


def lignes() -> list[dict]:
    from apps.api.app.core.database import supabase

    sortie: list[dict] = []
    offset = 0
    while True:
        reponse = (
            supabase.table("offres")
            .select("id, titre, description, source_name, active, date_limite, metadata")
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        lot = reponse.data or []
        sortie.extend(lot)
        if len(lot) < PAGE:
            break
        offset += PAGE
    return sortie


def planifier(
    offres: list[dict], aujourd_hui: date | None = None
) -> tuple[list[dict], Counter]:
    """Corrections a ecrire + compteurs de refus. Aucune I/O, donc testable.

    Une correction = `{id, source_name, titre, metadata}` ou `metadata` est le
    dict FUSIONNE (existant + cles nouvelles). Aucune entree si les cles deja
    presentes sont conformes : c'est l'idempotence.
    """
    reference = aujourd_hui or datetime.now(timezone.utc).date()
    refus: Counter = Counter()
    plan: list[dict] = []

    for offre in offres:
        meta = offre.get("metadata")
        meta = dict(meta) if isinstance(meta, dict) else {}
        texte = _texte_offre(offre)
        nouvelle = dict(meta)
        change = False

        if calendrier_stocke(meta) is None:
            calendrier = calendrier_depuis_texte(texte)
            if calendrier:
                if calendrier[0]["date"] < reference.isoformat():
                    refus["calendrier deja termine"] += 1
                else:
                    nouvelle["calendrier"] = calendrier
                    change = True
            else:
                refus["moins de 2 etapes datees"] += 1
        else:
            refus["calendrier deja conforme"] += 1

        if dates_par_pays_stocke(meta) is None:
            par_pays = dates_par_pays_depuis_texte(texte)
            if par_pays:
                nouvelle["dates_par_pays"] = par_pays
                change = True
            else:
                refus["aucune echeance par pays"] += 1
        else:
            refus["dates_par_pays deja conforme"] += 1

        if change:
            plan.append(
                {
                    "id": offre.get("id"),
                    "source_name": offre.get("source_name"),
                    "titre": offre.get("titre") or "",
                    "metadata": nouvelle,
                }
            )
    return plan, refus


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backfill metadata.calendrier / dates_par_pays")
    parser.add_argument("--apply", action="store_true", help="ecrit en base (sinon dry-run)")
    parser.add_argument("--limite", type=int, default=15, help="taille de l'echantillon")
    args = parser.parse_args(argv)

    offres = lignes()
    actives = [o for o in offres if o.get("active", True)]
    plan, refus = planifier(offres)

    print(f"Lignes lues           : {len(offres)} (dont actives : {len(actives)})")
    print(f"A ecrire              : {len(plan)} offre(s)")
    print(f"Calendriers           : {sum(1 for p in plan if 'calendrier' in p['metadata'])}")
    print(
        "Dates par pays        : "
        f"{sum(1 for p in plan if 'dates_par_pays' in p['metadata'])}"
    )
    print(f"Refus (comptes)       : {dict(refus)}")
    print()
    print(f"Echantillon ({min(args.limite, len(plan))}) :")
    for entree in plan[: args.limite]:
        etapes = ", ".join(
            f"{e['etape']}={e['date']}" for e in entree["metadata"].get("calendrier", [])
        )
        titre = " ".join(entree["titre"].split())[:60]
        print(f"  [{entree['source_name']}] {titre}")
        print(f"      {etapes or entree['metadata'].get('dates_par_pays')}")

    if not args.apply:
        print("\nDRY-RUN : rien n'a ete ecrit. Relancer avec --apply pour ecrire.")
        return 0

    if not plan:
        print("\nAPPLY : rien a ecrire (idempotent).")
        return 0

    from apps.api.app.core.database import supabase

    ecrits = 0
    for entree in plan:
        supabase.table("offres").update({"metadata": entree["metadata"]}).eq(
            "id", entree["id"]
        ).execute()
        ecrits += 1
    print(f"\nAPPLY : {ecrits} offres mises a jour (cles du lot uniquement, en fusion).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
