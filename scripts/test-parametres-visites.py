"""Preuve MOCKÉE des réglages du site + compteur de visites (backend FastAPI).

Zéro réseau, zéro migration SQL : le module `supabase` est remplacé par un
factice en mémoire AVANT tout import de l'application (le faux client émule les
défauts Postgres : `visites.jour = current_date`, `id bigserial`, `cree_le`,
`parametres.modifie_le`, et le `ON CONFLICT (cle) DO UPDATE` de l'upsert).

Prouve :
   1. GET /api/v1/parametres (public) → 200, objet PLAT {cle: valeur} des seules
      clés publiques (les clés privées ne fuitent jamais) ; table absente ou vide
      → {} (jamais 500) ;
   2. PUT /api/v1/admin/parametres → 401 sans identité, 403 identité fausse,
      200 avec cookie lawol_admin / x-admin-token / Authorization Bearer ;
      réponse exactement {cle, valeur, modifie_le} ; upsert (une seule ligne par
      clé, modifie_le actualisé) ; valeur = n'importe quel JSON ;
   3. POST /api/v1/visites (public) → 201 {ok: true} ; chemin assaini (caractères
      de contrôle retirés), borné ≤ 200 car., vide → « / » ; `jour` posé par le
      défaut Postgres (current_date) ; corps invalide → 422 sans écriture ;
      table absente → 201 {ok: true} quand même (jamais 500) ;
   4. GET /api/v1/admin/stats/visites → gardé ; {total, par_jour} ; par_jour =
      30 derniers jours (J-29 inclus, J-30 exclu), croissant, sans remplissage
      des jours manquants ; total = toutes périodes ; table absente → zéros ;
   5. main.py enregistre bien les 4 routes ;
   6. `_admin_autorise` a une définition UNIQUE (modules/auth/admin.py) importée
      par parametres ET par entreprises — jamais dupliquée.

Usage : python -X utf8 scripts/test-parametres-visites.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import copy
import os
import sys
import types
from datetime import date, datetime, timedelta, timezone
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
    """Chaîne PostgREST minimale : select/eq/in_/gte/order/limit/insert/upsert."""

    def __init__(self, base, nom):
        self._base, self._nom = base, nom
        self._mode, self._compte = "select", False
        self._filtres = []  # (opérateur, colonne, valeur)
        self._donnees, self._on_conflict = None, None
        self._tri, self._limite = None, None

    def select(self, colonnes="*", count=None):
        self._mode, self._compte = "select", count == "exact"
        return self

    def eq(self, colonne, valeur):
        self._filtres.append(("eq", colonne, valeur))
        return self

    def in_(self, colonne, valeurs):
        self._filtres.append(("in", colonne, list(valeurs)))
        return self

    def gte(self, colonne, valeur):
        self._filtres.append(("gte", colonne, valeur))
        return self

    def order(self, colonne, desc=False):
        self._tri = (colonne, desc)
        return self

    def limit(self, n):
        self._limite = n
        return self

    def insert(self, donnees):
        self._mode, self._donnees = "insert", donnees
        return self

    def upsert(self, donnees, on_conflict=None):
        self._mode, self._donnees, self._on_conflict = "upsert", donnees, on_conflict
        return self

    def update(self, donnees):
        self._mode, self._donnees = "update", donnees
        return self

    def _correspond(self, ligne):
        for operateur, colonne, valeur in self._filtres:
            actuelle = ligne.get(colonne)
            if operateur == "eq" and actuelle != valeur:
                return False
            if operateur == "in" and actuelle not in valeur:
                return False
            if operateur == "gte" and not (actuelle is not None and actuelle >= valeur):
                return False
        return True

    def _defauts(self, donnees):
        """Émule les défauts Postgres au moment de l'INSERT."""
        ligne = dict(donnees or {})
        if self._nom == "visites":
            ligne.setdefault("id", self._base.prochain_id("visites"))
            ligne.setdefault("jour", date.today().isoformat())  # current_date
            ligne.setdefault("cree_le", datetime.now(timezone.utc).isoformat())
        elif self._nom == "parametres":
            ligne.setdefault("modifie_le", datetime.now(timezone.utc).isoformat())
        return ligne

    def execute(self):
        if self._nom in self._base.absentes:
            raise RuntimeError(f'relation "public.{self._nom}" does not exist (42P01)')

        table = self._base.tables.setdefault(self._nom, [])

        if self._mode == "select":
            toutes = [ligne for ligne in table if self._correspond(ligne)]
            compte = len(toutes) if self._compte else None
            lignes = toutes
            if self._tri:
                colonne, desc = self._tri
                lignes = sorted(lignes, key=lambda r: str(r.get(colonne) or ""), reverse=desc)
            if self._limite is not None:
                lignes = lignes[: self._limite]
            return _Resultat([copy.deepcopy(x) for x in lignes], compte)

        if self._mode == "insert":
            journal = copy.deepcopy(self._donnees)
            self._base.ecritures.append(("insert", self._nom, journal))
            ligne = self._defauts(self._donnees)
            table.append(ligne)
            return _Resultat([copy.deepcopy(ligne)])

        if self._mode == "upsert":
            journal = copy.deepcopy(self._donnees)
            self._base.ecritures.append(("upsert", self._nom, journal))
            ligne = self._defauts(self._donnees)
            conflit = self._on_conflict or "cle"
            for existante in table:
                if existante.get(conflit) == ligne.get(conflit):
                    existante.update(ligne)  # ON CONFLICT (cle) DO UPDATE
                    return _Resultat([copy.deepcopy(existante)])
            table.append(ligne)
            return _Resultat([copy.deepcopy(ligne)])

        if self._mode == "update":
            modifiees = [ligne for ligne in table if self._correspond(ligne)]
            for ligne in modifiees:
                ligne.update(copy.deepcopy(self._donnees))
            return _Resultat([copy.deepcopy(x) for x in modifiees])

        raise AssertionError(f"mode inattendu : {self._mode}")


