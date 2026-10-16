"""Routes /api/v1/profils/{telephone}/documents* — coffre-fort de documents.

Contrat (déjà consommé par le frontend) :
- POST   /{tel}/documents        multipart champ « fichier » → 201 {documents:[...]}
- GET    /{tel}/documents        → 200 {documents:[...]}
- DELETE /{tel}/documents/{id}   → 200 {documents:[...]} (liste restante)
- GET    /{tel}/documents/{id}/url → 200 {url, expire_dans} : URL SIGNÉE
  temporaire (60 s) pour relire un document du bucket privé ;
- quota dépassé / fichier trop gros → 413 ; type non listé → 415 ; profil
  absent → 404.

Sécurité :
- garde Bearer IDENTIQUE à celle des mutants du profil (``garde_profil``) :
  token exigé (401 si absent/invalide) et token.porteur == {tel} de l'URL
  (403 sinon) ;
- bucket PRIVÉ ``documents`` (jamais public) ; le chemin de stockage est
  reconstruit UNIQUEMENT à partir du {tel} porté par le token — aucun nom
  client n'entre dans le chemin :
  ``documents/{tel}/{uuid}/{nom_normalise}`` (le préfixe ``documents/`` est
  retiré par ``_cle_bucket`` avant l'appel API Storage, qui travaille à
  l'intérieur du bucket) ;
- validation AVANT toute écriture Storage : extension + MIME dans une
  whitelist stricte, 5 Mo maximum (lecture par tronçons = échec précoce),
  nom normalisé (aucun ``/``, ``\\``, ``..``, longueur bornée) ;
- quota 10 documents/profil → 413 ;
- l'id est toujours cherché dans les métadonnées DU profil du token : un id
  appartenant à un autre profil → 404 (jamais de fuite inter-profils), et un
  objet n'est retiré du Storage que s'il est sous le préfixe du profil ;
- le lien de consultation est une URL SIGNÉE courte (60 s) générée à la
  demande : aucune URL publique permanente n'existe (``get_public_url``
  interdit), la route ne renvoie jamais le chemin Storage interne, et
  ``create_signed_url`` n'est appelé que sur un objet sous le préfixe DU
  profil du token.

Métadonnées : PAS de migration SQL — la liste vit dans
``profils.metadata['documents']`` (jsonb), même pattern que
``code_pin_hash``/``prefs_avancees`` : lecture du dict → modification →
``.update()``. Chaque entrée = ``{id, nom, taille, mime, created_at, chemin}``
mais seuls ``{id, nom, taille, mime, created_at}`` sont exposés en API (le
chemin Storage reste interne).
"""

import re
import unicodedata
from datetime import datetime, timezone
from uuid import uuid4

from apps.api.app.core.database import supabase
from apps.api.app.modules.auth.garde import garde_profil
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

router = APIRouter(prefix="/api/v1/profils", tags=["documents"])

# ---------- Constantes (aucune valeur secrète ici — voir core/config) ----------
BUCKET = "documents"  # bucket privé, jamais publié en public
CLE_DOCUMENTS = "documents"  # clé dans profils.metadata (jsonb, sans migration)
QUOTA_DOCUMENTS = 10
TAILLE_MAX_OCTETS = 5 * 1024 * 1024  # 5 Mo
BLOC_LECTURE = 1024 * 1024  # lecture par tronçons → 413 dès le dépassement
NOM_MAX = 60  # nom normalisé borné
TTL_URL_SIGNEE = 60  # durée de vie du lien de consultation (secondes)

# Whitelist stricte : extension acceptée → MIME(s) déclaré(s) accepté(s)
EXTENSIONS: set[str] = {"pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"}

MIMES_VALIDES: dict[str, set[str]] = {
    "pdf": {"application/pdf"},
    "jpg": {"image/jpeg"},
    "jpeg": {"image/jpeg"},
    "png": {"image/png"},
    "webp": {"image/webp"},
    "doc": {"application/msword"},
    "docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
}

# MIME retenu en stockage : DÉRIVÉ de l'extension validée, jamais du client
MIME_CANONIQUE: dict[str, str] = {ext: next(iter(mimes)) for ext, mimes in MIMES_VALIDES.items()}

# Certains navigateurs/proxy envoient ce type générique : toléré (le MIME
# stocké reste celui de l'extension validée, donc inoffensif).
_MIME_NEUTRE = {"", "application/octet-stream"}

_NON_SECURISE = re.compile(r"[^A-Za-z0-9._-]+")


# ---------- Helpers ----------
def _profil(telephone: str) -> dict | None:
    """Ligne profil (id + metadata) ou None si le numéro n'existe pas."""
    res = (
        supabase.table("profils")
        .select("id, metadata")
        .eq("telephone", telephone)
        .execute()
    )
    return dict(res.data[0]) if res.data else None


def _metadata(profil: dict) -> dict:
    """Copie du dict metadata (pattern identique à profils/routes.py)."""
    brut = profil.get("metadata")
    return dict(brut) if isinstance(brut, dict) else {}


