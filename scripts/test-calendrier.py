#!/usr/bin/env python3
"""Harnais hors ligne du lot V4-G — `metadata.calendrier` / `metadata.dates_par_pays`.

Contrat : docs/contrat-metadata-offres.md §2.3 / §2.4.
Aucun reseau, aucun Supabase : seules les fonctions pures sont exercees.

Regle du harnais : il verifie l'INVARIANT (une date doit venir d'un texte
source, deux etapes minimum, aucun doublon, ordre chronologique), jamais la
forme litterale d'un fichier.

Sortie : une ligne par controle, `RESULTAT : X/Y` et code 0 seulement si tout
passe. Un seul KO = code 1 (le harnais doit savoir afficher son verdict, leçon
AGENTS.md du 12/11/2026).
"""

from __future__ import annotations

import importlib.util
import sys
from datetime import date
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.api.app.modules.matching.extraction import (
    _dates_du_texte,
    calendrier_depuis_texte,
    calendrier_stocke,
    dates_par_pays_depuis_texte,
    dates_par_pays_stocke,
)


def _charger_backfill():
    chemin = ROOT / "scripts" / "backfill-calendrier.py"
    spec = importlib.util.spec_from_file_location("backfill_calendrier", chemin)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


backfill = _charger_backfill()

resultats: list[tuple[str, bool, str]] = []


def verifier(nom: str, condition: bool, detail: str = "") -> None:
    resultats.append((nom, bool(condition), detail))


def egal(nom: str, obtenu, attendu) -> None:
    verifier(nom, obtenu == attendu, f"obtenu={obtenu!r} attendu={attendu!r}")


# ---------------------------------------------------------------- extraction
# POSITIF : deux etapes datees, en anglais.
egal(
    "EN 2 etapes datees -> calendrier",
    calendrier_depuis_texte(
        "Application deadline: 15 January 2027. Results will be announced: 30 April 2027."
    ),
    [
        {"etape": "candidature", "date": "2027-01-15"},
        {"etape": "resultat", "date": "2027-04-30"},
    ],
)

# POSITIF : trois etapes, en francais.
egal(
    "FR 3 etapes datees -> calendrier",
    calendrier_depuis_texte(
        "Date limite de candidature : 15 janvier 2027. "
        "Preselection : 20 fevrier 2027. Resultats annonces : 30 avril 2027."
    ),
    [
        {"etape": "candidature", "date": "2027-01-15"},
        {"etape": "preselection", "date": "2027-02-20"},
        {"etape": "resultat", "date": "2027-04-30"},
    ],
)

# POSITIF : dates ISO, dont le mois de MAI (regression du 17/11/2026).
egal(
    "ISO mai -> date lue (regression mois 5)",
    [valeur for _, _, valeur in _dates_du_texte("Deadline 2027-05-03, results 2027-06-10.")],
    ["2027-05-03", "2027-06-10"],
)
egal(
    "ISO mai -> calendrier complet",
    calendrier_depuis_texte("Deadline 2027-05-03. Results announced 2027-06-10."),
    [
        {"etape": "candidature", "date": "2027-05-03"},
        {"etape": "resultat", "date": "2027-06-10"},
    ],
)

# POSITIF : dates par pays, deux echeances DISTINCTES.
egal(
    "2 pays, 2 dates distinctes -> dates_par_pays",
    dates_par_pays_depuis_texte(
        "Deadline for France: 10 February 2027. Deadline for Germany: 1 March 2027."
    ),
    {"allemagne": "2027-03-01", "france": "2027-02-10"},
)

# NEGATIF : une seule etape (elle se confond avec date_limite).
egal(
    "1 seule etape -> silence",
    calendrier_depuis_texte("Application deadline: 15 January 2027."),
    None,
)

# NEGATIF : date relative (« debut janvier ») : pas un fait datable.
egal(
    "date relative -> silence",
    calendrier_depuis_texte(
        "La date limite tombe debut janvier 2027. Les resultats seront annonces plus tard."
    ),
    None,
)

