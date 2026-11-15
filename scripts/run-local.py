"""Rejoue le job d'émission en LOCAL pour voir les traces d'erreur réelles.

L'endpoint distant répond 502 sans corps : impossible de savoir quel canal
échoue. Ce script charge `.env` AVANT d'importer les modules (settings est lu
à l'import), puis appelle `run_notification_job()` en affichant chaque échec.

⚠️ Écrit en base (marque notifie=true) et envoie de vrais messages : même
effet que l'endpoint, mais avec les traces.

Usage : python scripts/run-local.py [run|deadlines]
"""
from __future__ import annotations

import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RACINE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))


def charger_env() -> int:
    """Injecte .env dans os.environ (sans écraser une var déjà posée)."""
    import os

    chemin = RACINE / ".env"
    if not chemin.exists():
        raise SystemExit("pas de .env")
    n = 0
    for ligne in chemin.read_text(encoding="utf-8", errors="replace").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        cle, valeur = ligne.split("=", 1)
        cle = cle.strip()
        valeur = valeur.strip().strip('"').strip("'")
        if cle and cle not in os.environ:
            os.environ[cle] = valeur
            n += 1
    return n


charges = charger_env()
print(f".env : {charges} variable(s) chargée(s)")

from apps.api.app.modules.notifications.canal import (  # noqa: E402
    email_api_configure,
    whatsapp_configure,
)
from apps.api.app.modules.notifications.email_sender import email_configure  # noqa: E402
from apps.api.app.modules.whatsapp import notifier  # noqa: E402

print(f"canaux locaux — whatsapp={whatsapp_configure()} "
      f"smtp={email_configure()} api_email={email_api_configure()}\n")

cible = sys.argv[1] if len(sys.argv) > 1 else "run"
if cible == "deadlines":
    stats = notifier.run_deadline_job()
else:
    stats = notifier.run_notification_job()

print("\n--- STATS ---")
for cle, valeur in stats.items():
    print(f"  {cle} = {valeur}")
