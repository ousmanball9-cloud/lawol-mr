"""Preuve MOCKÉE du dossier de candidature généré (backend FastAPI) — zéro réseau.

Patch : le module `supabase` est remplacé par un factice en mémoire AVANT tout
import de l'application → `create_client()` ne touche jamais le réseau et aucun
secret réel n'est utilisé (SESSION_SECRET de test bidon).

Prouve :
   1. POST /api/v1/candidatures/{offre}/dossier → 200 {statut:"dossier_pret",
      url, expire_dans, offre_id, pieces, lettre_source, genere_le} ;
   2. le PDF déposé commence par « %PDF » et contient réellement l'offre,
      l'organisme, l'étudiant, la lettre et les pièces sélectionnées ;
   3. stockage PRIVÉ : bucket `documents`, clé `dossiers/{tel DU TOKEN}/{offre}.pdf`,
      URL SIGNÉE 60 s, `get_public_url` jamais appelé ;
   4. garde : sans Bearer → 401 ; `telephone` de corps ≠ token → 403 ; aucune
      écriture Storage dans ces deux cas ;
   5. offre inexistante / inactive / expirée → 404 ; profil absent → 404 ;
   6. pièce absente du coffre ignorée ; `pieces: []` = aucune pièce ;
      lettre fournie utilisée telle quelle, sinon gabarit ;
   7. offre id traversant → 404, aucun objet écrit hors du préfixe du profil ;
   8. main.py expose la route et requirements.txt déclare fpdf2 ;
   9. aucun envoi email (le lot 2 n'est pas ouvert par ce module).

Usage : python -X utf8 scripts/test-dossier-candidature.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""

import copy
import os
import re
import sys
import types
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

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

    def get_public_url(self, chemin):
        self._storage.public_urls.append(chemin)
        raise AssertionError("bucket privé : get_public_url interdit")

    def create_signed_url(self, chemin, expires_in, options=None):
        if self._nom != "documents":
            raise AssertionError(f"bucket inattendu : {self._nom!r} (attendu 'documents')")
        if chemin.startswith(("documents/", "/")):
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
        self._filtres, self._gte = [], []

    def select(self, colonnes="*"):
        self._mode = "select"
        return self

    def eq(self, colonne, valeur):
        self._filtres.append((colonne, valeur))
        return self

    def gte(self, colonne, valeur):
        self._gte.append((colonne, valeur))
        return self

    def limit(self, n):
        return self

    def insert(self, donnees):
        raise AssertionError("insert non attendu dans cette preuve")

    def update(self, donnees):
        raise AssertionError("update non attendu (aucune écriture SQL dans ce lot)")

    def delete(self):
        raise AssertionError("delete non attendu")

    def execute(self):
        lignes = []
        for ligne in self._base.tables.setdefault(self._nom, []):
            if not all(ligne.get(c) == v for c, v in self._filtres):
                continue
            if not all(str(ligne.get(c) or "") >= str(v) for c, v in self._gte):
                continue
            lignes.append(copy.deepcopy(ligne))
        if self._mode != "select":
            raise AssertionError(f"mode inattendu : {self._mode}")
        return _Resultat(lignes)


class _FauxSupabase:
    def __init__(self):
        self.tables = {}
        self.storage = _FauxStorage()

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
from apps.api.app.modules.candidatures.routes import router as candidatures_router

app = FastAPI()
app.include_router(candidatures_router)
client = TestClient(app)

TEL_A = "22136000001"
TEL_B = "22136000002"
TEL_ABSENT = "22136099999"
OFFRE_OK = "11111111-2222-3333-4444-555555555555"
OFFRE_EXPIREE = "22222222-3333-4444-5555-666666666666"
OFFRE_INACTIVE = "33333333-4444-5555-6666-777777777777"
OFFRE_INCONNUE = "99999999-8888-7777-6666-555555555555"

AUJOURDHUI = datetime.now(timezone.utc).date()
DEMAIN = (AUJOURDHUI + timedelta(days=30)).isoformat()
HIER = (AUJOURDHUI - timedelta(days=1)).isoformat()

FAUX.tables["profils"] = [
    {
        "id": "profil-aaa",
        "telephone": TEL_A,
        "prenom": "Aminata",
        "nom": "Diallo",
        "filiere": "Informatique",
        "niveau": "Master 2",
        "metadata": {
            "code_pin_hash": "hash-bidon",
            "documents": [
                {
                    "id": "doc-cv",
                    "nom": "CV_Aminata.pdf",
                    "taille": 1200,
                    "mime": "application/pdf",
                    "created_at": "2026-10-01T10:00:00+00:00",
                    "chemin": f"documents/{TEL_A}/doc-cv/CV_Aminata.pdf",
                },
                {
                    "id": "doc-releve",
                    "nom": "Releves_notes.pdf",
                    "taille": 2200,
                    "mime": "application/pdf",
                    "created_at": "2026-10-02T10:00:00+00:00",
                    "chemin": f"documents/{TEL_A}/doc-releve/Releves_notes.pdf",
                },
            ],
        },
    },
    {
        "id": "profil-bbb",
        "telephone": TEL_B,
        "prenom": "Moussa",
        "nom": "Ba",
        "filiere": "Droit",
        "niveau": "Licence 3",
        "metadata": {"documents": []},
    },
]

FAUX.tables["offres"] = [
    {
        "id": OFFRE_OK,
        "titre": "Bourse d'excellence 2026",
        "entreprise": "Ambassade de France",
        "active": True,
        "date_limite": DEMAIN,
        "description": "Une bourse pour les étudiants mauritaniens.",
    },
    {
        "id": OFFRE_EXPIREE,
        "titre": "Bourse close",
        "entreprise": "Organisme clos",
        "active": True,
        "date_limite": HIER,
    },
    {
        "id": OFFRE_INACTIVE,
        "titre": "Bourse désactivée",
        "entreprise": "Organisme inactif",
        "active": False,
        "date_limite": DEMAIN,
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


def generer(tel_token=TEL_A, offre_id=OFFRE_OK, corps=None, headers=None):
    return client.post(
        f"/api/v1/candidatures/{offre_id}/dossier",
        json=corps,
        headers=entete(tel_token) if headers is None else headers,
    )


def corps_json(r):
    try:
        return r.json()
    except ValueError:
        return {}


def objets(tel):
    return [c for (_b, c) in FAUX.storage.objets if c.startswith(f"dossiers/{tel}/")]


def texte_pdf(octets):
    """Texte des flux FlateDecode d'un PDF fpdf2 (stdlib uniquement)."""
    morceaux = []
    for flux in re.findall(rb"stream\r?\n(.*?)\r?\nendstream", octets, re.DOTALL):
        try:
            brut = zlib.decompress(flux)
        except zlib.error:
            brut = flux
        for chaine in re.findall(rb"\((?:[^()\\]|\\.)*\)", brut):
            valeur = chaine[1:-1]
            valeur = valeur.replace(rb"\(", b"(").replace(rb"\)", b")").replace(rb"\\", b"\\")
            morceaux.append(valeur.decode("latin-1", "replace"))
    return " ".join(morceaux)


