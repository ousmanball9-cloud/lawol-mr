"""Preuve post-émission : combien de matches valides restent sans canal ?

Lecture seule. Affiche l'état avant/après d'un run d'émission :
  - matches notifie=false encore valides (date_limite >= aujourd'hui)
  - matches notifie=true sur les 7 derniers jours
  - répartition par profil (canal disponible ou non)

Usage : python scripts/preuve-emission.py
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
    req = urllib.request.Request(
        f"{URL}/rest/v1/{table}?{requete}",
        headers={"apikey": CLE, "Authorization": f"Bearer {CLE}"},
    )
    with urllib.request.urlopen(req, timeout=60) as rep:
        return json.loads(rep.read().decode("utf-8"))


AUJ = dt.date.today().isoformat()
SEMAINE = (dt.date.today() - dt.timedelta(days=7)).isoformat()

SELECT = (
    "select=id,score,notifie,date_match,profil_id,"
    "profil:profils(id,prenom,telephone,email,actif,optin_texte,metadata),"
    "offre:offres(titre,date_limite)&limit=100"
)

attente = get("matches", SELECT + "&notifie=eq.false")
recents = get("matches", SELECT + f"&notifie=eq.true&date_match=gte.{SEMAINE}")

valides = [
    m for m in attente
    if (m.get("offre") or {}).get("date_limite")
    and (m["offre"]["date_limite"] or "") >= AUJ
]

print(f"aujourd'hui : {AUJ}")
print(f"matches notifie=false        : {len(attente)}")
print(f"  dont encore valides        : {len(valides)}")
print(f"matches notifie=true (7 j)   : {len(recents)}\n")

for titre, lot in (("EN ATTENTE VALIDES", valides), ("NOTIFIES 7 J", recents)):
    if not lot:
        continue
    print(f"--- {titre} ---")
    par_profil: dict[str, list] = {}
    for m in lot:
        par_profil.setdefault(m["profil_id"], []).append(m)
    for pid, ms in par_profil.items():
        p = ms[0]["profil"]
        meta = p.get("metadata") or {}
        canal = "email" if p.get("email") else ("whatsapp" if p.get("telephone") else "AUCUN")
        consentement = "optin_at" if meta.get("optin_at") else (
            "optin_texte" if (p.get("optin_texte") or "").strip() else "AUCUN"
        )
        print(f"  {pid[:8]} · {p.get('prenom')} · actif={p.get('actif')} · "
              f"canal={canal} · consentement={consentement} · {len(ms)} match(s)")
    print()

restants = len(valides)
print(f"VERDICT : {restants} match(s) valide(s) sans envoi")
print("  attendu apres correctif : 0 si chaque profil a un canal joignable,")
print("  sinon autant que de profils sans email ET sans WhatsApp configure.")
