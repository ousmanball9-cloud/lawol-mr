"""Preuve MOCKÉE du centre d'alertes in-app (backend FastAPI) — zéro réseau.

Patch : le module `supabase` est remplacé par un factice en mémoire AVANT tout
import de l'application → `create_client()` ne touche jamais le réseau et aucun
secret réel n'est utilisé (SESSION_SECRET de test bidon). Les 4 chemins d'envoi
(WhatsApp / email / dispatch) sont en plus remplacés par une barrière qui LÈVE :
la moindre tentative d'envoi fait échouer la preuve.

Prouve :
   1. GET 200 avec les 7 clés exactes du contrat + 2 types d'ids stables
      (`match:{id}` et `echeance:{id}:j12|j3`) et les bons liens ;
   2. fenêtre glissante de 7 jours pour nouveau_match (J-7 inclus, J-8 exclu) ;
   3. seuils d'échéance J-12 vs J-3 DISTINCTS (bourse seule, active,
      0 ≤ jours ≤ 12 ; inactive / passée / > 12 j / non-bourse exclues) ;
   4. tri « plus récent d'abord » + plafond 30 (40 candidats → 30) ;
   5. `lue` lu dans profils.metadata['notifications_lues'] + fusion POST
      (merge non destructif, autres clés metadata intactes, doublons écrêtés) ;
   6. plafond 200 sur metadata lues (190 + 20 → 200, les plus anciennes
      dates supprimées en premier) ;
   7. 401 sans Bearer, 403 token d'un autre tel, 404 profil absent ;
   8. 422 corps invalide (et 422 = RIEN d'écrit) ;
   9. lecture seule : zéro insert, zéro update sur `matches`, seules les
      écritures metadata attendues ;
  10. main.py expose bien les 2 routes ; profil sans match → liste vide.

Usage : python -X utf8 scripts/test-notifications.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import copy
import os
import sys
import types
from datetime import date, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)


# ------------------------- Faux Supabase (zéro réseau) -------------------------
class _Resultat:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _FauxTable:
    def __init__(self, base, nom):
        self._base, self._nom, self._mode = base, nom, "select"
        self._filtres, self._donnees = [], None
        self._tri, self._limite = None, None

    def select(self, colonnes="*", **kwargs):
        self._mode = "select"
        return self

    def eq(self, colonne, valeur):
        self._filtres.append((colonne, valeur))
        return self

    def order(self, colonne, desc=False):
        self._tri = (colonne, desc)
        return self

    def limit(self, n):
        self._limite = n
        return self

    def update(self, donnees):
        self._mode, self._donnees = "update", donnees
        return self

    def insert(self, donnees):
        self._base.appels_insert += 1
        raise AssertionError("insert interdit : cette preuve ne crée jamais de ligne")

    def execute(self):
        lignes = [
            ligne
            for ligne in self._base.tables.setdefault(self._nom, [])
            if all(ligne.get(c) == v for c, v in self._filtres)
        ]
        if self._mode == "select":
            if self._tri:
                colonne, desc = self._tri
                lignes = sorted(lignes, key=lambda r: str(r.get(colonne) or ""), reverse=desc)
            if self._limite is not None:
                lignes = lignes[: self._limite]
            # deepcopy = aller-retour JSON
            return _Resultat([copy.deepcopy(ligne) for ligne in lignes])
        if self._mode == "update":
            self._base.maj[self._nom] = self._base.maj.get(self._nom, 0) + len(lignes)
            for ligne in lignes:
                ligne.update(copy.deepcopy(self._donnees))
            return _Resultat([copy.deepcopy(ligne) for ligne in lignes])
        raise AssertionError(f"mode inattendu : {self._mode}")


class _FauxSupabase:
    def __init__(self):
        self.tables = {}
        self.maj = {}  # nb d'update par table (preuve de lecture seule)
        self.appels_insert = 0

    def table(self, nom):
        return _FauxTable(self, nom)


FAUX = _FauxSupabase()
_module_supabase = types.ModuleType("supabase")
_module_supabase.Client = object
_module_supabase.create_client = lambda url, key=None, **kwargs: FAUX
sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Application ----------------------------------
from apps.api.app.modules.auth.session import creer_token  # noqa: E402
from apps.api.app.modules.notifications.routes import router  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


# Barrière réseau : le moindre envoi WhatsApp/email lève AssertionError → 500
def _interdit(*args, **kwargs):
    raise AssertionError("APPEL RÉSEAU INTERDIT : cette preuve est 100 % hors-ligne")


import apps.api.app.modules.notifications.canal as _canal  # noqa: E402
import apps.api.app.modules.notifications.email_sender as _mail  # noqa: E402
import apps.api.app.modules.whatsapp.notifier as _notifier  # noqa: E402
import apps.api.app.modules.whatsapp.sender as _sender  # noqa: E402

_canal.envoyer_notification = _interdit
_mail.envoyer_email = _interdit
_notifier.envoyer_notification = _interdit
_sender.envoyer_message_texte = _interdit

app = FastAPI()
app.include_router(router)
client = TestClient(app)

TEL_A = "22136000001"  # profil principal (ids stables, seuils, lue)
TEL_B = "22136000002"  # profil du plafond 200 sur metadata lues
TEL_C = "22136000003"  # profil du plafond 30 + tri
TEL_ABSENT = "22136099999"

AUJ = date.today()


def j(n: int) -> str:
    """Date ISO de n jours par rapport à aujourd'hui (fenêtre glissante)."""
    return (AUJ + timedelta(days=n)).isoformat()


