"""Centre d'alertes in-app — routes /api/v1/profils/{telephone}/notifications*.

Contrat (déjà consommé par le frontend) :
- GET  /{tel}/notifications      → 200 {notifications:[{id,type,titre,texte,date,
  lien,lue}]} — tri « plus récent d'abord », 30 entrées maximum ;
- POST /{tel}/notifications/lues → 200 {lues:n} avec corps {ids:[str]}.

Tout est CALCULÉ À LA VOLÉE depuis les tables existantes (pattern de
dashboard/summary.py + profils.routes.lire_matches_profil) : AUCUNE table SQL,
aucune migration, aucun état WhatsApp, aucun appel réseau (lecture seule).

Deux types d'alerte, ids STABLES pour que le front puisse marquer « lu » :
- nouveau_match → id ``match:{match_id}`` : match des 7 derniers jours
  (fenêtre glissante identique à ``calculer_resume``), lien ``/offres/{offre_id}`` ;
- echeance      → id ``echeance:{match_id}:j12`` puis ``…:j3`` : bourse
  (``TYPES_RAPPELS_DEFAUT``) dont la clôture tombe à ≤ 12 jours — mêmes seuils
  que whatsapp/notifier.py repris EN LECTURE (aucun envoi, aucun marquage de
  seuil dans matches.metadata), lien ``/profil/{telephone}``.

« Lu » = l'id est présent dans ``profils.metadata['notifications_lues']``
(dict id → date ISO, jsonb, sans migration) ; le POST fusionne les ids reçus
sans écraser les autres clés et plafonne ce dict à 200 entrées (les plus
anciennes dates sautent en premier).

Sécurité : garde Bearer IDENTIQUE à celle des mutants du profil
(``garde_profil``) — 401 sans token, 403 si le token porte un autre numéro,
404 profil absent, 422 corps invalide. Seules les 7 clés du contrat sont
exposées : jamais le metadata du profil (hash du PIN, prefs, documents…).
"""

from datetime import date, datetime, timedelta, timezone
from typing import Literal

from apps.api.app.core.database import supabase
from apps.api.app.modules.auth.garde import garde_profil
from apps.api.app.modules.profils.routes import lire_matches_profil
from apps.api.app.modules.whatsapp.notifier import SEUIL_J3, SEUIL_J12, TYPES_RAPPELS_DEFAUT
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/profils", tags=["notifications"])

# ---------- Constantes (aucun secret ici — voir core/config) ----------
CLE_LUES = "notifications_lues"  # clé dans profils.metadata (jsonb, sans migration)
PLAFON_LUES = 200  # plafond du dict metadata['notifications_lues']
PLAFON_NOTIFICATIONS = 30  # contrat : 30 alertes maximum par appel
FENETRE_NOUVEAU_JOURS = 7  # fenêtre glissante du « nouveau match »
MAX_IDS_REQUETE = 1000  # garde-fou mémoire sur le corps POST


# ---------- Contrat (pydantic) ----------
class Notification(BaseModel):
    """Une alerte — strictement les 7 clés du contrat."""

    id: str
    type: Literal["nouveau_match", "echeance"]
    titre: str
    texte: str
    date: str
    lien: str
    lue: bool = False


class NotificationsReponse(BaseModel):
    notifications: list[Notification]


class NotificationsLuesRequete(BaseModel):
    """Corps POST : ids des alertes à marquer comme lues."""

    ids: list[str] = Field(max_length=MAX_IDS_REQUETE)


# ---------- Helpers ----------
def _date_iso(valeur) -> date | None:
    """Date lue depuis un champ date OU timestamp ISO (10 premiers caractères)."""
    try:
        return date.fromisoformat(str(valeur)[:10])
    except (TypeError, ValueError):
        return None


def _profil(telephone: str) -> dict | None:
    """Ligne profil (id + metadata) ou None si le numéro n'existe pas."""
    res = supabase.table("profils").select("id, metadata").eq("telephone", telephone).execute()
    return dict(res.data[0]) if res.data else None


def _metadata(profil: dict) -> dict:
    """Copie du dict metadata (pattern identique à documents/routes.py)."""
    brut = profil.get("metadata")
    return dict(brut) if isinstance(brut, dict) else {}


def _lues(metadata: dict) -> dict:
    """Dict id → date ISO des alertes déjà lues (tolère un jsonb corrompu)."""
    brut = metadata.get(CLE_LUES)
    return dict(brut) if isinstance(brut, dict) else {}


def _offre_de(match: dict) -> dict:
    """Ressource offre embarquée par lire_matches_profil (dict, jamais None)."""
    brut = match.get("offre")
    if isinstance(brut, list):  # PostgREST renvoie parfois une liste
        brut = brut[0] if brut else None
    return brut if isinstance(brut, dict) else {}


def _resume_offre(offre: dict) -> str:
    """« Titre — Entreprise (Ville) » avec repli sur les champs renseignés."""
    titre = str(offre.get("titre") or "").strip() or "Offre"
    reste = [
        s
        for s in (
            str(offre.get("entreprise") or "").strip(),
            str(offre.get("ville") or "").strip(),
        )
        if s
    ]
    return f"{titre} — {', '.join(reste)}" if reste else titre


