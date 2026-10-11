"""Routes /api/v1/profils* — création, connexion PIN, consultation, mutations.

Sécurité (fermeture du trou « connaître un numéro = accès total ») :
- POST /{tel}/connexion vérifie le code PIN (hash PBKDF2 dans metadata) et
  délivre un token signé HMAC (SESSION_SECRET) avec expiration ;
- les MUTANTS (PUT /{tel}, PATCH /{tel}/preferences, POST /{tel}/desinscription)
  exigent ce token en Bearer et qu'il corresponde au téléphone de la ressource ;
- les GET restent ouverts (consultation), le hash du PIN n'est jamais exposé
  (ProfilEtudiant n'a pas de champ metadata).

Migration douce : un profil créé avant le PIN (metadata sans code_pin_hash)
fixe son code PIN dès la première connexion — zéro migration SQL.
"""

from apps.api.app.core.database import supabase
from apps.api.app.modules.auth.garde import garde_profil
from apps.api.app.modules.auth.pin import hasher_pin, verifier_pin
from apps.api.app.modules.auth.session import (
    SessionNonConfiguree,
    creer_token,
    duree_session_minutes,
)
from apps.api.app.modules.shared.models import (
    ConnexionProfilRequete,
    PreferencesAvanceesUpdate,
    ProfilEtudiant,
    ProfilEtudiantCreate,
    ProfilEtudiantUpdate,
    SessionProfilReponse,
)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/api/v1/profils", tags=["profils"])

# Clé du hash du PIN dans profils.metadata (jsonb — pas de migration)
CLE_PIN = "code_pin_hash"


# ---------- Création ----------
@router.post("", response_model=ProfilEtudiant, status_code=201)
async def create_profil(profil: ProfilEtudiantCreate):
    """Inscription. Le code PIN n'est jamais inséré en clair : seul son hash
    part dans metadata. Un numéro déjà inscrit renvoie 409 (l'upsert est
    interdit : il permettait de ré-inscrire le numéro d'autrui et de
    remplacer son code PIN)."""
    if not profil.optin_texte or not profil.optin_texte.strip():
        raise HTTPException(
            422, "L'opt-in est obligatoire pour recevoir les offres sur WhatsApp"
        )

    data = profil.model_dump(mode="json")
    code_pin = data.pop("code_pin", None)  # jamais de PIN en clair dans l'insert

    existant = (
        supabase.table("profils").select("id").eq("telephone", profil.telephone).execute()
    )
    if existant.data:
        raise HTTPException(409, "Ce numéro de téléphone est déjà inscrit")

    if code_pin:
        data["metadata"] = {CLE_PIN: hasher_pin(code_pin)}

    res = supabase.table("profils").insert(data).execute()
    if not res.data:
        raise HTTPException(500, "Erreur lors de l'insertion du profil")
    return ProfilEtudiant.model_validate(res.data[0])


