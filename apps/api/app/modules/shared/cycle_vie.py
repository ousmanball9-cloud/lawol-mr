# -*- coding: utf-8 -*-
"""Cycle de vie des offres — clôture automatique des offres expirées.

Pourquoi ce module existe (mesuré le 27/10/2026) : `offres` contenait
**408 lignes pour 298 actives non expirées**. Une offre dont la date limite est
passée restait `active = true`, donc :

  · elle continuait d'apparaître partout où l'on filtre sur `active` seul
    (`/api/v1/matches` avant son correctif, tableau de bord admin, stats) ;
  · elle restait un candidat pour le moteur de matching (le filtre
    `date_limite >= aujourd'hui` du moteur masquait le symptôme, pas la cause) ;
  · elle gonflait les compteurs d'un catalogue qui se vide sans que personne
    ne le voie.

Le moteur et la liste publique filtrent déjà sur la date : ce module ne les
remplace pas, il remet la BASE en accord avec la réalité (`active = false`),
pour que tout futur consommateur hérite d'un état sain au lieu de devoir
répéter la même condition.

Aucune suppression : `active = false` est réversible et n'efface rien.
"""
from __future__ import annotations

from datetime import date

from apps.api.app.core.database import supabase

# PostgREST refuse les URL trop longues : on écrit par lots d'identifiants.
TAILLE_LOT = 100


def offres_expirees(aujourdhui: date | None = None) -> list[dict]:
    """Offres encore actives dont la date limite est passée.

    Une `date_limite` absente ou illisible n'est JAMAIS traitée comme expirée :
    on ne clôture pas une offre sur une donnée manquante (une offre sans date
    exploitable reste ouverte, c'est le scraping qui doit la corriger).
    """
    jour = (aujourdhui or date.today()).isoformat()
    res = (
        supabase.table("offres")
        .select("id, titre, source_name, date_limite, active")
        .eq("active", True)
        .not_.is_("date_limite", "null")
        .lt("date_limite", jour)
        .execute()
    )
    return list(res.data or [])


def cloturer_offres_expirees(
    appliquer: bool = False, aujourdhui: date | None = None
) -> dict:
    """Clôture les offres expirées. `appliquer=False` = simulation seule.

    Retour : ``{"examinees", "cloturees", "echecs", "simulation", "echecs_detail"}``.
    Idempotent : une offre déjà clôturée n'est plus sélectionnée.
    """
    a_cloturer = offres_expirees(aujourdhui)
    rapport = {
        "examinees": len(a_cloturer),
        "cloturees": 0,
        "echecs": 0,
        "simulation": not appliquer,
        "echecs_detail": [],
    }
    if not appliquer:
        return rapport

    ids = [o["id"] for o in a_cloturer]
    for debut in range(0, len(ids), TAILLE_LOT):
        lot = ids[debut : debut + TAILLE_LOT]
        try:
            supabase.table("offres").update({"active": False}).in_("id", lot).execute()
            rapport["cloturees"] += len(lot)
        except Exception as exc:  # noqa: BLE001 — un lot en échec ne bloque pas les autres
            rapport["echecs"] += len(lot)
            rapport["echecs_detail"].append(f"lot {debut}: {type(exc).__name__}: {exc}")
    return rapport
