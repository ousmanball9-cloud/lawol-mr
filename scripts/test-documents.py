"""Preuve MOCKÉE du coffre-fort de documents (backend FastAPI) — zéro réseau.

Patch : le module `supabase` est remplacé par un factice en mémoire AVANT tout
import de l'application → `create_client()` ne touche jamais le réseau et
aucun secret réel n'est utilisé (SESSION_SECRET de test bidon).

Prouve :
   1. upload valide → 201 + {documents:[{id,nom,taille,mime,created_at}]} exact ;
   2. chemin Storage = documents/{tel DU TOKEN}/{uuid}/{nom} dans le bucket
      privé `documents` (get_public_url lève si on l'appelle) ;
   3. nom traversant « ../../evil.pdf » → normalisé (ni /, ni ..) ;
   4. extension hors whitelist → 415 ; MIME contredisant l'extension → 415 ;
      les 7 extensions autorisées passent (pdf, jpg, jpeg, png, webp, doc, docx) ;
   5. > 5 Mo → 413 AVANT écriture ; 5 Mo pile → 201 ;
   6. quota 10 → 11e document → 413 (puis un delete libère la place) ;
   7. sans Bearer → refus (401, garde identique aux mutants du profil) ;
      Bearer d'un autre téléphone → 403 sur les 3 routes ;
   8. delete d'un id appartenant à un autre profil → 404 (zéro fuite) ;
   9. delete valide → 200 + objet retiré du Storage + liste restante ;
  10. profil absent → 404 (3 routes) ; code_pin_hash/prefs intacts après écriture ;
  11. main.py enregistre bien le routeur documents ;
  12. lien de consultation : GET .../url → URL SIGNÉE du bucket privé (60 s),
      clé signée sous le préfixe du profil, réponse = {url, expire_dans} sans
      chemin Storage ; « masquer le token n'expose rien » (sans Bearer → 401,
      autre téléphone → 403, id d'un autre profil → 404), aucune URL publique
      permanente (get_public_url jamais appelé).

Usage : python -X utf8 scripts/test-documents.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import copy
import os
import sys
import types
from datetime import datetime
from pathlib import Path
from uuid import UUID

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)


# ------------------------- Faux Supabase (zéro réseau) -------------------------
class _Resultat:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _FauxBucket:
    def __init__(self, storage, nom):
        self._storage, self._nom = storage, nom

    def upload(self, chemin, contenu, options=None):
        if self._nom != "documents":
            raise AssertionError(f"bucket inattendu : {self._nom!r} (attendu 'documents')")
        self._storage.objets[(self._nom, chemin)] = bytes(contenu)
        self._storage.options[(self._nom, chemin)] = options or {}
        return {"id": chemin, "path": chemin}

    def remove(self, chemins):
        for chemin in chemins:
            self._storage.objets.pop((self._nom, chemin), None)
        return {"message": "ok"}

    def get_public_url(self, chemin):
        self._storage.public_urls.append(chemin)
        raise AssertionError("bucket documents : get_public_url interdit (bucket privé)")

    def create_signed_url(self, chemin, expires_in, options=None):
        """URL signée factice : même forme que storage3 (clé relative au bucket)."""
        if self._nom != "documents":
            raise AssertionError(f"bucket inattendu : {self._nom!r} (attendu 'documents')")
        if chemin.startswith("documents/") or chemin.startswith("/"):
            raise AssertionError(f"clé signée non relative au bucket : {chemin!r}")
        if (self._nom, chemin) not in self._storage.objets:
            raise AssertionError(f"signature d'un objet inexistant : {chemin!r}")
        jeton = f"jeton-ephemere-{len(self._storage.signes) + 1}"
        self._storage.signes.append(
            {"bucket": self._nom, "chemin": chemin, "expire_in": expires_in, "jeton": jeton}
        )
        url = (
            f"https://faux.supabase.co/storage/v1/object/sign/documents/{chemin}"
            f"?token={jeton}&expiresIn={expires_in}"
        )
        return {"signedURL": url, "signedUrl": url}


class _FauxStorage:
    def __init__(self):
        self.objets = {}  # (bucket, chemin) -> bytes
        self.options = {}  # (bucket, chemin) -> options d'upload
        self.signes = []  # create_signed_url : {bucket, chemin, expire_in, jeton}
        self.public_urls = []  # get_public_url : doit rester VIDE (bucket privé)

    def from_(self, nom):
        return _FauxBucket(self, nom)


class _FauxTable:
    def __init__(self, base, nom):
        self._base, self._nom, self._mode = base, nom, "select"
        self._filtres, self._donnees = [], None

    def select(self, colonnes="*"):
        self._mode = "select"
        return self

    def eq(self, colonne, valeur):
        self._filtres.append((colonne, valeur))
        return self

    def update(self, donnees):
        self._mode, self._donnees = "update", donnees
        return self

    def insert(self, donnees):
        raise AssertionError("insert non attendu dans cette preuve")

    def execute(self):
        lignes = [
            ligne
            for ligne in self._base.tables.setdefault(self._nom, [])
            if all(ligne.get(c) == v for c, v in self._filtres)
        ]
        if self._mode == "select":
            return _Resultat([copy.deepcopy(l) for l in lignes])  # = aller-retour JSON
        if self._mode == "update":
            if getattr(self._base, "bloquer_maj", False):
                return _Resultat([])  # update « silencieux » = panne Supabase
            for ligne in lignes:
                ligne.update(copy.deepcopy(self._donnees))
            return _Resultat([copy.deepcopy(l) for l in lignes])
        raise AssertionError(f"mode inattendu : {self._mode}")


class _FauxSupabase:
    def __init__(self):
        self.tables = {}
        self.storage = _FauxStorage()
        self.bloquer_maj = False  # simule un update qui n'écrit rien (panne)

    def table(self, nom):
        return _FauxTable(self, nom)


FAUX = _FauxSupabase()
_module_supabase = types.ModuleType("supabase")
_module_supabase.Client = object
_module_supabase.create_client = lambda url, key=None, **kwargs: FAUX
sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Application ----------------------------------
from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.api.app.modules.auth.session import creer_token
from apps.api.app.modules.documents.routes import (
    router as documents_router,
)

app = FastAPI()
app.include_router(documents_router)
client = TestClient(app)

TEL_A = "22136000001"  # profil principal (whitelist via TEL_C, tailles via TEL_B)
TEL_B = "22136000002"  # profil des tests de taille
TEL_C = "22136000003"  # profil des tests de whitelist
TEL_ABSENT = "22136099999"
MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

FAUX.tables["profils"] = [
    {
        "id": "profil-aaa",
        "telephone": TEL_A,
        "metadata": {"code_pin_hash": "hash-bidon", "prefs_avancees": {"seuil": 40}},
    },
    {
        "id": "profil-bbb",
        "telephone": TEL_B,
        "metadata": {"code_pin_hash": "hash-bidon-2", "prefs_avancees": {"seuil": 55}},
    },
    {
        "id": "profil-ccc",
        "telephone": TEL_C,
        "metadata": {"code_pin_hash": "hash-bidon-3"},
    },
]

ECHECS = []


def check(libelle, condition, detail=""):
    print(f"  [{'OK' if condition else 'KO'}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


def entete(tel):
    jeton, _ = creer_token(tel)
    return {"Authorization": f"Bearer {jeton}"}


def deposer(tel_token, contenu, nom="doc.pdf", mime="application/pdf", tel_url=None, headers=None):
    return client.post(
        f"/api/v1/profils/{tel_url or tel_token}/documents",
        files={"fichier": (nom, contenu, mime)},
        headers=entete(tel_token) if headers is None else headers,
    )


def liste(tel_token, tel_url=None, headers=None):
    return client.get(
        f"/api/v1/profils/{tel_url or tel_token}/documents",
        headers=entete(tel_token) if headers is None else headers,
    )


def supprimer(tel_token, doc_id, tel_url=None, headers=None):
    return client.delete(
        f"/api/v1/profils/{tel_url or tel_token}/documents/{doc_id}",
        headers=entete(tel_token) if headers is None else headers,
    )


def objets(tel):
    return [c for (_b, c) in FAUX.storage.objets if c.startswith(f"{tel}/")]


def corps(r):
    try:
        return r.json()
    except ValueError:  # corps non-JSON (500 HTML…)
        return {}


# ============================ 1. Upload valide =================================
print("\n1. Upload valide (201) + forme de la réponse")
r = deposer(TEL_A, b"%PDF-1.4 test", nom="mon_cv.pdf")
check("POST upload valide → 201", r.status_code == 201, f"reçu {r.status_code} : {corps(r)}")
docs = corps(r).get("documents", [])
check("réponse = {documents: [...]}", isinstance(docs, list) and len(docs) == 1, str(corps(r))[:200])
entree = docs[0] if docs else {}
cles = set(entree)
check(
    "entrée = {id,nom,taille,mime,created_at} exact",
    cles == {"id", "nom", "taille", "mime", "created_at"},
    f"clés {sorted(cles)}",
)
check("nom conservé", entree.get("nom") == "mon_cv.pdf", str(entree.get("nom")))
check("taille = octets envoyés", entree.get("taille") == len(b"%PDF-1.4 test"), str(entree.get("taille")))
check("mime dérivé de l'extension", entree.get("mime") == "application/pdf", str(entree.get("mime")))
try:
    datetime.fromisoformat(entree.get("created_at", ""))
    date_ok = True
except ValueError:
    date_ok = False
check("created_at ISO 8601", date_ok, str(entree.get("created_at")))
try:
    UUID(entree.get("id", ""))
    uuid_ok = True
except ValueError:
    uuid_ok = False
check("id = uuid4", uuid_ok, str(entree.get("id")))

# ============================ 2. Chemin / bucket ==============================
print("\n2. Bucket privé + chemin reconstruit depuis le token")
chemin_attendu = f"{TEL_A}/{entree['id']}/mon_cv.pdf"
check(
    "objet Stocké sous documents/{tel du token}/{uuid}/{nom}",
    ("documents", chemin_attendu) in FAUX.storage.objets,
    f"objets = {objets(TEL_A)}",
)
opts = FAUX.storage.options.get(("documents", chemin_attendu), {})
check("upload content-type servié = mime canonique", opts.get("content-type") == "application/pdf", str(opts))
check("upsert=False (pas d'écrasement)", opts.get("upsert") is False, str(opts))
check(
    "tous les objets du profil sont sous son propre préfixe",
    all(c.startswith(f"{TEL_A}/") for c in objets(TEL_A)),
    str(objets(TEL_A)),
)
check(
    "aucun objet sous le préfixe d'un autre profil",
    not any(c.startswith(f"{TEL_B}/") for c in objets(TEL_A)),
    "",
)

# ============================ 3. Nom traversant ===============================
print("\n3. Normalisation du nom de fichier")
r = deposer(TEL_A, b"evil", nom="../../evil.pdf")
c = corps(r)
check("nom traversant accepté (extension valide) → 201", r.status_code == 201, f"{r.status_code} {c}")
nom_evil = (c.get("documents") or [{}])[-1].get("nom", "")
check("nom normalisé sans / ni ..", "/" not in nom_evil and ".." not in nom_evil, nom_evil)
check("le nom normalisé est 'evil.pdf'", nom_evil == "evil.pdf", nom_evil)
r = deposer(TEL_A, b"evil2", nom="..\\..\\windows\\system32\\hack.pdf")
docs_r = corps(r).get("documents") or []
nom_w = docs_r[-1].get("nom", "") if docs_r else ""
ok_windows = r.status_code == 201 and "/" not in nom_w and ".." not in nom_w
check("séparateur Windows neutralisé (nom sans / ni ..)", ok_windows, f"{r.status_code} {nom_w!r}")

# ============================ 4. Whitelist ====================================
print("\n4. Whitelist extensions + MIME")
avant = len(objets(TEL_A))
r = deposer(TEL_A, b"MZ...", nom="malware.exe", mime="application/x-msdownload")
check("extension hors whitelist → 415", r.status_code == 415, f"{r.status_code} {corps(r)}")
check("aucun objet écrit après 415", len(objets(TEL_A)) == avant, f"{avant} → {len(objets(TEL_A))}")
r = deposer(TEL_A, b"<script>", nom="page.pdf", mime="text/html")
check("MIME contredisant l'extension → 415", r.status_code == 415, f"{r.status_code} {corps(r)}")

whitelist = [
    ("a.pdf", "application/pdf"),
    ("b.jpg", "image/jpeg"),
    ("c.jpeg", "image/jpeg"),
    ("d.png", "image/png"),
    ("e.webp", "image/webp"),
    ("f.doc", "application/msword"),
    ("g.docx", MIME_DOCX),
]
codes = {n: deposer(TEL_C, b"x", nom=n, mime=m).status_code for n, m in whitelist}
check("les 7 extensions autorisées → 201", all(v == 201 for v in codes.values()), str(codes))
r = deposer(TEL_C, b"x", nom="UPPER.PDF", mime="application/pdf")
check("extension en majuscules acceptée", r.status_code == 201, str(r.status_code))
if r.status_code == 201:
    nom_up = corps(r)["documents"][-1]["nom"]
    check("…extension ramenée en minuscules", nom_up == "UPPER.pdf", nom_up)

# ============================ 5. Taille =======================================
print("\n5. Taille max 5 Mo (vérifiée AVANT écriture)")
cinq_mo = 5 * 1024 * 1024
avant = len(objets(TEL_B))
r = deposer(TEL_B, b"A" * cinq_mo, nom="gros.pdf")
check("5 Mo pile → 201", r.status_code == 201, f"{r.status_code} {corps(r)}")
check("taille annoncée = 5242880", corps(r)["documents"][-1]["taille"] == cinq_mo, str(corps(r))[:150])
avant = len(objets(TEL_B))
r = deposer(TEL_B, b"A" * (cinq_mo + 1), nom="trop_gros.pdf")
check("> 5 Mo → 413", r.status_code == 413, f"{r.status_code} {corps(r)}")
check("rien n'a été écrit au-delà de 5 Mo", len(objets(TEL_B)) == avant, f"{avant} → {len(objets(TEL_B))}")

# ============================ 6. Quota ========================================
print("\n6. Quota 10 documents par profil")
while len(corps(liste(TEL_A)).get("documents", [])) < 10:
    r = deposer(TEL_A, b"q", nom="quota.pdf")
    if r.status_code != 201:
        check("remplissage jusqu'au quota", False, f"{r.status_code} {corps(r)}")
        break
n = len(corps(liste(TEL_A)).get("documents", []))
check("profil à 10 documents", n == 10, f"n={n}")
avant = len(objets(TEL_A))
r = deposer(TEL_A, b"encore", nom="onzieme.pdf")
check("11e document → 413", r.status_code == 413, f"{r.status_code} {corps(r)}")
check("aucun objet écrit au-delà du quota", len(objets(TEL_A)) == avant, f"{avant} → {len(objets(TEL_A))}")

# ============================ 7. Authentification ============================
print("\n7. Garde Bearer (401 sans token, 403 autre téléphone)")
r = deposer(TEL_A, b"x", nom="pirate.pdf", headers={})
check("POST sans Bearer → refus", r.status_code in (401, 403), f"{r.status_code} {corps(r)}")
check("POST sans Bearer → 401 (garde identique aux mutants du profil)", r.status_code == 401, str(r.status_code))
r = deposer(TEL_A, b"x", nom="pirate.pdf", tel_url=TEL_A, headers=entete(TEL_B))
check("POST Bearer d'un autre tel → 403", r.status_code == 403, f"{r.status_code} {corps(r)}")
r = liste(TEL_A, headers={})
check("GET sans Bearer → refus", r.status_code in (401, 403), f"{r.status_code}")
r = liste(TEL_A, headers=entete(TEL_B))
check("GET Bearer d'un autre tel → 403", r.status_code == 403, str(r.status_code))
r = supprimer(TEL_A, "nimporte", headers={})
check("DELETE sans Bearer → refus", r.status_code in (401, 403), f"{r.status_code}")
r = supprimer(TEL_A, "nimporte", headers=entete(TEL_B))
check("DELETE Bearer d'un autre tel → 403", r.status_code == 403, str(r.status_code))
check("zéro document ajouté par les tentatives refusées", len(objets(TEL_A)) == avant, str(len(objets(TEL_A))))

# ============================ 8. Isollement inter-profils =====================
print("\n8. Isollement : ids et listes d'un autre profil")
docs_a = corps(liste(TEL_A)).get("documents", [])
docs_b = corps(liste(TEL_B)).get("documents", [])
check("GET renvoie bien la liste du profil connecté", len(docs_a) == 10 and len(docs_b) == 1, f"{len(docs_a)}/{len(docs_b)}")
id_b = docs_b[0]["id"]
r = supprimer(TEL_A, id_b)  # token A, URL A, id de B → introuvable chez A
check("DELETE id d'un autre profil → 404", r.status_code == 404, f"{r.status_code} {corps(r)}")
check("…et l'objet de B est toujours là", len(objets(TEL_B)) == 1, str(objets(TEL_B)))
r = supprimer(TEL_A, id_b, tel_url=TEL_B)  # token A sur l'URL de B
check("DELETE sur le profil d'autrui → 403", r.status_code == 403, f"{r.status_code}")
r = supprimer(TEL_A, "id-inconnu-0000")
check("DELETE id inconnu → 404", r.status_code == 404, f"{r.status_code}")

# ============================ 9. Suppression réelle ==========================
print("\n9. Suppression : objet Storage + métadonnées")
cible = docs_a[0]
avant_b = len(objets(TEL_B))
r = supprimer(TEL_A, cible["id"])
check("DELETE valide → 200", r.status_code == 200, f"{r.status_code} {corps(r)}")
restants = corps(r).get("documents", [])
check("liste restante = 9", len(restants) == 9, str(len(restants)))
check("document supprimé absent de la liste", cible["id"] not in [d["id"] for d in restants], "")
check("objet Storage retiré", len(objets(TEL_A)) == 9, str(len(objets(TEL_A))))
check("objets de B intacts", len(objets(TEL_B)) == avant_b, "")
r = supprimer(TEL_A, cible["id"])
check("re-suppression du même id → 404", r.status_code == 404, f"{r.status_code}")
r = deposer(TEL_A, b"x", nom="apres_delete.pdf")
check("une place libérée → upload à nouveau 201", r.status_code == 201, f"{r.status_code}")

# ============================ 10. Métadonnées / 404 ==========================
print("\n10. Metadata préservées + profil absent")
res = FAUX.tables["profils"][0]["metadata"]
check("code_pin_hash intact après écritures", res.get("code_pin_hash") == "hash-bidon", str(res)[:150])
check("prefs_avancees intactes après écritures", res.get("prefs_avancees") == {"seuil": 40}, str(res)[:150])
check("liste des documents persistée dans metadata", isinstance(res.get("documents"), list), str(type(res.get("documents"))))
r = client.get(f"/api/v1/profils/{TEL_ABSENT}/documents", headers=entete(TEL_ABSENT))
check("GET profil absent → 404", r.status_code == 404, f"{r.status_code}")
r = deposer(TEL_ABSENT, b"x", nom="fantome.pdf")
check("POST profil absent → 404", r.status_code == 404, f"{r.status_code}")
r = supprimer(TEL_ABSENT, "quelconque")
check("DELETE profil absent → 404", r.status_code == 404, f"{r.status_code}")
check("aucun objet créé pour un profil absent", len(objets(TEL_ABSENT)) == 0, str(objets(TEL_ABSENT)))

# ============================ 11. Enregistrement main.py =====================
print("\n11. Enregistrement du routeur dans app/main.py")
try:
    from apps.api.app import main as main_module

    # openapi() est le relevé exact des chemins exposés par l'application
    chemins = sorted(main_module.app.openapi().get("paths", {}))
    for attendu in (
        "/api/v1/profils/{telephone}/documents",
        "/api/v1/profils/{telephone}/documents/{document_id}",
        "/api/v1/profils/{telephone}/documents/{document_id}/url",
    ):
        check(f"main.py expose {attendu}", attendu in chemins, str(chemins)[:300])
except Exception as e:  # noqa: BLE001 — toute erreur d'import doit devenir un KO lisible
    check("import de app/main.py", False, f"{type(e).__name__}: {e}")

# ============================ 12. Chemins dégradés ============================
print("\n12. Chemins dégradés (panne d'écriture metadata, fichier vide)")
avant = len(objets(TEL_B))
FAUX.bloquer_maj = True  # update qui n'écrit rien = Supabase indisponible
r = deposer(TEL_B, b"x", nom="orphelin.pdf")
FAUX.bloquer_maj = False
check("échec de l'écriture metadata → 500 (jamais un 201 silencieux)", r.status_code == 500, f"{r.status_code} {corps(r)}")
check("objet compensé : aucun orphelin dans le bucket", len(objets(TEL_B)) == avant, f"{avant} → {len(objets(TEL_B))}")
r = deposer(TEL_B, b"", nom="vide.pdf")
check("fichier vide : 201/415 propre, jamais de 500", r.status_code in (201, 415), f"{r.status_code} {corps(r)}")

# ==================== 13. Lien de consultation (URL signée) ====================
print("\n13. Lien signé 60 s : bucket privé, garde, zéro fuite")


def lien_signe(tel_token, doc_id, tel_url=None, headers=None):
    return client.get(
        f"/api/v1/profils/{tel_url or tel_token}/documents/{doc_id}/url",
        headers=entete(tel_token) if headers is None else headers,
    )


docs_a = corps(liste(TEL_A)).get("documents", [])
docs_b = corps(liste(TEL_B)).get("documents", [])
doc_a = docs_a[0] if docs_a else {}
id_a = doc_a.get("id", "")
id_b = docs_b[0]["id"] if docs_b else ""

# a) cas nominal : URL signée du document du profil connecté
avant_signes = len(FAUX.storage.signes)
r = lien_signe(TEL_A, id_a)
c = corps(r)
check("GET .../url (document du profil) → 200", r.status_code == 200, f"{r.status_code} {c}")
check("réponse = {url, expire_dans} exactement", set(c) == {"url", "expire_dans"}, str(sorted(c)))
check(
    "l'URL signée est bien une URL http(s)",
    isinstance(c.get("url"), str) and c["url"].startswith("http"),
    str(c.get("url"))[:150],
)
check("TTL annoncé = 60 s", c.get("expire_dans") == 60, str(c.get("expire_dans")))
check(
    "l'URL signée porte un jeton éphémère",
    "token=" in str(c.get("url", "")),
    str(c.get("url"))[:150],
)
check(
    "le CHEMIN Storage interne n'est jamais renvoyé",
    all(
        not (isinstance(v, str) and v.startswith("documents/"))
        for v in c.values()
    )
    and "chemin" not in c
    and "path" not in c,
    str(c)[:150],
)

# b) côté Storage : bon bucket, bonne clé (relative), bon TTL
signe = FAUX.storage.signes[-1] if len(FAUX.storage.signes) > avant_signes else {}
check(
    "signature demandée sur le bucket PRIVÉ 'documents'",
    signe.get("bucket") == "documents",
    str(signe),
)
check(
    "clé signée = chemin du profil, relative au bucket (sans préfixe 'documents/')",
    str(signe.get("chemin", "")).startswith(f"{TEL_A}/{id_a}/")
    and not str(signe.get("chemin", "")).startswith("documents/"),
    str(signe.get("chemin")),
)
check("TTL demandé à Storage = 60 s", signe.get("expire_in") == 60, str(signe.get("expire_in")))

# c) « masquer le token n'expose rien » : aucun jeton → aucune URL
r = lien_signe(TEL_A, id_a, headers={})
check("sans Bearer → 401", r.status_code == 401, str(r.status_code))
check("…et AUCUNE url exposée (token masqué = rien)", "url" not in corps(r), str(corps(r))[:150])

# d) cloisonnement : autre téléphone / autre profil / id inconnu / profil absent
avant_signes = len(FAUX.storage.signes)
r = lien_signe(TEL_A, id_a, headers=entete(TEL_B))
check("Bearer d'un autre téléphone (URL de A) → 403", r.status_code == 403, str(r.status_code))
r = lien_signe(TEL_A, id_b)
check("document d'un AUTRE profil → 404 (zéro fuite)", r.status_code == 404, str(r.status_code))
check("…et toujours aucune url dans le corps", "url" not in corps(r), str(corps(r))[:150])
r = lien_signe(TEL_B, id_b, tel_url=TEL_B, headers=entete(TEL_B))
check("le propriétaire obtient bien SON lien → 200", r.status_code == 200, str(r.status_code))
r = lien_signe(TEL_A, "id-inconnu-0000")
check("id inconnu → 404", r.status_code == 404, str(r.status_code))
r = lien_signe(TEL_ABSENT, "quelconque")
check("profil absent → 404", r.status_code == 404, str(r.status_code))
check(
    "aucune signature générée par les appels refusés (sauf le propriétaire légitime)",
    len(FAUX.storage.signes) == avant_signes + 1,
    f"{avant_signes} → {len(FAUX.storage.signes)}",
)

# e) après suppression, le lien disparaît (404) et l'objet Storage aussi
r = supprimer(TEL_A, id_a)
check("suppression du document → 200", r.status_code == 200, str(r.status_code))
r = lien_signe(TEL_A, id_a)
check("…puis GET .../url sur l'id supprimé → 404", r.status_code == 404, str(r.status_code))

# f) aucune URL publique permanente n'existe (bucket privé)
check(
    "get_public_url JAMAIS appelé (aucune URL publique permanente)",
    FAUX.storage.public_urls == [],
    str(FAUX.storage.public_urls),
)

# --------------------------------- Bilan --------------------------------------
print(f"\n{'=' * 60}")
if ECHECS:
    print(f"RÉSULTAT : {len(ECHECS)} échec(s) → {ECHECS}")
    sys.exit(1)
print("RÉSULTAT : 100 % des checks sont VERTS (zéro réseau, zéro migration SQL).")
