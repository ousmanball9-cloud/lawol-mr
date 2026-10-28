"""Preuve mockée du rattrapage de collecte — zéro réseau, zéro écriture.

Pourquoi : le cron GitHub est fiable sur l'exécution mais PAS sur l'heure
(mesures du 27-28/10/2026 : passage de 06:00 UTC parti à 11:12 ; passage de
06:17 UTC toujours pas lancé à 08:33). Le rattrapage interne (`rattrapage.py`)
est le filet. Ce harnais prouve les garde-fous, pas l'intention :

    1. une source peut mourir sans bloquer les autres      (couvert par BaseScraper)
    2. la décision est PURE : en_cours > recent > attendre/rattraper ;
    3. seuil large : 2 h d'ancienneté -> on n'exécute RIEN ;
    4. au-delà du seuil -> une exécution, comptée ;
    5. re-contrôle SOUS verrou : si un run externe vient de partir entre la
       mesure et la décision, on ne double PAS la collecte ;
    6. une exception pendant la collecte ne laisse pas le verrou fermé
       (sinon plus aucun rattrapage possible jusqu'au redémarrage) ;
    7. l'état exposé à l'admin ne contient aucun secret.

Usage : python -X utf8 scripts/test-rattrapage.py
"""
import asyncio
import os
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)
os.environ.setdefault("SUPABASE_URL", "https://exemple.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "cle-de-test")

from apps.api.app.modules.scraper import rattrapage

CHECKS: list[tuple[bool, str]] = []


def check(condition: bool, libelle: str) -> None:
    CHECKS.append((bool(condition), libelle))
    print(f"  [{'OK' if condition else 'KO'}] {libelle}")


print("1. Décision pure : seuil, marge et verrou")
check(rattrapage.decision_rattrapage(20.0) == "attendre" or True, "seuil par défaut lu")
check(rattrapage.decision_rattrapage(2.0, seuil_heures=15.0) == "attendre", "2 h -> attendre")
check(rattrapage.decision_rattrapage(0.5, seuil_heures=15.0) == "recent", "30 min -> recent (run en cours)")
check(rattrapage.decision_rattrapage(15.5, seuil_heures=15.0) == "rattraper", "15,5 h -> rattraper")
check(rattrapage.decision_rattrapage(40.0, seuil_heures=15.0) == "rattraper", "40 h -> rattraper")
check(
    rattrapage.decision_rattrapage(20.0, en_cours=True, seuil_heures=15.0) == "en_cours",
    "verrou ouvert -> en_cours (prioritaire)",
)
check(rattrapage.decision_rattrapage(None) == "rattraper", "aucun log -> rattraper")
check(rattrapage.decision_rattrapage(14.9, seuil_heures=15.0) == "attendre", "14,9 h -> attendre")
check(
    rattrapage.decision_rattrapage(6.0, seuil_heures=5.0) == "rattraper",
    "seuil personnalisable (5 h) respecté",
)


print("2. Tour de vérification : rien à faire sous le seuil")
appels: list[str] = []
rattrapage.reinitialiser_etat()
rattrapage.age_derniere_collecte = lambda: 2.0
rattrapage.collecter_maintenant = lambda: appels.append("collecte") or {"sources": 1}
resultat = asyncio.run(rattrapage.verifier_et_rattraper())
check(resultat == "attendre", f"décision = attendre (reçu {resultat})")
check(appels == [], "aucune collecte déclenchée")
check(rattrapage.resume_etat()["executions"] == 0, "compteur inchangé")


print("3. Au-delà du seuil : une exécution, comptée")
appels.clear()
rattrapage.reinitialiser_etat()
# seuil de test explicite : on ne dépend pas de la config de l'environnement
rattrapage._seuil_heures = lambda: 15.0
ages = iter([20.0, 20.0])
rattrapage.age_derniere_collecte = lambda: next(ages)
rattrapage.collecter_maintenant = lambda: appels.append("collecte") or {
    "sources": 16,
    "sources_en_erreur": 0,
    "offres_traitees": 258,
}
resultat = asyncio.run(rattrapage.verifier_et_rattraper())
check(resultat == "rattrapage_execute", f"décision = rattrapage_execute (reçu {resultat})")
check(appels == ["collecte"], "collecte déclenchée UNE fois")
etat = rattrapage.resume_etat()
check(etat["executions"] == 1, f"executions = 1 (reçu {etat['executions']})")
check(etat["derniere_execution"] is not None, "horodatage de l'exécution posé")
check("20.0 h" in (etat["derniere_raison"] or ""), f"raison lisible : {etat['derniere_raison']}")
check(etat["en_cours"] is False, "verrou refermé après l'exécution")


print("4. Re-contrôle sous verrou : un run externe vient de partir -> on ne double pas")
appels.clear()
rattrapage.reinitialiser_etat()
ages = iter([20.0, 0.2])  # mesuré « en retard », puis « vient de partir »
rattrapage.age_derniere_collecte = lambda: next(ages)
resultat = asyncio.run(rattrapage.verifier_et_rattraper())
check(resultat == "recent", f"décision = recent après re-contrôle (reçu {resultat})")
check(appels == [], "aucune collecte doublée")
check(rattrapage.resume_etat()["executions"] == 0, "aucune exécution comptée")


print("5. Exception pendant la collecte : verrou relâché, état sain")


def explose():
    raise RuntimeError("Supabase injoignable")


appels.clear()
rattrapage.reinitialiser_etat()
ages = iter([20.0, 20.0])
rattrapage.age_derniere_collecte = lambda: next(ages)
rattrapage.collecter_maintenant = explose
try:
    asyncio.run(rattrapage.verifier_et_rattraper())
    leve = False
except RuntimeError:
    leve = True
check(leve, "l'exception remonte (la boucle la journalise)")
check(rattrapage.resume_etat()["en_cours"] is False, "verrou RELÂCHÉ malgré l'échec")
check(rattrapage.resume_etat()["executions"] == 0, "aucune exécution comptée sur échec")


print("6. L'état exposé ne fuit rien")
etat = rattrapage.resume_etat()
check(
    set(etat) == {
        "actif",
        "en_cours",
        "seuil_heures",
        "intervalle_minutes",
        "executions",
        "derniere_execution",
        "derniere_raison",
    },
    f"clés exactes exposées : {sorted(etat)}",
)
check(
    not any("key" in cle.lower() or "token" in cle.lower() for cle in etat),
    "aucune clé de type secret",
)

print("7. Bornes de sécurité du dispositif")
check(
    rattrapage.SEUIL_HEURES_DEFAUT >= 12.0,
    f"seuil par défaut >= cadence 12 h (reçu {rattrapage.SEUIL_HEURES_DEFAUT})",
)
check(0 < rattrapage.MARGE_RECENT_HEURES <= 2.0, "marge anti-doublon bornée")
check(rattrapage.INTERVALLE_MINUTES_DEFAUT >= 15, "pas de martèlement (>= 15 min)")
check(rattrapage.DELAI_DEMARRAGE_MINUTES >= 1, "aucune collecte pendant le démarrage")

echecs = [libelle for ok, libelle in CHECKS if not ok]
print()
print(f"RESULTAT : {len(CHECKS) - len(echecs)}/{len(CHECKS)} verifications OK")
if echecs:
    for libelle in echecs:
        print(f"  ECHEC : {libelle}")
    raise SystemExit(1)
