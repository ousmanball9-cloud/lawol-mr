# -*- coding: utf-8 -*-
"""Preuve LIVE d'envoi email par le chemin de prod (Lot E / P2 - Boucle de promesse).

Usage (live, requiert les vars SMTP_* reelles) :
    python -X utf8 scripts/verify-envoi-live.py --live --dest etudiant@exemple.mr
        [--match-id <uuid>]

Ce script :
  1. Verifie que les vars SMTP_* sont presentes (NOMS SEULEMENT - jamais les valeurs).
  2. Recupere le profil associe a l'email destinataire dans Supabase.
  3. Envoie 1 notification reelle via canal.py -> email_sender (chemin de prod).
  4. Marque matches.notifie = true en base (meme operation que run_notification_job).
  5. Relit la base et verifie matches.notifie = true.
  6. Controle negatif : destinataire invalide -> harnais KO (code != 0).

Aucun secret n'est affiche (noms de variables uniquement).
Zéro modification de la regle de matching.
"""
import argparse
import os
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
sys.path.insert(0, str(RACINE))

# Noms de variables SMTP (aucune valeur n'est jamais lue ni affichee ici).
VARS_SMTP = (
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "EMAIL_FROM",
    "EMAIL_FROM_NAME",
)
VARS_SMTP_OBLIGATOIRES = ("SMTP_HOST", "EMAIL_FROM")

from apps.api.app.core.database import supabase  # noqa: E402
from apps.api.app.modules.notifications import canal  # noqa: E402
from apps.api.app.modules.notifications.email_sender import (  # noqa: E402
    envoyer_email,
    valider_email,
)
from apps.api.app.modules.whatsapp.textes import (  # noqa: E402
    construire_texte_notification,
)

_checks: list[tuple[bool, str]] = []


def check(ok: bool, libelle: str) -> None:
    _checks.append((bool(ok), libelle))
    print(f"  [{'OK' if ok else 'KO'}] {libelle}")


