"""Mesure lecture seule : pourquoi les 10 matches en attente sont ignorés ?

Ne fait AUCUNE écriture. Lit .env pour l'URL + la clé service (jamais affichées).
"""
from __future__ import annotations

import datetime as dt
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
    url = f"{URL}/rest/v1/{table}?{requete}"
    req = urllib.request.Request(
        url, headers={"apikey": CLE, "Authorization": f"Bearer {CLE}"}
    )
    with urllib.request.urlopen(req, timeout=60) as rep:
        return json.loads(rep.read().decode("utf-8"))


semaine = (dt.date.today() - dt.timedelta(days=7)).isoformat()

matches = get(
    "matches",
    "select=id,score,notifie,date_match,profil_id,"
    "profil:profils(id,prenom,telephone,email,actif,metadata),"
    "offre:offres(titre,date_limite)&notifie=eq.false&limit=50",
)

print(f"matches notifie=false : {len(matches)}\n")
par_profil: dict[str, list] = {}
for m in matches:
    par_profil.setdefault(m["profil_id"], []).append(m)

for pid, lot in par_profil.items():
    p = lot[0]["profil"]
    meta = p.get("metadata") or {}
    envois = get(
        "matches",
        f"select=id&profil_id=eq.{pid}&notifie=eq.true&date_match=gte.{semaine}",
    )
    print(f"profil {pid[:8]} · {p.get('prenom')} · actif={p.get('actif')} · "
          f"tel={'oui' if p.get('telephone') else 'non'} · "
          f"email={'oui' if p.get('email') else 'non'}")
    print(f"  optin_at = {meta.get('optin_at')!r}  -> "
          f"{'OK' if meta.get('optin_at') else 'BLOQUE (garde-fou a)'}")
    print(f"  envois 7 j = {len(envois)} / 5  -> "
          f"{'QUOTA ATTEINT' if len(envois) >= 5 else 'place disponible'}")
    print(f"  matches en attente = {len(lot)}")
    for m in lot[:3]:
        print(f"    - {m['id'][:8]} score={m['score']} "
              f"limite={(m.get('offre') or {}).get('date_limite')} "
              f"titre={(m.get('offre') or {}).get('titre', '')[:45]}")
    print()
