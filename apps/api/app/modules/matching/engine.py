"""Moteur de matching — règle PURE, sans I/O, testable unitairement.

Règle (v1) — Bourses 100% :
  un match existe si :
    1. profil.actif ET offre.active
    2. offre non expirée (date_limite >= aujourd'hui)
    3. offre.type_offre = BOURSE (unique)
    4. filière : profil.filiere ∈ offre.filieres_cibles
       OU profil.filieres_interet ∩ offre.filieres_cibles ≠ ∅
    5. pays : pays_etudes_offre ∈ profil.pays_favoris (si défini, sauf AUTRE)

Barème v2 (20/10/2026) — audit mesuré par `scripts/test-matching.py` :
  - score NORMALISÉ : 100 × Σ(poids × satisfaction) / Σ(poids applicables) ;
    la somme brute des poids vaut 100, aucun plafond n'écrase plus l'ordre ;
  - un critère dont la donnée manque est retiré du dénominateur (jamais 0) ;
  - fraîcheur et urgence deviennent des décroissances linéaires continues ;
  - `pays_favoris` n'est plus un bonus mais reste un FILTRE (pas de double
    comptage d'un champ rempli à 47 %) ;
  - le critère VILLE ne s'applique plus aux bourses (la ville de l'offre y est
    la destination d'études, pas le domicile du candidat) ;
  - départage déterministe : score, puis échéance, puis identifiant ;
  - « bourse générique » détectée par couverture relative ≥ 80 % des filières.

Préférences avancées P7 (profils.metadata['prefs_avancees']) :
  - pays_favoris      : aucune offre hors de ces pays n'est matchée (sauf AUTRE)
  - financement_min   : financement offre doit être >= minimum
  - seuil_pertinence  : score minimal personnel (>= SCORE_MIN_PERTINENCE)
  Prefs absentes = comportement inchangé.

Lot D (bourses 100 %) : les scrapers de bourses remplissent toutes les
filières par défaut → « bourses génériques » qui matchent tout le monde et
saturent l'étudiant. Le moteur les traite à part :
  - satisfaction filière réduite (SATISFACTION_FILIERE_GENERIQUE au lieu du
    plein crédit) → elles rankent APRÈS les bourses réellement ciblées ;
  - quota par profil (MAX_BOURSES_GENERIQUES_PAR_PROFIL, cumulé sur les
    matches déjà en base) → jamais plus de N bourses toutes-filières.
"""
import hashlib
import logging
from collections import Counter
from datetime import date, timedelta

from apps.api.app.core.database import supabase
from apps.api.app.modules.shared.models import (
    Filiere,
    PaysEtudes,
    TypeFinancement,
    TypeOffre,
    Ville,
)

logger = logging.getLogger(__name__)

# ---------- Barème v2 : normalisé, sans saturation ----------
# Chaque critère pèse un POIDS ; sa satisfaction vaut de 0 à 1 ; le score final
# est `100 × Σ(poids × satisfaction) / Σ(poids applicables)`. Un critère dont la
# donnée manque n'est PAS applicable : il ne favorise ni ne pénalise (barème v1 :
# somme brute 120 > 100 → saturation à 100, deux offres très différentes
# obtenaient le même score).
POIDS_FILIERE = 45
POIDS_FINANCEMENT = 15
POIDS_FRAICHEUR = 15
POIDS_URGENCE = 15
# Le lieu (`ville`) ne décrit un candidat que pour un stage/emploi : pour une
# bourse, la ville de l'offre est la DESTINATION d'études (scrapers : 100 %
# `nouakchott`), donc le critère n'est pas applicable.
POIDS_LOCALISATION = 10

FRAICHEUR_JOURS = 30          # décroissance linéaire de la fraîcheur
URGENCE_JOUR_MIN = 3          # deadline ≤ 3 j = urgence maximale
URGENCE_JOUR_MAX = 30         # deadline ≥ 30 j = aucune urgence
SEUIL_COUVERTURE_GENERIQUE = 0.8  # bourse « toutes filières » = ≥ 80 % des filières

