"""Clôture des offres expirées — CLI (`--dry-run` par défaut).

Usage :
    python -X utf8 scripts/cloture_offres.py            # simulation, n'écrit rien
    python -X utf8 scripts/cloture_offres.py --apply    # clôture réellement
"""
import argparse
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))


def main() -> int:
    parser = argparse.ArgumentParser(description="Clôture des offres expirées")
    parser.add_argument("--apply", action="store_true", help="écrit active=false")
    args = parser.parse_args()

    from apps.api.app.modules.shared.cycle_vie import cloturer_offres_expirees

    rapport = cloturer_offres_expirees(appliquer=args.apply)
    mode = "SIMULATION" if rapport["simulation"] else "APPLIQUE"
    print(
        f"[{mode}] offres expirées encore actives : {rapport['examinees']} | "
        f"clôturées : {rapport['cloturees']} | échecs : {rapport['echecs']}"
    )
    for detail in rapport["echecs_detail"][:5]:
        print(f"  ⚠️ {detail}")
    if rapport["simulation"] and rapport["examinees"]:
        print("  -> relancer avec --apply pour clôturer")
    return 0 if rapport["echecs"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
