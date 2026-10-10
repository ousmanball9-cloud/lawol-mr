"""P6-A — Entreprises : comptes, dépôt d'offres, suivi candidatures, fiches publiques.

Authentification v1 (documentée comme telle) : hash sha256 + sel aléatoire par
compte, session = uuid aléatoire stocké sur `comptes_entreprise` avec expiration
à 7 jours. Même philosophie que l'auth admin actuelle (pas de JWT) — bcrypt/passlib
n'est pas dans les dépendances, donc sha256+sel pour v1.

Règles métier :
  - offre déposée → source='entreprise', source_name=nom, source_url =
    https://lawol.mr/offres/{id}, statut_publication='pending_review',
    active=false (donc ni listée publiquement, ni matchée) tant que l'admin ne
    l'a pas validée ;
  - seules les offres `active` apparaissent dans /entreprises/candidatures et
    dans le matching ;
  - chaque endpoint toque Supabase via `_requete()` → toute erreur (table ou
    colonne absente, réseau) devient un 503 clair : règle D8, jamais de 500.
"""
import secrets
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
from uuid import UUID, uuid4

from apps.api.app.core.config import settings
from apps.api.app.core.database import supabase
from apps.api.app.modules.shared.models import (
    CandidatureEntreprise,
    EntrepriseFiche,
    EntrepriseInscription,
    EntrepriseInscriptionReponse,
    EntrepriseLogin,
    EntrepriseLoginReponse,
    EntreprisePublique,
    OffreCandidature,
    OffreEntrepriseCreate,
    OffreEntrepriseReponse,
    OffreEntrepriseResume,
    ProfilCandidature,
    PublicationUpdate,
    TokenEntreprise,
)
from fastapi import APIRouter, HTTPException, Query, Request

router = APIRouter()

DUREE_SESSION_JOURS = 7
URL_PUBLIQUE_OFFRE = "https://lawol.mr/offres/"  # pattern frontend à confirmer
COLONNE_MANAGER = "statut_publication"  # + entreprise_id (migration 003_p6.sql)


# ---------- Utilitaires ----------
def _requete(action, contexte: str):
    """Exécute une requête Supabase ; toute erreur devient un 503 clair (D8).

    Jamais de 500 : table/colonne absente (migration 003_p6.sql non appliquée)
    ou souci réseau = dégradation propre.
    """
    try:
        return action()
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e).lower()
        indigestion_schema = any(
            balise in msg
            for balise in (
                "does not exist",
                "schema-cache",
                "schema cache",
                "could not find the table",
                "42p01",
                "42703",
                "pgrst205",
                "pgrst204",
            )
        )
        if indigestion_schema:
            raise HTTPException(
                503,
                f"{contexte} : migration 003_p6.sql non appliquée (règle D8), réessaie après "
                "application de la migration",
            ) from e
        raise HTTPException(503, f"{contexte} indisponible, réessaie plus tard") from e