# ---------- Lot D : bourses génériques (toutes filières) ----------
MAX_MATCHES_PAR_SEMAINE = 5
SCORE_MIN_PERTINENCE = 30
MAX_BOURSES_GENERIQUES_PAR_PROFIL = 3
SATISFACTION_FILIERE_GENERIQUE = 0.35


def est_bourse_generique(type_offre: str | None, filieres_cibles: list[str] | None) -> bool:
    """Vrai si l'offre est une bourse « toutes filières » (Lot D).

    Détection par COUVERTURE RELATIVE (≥ 80 % des filières possibles), jamais
    par égalité stricte avec la taille de l'enum : celui-ci a grandi de 12 à 35
    valeurs et l'ancien seuil `len(filieres) >= len(Filiere)` ne se déclenchait
    plus du tout (mesuré le 20/10 : 0 générique détectée).

    Les scrapers de bourses remplissent toutes les filières par défaut
    (repli `_filieres()` de bourses.py) : ces offres matchent tous les
    profils et les saturent. Un stage/emploi n'est JAMAIS générique ici
    (l'ancien comportement est préservé pour tous les autres types).
    """
    if (type_offre or "") != TypeOffre.BOURSE.value:
        return False
    cibles = set(filieres_cibles or [])
    if not cibles:
        return False
    return len(cibles) >= SEUIL_COUVERTURE_GENERIQUE * len(Filiere)


def _ville_est_critere(type_offre: str | None) -> bool:
    """Le lieu de l'offre décrit-il le candidat ?

    Oui pour un stage/emploi/alternance (on travaille là où l'on postule).
    NON pour une bourse : la `ville` de l'offre est la destination d'études
    (les scrapers écrivent `nouakchott` pour 100 % des bourses), donc la
    comparer au domicile du candidat élimine tout étudiant hors de Nouakchott.
    """
    return (type_offre or "") in {
        "stage_pfe",
        "stage_ete",
        "emploi_junior",
        "alternance",
    }


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
    pays_etudes_offre: str | None = None,
    pays_favoris_profil: list[str] | None = None,
    type_financement_offre: str | None = None,
    financement_min_profil: str | None = None,
    aujourdhui: date | None = None,
) -> tuple[bool, str]:
    """Retourne (match?, raison) — raison utile pour le debug/dashboard.

    Nouvelles règles (P7) :
    - Si le profil a des pays_favoris définis et l'offre a un pays_etudes,
      le pays de l'offre doit être dans les favoris (sauf si offre = AUTRE).
    - Si le profil a un financement_min défini, le financement de l'offre
      doit être >= au niveau minimum (ordre : fully_funded > partiel > auto_finance > inconnu).
    """
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

    # Ville — uniquement si le lieu décrit le candidat (stage/emploi).
    # Pour une bourse, `ville_offre` = destination d'études : ce n'est pas un
    # critère d'éligibilité (défaut mesuré le 20/10/2026 : 260/260 bourses en
    # `nouakchott` éliminaient tout étudiant de Nouadhibou/Kaédi/Rosso/Aleg).
    if _ville_est_critere(type_offre) and (
        ville_profil != ville_offre
        and ville_profil != Ville.AUTRE.value
        and ville_offre != Ville.AUTRE.value
    ):
        return False, "ville_non_matchee"

    # Pays d'études (nouveau P7)
    if pays_favoris_profil and pays_etudes_offre:
        if (
            pays_etudes_offre != PaysEtudes.AUTRE.value
            and pays_etudes_offre not in pays_favoris_profil
        ):
            return False, "pays_non_favori"

    # Financement minimum (P7) — un financement INCONNU n'est pas un financement
    # insuffisant : il n'est pas jugeable. Le traiter comme le niveau le plus bas
    # écartait 162/260 bourses (62,3 %) dès qu'un étudiant demandait « partiel »,
    # sans qu'aucune ne soit réellement sous le seuil (défaut relevé le 20/10).
    if (
        financement_min_profil
        and type_financement_offre
        and type_financement_offre != TypeFinancement.INCONNU.value
    ):
        ordre_financement = {
            TypeFinancement.FULLY_FUNDED.value: 4,
            TypeFinancement.PARTIEL.value: 3,
            TypeFinancement.AUTO_FINANCE.value: 2,
            TypeFinancement.INCONNU.value: 1,
        }
        niveau_offre = ordre_financement.get(type_financement_offre, 1)
        niveau_min = ordre_financement.get(financement_min_profil, 1)
        if niveau_offre < niveau_min:
            return False, "financement_insuffisant"

    return True, "match"