# NEGATIF : mois seul, sans jour : le contrat exige YYYY-MM-DD.
egal(
    "mois sans jour -> silence",
    calendrier_depuis_texte("Applications close June 2027. Results in August 2027."),
    None,
)

# NEGATIF : meme etape, deux dates differentes -> ambiguite, etape abandonnee.
egal(
    "meme etape 2 dates -> silence",
    calendrier_depuis_texte(
        "Application deadline: 15 January 2027. Application deadline: 20 January 2027. "
        "Results: 30 April 2027."
    ),
    None,
)

# NEGATIF : ordre incoherent (resultat avant candidature) = deux cycles melanges.
egal(
    "ordre incoherent -> silence",
    calendrier_depuis_texte(
        "Results announced: 1 February 2027. Application deadline: 15 March 2027."
    ),
    None,
)

# NEGATIF : une ouverture n'est pas une etape du contrat.
egal(
    "ouverture seule -> silence",
    calendrier_depuis_texte(
        "Applications open on 5 January 2027. Results announced 30 April 2027."
    ),
    None,
)

# NEGATIF : date d'etat civil / d'historique, jamais un parcours.
egal(
    "date d'etat civil -> silence",
    calendrier_depuis_texte(
        "Born on or after 26 June 1996. Founded in 1990. Results: 30 April 2027."
    ),
    None,
)

# NEGATIF : une fourchette n'a pas de date ponctuelle.
egal(
    "fourchette de dates -> silence",
    calendrier_depuis_texte(
        "Interviews 8-12 March 2027. Application deadline 15 January 2027."
    ),
    None,
)

# NEGATIF : « Paris time » est un fuseau, pas une destination.
egal(
    "fuseau horaire -> pas une echeance par pays",
    dates_par_pays_depuis_texte("Deadline 1 March 2027, 13:00 Berlin time."),
    None,
)

# NEGATIF : deux pays, la MEME date -> la cle n'apporte rien.
egal(
    "2 pays meme date -> silence",
    dates_par_pays_depuis_texte(
        "Deadline for France: 10 February 2027. Deadline for Germany: 10 February 2027."
    ),
    None,
)

# NEGATIF : un seul pays date.
egal(
    "1 seul pays -> silence",
    dates_par_pays_depuis_texte("Deadline for Germany: 1 March 2027."),
    None,
)

# --------------------------------------------------------------- stockage lu
verifier(
    "calendrier_stocke accepte une forme conforme",
    calendrier_stocke(
        {"calendrier": [{"etape": "candidature", "date": "2027-01-15"},
                        {"etape": "resultat", "date": "2027-04-30"}]}
    )
    is not None,
)
egal(
    "calendrier_stocke refuse une seule etape",
    calendrier_stocke({"calendrier": [{"etape": "candidature", "date": "2027-01-15"}]}),
    None,
)
egal(
    "calendrier_stocke refuse un doublon d'etape",
    calendrier_stocke(
        {"calendrier": [{"etape": "candidature", "date": "2027-01-15"},
                        {"etape": "candidature", "date": "2027-02-15"}]}
    ),
    None,
)
egal(
    "calendrier_stocke refuse un ordre non chronologique",
    calendrier_stocke(
        {"calendrier": [{"etape": "candidature", "date": "2027-04-30"},
                        {"etape": "resultat", "date": "2027-01-15"}]}
    ),
    None,
)
egal(
    "calendrier_stocke refuse une date non ISO",
    calendrier_stocke(
        {"calendrier": [{"etape": "candidature", "date": "15 janvier 2027"},
                        {"etape": "resultat", "date": "2027-04-30"}]}
    ),
    None,
)
egal(
    "calendrier_stocke refuse null (absence = cle absente)",
    calendrier_stocke({"calendrier": None}),
    None,
)
verifier(
    "dates_par_pays_stocke accepte 2 pays distincts",
    dates_par_pays_stocke({"dates_par_pays": {"france": "2027-02-10", "allemagne": "2027-03-01"}})
    is not None,
)
egal(
    "dates_par_pays_stocke refuse 2 pays meme date",
    dates_par_pays_stocke({"dates_par_pays": {"france": "2027-02-10", "allemagne": "2027-02-10"}}),
    None,
)
egal(
    "dates_par_pays_stocke refuse 1 pays",
    dates_par_pays_stocke({"dates_par_pays": {"france": "2027-02-10"}}),
    None,
)

