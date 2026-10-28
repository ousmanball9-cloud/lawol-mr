"""Rattrapage de collecte — le filet quand le cron externe prend du retard.

Constat mesuré (27-28/10/2026) : le cron GitHub est **fiable sur l'exécution
mais pas sur l'heure**. Deux mesures : passage de 06:00 UTC parti à 11:12
(5 h 12 de retard) le 27/10, et le passage de 06:17 UTC du 28/10 toujours pas
lancé à 08:33. Le dashboard affiche désormais ce retard (`sante-collecte`),
mais l'afficher ne remplit pas le catalogue.

Principe : l'API tourne déjà en continu et exécute DÉJÀ la collecte
(`POST /api/v1/scraper/run`). On y ajoute une vérification périodique :
si la dernière collecte est plus vieille que le seuil, elle est relancée
depuis le serveur — sans dépendre d'un ordonnanceur externe.

Garde-fous (indispensables, une boucle qui scrape est une boucle qui peut
marteler des sites tiers) :

    1. seuil LARGE (15 h pour une cadence de 12 h) : le rattrapage comble un
       passage MANQUÉ, il ne transforme pas 2 passages/jour en 6 ;
    2. re-contrôle SOUS verrou juste avant d'écrire : si un run GitHub vient de
       partir entre la mesure et la décision, on n'exécute rien ;
    3. une seule exécution à la fois (`en_cours`) — jamais deux collectes
       concurrentes qui écriraient les mêmes `source_url` ;
    4. démarrage différé (5 min) : on ne scrape pas pendant un déploiement ;
    5. toute exception est absorbée et journalisée : la boucle ne meurt jamais
       et ne bloque jamais l'API ;
    6. désactivable par configuration (`RATTRAPAGE_ACTIF=false`).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from apps.api.app.core.config import settings

# Journalisation : les loggers applicatifs ne sont PAS configurés en production
# (mesure du 28/10 : `LOG.info("rattrapage: arme …")` n'apparaissait NULLE PART
# dans les logs Railway — le logger racine n'a pas de handler sous uvicorn, et
# `logging.lastResort` ne sort que les WARNING+). Un dispositif de secours dont
# on ne voit pas le démarrage n'est pas vérifiable : on pose donc un handler
# explicite sur ce seul logger, sans toucher à la configuration globale.
LOG = logging.getLogger("lawol.rattrapage")
LOG.setLevel(logging.INFO)
if not LOG.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     %(message)s"))
    LOG.addHandler(_handler)
    LOG.propagate = False

# Cadence attendue = 2 passages/jour (12 h). Seuil 15 h = 12 h + 3 h de marge :
# un passage en retard de 5 h (mesuré) ne déclenche donc RIEN, un passage
# réellement manqué (ou un cron mort) déclenche le filet.
SEUIL_HEURES_DEFAUT = 15.0
# Deux vérifications de la même décision sont séparées par 30 min : réactif
# sans transformer l'API en marteleur.
INTERVALLE_MINUTES_DEFAUT = 30
# En dessous de cette ancienneté, un run vient visiblement de partir (GitHub) :
# on ne double pas.
MARGE_RECENT_HEURES = 1.0
# On laisse le déploiement se terminer avant la première vérification.
DELAI_DEMARRAGE_MINUTES = 5

_ETAT: dict = {
    "actif": False,
    "en_cours": False,
    "executions": 0,
    "derniere_execution": None,
    "derniere_raison": None,
}


def _seuil_heures() -> float:
    return float(getattr(settings, "SEUIL_RATTRAPAGE_HEURES", SEUIL_HEURES_DEFAUT))


def _intervalle_minutes() -> int:
    return int(getattr(settings, "INTERVALLE_RATTRAPAGE_MINUTES", INTERVALLE_MINUTES_DEFAUT))


def decision_rattrapage(
    age_heures: float | None,
    en_cours: bool = False,
    seuil_heures: float | None = None,
    marge_recent_heures: float = MARGE_RECENT_HEURES,
) -> str:
    """Décide quoi faire — fonction PURE, donc testable sans réseau ni horloge.

    Retourne : ``en_cours`` | ``recent`` | ``rattraper`` | ``attendre``.
    « jamais » (aucun log lisible) compte comme une raison de rattraper : on ne
    laisse pas un catalogue vide au motif qu'on ne sait pas depuis quand.
    """
    if en_cours:
        return "en_cours"
    seuil = _seuil_heures() if seuil_heures is None else seuil_heures
    if age_heures is None:
        return "rattraper"
    if age_heures < marge_recent_heures:
        return "recent"
    if age_heures > seuil:
        return "rattraper"
    return "attendre"


def age_derniere_collecte() -> float | None:
    """Ancienneté de la dernière ligne `scraper_logs` (heures), None si absente."""
    from apps.api.app.modules.scraper.sante import maintenant_utc, sante_collecte

    resume = sante_collecte(limite=1)
    derniere = resume.get("derniere_collecte")
    if not derniere:
        return None
    moment = datetime.fromisoformat(derniere.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return (maintenant_utc() - moment).total_seconds() / 3600.0


def collecter_maintenant() -> dict:
    """Exécute la MÊME chaîne que le cron : sources -> matching -> clôture.

    Appelé dans un thread (`asyncio.to_thread`) : les scrapers sont bloquants.
    Chaque source isole déjà ses erreurs (`BaseScraper.run`), donc une source
    morte n'empêche pas les autres — et le retour dit combien ont échoué.
    """
    from apps.api.app.modules.matching.engine import run_matching_job
    from apps.api.app.modules.scraper.sources.catalogue import get_scrapers

    resultats = [scraper.run() for scraper in get_scrapers()]
    echecs = sum(1 for r in resultats if r.get("statut") != "success")
    upserts = sum(int(r.get("inserrees") or 0) for r in resultats)

    resume: dict = {
        "sources": len(resultats),
        "sources_en_erreur": echecs,
        "offres_traitees": upserts,
    }

    try:
        resume["matching"] = run_matching_job()
    except Exception as exc:  # noqa: BLE001 — le matching ne bloque pas la collecte
        LOG.warning("rattrapage: matching en echec (%s)", exc)
        resume["matching"] = {"erreur": str(exc)[:200]}

    try:
        # Cycle de vie (même règle que `scripts/collecte_auto.py`) : une offre
        # échue ne reste pas `active` — réversible, aucune suppression.
        from apps.api.app.modules.shared.cycle_vie import cloturer_offres_expirees

        resume["cloture"] = cloturer_offres_expirees(appliquer=True)
    except Exception as exc:  # noqa: BLE001
        LOG.warning("rattrapage: cloture en echec (%s)", exc)
        resume["cloture"] = {"erreur": str(exc)[:200]}

    return resume


async def verifier_et_rattraper() -> str:
    """Un tour de vérification. Retourne la décision appliquée (journalisable)."""
    if _ETAT["en_cours"]:
        return "en_cours"

    age = age_derniere_collecte()
    decision = decision_rattrapage(age, _ETAT["en_cours"])
    if decision not in ("rattraper", "recent"):
        return decision
    if decision == "recent":
        return "recent"

    _ETAT["en_cours"] = True
    try:
        # Re-contrôle SOUS verrou : entre la mesure et ici, un run GitHub a pu
        # partir. Sans lui, on doublerait la collecte.
        age = age_derniere_collecte()
        decision = decision_rattrapage(age, False)
        if decision != "rattraper":
            return decision

        resume = await asyncio.to_thread(collecter_maintenant)
        _ETAT["executions"] += 1
        _ETAT["derniere_execution"] = datetime.now(timezone.utc).isoformat()
        _ETAT["derniere_raison"] = (
            f"derniere collecte il y a {age:.1f} h" if age is not None else "aucune collecte"
        )
        LOG.info(
            "rattrapage: collecte executee (%s) -> %s sources, %s upserts, %s en erreur",
            _ETAT["derniere_raison"],
            resume.get("sources"),
            resume.get("offres_traitees"),
            resume.get("sources_en_erreur"),
        )
        return "rattrapage_execute"
    finally:
        _ETAT["en_cours"] = False


async def _boucle() -> None:
    await asyncio.sleep(DELAI_DEMARRAGE_MINUTES * 60)
    while True:
        try:
            await verifier_et_rattraper()
        except asyncio.CancelledError:  # arrêt propre au shutdown
            raise
        except Exception as exc:  # noqa: BLE001 — la boucle ne meurt jamais
            LOG.warning("rattrapage: verification en echec (%s)", exc)
        await asyncio.sleep(_intervalle_minutes() * 60)


def demarrer_boucle() -> asyncio.Task | None:
    """Arme le filet (no-op si `RATTRAPAGE_ACTIF=false`)."""
    if not getattr(settings, "RATTRAPAGE_ACTIF", True):
        LOG.info("rattrapage: desactive par configuration")
        return None
    _ETAT["actif"] = True
    LOG.info(
        "rattrapage: arme (seuil %.0f h, verification toutes les %d min)",
        _seuil_heures(),
        _intervalle_minutes(),
    )
    return asyncio.create_task(_boucle())


def resume_etat() -> dict:
    """État exposé à l'admin (aucun secret, aucune donnée personnelle)."""
    return {
        "actif": _ETAT["actif"],
        "en_cours": _ETAT["en_cours"],
        "seuil_heures": _seuil_heures(),
        "intervalle_minutes": _intervalle_minutes(),
        "executions": _ETAT["executions"],
        "derniere_execution": _ETAT["derniere_execution"],
        "derniere_raison": _ETAT["derniere_raison"],
    }


# Utilisé par les harnais : remise à zéro de l'état process.
def reinitialiser_etat() -> None:
    _ETAT.update(
        {
            "actif": _ETAT["actif"],
            "en_cours": False,
            "executions": 0,
            "derniere_execution": None,
            "derniere_raison": None,
        }
    )


__all__ = [
    "collecter_maintenant",
    "decision_rattrapage",
    "demarrer_boucle",
    "reinitialiser_etat",
    "resume_etat",
    "verifier_et_rattraper",
]
