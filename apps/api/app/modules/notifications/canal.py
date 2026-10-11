"""Dispatch de notification canal-agnostique : WhatsApp d'abord, email en repli.

Brief bourses § Lot E : « le code de notification doit rester canal-agnostique ».
WhatsApp reste le canal principal (token Meta) ; l'email est le filet de
sécurité si WhatsApp est indisponible ou échoue.

Sécurité (anti relais ouvert) :
    - le destinataire N'ARRIVE PAS par l'appel : uniquement les coordonnées du
      profil concerné (profil["telephone"], profil["email"]) ;
    - l'email n'est tenté qu'avec une adresse validée au format ET un SMTP
      configuré (env SMTP_* — aucun secret en dur) ;
    - aucun réseau si WhatsApp est OK : le repli ne se déclenche qu'en échec.

Contrat : {"whatsapp": bool, "email": bool, "ok": bool}
    ok=False ⇒ aucun canal n'a passé → le notifier ne persiste pas l'envoi →
    retry au run suivant.
"""
from apps.api.app.core.config import settings
from apps.api.app.modules.notifications.email_sender import (
    email_configure,
    envoyer_email,
    valider_email,
)
from apps.api.app.modules.whatsapp.sender import envoyer_message_texte

SUJET_DEFAUT = "LAWOL.mr — notification"


def whatsapp_configure() -> bool:
    """Token Meta + ID de numéro WhatsApp disponibles ? (sans connexion)."""
    return bool(settings.META_WHATSAPP_TOKEN and settings.META_PHONE_NUMBER_ID)


def envoyer_notification(
    profil: dict,
    texte: str,
    *,
    sujet: str = SUJET_DEFAUT,
    envoi_whatsapp=None,
) -> dict:
    """Notifie UN profil sur le premier canal disponible.

    - WhatsApp : tenté si le profil a un téléphone et que le token Meta est
      dispo — ou si un envoi factice est injecté (`envoi_whatsapp`, preuve
      hors-ligne : signature (telephone, texte)).
    - Email : repli UNIQUEMENT, si le WhatsApp a échoué/était indisponible et
      que le profil porte une adresse valide avec un SMTP configuré.
    """
    profil = profil or {}
    telephone = str(profil.get("telephone") or "").strip()
    adresse = str(profil.get("email") or "").strip()

    # 1. Canal principal — WhatsApp
    whatsapp_ok = False
    if telephone and (envoi_whatsapp is not None or whatsapp_configure()):
        envoi = envoi_whatsapp or envoyer_message_texte
        try:
            envoi(telephone, texte)
            whatsapp_ok = True
        except Exception as exc:  # noqa: BLE001 — canal down → repli email
            print(f"⚠️ WhatsApp en échec ({telephone}) : {exc}")

    # 2. Repli — email (jamais si WhatsApp a réussi : zéro doublon)
    email_ok = False
    if not whatsapp_ok and adresse and valider_email(adresse):
        if email_configure():
            try:
                envoyer_email(adresse, sujet, texte)
                email_ok = True
            except Exception as exc:  # noqa: BLE001 — échec → ok=False → retry
                print(f"⚠️ email en échec ({adresse}) : {exc}")
        else:
            print("ℹ️ SMTP non configuré — repli email impossible")

    return {"whatsapp": whatsapp_ok, "email": email_ok, "ok": whatsapp_ok or email_ok}
