"""Webhook WhatsApp — réception des messages (étudiants + entreprises).

Meta envoie un POST à chaque message reçu par le numéro WhatsApp Business.
"""
from fastapi import APIRouter, Request, HTTPException, Query

from apps.api.app.core.config import settings
from apps.api.app.modules.whatsapp.security import verifier_signature

router = APIRouter()


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
    # TODO : parser le message, détecter si c'est une offre (entreprise) ou une demande (étudiant)
    # Pour l'instant : log uniquement
    print(f"📩 Message reçu : {str(data)[:200]}")
    return {"status": "ok"}
