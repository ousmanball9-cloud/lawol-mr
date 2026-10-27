"""Preuve mockée de la santé de la collecte — zéro réseau.

Incident du 27/10/2026 : **7 jours de collecte muette** (20 -> 26/10) — les runs
GitHub échouaient en 7 s et personne ne l'a vu, parce que la fraîcheur de la
collecte n'était visible que dans l'onglet Actions. Ce harnais prouve le
diagnostic exposé à l'admin (`GET /api/v1/admin/sante-collecte`) :

    1. aucune ligne `scraper_logs`      -> « jamais » (le cron n'a jamais tourné) ;
    2. collecte fraîche                 -> « ok » ;
    3. dernière exécution > 26 h        -> « retard » ;
    4. >= 60 % de sources en erreur      -> « degrade » ;
    5. 1 source en erreur sur 4          -> « ok » (partiel toléré) ;
    6. retard + dégradé                  -> « retard » PRIME (cron cassé > source morte) ;
    7. ligne sans date exploitable       -> « jamais » (aucun faux vert) ;
    8. les lignes d'un AUTRE passage     -> hors fenêtre, non comptées ;
    9. `prochaine_collecte` suit le cron réel 06:17 / 18:17 UTC ;
   10. lecture service_role : `order(created_at, desc)` + `limit` + filtre
       `active=true` / `date_limite >= aujourd'hui` (la RLS cache tout à l'anon) ;
   11. deux passages qui se chevauchent -> dédoublonnage par source (16 et non 21).

Usage : python -X utf8 scripts/test-sante-collecte.py
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)

from apps.api.app.modules.scraper import sante

CHECKS: list[tuple[bool, str]] = []


def check(condition: bool, libelle: str) -> None:
    CHECKS.append((bool(condition), libelle))
    print(f"  [{'OK' if condition else 'KO'}] {libelle}")


MAINTENANT = datetime(2026, 10, 27, 12, 0, tzinfo=timezone.utc)


def log(heures_avant: float, statut: str = "success", nouvelles: int = 0, source: str = "src") -> dict:
    return {
        "source_name": source,
        "status": statut,
        "offres_nouvelles": nouvelles,
        "offres_total": nouvelles,
        "created_at": (MAINTENANT - timedelta(hours=heures_avant)).isoformat(),
    }


print("1. Aucune ligne : « jamais »")
resume = sante.resume_sante([], offres_actives=274, moment=MAINTENANT)
check(resume["statut"] == "jamais", "statut = jamais")
check(resume["derniere_collecte"] is None, "derniere_collecte = None")
check(resume["offres_actives"] == 274, "offres_actives transmises")
check("jamais tourné" in resume["message"], "message explicite (pas un silence)")

print("2. Collecte fraîche (il y a 1 h, 3 sources, 0 erreur) : « ok »")
lignes = [log(1.0, nouvelles=5, source="a"), log(1.1, nouvelles=7, source="b"), log(1.2, nouvelles=0, source="c")]
resume = sante.resume_sante(lignes, offres_actives=274, moment=MAINTENANT)
check(resume["statut"] == "ok", "statut = ok")
check(resume["sources"] == 3, f"sources = 3 (reçu {resume['sources']})")
check(resume["sources_en_erreur"] == 0, "sources_en_erreur = 0")
check(resume["offres_traitees"] == 12, f"offres_traitees cumulées = 12 (reçu {resume['offres_traitees']})")
check(resume["age_heures"] == 1.0, f"age_heures = 1.0 (reçu {resume['age_heures']})")

print("3. Dernière exécution il y a 40 h : « retard »")
resume = sante.resume_sante([log(40.0)], moment=MAINTENANT)
check(resume["statut"] == "retard", "statut = retard")
check("retard" in resume["message"].lower(), "message de retard")

print("4. 3 sources en erreur sur 4 (75 %) : « degrade »")
lignes = [
    log(1.0, "success", source="a"),
    log(1.05, "error", source="b"),
    log(1.1, "error", source="c"),
    log(1.15, "error", source="d"),
]
resume = sante.resume_sante(lignes, moment=MAINTENANT)
check(resume["statut"] == "degrade", "statut = degrade")
check(resume["sources_en_erreur"] == 3, "3 erreurs comptées")

print("5. 1 source en erreur sur 4 (25 %) : « ok » (partiel toléré)")
lignes = [
    log(1.0, "success", source="a"),
    log(1.05, "success", source="b"),
    log(1.1, "success", source="c"),
    log(1.15, "error", source="d"),
]
resume = sante.resume_sante(lignes, moment=MAINTENANT)
check(resume["statut"] == "ok", "statut = ok")
check(resume["sources_en_erreur"] == 1, "1 erreur signalée sans bloquer")

print("6. Retard ET dégradé : « retard » prime")
lignes = [log(30.0, "error", source="a"), log(30.1, "error", source="b"), log(30.2, "error", source="c")]
resume = sante.resume_sante(lignes, moment=MAINTENANT)
check(resume["statut"] == "retard", "statut = retard (pas degrade)")

print("7. Ligne sans date exploitable : « jamais » (aucun faux vert)")
resume = sante.resume_sante([{"status": "success", "created_at": ""}], moment=MAINTENANT)
check(resume["statut"] == "jamais", "statut = jamais")
check(resume["derniere_collecte"] is None, "aucune date inventée")

print("8. Lignes d'un AUTRE passage (hors fenêtre 45 min) : non comptées")
lignes = [
    log(1.0, "success", source="a"),
    log(1.1, "success", source="b"),
    log(20.0, "error", source="c"),
    log(20.1, "error", source="d"),
]
resume = sante.resume_sante(lignes, moment=MAINTENANT)
check(resume["sources"] == 2, f"seules les 2 lignes du dernier passage comptent (reçu {resume['sources']})")
check(resume["sources_en_erreur"] == 0, "les erreurs de l'ancien passage ne polluent pas")

print("9. prochaine_collecte suit le cron 06:17 / 18:17 UTC")
cas = [
    (datetime(2026, 10, 27, 5, 0, tzinfo=timezone.utc), datetime(2026, 10, 27, 6, 17, tzinfo=timezone.utc)),
    (datetime(2026, 10, 27, 6, 17, tzinfo=timezone.utc), datetime(2026, 10, 27, 18, 17, tzinfo=timezone.utc)),
    (datetime(2026, 10, 27, 7, 0, tzinfo=timezone.utc), datetime(2026, 10, 27, 18, 17, tzinfo=timezone.utc)),
    (datetime(2026, 10, 27, 19, 0, tzinfo=timezone.utc), datetime(2026, 10, 28, 6, 17, tzinfo=timezone.utc)),
]
for moment, attendu in cas:
    obtenu = sante.prochaine_collecte(moment)
    check(obtenu == attendu, f"{moment:%H:%M} -> {obtenu:%d/%m %H:%M} (attendu {attendu:%d/%m %H:%M})")
check(sante.MINUTE_CRON_UTC == 17, "minute 17 = celle du workflow GitHub (pas l'heure pile)")
check(sante.HEURES_CRON_UTC == (6, 18), "2 passages : 6 h et 18 h UTC")

print("9b. Deux passages qui se chevauchent : dédoublonnage par source")
# Mesure réelle du 27/10 : le run manuel tombé en 502 a CONTINUÉ côté serveur,
# si bien que ses 5 dernières sources ont logué 6 min avant le run complet ->
# 21 lignes lues, mais 16 sources réelles et 258 upserts (pas 293).
lignes = [log(1.0, nouvelles=58, source=f"src{i:02d}") for i in range(11)]
chevauche = (("beta_mr", 26), ("mauritel", 6), ("snim", 0), ("bnm", 0), ("totalenergies", 3))
lignes += [log(1.2, nouvelles=n, source=s) for s, n in chevauche]
lignes += [log(6.0, nouvelles=n, source=s) for s, n in chevauche]
resume = sante.resume_sante(lignes, moment=MAINTENANT)
check(resume["sources"] == 16, f"16 sources distinctes (reçu {resume['sources']})")
check(
    resume["offres_traitees"] == 58 * 11 + 26 + 6 + 0 + 0 + 3,
    f"upserts comptés une fois (reçu {resume['offres_traitees']}, attendu 673)",
)
check(resume["sources_en_erreur"] == 0, "aucune fausse erreur héritée du passage précédent")


print("10. Lecture service_role : ordre, limite et filtres attendus")


class FauxSupabase:
    """Reproduit le sous-ensemble PostgREST utilisé par `sante_collecte`."""

    def __init__(self, lignes: list[dict], actives: int):
        self.lignes = lignes
        self.actives = actives
        self.appels: list[dict] = []

    def table(self, nom: str):
        return _Requete(self, nom)


class _Requete:
    def __init__(self, faux: FauxSupabase, table: str):
        self._faux = faux
        self._trace = {"table": table}
        faux.appels.append(self._trace)

    def select(self, colonnes: str, count: str | None = None, head: bool = False):
        self._trace["select"] = colonnes
        self._trace["count"] = count
        self._trace["head"] = head
        return self

    def order(self, colonne: str, desc: bool = False):
        self._trace["order"] = (colonne, desc)
        return self

    def limit(self, n: int):
        self._trace["limit"] = n
        return self

    def eq(self, colonne: str, valeur: object):
        self._trace.setdefault("eq", []).append((colonne, valeur))
        return self

    def gte(self, colonne: str, valeur: object):
        self._trace.setdefault("gte", []).append((colonne, valeur))
        return self

    def execute(self):
        if self._trace["table"] == "scraper_logs":
            return _Reponse(self._faux.lignes, None)
        return _Reponse([], self._faux.actives)


class _Reponse:
    def __init__(self, data: list[dict], count: int | None):
        self.data = data
        self.count = count


faux = FauxSupabase([log(1.0, nouvelles=3, source="a"), log(1.1, nouvelles=2, source="b")], actives=274)
sante.supabase = faux
resultat = sante.sante_collecte()

logs = next(a for a in faux.appels if a["table"] == "scraper_logs")
offres = next(a for a in faux.appels if a["table"] == "offres")
check(logs["order"] == ("created_at", True), "logs triés par created_at décroissant")
check(logs["limit"] == 200, "limite bornée (200 lignes)")
check(("active", True) in offres.get("eq", []), "offres actives filtrées (active=true)")
check(
    ("date_limite", datetime.now(timezone.utc).date().isoformat()) in offres.get("gte", []),
    "échéance future exigée (pas les offres expirées)",
)
check(resultat["offres_actives"] == 274, "comptage réel des offres actives remonté")
check(resultat["statut"] == "ok", "résultat final cohérent avec les lignes du mock")

echecs = [libelle for ok, libelle in CHECKS if not ok]
print()
print(f"RESULTAT : {len(CHECKS) - len(echecs)}/{len(CHECKS)} verifications OK")
if echecs:
    for libelle in echecs:
        print(f"  ECHEC : {libelle}")
    raise SystemExit(1)
