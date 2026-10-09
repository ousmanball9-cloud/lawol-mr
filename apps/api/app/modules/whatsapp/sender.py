"""Envoi de messages WhatsApp via Meta Cloud API.

Docs : https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
"""
import httpx

from apps.api.app.core.config import settings

GRAPH_URL = "https://graph.facebook.com/v21.0"


def envoyer_message_texte(destinataire_telephone: str, texte: str) -> dict:
    """Envoie un message texte à un étudiant (format +222 suivi de 8 chiffres)."""
    if not settings.META_WHATSAPP_TOKEN or not settings.META_PHONE_NUMBER_ID:
        raise RuntimeError("Clés META_WHATSAPP_* non configurées")

    url = f"{GRAPH_URL}/{settings.META_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.META_WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": destinataire_telephone,
        "type": "text",
        "text": {"body": texte},
    }
    r = httpx.post(url, headers=headers, json=payload, timeout=30)
    r.raise_for_status()
    return r.json()


def envoyer_notification_match(profil: dict, offres: list[dict]) -> dict:
    """Envoie les offres matchées à un étudiant (1 message par offre)."""
    resultats = []
    for offre in offres[:3]:  # max 3 offres par notification
        texte = (
            f"🎓 *Nouvelle offre matchée !*\n\n"
            f"📌 {offre['titre']}\n"
            f"🏢 {offre['entreprise']}\n"
            f"📍 {offre['ville']}\n"
            f"📅 Date limite : {offre['date_limite']}\n\n"
            f"👉 Postule vite !"
        )
        res = envoyer_message_texte(profil["telephone"], texte)
        resultats.append(res)
    return {"envoyes": len(resultats), "details": resultats}
