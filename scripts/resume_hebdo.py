"""Résumé hebdomadaire par email — CLI (Railway, Actions ou machine locale).

Usage :
    python -X utf8 scripts/resume_hebdo.py                 # SIMULATION (défaut)
    python -X utf8 scripts/resume_hebdo.py --apply         # envoie réellement
    python -X utf8 scripts/resume_hebdo.py --today=2026-10-26 --apply
    python -X utf8 scripts/resume_hebdo.py --limite=50

Pourquoi la simulation est le défaut : cette commande écrit dans
`profils.metadata` et envoie des emails. Un `--apply` oublié sur un poste de
dev enverrait un résumé à tous les étudiants. L'envoi réel doit toujours être
demandé explicitement (le workflow hebdomadaire, lui, le demande).

La logique vit dans `apps/api/app/modules/notifications/resume_hebdo.py` : ce
script n'est qu'un déclencheur, comme l'endpoint admin
`POST /api/v1/notifications/resume-hebdo`.
"""
import argparse
import sys
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))


def main() -> int:
    parser = argparse.ArgumentParser(description="Résumé hebdomadaire par email")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="envoie réellement (défaut : simulation, aucune écriture)",
    )
    parser.add_argument("--today", help="date de référence AAAA-MM-JJ (tests)")
    parser.add_argument(
        "--limite", type=int, default=500, help="nombre maximum de profils traités"
    )
    args = parser.parse_args()

    from apps.api.app.modules.notifications.resume_hebdo import run_resume_hebdo

    jour = date.fromisoformat(args.today) if args.today else None
    bilan = run_resume_hebdo(aujourdhui=jour, appliquer=args.apply, limite=args.limite)

    print(f"résumé hebdo · semaine {bilan['semaine']} · mode {bilan['mode']}")
    print(
        f"profils {bilan['profils']} | envoyés {bilan['envoyes']} | "
        f"sans nouveauté {bilan['sans_nouveaute']} | "
        f"déjà servis {bilan['deja_servis']} | erreurs {bilan['erreurs']}"
    )
    for detail in bilan["details"]:
        extra = ""
        if detail.get("offres") is not None:
            extra = f" · {detail['offres']} offre(s)"
        if detail.get("erreur"):
            extra = f" · {detail['erreur']}"
        print(f"  [{detail['etat']}] {detail['profil']}{extra}")

    if not args.apply:
        print("\nsimulation : aucune écriture, aucun email. Relancer avec --apply.")

    # Un profil en erreur n'invalide pas le run (il repartira), mais on le
    # signale par un code retour non nul pour que la CI le montre.
    return 1 if bilan["erreurs"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
