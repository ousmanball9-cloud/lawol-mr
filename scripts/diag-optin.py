"""Mesure lecture seule du consentement réel des profils actifs.

Deux sources coexistent : la colonne `optin_texte` (exigée à l'inscription) et
`metadata.optin_at` (lue par le notifier). Ce script dit laquelle est remplie.
"""
from __future__ import annotations

import json
import pathlib
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ENV = pathlib.Path(".env")


def env(cle: str) -> str:
    for ligne in ENV.read_text(encoding="utf-8", errors="replace").splitlines():
        ligne = ligne.strip()
        if ligne.startswith(cle + "="):
            return ligne.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f"{cle} introuvable dans .env")


URL = env("SUPABASE_URL").rstrip("/")
CLE = env("SUPABASE_SERVICE_ROLE_KEY")


def get(table: str, requete: str) -> list[dict]:
    req = urllib.request.Request(
        f"{URL}/rest/v1/{table}?{requete}",
        headers={"apikey": CLE, "Authorization": f"Bearer {CLE}"},
    )
    with urllib.request.urlopen(req, timeout=60) as rep:
        return json.loads(rep.read().decode("utf-8"))


profils = get(
    "profils",
    "select=id,prenom,telephone,email,actif,optin_texte,metadata&order=created_at.desc&limit=20",
)

print(f"profils lus : {len(profils)}\n")
consentants = 0
for p in profils:
    meta = p.get("metadata") or {}
    texte = (p.get("optin_texte") or "").strip()
    if p.get("actif") and texte:
        consentants += 1
    print(f"{p['id'][:8]} · {p.get('prenom')} · actif={p.get('actif')} · "
          f"optin_texte={'oui' if texte else 'VIDE'} ({len(texte)} car) · "
          f"metadata.optin_at={'oui' if meta.get('optin_at') else 'ABSENT'}")

print(f"\nactifs avec consentement texte : {consentants}")
print("attendu : notifier doit servir ces profils (garde-fou a)")
