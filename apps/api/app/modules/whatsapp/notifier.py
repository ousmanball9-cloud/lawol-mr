"""Notification WhatsApp — envoie les matches non notifiés aux étudiants.

Flux : matching job crée les matches (notifie=false) → notifier les envoie → notifie=true
"""
from apps.api.app.core.database import supabase
from apps.api.app.modules.whatsapp.sender import envoyer_message_texte
from apps.api.app.modules.whatsapp.textes import construire_texte_notification


def run_notification_job() -> dict:
    """Envoie les matches non notifiés et les marque comme notifiés."""
    # 1. Matches non notifiés, avec profil + offre
    res = (
        supabase.table("matches")
        .select(
            "id, score, "
            "profil:profils(id, prenom, nom, telephone, filiere, niveau), "
            "offre:offres(id, titre, entreprise, ville, date_limite, type_offre)"
        )
        .eq("notifie", False)
        .limit(50)
        .execute()
    )

    matches = res.data
    if not matches:
        return {"matches_trouves": 0, "notifies": 0, "erreurs": 0}

    # 2. Envoyer chaque notification
    notifies = 0
    erreurs = 0
    for m in matches:
        try:
            profil = m["profil"]
            offre = m["offre"]
            texte = construire_texte_notification(offre)
            envoyer_message_texte(profil["telephone"], texte)

            # Marquer comme notifié
            supabase.table("matches").update({"notifie": True}).eq("id", m["id"]).execute()
            notifies += 1
        except Exception as e:  # noqa: BLE001
            erreurs += 1
            print(f"⚠️ notification échouée (match {m['id']}): {e}")

    return {"matches_trouves": len(matches), "notifies": notifies, "erreurs": erreurs}