def _satisfaction_filiere(
    filiere_profil: str,
    filieres_interet: list[str],
    filieres_cibles: list[str],
    bourse_generique: bool,
) -> float:
    """Satisfaction du critère filière (0 → 1)."""
    if bourse_generique:
        return SATISFACTION_FILIERE_GENERIQUE
    cibles = set(filieres_cibles)
    if filiere_profil in cibles:
        return 1.0
    if cibles & set(filieres_interet):
        return 0.6
    return 0.0


def _satisfaction_financement(type_financement: str | None) -> float | None:
    """Satisfaction du critère financement, ou None si la donnée manque.

    `inconnu` = donnée absente : critère NON applicable (jamais 0, sinon on
    pénalise une information que le scraper n'a pas su extraire).
    """
    if not type_financement or type_financement == TypeFinancement.INCONNU.value:
        return None
    return {
        TypeFinancement.FULLY_FUNDED.value: 1.0,
        TypeFinancement.PARTIEL.value: 0.6,
        TypeFinancement.AUTO_FINANCE.value: 0.2,
    }.get(type_financement)


def _satisfaction_fraicheur(date_scrape: date, aujourdhui: date) -> float:
    """Fraîcheur linéaire : 1 le jour du scrape, 0 au-delà de FRAICHEUR_JOURS."""
    jours = (aujourdhui - date_scrape).days
    if jours <= 0:
        return 1.0
    return max(0.0, 1.0 - jours / FRAICHEUR_JOURS)


def _satisfaction_urgence(date_limite: date, aujourdhui: date) -> float:
    """Urgence linéaire : 1 à URGENCE_JOUR_MIN, 0 à URGENCE_JOUR_MAX.

    Décroissance continue (l'ancien barème ajoutait un bloc de 10 points d'un
    coup à J-14 : deux offres à J-13 et J-15 étaient arbitrées par un saut).
    """
    jours = (date_limite - aujourdhui).days
    if jours <= URGENCE_JOUR_MIN:
        return 1.0
    if jours >= URGENCE_JOUR_MAX:
        return 0.0
    return 1.0 - (jours - URGENCE_JOUR_MIN) / (URGENCE_JOUR_MAX - URGENCE_JOUR_MIN)


def _satisfaction_localisation(
    ville_profil: str, ville_offre: str, type_offre: str | None
) -> float | None:
    """Localisation : None pour une bourse (le lieu n'y décrit pas le candidat)."""
    if not _ville_est_critere(type_offre):
        return None
    if ville_profil == ville_offre:
        return 1.0
    if ville_profil == Ville.AUTRE.value or ville_offre == Ville.AUTRE.value:
        return 0.5
    return 0.0


