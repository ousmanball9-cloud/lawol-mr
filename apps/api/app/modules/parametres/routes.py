"""Réglages du site (clé/valeur) + compteur de visites — socle du chantier admin.

Tables Supabase — migration ``004_parametres_et_visites.sql`` DÉJÀ appliquée
(aucune nouvelle migration dans ce module) :
  · ``parametres(cle text pk, valeur jsonb, modifie_le timestamptz)`` ;
  · ``visites(id bigserial, jour date, chemin text, cree_le timestamptz)``.

Contrat FIGÉ (consommé par ``apps/web``) :

Public — aucune authentification :
  · ``GET  /api/v1/parametres``   → 200, objet **plat** ``{cle: valeur}`` des
    seules clés PUBLIQUES (``CLES_PUBLIQUES``) ; table absente ou vide → ``{}``
    (jamais 500) ;
  · ``POST /api/v1/visites``      → 201 ``{ok: true}`` ; insère une visite
    (``jour`` = ``current_date`` côté Postgres) ; ``chemin`` assaini/borné ;
    table absente ou panne → 201 ``{ok: true}`` quand même (une visite ne casse
    jamais la page, jamais 500).

Admin — garde `_admin_autorise` RÉUTILISÉE telle quelle, définition unique dans
`modules/auth/admin.py` (extraite de `entreprises/routes.py` le jour où ce
module est devenu inimportable — voir sa docstring) : cookie `lawol_admin` ou
en-tête `x-admin-token` (ou `Authorization: Bearer`).
  · ``PUT  /api/v1/admin/parametres``    → 200 ``{cle, valeur, modifie_le}``
    (upsert sur ``cle``) ;
  · ``GET  /api/v1/admin/stats/visites`` → 200 ``{total, par_jour: [{jour, nb}]}``
    (``total`` = visites toutes périodes ; ``par_jour`` = 30 derniers jours,
    sans remplissage des jours manquants ; dégradation douce → zéros).

Aucune donnée personnelle : pas d'IP, pas d'agent, pas d'identifiant — juste le
jour et le chemin (voir commentaire de la migration 004).
"""

import logging
from collections import Counter
from datetime import date, datetime, timedelta, timezone

from apps.api.app.core.database import supabase
from apps.api.app.modules.auth.admin import _admin_autorise
from apps.api.app.modules.parametres.models import ParametrePayload, VisitePayload
from fastapi import APIRouter, HTTPException, Request

logger = logging.getLogger(__name__)

router = APIRouter(tags=["parametres"])

# Seules clés exposées publiquement (les autres restent privées à l'admin).
CLES_PUBLIQUES: tuple[str, ...] = (
    "support_whatsapp",
    "email_contact",
    "reseaux",
    "mode_maintenance",
)

TABLE_PARAMETRES = "parametres"
TABLE_VISITES = "visites"
FENETRE_VISITES_JOURS = 30  # profondeur de l'historique par_jour


# ---------- Helpers ----------
def _parametres_publics() -> list[dict]:
    """Lignes des seules clés publiques (table absente → appelant gère le repli)."""
    res = (
        supabase.table(TABLE_PARAMETRES)
        .select("cle, valeur")
        .in_("cle", list(CLES_PUBLIQUES))
        .execute()
    )
    return res.data or []


def _lignes_visites_depuis(depuis_iso: str) -> list[dict]:
    """Jours des visites depuis ``depuis_iso`` (inclus)."""
    res = supabase.table(TABLE_VISITES).select("jour").gte("jour", depuis_iso).execute()
    return res.data or []


# ---------- Public : réglages ----------
@router.get("/api/v1/parametres")
async def lire_parametres_publics() -> dict:
    """Réglages PUBLICS, objet plat ``{cle: valeur}`` (table absente/vide → ``{}``)."""
    try:
        lignes = _parametres_publics()
    except Exception as e:  # table absente (migration non appliquée) ou réseau
        logger.warning("parametres publics illisibles, repli sur {} : %s", e)
        return {}
    return {ligne["cle"]: ligne.get("valeur") for ligne in lignes if ligne.get("cle")}


# ---------- Public : compteur de visites ----------
@router.post("/api/v1/visites", status_code=201)
async def enregistrer_visite(body: VisitePayload) -> dict:
    """Enregistre une vue de page — best effort (jamais 500, jamais de fuite)."""
    try:
        # `jour` = current_date côté Postgres (défaut de la colonne) : aucune
        # dérive de fuseau entre l'API et la base.
        supabase.table(TABLE_VISITES).insert({"chemin": body.chemin}).execute()
    except Exception as e:  # table absente ou panne : on ne casse jamais la page
        logger.warning("visite non enregistrée (repli silencieux) : %s", e)
    return {"ok": True}


# ---------- Admin : écrire un réglage ----------
@router.put("/api/v1/admin/parametres")
async def ecrire_parametre(body: ParametrePayload, request: Request) -> dict:
    """Upsert d'un réglage (``{cle, valeur}``) → ``{cle, valeur, modifie_le}``."""
    _admin_autorise(request)

    maintenant = datetime.now(timezone.utc).isoformat()
    # `modifie_le` est posé explicitement : un upsert NE réapplique PAS le défaut
    # de colonne sur une ligne existante (sinon l'horodatage resterait figé).
    ligne = {"cle": body.cle, "valeur": body.valeur, "modifie_le": maintenant}
    try:
        res = supabase.table(TABLE_PARAMETRES).upsert(ligne, on_conflict="cle").execute()
    except Exception as e:
        raise HTTPException(
            503, "Réglages indisponibles (migration 004 non appliquée ?), réessaie plus tard"
        ) from e

    enregistre = (res.data or [{}])[0]
    return {
        "cle": enregistre.get("cle", body.cle),
        "valeur": enregistre.get("valeur", body.valeur),
        "modifie_le": enregistre.get("modifie_le", maintenant),
    }


# ---------- Admin : statistiques de visites ----------
@router.get("/api/v1/admin/stats/visites")
async def stats_visites(request: Request) -> dict:
    """``{total, par_jour}`` — total toutes périodes, série sur 30 jours.

    Dégradation douce : table absente ou panne → ``{total: 0, par_jour: []}``
    (le tableau de bord admin ne doit jamais tomber en erreur).
    """
    _admin_autorise(request)

    depuis = (date.today() - timedelta(days=FENETRE_VISITES_JOURS - 1)).isoformat()
    try:
        total = supabase.table(TABLE_VISITES).select("id", count="exact").execute().count or 0
        lignes = _lignes_visites_depuis(depuis)
    except Exception as e:
        logger.warning("statistiques de visites indisponibles, repli sur zéros : %s", e)
        return {"total": 0, "par_jour": []}

    compteur = Counter(str(ligne["jour"]) for ligne in lignes if ligne.get("jour"))
    par_jour = [{"jour": jour, "nb": nb} for jour, nb in sorted(compteur.items())]
    return {"total": total, "par_jour": par_jour}