def nombre_pages(octets):
    """Nombre de pages d'un PDF fpdf2.

    fpdf2 n'écrit QU'UN SEUL `/MediaBox` (objet hérité par toutes les pages) :
    compter `/MediaBox` renvoyait 1 pour un document de 3 pages (mesuré le
    20/10/2026 — c'est le harnais qui avait tort, pas le PDF). On lit le
    `/Count` du nœud `/Pages`, avec repli sur les objets `/Type /Page`
    (la regex exclut `/Pages`).
    """
    compte = re.search(rb"/Type\s*/Pages[^>]*?/Count\s+(\d+)", octets, re.DOTALL)
    if compte:
        return int(compte.group(1))
    return len(re.findall(rb"/Type\s*/Page(?![s])", octets))


# ======================= 1. Cas nominal + forme réponse =======================
print("\n1. Cas nominal (200) + forme de la réponse")
r = generer()
c = corps_json(r)
check("POST dossier valide → 200", r.status_code == 200, f"reçu {r.status_code} : {c}")
check("statut = dossier_pret", c.get("statut") == "dossier_pret", str(c.get("statut")))
check(
    "réponse = {statut,url,expire_dans,offre_id,pieces,lettre_source,genere_le}",
    set(c) == {
        "statut",
        "url",
        "expire_dans",
        "offre_id",
        "pieces",
        "lettre_source",
        "genere_le",
    },
    str(sorted(c)),
)
check("offre_id = offre demandée", c.get("offre_id") == OFFRE_OK, str(c.get("offre_id")))
check("TTL annoncé = 60 s", c.get("expire_dans") == 60, str(c.get("expire_dans")))
check(
    "URL http(s) signée avec jeton éphémère",
    isinstance(c.get("url"), str)
    and c["url"].startswith("http")
    and "token=" in c["url"],
    str(c.get("url"))[:150],
)
check("lettre source = gabarit (aucune lettre fournie)", c.get("lettre_source") == "gabarit")
check(
    "les 2 pièces du coffre sont retenues",
    c.get("pieces") == ["CV_Aminata.pdf", "Releves_notes.pdf"],
    str(c.get("pieces")),
)
check(
    "aucun chemin Storage interne renvoyé comme champ",
    "chemin" not in c
    and "path" not in c
    and all(
        not (isinstance(v, str) and v.startswith("dossiers/"))
        for v in c.values()
    ),
    str(c)[:200],
)