def calculer_score_pertinence(
    *,
    filiere_profil: str,
    filieres_interet: list[str],
    filieres_cibles: list[str],
    ville_profil: str,
    ville_offre: str,
    date_scrape: date,
    date_limite: date,
    bourse_generique: bool = False,
    pays_etudes_offre: str | None = None,
    pays_favoris_profil: list[str] | None = None,
    type_financement_offre: str | None = None,
    financement_min_profil: str | None = None,
    type_offre: str | None = None,
    aujourdhui: date | None = None,
) -> int:
    """Score de pertinence 0-100, NORMALISÉ (barème v2).

    `score = 100 × Σ(poids × satisfaction) / Σ(poids applicables)`

    - filière      45 : exacte 1.0 · intérêt 0.6 · bourse générique 0.35
    - financement  15 : fully 1.0 · partiel 0.6 · auto 0.2 (absent = ignoré)
    - fraîcheur    15 : linéaire sur FRAICHEUR_JOURS
    - urgence      15 : linéaire de URGENCE_JOUR_MAX à URGENCE_JOUR_MIN
    - localisation 10 : uniquement hors bourse (lieu réel du poste)

    Un critère dont la donnée manque est retiré du dénominateur : il ne
    favorise ni ne pénalise. La somme des poids vaut 100, mais le score est
    normalisé par les seuls critères applicables → il ne peut pas saturer
    artificiellement (barème v1 : somme brute 120, plafonnée à 100).

    `pays_favoris` n'est plus un bonus : c'est un FILTRE (match_regles). Le
    compter deux fois avantageait la moitié du catalogue où `pays_etudes` est
    renseigné (53 % de valeurs absentes mesurées le 20/10).
    """
    aujourdhui = aujourdhui or date.today()

    criteres: list[tuple[int, float]] = [
        (
            POIDS_FILIERE,
            _satisfaction_filiere(
                filiere_profil, filieres_interet, filieres_cibles, bourse_generique
            ),
        ),
        (POIDS_FRAICHEUR, _satisfaction_fraicheur(date_scrape, aujourdhui)),
        (POIDS_URGENCE, _satisfaction_urgence(date_limite, aujourdhui)),
    ]

    satisfaction_financement = _satisfaction_financement(type_financement_offre)
    if satisfaction_financement is not None:
        criteres.append((POIDS_FINANCEMENT, satisfaction_financement))

    satisfaction_localisation = _satisfaction_localisation(
        ville_profil, ville_offre, type_offre
    )
    if satisfaction_localisation is not None:
        criteres.append((POIDS_LOCALISATION, satisfaction_localisation))

    poids_total = sum(poids for poids, _ in criteres)
    if not poids_total:
        return 0
    gagne = sum(poids * satisfaction for poids, satisfaction in criteres)
    return max(0, min(100, round(100 * gagne / poids_total)))


def compute_content_hash(titre: str, entreprise: str, date_limite: date) -> str:
    """Hash MD5 de l'offre pour deduplication."""
    raw = (titre + entreprise + date_limite.isoformat()).encode()
    return hashlib.md5(raw).hexdigest()


def prefs_avancees(metadata) -> dict:
    """Préférences avancées d'un profil (profils.metadata['prefs_avancees']).

    Absentes ou mal formées = dict vide = comportement inchangé (règle D8/P5).
    """
    if isinstance(metadata, dict):
        prefs = metadata.get("prefs_avancees")
        if isinstance(prefs, dict):
            return prefs
    return {}


def _dedup_offres(offres: list[dict]) -> list[dict]:
    """Deduplique les offres par content_hash, garde la plus recente."""
    vues: dict[str, dict] = {}
    for o in offres:
        raw_titre = o.get("titre", "")
        raw_entreprise = o.get("entreprise", "")
        raw_date_limite = o.get("date_limite", "")
        try:
            dl = date.fromisoformat(raw_date_limite)
        except (TypeError, ValueError):
            dl = date.today()
        h = compute_content_hash(raw_titre, raw_entreprise, dl)
        # Stocker le hash dans metadata
        metadata = dict(o.get("metadata", {}))
        metadata["content_hash"] = h
        o_copy = dict(o)
        o_copy["metadata"] = metadata
        # Garder la plus recente (date_scrape la plus recente)
        if h not in vues:
            vues[h] = o_copy
        else:
            try:
                existing_scrape = date.fromisoformat(vues[h].get("date_scrape", ""))
            except (TypeError, ValueError):
                existing_scrape = date.min
            try:
                current_scrape = date.fromisoformat(o_copy.get("date_scrape", ""))
            except (TypeError, ValueError):
                current_scrape = date.min
            if current_scrape > existing_scrape:
                vues[h] = o_copy
    return list(vues.values())


