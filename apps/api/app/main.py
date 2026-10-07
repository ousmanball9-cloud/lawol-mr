from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from apps.api.app.core.config import settings
from apps.api.app.core.database import supabase
from apps.api.app.modules.shared.models import (
    OffreStageCreate,
    OffreStagePublic,
    ProfilEtudiantCreate,
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


# ---------- Scraper ----------
@app.post("/api/v1/scraper/run")
async def trigger_scraper(source: str | None = None):
    """Lance le scraping de toutes les sources (ou d'une seule via ?source=beta_mr)."""
    from apps.api.app.modules.scraper.sources.catalogue import get_scrapers

    scrapers = get_scrapers()
    if source:
        scrapers = [s for s in scrapers if s.source_name == source]
        if not scrapers:
            raise HTTPException(404, f"Source inconnue: {source}")

    resultats = [s.run() for s in scrapers]

    total = sum(r["inserrees"] for r in resultats)
    return {
        "sources_traitees": len(resultats),
        "offres_inserrees": total,
        "details": resultats,
    }


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
    query = supabase.table("matches").select(
        "id, score, notifie, date_match, "
        "offre:offres(id, titre, entreprise, ville, date_limite), "
        "profil:profils(id, prenom, nom, telephone, filiere, niveau)"
    )
    if profil_id:
        query = query.eq("profil_id", profil_id)
    res = query.order("date_match", desc=True).limit(limit).execute()
    return res.data


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
    notifies = supabase.table("matches").select("id", count="exact").eq("notifie", True).execute()

    total = matches.count or 0
    return StatsResponse(
        offres_actives=offres.count or 0,
        etudiants_actifs=profils.count or 0,
        matches_total=total,
        matches_notifies=notifies.count or 0,
        taux_notification=round((notifies.count or 0) / total * 100, 1) if total else 0.0,
    )