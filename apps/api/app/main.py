from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

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
)
from apps.api.app.modules.matching.engine import run_matching_job
from apps.api.app.modules.scraper.sources.catalogue import get_scrapers
from datetime import date


@asynccontextmanager
async def lifespan(app: FastAPI):
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
        "offre:offres(id, titre, entreprise, ville, date_limite), "
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

    total = matches.count or 0
    return StatsResponse(
        offres_actives=offres.count or 0,
        etudiants_actifs=profils.count or 0,
        matches_total=total,
        matches_notifies=notifie_res.count or 0,
        matches_postules=postules_count,
        taux_notification=round((notifie_res.count or 0) / total * 100, 1) if total else 0.0,
    )