def _compte_de_token(token: str | None) -> dict:
    """Valide le token d'une entreprise → renvoie le compte (401 sinon)."""
    if not token:
        raise HTTPException(401, "Token d'entreprise manquant")
    try:
        UUID(token)
    except (ValueError, TypeError):
        raise HTTPException(401, "Token d'entreprise invalide")

    res = _requete(
        lambda: (
            supabase.table("comptes_entreprise")
            .select("id, entreprise_id, actif, token_expires_at")
            .eq("token", token)
            .execute()
        ),
        "Authentification entreprise",
    )
    if not res.data:
        raise HTTPException(401, "Token d'entreprise invalide ou expiré")
    compte = res.data[0]
    if not compte.get("actif", True):
        raise HTTPException(403, "Compte entreprise désactivé")
    expire = compte.get("token_expires_at")
    if expire:
        try:
            dt = datetime.fromisoformat(str(expire).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt < datetime.now(timezone.utc):
                raise HTTPException(401, "Session expirée, reconnecte-toi")
        except ValueError:
            pass
    return compte


def _fiche_entreprise(entreprise_id: str) -> dict:
    res = _requete(
        lambda: supabase.table("entreprises").select("*").eq("id", str(entreprise_id)).execute(),
        "Entreprise",
    )
    if not res.data:
        raise HTTPException(404, "Entreprise introuvable")
    return res.data[0]


def _compteurs_matches(offre_ids: list[str]) -> tuple[Counter, Counter]:
    """(nb matches, nb postulés) par offre — repli si la colonne `postule` manque."""
    if not offre_ids:
        return Counter(), Counter()
    try:
        rows = (
            supabase.table("matches")
            .select("offre_id, postule")
            .in_("offre_id", offre_ids)
            .execute()
        ).data
        return Counter(r["offre_id"] for r in rows), Counter(
            r["offre_id"] for r in rows if r.get("postule")
        )
    except Exception:
        rows = (
            supabase.table("matches").select("offre_id").in_("offre_id", offre_ids).execute()
        ).data
        return Counter(r["offre_id"] for r in rows), Counter()


def _resume_offres(rows: list[dict]) -> list[OffreEntrepriseResume]:
    ids = [r["id"] for r in rows]
    nb_matches, nb_postules = _compteurs_matches(ids)
    return [
        OffreEntrepriseResume(
            id=r["id"],
            titre=r["titre"],
            ville=r["ville"],
            type_offre=r["type_offre"],
            date_limite=r["date_limite"],
            statut_publication=r.get("statut_publication") or "active",
            active=r.get("active", True),
            url_publique=r.get("source_url"),
            nb_matches=nb_matches.get(r["id"], 0),
            nb_postules=nb_postules.get(r["id"], 0),
        )
        for r in rows
    ]


def _admin_autorise(request: Request) -> None:
    """Protection admin (v1, identique à la philosophie web) : cookie de session
    posé par /api/admin/login, ou token admin (hash du mot de passe admin).

    - rien d'identifié  -> 401 (authentification requise)
    - identifié mais faux (cookie ou token) -> 403 (identifiants invalides)
    """
    cookie = request.cookies.get("lawol_admin")
    if cookie == "authenticated":
        return

    token = request.query_params.get("token") or request.headers.get("x-admin-token")
    if not token:
        autorisation = request.headers.get("authorization", "")
        if autorisation.lower().startswith("bearer "):
            token = autorisation[7:]

    if token:
        if settings.ADMIN_PASSWORD_HASH and secrets.compare_digest(
            token, settings.ADMIN_PASSWORD_HASH
        ):
            return
        raise HTTPException(403, "Token admin invalide")
    if cookie is not None:
        raise HTTPException(403, "Cookie d'administration invalide")
    raise HTTPException(401, "Authentification admin requise (cookie lawol_admin ou token)")


# ---------- Auth entreprise (v1 : sha256+sel, token uuid 7 jours) ----------
def _hasher(password: str) -> str:
    sel = secrets.token_hex(16)
    return f"{sel}${sha256((sel + password).encode('utf-8')).hexdigest()}"


def _verifier(password: str, stocke: str) -> bool:
    try:
        sel, digest = stocke.split("$", 1)
    except (ValueError, AttributeError):
        return False
    return secrets.compare_digest(sha256((sel + password).encode("utf-8")).hexdigest(), digest)


@router.post("/api/v1/entreprises/inscription", status_code=201)
async def inscrire_entreprise(body: EntrepriseInscription) -> EntrepriseInscriptionReponse:
    """Crée la fiche entreprise + le compte. Email déjà utilisé → 409."""
    email = body.email.strip().lower()
    existant = _requete(
        lambda: supabase.table("comptes_entreprise").select("id").eq("email", email).execute(),
        "Inscription entreprise",
    )
    if existant.data:
        raise HTTPException(409, "Un compte existe déjà pour cet email")

    fiche = _requete(
        lambda: (
            supabase.table("entreprises")
            .insert(
                {
                    "nom": body.nom,
                    "secteur": body.secteur,
                    "ville": body.ville.value,
                    "description": body.description,
                    "site_url": body.site_url,
                    "telephone": body.telephone,
                    "email_contact": email,
                    "verifiee": False,
                    "actif": True,
                }
            )
            .execute()
        ),
        "Inscription entreprise",
    )
    if not fiche.data:
        raise HTTPException(503, "Inscription entreprise impossible, réessaie plus tard")
    entreprise_id = fiche.data[0]["id"]

    try:
        compte = supabase.table("comptes_entreprise").insert(
            {
                "entreprise_id": entreprise_id,
                "email": email,
                "password_hash": _hasher(body.password),
                "actif": True,
            }
        ).execute()
    except Exception as e:
        # rollback de la fiche entreprise (pas de compte → pas d'entreprise orpheline)
        try:
            supabase.table("entreprises").delete().eq("id", entreprise_id).execute()
        except Exception:
            pass
        if "duplicate" in str(e).lower() or "23505" in str(e):
            raise HTTPException(409, "Un compte existe déjà pour cet email") from e
        raise HTTPException(
            503, "Inscription entreprise : migration 003_p6.sql non appliquée (règle D8)"
        ) from e
    if not compte.data:
        raise HTTPException(503, "Inscription entreprise impossible, réessaie plus tard")

    return EntrepriseInscriptionReponse(entreprise_id=entreprise_id)


@router.post("/api/v1/entreprises/login", response_model=EntrepriseLoginReponse)
async def login_entreprise(body: EntrepriseLogin) -> EntrepriseLoginReponse:
    """Vérifie le hash → renvoie un token valable 7 jours. Mauvais mdp → 401."""
    email = body.email.strip().lower()
    res = _requete(
        lambda: (
            supabase.table("comptes_entreprise")
            .select("id, entreprise_id, password_hash, actif")
            .eq("email", email)
            .execute()
        ),
        "Connexion entreprise",
    )
    if not res.data:
        raise HTTPException(401, "Identifiants invalides")
    compte = res.data[0]
    if not compte.get("actif", True) or not _verifier(body.password, compte.get("password_hash")):
        raise HTTPException(401, "Identifiants invalides")

    token = str(uuid4())
    expiration = datetime.now(timezone.utc) + timedelta(days=DUREE_SESSION_JOURS)
    _requete(
        lambda: (
            supabase.table("comptes_entreprise")
            .update({"token": token, "token_expires_at": expiration.isoformat()})
            .eq("id", compte["id"])
            .execute()
        ),
        "Connexion entreprise",
    )
    return EntrepriseLoginReponse(
        token=token, entreprise_id=compte["entreprise_id"], expires_in_jours=DUREE_SESSION_JOURS
    )


@router.post("/api/v1/entreprises/logout")
async def logout_entreprise(body: TokenEntreprise) -> dict:
    """Nullifie le token de session (idempotent côté client)."""
    compte = _compte_de_token(body.token)
    _requete(
        lambda: (
            supabase.table("comptes_entreprise")
            .update({"token": None, "token_expires_at": None})
            .eq("id", compte["id"])
            .execute()
        ),
        "Déconnexion entreprise",
    )
    return {"message": "Déconnecté"}


# ---------- Offres de l'entreprise (auth token) ----------
@router.post("/api/v1/entreprises/offres", status_code=201, response_model=OffreEntrepriseReponse)
async def creer_offre_entreprise(body: OffreEntrepriseCreate) -> OffreEntrepriseReponse:
    """Dépose une offre → statut_publication='pending_review' (file de validation)."""
    compte = _compte_de_token(body.token)
    ent = _fiche_entreprise(compte["entreprise_id"])

    offre_id = uuid4()
    payload = body.model_dump(
        mode="json", exclude={"token", "source", "source_name", "source_url", "entreprise"}
    )
    payload.update(
        {
            "id": str(offre_id),
            "source": "entreprise",
            "source_name": ent["nom"],
            "source_url": f"{URL_PUBLIQUE_OFFRE}{offre_id}",
            "entreprise": ent["nom"],
            "entreprise_id": compte["entreprise_id"],
            COLONNE_MANAGER: "pending_review",
            # Non publique et non matchée tant que l'admin ne l'a pas validée :
            # `active=false` protège aussi /offres et le matching sans dépendre
            # de la nouvelle colonne (compatibilité D8).
            "active": False,
        }
    )
    res = _requete(
        lambda: supabase.table("offres").insert(payload).execute(), "Dépôt d'offre"
    )
    if not res.data:
        raise HTTPException(503, "Dépôt d'offre impossible, réessaie plus tard")
    return OffreEntrepriseReponse(
        id=res.data[0]["id"], statut_publication="pending_review"
    )


@router.get("/api/v1/entreprises/offres", response_model=list[OffreEntrepriseResume])
async def liste_offres_entreprise(token: str | None = Query(default=None)):
    """Les offres de SON entreprise uniquement (statut + nb matches + nb postulés)."""
    compte = _compte_de_token(token)
    res = _requete(
        lambda: (
            supabase.table("offres")
            .select(
                "id, titre, ville, type_offre, date_limite, statut_publication, active, "
                "source_url, created_at"
            )
            .eq("entreprise_id", compte["entreprise_id"])
            .order("created_at", desc=True)
            .execute()
        ),
        "Offres entreprise",
    )
    return _resume_offres(res.data)


@router.get("/api/v1/entreprises/candidatures", response_model=list[CandidatureEntreprise])
async def candidatures_entreprise(token: str | None = Query(default=None)):
    """Suivi employeur : matches de SES offres actives, avec le profil étudiant."""
    compte = _compte_de_token(token)
    offres_res = _requete(
        lambda: (
            supabase.table("offres")
            .select("id, titre, entreprise, ville, type_offre, date_limite")
            .eq("entreprise_id", compte["entreprise_id"])
            .eq("active", True)
            .execute()
        ),
        "Candidatures entreprise",
    )
    offres = {o["id"]: o for o in offres_res.data}
    if not offres:
        return []

    profil = "profil:profils(id, nom, prenom, telephone, universite, filiere, niveau, ville)"
    base = f"id, offre_id, score, notifie, date_match, {profil}"
    variantes = (f"{base}, postule, favori, statut_candidature", f"{base}, postule", base)

    lignes = None
    for colonnes in variantes:
        try:
            lignes = (
                supabase.table("matches")
                .select(colonnes)
                .in_("offre_id", list(offres))
                .order("date_match", desc=True)
                .execute()
            ).data
            break
        except Exception:
            continue
    if lignes is None:
        raise HTTPException(
            503, "Candidatures : migration non appliquée (règle D8), réessaie plus tard"
        )

    resultats: list[CandidatureEntreprise] = []
    for ligne in lignes:
        offre = offres.get(ligne["offre_id"])
        p = ligne.get("profil")
        if not offre or not p:
            continue
        resultats.append(
            CandidatureEntreprise(
                match_id=ligne["id"],
                date_match=ligne["date_match"],
                score=ligne.get("score", 100),
                notifie=ligne.get("notifie", False),
                postule=ligne.get("postule", False),
                favori=ligne.get("favori", False),
                statut_candidature=ligne.get("statut_candidature"),
                profil=ProfilCandidature(**p),
                offre=OffreCandidature(**{k: offre[k] for k in
                                           ("id", "titre", "entreprise", "ville",
                                            "type_offre", "date_limite")}),
            )
        )
    return resultats


# ---------- Fiches entreprises (public) ----------
@router.get("/api/v1/entreprises", response_model=list[EntreprisePublique])
async def liste_entreprises_publique():
    """Annuaire public : nom, ville, secteur, nb d'offres actives."""
    res = _requete(
        lambda: (
            supabase.table("entreprises")
            .select("id, nom, ville, secteur")
            .eq("actif", True)
            .order("nom")
            .execute()
        ),
        "Annuaire des entreprises",
    )
    offres = _requete(
        lambda: (
            supabase.table("offres")
            .select("entreprise_id")
            .eq("active", True)
            .gte("date_limite", date.today().isoformat())
            .execute()
        ),
        "Annuaire des entreprises",
    )
    nb = Counter(o["entreprise_id"] for o in offres.data if o.get("entreprise_id"))
    return [
        EntreprisePublique(
            id=e["id"],
            nom=e["nom"],
            ville=e["ville"],
            secteur=e.get("secteur"),
            nb_offres_actives=nb.get(e["id"], 0),
        )
        for e in res.data
    ]


@router.get("/api/v1/entreprises/{entreprise_id}", response_model=EntrepriseFiche)
async def fiche_publique_entreprise(entreprise_id: UUID):
    """Fiche complète + offres actives de l'entreprise (404 si inconnue/inactif)."""
    res = _requete(
        lambda: (
            supabase.table("entreprises")
            .select("*")
            .eq("id", str(entreprise_id))
            .eq("actif", True)
            .execute()
        ),
        "Fiche entreprise",
    )
    if not res.data:
        raise HTTPException(404, "Entreprise introuvable")
    ent = res.data[0]

    offres = _requete(
        lambda: (
            supabase.table("offres")
            .select("id, titre, ville, type_offre, date_limite, statut_publication, active, "
                    "source_url, created_at")
            .eq("entreprise_id", str(entreprise_id))
            .eq("active", True)
            .gte("date_limite", date.today().isoformat())
            .execute()
        ),
        "Fiche entreprise",
    )
    return EntrepriseFiche(
        id=ent["id"],
        nom=ent["nom"],
        ville=ent["ville"],
        secteur=ent.get("secteur"),
        nb_offres_actives=len(offres.data),
        description=ent.get("description"),
        site_url=ent.get("site_url"),
        telephone=ent.get("telephone"),
        email_contact=ent.get("email_contact"),
        logo_url=ent.get("logo_url"),
        verifiee=ent.get("verifiee", False),
        created_at=ent.get("created_at"),
        offres=_resume_offres(offres.data),
    )


# ---------- Admin : file de validation des offres ----------
@router.patch("/api/v1/admin/offres/{offre_id}/publication")
async def valider_publication_offre(offre_id: UUID, body: PublicationUpdate, request: Request):
    """Passe une offre entreprise de pending_review à active ou rejetee."""
    _admin_autorise(request)

    res = _requete(
        lambda: (
            supabase.table("offres")
            .select(f"id, {COLONNE_MANAGER}")
            .eq("id", str(offre_id))
            .execute()
        ),
        "Validation des offres",
    )
    if not res.data:
        raise HTTPException(404, "Offre introuvable")

    changement = {
        "active": {"statut_publication": "active", "active": True},
        "rejetee": {"statut_publication": "rejetee", "active": False},
    }[body.statut]
    maj = _requete(
        lambda: (
            supabase.table("offres")
            .update(changement)
            .eq("id", str(offre_id))
            .execute()
        ),
        "Validation des offres",
    )
    if not maj.data:
        raise HTTPException(503, "Validation impossible, réessaie plus tard")
    return {
        "id": str(offre_id),
        "statut_publication": body.statut,
        "active": changement["active"],
    }
