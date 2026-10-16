import re
import sys
from contextlib import asynccontextmanager
from datetime import date
from uuid import UUID

from apps.api.app.core.config import settings
from apps.api.app.core.database import supabase
from apps.api.app.modules.auth.garde import garde_profil, session_profil
from apps.api.app.modules.dashboard.summary import (
    calculer_resume,
    calculer_score_profil,
    offres_par_poste,
)
from apps.api.app.modules.documents.routes import router as documents_router
from apps.api.app.modules.matching.engine import run_matching_job
from apps.api.app.modules.notifications.routes import router as notifications_router
from apps.api.app.modules.profils.routes import lire_matches_profil
from apps.api.app.modules.profils.routes import router as profils_router
from apps.api.app.modules.scraper.sources.catalogue import get_scrapers
from apps.api.app.modules.shared.models import (
    DashboardProfil,
    DashboardResponse,
    FavoriUpdate,
    Filiere,
    OffreStageCreate,
    OffreStagePublic,
    PaysEtudes,
    ResumeHebdo,
    StatsResponse,
    StatutUpdate,
    TriOffres,
    TypeOffre,
)
from apps.api.app.modules.whatsapp.webhook import router as whatsapp_router
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware


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
app.include_router(whatsapp_router)

# ---------- Profils (création, connexion PIN, consultation, mutations gardées) ----------
app.include_router(profils_router)

# ---------- Coffre-fort de documents de l'étudiant (CV, relevés, lettres) ----------
app.include_router(documents_router)

# ---------- Centre d'alertes in-app (calculé à la volée, sans table SQL) ----------
app.include_router(notifications_router)


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


# PostgREST lit `,` `(` `)` `*` comme la syntaxe de son filtre `or` : un `q` brut
# permettrait donc d'injecter une condition (`x,active.eq.false`). On ne garde que
# les caractères réellement tapés par un étudiant (lettres, chiffres, espaces, -, ').
_CARACTERES_RECHERCHE = re.compile(r"[^A-Za-z0-9_\s\-'\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff]")


def _motif_recherche(q: str) -> str | None:
    """Nettoie `q` pour un filtre PostgREST `ilike.*…*` — None si rien d'exploitable."""
    nettoye = _CARACTERES_RECHERCHE.sub(" ", q).strip()
    nettoye = re.sub(r"\s+", " ", nettoye)[:80]
    return nettoye or None


# ---------- Offres ----------
@app.get("/api/v1/offres", response_model=list[OffreStagePublic])
async def list_offres(
    filiere: Filiere | None = None,
    pays: PaysEtudes | None = None,
    type_offre: TypeOffre | None = None,
    q: str | None = None,
    tri: TriOffres = TriOffres.RECENTES,
    limit: int = 50,
    offset: int = 0,
):
    """Liste publique des offres actives dont la date limite est future.

    · `tri=urgent`   → `date_limite` CROISSANTE (les plus urgentes d'abord) ;
    · `tri=recentes` → `date_scrape` décroissant (défaut historique) ;
    · `q`            → recherche texte insensible à la casse dans titre,
      entreprise et description (enum `pays_etudes` exclu : PostgREST ne sait
      pas comparer une colonne enum avec `ilike`).
    """
    query = (
        supabase.table("offres")
        .select("*")
        .eq("active", True)
        .gte("date_limite", date.today().isoformat())
    )
    if filiere:
        query = query.contains("filieres_cibles", [filiere.value])
    if pays:
        query = query.eq("pays_etudes", pays.value)
    if type_offre:
        query = query.eq("type_offre", type_offre.value)

    motif = _motif_recherche(q) if q else None
    if motif:
        query = query.or_(
            ",".join(
                f"{colonne}.ilike.*{motif}*"
                for colonne in ("titre", "entreprise", "description")
            )
        )

    if tri == TriOffres.URGENT:
        # Échéance proche d'abord ; à échéance égale, la plus fraîche scrapée.
        query = query.order("date_limite", desc=False).order("date_scrape", desc=True)
    else:
        query = query.order("date_scrape", desc=True)

    res = query.range(offset, offset + limit - 1).execute()
    return [OffreStagePublic.model_validate(o) for o in res.data]