def selectionner_candidats(
    candidats: list[dict],
    *,
    deja_semaine: int,
    deja_generiques: int,
) -> tuple[list[dict], int, int]:
    """Sélectionne les matches à créer pour UN profil (règle pure, sans I/O).

    Tri par score décroissant, anti-spam hebdomadaire (MAX_MATCHES_PAR_SEMAINE)
    puis quota de bourses génériques cumulé sur la base (Lot D). Les bourses
    ciblées, mieux notées, consomment les places en premier ; les génériques
    (toutes filières) ne dépassent jamais MAX_BOURSES_GENERIQUES_PAR_PROFIL.

    Retourne (retenus, ignores_spam, ignores_generiques).

    Départage DÉTERMINISTE (barème v2) : score décroissant, puis échéance la
    plus proche, puis identifiant d'offre. Sans lui, deux offres à score égal
    sortaient dans l'ordre d'itération de la base (résultat non reproductible).
    """
    triés = sorted(
        candidats,
        key=lambda x: (
            -x["score"],
            x.get("_date_limite") or "9999-12-31",
            str(x.get("offre_id", "")),
        ),
    )
    retenus: list[dict] = []
    ignores_spam = ignores_generiques = 0
    generiques_ce_run = 0
    for c in triés:
        if deja_semaine + len(retenus) >= MAX_MATCHES_PAR_SEMAINE:
            ignores_spam += 1
            continue
        if c["metadata"].get("bourse_generique"):
            if deja_generiques + generiques_ce_run >= MAX_BOURSES_GENERIQUES_PAR_PROFIL:
                ignores_generiques += 1
                continue
            generiques_ce_run += 1
        retenus.append(c)
    return retenus, ignores_spam, ignores_generiques


