"""Moteur de matching — règle PURE, sans I/O, testable unitairement.

Règle (v1) :
  un match existe si :
    1. profil.actif ET offre.active
    2. offre non expirée (date_limite >= aujourd'hui)
    3. offre.type_offre ∈ profil.types_recherches
    4. filière : profil.filiere ∈ offre.filieres_cibles
       OU profil.filieres_interet ∩ offre.filieres_cibles ≠ ∅
    5. ville : même ville OU profil.ville = AUTRE OU offre.ville = AUTRE
"""
from datetime import date

from apps.api.app.core.database import supabase
from apps.api.app.modules.shared.models import Filiere, Ville


def match_regles(
    *,
    profil_actif: bool,
    offre_active: bool,
    date_limite: date,
    type_offre: str,
    types_recherches: list[str],
    filiere_profil: str,
    filieres_interet: list[str],
    filieres_cibles: list[str],
    ville_profil: str,
    ville_offre: str,
    aujourdhui: date | None = None,
) -> tuple[bool, str]:
    """Retourne (match?, raison) — raison utile pour le debug/dashboard."""
    aujourdhui = aujourdhui or date.today()

    if not profil_actif:
        return False, "profil_inactif"
    if not offre_active:
        return False, "offre_inactive"
    if date_limite < aujourdhui:
        return False, "offre_expiree"
    if type_offre not in types_recherches:
        return False, "type_non_recherche"

    # Filieres
    cibles = set(filieres_cibles)
    if filiere_profil in cibles:
        pass
    elif cibles & set(filieres_interet):
        pass
    else:
        return False, "filiere_non_matchee"

    # Ville
    if ville_profil != ville_offre and ville_profil != Ville.AUTRE.value and ville_offre != Ville.AUTRE.value:
        return False, "ville_non_matchee"

    return True, "match"


def run_matching_job() -> dict:
    """Charge profils + offres, calcule les nouveaux matches, les insère."""
    # 1. Profils actifs
    profils_res = supabase.table("profils").select("*").eq("actif", True).execute()
    # 2. Offres actives non expirées
    offres_res = (
        supabase.table("offres")
        .select("*")
        .eq("active", True)
        .gte("date_limite", date.today().isoformat())
        .execute()
    )
    # 3. Pairs déjà matchées (éviter doublons)
    matches_res = supabase.table("matches").select("offre_id, profil_id").execute()
    deja_matchees = {(m["offre_id"], m["profil_id"]) for m in matches_res.data}

    # 4. Calcul
    nouveaux = []
    stats = {"examines": 0, "matches": 0, "ignores_deja": 0}
    for p in profils_res.data:
        for o in offres_res.data:
            stats["examines"] += 1
            if (o["id"], p["id"]) in deja_matchees:
                stats["ignores_deja"] += 1
                continue
            ok, raison = match_regles(
                profil_actif=p.get("actif", True),
                offre_active=o.get("active", True),
                date_limite=date.fromisoformat(o["date_limite"]),
                type_offre=o["type_offre"],
                types_recherches=p.get("types_recherches", []),
                filiere_profil=p["filiere"],
                filieres_interet=p.get("filieres_interet", []),
                filieres_cibles=o.get("filieres_cibles", []),
                ville_profil=p["ville"],
                ville_offre=o["ville"],
            )
            if ok:
                nouveaux.append(
                    {
                        "offre_id": o["id"],
                        "profil_id": p["id"],
                        "score": 100,
                        "metadata": {"regle": "v1", "raison": raison},
                    }
                )

    # 5. Insertion
    if nouveaux:
        supabase.table("matches").insert(nouveaux).execute()
    stats["matches"] = len(nouveaux)
    return stats
