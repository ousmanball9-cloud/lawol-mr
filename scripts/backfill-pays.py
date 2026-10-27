#!/usr/bin/env python3
"""Backfill du pays d'études pour les offres existantes.

Usage:
    python scripts/backfill-pays.py --dry-run    # par défaut : liste ce qui serait fait
    python scripts/backfill-pays.py --apply      # écrit en base

Règles :
- Ne met à jour QUE les offres où pays_etudes IS NULL
- Utilise pays_depuis_texte(titre, description, source_url)
- Aucune suppression, aucun écrasement d'un pays déjà renseigné
"""
import argparse
import sys
from pathlib import Path

# Ajouter le répertoire racine au path pour imports
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.api.app.core.database import supabase
from apps.api.app.modules.scraper.pays import pays_depuis_texte


def main():
    parser = argparse.ArgumentParser(description="Backfill pays_etudes")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Ne fait que lister (défaut)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Écrit les modifications en base",
    )
    args = parser.parse_args()

    if args.apply:
        args.dry_run = False

    print("=" * 60)
    print("BACKFILL PAYS_ETUDES")
    print("=" * 60)
    mode = "DRY-RUN (lecture seule)" if args.dry_run else "APPLY (écriture)"
    print(f"Mode: {mode}")

    # Récupérer les offres sans pays_etudes
    # On filtre côté Python car Supabase ne permet pas facilement "IS NULL" sur colonne enum
    # On récupère par batchs
    page_size = 1000
    offset = 0
    total_traitees = 0
    total_maj = 0
    total_sans_indice = 0
    total_deja_renseigne = 0

    while True:
        resp = supabase.table("offres").select(
            "id, titre, description, source_url, pays_etudes"
        ).range(offset, offset + page_size - 1).execute()

        if not resp.data:
            break

        batch = resp.data
        print(f"\n--- Batch {offset//page_size + 1} : {len(batch)} offres ---")

        for offre in batch:
            total_traitees += 1
            pays_actuel = offre.get("pays_etudes")

            if pays_actuel:
                total_deja_renseigne += 1
                continue

            titre = offre.get("titre") or ""
            description = offre.get("description") or ""
            source_url = offre.get("source_url") or ""

            pays_detecte = pays_depuis_texte(titre, description, source_url)

            if pays_detecte is None:
                total_sans_indice += 1
                continue

            total_maj += 1
            print(f"  + {offre['id'][:8]}... | {pays_detecte.value} | {titre[:60]}")

            if not args.dry_run:
                # Mise à jour en base
                try:
                    supabase.table("offres").update(
                        {"pays_etudes": pays_detecte.value}
                    ).eq("id", offre["id"]).execute()
                except Exception as e:  # noqa: BLE001
                    print(f"  Erreur MAJ {offre['id']}: {e}")
                    total_maj -= 1

        offset += page_size

    print("\n" + "=" * 60)
    print("RÉSUMÉ")
    print("=" * 60)
    print(f"Offres traitées      : {total_traitees}")
    print(f"Déjà renseignées    : {total_deja_renseigne}")
    print(f"Sans indice détecté : {total_sans_indice}")
    print(f"À mettre à jour     : {total_maj}")
    if args.dry_run:
        print("\n/!\\ Mode DRY-RUN : aucune écriture effectuée.")
        print("   Relancez avec --apply pour appliquer.")
    else:
        print(f"\nOK {total_maj} offre(s) mise(s) a jour en base.")


if __name__ == "__main__":
    main()