# ======================= 2. PDF réel + stockage privé =======================
print("\n2. PDF réel, contenu et stockage privé")
cle_attendue = f"dossiers/{TEL_A}/{OFFRE_OK}.pdf"
pdf = FAUX.storage.objets.get(("documents", cle_attendue), b"")
check("objet stocké sous dossiers/{tel}/{offre}.pdf", bool(pdf), str(objets(TEL_A)))
check("le PDF commence par %PDF", pdf.startswith(b"%PDF"), pdf[:12])
options = FAUX.storage.options.get(("documents", cle_attendue), {})
check("content-type = application/pdf", options.get("content-type") == "application/pdf", str(options))
check("upsert=True (régénération possible)", options.get("upsert") is True, str(options))

contenu = texte_pdf(pdf)
check("le PDF cite l'offre", "Bourse d'excellence 2026" in contenu, contenu[:300])
check("le PDF cite l'organisme", "Ambassade de France" in contenu, contenu[:300])
check("le PDF cite l'étudiant", "Aminata Diallo" in contenu, contenu[:400])
check("le PDF contient la lettre de motivation", "LETTRE DE MOTIVATION" in contenu, contenu[:400])
check("le PDF cite le gabarit (Madame, Monsieur)", "Madame, Monsieur" in contenu)
check("le PDF liste le CV", "CV_Aminata.pdf" in contenu)
check("le PDF liste les relevés", "Releves_notes.pdf" in contenu)
check("le PDF contient la date du jour", AUJOURDHUI.strftime("%d/%m/%Y") in contenu)
check(
    "PDF = 3 pages (garde + lettre + pièces, aucune page blanche)",
    nombre_pages(pdf) == 3,
    str(nombre_pages(pdf)),
)
check(
    "pied de page présent sur CHAQUE page (3/3)",
    contenu.count("dossier généré le") == 3,
    str(contenu.count("dossier généré le")),
)
check("le PDF a une section « PIÈCES JOINTES »", "PIÈCES JOINTES" in contenu, contenu[:400])

signe = FAUX.storage.signes[-1] if FAUX.storage.signes else {}
check("signature sur le bucket PRIVÉ 'documents'", signe.get("bucket") == "documents", str(signe))
check(
    "clé signée relative + sous le préfixe du profil",
    signe.get("chemin") == cle_attendue and not signe.get("chemin", "").startswith("documents/"),
    str(signe.get("chemin")),
)
check("TTL demandé à Storage = 60 s", signe.get("expire_in") == 60, str(signe.get("expire_in")))
check(
    "get_public_url JAMAIS appelé (aucune URL publique permanente)",
    FAUX.storage.public_urls == [],
    str(FAUX.storage.public_urls),
)

# ======================= 3. Garde Bearer / inter-profils =======================
print("\n3. Garde : 401 sans session, 403 inter-profils")
avant = len(FAUX.storage.objets)
r = generer(headers={})
check("sans Bearer → 401", r.status_code == 401, f"{r.status_code} {corps_json(r)}")
check("…aucune url exposée", "url" not in corps_json(r), str(corps_json(r))[:150])
r = generer(corps={"telephone": TEL_B})
check("token A + telephone B → 403", r.status_code == 403, f"{r.status_code} {corps_json(r)}")
r = generer(tel_token=TEL_B, corps={"telephone": TEL_A})
check("token B + telephone A → 403", r.status_code == 403, f"{r.status_code} {corps_json(r)}")
r = generer(tel_token=TEL_B, corps={"telephone": TEL_B, "pieces": []})
check("propriétaire légitime (B) → 200", r.status_code == 200, f"{r.status_code} {corps_json(r)}")
check(
    "aucun dossier écrit par les tentatives refusées",
    len(FAUX.storage.objets) == avant + 1,
    f"{avant} → {len(FAUX.storage.objets)}",
)

# ======================= 4. Offre / profil inexistants =======================
print("\n4. Offre et profil introuvables")
avant = len(FAUX.storage.objets)
r = generer(offre_id=OFFRE_INCONNUE)
check("offre inexistante → 404", r.status_code == 404, f"{r.status_code} {corps_json(r)}")
r = generer(offre_id=OFFRE_EXPIREE)
check("offre expirée → 404", r.status_code == 404, f"{r.status_code} {corps_json(r)}")
r = generer(offre_id=OFFRE_INACTIVE)
check("offre inactive → 404", r.status_code == 404, f"{r.status_code} {corps_json(r)}")
r = generer(tel_token=TEL_ABSENT)
check("profil absent → 404", r.status_code == 404, f"{r.status_code} {corps_json(r)}")
check(
    "aucune écriture Storage sur ces refus",
    len(FAUX.storage.objets) == avant,
    f"{avant} → {len(FAUX.storage.objets)}",
)