def _present(nom: str) -> bool:
    return bool((os.getenv(nom) or "").strip())


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Preuve live d'envoi email (chemin de prod : canal.py -> email_sender)."
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Mode live : envoi veritable (requiert SMTP_*).",
    )
    parser.add_argument(
        "--dest",
        help="Email destinataire du test (requis en --live).",
    )
    parser.add_argument(
        "--match-id",
        help="ID du match a notifier (optionnel, sinon le plus ancien non notifie).",
    )
    args = parser.parse_args()

    if not args.live:
        parser.print_help()
        print("\nLe mode --live est obligatoire pour envoyer une notification reelle.")
        return 2

    # ---- 0. Configuration SMTP (noms de variables uniquement, jamais les valeurs) ----
    print("\n1. Configuration SMTP (noms de variables uniquement)")
    for v in VARS_SMTP:
        check(_present(v), f"{v} definie")
    manquantes = [v for v in VARS_SMTP_OBLIGATOIRES if not _present(v)]
    if manquantes:
        print(
            "\nABANDON : test live non configurable localement.\n"
            "  Vars SMTP obligatoires manquantes : " + ", ".join(manquantes) + "\n"
            "  Configurez-les sur le dashboard Railway (API) / Vercel (front) - "
            "jamais dans le depot.\n"
            "  Voir docs/prototypage-promesse.md (section P2)."
        )
        return 1

    # ---- 1. Destinataire (controle negatif si invalide) ----
    print("\n2. Destinataire")
    dest = (args.dest or "").strip()
    if not valider_email(dest):
        check(False, "destinataire valide (format)")
        print(
            "\nHarnais KO : destinataire absent ou invalide.\n"
            "  Usage : --dest etudiant@exemple.mr"
        )
        return 1
    check(True, "destinataire valide (format)")

    # Controle negatif : une adresse invalide est rejetee AVANT toute connexion
    # SMTP (zero reseau).
    try:
        envoyer_email("pas-un-email", "sujet", "corps")
        check(False, "controle negatif : envoyer_email(adresse invalide) leve ValueError")
    except ValueError:
        check(True, "controle negatif : adresse invalide rejetee avant connexion SMTP")

    # ---- 2. Profil associe a l'email ----
    print("\n3. Recherche du profil (Supabase)")
    try:
        res = (
            supabase.table("profils")
            .select("id, telephone, email, prenom, nom, actif")
            .eq("email", dest)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 - panne base = KO
        check(False, "lecture table profils")
        print(f"\nHarnais KO : lecture profils impossible ({type(exc).__name__}).")
        return 1
    profils = res.data or []
    if not profils:
        check(False, "profil trouve pour ce destinataire")
        print("\nHarnais KO : aucun profil avec cet email en base.")
        return 1
    profil = profils[0]
    check(True, f"profil trouve (id={profil['id']})")

    # ---- 3. Match non notifie (notifie=false) pour ce profil ----
    print("\n4. Match non notifie (notifie=false) pour ce profil")
    try:
        q = (
            supabase.table("matches")
            .select(
                "id, notifie, offre:offres(id, titre, entreprise, ville, date_limite, type_offre)"
            )
            .eq("profil_id", profil["id"])
            .eq("notifie", False)
        )
        if args.match_id:
            q = q.eq("id", args.match_id)
        res = q.execute()
    except Exception as exc:  # noqa: BLE001
        check(False, "lecture table matches")
        print(f"\nHarnais KO : lecture matches impossible ({type(exc).__name__}).")
        return 1
    matches = res.data or []
    if not matches:
        check(False, "match non notifie disponible")
        print(
            "\nHarnais KO : aucun match non notifie pour ce profil "
            "(match deja notifie ou absent)."
        )
        return 1
    m = matches[0]
    check(True, f"match selectionne (id={m['id']}, notifie={m.get('notifie')})")

    offre = m.get("offre") or {}
    if isinstance(offre, list):  # PostgREST renvoie parfois une liste pour une relation simple
        offre = offre[0] if offre else {}

    # ---- 4. Envoi reel via canal.py -> email_sender (chemin de prod) ----
    print("\n5. Envoi reelle notification (chemin de prod : canal.py -> email_sender)")
    sujet = "LAWOL.mr - Nouvelle offre matchee"
    texte = construire_texte_notification(offre)
    try:
        resultat = canal.envoyer_email_profil(profil, texte, sujet=sujet)
    except Exception as exc:  # noqa: BLE001 - panne canal = KO
        check(False, "envoi email sans exception")
        print(f"\nHarnais KO : exception lors de l'envoi ({type(exc).__name__}).")
        return 1
    email_envoye = bool(resultat.get("ok"))
    check(email_envoye, "email accepte par le canal de prod (pas d'erreur SMTP)")
    if not email_envoye:
        print(f"\nHarnais KO : envoi email echoue (raison={resultat.get('raison')}).")
        return 1

    # ---- 5. Marquage matches.notifie = true (meme operation que run_notification_job) ----
    print("\n6. Marquage matches.notifie = true en base")
    try:
        supabase.table("matches").update({"notifie": True}).eq("id", m["id"]).execute()
    except Exception as exc:  # noqa: BLE001
        check(False, "mise a jour notifie=true")
        print(f"\nHarnais KO : marquage notifie impossible ({type(exc).__name__}).")
        return 1

    # ---- 6. Verification notifie=true en base (re-lecture) ----
    print("\n7. Verification matches.notifie = true (re-lecture)")
    try:
        res2 = supabase.table("matches").select("id, notifie").eq("id", m["id"]).execute()
    except Exception as exc:  # noqa: BLE001
        check(False, "re-lecture du match")
        print(f"\nHarnais KO : re-lecture impossible ({type(exc).__name__}).")
        return 1
    lignes = res2.data or []
    notifie_ok = bool(lignes and lignes[0].get("notifie") is True)
    check(notifie_ok, "matches.notifie = true confirme en base")
    if not notifie_ok:
        print("\nHarnais KO : notifie n'est pas passe a true en base.")
        return 1

    # ---- Bilan ----
    ko = [lib for ok, lib in _checks if not ok]
    print(f"\n{'=' * 60}")
    if ko:
        print(f"RESULTAT : {len(ko)} echec(s) -> HARNAIS KO")
        for lib in ko:
            print(f"  KO -> {lib}")
        return 1
    print("RESULTAT : preuve live d'envoi email VALIDE (email envoye + notifie=true en base).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