def offre(oid, titre, type_offre, decalage_limite, active=True):
    return {
        "id": oid,
        "titre": titre,
        "entreprise": "Organisme Test",
        "ville": "Nouakchott",
        "type_offre": type_offre,
        "date_limite": j(decalage_limite),
        "active": active,
    }


def match(mid, profil, date_match, o):
    return {"id": mid, "profil_id": profil, "date_match": date_match, "offre": o}


FAUX.tables["profils"] = [
    {
        "id": "profil-aaa",
        "telephone": TEL_A,
        "metadata": {
            "code_pin_hash": "hash-bidon",
            "prefs_avancees": {"seuil": 40},
            "notifications_lues": {"match:m1": "2026-01-05T10:00:00+00:00"},
        },
    },
    {
        "id": "profil-bbb",
        "telephone": TEL_B,
        "metadata": {
            "code_pin_hash": "hash-bidon-2",
            # 190 entrées datées (ISO croissantes) pour le plafond 200
            "notifications_lues": {
                f"old-{i:03d}": (date(2026, 1, 1) + timedelta(days=i)).isoformat()
                + "T00:00:00+00:00"
                for i in range(190)
            },
        },
    },
    {"id": "profil-ccc", "telephone": TEL_C, "metadata": {"code_pin_hash": "hash-bidon-3"}},
]

# Fenêtre 7 jours : m3 (J-7) dedans, m4 (J-8) dehors.
# Échéances : non-bourse, > 12 j, déjà passée et inactive doivent être exclues.
FAUX.tables["matches"] = [
    match("m1", "profil-aaa", j(-1), offre("off-b1", "Bourse Master", "bourse", 12)),
    match("m2", "profil-aaa", j(-2), offre("off-b2", "Bourse Licence", "bourse", 3)),
    match("m3", "profil-aaa", j(-7), offre("off-s3", "Stage PFE", "stage_pfe", 30)),
    match("m4", "profil-aaa", j(-8), offre("off-e4", "Emploi junior", "emploi_junior", 30)),
    match("m5", "profil-aaa", j(-1), offre("off-s5", "Stage été", "stage_ete", 10)),
    match("m6", "profil-aaa", j(-1), offre("off-b6", "Bourse loin", "bourse", 13)),
    match("m7", "profil-aaa", j(-1), offre("off-b7", "Bourse close", "bourse", -1)),
    match("m8", "profil-aaa", j(-1), offre("off-b8", "Bourse inactive", "bourse", 5, False)),
]

