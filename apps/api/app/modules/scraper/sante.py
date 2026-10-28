"""Santé de la collecte — « quand la dernière collecte a-t-elle tourné ? ».

Pourquoi ce module (mesure du 27/10/2026) : **7 jours de collecte muette**
(20 -> 26/10) n'ont été vus par personne, parce que la fraîcheur de la collecte
n'était visible nulle part dans l'application — uniquement dans l'onglet Actions
de GitHub, que personne n'ouvre. Un site qui affiche des offres périmées sans le
dire est plus dangereux qu'un site vide : l'étudiant croit le catalogue à jour.

Source de vérité : `scraper_logs`. Chaque `BaseScraper.run()` y écrit une ligne
(succès ou erreur), y compris dans le chemin de PRODUCTION
(`POST /api/v1/scraper/run`, déclenché par le cron GitHub) — vérifié le 27/10 :
385 lignes, la dernière datée de la collecte de 18:46.

PIÈGE MESURÉ (27/10) : `scraper_logs` est sous RLS **sans policy de SELECT**
publique. Une lecture avec la clé ANON renvoie `[]` — une liste vide, PAS une
erreur. Ce n'est pas « aucun log », c'est « pas le droit de lire ». Ce module lit
donc avec le client `service_role` du backend (`core.database.supabase`), celui
qui écrit déjà ces lignes.

Contrat (prouvé par `scripts/test-sante-collecte.py`, zéro réseau) :

    1. aucune ligne            -> statut « jamais » (le cron n'a jamais tourné) ;
    2. dernière ligne > 26 h   -> statut « retard » (une collecte manque : 2/jour) ;
    3. >= 60 % de la dernière  -> statut « degrade » (collecte partielle) ;
    4. sinon                   -> statut « ok » ;
    5. « en retard » prime sur « dégradé » (une panne de cron est plus grave
       qu'une source morte) ;
    6. la prochaine échéance est calculée en UTC sur le cron réel
       (`17 6,18 * * *`), jamais devinée côté navigateur ;
    7. `offres_traitees` = upserts acceptés (mises à jour comprises) — ce n'est
       PAS le nombre de nouvelles offres, et on ne l'appelle pas ainsi ;
    8. une source ne compte qu'UNE fois par passage (dédoublonnage) : deux
       exécutions qui se chevauchent ne gonflent pas les compteurs.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from apps.api.app.core.database import supabase

# 2 passages/jour (06:17 et 18:17 UTC) : au-delà de 26 h sans log, un passage a
# sauté — le seuil laisse 8 h de marge pour l'heure de démarrage réelle (GitHub
# retarde les crons planifiés : mesuré 06:00 -> 11:12 le 27/10).
SEUIL_HEURES = 26

# Regroupement des lignes d'un MÊME passage : une collecte écrit une ligne par
# source en quelques minutes (mesuré 18:45:17 -> 18:46:13, soit 56 s pour 16).
FENETRE_RUN_MINUTES = 45

# Cron réellement planifié côté GitHub Actions (`.github/workflows/scraper-cron.yml`).
HEURES_CRON_UTC = (6, 18)
MINUTE_CRON_UTC = 17

# En dessous de ce nombre de sources loguées, un taux d'erreur n'est pas
# interprétable (1 ligne en erreur sur 1 = 100 %, mais ce n'est pas un run).
SOURCES_MIN_JUGEABLES = 3


def maintenant_utc() -> datetime:
    return datetime.now(timezone.utc)


def _en_datetime(valeur: str) -> datetime:
    """PostgREST rend « 2026-10-27T18:46:13.601147+00:00 » (ou « ...Z »)."""
    texte = valeur.replace("Z", "+00:00")
    moment = datetime.fromisoformat(texte)
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def prochaine_collecte(moment: datetime | None = None) -> datetime:
    """Prochaine échéance prévue du cron (`17 6,18 * * *`, UTC)."""
    moment = moment or maintenant_utc()
    candidats: list[datetime] = []
    for decalage in (0, 1):
        jour = (moment + timedelta(days=decalage)).date()
        for heure in HEURES_CRON_UTC:
            candidats.append(
                datetime(
                    jour.year, jour.month, jour.day,
                    heure, MINUTE_CRON_UTC, tzinfo=timezone.utc,
                )
            )
    futurs = [c for c in candidats if c > moment]
    return min(futurs) if futurs else max(candidats)


def _message(statut: str, age_heures: float, sources: int, erreurs: int) -> str:
    if statut == "jamais":
        return (
            "Aucune collecte enregistrée : la collecte automatique n'a jamais "
            "tourné (ou ses logs sont invisibles)."
        )
    if statut == "retard":
        return (
            f"Collecte en retard : dernière exécution il y a {age_heures:.0f} h "
            f"(seuil {SEUIL_HEURES} h pour 2 passages/jour)."
        )
    if statut == "degrade":
        return (
            f"Collecte dégradée : {erreurs} source{'s' if erreurs > 1 else ''} en "
            f"erreur sur {sources} au dernier passage — le catalogue ne se renouvelle "
            "que partiellement."
        )
    # « il y a 0 h » n'informe personne : sous l'heure, on parle en minutes.
    if age_heures < 1:
        temps = f"{max(1, round(age_heures * 60))} min"
    else:
        temps = f"{age_heures:.0f} h"
    return (
        f"Dernière collecte il y a {temps} : {sources} source"
        f"{'s' if sources > 1 else ''}, {erreurs} en erreur."
    )


def resume_sante(
    lignes: list[dict],
    offres_actives: int = 0,
    moment: datetime | None = None,
) -> dict:
    """Construit le résumé de santé à partir des lignes `scraper_logs` (desc)."""
    moment = moment or maintenant_utc()
    prochaine = prochaine_collecte(moment)

    if not lignes:
        return {
            "statut": "jamais",
            "message": _message("jamais", 0.0, 0, 0),
            "derniere_collecte": None,
            "age_heures": None,
            "seuil_heures": SEUIL_HEURES,
            "sources": 0,
            "sources_en_erreur": 0,
            "offres_traitees": 0,
            "offres_actives": offres_actives,
            "prochaine_collecte": prochaine.isoformat(),
        }

    horodatages = [_en_datetime(ligne["created_at"]) for ligne in lignes if ligne.get("created_at")]
    if not horodatages:
        # Des lignes sans date exploitable ne prouvent rien : on ne prétend pas
        # que la collecte est fraîche (règle « on ne clôture pas sur une donnée
        # manquante », appliquée ici au diagnostic).
        return {
            "statut": "jamais",
            "message": "Logs de collecte illisibles (aucune date exploitable).",
            "derniere_collecte": None,
            "age_heures": None,
            "seuil_heures": SEUIL_HEURES,
            "sources": len(lignes),
            "sources_en_erreur": 0,
            "offres_traitees": 0,
            "offres_actives": offres_actives,
            "prochaine_collecte": prochaine.isoformat(),
        }

    derniere = max(horodatages)
    age_heures = (moment - derniere).total_seconds() / 3600.0
    fenetre = timedelta(minutes=FENETRE_RUN_MINUTES)

    # DÉDOUBLONNAGE PAR SOURCE (mesure du 27/10) : deux exécutions peuvent
    # tomber dans la même fenêtre — le run manuel tombé en 502 a continué
    # côté serveur et ses 5 dernières sources ont logué 6 min avant le run
    # complet. Sans dédoublonnage, on annonçait 21 sources et 293 upserts au
    # lieu de 16 et 258. Une source ne peut pas tourner deux fois dans un
    # passage : on garde son log le PLUS RÉCENT.
    dernier_par_source: dict[str, tuple[datetime, dict]] = {}
    for ligne, quand in zip(lignes, horodatages):
        if derniere - quand > fenetre:
            continue
        nom = ligne.get("source_name") or "?"
        if nom not in dernier_par_source or dernier_par_source[nom][0] < quand:
            dernier_par_source[nom] = (quand, ligne)

    passage = [ligne for _, ligne in dernier_par_source.values()]
    sources = len(passage)
    erreurs = sum(1 for ligne in passage if ligne.get("status") != "success")
    # `offres_nouvelles` compte les UPSERTS acceptés (mises à jour comprises) :
    # ce n'est PAS le nombre de nouvelles offres, ne pas l'appeler ainsi.
    traitees = sum(int(ligne.get("offres_nouvelles") or 0) for ligne in passage)

    if age_heures > SEUIL_HEURES:
        statut = "retard"
    elif sources >= SOURCES_MIN_JUGEABLES and erreurs / sources >= 0.6:
        statut = "degrade"
    else:
        statut = "ok"

    return {
        "statut": statut,
        "message": _message(statut, age_heures, sources, erreurs),
        "derniere_collecte": derniere.isoformat(),
        "age_heures": round(age_heures, 2),
        "seuil_heures": SEUIL_HEURES,
        "sources": sources,
        "sources_en_erreur": erreurs,
        "offres_traitees": traitees,
        "offres_actives": offres_actives,
        "prochaine_collecte": prochaine.isoformat(),
    }


def sante_collecte(limite: int = 200) -> dict:
    """Lit `scraper_logs` (service_role : la RLS les cache à la clé ANON)."""
    res = (
        supabase.table("scraper_logs")
        .select("source_name,status,offres_nouvelles,offres_total,created_at")
        .order("created_at", desc=True)
        .limit(limite)
        .execute()
    )
    actives = (
        supabase.table("offres")
        .select("id", count="exact", head=True)
        .eq("active", True)
        .gte("date_limite", date.today().isoformat())
        .execute()
    )
    return resume_sante(res.data or [], actives.count or 0)
