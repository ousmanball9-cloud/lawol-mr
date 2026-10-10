from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sys

from apps.api.app.core.config import settings
from apps.api.app.core.database import supabase
from apps.api.app.modules.shared.models import (
    OffreStageCreate,
    OffreStagePublic,
    ProfilEtudiantCreate,
    ProfilEtudiantUpdate,
    ProfilEtudiant,
    StatsResponse,
    Filiere,
    Ville,
    TypeOffre,
    DashboardProfil,
    DashboardResponse,
    FavoriUpdate,
    PreferencesAvanceesUpdate,
    ResumeHebdo,
    StatutUpdate,
)
from apps.api.app.modules.dashboard.summary import (
    calculer_resume,
    calculer_score_profil,
    offres_par_poste,
)
from apps.api.app.modules.entreprises.routes import router as entreprises_router
from apps.api.app.modules.matching.engine import run_matching_job
from apps.api.app.modules.scraper.sources.catalogue import get_scrapers
from datetime import date
from uuid import UUID


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Console Windows (cp1252) : évite UnicodeEncodeError sur les emojis de log
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except Exception:
            pass
    print(f"🚀 {settings.APP_NAME} démarré ({settings.APP_ENV})")
    yield
    print("🛑 API arrêtée")


app = FastAPI(
    title="LAWOL.mr API",
    description="Matching offres stages/emplois pour étudiants mauritaniens",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- WhatsApp ----------
from apps.api.app.modules.whatsapp.webhook import router as whatsapp_router
app.include_router(whatsapp_router)

# ---------- P6-A : entreprises (comptes, offres, candidatures, admin) ----------
app.include_router(entreprises_router)


# ---------- Health ----------
@app.get("/health")
async def health():
    """Endpoint de santé — vérifie aussi la connexion Supabase."""
    db_ok = False
    try:
        supabase.table("offres").select("id").limit(1).execute()
        db_ok = True
    except Exception as e:
        print(f"⚠️ Supabase inaccessible: {e}")
    return {
        "status": "ok",
        "service": "lawol-api",
        "database": "ok" if db_ok else "error",
        "env": settings.APP_ENV,
    }


# ---------- Offres ----------
@app.get("/api/v1/offres", response_model=list[OffreStagePublic])
async def list_offres(
    filiere: Filiere | None = None,
    ville: Ville | None = None,
    type_offre: TypeOffre | None = None,
    limit: int = 50,
    offset: int = 0,
):
    query = (
        supabase.table("offres")
        .select("*")
        .eq("active", True)
        .gte("date_limite", date.today().isoformat())
    )
    if filiere:
        query = query.contains("filieres_cibles", [filiere.value])
    if ville:
        query = query.eq("ville", ville.value)
    if type_offre:
        query = query.eq("type_offre", type_offre.value)

    res = query.order("date_scrape", desc=True).range(offset, offset + limit - 1).execute()
    return [OffreStagePublic.model_validate(o) for o in res.data]


@app.post("/api/v1/offres", status_code=201)
async def create_offre(offre: OffreStageCreate):
    data = offre.model_dump(mode="json")
    res = supabase.table("offres").insert(data).execute()
    if not res.data:
        raise HTTPException(500, "Erreur lors de l'insertion de l'offre")
    return {"id": res.data[0]["id"]}


# ---------- Profils ----------
@app.post("/api/v1/profils", response_model=ProfilEtudiant, status_code=201)
async def create_profil(profil: ProfilEtudiantCreate):
    if not profil.optin_texte or not profil.optin_texte.strip():
        raise HTTPException(422, "L'opt-in est obligatoire pour recevoir les offres sur WhatsApp")
    data = profil.model_dump(mode="json")
    res = supabase.table("profils").upsert(data, on_conflict="telephone").execute()
    if not res.data:
        raise HTTPException(500, "Erreur lors de l'insertion du profil")
    return ProfilEtudiant.model_validate(res.data[0])


@app.get("/api/v1/profils/{telephone}", response_model=ProfilEtudiant)
async def get_profil(telephone: str):
    res = supabase.table("profils").select("*").eq("telephone", telephone).execute()
    if not res.data:
        raise HTTPException(404, "Profil non trouvé")
    return ProfilEtudiant.model_validate(res.data[0])


@app.put("/api/v1/profils/{telephone}", response_model=ProfilEtudiant)
async def update_profil(telephone: str, update: ProfilEtudiantUpdate):
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


@app.post("/api/v1/profils/{telephone}/desinscription")
async def desinscrire_profil(telephone: str):
    """Désactive un profil (opt-out : plus aucune notification envoyée)."""
    res = supabase.table("profils").select("id, actif").eq("telephone", telephone).execute()
    if not res.data:
        raise HTTPException(404, "Profil non trouvé")

    supabase.table("profils").update({"actif": False}).eq("telephone", telephone).execute()
    return {"telephone": telephone, "actif": False, "message": "Profil désactivé"}


# ---------- Scraper ----------
@app.post("/api/v1/scraper/run")
async def trigger_scraper(source: str | None = None, run_matching: bool = False):
    """Lance le scraping de toutes les sources (ou d'une seule via ?source=beta_mr).

    Si run_matching=True, le matching est recalculé juste après le scraping
    et ses stats sont ajoutées à la réponse.
    """
    from apps.api.app.modules.scraper.sources.catalogue import get_scrapers

    scrapers = get_scrapers()
    if source:
        scrapers = [s for s in scrapers if s.source_name == source]
        if not scrapers:
            raise HTTPException(404, f"Source inconnue: {source}")

    resultats = [s.run() for s in scrapers]

    total = sum(r["inserrees"] for r in resultats)
    payload = {
        "sources_traitees": len(resultats),
        "offres_inserrees": total,
        "details": resultats,
    }
    if run_matching:
        stats = run_matching_job()
        payload["matching"] = {
            "paires_examinees": stats["examines"],
            "matches_crees": stats["matches"],
            "deja_matchees": stats["ignores_deja"],
        }
    return payload


# ---------- Matching ----------
@app.post("/api/v1/matching/run")
async def trigger_matching():
    """Recalcule les matches entre profils actifs et offres actives."""
    stats = run_matching_job()
    return {
        "paires_examinees": stats["examines"],
        "matches_crees": stats["matches"],
        "deja_matchees": stats["ignores_deja"],
    }


# ---------- Notifications ----------
@app.post("/api/v1/notifications/run")
async def trigger_notifications():
    """Envoie les matches non notifiés aux étudiants via WhatsApp."""
    from apps.api.app.modules.whatsapp.notifier import run_notification_job
    stats = run_notification_job()
    return stats


@app.get("/api/v1/matches")
async def list_matches(profil_id: str | None = None, limit: int = 50):
    """Liste les matches, enrichis avec titre d'offre + prénom de l'étudiant."""
    colonnes = (
        "id, score, notifie, postule, date_match, "
        "offre:offres(id, titre, entreprise, ville, type_offre, description, date_limite, "
        "contact_email, contact_whatsapp, source_url, source_name, filieres_cibles), "
        "profil:profils(id, prenom, nom, telephone, filiere, niveau)"
    )
    query = supabase.table("matches").select(colonnes)
    if profil_id:
        query = query.eq("profil_id", profil_id)
    try:
        res = query.order("date_match", desc=True).limit(limit).execute()
    except Exception:
        # Repli si la colonne 'postule' n'existe pas encore (migration en attente)
        colonnes = colonnes.replace("notifie, postule,", "notifie,")
        query = supabase.table("matches").select(colonnes)
        if profil_id:
            query = query.eq("profil_id", profil_id)
        res = query.order("date_match", desc=True).limit(limit).execute()
    return res.data


@app.post("/api/v1/matches/{match_id}/postule")
async def marquer_postule(match_id: str):
    """Marque un match comme 'postulé' par l'étudiant (postule = true)."""
    res = supabase.table("matches").select("id").eq("id", match_id).execute()
    if not res.data:
        raise HTTPException(404, "Match non trouvé")

    try:
        res = supabase.table("matches").update({"postule": True}).eq("id", match_id).execute()
    except Exception:
        # Migration 'postule' pas encore appliquée sur Supabase
        raise HTTPException(503, "Fonctionnalité en cours d'activation, réessaie plus tard")
    if not res.data:
        raise HTTPException(500, "Erreur lors de la mise à jour du match")
    return {"id": match_id, "postule": True}


# ---------- P5 : dashboard, favoris, statut, historique, préférences ----------
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
# Variantes du plus complet au plus sobre (repli D8 si une colonne manque)
_MATCHES_VARIANTES = (
    _MATCHES_BASE + ", postule, favori, statut_candidature",
    _MATCHES_BASE + ", postule",
    _MATCHES_BASE,
)


def _lire_matches_profil(profil_id: str, limit: int | None = None) -> list[dict]:
    """Matches du profil (tri date_match desc) avec offre étendue (comme /matches).

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


@app.get("/api/v1/dashboard/{telephone}", response_model=DashboardResponse)
async def dashboard_client(telephone: str):
    """Résumé hebdo du client : profil + compteurs de la semaine + offres par poste."""
    res = supabase.table("profils").select("*").eq("telephone", telephone).execute()
    if not res.data:
        raise HTTPException(404, "Profil non trouvé")
    profil = res.data[0]

    matches = _lire_matches_profil(profil["id"])
    return DashboardResponse(
        profil=DashboardProfil(
            id=profil["id"],
            nom=profil.get("nom", ""),
            prenom=profil.get("prenom", ""),
            score_profil=calculer_score_profil(profil),
        ),
        resume=ResumeHebdo(**calculer_resume(matches)),
        postes_annee=offres_par_poste(profil),
    )


@app.patch("/api/v1/matches/{match_id}/favori")
async def basculer_favori(match_id: UUID, body: FavoriUpdate):
    """Active/désactive le favori d'un match (D8 : 503 clair si colonne absente)."""
    res = supabase.table("matches").select("id").eq("id", str(match_id)).execute()
    if not res.data:
        raise HTTPException(404, "Match non trouvé")

    try:
        res = (
            supabase.table("matches")
            .update({"favori": body.favori})
            .eq("id", str(match_id))
            .execute()
        )
    except Exception:
        raise HTTPException(
            503, "Favoris en cours d'activation, réessaie plus tard (migration 002_p5.sql)"
        )
    if not res.data:
        raise HTTPException(500, "Erreur lors de la mise à jour du match")
    return {"id": str(match_id), "favori": body.favori}


@app.patch("/api/v1/matches/{match_id}/statut")
async def changer_statut_candidature(match_id: UUID, body: StatutUpdate):
    """Change le statut de candidature (null = remise à zéro).

    Validation stricte : valeur hors enum → 422 (avant tout appel Supabase).
    D8 : colonne absente → 503 clair, jamais de 500.
    """
    if "statut" not in body.model_fields_set:
        raise HTTPException(422, "Champ 'statut' obligatoire (null pour réinitialiser)")

    res = supabase.table("matches").select("id").eq("id", str(match_id)).execute()
    if not res.data:
        raise HTTPException(404, "Match non trouvé")

    valeur = body.statut.value if body.statut else None
    try:
        res = (
            supabase.table("matches")
            .update({"statut_candidature": valeur})
            .eq("id", str(match_id))
            .execute()
        )
    except Exception:
        raise HTTPException(
            503,
            "Statut de candidature en cours d'activation, réessaie plus tard "
            "(migration 002_p5.sql)",
        )
    if not res.data:
        raise HTTPException(500, "Erreur lors de la mise à jour du match")
    return {"id": str(match_id), "statut_candidature": valeur}


@app.get("/api/v1/profils/{telephone}/historique")
async def historique_candidatures(telephone: str):
    """Matches du profil (date_match desc) avec offre étendue + favori +
    statut_candidature + postule (repli D8 si colonnes absentes)."""
    res = supabase.table("profils").select("id").eq("telephone", telephone).execute()
    if not res.data:
        raise HTTPException(404, "Profil non trouvé")
    return _lire_matches_profil(res.data[0]["id"])


@app.patch("/api/v1/profils/{telephone}/preferences")
async def maj_preferences_avancees(telephone: str, prefs: PreferencesAvanceesUpdate):
    """Met à jour partiellement profils.metadata['prefs_avancees'] (jsonb, pas de migration).

    Le matching engine applique ensuite ces préférences : villes exclues,
    types masqués, seuil de pertinence minimal.
    """
    res = supabase.table("profils").select("id, metadata").eq("telephone", telephone).execute()
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


# ---------- Stats ----------
@app.get("/api/v1/admin/stats", response_model=StatsResponse)
async def get_stats():
    offres = (
        supabase.table("offres")
        .select("id", count="exact")
        .eq("active", True)
        .gte("date_limite", date.today().isoformat())
        .execute()
    )
    profils = supabase.table("profils").select("id", count="exact").eq("actif", True).execute()
    matches = supabase.table("matches").select("id", count="exact").execute()
    notifie_res = supabase.table("matches").select("id", count="exact").eq("notifie", True).execute()
    try:
        postules = supabase.table("matches").select("id", count="exact").eq("postule", True).execute()
        postules_count = postules.count or 0
    except Exception:
        postules_count = 0  # colonne 'postule' pas encore migrée

    try:
        attente = (
            supabase.table("offres")
            .select("id", count="exact")
            .eq("statut_publication", "pending_review")
            .execute()
        )
        attente_count = attente.count or 0
    except Exception:
        attente_count = 0  # colonne 'statut_publication' pas encore migrée (D8)

    total = matches.count or 0
    return StatsResponse(
        offres_actives=offres.count or 0,
        etudiants_actifs=profils.count or 0,
        matches_total=total,
        matches_notifies=notifie_res.count or 0,
        matches_postules=postules_count,
        taux_notification=round((notifie_res.count or 0) / total * 100, 1) if total else 0.0,
        offres_en_attente=attente_count,
    )