# ---------- Connexion par code PIN ----------
@router.post("/{telephone}/connexion", response_model=SessionProfilReponse)
async def connexion_profil(telephone: str, corps: ConnexionProfilRequete):
    """Vérifie le code PIN et délivre un token signé à expiration.

    - profil avec hash → vérification (comparaison constante) ; PIN faux = 401 ;
    - profil sans hash (compte antérieur au PIN) → le premier PIN fourni est
      fixé dans metadata (migration douce), puis le token est délivré ;
    - numéro inconnu → 404 (le frontend propose alors la création de profil).
    """
    res = (
        supabase.table("profils")
        .select("id, metadata")
        .eq("telephone", telephone)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Aucun profil avec ce numéro")

    metadata = res.data[0].get("metadata")
    metadata = dict(metadata) if isinstance(metadata, dict) else {}
    hash_stoque = metadata.get(CLE_PIN)

    if hash_stoque:
        if not verifier_pin(corps.code_pin, hash_stoque):
            raise HTTPException(401, "Code PIN incorrect")
    else:
        # Migration douce : ce PIN devient définitif pour ce profil
        metadata[CLE_PIN] = hasher_pin(corps.code_pin)
        (
            supabase.table("profils")
            .update({"metadata": metadata})
            .eq("telephone", telephone)
            .execute()
        )

    try:
        token, _expiration = creer_token(telephone)
    except SessionNonConfiguree as e:
        raise HTTPException(503, f"Session serveur non configurée : {e}")

    return SessionProfilReponse(
        token=token,
        telephone=telephone,
        expires_in_minutes=duree_session_minutes(),
    )


# ---------- Consultation (GET ouverts) ----------
@router.get("/{telephone}", response_model=ProfilEtudiant)
async def get_profil(telephone: str):
    res = supabase.table("profils").select("*").eq("telephone", telephone).execute()
    if not res.data:
        raise HTTPException(404, "Profil non trouvé")
    return ProfilEtudiant.model_validate(res.data[0])


# ---------- Mutants (token Bearer exigé) ----------
@router.put("/{telephone}", response_model=ProfilEtudiant)
async def update_profil(
    telephone: str,
    update: ProfilEtudiantUpdate,
    _session: str = Depends(garde_profil),
):
    """Modifie les champs d'un profil existant (aucun champ obligatoire)."""
    res = supabase.table("profils").select("*").eq("telephone", telephone).execute()
    if not res.data:
        raise HTTPException(404, "Profil non trouvé")

    # Seuls les champs présents (non-null) sont modifiés
    changes = update.model_dump(exclude_none=True, mode="json")
    if not changes:
        raise HTTPException(422, "Aucun champ à modifier")

    res = (
        supabase.table("profils")
        .update(changes)
        .eq("telephone", telephone)
        .execute()
    )
    if not res.data:
        raise HTTPException(500, "Erreur lors de la mise à jour du profil")
    return ProfilEtudiant.model_validate(res.data[0])


@router.post("/{telephone}/desinscription")
async def desinscrire_profil(telephone: str, _session: str = Depends(garde_profil)):
    """Désactive un profil (opt-out : plus aucune notification envoyée)."""
    res = (
        supabase.table("profils")
        .select("id, actif")
        .eq("telephone", telephone)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Profil non trouvé")

    supabase.table("profils").update({"actif": False}).eq("telephone", telephone).execute()
    return {"telephone": telephone, "actif": False, "message": "Profil désactivé"}


@router.patch("/{telephone}/preferences")
async def maj_preferences_avancees(
    telephone: str,
    prefs: PreferencesAvanceesUpdate,
    _session: str = Depends(garde_profil),
):
    """Met à jour partiellement profils.metadata['prefs_avancees'] (jsonb).

    Le matching engine applique ensuite ces préférences : villes exclues,
    types masqués, seuil de pertinence minimal.
    """
    res = (
        supabase.table("profils")
        .select("id, metadata")
        .eq("telephone", telephone)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Profil non trouvé")

    changements = prefs.model_dump(exclude_unset=True, mode="json")
    if not changements:
        raise HTTPException(422, "Aucune préférence à modifier")

    metadata = res.data[0].get("metadata")
    metadata = dict(metadata) if isinstance(metadata, dict) else {}
    actuelles = metadata.get("prefs_avancees")
    actuelles = dict(actuelles) if isinstance(actuelles, dict) else {}

    # Fusion : seuls les champs présents dans le corps sont remplacés
    # (le hash du PIN existant est conservé tel quel)
    fusion = {**actuelles, **changements}
    metadata["prefs_avancees"] = fusion

    maj = (
        supabase.table("profils")
        .update({"metadata": metadata})
        .eq("telephone", telephone)
        .execute()
    )
    if not maj.data:
        raise HTTPException(500, "Erreur lors de la mise à jour des préférences")
    return {"telephone": telephone, "prefs_avancees": fusion}


# ---------- Historique (GET ouvert) ----------
# Variantes du plus complet au plus sobre (repli D8 si une colonne manque)
_MATCHES_OFFRE_ETENDUE = (
    "id, titre, entreprise, ville, type_offre, description, date_limite, "
    "contact_email, contact_whatsapp, source_url, source_name, filieres_cibles, active"
)
_MATCHES_PROFIL_ETENDU = "id, prenom, nom, telephone, filiere, niveau"
_MATCHES_BASE = (
    "id, score, notifie, date_match, "
    f"offre:offres({_MATCHES_OFFRE_ETENDUE}), "
    f"profil:profils({_MATCHES_PROFIL_ETENDU})"
)
_MATCHES_VARIANTES = (
    _MATCHES_BASE + ", postule, favori, statut_candidature",
    _MATCHES_BASE + ", postule",
    _MATCHES_BASE,
)


def lire_matches_profil(profil_id: str, limit: int | None = None) -> list[dict]:
    """Matches du profil (tri date_match desc) avec offre étendue.

    Repli D8 : si `favori`/`statut_candidature` (voire `postule`) n'existent pas
    encore, on retombe sur une sélection plus sobre et on complète les champs
    manquants avec leur défaut (favori=false, statut_candidature=null).
    Lecture = valeur par défaut, jamais de 500.
    """
    derniere_erreur: Exception | None = None
    for colonnes in _MATCHES_VARIANTES:
        try:
            query = (
                supabase.table("matches")
                .select(colonnes)
                .eq("profil_id", profil_id)
                .order("date_match", desc=True)
            )
            if limit:
                query = query.limit(limit)
            res = query.execute()
        except Exception as e:  # colonne absente (D8) ou souci réseau
            derniere_erreur = e
            continue
        for row in res.data:
            row.setdefault("postule", False)
            row.setdefault("favori", False)
            row.setdefault("statut_candidature", None)
        return res.data

    msg = str(derniere_erreur or "").lower()
    if "column" in msg or "not exist" in msg or "schema-cache" in msg:
        raise HTTPException(
            503,
            "Favoris/statuts indisponibles : migration 002_p5.sql non appliquée (règle D8)",
        )
    raise HTTPException(503, "Service momentanément indisponible, réessaie plus tard")


@router.get("/{telephone}/historique")
async def historique_candidatures(telephone: str):
    """Matches du profil (date_match desc) avec offre étendue + favori +
    statut_candidature + postule (repli D8 si colonnes absentes)."""
    res = supabase.table("profils").select("id").eq("telephone", telephone).execute()
    if not res.data:
        raise HTTPException(404, "Profil non trouvé")
    return lire_matches_profil(res.data[0]["id"])
