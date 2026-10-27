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

Stratégie email (ordre de fallback) :
    1. SMTP (port configuré 587 STARTTLS)
    2. SMTP fallback (port 465 SSL implicite)
    3. API HTTP (Brevo/SendGrid via HTTPS 443) — fonctionne sur Railway

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
from apps.api.app.modules.notifications.email_sender_api import (
    email_api_configure,
    envoyer_email_api,
)
from apps.api.app.modules.whatsapp.sender import envoyer_message_texte

SUJET_DEFAUT = "LAWOL.mr — notification"


def whatsapp_configure() -> bool:
    """Token Meta + ID de numéro WhatsApp disponibles ? (sans connexion)."""
    return bool(settings.META_WHATSAPP_TOKEN and settings.META_PHONE_NUMBER_ID)


def _envoyer_email_avec_repli(adresse: str, sujet: str, texte: str) -> bool:
    """Envoie un email : SMTP d'abord, API HTTP en repli. `True` si un canal passe.

    Extraction de la branche email historique (aucun changement de
    comportement) pour que le résumé hebdomadaire réutilise EXACTEMENT la même
    stratégie de repli au lieu d'en réécrire une deuxième, qui divergerait.
    """
    # 1. SMTP (avec fallback 465 interne à `email_sender`)
    if email_configure():
        try:
            envoyer_email(adresse, sujet, texte)
            return True
        except Exception as exc:  # noqa: BLE001
            print(f"⚠️ SMTP email en échec ({adresse}) : {exc}")
    else:
        print("ℹ️ SMTP non configuré — tentative API email...")

    # 2. API HTTP (Brevo/SendGrid) si SMTP a échoué ou n'est pas configuré
    print("🔍 DEBUG canal: email_ok=False, checking email_api_configure()...")
    if email_api_configure():
        try:
            envoyer_email_api(adresse, sujet, texte)
            print(f"✅ Email envoyé via API ({adresse})")
            return True
        except Exception as exc:  # noqa: BLE001
            print(f"⚠️ API email en échec ({adresse}) : {exc}")
    else:
        print("ℹ️ Aucun canal email configuré (ni SMTP ni API)")
    return False


def envoyer_email_profil(
    profil: dict, texte: str, *, sujet: str = SUJET_DEFAUT
) -> dict:
    """Envoie UN profil par EMAIL uniquement (jamais WhatsApp).

    Utilisé par le résumé hebdomadaire : un récapitulatif de semaine se lit et
    se garde, ce n'est pas un message instantané. Le destinataire vient
    toujours du profil (aucun relais ouvert) et l'adresse est validée.

    Contrat : `{"email": bool, "ok": bool, "raison": str}` — `raison` explique
    un refus (adresse absente/invalide) pour que l'appelant distingue « pas
    d'adresse » d'une « panne d'envoi ».
    """
    adresse = str((profil or {}).get("email") or "").strip()
    if not adresse:
        return {"email": False, "ok": False, "raison": "adresse absente"}
    if not valider_email(adresse):
        return {"email": False, "ok": False, "raison": "adresse invalide"}
    ok = _envoyer_email_avec_repli(adresse, sujet, texte)
    return {"email": ok, "ok": ok, "raison": "" if ok else "aucun canal email"}


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
      que le profil porte une adresse valide.
      Ordre de fallback email :
        1. SMTP (port configuré + fallback 465 auto dans email_sender)
        2. API HTTP (Brevo/SendGrid via HTTPS 443) — Railway-friendly
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
        email_ok = _envoyer_email_avec_repli(adresse, sujet, texte)

    return {"whatsapp": whatsapp_ok, "email": email_ok, "ok": whatsapp_ok or email_ok}
