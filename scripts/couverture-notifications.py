#!/usr/bin/env python3
"""Couverture des notifications LAWOL - on mesure, on n'estime pas.

Contrat : docs/prototypage-promesse.md (plan P1 - Boucle de promesse).

Usage :
    python scripts/couverture-notifications.py --self-test      # harnais, zero reseau
    python scripts/couverture-notifications.py                  # Supabase, mesure reelle

Sortie : compteurs reels sur les profils et les matches en attente, distribution
des scores de matching, presence des variables d'environnement (noms seulement).
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

VARS_SMTP = ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM")
VARS_META = ("META_WHATSAPP_TOKEN", "META_PHONE_NUMBER_ID")

# ---------------------------------------------------------------------------
# Faux Supabase (self-test, zero reseau)
# ---------------------------------------------------------------------------


class _Resultat:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _FauxTable:
    def __init__(self, base, nom):
        self._base = base
        self._nom = nom
        self._filtres = []
        self._mode = "select"

    def select(self, colonnes="*", **kwargs):
        self._mode = "select"
        return self

    def eq(self, colonne, valeur):
        self._filtres.append((colonne, valeur))
        return self

    def not_(self, colonne):
        # not_.is_("profil.email", "null") -> filtre email is not null
        self._filtres.append((colonne, "IS_NOT_NULL"))
        return self

    def is_(self, colonne, valeur):
        if valeur == "null":
            self._filtres.append((colonne, "IS_NULL"))
        return self

    def limit(self, n):
        return self

    def execute(self):
        lignes = [
            ligne
            for ligne in self._base.tables.setdefault(self._nom, [])
            if all(ligne.get(c) == v for c, v in self._filtres if v != "IS_NOT_NULL")
            and all(ligne.get(c) is not None for c, v in self._filtres if v == "IS_NOT_NULL")
        ]
        return _Resultat(lignes)


class _FauxSupabase:
    def __init__(self):
        self.tables = {}

    def table(self, nom):
        return _FauxTable(self, nom)


# ---------------------------------------------------------------------------
# Sources de donnees
# ---------------------------------------------------------------------------


def charger_supabase() -> tuple[list[dict], list[dict]]:
    """Lit les profils et les matches depuis Supabase (reel)."""
    from apps.api.app.core.database import supabase

    profils = (
        supabase.table("profils")
        .select("id, telephone, email, actif, metadata")
        .execute()
        .data
        or []
    )
    matches = (
        supabase.table("matches")
        .select("id, score, notifie, profil_id")
        .execute()
        .data
        or []
    )
    return profils, matches


def charger_faux() -> tuple[list[dict], list[dict]]:
    """Jeu de donnees factice pour le self-test (zero reseau)."""
    FAUX = _FauxSupabase()
    FAUX.tables["profils"] = [
        {
            "id": "p-actif-optin-email",
            "telephone": "+22200000001",
            "email": "etudiant1@example.com",
            "actif": True,
            "metadata": {"optin_at": "2026-10-01T00:00:00+00:00"},
        },
        {
            "id": "p-actif-optin-sans-email",
            "telephone": "+22200000002",
            "email": None,
            "actif": True,
            "metadata": {"optin_at": "2026-10-01T00:00:00+00:00"},
        },
        {
            "id": "p-actif-sans-optin-email",
            "telephone": "+22200000003",
            "email": "etudiant3@example.com",
            "actif": True,
            "metadata": {},
        },
        {
            "id": "p-inactif-optin-email",
            "telephone": "+22200000004",
            "email": "etudiant4@example.com",
            "actif": False,
            "metadata": {"optin_at": "2026-10-01T00:00:00+00:00"},
        },
        {
            "id": "p-actif-optin-email-invalide",
            "telephone": "+22200000005",
            "email": "pas-un-email",
            "actif": True,
            "metadata": {"optin_at": "2026-10-01T00:00:00+00:00"},
        },
    ]
    FAUX.tables["matches"] = [
        {"id": "m1", "score": 92, "notifie": False, "profil_id": "p-actif-optin-email"},
        {"id": "m2", "score": 78, "notifie": False, "profil_id": "p-actif-optin-email"},
        {"id": "m3", "score": 45, "notifie": False, "profil_id": "p-actif-optin-sans-email"},
        {"id": "m4", "score": 88, "notifie": True, "profil_id": "p-actif-optin-email"},
        {"id": "m5", "score": 33, "notifie": False, "profil_id": "p-inactif-optin-email"},
    ]
    return FAUX.tables["profils"], FAUX.tables["matches"]


# ---------------------------------------------------------------------------
# Analyse
# ---------------------------------------------------------------------------


def _email_valide(adresse: str | None) -> bool:
    if not adresse:
        return False
    import re

    return bool(re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", str(adresse).strip()))


def _optin_present(profil: dict) -> bool:
    meta = profil.get("metadata") or {}
    return bool(meta.get("optin_at"))


def analyser(profils: list[dict], matches: list[dict]) -> dict:
    """Calcule tous les compteurs P1."""
    profils_actifs = [p for p in profils if p.get("actif")]
    profils_optin = [p for p in profils_actifs if _optin_present(p)]
    profils_optin_email = [p for p in profils_optin if _email_valide(p.get("email"))]

    matches_en_attente = [m for m in matches if not m.get("notifie")]
    matches_en_attente_actifs = [
        m for m in matches_en_attente if any(p["id"] == m["profil_id"] and p.get("actif") for p in profils)
    ]

    scores = [m.get("score") for m in matches_en_attente if m.get("score") is not None]
    score_min = min(scores) if scores else None
    score_max = max(scores) if scores else None
    score_moyen = round(sum(scores) / len(scores), 1) if scores else None

    vars_smtp_presentes = [v for v in VARS_SMTP if os.getenv(v)]
    vars_meta_presentes = [v for v in VARS_META if os.getenv(v)]

    return {
        "date_mesure": datetime.now(timezone.utc).isoformat(),
        "profils": {
            "total": len(profils),
            "actifs": len(profils_actifs),
            "avec_optin": len(profils_optin),
            "avec_optin_et_email_valide": len(profils_optin_email),
        },
        "matches": {
            "total": len(matches),
            "non_notifies": len(matches_en_attente),
            "non_notifies_actifs": len(matches_en_attente_actifs),
            "deja_notifies": len(matches) - len(matches_en_attente),
        },
        "pertinence_proxy": {
            "score_min": score_min,
            "score_max": score_max,
            "score_moyen": score_moyen,
            "nb_scores": len(scores),
        },
        "variables_env": {
            "smtp_presentes": vars_smtp_presentes,
            "meta_presentes": vars_meta_presentes,
        },
    }


def afficher(resultat: dict) -> None:
    p = resultat["profils"]
    m = resultat["matches"]
    r = resultat["pertinence_proxy"]
    v = resultat["variables_env"]

    print(f"Date de mesure : {resultat['date_mesure']}")
    print()
    print("=== PROFILS ===")
    print(f"  Total              : {p['total']}")
    print(f"  Actifs             : {p['actifs']}")
    print(f"  Avec opt-in        : {p['avec_optin']}")
    print(f"  Opt-in + email OK  : {p['avec_optin_et_email_valide']}")
    print()
    print("=== MATCHES ===")
    print(f"  Total              : {m['total']}")
    print(f"  Non notifies       : {m['non_notifies']}")
    print(f"  Non notifies actif : {m['non_notifies_actifs']}")
    print(f"  Deja notifies      : {m['deja_notifies']}")
    print()
    print("=== PERTINENCE (proxy scores des matches non notifies) ===")
    print(f"  Score min          : {r['score_min']}")
    print(f"  Score max          : {r['score_max']}")
    print(f"  Score moyen        : {r['score_moyen']}")
    print(f"  Nb scores          : {r['nb_scores']}")
    print()
    print("=== VARIABLES D'ENVIRONNEMENT (noms seulement) ===")
    print(f"  SMTP presentes     : {', '.join(v['smtp_presentes']) or 'aucune'}")
    print(f"  Meta presentes     : {', '.join(v['meta_presentes']) or 'aucune'}")
    print()


# ---------------------------------------------------------------------------
# Self-test (zero reseau) avec controles negatifs
# ---------------------------------------------------------------------------


def self_test() -> int:
    """Assertions exactes sur un jeu construit a la main. Zero reseau."""
    profils, matches = charger_faux()
    resultat = analyser(profils, matches)

    echecs: list[str] = []

    # Attendus sur le jeu factice (5 profils, 5 matches)
    # Profils actifs avec optin : p-actif-optin-email, p-actif-optin-sans-email,
    # p-actif-optin-email-invalide = 3 (p-actif-sans-optin-email n'a pas d'optin)
    # Profils actifs avec optin + email valide : seul p-actif-optin-email = 1
    # Scores des matches non notifies : 92, 78, 45, 33 -> moyenne = 62.0
    checks = [
        ("profils.total == 5", resultat["profils"]["total"] == 5),
        ("profils.actifs == 4", resultat["profils"]["actifs"] == 4),
        ("profils.avec_optin == 3", resultat["profils"]["avec_optin"] == 3),
        ("profils.avec_optin_et_email_valide == 1", resultat["profils"]["avec_optin_et_email_valide"] == 1),
        ("matches.total == 5", resultat["matches"]["total"] == 5),
        ("matches.non_notifies == 4", resultat["matches"]["non_notifies"] == 4),
        ("matches.non_notifies_actifs == 3", resultat["matches"]["non_notifies_actifs"] == 3),
        ("matches.deja_notifies == 1", resultat["matches"]["deja_notifies"] == 1),
        ("pertinence.score_min == 33", resultat["pertinence_proxy"]["score_min"] == 33),
        ("pertinence.score_max == 92", resultat["pertinence_proxy"]["score_max"] == 92),
        ("pertinence.score_moyen == 62.0", resultat["pertinence_proxy"]["score_moyen"] == 62.0),
    ]

    for libelle, ok in checks:
        print(f"  [{'OK' if ok else 'KO'}] {libelle}")
        if not ok:
            echecs.append(libelle)

    # --- Controles negatifs : chaque piege doit faire tomber le harnais ---
    # Un piege est une anomalie dans les DONNEES d'entree. L'analyseur CORRECT
    # doit l'ignorer. Si un analyseur bugue compte l'anomalie, le compteur
    # correspondant sera faux -> le harnais tombe.
    pieges = [
        (
            "actif=false compte comme actif (inverse)",
            resultat["profils"]["actifs"] != 4,  # un analyseur bugue dirait 5
        ),
        (
            "email invalide compte comme valide",
            resultat["profils"]["avec_optin_et_email_valide"] != 1,  # un analyseur bugue dirait 2
        ),
        (
            "match deja notifie compte comme non notifie",
            resultat["matches"]["non_notifies"] != 4,  # un analyseur bugue dirait 5
        ),
    ]

    print()
    print("=== CONTROLES NEGATIFS (chaque piege doit echouer) ===")
    for libelle, declenche in pieges:
        # declenche = True signifie que le piege a reussi a tromper l'analyseur
        print(f"  [{'KO (piege passe)' if declenche else 'OK (piege bloque)'}] {libelle}")
        if declenche:
            echecs.append(f"piege : {libelle}")

    afficher(resultat)
    print()
    if echecs:
        print(f"ECHEC : {len(echecs)} assertion(s) KO")
        for e in echecs:
            print(f"  - {e}")
        return 1
    print("SELF-TEST VERT : tous les compteurs sont justes, tous les pieges sont bloques.")
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Couverture des notifications LAWOL (P1)")
    parser.add_argument("--self-test", action="store_true", help="harnais hors ligne (zero reseau)")
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()

    profils, matches = charger_supabase()
    resultat = analyser(profils, matches)
    afficher(resultat)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
