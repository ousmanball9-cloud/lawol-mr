# -*- coding: utf-8 -*-
"""Collecte automatique des offres + matching — pilotable partout.

Usage (local ou CI GitHub Actions) :
    python -X utf8 scripts/collecte_auto.py
    python -X utf8 scripts/collecte_auto.py --sources scholar-africa
    python -X utf8 scripts/collecte_auto.py --skip-matching

Enchaîne : scraping de TOUTES les sources du catalogue (erreurs isolées
par source : une source morte n'arrête pas les autres) puis
run_matching_job() — les nouvelles offres vont donc toutes seules vers
les étudiants dont le profil matche. Idempotent (upsert sur source_url).
"""
import argparse
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))


def main() -> int:
    parser = argparse.ArgumentParser(description="Collecte + matching automatiques")
    parser.add_argument("--sources", help="filtre: noms source_name separes par virgules")
    parser.add_argument("--skip-matching", action="store_true", help="scrape seul")
    args = parser.parse_args()

    from apps.api.app.modules.scraper.sources.catalogue import get_scrapers

    scrapers = get_scrapers()
    if args.sources:
        voulus = {s.strip() for s in args.sources.split(",") if s.strip()}
        scrapers = [s for s in scrapers if s.source_name in voulus]
        if not scrapers:
            print(f"Aucune source nommee parmi {sorted(voulus)}")
            return 1

    resultats: list[tuple[str, str]] = []
    for scraper in scrapers:
        try:
            sortie = scraper.run()
            resultats.append((scraper.source_name, f"ok {sortie}"))
        except Exception as exc:  # noqa: BLE001 — source morte = signalee et passee
            resultats.append((scraper.source_name, f"ERREUR {type(exc).__name__}: {exc}"))

    for nom, statut in resultats:
        print(f"[{statut}] {nom}")

    if not args.skip_matching:
        from apps.api.app.modules.matching.engine import run_matching_job

        resume = run_matching_job()
        print(f"matching: {resume}")

        # Notifications WhatsApp : envoyees si les clés Meta existent, sinon
        # les matches restent en attente (notifie=false) et partiront des que
        # l'app Meta sera configurée — jamais de perte.
        from apps.api.app.core.config import settings

        if settings.META_WHATSAPP_TOKEN and settings.META_PHONE_NUMBER_ID:
            from apps.api.app.modules.whatsapp.notifier import run_notification_job

            print(f"notifications: {run_notification_job()}")
        else:
            print("notifications: skip (cles META_WHATSAPP absentes — matches conserves en attente)")

    echecs = sum(1 for _, s in resultats if s.startswith("ERREUR"))
    print(f"SYNTHESE: {len(resultats) - echecs}/{len(resultats)} sources collectees")
    # Echec que si TOUTES les sources sont mortes (partiel = normal, monitore au log)
    return 1 if echecs == len(resultats) else 0


if __name__ == "__main__":
    raise SystemExit(main())
