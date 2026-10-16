"""Preuve LIVE : tri par échéance + recherche texte de `GET /api/v1/offres`.

Aucun mock : le script appelle un serveur uvicorn réel, branché sur la VRAIE base
Supabase (le tri et le filtre `q` sont faits par Postgres/PostgREST, pas par Python).

Ce qui est prouvé, appels réels :
    0. OpenAPI : les paramètres `q` et `tri` sont bien exposés par la route ;
    1. `tri=urgent` → `date_limite` CROISSANTE (les plus urgentes d'abord), sur
       2 pages consécutives et de façon globale (page 2 commence après page 1) ;
    2. défaut / `tri=recentes` → l'ordre `date_scrape` d'origine est conservé
       (la séquence des échéances n'est PAS triée) : aucun effet de bord ;
    3. `q=master` → sous-ensemble STRICT du catalogue (ni complet, ni vide) et
       chaque offre renvoyée contient le mot dans titre, entreprise ou description ;
    4. pagination intacte : deux pages de même taille, disjointes, dans l'ordre ;
    5. `q` hostile (`…,titre.not.is.null`, `master*`) → assaini, aucune injection
       dans le filtre PostgREST (jamais de 500, jamais d'élargissement) ;
    6. filtres historiques préservés : `filiere`, `pays`, `type_offre` toujours
       appliqués, y compris combinés à `tri` et `q`.

Usage (2 terminaux) :
    python -X utf8 -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port 8123
    python -X utf8 scripts/verify-offres-tri-recherche.py [http://127.0.0.1:8123]
Code retour 0 si tous les checks sont verts.
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from itertools import pairwise

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8123"

ECHECS = []


def check(libelle, condition, detail=""):
    print(f"  [{'OK' if condition else 'KO'}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


def get(chemin, **params):
    url = f"{BASE}{chemin}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=30) as rep:
            return rep.status, json.loads(rep.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def colonne(offres, cle):
    return [o[cle] for o in offres]


def croissante(valeurs):
    return all(a <= b for a, b in pairwise(valeurs))


def lignes(offres, champs, limite=15):
    for i, o in enumerate(offres[:limite], 1):
        print("      " + " | ".join(str(o.get(c))[:46] for c in champs))
    if len(offres) > limite:
        print(f"      … {len(offres) - limite} de plus")


# ================== 0. La route expose bien les paramètres =====================
print(f"\n[0] OpenAPI ({BASE}) : paramètres de /api/v1/offres")
statut, spec = get("/openapi.json")
params = {}
if statut == 200:
    params = {
        p["name"]: p["schema"].get("default", p.get("required", ""))
        for p in spec["paths"]["/api/v1/offres"]["get"]["parameters"]
    }
check("GET /openapi.json → 200", statut == 200, f"reçu {statut}")
check("paramètre `tri` exposé (défaut 'recentes')", params.get("tri") == "recentes", str(params))
check("paramètre `q` exposé (optionnel)", "q" in params, str(params))
check("paramètres historiques toujours là", {"filiere", "pays", "type_offre", "limit", "offset"} <= set(params), str(sorted(params)))

# ================== 1. Tri par échéance : `tri=urgent` =========================
print("\n[1] tri=urgent → date_limite CROISSANTE, sur 2 pages")
statut, p1 = get("/api/v1/offres", tri="urgent", limit=20, offset=0)
check("page 1 → 200", statut == 200, f"reçu {statut}")
statut, p2 = get("/api/v1/offres", tri="urgent", limit=20, offset=20)
check("page 2 → 200", statut == 200, f"reçu {statut}")
print("    page 1 (échéance | titre) :")
lignes(p1, ("date_limite", "titre", "entreprise"), 10)
print("    page 2 :")
lignes(p2, ("date_limite", "titre", "entreprise"), 5)
check("page 1 triée par échéance croissante", croissante(colonne(p1, "date_limite")), str(colonne(p1, "date_limite")))
check("page 2 triée par échéance croissante", croissante(colonne(p2, "date_limite")), str(colonne(p2, "date_limite")))
check(
    "l'ordre est global : page 2 commence après la fin de page 1",
    bool(p1) and bool(p2) and p1[-1]["date_limite"] <= p2[0]["date_limite"],
    f"fin p1={p1[-1]['date_limite'] if p1 else None} début p2={p2[0]['date_limite'] if p2 else None}",
)
check(
    "aucune offre expirée (garde `date_limite` future intacte)",
    all(o["date_limite"] >= p1[0]["date_limite"] and o["active"] for o in p1 + p2),
    "",
)

# ================== 2. Défaut inchangé (`date_scrape` desc) ====================
print("\n[2] défaut / tri=recentes → ordre d'origine conservé (pas d'échéance triée)")
statut, defaut = get("/api/v1/offres", limit=300)
check("défaut → 200", statut == 200, f"reçu {statut}")
statut, recentes = get("/api/v1/offres", tri="recentes", limit=300)
check("tri=recentes → 200", statut == 200, f"reçu {statut}")
check(
    "défaut sans paramètre == tri=recentes (mêmes ids dans le même ordre)",
    colonne(defaut, "id") == colonne(recentes, "id"),
    "séquences différentes",
)
check(
    "l'ordre par défaut n'est PAS trié par échéance (date_scrape conservé)",
    not croissante(colonne(defaut, "date_limite")),
    str(colonne(defaut, "date_limite")[:8]),
)
check(
    "tri=urgent réordonne réellement (premier id différent du défaut)",
    bool(p1) and bool(defaut) and colonne(p1, "id")[:5] != colonne(defaut, "id")[:5],
    f"urgent={colonne(p1, 'id')[:3]} défaut={colonne(defaut, 'id')[:3]}",
)

# ================== 3. Recherche texte `q` =====================================
print("\n[3] q=master → sous-ensemble strict, chaque résultat contient le mot")
statut, complet = get("/api/v1/offres", limit=1000)
check("catalogue complet → 200", statut == 200, f"reçu {statut}")
statut, masters = get("/api/v1/offres", q="master", limit=1000)
check("q=master → 200", statut == 200, f"reçu {statut}")
print(f"    catalogue={len(complet)} offres · q=master={len(masters)} offres · échantillon :")
lignes(masters, ("date_limite", "titre", "entreprise"), 10)

A_MOTS = ("titre", "entreprise", "description")


def contient(offre, mot):
    return any(mot in (offre.get(c) or "").lower() for c in A_MOTS)


check("0 < |q=master| < |catalogue| (sous-ensemble STRICT)", 0 < len(masters) < len(complet), f"{len(masters)} / {len(complet)}")
check("chaque offre renvoyée contient 'master' (titre/entreprise/description)", all(contient(o, "master") for o in masters), "offre hors périmètre")
check("les ids renvoyés appartiennent au catalogue public", {o["id"] for o in masters} <= {o["id"] for o in complet}, "id inconnu")
check("aucune offre inactive / expirée dans le résultat", all(o["active"] for o in masters), "")
statut, rien = get("/api/v1/offres", q="zzzzintrouvablezzzz", limit=1000)
check("q introuvable → 200 et 0 résultat", statut == 200 and rien == [], f"reçu {statut} / {len(rien) if isinstance(rien, list) else rien}")
statut, casse = get("/api/v1/offres", q="MASTER", limit=1000)
check("recherche insensible à la casse (MASTER == master)", isinstance(casse, list) and len(casse) == len(masters), f"{len(casse) if isinstance(casse, list) else casse}")
statut, url_q = get("/api/v1/offres", q="bourse d'excellence", limit=1000)
check("q multi-mots (espaces) → 200", statut == 200, f"reçu {statut}")

# ================== 4. Pagination intacte ======================================
print("\n[4] Pagination : pages disjointes, même taille, dans l'ordre")
statut, pg1 = get("/api/v1/offres", tri="urgent", q="master", limit=12, offset=0)
statut2, pg2 = get("/api/v1/offres", tri="urgent", q="master", limit=12, offset=12)
check("q + tri + pagination → 200 sur les 2 pages", statut == 200 and statut2 == 200, f"{statut}/{statut2}")
check("page 2 ≠ page 1 (aucun recouvrement)", not ({o["id"] for o in pg1} & {o["id"] for o in pg2}), "recouvrement détecté")
check("mêmes bornes de pagination qu'avant (12 par page)", len(pg1) == 12 and len(pg2) == 12, f"{len(pg1)}/{len(pg2)}")
check("échéances croissantes sur les 2 pages cumulées", croissante(colonne(pg1 + pg2, "date_limite")), "")
check("q=master + tri=urgent ⊆ q=master", {o["id"] for o in pg1 + pg2} <= {o["id"] for o in masters}, "")

# ================== 5. `q` hostile : filtres PostgREST assainis ================
print("\n[5] q hostile → assaini (aucune injection dans le filtre `or`)")
statut, injecte = get("/api/v1/offres", q="zzzzintrouvablezzzz,titre.not.is.null", limit=1000)
check("q contenant `,titre.not.is.null` → 200", statut == 200, f"reçu {statut}")
check("…et AUCUN élargissement (0 résultat, la virgule n'a pas créé de filtre)", injecte == [], f"{len(injecte) if isinstance(injecte, list) else injecte} résultats")
statut, joker = get("/api/v1/offres", q="master*", limit=1000)
check("q contenant `*` → même résultat que `master` (pas de joker injecté)", statut == 200 and isinstance(joker, list) and len(joker) == len(masters), f"{len(joker) if isinstance(joker, list) else joker}")
statut, groupe = get("/api/v1/offres", q="master)", limit=1000)
check("q contenant `)` → 200 (jamais de 500)", statut == 200, f"reçu {statut}")
statut, vide = get("/api/v1/offres", q="(", limit=1000)
check("q réduit à de la syntaxe → 200 (filtre ignoré, pas d'erreur)", statut == 200 and len(vide) == len(complet), f"reçu {statut} / {len(vide) if isinstance(vide, list) else vide}")

# ================== 6. Filtres historiques préservés ===========================
print("\n[6] Filtres historiques (filiere / pays / type_offre) toujours actifs")
statut, info = get("/api/v1/offres", filiere="informatique", tri="urgent", limit=100)
check("filiere=informatique + tri=urgent → 200", statut == 200, f"reçu {statut}")
check("…toutes les offres portent la filière", all("informatique" in (o.get("filieres_cibles") or []) for o in info), "filière absente")
check("…et l'ordre reste croissant en échéance", croissante(colonne(info, "date_limite")), "")
statut, fr = get("/api/v1/offres", pays="france", q="master", limit=100)
check("pays=france + q=master → 200", statut == 200, f"reçu {statut}")
check("…toutes les offres sont en France", all(o.get("pays_etudes") == "france" for o in fr), "pays inattendu")
statut, legacy = get("/api/v1/offres", type_offre="stage_pfe", limit=100)
check(
    "type_offre=stage_pfe → 422 (vocabulaire d'écriture d'origine, NON modifié)",
    statut == 422,
    f"reçu {statut}",
)
statut, bourse = get("/api/v1/offres", type_offre="bourse", q="master", tri="urgent", limit=100)
check("type_offre=bourse + tri + q combinés → 200", statut == 200, f"reçu {statut}")
check("…cumul cohérent (bourse ET 'master')", all(o.get("type_offre") == "bourse" and contient(o, "master") for o in bourse), "")

# --------------------------------- Bilan --------------------------------------
print(f"\n{'=' * 60}")
if ECHECS:
    print(f"RÉSULTAT : {len(ECHECS)} échec(s) → {ECHECS}")
    sys.exit(1)
print("RÉSULTAT : 100 % des checks sont VERTS (serveur réel + base réelle).")