# ======================= 5. Pièces et lettre =======================
print("\n5. Pièces du coffre et lettre")
r = generer(corps={"pieces": ["doc-cv", "id-inexistant"]})
c = corps_json(r)
check("pièce absente du coffre ignorée → 200", r.status_code == 200, f"{r.status_code} {c}")
check("seule la pièce connue est retenue", c.get("pieces") == ["CV_Aminata.pdf"], str(c.get("pieces")))
pdf = FAUX.storage.objets.get(("documents", cle_attendue), b"")
check(
    "le PDF ne mentionne pas l'id inconnu",
    "id-inexistant" not in texte_pdf(pdf),
    texte_pdf(pdf)[-300:],
)

r = generer(corps={"pieces": []})
c = corps_json(r)
check("pieces=[] → aucune pièce retenue", c.get("pieces") == [], str(c.get("pieces")))
pdf = FAUX.storage.objets.get(("documents", cle_attendue), b"")
check(
    "le PDF dit honnêtement « Aucune pièce »",
    "Aucune pièce du coffre-fort" in texte_pdf(pdf),
    texte_pdf(pdf)[-300:],
)

lettre = "Je suis très motivée par cette bourse et mon projet est clair."
r = generer(corps={"lettre": lettre})
c = corps_json(r)
check("lettre fournie → lettre_source = fournie", c.get("lettre_source") == "fournie", str(c.get("lettre_source")))
pdf = FAUX.storage.objets.get(("documents", cle_attendue), b"")
check("le PDF reprend le texte fourni", "projet est clair" in texte_pdf(pdf), texte_pdf(pdf)[-300:])

# Lettre très longue (cas limite) : plusieurs pages, mais AUCUNE page blanche —
# le pied de page doit être dessiné une seule fois par page.
r = generer(corps={"lettre": "Ma motivation est réelle et documentée. " * 120})
check("lettre longue → 200", r.status_code == 200, f"{r.status_code} {corps_json(r)}")
pdf_long = FAUX.storage.objets.get(("documents", cle_attendue), b"")
pages_long = nombre_pages(pdf_long)
contenu_long = texte_pdf(pdf_long)
check("lettre longue → plusieurs pages", pages_long > 3, str(pages_long))
check(
    "aucune page blanche : un pied de page par page",
    contenu_long.count("dossier généré le") == pages_long,
    f"pages={pages_long} pieds={contenu_long.count('dossier généré le')}",
)

# ======================= 6. Anti-traversée de chemin =======================
print("\n6. Offre id traversant : 404, zéro écriture hors préfixe")
avant = len(FAUX.storage.objets)
r = generer(offre_id="../../evil")
check("offre id traversant → 404", r.status_code == 404, f"{r.status_code} {corps_json(r)}")
check(
    "aucun objet écrit hors dossiers/{tel}/",
    len(FAUX.storage.objets) == avant
    and all(c.startswith(f"dossiers/{TEL_A}/") for c in objets(TEL_A)),
    str(list(FAUX.storage.objets)),
)

# ======================= 7. Intégration main.py / requirements =======================
print("\n7. Enregistrement et dépendance")
try:
    from apps.api.app import main as main_module

    chemins = sorted(main_module.app.openapi().get("paths", {}))
    check(
        "main.py expose /api/v1/candidatures/{offre_id}/dossier",
        "/api/v1/candidatures/{offre_id}/dossier" in chemins,
        str(chemins)[:400],
    )
except Exception as e:  # noqa: BLE001 — un import cassé doit devenir un KO lisible
    check("import de app/main.py", False, f"{type(e).__name__}: {e}")

requirements = (RACINE / "apps" / "api" / "requirements.txt").read_text(encoding="utf-8")
check(
    "requirements.txt déclare fpdf2",
    re.search(r"^fpdf2", requirements, re.MULTILINE) is not None,
)

source = (
    RACINE
    / "apps"
    / "api"
    / "app"
    / "modules"
    / "candidatures"
    / "routes.py"
)
code = source.read_text(encoding="utf-8")
check(
    "aucun envoi email dans ce lot (pas de smtplib / email)",
    "smtplib" not in code and "import email" not in code,
)

# --------------------------------- Bilan --------------------------------------
print(f"\n{'=' * 64}")
if ECHECS:
    print(f"RÉSULTAT : {len(ECHECS)} échec(s) → {ECHECS}")
    sys.exit(1)
print("RÉSULTAT : 100 % des checks sont VERTS (zéro réseau, zéro migration SQL).")
