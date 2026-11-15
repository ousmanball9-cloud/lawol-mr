"""Déclenche l'émission réelle des matches — jeton lu depuis .env, jamais affiché.

Usage : python scripts/emission-live.py [run|deadlines]
Sortie : code HTTP + corps JSON. Aucun secret imprimé (longueur + sha256[:12]).
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "https://lawol-api.onrender.com"
ENV = pathlib.Path(".env")


def lire_jeton() -> str:
    for ligne in ENV.read_text(encoding="utf-8", errors="replace").splitlines():
        ligne = ligne.strip()
        if ligne.startswith("ADMIN_PASSWORD_HASH="):
            valeur = ligne.split("=", 1)[1].strip()
            return valeur.strip('"').strip("'")
    raise SystemExit("ADMIN_PASSWORD_HASH introuvable dans .env")


def appel(chemin: str, jeton: str, timeout: int = 280) -> int:
    requete = urllib.request.Request(
        BASE + chemin,
        method="POST",
        data=b"",
        headers={"x-admin-token": jeton, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(requete, timeout=timeout) as rep:
            corps = rep.read().decode("utf-8", "replace")
            print(f"HTTP {rep.status}")
            print(json.dumps(json.loads(corps), ensure_ascii=False, indent=1))
            return 0
    except urllib.error.HTTPError as exc:
        corps = exc.read().decode("utf-8", "replace")[:600]
        print(f"HTTP {exc.code} — {corps}")
        return 1
    except Exception as exc:  # noqa: BLE001 — réseau / timeout
        print(f"ERREUR {type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    cible = sys.argv[1] if len(sys.argv) > 1 else "run"
    chemins = {
        "run": "/api/v1/notifications/run",
        "deadlines": "/api/v1/notifications/deadlines",
    }
    if cible not in chemins:
        raise SystemExit(f"cible inconnue : {cible}")
    jeton = lire_jeton()
    empreinte = hashlib.sha256(jeton.encode()).hexdigest()[:12]
    print(f"jeton : {len(jeton)} car, sha256[:12]={empreinte}")
    print(f"POST {BASE}{chemins[cible]}")
    sys.exit(appel(chemins[cible], jeton))