def _liste_documents(metadata: dict) -> list[dict]:
    """Entrées documents valides de metadata (tolère un jsonb corrompu)."""
    entrees = metadata.get(CLE_DOCUMENTS)
    if not isinstance(entrees, list):
        return []
    return [e for e in entrees if isinstance(e, dict) and e.get("id")]


def _sauver(telephone: str, metadata: dict, documents: list[dict]) -> None:
    """Persiste metadata['documents'] en conservant les autres clés (PIN, prefs)."""
    metadata[CLE_DOCUMENTS] = documents
    res = (
        supabase.table("profils")
        .update({"metadata": metadata})
        .eq("telephone", telephone)
        .execute()
    )
    if not res.data:
        raise HTTPException(500, "Erreur lors de l'enregistrement des documents")


def _vue_publique(documents: list[dict]) -> list[dict]:
    """Format imposé par le contrat : {id, nom, taille, mime, created_at}."""
    return [
        {
            "id": d.get("id"),
            "nom": d.get("nom"),
            "taille": d.get("taille"),
            "mime": d.get("mime"),
            "created_at": d.get("created_at"),
        }
        for d in documents
    ]


def _cle_bucket(chemin: str) -> str:
    """Clé relative au bucket (le préfixe « documents/ » est le nom du bucket)."""
    return chemin.removeprefix(f"{BUCKET}/")


def _normaliser_nom(nom_brut: str | None) -> str | None:
    """Nom de fichier sûr, ou None si l'extension n'est pas dans la whitelist.

    Retire tout composant de chemin (``/`` et ``\\``), normalise l'unicode,
    remplace les caractères hors ``[A-Za-z0-9._-]``, écrase ``..``, borne la
    longueur et impose l'extension minuscule autorisée.
    """
    if not nom_brut:
        return None
    # 1. basename : seul le dernier segment compte, quel que soit le séparateur
    base = nom_brut.replace("\\", "/").rsplit("/", 1)[-1].strip()
    if not base:
        return None
    # 2. unicode normalisé puis caractères non sûrs remplacés
    base = unicodedata.normalize("NFKC", base)
    base = _NON_SECURISE.sub("_", base)
    base = re.sub(r"_{2,}", "_", base).replace("..", "_").strip("._-")
    if "." not in base:
        return None
    stem, _, extension = base.rpartition(".")
    extension = extension.lower()
    if extension not in EXTENSIONS:
        return None
    stem = stem[:NOM_MAX].strip("._-")
    if not stem:
        return None
    return f"{stem}.{extension}"


def _mime_stocke(extension: str, mime_declare: str | None) -> str:
    """MIME canonique de l'extension ; 415 si le MIME déclaré contredit la whitelist."""
    valides = MIMES_VALIDES[extension]
    declare = (mime_declare or "").split(";")[0].strip().lower()
    if declare not in _MIME_NEUTRE and declare not in valides:
        raise HTTPException(415, f"Type de contenu refusé ({declare}) pour un .{extension}")
    return MIME_CANONIQUE[extension]


async def _lire_avec_limite(fichier: UploadFile) -> bytes:
    """Contenu du fichier, 413 dès le premier octet au-delà de 5 Mo.

    Lecture par tronçons : le dépassement est détecté AVANT toute écriture
    Storage et sans jamais charger un fichier illimité en mémoire.
    """
    contenu = bytearray()
    while True:
        bloc = await fichier.read(BLOC_LECTURE)
        if not bloc:
            break
        contenu.extend(bloc)
        if len(contenu) > TAILLE_MAX_OCTETS:
            raise HTTPException(
                413, f"Document trop volumineux (maximum {TAILLE_MAX_OCTETS // (1024 * 1024)} Mo)"
            )
    return bytes(contenu)


def _supprimer_objet(chemin: str) -> None:
    """Retire un objet du bucket — best effort (jamais d'exception propagée)."""
    try:
        supabase.storage.from_(BUCKET).remove([_cle_bucket(chemin)])
    except Exception as e:  # objet déjà absent ou Storage momentanément indispo
        print(f"⚠️ Suppression Storage ignorée ({chemin}) : {e}")


def _lien_signe(chemin: str) -> str:
    """URL signée temporaire d'un objet du bucket privé (60 s).

    ``create_signed_url`` travaille à l'intérieur du bucket : on lui passe la
    clé relative. L'URL vit ``TTL_URL_SIGNEE`` secondes et n'est jamais
    publique/permanente. Toute panne Storage → 500 (jamais d'URL vide).
    """
    try:
        reponse = supabase.storage.from_(BUCKET).create_signed_url(
            _cle_bucket(chemin), TTL_URL_SIGNEE
        )
    except Exception as e:  # Storage indisponible
        raise HTTPException(500, f"Impossible de préparer le lien : {e}") from e
    url = reponse.get("signedURL") or reponse.get("signedUrl")
    if not url:
        raise HTTPException(500, "Impossible de préparer le lien de consultation")
    return url


