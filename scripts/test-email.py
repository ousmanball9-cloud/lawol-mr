# -*- coding: utf-8 -*-
"""ENVOI RÉEL d'un email de test (Lot E) — à lancer SEULEMENT quand les
identifiants SMTP sont renseignés dans lawol-mr/.env.

Ne pas exécuter tant que SMTP_HOST / SMTP_USER / SMTP_PASSWORD / EMAIL_FROM
sont vides : le script refuse de partir (anti relais ouvert + zéro cred en dur).

Usage :
    python -X utf8 scripts/test-email.py adresse@exemple.mr
    ou  EMAIL_TEST_DEST=adresse@exemple.mr python -X utf8 scripts/test-email.py

Le destinataire DOIT être fourni explicitement (argument ou env) — aucun
envoi à une adresse déduite, aucune liste.
"""
import os
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

# Charge lawol-mr/.env (python-dotenv, déjà utilisé par app.core.config)
try:
    from dotenv import load_dotenv

    load_dotenv(RACINE / ".env")
except ImportError:  # pragma: no cover — les vars peuvent venir du shell
    pass

from apps.api.app.modules.notifications.email_sender import (  # noqa: E402
    email_configure,
    envoyer_email,
    valider_email,
)


def main() -> int:
    cible = sys.argv[1] if len(sys.argv) > 1 else (os.getenv("EMAIL_TEST_DEST") or "").strip()
    if not valider_email(cible):
        print(
            "ABANDON : destinataire absent ou invalide.\n"
            "  Fournis une adresse : python scripts/test-email.py toto@exemple.mr\n"
            "  ou EMAIL_TEST_DEST=toto@exemple.mr (aucun envoi sans destination explicite)"
        )
        return 2

    if not email_configure():
        print(
            "ABANDON : SMTP non configuré.\n"
            "  Renseigne SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD,\n"
            "  EMAIL_FROM et EMAIL_FROM_NAME dans lawol-mr/.env (voir .env.example)."
        )
        return 2

    sujet = "LAWOL.mr — test d'envoi (Lot E)"
    corps = (
        "Ceci est un email de test du canal de repli LAWOL.mr.\n"
        "Si vous le lisez, le SMTP fonctionne de bout en bout.\n"
    )
    try:
        res = envoyer_email(cible, sujet, corps)
    except Exception as exc:  # noqa: BLE001 — rapport complet de l'échec
        print(f"ECHEC : {type(exc).__name__}: {exc}")
        return 1

    print(f"ENVOI REUSSI : {res}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
