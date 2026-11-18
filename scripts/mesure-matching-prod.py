"""Mesure le matching RÉEL en production — lecture seule, rejouable.

Ce que ce harnais prouve (aucun chiffre n'est simulé) :
  1. l'API Render répond et sous quel code HTTP (cold start free : on attend) ;
  2. la distribution des scores réellement stockés dans `matches` :
     n profils, n matches, min / médiane / max, écart max par profil ;
  3. ce qui reste NON LIVRÉ : matches `notifie=false` encore valides, et
     pourquoi (profil sans email, sans téléphone, inactif, sans consentement).

Sources interrogées (toutes réelles) :
  · API      : GET /health/ready, GET /api/v1/admin/stats (garde admin),
               GET /api/v1/offres, GET /api/v1/matches sans jeton (preuve 401)
  · Supabase : REST PostgREST en lecture (service role, `select` uniquement)

N'ÉCRIT RIEN : aucun POST /api/v1/matching/run (il insère des matches en base),
aucun PATCH, aucun script SQL. Le jeton admin n'est jamais affiché
(longueur + sha256[:12] seulement).

Usage :
    python scripts/mesure-matching-prod.py
    python scripts/mesure-matching-prod.py --sans-api      # Supabase seul
    python scripts/mesure-matching-prod.py --json sortie.json  # + export brut
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import pathlib
import statistics
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_API = "https://lawol-api.onrender.com"
ENV = pathlib.Path(__file__).resolve().parent.parent / ".env"
JOUR = dt.datetime.now().astimezone().date().isoformat()

# Cold start Render (plan free) : 30-90 s mesurés. 3 essais de 90 s = 4 min 30
# au pire, assez pour ne jamais confondre « lent » avec « en panne ».
ESSAIS = 3
DELAI = 90
PAUSE = 5


# --------------------------------------------------------------------------- #
# Secrets : lus dans .env, jamais imprimés
# --------------------------------------------------------------------------- #
def env(cle: str) -> str:
    for ligne in ENV.read_text(encoding="utf-8", errors="replace").splitlines():
        ligne = ligne.strip()
        if ligne.startswith(cle + "="):
            return ligne.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f"{cle} introuvable dans {ENV}")


def empreinte(valeur: str) -> str:
    return f"{len(valeur)} car, sha256[:12]={hashlib.sha256(valeur.encode()).hexdigest()[:12]}"


# --------------------------------------------------------------------------- #
# HTTP : une requête, son code, sa durée, ses tentatives
# --------------------------------------------------------------------------- #
def http_json(
    url: str,
    *,
    methode: str = "GET",
    entetes: dict[str, str] | None = None,
    corps: bytes | None = None,
    delai: int = DELAI,
    essais: int = ESSAIS,
) -> dict:
    """Rend {status, corps, duree, tentatives, erreur}. Status None = jamais abouti."""
    depart = time.time()
    derniere = ""
    for tentative in range(1, essais + 1):
        requete = urllib.request.Request(
            url, method=methode, data=corps, headers=entetes or {}
        )
        try:
            with urllib.request.urlopen(requete, timeout=delai) as rep:
                brut = rep.read().decode("utf-8", "replace")
                return {
                    "status": rep.status,
                    "corps": _json(brut),
                    "entetes": dict(rep.headers),
                    "duree": round(time.time() - depart, 1),
                    "tentatives": tentative,
                    "erreur": "",
                }
        except urllib.error.HTTPError as exc:  # 4xx/5xx : réponse réelle
            brut = exc.read().decode("utf-8", "replace")
            return {
                "status": exc.code,
                "corps": _json(brut),
                "duree": round(time.time() - depart, 1),
                "tentatives": tentative,
                "erreur": brut[:300],
            }
        except Exception as exc:  # noqa: BLE001 — réseau / timeout / DNS
            derniere = f"{type(exc).__name__}: {exc}"[:200]
            print(f"    tentative {tentative}/{essais} : {derniere} "
                  f"({round(time.time() - depart, 1)} s écoulées)")
            if tentative < essais:
                time.sleep(PAUSE)
    return {
        "status": None,
        "corps": None,
        "duree": round(time.time() - depart, 1),
        "tentatives": essais,
        "erreur": derniere,
    }


def _json(brut: str):
    try:
        return json.loads(brut)
    except json.JSONDecodeError:
        return brut[:300]


def supabase_get(chemin: str, select: str, *, ordre: str = "", limite: int = 1000) -> dict:
    """Lecture PostgREST paginée. Rend {status, lignes, total, duree}."""
    url = env("SUPABASE_URL").rstrip("/")
    cle = env("SUPABASE_SERVICE_ROLE_KEY")
    entetes = {"apikey": cle, "Authorization": f"Bearer {cle}"}
    lignes: list = []
    total = None
    depart = time.time()
    debut = 0
    while True:
        query = f"{chemin}?select={select}&limit={limite}"
        if ordre:
            query += f"&order={ordre}"
        tete = dict(entetes)
        tete["Range-Unit"] = "items"
        tete["Range"] = f"{debut}-{debut + limite - 1}"
        tete["Prefer"] = "count=exact"
        page = http_json(f"{url}/rest/v1/{query}", entetes=tete)
        if page["status"] not in (200, 206) or not isinstance(page["corps"], list):
            return {
                "status": page["status"],
                "lignes": lignes,
                "total": total,
                "duree": round(time.time() - depart, 1),
                "erreur": page.get("erreur", ""),
            }
        lignes.extend(page["corps"])
        if total is None:
            total = _total_range(page)
        if len(page["corps"]) < limite:
            break
        debut += limite
    return {
        "status": 200,
        "lignes": lignes,
        "total": total if total is not None else len(lignes),
        "duree": round(time.time() - depart, 1),
        "erreur": "",
    }

def _total_range(page: dict) -> int | None:
    """Total exact lu dans `Content-Range: 0-999/1234` (PostgREST)."""
    valeur = (page.get("entetes") or {}).get("Content-Range", "")
    if "/" in valeur:
        total = valeur.rsplit("/", 1)[1].strip()
        if total.isdigit():
            return int(total)
    return None


# --------------------------------------------------------------------------- #
# Statistiques
# --------------------------------------------------------------------------- #
def bloc(valeurs: list[int]) -> dict:
    if not valeurs:
        return {"n": 0}
    return {
        "n": len(valeurs),
        "min": min(valeurs),
        "mediane": round(statistics.median(valeurs), 1),
        "moyenne": round(statistics.mean(valeurs), 1),
        "max": max(valeurs),
    }


def afficher_bloc(titre: str, valeurs: list[int]) -> None:
    b = bloc(valeurs)
    if not b["n"]:
        print(f"  {titre:<28} : aucun")
        return
    print(f"  {titre:<28} : n={b['n']:<3} min={b['min']:<3} "
          f"médiane={b['mediane']:<5} moyenne={b['moyenne']:<5} max={b['max']}")


def consenti(p: dict) -> bool:
    """Consentement opt-in : metadata.optin_at (écrit dès l'inscription depuis
    le 15/11) OU optin_texte non vide (colonne historique)."""
    meta = p.get("metadata") or {}
    return bool(meta.get("optin_at")) or bool((p.get("optin_texte") or "").strip())


def canal_de(p: dict) -> str:
    if (p.get("telephone") or "").strip():
        return "whatsapp"
    if (p.get("email") or "").strip():
        return "email"
    return "AUCUN"


# --------------------------------------------------------------------------- #
# Programme
# --------------------------------------------------------------------------- #
def main() -> int:
    parseur = argparse.ArgumentParser()
    parseur.add_argument("--sans-api", action="store_true",
                         help="ne pas interroger l'API Render (Supabase seul)")
    parseur.add_argument("--json", metavar="CHEMIN",
                         help="écrire le rapport brut en JSON")
    args = parseur.parse_args()

    rapport: dict = {"date": JOUR, "api": [], "distribution": {}, "non_livres": {}}
    print("=" * 78)
    print(f"MESURE MATCHING PROD — {JOUR} — LECTURE SEULE (aucune écriture en base)")
    print("=" * 78)

    # ---------------- 1. API Render : disponibilité + compteurs officiels ----
    if not args.sans_api:
        try:
            jeton = env("ADMIN_PASSWORD_HASH")
            print(f"\n[1] API {BASE_API}")
            print(f"    jeton admin : {empreinte(jeton)}")
            appels = [
                ("GET /health/ready", "/health/ready", {}),
                ("GET /api/v1/admin/stats", "/api/v1/admin/stats",
                 {"x-admin-token": jeton}),
                ("GET /api/v1/offres", "/api/v1/offres", {}),
                ("GET /api/v1/matches (sans jeton)", "/api/v1/matches", {}),
            ]
            for libelle, chemin, entetes in appels:
                print(f"    -> {libelle}")
                res = http_json(BASE_API + chemin, entetes=entetes)
                code = res["status"] if res["status"] is not None else "AUCUN"
                print(f"       HTTP {code} · {res['duree']} s · "
                      f"{res['tentatives']} tentative(s)")
                extrait = ""
                if isinstance(res["corps"], dict):
                    extrait = json.dumps(res["corps"], ensure_ascii=False)[:240]
                elif isinstance(res["corps"], list):
                    extrait = f"{len(res['corps'])} élément(s)"
                elif res["erreur"]:
                    extrait = str(res["erreur"])[:160]
                if extrait:
                    print(f"       {extrait}")
                rapport["api"].append({
                    "endpoint": libelle,
                    "http": code,
                    "duree_s": res["duree"],
                    "tentatives": res["tentatives"],
                    "extrait": extrait,
                })
            print("    (aucun POST /matching/run : il écrit des matches en base — "
                  "hors périmètre lecture seule)")
        except SystemExit as exc:
            print(f"    BLOQUÉ : {exc}")
            rapport["api"].append({"endpoint": "auth", "http": "AUCUN",
                                   "erreur": str(exc)})

    # ---------------- 2. Données réelles : matches + profils + offres -------
    print("\n[2] Supabase REST (lecture seule)")
    profils_res = supabase_get(
        "profils",
        "id,prenom,email,telephone,actif,optin_texte,niveau,filiere,metadata",
    )
    matches_res = supabase_get(
        "matches",
        "id,score,date_match,notifie,profil_id,metadata,"
        "profil:profils(id,prenom,email,telephone,actif,optin_texte,metadata),"
        "offre:offres(id,titre,date_limite,active,type_offre)",
        ordre="score.desc",
    )
    print(f"    GET /rest/v1/profils  -> HTTP {profils_res['status']} · "
          f"{len(profils_res['lignes'])} ligne(s) · total={profils_res['total']} · "
          f"{profils_res['duree']} s")
    print(f"    GET /rest/v1/matches  -> HTTP {matches_res['status']} · "
          f"{len(matches_res['lignes'])} ligne(s) · total={matches_res['total']} · "
          f"{matches_res['duree']} s")
    if matches_res["status"] != 200:
        print(f"    BLOQUÉ Supabase : HTTP {matches_res['status']} "
              f"{matches_res['erreur'][:200]}")
        rapport["blocage"] = f"Supabase HTTP {matches_res['status']}"
        return _fin(rapport, args)

    profils = profils_res["lignes"]
    matches = matches_res["lignes"]

    # ---------------- 3. Distribution des scores ---------------------------
    scores = [m["score"] for m in matches if isinstance(m.get("score"), int)]
    par_regle: dict[str, list[int]] = {}
    for m in matches:
        if not isinstance(m.get("score"), int):
            continue
        regle = str((m.get("metadata") or {}).get("regle") or "inconnue")
        par_regle.setdefault(regle, []).append(m["score"])

    par_profil: dict[str, list[dict]] = {}
    for m in matches:
        par_profil.setdefault(m["profil_id"], []).append(m)

    print("\n[3] DISTRIBUTION DES SCORES RÉELS")
    print(f"  profils en base              : {len(profils)} "
          f"(actifs : {sum(1 for p in profils if p.get('actif'))})")
    print(f"  profils avec >= 1 match      : {len(par_profil)}")
    print(f"  matches en base              : {len(matches)}")
    print(f"  dont notifiés                : {sum(1 for m in matches if m.get('notifie'))}")
    print(f"  dates de calcul              : "
          f"{min((m['date_match'] for m in matches), default='-')} -> "
          f"{max((m['date_match'] for m in matches), default='-')}")
    for regle in sorted(par_regle):
        dates = [m["date_match"] for m in matches
                 if str((m.get("metadata") or {}).get("regle") or "inconnue") == regle]
        print(f"  barème {regle:<21} : {len(par_regle[regle])} match(s), "
              f"dernier calcul {max(dates) if dates else '-'}")
    print()
    afficher_bloc("tous barèmes", scores)
    for regle in sorted(par_regle):
        afficher_bloc(f"barème {regle}", par_regle[regle])

    ecarts = []
    print("\n  par profil (écart = max - min) :")
    for pid, lst in sorted(par_profil.items(), key=lambda x: -len(x[1])):
        vals = [m["score"] for m in lst if isinstance(m.get("score"), int)]
        p = (lst[0].get("profil") or {})
        ecart = (max(vals) - min(vals)) if vals else 0
        ecarts.append({"profil_id": pid, "n": len(vals), "ecart": ecart,
                       "min": min(vals) if vals else None,
                       "max": max(vals) if vals else None})
        print(f"    {pid[:8]} · {str(p.get('prenom'))[:12]:<12} "
              f"actif={p.get('actif')!s:<5} n={len(vals):<3} "
              f"min={min(vals) if vals else '-'} méd={round(statistics.median(vals), 1) if vals else '-'} "
              f"max={max(vals) if vals else '-'} écart={ecart}")
    if ecarts:
        pire = max(ecarts, key=lambda e: e["ecart"])
        print(f"  -> écart maximal observé : {pire['ecart']} points "
              f"(profil {pire['profil_id'][:8]}, {pire['n']} match(s))")

    couvertures = [
        (m.get("metadata") or {}).get("couverture") for m in matches
    ]
    couvertures = [c for c in couvertures if isinstance(c, int)]
    if couvertures:
        print()
        afficher_bloc("couverture (poids applicables)", couvertures)

    rapport["distribution"] = {
        "profils_total": len(profils),
        "profils_actifs": sum(1 for p in profils if p.get("actif")),
        "profils_avec_match": len(par_profil),
        "matches_total": len(matches),
        "matches_notifies": sum(1 for m in matches if m.get("notifie")),
        "date_min": min((m["date_match"] for m in matches), default=None),
        "date_max": max((m["date_match"] for m in matches), default=None),
        "global": bloc(scores),
        "par_regle": {r: bloc(v) for r, v in par_regle.items()},
        "par_profil": ecarts,
        "couverture": bloc(couvertures),
        "ecart_max": max((e["ecart"] for e in ecarts), default=None),
    }

    # ---------------- 4. Non livrés ----------------------------------------
    print("\n[4] MATCHES ENCORE NON LIVRÉS (notifie=false)")
    attente = [m for m in matches if not m.get("notifie")]
    valides = [
        m for m in attente
        if ((m.get("offre") or {}).get("date_limite") or "") >= JOUR
    ]
    print(f"  notifie=false                : {len(attente)}")
    print(f"  dont offre encore valide     : {len(valides)}")
    print(f"  dont offre expirée           : {len(attente) - len(valides)}")

    raisons: dict[str, int] = {}
    detail = []
    for m in valides:
        p = m.get("profil") or {}
        canal = canal_de(p)
        raisons_profil = []
        if not p.get("actif"):
            raisons_profil.append("profil inactif (opt-out)")
        if not consenti(p):
            raisons_profil.append("sans consentement opt-in")
        if canal == "AUCUN":
            raisons_profil.append("aucun canal (ni email ni téléphone)")
        cle = canal if not raisons_profil else f"{canal} + {' + '.join(raisons_profil)}"
        raisons[cle] = raisons.get(cle, 0) + 1
        detail.append({
            "match_id": m["id"], "profil_id": m["profil_id"],
            "prenom": p.get("prenom"), "canal": canal, "actif": p.get("actif"),
            "consentement": consenti(p), "score": m.get("score"),
            "date_match": m.get("date_match"),
            "date_limite": (m.get("offre") or {}).get("date_limite"),
            "blocages": raisons_profil,
        })

    for cle, nb in sorted(raisons.items(), key=lambda x: -x[1]):
        print(f"    {nb} match(s) — {cle}")

    sans_email = [d for d in detail if d["canal"] == "whatsapp"]
    sans_tout = [d for d in detail if d["canal"] == "AUCUN"]
    print(f"  profil sans email (WhatsApp seul) : {len(sans_email)} match(s)")
    print(f"  profil sans aucun canal           : {len(sans_tout)} match(s)")
    if not valides:
        print("  -> aucun match valide en attente d'envoi")
    else:
        livreables = [d for d in detail
                      if d["actif"] and d["consentement"] and d["canal"] != "AUCUN"]
        print(f"  -> éligibles à un envoi immédiat : {len(livreables)}/{len(valides)}")
        plus_vieux = min((d["date_match"] for d in detail if d["date_match"]), default=None)
        if plus_vieux:
            age = (dt.date.fromisoformat(JOUR) - dt.date.fromisoformat(plus_vieux)).days
            print(f"  plus ancien non livré        : calculé le {plus_vieux} "
                  f"({age} jour(s) d'attente)")

    rapport["non_livres"] = {
        "notifie_false": len(attente),
        "valides": len(valides),
        "expires": len(attente) - len(valides),
        "par_raison": raisons,
        "sans_email": len(sans_email),
        "sans_aucun_canal": len(sans_tout),
        "detail": detail,
    }

    return _fin(rapport, args)


def _fin(rapport: dict, args) -> int:
    print("\n" + "=" * 78)
    if "blocage" in rapport:
        print(f"VERDICT : mesure partielle — blocage {rapport['blocage']}")
        code = 2
    elif not rapport.get("distribution"):
        print("VERDICT : aucune donnée mesurée")
        code = 2
    else:
        d = rapport["distribution"]
        print(f"VERDICT : {d['matches_total']} match(s) réel(s) sur "
              f"{d['profils_avec_match']}/{d['profils_total']} profil(s) — "
              f"min={d['global'].get('min')} médiane={d['global'].get('mediane')} "
              f"max={d['global'].get('max')} ; "
              f"{rapport['non_livres']['valides']} non livré(s) encore valide(s)")
        code = 0
    if args.json:
        chemin = pathlib.Path(args.json)
        chemin.write_text(json.dumps(rapport, ensure_ascii=False, indent=2),
                          encoding="utf-8")
        print(f"rapport JSON : {chemin}")
    return code


if __name__ == "__main__":
    sys.exit(main())
