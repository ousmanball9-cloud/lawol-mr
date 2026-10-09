"""Webhook WhatsApp — réception des messages (étudiants + entreprises).

Meta envoie un POST à chaque message reçu par le numéro WhatsApp Business.
"""
import logging
from fastapi import APIRouter, Request, HTTPException, Query

from apps.api.app.core.config import settings
from apps.api.app.modules.whatsapp.security import verifier_signature

logger = logging.getLogger(__name__)
router = APIRouter()

# Stockage en mémoire des derniers messages reçus (debug)
_derniers_messages: list[dict] = []


@router.get("/api/v1/whatsapp/webhook")
async def verifier_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    """Meta vérifie l'URL du webhook au moment de l'abonnement (GET)."""
    # Le verify_token est optionnel dans la nouvelle interface Meta
    # Si configuré, on le vérifie ; sinon on accepte (le POST reste protégé par la signature)
    if hub_verify_token and hub_verify_token != settings.WHATSAPP_VERIFY_TOKEN:
        raise HTTPException(403, "Token de vérification invalide")
    if hub_mode == "subscribe":
        return int(hub_challenge) if hub_challenge else "ok"
    raise HTTPException(403, "Requête invalide")


@router.post("/api/v1/whatsapp/webhook")
async def recevoir_message(request: Request):
    """Reçoit les messages WhatsApp (POST de Meta)."""
    body = await request.body()
    signature = request.headers.get("x-hub-signature-256")

    if not verifier_signature(body, signature):
        raise HTTPException(403, "Signature invalide")

    data = await request.json()
    # Stocker pour debug (max 10)
    _derniers_messages.append({"data": data, "signature": signature})
    if len(_derniers_messages) > 10:
        _derniers_messages.pop(0)

    # Log sanitisé : jamais de données sensibles (numéro, contenu message)
    logger.info(f"Message WhatsApp reçu (id={_safe_id(data)})")
    return {"status": "ok"}


def _safe_id(data: dict) -> str:
    """Extrait un identifiant de message sans exposer le contenu."""
    try:
        return data["entry"][0]["changes"][0]["value"]["messages"][0]["id"]
    except (KeyError, IndexError):
        return "inconnu"


@router.get("/api/v1/whatsapp/messages")
async def lister_messages(token: str = Query()):
    """Debug : liste les derniers messages reçus par le webhook (auth requise)."""
    if not token or token != settings.ADMIN_PASSWORD_HASH:
        raise HTTPException(403, "Token admin invalide")
    return {"total": len(_derniers_messages), "messages": _derniers_messages}