# 40 matches pour TEL_C → 40 alertes candidates, plafond 30
FAUX.tables["matches"] += [
    match(
        f"c{i:02d}",
        "profil-ccc",
        j(-(i % 7)),
        offre(f"off-c{i:02d}", f"Offre {i}", "stage_pfe", 30),
    )
    for i in range(40)
]

ECHECS = []


def check(libelle, condition, detail=""):
    print(f"  [{'OK' if condition else 'KO'}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


def entete(tel):
    jeton, _ = creer_token(tel)
    return {"Authorization": f"Bearer {jeton}"}


def get_notifications(tel_token, tel_url=None, headers=None):
    return client.get(
        f"/api/v1/profils/{tel_url or tel_token}/notifications",
        headers=entete(tel_token) if headers is None else headers,
    )


def post_lues(tel_token, donnees, tel_url=None, headers=None):
    """POST {ids} — json= pour un corps valide, str pour un corps non-JSON."""
    url = f"/api/v1/profils/{tel_url or tel_token}/notifications/lues"
    en_tetes = entete(tel_token) if headers is None else headers
    if isinstance(donnees, (bytes, str)):  # corps non-JSON volontairement invalide
        return client.post(
            url, content=donnees, headers={**en_tetes, "content-type": "application/json"}
        )
    return client.post(url, json=donnees, headers=en_tetes)


def corps(r):
    try:
        return r.json()
    except ValueError:  # corps non-JSON (500 HTML…)
        return {}


def alertes(r):
    return corps(r).get("notifications") or []


def liens(liste):
    return {a["id"]: a["lien"] for a in liste}


# ==================== 1. GET 200 + ids stables + contrat ======================
print("\n1. GET 200 — forme exacte du contrat + 2 types d'ids stables")
r = get_notifications(TEL_A)
check("GET valide → 200", r.status_code == 200, f"reçu {r.status_code} : {corps(r)}")
check("réponse = {notifications: [...]}", set(corps(r)) == {"notifications"}, str(set(corps(r))))
liste = alertes(r)
attendus = {
    "match:m1", "match:m2", "match:m3", "match:m5", "match:m6", "match:m7", "match:m8",
    "echeance:m1:j12", "echeance:m2:j3",
}
ids = {a.get("id") for a in liste}
check(
    "ids attendus exactement (9 alertes)",
    ids == attendus,
    f"manquants={attendus - ids} / en trop={ids - attendus}",
)
check(
    "chaque entrée = {id,type,titre,texte,date,lien,lue}",
    all(set(a) == {"id", "type", "titre", "texte", "date", "lien", "lue"} for a in liste),
    str([sorted(a) for a in liste][:2]),
)
coherent = all(
    (a["type"] == "nouveau_match") == a["id"].startswith("match:")
    and a["type"] in ("nouveau_match", "echeance")
    for a in liste
)
check("type ∈ {nouveau_match, echeance} et cohérent avec l'id", coherent,
      str([(a["id"], a["type"]) for a in liste]))
check("lien nouveau_match = /offres/{offre_id}", liens(liste).get("match:m1") == "/offres/off-b1",
      str(liens(liste)))
check("lien echeance = /profil/{telephone}",
      liens(liste).get("echeance:m1:j12") == f"/profil/{TEL_A}", str(liens(liste)))
check("dates ISO AAAA-MM-JJ", all(len(a["date"]) == 10 for a in liste),
      str([a["date"] for a in liste]))
check("lue booléen", all(isinstance(a["lue"], bool) for a in liste), str([a["lue"] for a in liste]))
fuite = any("metadata" in str(a).lower() or "hash" in str(a).lower() for a in liste)
check("aucune clé interne du profil ne fuite (metadata, PIN, prefs…)", not fuite, str(liste)[:200])

# ==================== 2. Fenêtre glissante de 7 jours =========================
print("\n2. Fenêtre glissante de 7 jours pour nouveau_match")
check("match à J-7 présent (borne incluse)", "match:m3" in ids, str(sorted(ids)))
check("match à J-8 absent (borne exclue)", "match:m4" not in ids, str(sorted(ids)))
par_id = {a["id"]: a for a in liste}
check("date du match J-7 = aujourd'hui - 7", par_id.get("match:m3", {}).get("date") == j(-7),
      str({k: v["date"] for k, v in par_id.items()}))

# ==================== 3. Seuils d'échéance J-12 vs J-3 ========================
print("\n3. Seuils d'échéance J-12 vs J-3 (lecture seule de notifier.py)")
check("bourse à J-12 → id …:j12", "echeance:m1:j12" in ids, str(sorted(ids)))
check("bourse à J-3 → id …:j3", "echeance:m2:j3" in ids, str(sorted(ids)))
check("les 2 ids sont DISTINCTS", len({"echeance:m1:j12", "echeance:m2:j3"} & ids) == 2,
      str(sorted(ids)))
check("pas de seuil mixte (pas de echeance:m1:j3)", "echeance:m1:j3" not in ids, str(sorted(ids)))
exclus = {
    "bourse à J-13 ignorée (> SEUIL_J12)": "echeance:m6:",
    "bourse déjà expirée ignorée (jours < 0)": "echeance:m7:",
    "bourse inactive ignorée (active=false)": "echeance:m8:",
    "stage PFE non-bourse sans échéance": "echeance:m3:",
    "stage d'été non-bourse sans échéance": "echeance:m5:",
}
for libelle, prefixe in exclus.items():
    check(libelle, not any(i.startswith(prefixe) for i in ids), str(sorted(ids)))
check(
    "texte J-12 porte la bonne date de clôture",
    f"clôture le {j(12)}" in par_id.get("echeance:m1:j12", {}).get("texte", ""),
    str(par_id.get("echeance:m1:j12")),
)
check(
    "texte J-3 porte la bonne date de clôture",
    f"clôture le {j(3)}" in par_id.get("echeance:m2:j3", {}).get("texte", ""),
    str(par_id.get("echeance:m2:j3")),
)
ech_dates = [a["date"] for a in liste if a["type"] == "echeance"]
check("échéances datées d'aujourd'hui (alerte relevée ce jour)",
      all(d == AUJ.isoformat() for d in ech_dates), str(ech_dates))

# ==================== 4. Tri + plafond 30 =====================================
print("\n4. Tri « plus récent d'abord » + plafond 30")
dates = [a["date"] for a in liste]
check("tri date décroissante (TEL_A)", dates == sorted(dates, reverse=True), str(dates))
check("les échéances du jour arrivent en tête", dates[:2] == [AUJ.isoformat()] * 2, str(dates))

r_c = get_notifications(TEL_C)
liste_c = alertes(r_c)
check("GET TEL_C → 200", r_c.status_code == 200, str(r_c.status_code))
check("40 candidats → plafond 30", len(liste_c) == 30, f"n={len(liste_c)}")
attendus_c = {f"match:c{i:02d}" for i in range(40) if i % 7 <= 4}  # les 30 plus récents
ids_c = {a["id"] for a in liste_c}
check("les 30 retenus sont bien les 30 plus récents", ids_c == attendus_c,
      f"manquants={attendus_c - ids_c} / en trop={ids_c - attendus_c}")
dates_c = [a["date"] for a in liste_c]
check("tri date décroissante (TEL_C)", dates_c == sorted(dates_c, reverse=True), str(dates_c))
check("les 2 plus anciennes dates sont hors top 30", not ({j(-5), j(-6)} & set(dates_c)),
      str(sorted(set(dates_c))))

# ==================== 5. lue + fusion POST ====================================
print("\n5. lue (metadata) + fusion du POST")
check("match:m1 déjà lue en entrée → lue=true", par_id.get("match:m1", {}).get("lue") is True,
      str(par_id.get("match:m1")))
avant_lues = [a["id"] for a in liste if a["lue"]]
check("une seule alerte lue au départ", avant_lues == ["match:m1"], str(avant_lues))

r = post_lues(TEL_A, {"ids": ["match:m5", "echeance:m2:j3"]})
check("POST fusion valide → 200 {lues: 2}", r.status_code == 200 and corps(r) == {"lues": 2},
      f"{r.status_code} {corps(r)}")
lu = {a["id"]: a["lue"] for a in alertes(get_notifications(TEL_A))}
check("les 2 ids marqués → lue=true au GET suivant",
      lu.get("match:m5") is True and lu.get("echeance:m2:j3") is True, str(lu))
check("lue d'origine conservée (match:m1)", lu.get("match:m1") is True, str(lu))
check("les autres restent lue=false", lu.get("match:m2") is False and lu.get("match:m3") is False,
      str(lu))

r = post_lues(TEL_A, {"ids": ["match:m5", "match:m5"]})
check("doublons écrêtés → {lues: 1}", r.status_code == 200 and corps(r) == {"lues": 1},
      f"{r.status_code} {corps(r)}")

meta_a = FAUX.tables["profils"][0]["metadata"]
check("code_pin_hash intact après écriture", meta_a.get("code_pin_hash") == "hash-bidon",
      str(meta_a)[:150])
check("prefs_avancees intactes (merge, pas d'écrasement)",
      meta_a.get("prefs_avancees") == {"seuil": 40}, str(meta_a)[:150])
check("date de lecture d'origine non écrasée",
      meta_a["notifications_lues"].get("match:m1") == "2026-01-05T10:00:00+00:00",
      str(meta_a["notifications_lues"].get("match:m1")))
cles_lues = ("match:m1", "match:m5", "echeance:m2:j3")
check("les 3 ids sont persistés dans metadata['notifications_lues']",
      all(k in meta_a["notifications_lues"] for k in cles_lues),
      str(sorted(meta_a["notifications_lues"])))

# ==================== 6. Plafond 200 sur metadata lues ========================
print("\n6. Plafond 200 sur profils.metadata['notifications_lues']")
nouveaux = [f"new-{i:02d}" for i in range(20)]
r = post_lues(TEL_B, {"ids": nouveaux})
check("POST 20 ids sur 190 existants → 200 {lues: 20}",
      r.status_code == 200 and corps(r) == {"lues": 20}, f"{r.status_code} {corps(r)}")
meta_b = FAUX.tables["profils"][1]["metadata"]
lues_b = meta_b["notifications_lues"]
check("plafond respecté : 190 + 20 → 200", len(lues_b) == 200, f"n={len(lues_b)}")
check("les 20 nouveaux ids présents", all(k in lues_b for k in nouveaux), str(len(lues_b)))
anciennes = sorted(k for k in lues_b if k.startswith("old-"))
check("les 10 plus anciennes supprimées (old-000…old-009)",
      not any(f"old-{i:03d}" in lues_b for i in range(10)), str(anciennes[:12]))
check("old-010 (11e plus ancienne) conservée", "old-010" in lues_b, str("old-010" in lues_b))
check("une entrée conservée garde sa date (merge non destructif)",
      lues_b.get("old-010") == "2026-01-11T00:00:00+00:00", str(lues_b.get("old-010")))
check("code_pin_hash de B intact", meta_b.get("code_pin_hash") == "hash-bidon-2",
      str(meta_b)[:120])
r = get_notifications(TEL_B)
check("GET TEL_B (aucun match) → 200 liste vide", r.status_code == 200 and alertes(r) == [],
      f"{r.status_code} {corps(r)}")

# ==================== 7. Garde Bearer + profil absent =========================
print("\n7. Garde Bearer (401 / 403) + profil absent (404)")
r = get_notifications(TEL_A, headers={})
check("GET sans Bearer → 401", r.status_code == 401, f"{r.status_code} {corps(r)}")
r = get_notifications(TEL_A, headers=entete(TEL_B))
check("GET Bearer d'un autre tel → 403", r.status_code == 403, f"{r.status_code} {corps(r)}")
r = post_lues(TEL_A, {"ids": ["match:m2"]}, headers={})
check("POST sans Bearer → 401", r.status_code == 401, f"{r.status_code} {corps(r)}")
r = post_lues(TEL_A, {"ids": ["match:m2"]}, headers=entete(TEL_B))
check("POST Bearer d'un autre tel → 403", r.status_code == 403, f"{r.status_code} {corps(r)}")
r = get_notifications(TEL_ABSENT)
check("GET profil absent → 404", r.status_code == 404, f"{r.status_code} {corps(r)}")
r = post_lues(TEL_ABSENT, {"ids": ["match:zzz"]})
check("POST profil absent → 404", r.status_code == 404, f"{r.status_code} {corps(r)}")
check("un refus n'écrit rien (toujours 3 écritures)", FAUX.maj.get("profils") == 3, str(FAUX.maj))

# ==================== 8. 422 corps invalide ===================================
print("\n8. 422 corps invalide (et 422 = RIEN d'écrit)")
avant = copy.deepcopy(FAUX.tables["profils"][0]["metadata"]["notifications_lues"])
cas_422 = [
    ("ids chaine non listée", {"ids": "match:m5"}),
    ("ids manquant", {}),
    ("ids non-str (int)", {"ids": [1, 2]}),
    ("> 1000 ids (garde-fou)", {"ids": [f"x{i}" for i in range(1001)]}),
]
for libelle, donnees in cas_422:
    r = post_lues(TEL_A, donnees)
    check(f"422 — {libelle}", r.status_code == 422, f"{r.status_code} {str(corps(r))[:120]}")
r = post_lues(TEL_A, "pas-du-json")
check("422 — corps JSON malformé", r.status_code == 422, f"{r.status_code} {str(corps(r))[:120]}")
inchange = FAUX.tables["profils"][0]["metadata"]["notifications_lues"] == avant
check("aucune écriture après les 422", inchange and FAUX.maj.get("profils") == 3, str(FAUX.maj))

# ==================== 9. Lecture seule (zéro envoi, zéro insert) ===============
print("\n9. Lecture seule : zéro insert, zéro état WhatsApp, zéro appel réseau")
check("zéro insert sur toute la preuve", FAUX.appels_insert == 0,
      f"appels_insert={FAUX.appels_insert}")
check("aucune mise à jour de la table matches (aucun état WhatsApp)",
      "matches" not in FAUX.maj, str(FAUX.maj))
check("seules écritures = 3 merges metadata sur profils", FAUX.maj.get("profils") == 3,
      str(FAUX.maj))
barriere = [
    (_canal, "envoyer_notification"),
    (_mail, "envoyer_email"),
    (_notifier, "envoyer_notification"),
    (_sender, "envoyer_message_texte"),
]
check("canaux d'envoi remplacés par une barrière qui lève",
      all(getattr(m, nom) is _interdit for m, nom in barriere), "")

# ==================== 10. Enregistrement main.py =============================
print("\n10. Enregistrement des routes dans app/main.py")
attendues = [
    "/api/v1/profils/{telephone}/notifications",
    "/api/v1/profils/{telephone}/notifications/lues",
]
try:
    from apps.api.app import main as main_module

    chemins_api = sorted(main_module.app.openapi().get("paths", {}))
    for attendu in attendues:
        check(f"main.py expose {attendu}", attendu in chemins_api, str(chemins_api)[:300])
    routes_seules = sorted(app.openapi().get("paths", {}))
    check("le module n'expose QUE ces 2 routes", routes_seules == attendues, str(routes_seules))
except Exception as e:  # noqa: BLE001 — toute erreur d'import devient un KO lisible
    check("import de app/main.py", False, f"{type(e).__name__}: {e}")

# --------------------------------- Bilan --------------------------------------
print(f"\n{'=' * 60}")
if ECHECS:
    print(f"RÉSULTAT : {len(ECHECS)} échec(s) → {ECHECS}")
    sys.exit(1)
print("RÉSULTAT : 100 % des checks sont VERTS (zéro réseau, zéro migration SQL).")
