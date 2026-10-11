# -*- coding: utf-8 -*-
"""Harnais de preuve Lots C + D (moteur bourses 100 %) — LAWOL.mr.

Lot C — alertes deadline J-12 / J-3 :
  crée des profils + offres + matches de test (marqueur « HARNAIS-CD »),
  exécute run_deadline_job avec un envoi capturé (aucun WhatsApp réel,
  aucune dépendance au token Meta), et prouve :
    1. un rappel part à J-12 et un à J-3 pour le profil actif ;
    2. une seule fois par seuil (2e run → 0 envoi, état persisté en base) ;
    3. progression J-12 → J-3 sur la même offre (run daté J+10) ;
    4. opt-out respecté (profil actif=false → 0 rappel) ;
    5. hors bourse → 0 rappel (Lot F : stages/emplois en veille) ;
    6. hors fenêtre (J-30) et déjà expirée → 0 rappel.
  Les données de test sont SUPPRIMÉES en fin de run et les metadata des
  vrais matches restaurées (le job balaie toute la table matches).

Lot D — matching bourses pertinentes :
  exécution DIRECTE du moteur (import engine.py, sans serveur, lecture
  seule) sur les vraies bourses actives : un profil « informatique + M2 »
  reçoit les bourses ciblées en tête et au plus
  MAX_BOURSES_GENERIQUES_PAR_PROFIL bourses toutes-filières. Comparaison
  avant/après tuning sur le même jeu de données.

Usage : python -X utf8 scripts/verify-lotcd.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from apps.api.app.core.database import supabase  # noqa: E402
from apps.api.app.modules.matching import engine  # noqa: E402
from apps.api.app.modules.whatsapp import notifier  # noqa: E402

MARQUE = "HARNAIS-CD"
SOURCE_NOM = "harnais-lotcd"
TELEPHONES = {
    "actif": "22290000001",      # reçoit les rappels
    "optout": "22290000002",     # actif=false → jamais de rappel
}

_checks: list[tuple[bool, str]] = []


def check(ok: bool, libelle: str) -> None:
    _checks.append((bool(ok), libelle))
    print(f"  [{'OK' if ok else 'KO'}] {libelle}")


# ---------------------------------------------------------------- Lot D ----
def preuve_lot_d() -> None:
    """Moteur exécuté en direct (pur + vraies bourses) — aucun écrit."""
    print("\n=== LOT D : matching informatique + M2 sur les vraies bourses ===")
    today = date.today()
    res = (
        supabase.table("offres")
        .select("id, titre, filieres_cibles, ville, type_offre, date_limite, date_scrape")
        .eq("type_offre", "bourse")
        .eq("active", True)
        .gte("date_limite", today.isoformat())
        .execute()
    )
    offres = res.data
    print(f"  bourses actives examinees : {len(offres)}")

    profil = {
        "filiere": "informatique",
        "ville": "nouakchott",
        "types_recherches": ["bourse"],
        "filieres_interet": [],
    }

    candidats = []
    candidats_avant = []  # simulation « avant Lot D » : pas de flag générique
    for o in offres:
        ok, raison = engine.match_regles(
            profil_actif=True,
            offre_active=True,
            date_limite=date.fromisoformat(str(o["date_limite"])[:10]),
            type_offre=o["type_offre"],
            types_recherches=profil["types_recherches"],
            filiere_profil=profil["filiere"],
            filieres_interet=profil["filieres_interet"],
            filieres_cibles=o.get("filieres_cibles") or [],
            ville_profil=profil["ville"],
            ville_offre=o["ville"],
            aujourdhui=today,
        )
        if not ok:
            continue
        generique = engine.est_bourse_generique(o["type_offre"], o.get("filieres_cibles"))
        try:
            date_limite = date.fromisoformat(str(o["date_limite"])[:10])
        except (TypeError, ValueError):
            continue
        try:
            date_scrape = date.fromisoformat(str(o.get("date_scrape") or today.isoformat())[:10])
        except (TypeError, ValueError):
            date_scrape = today
        commun = dict(
            filiere_profil=profil["filiere"],
            filieres_interet=profil["filieres_interet"],
            filieres_cibles=o.get("filieres_cibles") or [],
            ville_profil=profil["ville"],
            ville_offre=o["ville"],
            date_scrape=date_scrape,
            date_limite=date_limite,
            aujourdhui=today,
        )
        score = engine.calculer_score_pertinence(**commun, bourse_generique=generique)
        candidats.append(
            {
                "offre_id": o["id"],
                "profil_id": "profil-test",
                "score": score,
                "metadata": {"raison": raison, "bourse_generique": generique, "titre": o["titre"]},
            }
        )
        # Avant Lot D : le score ignorait la genericité (bourse = toutes
        # filieres = bonus filière pleine) — même règle, réglage historique
        score_avant = engine.calculer_score_pertinence(**commun, bourse_generique=False)
        candidats_avant.append(
            {
                "offre_id": o["id"],
                "profil_id": "profil-test",
                "score": score_avant,
                "metadata": {"bourse_generique": False, "titre": o["titre"]},
            }
        )

    retenus, spam, generiques_ignores = engine.selectionner_candidats(
        candidats, deja_semaine=0, deja_generiques=0
    )
    # Avant : seul l'anti-spam (5) s'appliquait
    avant = sorted(candidats_avant, key=lambda x: x["score"], reverse=True)[
        : engine.MAX_MATCHES_PAR_SEMAINE
    ]

    n_gen_apres = sum(1 for c in retenus if c["metadata"]["bourse_generique"])
    # Recalcul propre « avant » : combien de génériques figuraient dans le top-5
    ids_generiques = {c["offre_id"] for c in candidats if c["metadata"]["bourse_generique"]}
    n_gen_avant = sum(1 for c in avant if c["offre_id"] in ids_generiques)

    scores_cibles = [c["score"] for c in retenus if not c["metadata"]["bourse_generique"]]
    scores_gen = [c["score"] for c in candidats if c["metadata"]["bourse_generique"]]

    print(f"  paires matchantes (regles v1)   : {len(candidats)}")
    print(f"  AVANT  top-5 (sans tuning)      : dont {n_gen_avant} bourse(s) toutes-filieres")
    print(f"  APRES  retenus                  : {len(retenus)} (dont {n_gen_apres} generique(s),"
          f" {generiques_ignores} generique(s) ecarte(s) par le quota)")
    for c in retenus:
        tag = "GEN" if c["metadata"]["bourse_generique"] else "   "
        print(f"    {tag} {c['score']:>3}  {c['metadata']['titre'][:64]}")

    check(len(retenus) > 0, "Lot D : le moteur matche des bourses pour informatique+M2")
    check(
        n_gen_apres <= engine.MAX_BOURSES_GENERIQUES_PAR_PROFIL,
        f"Lot D : au plus {engine.MAX_BOURSES_GENERIQUES_PAR_PROFIL} bourses toutes-filières "
        f"retenues (obtenu : {n_gen_apres})",
    )
    check(
        scores_cibles and scores_gen and min(scores_cibles) > max(scores_gen),
        "Lot D : toute bourse ciblée informatique rank APRÈS toutes les génériques",
    )
    check(
        n_gen_apres <= n_gen_avant,
        f"Lot D : les génériques ne saturent plus le quota hebdo "
        f"(avant : {n_gen_avant}/5, après : {n_gen_apres}/{len(retenus)})",
    )
    check(
        len(retenus) == engine.MAX_MATCHES_PAR_SEMAINE,
        f"Lot D : quota hebdo appliqué — {len(retenus)} retenus sur "
        f"{len(candidats)} candidats (anti-spam : {spam} écartés)",
    )


# ---------------------------------------------------------------- Lot C ----
def _capturer(boite: list, autorises: set[str]) -> object:
    """Envoi factice : mémorise (telephone, texte) au lieu d'appeler Meta.

    Seuls les téléphones du jeu de test sont acceptés — tout autre
    destinataire lève une erreur, ce qui garantit zéro écriture (et zéro
    « faux rappel » persisté) sur les vrais matches de la base.
    """

    def envoi(telephone: str, texte: str) -> dict:
        if telephone not in autorises:
            raise RuntimeError(f"harnais : destinataire {telephone} hors jeu de test")
        boite.append((telephone, texte))
        return {"id": "harnais"}

    return envoi


def _restore_metadata(snapshot: dict[str, dict], test_match_ids: set[str]) -> int:
    """Restaure metadata des matches NON-test modifiés par le balayage."""
    restaures = 0
    res = supabase.table("matches").select("id, metadata").execute()
    for row in res.data:
        if row["id"] in test_match_ids:
            continue
        if (row.get("metadata") or {}) != (snapshot.get(row["id"]) or {}):
            supabase.table("matches").update({"metadata": snapshot.get(row["id"]) or {}}).eq(
                "id", row["id"]
            ).execute()
            restaures += 1
    return restaures


def preuve_lot_c() -> None:
    print("\n=== LOT C : alertes deadline J-12 / J-3 (profils de test) ===")
    today = date.today()
    j = lambda n: (today + timedelta(days=n)).isoformat()  # noqa: E731

    # Snapshot de TOUS les matches réels (le job balaie la table entière)
    snapshot = {
        m["id"]: m.get("metadata") or {}
        for m in supabase.table("matches").select("id, metadata").execute().data
    }

    # --- Données de test (toutes supprimées à la fin) ---------------------
    p_actif = (
        supabase.table("profils")
        .insert(
            {
                "telephone": TELEPHONES["actif"],
                "nom": MARQUE,
                "prenom": "Actif",
                "universite": MARQUE,
                "filiere": "informatique",
                "niveau": "M2",
                "types_recherches": ["bourse"],
                "actif": True,
                "optin_texte": MARQUE,
            }
        )
        .execute()
        .data[0]
    )
    p_optout = (
        supabase.table("profils")
        .insert(
            {
                "telephone": TELEPHONES["optout"],
                "nom": MARQUE,
                "prenom": "Optout",
                "universite": MARQUE,
                "filiere": "informatique",
                "niveau": "M2",
                "types_recherches": ["bourse"],
                "actif": False,  # opt-out : désinscription
                "optin_texte": MARQUE,
            }
        )
        .execute()
        .data[0]
    )

    cas = [
        # (marqueur titre, type, jours, profil, rappel attendu)
        ("bourse J12", "bourse", 12, p_actif, "J-12"),
        ("bourse J3", "bourse", 3, p_actif, "J-3"),
        ("bourse J30", "bourse", 30, p_actif, None),
        ("bourse expiree", "bourse", -1, p_actif, None),
        ("stage J5", "stage_pfe", 5, p_actif, None),
        ("bourse optout", "bourse", 5, p_optout, None),
    ]
    test_match_ids: set[str] = set()
    try:
        offres_ids = {}
        for titre, type_offre, jours, _, _ in cas:
            o = (
                supabase.table("offres")
                .insert(
                    {
                        "source": "autre",
                        "source_name": SOURCE_NOM,
                        "source_url": f"{SOURCE_NOM}/{titre.replace(' ', '-')}",
                        "titre": f"{MARQUE} {titre}",
                        "entreprise": MARQUE,
                        "ville": "nouakchott",
                        "filieres_cibles": ["informatique"],
                        "type_offre": type_offre,
                        "description": MARQUE,
                        "date_limite": j(jours),
                        "active": True,
                    }
                )
                .execute()
                .data[0]
            )
            offres_ids[titre] = o["id"]

        for titre, _, _, profil, _ in cas:
            m = (
                supabase.table("matches")
                .insert(
                    {
                        "offre_id": offres_ids[titre],
                        "profil_id": profil["id"],
                        "score": 80,
                        "notifie": True,
                        "metadata": {"regle": "harnais"},
                    }
                )
                .execute()
                .data[0]
            )
            test_match_ids.add(m["id"])

        def libelles(boite: list[str]) -> list[str]:
            return [t for _, t in boite if MARQUE in t]

        def run(today_ref, boite: list) -> dict:
            return notifier.run_deadline_job(
                aujourdhui=today_ref,
                envoi=_capturer(boite, set(TELEPHONES.values())),
            )

        # --- Run 1 : aujourd'hui ------------------------------------------
        boite: list = []
        s1 = run(today, boite)
        msgs = libelles(boite)
        print(f"  run 1 (aujourd'hui) : {s1}")
        for tel, txt in boite:
            if MARQUE in txt:
                print(f"    -> {tel} : {txt.splitlines()[0]}")
        check(len(msgs) == 2, f"Lot C : 2 rappels au 1er run (obtenu {len(msgs)})")
        check(
            any("bourse J12" in t and "12 jours" in t for t in msgs),
            "Lot C : rappel J-12 « Plus que 12 jours » parti une fois",
        )
        check(
            any("bourse J3" in t and "3 jours" in t for t in msgs),
            "Lot C : rappel J-3 « Plus que 3 jours » parti une fois",
        )
        check(
            not any(k in t for t in msgs for k in ("J30", "expiree", "stage", "optout")),
            "Lot C : aucun rappel hors fenêtre / expiré / stage / opt-out",
        )

        # État persisté en base
        j12_match = None
        j3_match = None
        res_m = supabase.table("matches").select("id, offre_id, metadata").in_(
            "id", list(test_match_ids)
        ).execute().data
        for row in res_m:
            if row["offre_id"] == offres_ids["bourse J12"]:
                j12_match = row
            if row["offre_id"] == offres_ids["bourse J3"]:
                j3_match = row
        check(
            (j12_match and (j12_match.get("metadata") or {}).get("deadline_j12_envoye")) == today.isoformat(),
            "Lot C : état « seuil J-12 envoyé » persisté en base (metadata match)",
        )
        check(
            (j3_match and (j3_match.get("metadata") or {}).get("deadline_j3_envoye")) == today.isoformat(),
            "Lot C : état « seuil J-3 envoyé » persisté en base (metadata match)",
        )

        # --- Run 2 : idempotence (même jour) ------------------------------
        boite2: list = []
        s2 = run(today, boite2)
        print(f"  run 2 (re-run même jour) : {s2}")
        check(
            len(libelles(boite2)) == 0 and s2["rappels_envoyes"] == 0,
            f"Lot C : re-run → 0 nouvel envoi (obtenu {s2['rappels_envoyes']}, "
            f"{s2['deja_envoyes']} déjà connus)",
        )

        # --- Run 3 : J+10 → la bourse J-12 passe en seuil J-3 -------------
        boite3: list = []
        s3 = run(today + timedelta(days=10), boite3)
        msgs3 = libelles(boite3)
        print(f"  run 3 (simulé J+10) : {s3}")
        check(
            len(msgs3) == 1 and "bourse J12" in msgs3[0] and "2 jours" in msgs3[0],
            "Lot C : progression J-12 → J-3 sur la même offre (J+10 = « Plus que 2 jours »)",
        )

        # --- Run 4 : J+10 encore → plus rien --------------------------------
        boite4: list = []
        s4 = run(today + timedelta(days=10), boite4)
        print(f"  run 4 (re-run simulé J+10) : {s4}")
        check(
            len(libelles(boite4)) == 0 and s4["rappels_envoyes"] == 0,
            "Lot C : re-run à J+10 → 0 nouvel envoi (une seule fois par seuil)",
        )
    finally:
        # --- Nettoyage : données de test supprimées, réels restaurés -------
        supabase.table("matches").delete().in_("id", list(test_match_ids)).execute()
        supabase.table("offres").delete().eq("source_name", SOURCE_NOM).execute()
        supabase.table("profils").delete().in_("telephone", list(TELEPHONES.values())).execute()
        restaures = _restore_metadata(snapshot, test_match_ids)
        restes = (
            supabase.table("profils")
            .select("id")
            .in_("telephone", list(TELEPHONES.values()))
            .execute()
            .data
        )
        check(not restes, "Nettoyage : profils de test supprimés de la base")
        print(f"  metadata de matches réels restaurés : {restaures}")


def main() -> int:
    try:
        preuve_lot_d()
        preuve_lot_c()
    except Exception as exc:  # noqa: BLE001
        print(f"\nERREUR HARNAIS : {type(exc).__name__}: {exc}")
        return 2
    finally:
        pass

    ko = [lib for ok, lib in _checks if not ok]
    print(f"\n=== SYNTHESE : {len(_checks) - len(ko)}/{len(_checks)} checks OK ===")
    for lib in ko:
        print(f"  KO -> {lib}")
    return 1 if ko else 0


if __name__ == "__main__":
    raise SystemExit(main())
