"""Notification WhatsApp — envoie les matches non notifiés aux étudiants.

Flux : matching job crée les matches (notifie=false) → notifier les envoie → notifie=true

Lot C (alertes deadline) : run_deadline_job rappelle une bourse déjà matchée
à J-12 puis J-3 de sa clôture, une seule fois par seuil (état persisté dans
matches.metadata : clés deadline_j12_envoye / deadline_j3_envoye = date ISO).
Opt-out respecté : seuls les profils actif=true reçoivent un rappel.

Lot E (canal-agnostique) : les envois passent par notifications/canal.py —
WhatsApp principal, email en filet de sécurité. L'injection `envoi`
(signature (telephone, texte)) reste le chemin de preuve du harnais
scripts/verify-lotcd.py : WhatsApp seul, zéro réseau.
"""
from datetime import date

from apps.api.app.core.database import supabase
from apps.api.app.modules.notifications.canal import envoyer_notification
from apps.api.app.modules.whatsapp.textes import (
    construire_texte_notification,
    construire_texte_rappel_deadline,
)

# Seuils de rappel (jours restants avant clôture) — 2×/jour via collecte_auto
SEUIL_J12 = 12
SEUIL_J3 = 3
CLE_METADATA_J12 = "deadline_j12_envoye"
CLE_METADATA_J3 = "deadline_j3_envoye"
# Types rappelés (Lot F : stages/emplois en veille → pas d'alerte sur ces types)
TYPES_RAPPELS_DEFAUT = ("bourse",)


def run_deadline_job(
    *,
    aujourdhui: date | None = None,
    types_rappels: tuple[str, ...] = TYPES_RAPPELS_DEFAUT,
    envoi=None,
) -> dict:
    """Rappelle les offres matchées dont la clôture approche (J-12 puis J-3).

    - Une seule fois par seuil : état persisté dans matches.metadata (jsonb,
      aucune migration) sous la forme {"deadline_j12_envoye": "2026-10-11"}.
    - Opt-out : un profil désactivé (actif=false, cf. /desinscription) ne
      reçoit jamais de rappel.
    - Échec d'envoi → le seuil n'est PAS marqué envoyé → retry au run suivant.
    - `envoi` injectable pour le harnais de preuve (aucun appel réseau réel) :
      signature (telephone, texte), WhatsApp seul, les exceptions remontent
      telles quelles. Sans injection → dispatch canal-agnostique
      (WhatsApp puis repli email, cf. notifications/canal.py).
    - `aujourdhui` injectable pour tester les seuils sans attendre J-12.
    """
    today = aujourdhui or date.today()

    # 1. Matches avec profil + offre — filtrage des seuils côté client
    #    (zéro dépendance à la syntaxe !inner de PostgREST, façon D8)
    # LOT RÉDUIT pour éviter timeout Railway
    res = (
        supabase.table("matches")
        .select(
            "id, metadata, "
            "profil:profils(id, telephone, email, prenom, actif), "
            "offre:offres(id, titre, entreprise, ville, date_limite, type_offre, active)"
        )
        .limit(50)  # Réduit de 1000 à 50 pour éviter timeout Railway
        .execute()
    )

    stats = {
        "examines": 0,
        "rappels_envoyes": 0,
        "deja_envoyes": 0,
        "ignores": 0,
        "erreurs": 0,
    }

    for m in res.data:
        profil = m.get("profil")
        offre = m.get("offre")
        if not profil or not offre:
            continue
        # Opt-out + offre active + type concerné + deadline future
        if not profil.get("actif"):
            continue
        if not offre.get("active", True):
            continue
        if offre.get("type_offre") not in types_rappels:
            continue
        try:
            dl = date.fromisoformat(str(offre["date_limite"])[:10])
        except (TypeError, ValueError):
            continue
        jours = (dl - today).days
        if jours < 0 or jours > SEUIL_J12:
            continue
        stats["examines"] += 1

        # Seuil applicable aujourd'hui : le plus urgent gagne (J-2 → seul le
        # rappel J-3 part, inutile d'empiler un J-12 déjà périmé)
        if jours <= SEUIL_J3:
            cle, intitule = CLE_METADATA_J3, "J-3"
        else:
            cle, intitule = CLE_METADATA_J12, "J-12"

        metadata = dict(m.get("metadata") or {})
        if metadata.get(cle):
            stats["deja_envoyes"] += 1
            continue

        try:
            texte = construire_texte_rappel_deadline(offre, jours)
            if envoi is not None:
                # Chemin de preuve (harnais) : envoi injecté = WhatsApp seul,
                # signature (telephone, texte) inchangée, exceptions propagées
                envoi(profil["telephone"], texte)
            else:
                # Chemin prod : dispatch canal-agnostique WhatsApp → email
                resultat = envoyer_notification(profil, texte)
                if not resultat["ok"]:
                    raise RuntimeError("aucun canal joignable (WhatsApp/email)")
        except Exception as e:  # noqa: BLE001 — canal down = retry au run suivant
            stats["erreurs"] += 1
            print(f"⚠️ rappel {intitule} échoué (match {m['id']}): {e}")
            continue

        # Persistance de l'état « seuil déjà envoyé » (merge, jamais
        # d'écrasement : metadata contient aussi regle/raison/content_hash)
        metadata[cle] = today.isoformat()
        supabase.table("matches").update({"metadata": metadata}).eq("id", m["id"]).execute()
        stats["rappels_envoyes"] += 1

    return stats


def run_notification_job() -> dict:
    """Envoie les matches non notifiés et les marque comme notifiés.

    Envoi via le dispatch canal-agnostique (Lot E) : WhatsApp d'abord, repli
    email. Un match n'est marqué notifié que si AU MOINS UN canal a réussi.

    Optimisation Railway : lot limité à 20 pour éviter timeout.
    Filtre : seulement profils AVEC email (pour que le fallback email fonctionne).
    """
    # 1. Matches non notifiés, avec profil + offre — LOT RÉDUIT
    # Filtre : profil.email non nul
    res = (
        supabase.table("matches")
        .select(
            "id, score, "
            "profil:profils!inner(id, prenom, nom, telephone, email, filiere, niveau), "
            "offre:offres(id, titre, entreprise, ville, date_limite, type_offre)"
        )
        .eq("notifie", False)
        .not_.is_("profil.email", "null")
        .limit(20)
        .execute()
    )

    matches = res.data
    print(f"🔍 DEBUG notifier: {len(matches)} matches à traiter")
    for i, m in enumerate(matches):
        print(f"  Match {i}: id={m['id']}, profil={m.get('profil')}")
    if not matches:
        return {"matches_trouves": 0, "notifies": 0, "erreurs": 0}

    # 2. Envoyer chaque notification
    notifies = 0
    erreurs = 0
    for m in matches:
        try:
            profil = m["profil"]
            offre = m["offre"]
            print(f"🔍 DEBUG notifier: traitement match {m['id']}, profil telephone={profil.get('telephone')}, email={profil.get('email')}")
            texte = construire_texte_notification(offre)
            resultat = envoyer_notification(profil, texte)
            if not resultat["ok"]:
                raise RuntimeError("aucun canal joignable (WhatsApp/email)")

            # Marquer comme notifié
            supabase.table("matches").update({"notifie": True}).eq("id", m["id"]).execute()
            notifies += 1
        except Exception as e:  # noqa: BLE001
            erreurs += 1
            print(f"⚠️ notification échouée (match {m['id']}): {e}")

    return {"matches_trouves": len(matches), "notifies": notifies, "erreurs": erreurs}