class _FauxSupabase:
    def __init__(self):
        self.tables = {}
        self.absentes = set()  # tables qui lèvent (migration non appliquée)
        self.ecritures = []  # journal (opération, table, données)
        self._ids = {}

    def prochain_id(self, nom):
        self._ids[nom] = self._ids.get(nom, 0) + 1
        return self._ids[nom]

    def table(self, nom):
        return _FauxTable(self, nom)


FAUX = _FauxSupabase()
_module_supabase = types.ModuleType("supabase")
_module_supabase.Client = object
_module_supabase.create_client = lambda url, key=None, **kwargs: FAUX
sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Application ----------------------------------
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from apps.api.app.core.config import settings  # noqa: E402
from apps.api.app.modules.parametres.routes import router  # noqa: E402

# Identité admin de test : le token attendu est le hash configuré. On le fixe
# (jamais un secret réel) pour rendre la preuve déterministe quel que soit .env.
TOKEN_ADMIN = "hash-admin-de-test-bidon"
settings.ADMIN_PASSWORD_HASH = TOKEN_ADMIN

app = FastAPI()
app.include_router(router)
client = TestClient(app)

AUJ = date.today()
CLES_PUBLIQUES = {"support_whatsapp", "email_contact", "reseaux", "mode_maintenance"}
ENTETE_ADMIN = {"x-admin-token": TOKEN_ADMIN}
HORS_FENETRE = -30


def j(n: int) -> str:
    """Date ISO de n jours par rapport à aujourd'hui."""
    return (AUJ + timedelta(days=n)).isoformat()


def visite(jour: str) -> dict:
    return {"jour": jour, "chemin": "/x"}


FAUX.tables["parametres"] = [
    {"cle": "support_whatsapp", "valeur": ["+222 48168149"], "modifie_le": "2026-10-16"},
    {"cle": "email_contact", "valeur": "contact@lawol.mr", "modifie_le": "2026-10-16"},
    {"cle": "mode_maintenance", "valeur": False, "modifie_le": "2026-10-16"},
    {"cle": "secret_interne", "valeur": "ne-pas-exposer", "modifie_le": "2026-10-16"},
    # « reseaux » volontairement absent → il apparaîtra après un PUT.
]

FAUX.tables["visites"] = (
    [visite(j(0)) for _ in range(3)]  # aujourd'hui : 3
    + [visite(j(-1)) for _ in range(2)]  # J-1 : 2
    + [visite(j(-29))]  # J-29 : dans la fenêtre
    + [visite(j(HORS_FENETRE))]  # J-30 : hors fenêtre
    + [visite(j(-90))]  # J-90 : hors fenêtre
)

ECHECS = []