def run_matching_job() -> dict:
    """Charge profils + offres, calcule les nouveaux matches, les insere."""
    # 1. Profils actifs
    profils_res = supabase.table("profils").select("*").eq("actif", True).execute()
    # 2. Offres actives non expirees
    offres_res = (
        supabase.table("offres")
        .select("*")
        .eq("active", True)
        .gte("date_limite", date.today().isoformat())
        .execute()
    )
    # 3. Deduplication
    offres_dedup = _dedup_offres(offres_res.data)

    # 4. Pairs deja matchees (eviter doublons) + bourses generiques deja
    #    matchees par profil (quota Lot D cumule sur la base existante)
    matches_res = (
        supabase.table("matches")
        .select("offre_id, profil_id, offre:offres(type_offre, filieres_cibles)")
        .execute()
    )
    deja_matchees = {(m["offre_id"], m["profil_id"]) for m in matches_res.data}
    deja_generiques: Counter = Counter()
    for m in matches_res.data:
        o = m.get("offre") or {}
        if est_bourse_generique(o.get("type_offre"), o.get("filieres_cibles")):
            deja_generiques[m["profil_id"]] += 1

    # 5. Matches cette semaine (anti-spam)
    semaine_derniere = (date.today() - timedelta(days=7)).isoformat()
    matches_semaine_res = (
        supabase.table("matches")
        .select("profil_id")
        .gte("date_match", semaine_derniere)
        .execute()
    )
    compte_semaine = Counter(m["profil_id"] for m in matches_semaine_res.data)

    # 6. Calcul
    nouveaux = []
    stats = {
        "examines": 0,
        "matches": 0,
        "ignores_deja": 0,
        "ignores_score_faible": 0,
        "ignores_spam": 0,
        "ignores_prefs": 0,
        "ignores_hors_active": 0,
        "ignores_generiques": 0,
    }
    for p in profils_res.data:
        # Préférences avancées du profil (P5 + P7) — dict vide si absentes
        prefs = prefs_avancees(p.get("metadata"))
        villes_exclues = set(prefs.get("villes_exclues") or [])
        types_masques = set(prefs.get("types_masques") or [])
        seuil_pertinence = prefs.get("seuil_pertinence")
        pays_favoris = set(prefs.get("pays_favoris") or [])
        financement_min = prefs.get("financement_min")
        candidats = []
        for o in offres_dedup:
            stats["examines"] += 1
            # P6-A : seules les offres validées matchent — les offres déposées
            # par les entreprises en pending_review sont écartées. Sans la
            # colonne (migration 003_p6.sql absente), `get` renvoie None et
            # le comportement reste inchangé (règle D8).
            statut = o.get("statut_publication")
            if statut is not None and statut != "active":
                stats["ignores_hors_active"] += 1
                continue
            if (o["id"], p["id"]) in deja_matchees:
                stats["ignores_deja"] += 1
                continue
            # Prefs : ville exclue (si et seulement si le lieu décrit le
            # candidat — jamais pour une bourse) ou type masqué
            if (
                _ville_est_critere(o.get("type_offre"))
                and o.get("ville") in villes_exclues
            ) or o.get("type_offre") in types_masques:
                stats["ignores_prefs"] += 1
                continue
            # Date par defaut si date_limite mal formee -> ne pas faire planter le job
            try:
                date_limite = date.fromisoformat(o["date_limite"])
            except (TypeError, ValueError) as e:
                logger.warning(
                    "Offre %s : date_limite illisible (%r) -> date par defaut (+30j) : %s",
                    o.get("id"),
                    o.get("date_limite"),
                    e,
                )
                date_limite = date.today() + timedelta(days=30)
            try:
                date_scrape = date.fromisoformat(o.get("date_scrape", ""))
            except (TypeError, ValueError):
                date_scrape = date.today()
            ok, raison = match_regles(
                profil_actif=p.get("actif", True),
                offre_active=o.get("active", True),
                date_limite=date_limite,
                type_offre=o["type_offre"],
                types_recherches=p.get("types_recherches", []),
                filiere_profil=p["filiere"],
                filieres_interet=p.get("filieres_interet", []),
                filieres_cibles=o.get("filieres_cibles", []),
                ville_profil=p["ville"],
                ville_offre=o["ville"],
                pays_etudes_offre=o.get("pays_etudes"),
                pays_favoris_profil=list(pays_favoris) if pays_favoris else None,
                type_financement_offre=o.get("type_financement"),
                financement_min_profil=financement_min,
            )
            if not ok:
                continue
            score = calculer_score_pertinence(
                filiere_profil=p["filiere"],
                filieres_interet=p.get("filieres_interet", []),
                filieres_cibles=o.get("filieres_cibles", []),
                ville_profil=p["ville"],
                ville_offre=o["ville"],
                date_scrape=date_scrape,
                date_limite=date_limite,
                bourse_generique=est_bourse_generique(
                    o.get("type_offre"), o.get("filieres_cibles")
                ),
                pays_etudes_offre=o.get("pays_etudes"),
                pays_favoris_profil=list(pays_favoris) if pays_favoris else None,
                type_financement_offre=o.get("type_financement"),
                financement_min_profil=financement_min,
                type_offre=o.get("type_offre"),
            )
            if score < SCORE_MIN_PERTINENCE:
                stats["ignores_score_faible"] += 1
                continue
            # Prefs : seuil de pertinence personnel (ne peut descendre sous le
            # seuil global SCORE_MIN_PERTINENCE — comportement inchangé sans prefs)
            if seuil_pertinence is not None and score < int(seuil_pertinence):
                stats["ignores_prefs"] += 1
                continue
            candidats.append(
                {
                    "offre_id": o["id"],
                    "profil_id": p["id"],
                    "score": score,
                    # Clé de tri interne (préfixe `_`) : retirée avant l'insert.
                    "_date_limite": date_limite.isoformat(),
                    "metadata": {
                        "regle": "v1",
                        "raison": raison,
                        "content_hash": o.get("metadata", {}).get("content_hash", ""),
                        # Lot D : trace pour l'UI/debug + quota du selectionneur
                        "bourse_generique": est_bourse_generique(
                            o.get("type_offre"), o.get("filieres_cibles")
                        ),
                    },
                }
            )
        # Tri + anti-spam + quota Lot D (bourses generiques) — regle partagee
        # avec le harnais de preuve (selectionner_candidats, pure sans I/O)
        retenus, spam, generiques = selectionner_candidats(
            candidats,
            deja_semaine=compte_semaine[p["id"]],
            deja_generiques=deja_generiques[p["id"]],
        )
        stats["ignores_spam"] += spam
        stats["ignores_generiques"] += generiques
        for c in retenus:
            # Les clés internes de tri (préfixe `_`) ne partent jamais en base.
            nouveaux.append({k: v for k, v in c.items() if not k.startswith("_")})
            compte_semaine[p["id"]] += 1

    # 7. Insertion
    if nouveaux:
        supabase.table("matches").insert(nouveaux).execute()
    stats["matches"] = len(nouveaux)
    return stats