# ------------------------------------------------------------------ backfill
def offre(id_: str, titre: str, description: str, metadata: dict | None) -> dict:
    return {
        "id": id_,
        "titre": titre,
        "description": description,
        "source_name": "test",
        "active": True,
        "date_limite": "2027-06-30",
        "metadata": metadata,
    }


AUJOURD_HUI = date(2026, 11, 17)

# POSITIF + FUSION : la cle d'un autre auteur est preservee.
plan, refus = backfill.planifier(
    [
        offre(
            "1",
            "Bourse X",
            "Application deadline: 15 January 2027. Results announced: 30 April 2027.",
            {"categorie_bourse": "fondation", "montant": {"valeur": 1000, "devise": "EUR", "periode": "mois"}},
        )
    ],
    AUJOURD_HUI,
)
verifier("backfill : 1 correction planifiee", len(plan) == 1, f"plan={len(plan)}")
verifier(
    "backfill : calendrier ecrit",
    plan and plan[0]["metadata"].get("calendrier")
    == [
        {"etape": "candidature", "date": "2027-01-15"},
        {"etape": "resultat", "date": "2027-04-30"},
    ],
)
verifier(
    "backfill : FUSION sans perte (categorie_bourse + montant conserves)",
    plan
    and plan[0]["metadata"].get("categorie_bourse") == "fondation"
    and plan[0]["metadata"].get("montant", {}).get("devise") == "EUR",
)
verifier(
    "backfill : aucune cle hors contrat ajoutee",
    plan
    and set(plan[0]["metadata"])
    == {"categorie_bourse", "montant", "calendrier"},
)

# NEGATIF : parcours deja termine -> refuse (une date passee n'aide personne).
plan_passe, refus_passe = backfill.planifier(
    [
        offre(
            "2",
            "Bourse passee",
            "Application deadline: 15 January 2026. Results announced: 30 April 2026.",
            {},
        )
    ],
    AUJOURD_HUI,
)
egal("backfill : calendrier deja termine -> aucune ecriture", len(plan_passe), 0)
verifier(
    "backfill : refus compte le calendrier termine",
    refus_passe.get("calendrier deja termine") == 1,
    f"refus={dict(refus_passe)}",
)

# IDEMPOTENCE : rejouer sur une offre deja conforme ne produit rien.
plan_2, _ = backfill.planifier(
    [offre("1", "Bourse X", "peu importe", plan[0]["metadata"])], AUJOURD_HUI
)
egal("backfill : idempotent (2e passage = 0 ecriture)", len(plan_2), 0)

# NEGATIF : aucune donnee inventee quand le texte n'en publie pas.
plan_vide, _ = backfill.planifier(
    [offre("3", "Bourse Y", "Bourse ouverte aux etudiants africains.", {})], AUJOURD_HUI
)
egal("backfill : texte sans etapes -> aucune ecriture", len(plan_vide), 0)

# ------------------------------------------------------------------- verdict
total = len(resultats)
ok = sum(1 for _, condition, _ in resultats if condition)
for nom, condition, detail in resultats:
    if not condition:
        print(f"KO   {nom}  {detail}")
print(f"RESULTAT : {ok}/{total} checks verts")
if ok != total:
    print("VERDICT : KO")
    raise SystemExit(1)
print("VERDICT : VERT")