def check(libelle, condition, detail=""):
    etat = "OK" if condition else "KO"
    print(f"  [{etat}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


def corps(r):
    try:
        return r.json()
    except ValueError:  # corps non-JSON
        return {}


def ko(r, c=None):
    """Détail d'échec compact : code HTTP + corps."""
    return f"{r.status_code} {corps(r) if c is None else c}"


def lignes_parametre(cle):
    return [ligne for ligne in FAUX.tables["parametres"] if ligne.get("cle") == cle]


# ==================== 1. GET public /api/v1/parametres =========================
print("\n1. GET /api/v1/parametres (public, objet plat des seules clés publiques)")
r = client.get("/api/v1/parametres")
c = corps(r)
plat = isinstance(c, dict) and "valeur" not in c
check("GET → 200", r.status_code == 200, ko(r, c))
check("objet plat {cle: valeur} (aucune enveloppe)", plat, str(c))
check("clés exposées ⊆ clés publiques", set(c) <= CLES_PUBLIQUES, str(sorted(c)))
check("aucune clé privée exposée", "secret_interne" not in c, str(sorted(c)))
reseau = c.get("support_whatsapp")
check("valeur liste conservée (support_whatsapp)", reseau == ["+222 48168149"], str(reseau))
check("valeur booléenne conservée (mode_maintenance)", c.get("mode_maintenance") is False, str(c))
check("clé absente simplement omise (reseaux)", "reseaux" not in c, str(sorted(c)))

# table vide → {}
sauvegarde = FAUX.tables["parametres"]
FAUX.tables["parametres"] = []
r = client.get("/api/v1/parametres")
check("table vide → 200 {}", r.status_code == 200 and corps(r) == {}, ko(r))
FAUX.tables["parametres"] = sauvegarde

# table absente → {} (jamais 500)
FAUX.absentes.add("parametres")
r = client.get("/api/v1/parametres")
check("table absente → 200 {} (jamais 500)", r.status_code == 200 and corps(r) == {}, ko(r))
FAUX.absentes.discard("parametres")

# ==================== 2. PUT admin /api/v1/admin/parametres ====================
print("\n2. PUT /api/v1/admin/parametres (garde + upsert + JSON libre)")
url_admin = "/api/v1/admin/parametres"
corps_reseaux = {"cle": "reseaux", "valeur": {}}
r = client.put(url_admin, json=corps_reseaux)
check("sans identité → 401", r.status_code == 401, ko(r))
r = client.put(url_admin, json=corps_reseaux, headers={"x-admin-token": "mauvais"})
check("token faux → 403", r.status_code == 403, ko(r))
r = client.put(url_admin, json=corps_reseaux, cookies={"lawol_admin": "garbage"})
check("cookie faux → 403", r.status_code == 403, ko(r))
aucune = lignes_parametre("reseaux") == []
check("aucune écriture par les appels refusés", aucune, str(FAUX.ecritures))

reseaux = {"facebook": "https://facebook.com/lawol", "linkedin": "https://linkedin.com/c"}
r = client.put(url_admin, json={"cle": "reseaux", "valeur": reseaux}, headers=ENTETE_ADMIN)
c = corps(r)
check("x-admin-token valide → 200", r.status_code == 200, ko(r, c))
forme = set(c) == {"cle", "valeur", "modifie_le"}
check("réponse exactement {cle, valeur, modifie_le}", forme, str(c))
check("cle/valeur enregistrées", c.get("cle") == "reseaux" and c.get("valeur") == reseaux, str(c))
try:
    datetime.fromisoformat(str(c.get("modifie_le")).replace("Z", "+00:00"))
    horodatage_ok = True
except ValueError:
    horodatage_ok = False
check("modifie_le ISO 8601", horodatage_ok, str(c.get("modifie_le")))

# cookie de session admin accepté, puis Authorization Bearer (même garde)
r = client.put(
    url_admin,
    json={"cle": "email_contact", "valeur": "hello@lawol.mr"},
    cookies={"lawol_admin": "authenticated"},
)
check("cookie lawol_admin=authenticated → 200", r.status_code == 200, ko(r))
r = client.put(
    url_admin,
    json={"cle": "mode_maintenance", "valeur": True},
    headers={"Authorization": f"Bearer {TOKEN_ADMIN}"},
)
check("Authorization Bearer valide → 200", r.status_code == 200, ko(r))

# upsert : une seule ligne par clé, modifie_le actualisé
avant = lignes_parametre("support_whatsapp")[0]["modifie_le"]
r = client.put(
    url_admin, json={"cle": "support_whatsapp", "valeur": ["+222 11111111"]}, headers=ENTETE_ADMIN
)
check("upsert d'une clé existante → 200", r.status_code == 200, ko(r))
apres = lignes_parametre("support_whatsapp")
check("…une seule ligne pour la clé (pas de doublon)", len(apres) == 1, str(len(apres)))
check("…modifie_le actualisé", apres[0]["modifie_le"] != avant, "horodatage inchangé")

# valeur = n'importe quel JSON ; clé privée jamais exposée publiquement
cas_json = [
    ("json_objet", {"a": 1}),
    ("json_liste", [1, 2, 3]),
    ("json_nombre", 42),
    ("json_null", None),
    ("json_booleen", True),
]
for cle, valeur in cas_json:
    r = client.put(url_admin, json={"cle": cle, "valeur": valeur}, headers=ENTETE_ADMIN)
    ok_json = r.status_code == 200 and corps(r).get("valeur") == valeur
    check(f"valeur JSON libre acceptée ({cle})", ok_json, ko(r))
r = client.put(url_admin, json={"cle": "  cle_espaces  ", "valeur": 1}, headers=ENTETE_ADMIN)
nettoyee = r.status_code == 200 and bool(lignes_parametre("cle_espaces"))
check("clé nettoyée (espaces retirés)", nettoyee, ko(r))
r = client.put(url_admin, json={"cle": "   ", "valeur": 1}, headers=ENTETE_ADMIN)
check("clé vide → 422 (aucune écriture)", r.status_code == 422, ko(r))
r = client.put(url_admin, json={"cle": "x" * 200, "valeur": 1}, headers=ENTETE_ADMIN)
check("clé trop longue → 422", r.status_code == 422, ko(r))
r = client.put(url_admin, json={"cle": "sans_valeur"}, headers=ENTETE_ADMIN)
check("champ valeur absent → 422", r.status_code == 422, ko(r))

# la valeur écrite est bien relue par le GET public (clé publique)
r = client.get("/api/v1/parametres")
check("GET public relit reseaux tel quel", corps(r).get("reseaux") == reseaux, str(corps(r))[:200])
privee_absente = "json_objet" not in corps(r)
check("clé privée (json_objet) jamais publique", privee_absente, str(sorted(corps(r))))

# ==================== 3. POST /api/v1/visites ==================================
print("\n3. POST /api/v1/visites (public, assainissement, jamais 500)")
avant_visites = len(FAUX.tables["visites"])
r = client.post("/api/v1/visites", json={"chemin": "/offres/bourse-abc"})
check("POST sans auth (public) → 201", r.status_code == 201, ko(r))
check("réponse exactement {ok: true}", corps(r) == {"ok": True}, str(corps(r)))
nouvelle = FAUX.tables["visites"][-1]
check("une visite insérée", len(FAUX.tables["visites"]) == avant_visites + 1, str(nouvelle))
check("chemin conservé", nouvelle.get("chemin") == "/offres/bourse-abc", str(nouvelle))
check("jour = aujourd'hui (current_date)", nouvelle.get("jour") == AUJ.isoformat(), str(nouvelle))
derniers = [d for (op, table, d) in FAUX.ecritures if op == "insert" and table == "visites"]
check("jour NON envoyé par l'API (défaut Postgres)", "jour" not in derniers[-1], str(derniers[-1]))

# chemin très long → borné ≤ 200 (jamais d'erreur)
r = client.post("/api/v1/visites", json={"chemin": "/" + "a" * 500})
check("chemin trop long → 201 (borné)", r.status_code == 201, ko(r))
long_chemin = FAUX.tables["visites"][-1]["chemin"]
check("chemin stocké ≤ 200 caractères", len(long_chemin) == 200, str(len(long_chemin)))
check("chemin long tronqué (préfixe conservé)", long_chemin == "/" + "a" * 199, long_chemin[:20])

# caractères de contrôle retirés
client.post("/api/v1/visites", json={"chemin": "/a\x00b\nc\td"})
stocke = FAUX.tables["visites"][-1]["chemin"]
check("caractères de contrôle retirés", stocke == "/abcd", repr(stocke))

# chemin vide / blanc → « / » (la colonne est NOT NULL)
for brut in ("", "   "):
    r = client.post("/api/v1/visites", json={"chemin": brut})
    stocke = FAUX.tables["visites"][-1]["chemin"]
    check(f"chemin {brut!r} → 201 « / »", r.status_code == 201 and stocke == "/", repr(stocke))

# corps invalide : 422 et RIEN écrit
avant_visites = len(FAUX.tables["visites"])
r = client.post("/api/v1/visites", json={})
check("chemin absent → 422", r.status_code == 422, ko(r))
aucune = len(FAUX.tables["visites"]) == avant_visites
check("422 = aucune visite écrite", aucune, str(avant_visites))

# table absente → 201 {ok:true}, jamais 500
FAUX.absentes.add("visites")
r = client.post("/api/v1/visites", json={"chemin": "/ok"})
check("table absente → 201 {ok:true}", r.status_code == 201 and corps(r) == {"ok": True}, ko(r))
FAUX.absentes.discard("visites")

# ==================== 4. GET admin /api/v1/admin/stats/visites =================
print("\n4. GET /api/v1/admin/stats/visites (garde + fenêtre 30 jours)")
url_stats = "/api/v1/admin/stats/visites"
r = client.get(url_stats)
check("sans identité → 401", r.status_code == 401, ko(r))
r = client.get(url_stats, headers={"x-admin-token": "mauvais"})
check("token faux → 403", r.status_code == 403, ko(r))

# jeu de données maîtrisé pour la fenêtre
FAUX.tables["visites"] = (
    [visite(j(0)) for _ in range(3)]
    + [visite(j(-1)) for _ in range(2)]
    + [visite(j(-29))]
    + [visite(j(HORS_FENETRE))]
    + [visite(j(-90))]
)
r = client.get(url_stats, headers=ENTETE_ADMIN)
c = corps(r)
check("x-admin-token valide → 200", r.status_code == 200, ko(r, c))
check("réponse exactement {total, par_jour}", set(c) == {"total", "par_jour"}, str(sorted(c)))
check("total = toutes périodes (8)", c.get("total") == 8, str(c.get("total")))
jours = {ligne["jour"]: ligne["nb"] for ligne in c.get("par_jour", [])}
check("par_jour J-29 inclus (1)", jours.get(j(-29)) == 1, str(jours))
check("par_jour J-30 EXCLU", j(HORS_FENETRE) not in jours, str(jours))
check("par_jour J-90 EXCLU", j(-90) not in jours, str(jours))
check("par_jour aujourd'hui = 3", jours.get(j(0)) == 3, str(jours))
check("par_jour J-1 = 2", jours.get(j(-1)) == 2, str(jours))
check("zéro remplissage : seuls 3 jours présents", len(c.get("par_jour", [])) == 3, str(jours))
liste_jours = [ligne["jour"] for ligne in c["par_jour"]]
check("par_jour trié croissant", liste_jours == sorted(jours), str(liste_jours))
check("forme des entrées {jour, nb}", all(set(x) == {"jour", "nb"} for x in c["par_jour"]), str(c))

# table absente → zéros (dégradation douce, jamais 500)
FAUX.absentes.add("visites")
r = client.get(url_stats, headers=ENTETE_ADMIN)
attendu = {"total": 0, "par_jour": []}
vide = r.status_code == 200 and corps(r) == attendu
check("table absente → 200 {total:0, par_jour:[]}", vide, ko(r))
FAUX.absentes.discard("visites")

# ==================== 5. Enregistrement dans app/main.py =======================
print("\n5. Enregistrement des routeurs dans app/main.py")
try:
    from apps.api.app import main as main_module  # noqa: E402

    chemins = sorted(main_module.app.openapi().get("paths", {}))
    for attendu in (
        "/api/v1/parametres",
        url_admin,
        "/api/v1/visites",
        url_stats,
    ):
        check(f"main.py expose {attendu}", attendu in chemins, str(chemins)[:300])
except Exception as e:  # noqa: BLE001 — toute erreur d'import devient un KO lisible
    check("import de app/main.py", False, f"{type(e).__name__}: {e}")

# ==================== 6. Garde admin réutilisée ================================
print("\n6. `_admin_autorise` réutilisée (définition unique, jamais dupliquée)")
try:
    import apps.api.app.modules.parametres.routes as module_parametres  # noqa: E402
    from apps.api.app.modules.auth.admin import (  # noqa: E402
        _admin_autorise as garde_partagee,
    )

    check(
        "parametres importe la MÊME fonction que modules/auth/admin.py",
        module_parametres._admin_autorise is garde_partagee,
        "fonctions différentes → la garde a été dupliquée",
    )
    # entreprises/routes.py est inimportable depuis l'archivage des modèles
    # entreprise (commit d884e2f) : on prouve statiquement qu'il ne REDÉFINIT
    # plus la garde mais pointe sur la définition unique.
    chemin_entreprises = RACINE / "apps" / "api" / "app" / "modules" / "entreprises" / "routes.py"
    source = chemin_entreprises.read_text(encoding="utf-8")
    check(
        "entreprises/routes.py pointe sur la garde partagée",
        "from apps.api.app.modules.auth.admin import _admin_autorise" in source
        and "def _admin_autorise" not in source,
        "définition locale encore présente",
    )
except Exception as e:  # noqa: BLE001
    check("import de la garde admin", False, f"{type(e).__name__}: {e}")

# --------------------------------- Bilan --------------------------------------
print(f"\n{'=' * 60}")
if ECHECS:
    print(f"RÉSULTAT : {len(ECHECS)} échec(s) → {ECHECS}")
    sys.exit(1)
print("RÉSULTAT : 100 % des checks sont VERTS (zéro réseau, zéro migration SQL).")
