"""Envoi d'email via API HTTP (Brevo / SendGrid) — fallback Railway quand SMTP bloqué.

Configuration variables d'environnement :
    EMAIL_API_PROVIDER    "brevo" | "sendgrid" (défaut: brevo)
    EMAIL_API_KEY         clé API (ex: xkeysib-xxx pour Brevo)
    EMAIL_FROM            adresse expéditeur (doit être validée chez le provider)
    EMAIL_FROM_NAME       nom affiché (défaut "LAWOL.mr")

Avantages sur Railway :
- HTTPS 443 toujours ouvert (pas de blocage port SMTP)
- Pas de connexion TCP persistante = pas de timeout réseau
- Délivrabilité gérée par le provider
- Logs et tracking inclus

Usage : importé par canal.py comme fallback ultime si SMTP échoue.
"""
import os
import json
import urllib.request
import urllib.error
from email.utils import formataddr
import re

# Config
API_TIMEOUT_S = 10
NOM_EXPEDITEUR_DEFAUT = "LAWOL.mr"

_REGEX_EMAIL = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def _provider() -> str:
    return (os.getenv("EMAIL_API_PROVIDER") or "brevo").strip().lower()


def _api_key() -> str:
    return os.getenv("EMAIL_API_KEY") or ""


def valider_email(adresse) -> bool:
    if not adresse:
        return False
    return bool(_REGEX_EMAIL.match(str(adresse).strip()))


def email_api_configure() -> bool:
    """API email exploitable ? (clé + expéditeur — sans connexion)."""
    return bool(_api_key().strip() and valider_email(os.getenv("EMAIL_FROM")))


def _envoyer_brevo(destinataire: str, sujet: str, corps: str, expediteur: str, nom: str) -> dict:
    """Envoi via Brevo API (https://api.brevo.com/v3/smtp/email)."""
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": _api_key(),
        "content-type": "application/json",
    }
    payload = {
        "sender": {"name": nom, "email": expediteur},
        "to": [{"email": destinataire}],
        "subject": sujet,
        "textContent": corps,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=API_TIMEOUT_S) as resp:
        if resp.status >= 400:
            raise RuntimeError(f"Brevo API error {resp.status}: {resp.read().decode()}")
        return json.loads(resp.read().decode())


def _envoyer_sendgrid(destinataire: str, sujet: str, corps: str, expediteur: str, nom: str) -> dict:
    """Envoi via SendGrid API (https://api.sendgrid.com/v3/mail/send)."""
    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }
    payload = {
        "personalizations": [{"to": [{"email": destinataire}], "subject": sujet}],
        "from": {"email": expediteur, "name": nom},
        "content": [{"type": "text/plain", "value": corps}],
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=API_TIMEOUT_S) as resp:
        if resp.status >= 400:
            raise RuntimeError(f"SendGrid API error {resp.status}: {resp.read().decode()}")
        return {"status": resp.status}


def envoyer_email_api(destinataire: str, sujet: str, corps: str) -> dict:
    """Envoie un email via API HTTP (Brevo par défaut, SendGrid si configuré).

    Fallback ultime quand SMTP est bloqué (Railway, cloud, etc.).
    Lève ValueError si destinataire invalide, RuntimeError si config manquante
    ou erreur réseau/API → retry au run suivant du notifier.
    """
    cible = str(destinataire or "").strip()
    if not valider_email(cible):
        raise ValueError(f"destinataire email invalide : {destinataire!r}")

    if not email_api_configure():
        raise RuntimeError("EMAIL_API_KEY ou EMAIL_FROM manquant — API email non configurée")

    expediteur = (os.getenv("EMAIL_FROM") or "").strip()
    nom = (os.getenv("EMAIL_FROM_NAME") or NOM_EXPEDITEUR_DEFAUT).strip()

    print(f"📧 Envoi email via API ({_provider().upper()}) vers {cible}...")

    try:
        if _provider() == "sendgrid":
            return _envoyer_sendgrid(cible, sujet, corps, expediteur, nom)
        else:
            return _envoyer_brevo(cible, sujet, corps, expediteur, nom)
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        raise RuntimeError(f"API email HTTP {e.code}: {body}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"API email réseau: {e.reason}") from e
    except Exception as e:
        raise RuntimeError(f"API email échec: {e}") from e


def _provider() -> str:
    return (os.getenv("EMAIL_API_PROVIDER") or "brevo").strip().lower()


# Config
API_TIMEOUT_S = 10
NOM_EXPEDITEUR_DEFAUT = "LAWOL.mr"