@app.get("/api/v1/offres/{offre_id}", response_model=OffreStagePublic)
async def detail_offre(offre_id: str):
    """Page publique de détail — mêmes garde-fou que la liste : offre active
    et date_limite future uniquement (une pending_review n'est pas accessible
    par URL directe)."""
    res = (
        supabase.table("offres")
        .select("*")
        .eq("id", offre_id)
        .eq("active", True)
        .gte("date_limite", date.today().isoformat())
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Offre introuvable")
    return OffreStagePublic.model_validate(res.data[0])


@app.post("/api/v1/offres", status_code=201)
async def create_offre(offre: OffreStageCreate):
    data = offre.model_dump(mode="json")
    res = supabase.table("offres").insert(data).execute()
    if not res.data:
        raise HTTPException(500, "Erreur lors de l'insertion de l'offre")
    return {"id": res.data[0]["id"]}


# ---------- Profils : routes déplacées dans modules/profils/routes.py ----------
# (création, connexion par code PIN, consultation, mutations gardées par token)


# ---------- Scraper ----------
@app.post("/api/v1/scraper/run")
async def trigger_scraper(source: str | None = None, run_matching: bool = False):
    """Lance le scraping de toutes les sources (ou d'une seule via ?source=beta_mr).

    Si run_matching=True, le matching est recalculé juste après le scraping
    et ses stats sont ajoutées à la réponse.
    """

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


@app.post("/api/v1/notifications/deadlines")
async def trigger_deadlines():
    """Rappels J-12 / J-3 des bourses déjà matchées (Lot C).

    Idempotent : chaque seuil ne part qu'une seule fois par match (état
    persisté dans matches.metadata). Opt-out respecté (profils actif=false).
    """
    from apps.api.app.modules.whatsapp.notifier import run_deadline_job
    return run_deadline_job()


@app.get("/api/v1/matches")
async def list_matches(
    profil_id: str | None = None,
    limit: int = 50,
    session: str = Depends(session_profil),
):
    """Liste les matches DU PROFIL CONNECTÉ, enrichis (titre d'offre + identité).

    Garde : le token Bearer porte le numéro de session ; la liste (qui contient
    le prénom/nom/téléphone de l'étudiant) n'est plus exposée sans Bearer.
    Un `profil_id` qui n'est pas celui de la session → 403 (paire identique à
    `garde_profil`), sinon la liste est toujours restreinte à la session.
    """
    possesseur = (
        supabase.table("profils").select("id").eq("telephone", session).execute()
    )
    if not possesseur.data:
        raise HTTPException(404, "Profil non trouvé")
    mon_id = possesseur.data[0]["id"]
    if profil_id and profil_id != mon_id:
        raise HTTPException(403, "Ces matches ne t'appartiennent pas")
    profil_id = mon_id

    colonnes = (
        "id, score, notifie, postule, date_match, "
        "offre:offres(id, titre, entreprise, pays_etudes, ville, type_offre, description, "
        "date_limite, contact_email, contact_whatsapp, source_url, source_name, "
        "filieres_cibles), "
        "profil:profils(id, prenom, nom, telephone, filiere, niveau)"
    )
    query = (
        supabase.table("matches").select(colonnes).eq("profil_id", profil_id)
    )
    try:
        res = query.order("date_match", desc=True).limit(limit).execute()
    except Exception:
        # Repli si la colonne 'postule' n'existe pas encore (migration en attente)
        colonnes = colonnes.replace("notifie, postule,", "notifie,")
        query = (
            supabase.table("matches").select(colonnes).eq("profil_id", profil_id)
        )
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
    # Pipeline bourses : « à préparer » → « postulé » au dépôt réel.
    # Best-effort : colonne absente (règle D8) → postule reste true,
    # l'UI retombe sur « Postulé » via son fallback.
    statut_avant = (res.data[0] or {}).get("statut_candidature")
    if statut_avant == "a_preparer":
        try:
            supabase.table("matches").update({"statut_candidature": "postule"}).eq(
                "id", match_id
            ).execute()
        except Exception:
            pass
    return {"id": match_id, "postule": True}


# ---------- P5 : dashboard client ----------
@app.get("/api/v1/dashboard/{telephone}", response_model=DashboardResponse)
async def dashboard_client(telephone: str, _session: str = Depends(garde_profil)):
    """Résumé hebdo du client : profil + compteurs de la semaine + offres par poste.

    Garde : le token Bearer doit porter {telephone} (identique aux routes profil).
    """
    res = supabase.table("profils").select("*").eq("telephone", telephone).execute()
    if not res.data:
        raise HTTPException(404, "Profil non trouvé")
    profil = res.data[0]

    matches = lire_matches_profil(profil["id"])
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
    notifie_res = (
        supabase.table("matches")
        .select("id", count="exact")
        .eq("notifie", True)
        .execute()
    )
    try:
        postules = (
            supabase.table("matches")
            .select("id", count="exact")
            .eq("postule", True)
            .execute()
        )
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