def _cible_du_profil(documents: list[dict], document_id: str, telephone: str) -> dict | None:
    """Document du profil ET sous son préfixe Storage, ou None (jamais de fuite).

    Un id inconnu, appartenant à un AUTRE profil, ou dont le chemin ne commence
    pas par ``documents/{tel du token}/`` est traité de façon identique : None.
    """
    cible = next((d for d in documents if d.get("id") == document_id), None)
    if cible is None:
        return None
    chemin = cible.get("chemin")
    if not isinstance(chemin, str) or not chemin.startswith(f"{BUCKET}/{telephone}/"):
        return None
    return cible


# ---------- Upload ----------
@router.post("/{telephone}/documents", status_code=201)
async def deposer_document(
    telephone: str,
    fichier: UploadFile = File(...),
    _session: str = Depends(garde_profil),
):
    """Dépose un document dans le coffre-fort privé du profil."""
    profil = _profil(telephone)
    if not profil:
        raise HTTPException(404, "Profil non trouvé")

    metadata = _metadata(profil)
    documents = _liste_documents(metadata)
    if len(documents) >= QUOTA_DOCUMENTS:
        raise HTTPException(413, f"Quota dépassé : {QUOTA_DOCUMENTS} documents maximum")

    nom = _normaliser_nom(fichier.filename)
    if not nom:
        raise HTTPException(
            415, "Format non autorisé (pdf, jpg, jpeg, png, webp, doc, docx)"
        )
    extension = nom.rsplit(".", 1)[-1]
    mime = _mime_stocke(extension, fichier.content_type)

    contenu = await _lire_avec_limite(fichier)

    identifiant = str(uuid4())
    cree_le = datetime.now(timezone.utc).isoformat()
    # Chemin reconstruit à partir DU {tel} du token + uuid serveur : le nom
    # client n'est qu'une feuille normalisée, jamais un chemin.
    chemin = f"{BUCKET}/{telephone}/{identifiant}/{nom}"

    try:
        supabase.storage.from_(BUCKET).upload(
            _cle_bucket(chemin),
            contenu,
            {"content-type": mime, "upsert": False},
        )
    except Exception as e:
        raise HTTPException(500, f"Échec d'écriture dans le coffre-fort : {e}") from e

    documents.append(
        {
            "id": identifiant,
            "nom": nom,
            "taille": len(contenu),
            "mime": mime,
            "created_at": cree_le,
            "chemin": chemin,
        }
    )
    try:
        _sauver(telephone, metadata, documents)
    except HTTPException:
        _supprimer_objet(chemin)  # compensation : pas d'objet orphelin
        raise
    return {"documents": _vue_publique(documents)}


# ---------- Liste ----------
@router.get("/{telephone}/documents")
async def lister_documents(telephone: str, _session: str = Depends(garde_profil)):
    """Liste les documents du profil (le token doit porter ce téléphone)."""
    profil = _profil(telephone)
    if not profil:
        raise HTTPException(404, "Profil non trouvé")
    return {"documents": _vue_publique(_liste_documents(_metadata(profil)))}


# ---------- Suppression ----------
@router.delete("/{telephone}/documents/{document_id}")
async def supprimer_document(
    telephone: str,
    document_id: str,
    _session: str = Depends(garde_profil),
):
    """Supprime l'objet Storage + la ligne metadata d'un document du profil."""
    profil = _profil(telephone)
    if not profil:
        raise HTTPException(404, "Profil non trouvé")

    metadata = _metadata(profil)
    documents = _liste_documents(metadata)
    cible = next((d for d in documents if d.get("id") == document_id), None)
    if cible is None:
        # id inconnu OU appartenant à un autre profil : réponse identique (404),
        # aucune fuite inter-profils.
        raise HTTPException(404, "Document introuvable")

    chemin = cible.get("chemin")
    # Garde-fou : on ne touche qu'un objet sous le préfixe DU profil.
    if isinstance(chemin, str) and chemin.startswith(f"{BUCKET}/{telephone}/"):
        _supprimer_objet(chemin)

    restants = [d for d in documents if d.get("id") != document_id]
    _sauver(telephone, metadata, restants)
    return {"documents": _vue_publique(restants)}


# ---------- Lien de consultation (URL signée courte) ----------
@router.get("/{telephone}/documents/{document_id}/url")
async def url_document(
    telephone: str,
    document_id: str,
    _session: str = Depends(garde_profil),
):
    """URL signée (60 s) pour relire un document — bucket privé, jamais public.

    Le document n'est servi que s'il appartient au profil du token : id
    inconnu, id d'un autre profil ou chemin hors du préfixe du profil → 404
    identique (zéro fuite). La réponse ne contient que ``{url, expire_dans}``
    — jamais le chemin Storage interne.
    """
    profil = _profil(telephone)
    if not profil:
        raise HTTPException(404, "Profil non trouvé")

    cible = _cible_du_profil(_liste_documents(_metadata(profil)), document_id, telephone)
    if cible is None:
        raise HTTPException(404, "Document introuvable")

    return {"url": _lien_signe(cible["chemin"]), "expire_dans": TTL_URL_SIGNEE}
