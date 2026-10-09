"""Résumé hebdo du dashboard client (P5-A).

Tout se calcule à la volée : aucune migration, aucun stockage dérivé.

- extract_poste()      : regroupe les offres de l'année par famille de poste
                         (dict de mots-clés FR, insensible aux accents).
- calculer_score_profil(): % de complétion documenté (plafond 100).
- calculer_resume()    : compteurs de la semaine à partir des matches du profil.
- offres_par_poste()   : compteur « offres par poste cette année ».
"""
from __future__ import annotations

import unicodedata
from collections import Counter
from datetime import date, timedelta

from apps.api.app.modules.shared.models import PosteAnnee

# ---------- Extraction de poste (mots-clés FR → poste affiché) ----------
# Ordre = priorité de détection : le premier poste dont un mot-clé apparaît
# dans le titre (normalisé : minuscules, sans accent) gagne.
POSTES_MOTS_CLES: list[tuple[str, list[str]]] = [
    ("Développeur", ["developpeur", "developer", "programmeur", "fullstack",
                     "full stack", "frontend", "backend", "dev "]),
    ("Comptable", ["comptable", "comptabilite", "accountant", "auditeur", "audit"]),
    ("Ingénieur", ["ingenieur", "engineer", "genie "]),
    ("Technicien", ["technicien", "technician", "maintenance"]),
    ("Commercial", ["commercial", "vendeur", "vente", "sales", "charge d'affaires"]),
    ("Data/Analyste", ["data", "analyste", "analyst", "statistic", "bi "]),
    ("Marketing", ["marketing", "communication", "community manager", "growth"]),
    ("Juriste", ["juriste", "juridique", "avocat", "lawyer", "legal"]),
    ("Médecin", ["medecin", "docteur", "doctor", "infirmier", "pharmacien", "sante",
                 "health"]),
    ("Enseignant", ["enseignant", "professeur", "formateur", "teacher", "moniteur"]),
    ("Assistant", ["assistant", "secretaire", "adjoint", "secretary"]),
    ("Électricien", ["electricien", "electrician", "electromecanicien"]),
    ("Mécanicien", ["mecanicien", "mechanic", "mecanique"]),
    ("Consultant", ["consultant", "conseiller", "conseil", "advisor"]),
]


def _norm(texte: str) -> str:
    """Minuscules + suppression des accents (« Développeur » == "developpeur")."""
    return (
        unicodedata.normalize("NFKD", texte or "")
        .encode("ascii", "ignore")
        .decode()
        .lower()
    )


def extract_poste(titre: str) -> str:
    """Retourne la famille de poste d'un titre d'offre, sinon « Autre »."""
    t = _norm(titre)
    if not t.strip():
        return "Autre"
    for poste, motscles in POSTES_MOTS_CLES:
        for mot in motscles:
            if mot in t:
                return poste
    return "Autre"


# ---------- Score de complétion du profil ----------
def calculer_score_profil(profil: dict) -> int:
    """% de complétion simple et documenté (plafond 100) :
    email +20, filieres_interet non vide +20, types_recherches > 1 +20,
    optin (texte ou date) +20, universite/niveau/ville toujours remplis +20.
    """
    score = 0
    if profil.get("email"):
        score += 20
    if profil.get("filieres_interet"):
        score += 20
    if len(profil.get("types_recherches") or []) > 1:
        score += 20
    if profil.get("optin_texte") or profil.get("optin_at"):
        score += 20
    if profil.get("universite") and profil.get("niveau") and profil.get("ville"):
        score += 20
    return min(100, score)


# ---------- Résumé hebdo ----------
def _date_iso(valeur) -> date | None:
    try:
        return date.fromisoformat(str(valeur))
    except (TypeError, ValueError):
        return None


STATUTS_TERMINES = ("accepte", "refuse")


def calculer_resume(rows: list[dict], *, today: date | None = None) -> dict:
    """Compteurs du dashboard à partir des matches enrichis du profil.

    - offres_dispo  : match non postulé + offre active + date_limite >= aujourd'hui
    - nouvelles_7j  : date_match >= aujourd'hui - 7 jours
    - postules_total: match avec postule = true
    - en_cours      : statut_candidature renseigné et non terminé
                      (ni accepte, ni refuse)
    Sans colonne favori/statut_candidature (règle D8) : en_cours = 0.
    """
    today = today or date.today()
    semaine = today - timedelta(days=7)

    offres_dispo = nouvelles_7j = postules_total = en_cours = 0
    for m in rows:
        postule = bool(m.get("postule", False))
        offre = m.get("offre") or {}

        if not postule and offre.get("active", True):
            dl = _date_iso(offre.get("date_limite"))
            if dl and dl >= today:
                offres_dispo += 1

        dm = _date_iso(m.get("date_match"))
        if dm and dm >= semaine:
            nouvelles_7j += 1

        if postule:
            postules_total += 1

        statut = m.get("statut_candidature")
        if statut and statut not in STATUTS_TERMINES:
            en_cours += 1

    return {
        "offres_dispo": offres_dispo,
        "nouvelles_7j": nouvelles_7j,
        "postules_total": postules_total,
        "en_cours": en_cours,
    }


# ---------- Offres par poste (année en cours) ----------
def offres_par_poste(profil: dict, *, today: date | None = None) -> list[PosteAnnee]:
    """Offres éligibles créées depuis le 1er janvier de l'année en cours,
    filtrées sur filière principale + filieres_interet + types_recherches
    du profil, regroupées par famille de poste (calcul en Python, zéro migration).
    """
    from apps.api.app.core.database import supabase

    today = today or date.today()
    res = (
        supabase.table("offres")
        .select("titre, filieres_cibles, type_offre")
        .eq("active", True)
        .gte("date_limite", today.isoformat())
        .gte("created_at", f"{today.year}-01-01")
        .execute()
    )

    filiere = profil.get("filiere")
    interet = set(profil.get("filieres_interet") or [])
    types = set(profil.get("types_recherches") or [])

    compte: Counter[str] = Counter()
    for o in res.data:
        cibles = set(o.get("filieres_cibles") or [])
        if not (filiere in cibles or (cibles & interet)):
            continue
        if o.get("type_offre") not in types:
            continue
        compte[extract_poste(o.get("titre", ""))] += 1

    return [
        PosteAnnee(poste=poste, count=count)
        for poste, count in sorted(compte.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
