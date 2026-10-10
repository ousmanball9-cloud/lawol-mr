"""Moteur de matching — règle PURE, sans I/O, testable unitairement.

Règle (v1) :
  un match existe si :
    1. profil.actif ET offre.active
    2. offre non expirée (date_limite >= aujourd'hui)
    3. offre.type_offre ∈ profil.types_recherches
    4. filière : profil.filiere ∈ offre.filieres_cibles
       OU profil.filieres_interet ∩ offre.filieres_cibles ≠ ∅
    5. ville : même ville OU profil.ville = AUTRE OU offre.ville = AUTRE

Améliorations P3 :
  - Score de pertinence (0-100) au lieu de 100 hardcodé
  - Limite anti-spam : MAX_MATCHES_PAR_SEMAINE = 5
  - Déduplication par content_hash (titre + entreprise + date_limite)
  - Tri par score décroissant, ignores si score < 30

Préférences avancées P5 (profils.metadata['prefs_avancees']) :
  - villes_exclues    : aucune offre de ces villes n'est matchée
  - types_masques     : ces types d'offre sont sautés
  - seuil_pertinence  : score minimal personnel (>= SCORE_MIN_PERTINENCE)
  Prefs absentes = comportement v1 inchangé.
"""
import hashlib
import logging
from collections import Counter
from datetime import date, timedelta

from apps.api.app.core.database import supabase
from apps.api.app.modules.shared.models import Filiere, Ville

logger = logging.getLogger(__name__)

# ---------- Constantes P3 ----------
MAX_MATCHES_PAR_SEMAINE = 5
SCORE_MIN_PERTINENCE = 30
FRAICHEUR_JOURS = 7
DEADLINE_PROCHE_JOURS = 14


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


def calculer_score_pertinence(
    *,
    filiere_profil: str,
    filieres_interet: list[str],
    filieres_cibles: list[str],
    ville_profil: str,
    ville_offre: str,
    date_scrape: date,
    date_limite: date,
    aujourdhui: date | None = None,
) -> int:
    """Calcule le score de pertinence (0-100).

    - Filiere exacte : +50
    - Filiere d'interet : +30
    - Ville exacte : +20
    - Ville AUTRE (joker) : +10
    - Fraicheur (< 7 jours) : +10
    - Deadline proche (< 14 jours) : +10
    """
    aujourdhui = aujourdhui or date.today()
    score = 0
    cibles = set(filieres_cibles)

    # Filiere
    if filiere_profil in cibles:
        score += 50
    elif cibles & set(filieres_interet):
        score += 30

    # Ville
    if ville_profil == ville_offre:
        score += 20
    elif ville_profil == Ville.AUTRE.value or ville_offre == Ville.AUTRE.value:
        score += 10

    # Fraicheur
    if (aujourdhui - date_scrape).days < FRAICHEUR_JOURS:
        score += 10

    # Deadline proche
    if (date_limite - aujourdhui).days < DEADLINE_PROCHE_JOURS:
        score += 10

    return max(0, min(100, score))


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

    # 4. Pairs deja matchees (eviter doublons)
    matches_res = supabase.table("matches").select("offre_id, profil_id").execute()
    deja_matchees = {(m["offre_id"], m["profil_id"]) for m in matches_res.data}

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
    }
    for p in profils_res.data:
        # Préférences avancées du profil (P5) — dict vide si absentes
        prefs = prefs_avancees(p.get("metadata"))
        villes_exclues = set(prefs.get("villes_exclues") or [])
        types_masques = set(prefs.get("types_masques") or [])
        seuil_pertinence = prefs.get("seuil_pertinence")
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
            # Prefs : ville exclue ou type masqué -> aucun match créé
            if o.get("ville") in villes_exclues or o.get("type_offre") in types_masques:
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
                    "metadata": {
                        "regle": "v1",
                        "raison": raison,
                        "content_hash": o.get("metadata", {}).get("content_hash", ""),
                    },
                }
            )
        # Tri par score decroissant
        candidats.sort(key=lambda x: x["score"], reverse=True)
        # Anti-spam : garder les 5 meilleurs
        for c in candidats:
            if compte_semaine[p["id"]] >= MAX_MATCHES_PAR_SEMAINE:
                stats["ignores_spam"] += 1
                continue
            nouveaux.append(c)
            compte_semaine[p["id"]] += 1

    # 7. Insertion
    if nouveaux:
        supabase.table("matches").insert(nouveaux).execute()
    stats["matches"] = len(nouveaux)
    return stats