def _phrase_reste(jours: int) -> str:
    """« aujourd'hui » / « dans 1 jour » / « dans N jours »."""
    if jours <= 0:
        return "aujourd'hui"
    if jours == 1:
        return "dans 1 jour"
    return f"dans {jours} jours"


def _construire(matches: list[dict], telephone: str, today: date) -> list[dict]:
    """Alertes calculées à la volée — AUCUNE écriture, aucun envoi.

    - nouveau_match : ``date_match >= aujourd'hui - 7`` (fenêtre glissante,
      bornes identiques à dashboard/summary.calculer_resume) ;
    - echeance : bourse active clôturant dans 0 à SEUIL_J12 jours ; le seuil
      applicable est le plus urgent (J-3 gagne sur J-12), exactement comme
      run_deadline_job — mais ici on NE RIEN envoie et on ne marque rien.
    Tri : date décroissante, puis id décroissant (départage déterministe),
    plafond PLAFON_NOTIFICATIONS.
    """
    seuil = today - timedelta(days=FENETRE_NOUVEAU_JOURS)
    alertes: list[dict] = []

    for m in matches:
        match_id = m.get("id")
        if not match_id:
            continue
        offre = _offre_de(m)

        # --- nouveau_match : id stable + lien vers la fiche offre ----------
        date_match = _date_iso(m.get("date_match"))
        offre_id = offre.get("id")
        if date_match and date_match >= seuil and offre_id:
            alertes.append(
                {
                    "id": f"match:{match_id}",
                    "type": "nouveau_match",
                    "titre": "Nouveau match",
                    "texte": (
                        f"Une nouvelle offre correspond à ton profil : {_resume_offre(offre)}."
                    ),
                    "date": date_match.isoformat(),
                    "lien": f"/offres/{offre_id}",
                    "lue": False,
                }
            )

        # --- echeance : bourse (lecture stricte des seuils J-12 / J-3) -----
        if offre.get("type_offre") not in TYPES_RAPPELS_DEFAUT:
            continue
        if not offre.get("active", True):  # offre close : plus aucune alerte
            continue
        date_limite = _date_iso(offre.get("date_limite"))
        if not date_limite:
            continue
        jours = (date_limite - today).days
        if jours < 0 or jours > SEUIL_J12:  # hors fenêtre, comme notifier.py
            continue
        seuil_j = SEUIL_J3 if jours <= SEUIL_J3 else SEUIL_J12
        alertes.append(
            {
                "id": f"echeance:{match_id}:j{seuil_j}",
                "type": "echeance",
                "titre": "Échéance de bourse",
                "texte": (
                    f"{_resume_offre(offre)} — clôture le {date_limite.isoformat()} "
                    f"({_phrase_reste(jours)})."
                ),
                "date": today.isoformat(),  # alerte relevée aujourd'hui
                "lien": f"/profil/{telephone}",
                "lue": False,
            }
        )

    alertes.sort(key=lambda a: (a["date"], a["id"]), reverse=True)
    return alertes[:PLAFON_NOTIFICATIONS]


# ---------- Lecture : centre d'alertes ----------
@router.get("/{telephone}/notifications", response_model=NotificationsReponse)
async def lire_notifications(telephone: str, _session: str = Depends(garde_profil)):
    """Alertes du profil, calculées à la volée (pas de table ni de migration)."""
    profil = _profil(telephone)
    if not profil:
        raise HTTPException(404, "Profil non trouvé")

    lues = _lues(_metadata(profil))
    alertes = _construire(lire_matches_profil(profil["id"]), telephone, date.today())
    for alerte in alertes:
        alerte["lue"] = alerte["id"] in lues
    return {"notifications": alertes}


# ---------- Écriture : marquage « lu » ----------
@router.post("/{telephone}/notifications/lues")
async def marquer_lues(
    telephone: str,
    corps: NotificationsLuesRequete,
    _session: str = Depends(garde_profil),
):
    """Fusionne les ids reçus dans metadata['notifications_lues'] (plafond 200)."""
    profil = _profil(telephone)
    if not profil:
        raise HTTPException(404, "Profil non trouvé")

    metadata = _metadata(profil)
    lues = _lues(metadata)
    # Doublons écrêtés, ordre du corps conservé. Une entrée déjà lue garde sa
    # date d'origine : merge, jamais d'écrasement (ni des autres clés metadata).
    ids = list(dict.fromkeys(corps.ids))
    maintenant = datetime.now(timezone.utc).isoformat()
    for identifiant in ids:
        lues.setdefault(identifiant, maintenant)

    if len(lues) > PLAFON_LUES:
        # Plafond : les dates ISO trient lexicographiquement → les entrées les
        # plus anciennes sont supprimées en premier.
        lues = dict(sorted(lues.items(), key=lambda kv: str(kv[1]), reverse=True)[:PLAFON_LUES])

    metadata[CLE_LUES] = lues
    res = (
        supabase.table("profils")
        .update({"metadata": metadata})
        .eq("telephone", telephone)
        .execute()
    )
    if not res.data:
        raise HTTPException(500, "Erreur lors de l'enregistrement des notifications lues")
    return {"lues": len(ids)}
