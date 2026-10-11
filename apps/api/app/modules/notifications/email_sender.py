"""Envoi d'email transactionnel — stdlib uniquement (smtplib + email.message).

Filet de sécurité des notifications (brief bourses § Lot E : canal-agnostique).
WhatsApp reste le canal principal ; l'email rattrape ce que WhatsApp rate.

Configuration — 100 % variables d'environnement, aucun secret en dur :
    SMTP_HOST       hôte SMTP (ex. smtp.gmail.com) — obligatoire
    SMTP_PORT       port (défaut 587 → STARTTLS)
    SMTP_USER       identifiant SMTP (optionnel si relayage autorisé)
    SMTP_PASSWORD   mot de passe SMTP → uniquement dans .env (jamais committé)
    EMAIL_FROM      adresse d'expéditeur — obligatoire (doit être valide)
    EMAIL_FROM_NAME nom affiché (défaut « LAWOL.mr »)

Sécurité anti-relais ouvert :
    - le destinataire est VALIDÉ au format avant toute connexion ;
    - aucun Cc/Bcc, aucun destinataire externe à l'appel (l'adresse vient du
      profil concerné ou d'une saisie explicite — scripts/test-email.py) ;
    - l'échec LÈVE une exception → le dispatch (canal.py) n'enregistre pas
      l'envoi → retry au run suivant du notifier.
"""
import os
import re
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

# Limites : connexion SMTP bornée (jamais d'attente infinie en prod)
SMTP_TIMEOUT_S = 10
SMTP_PORT_DEFAUT = 587
NOM_EXPEDITEUR_DEFAUT = "LAWOL.mr"

# Format raisonnable (local@domaine.tld) — filtre grossier anti-abus, pas
# une RFC 5322 complète : on valide ce qu'on envoie, on ne relaye rien d'autre.
_REGEX_EMAIL = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def valider_email(adresse) -> bool:
    """True si l'adresse a un format exploitable (aucune connexion réseau)."""
    if not adresse:
        return False
    return bool(_REGEX_EMAIL.match(str(adresse).strip()))


def email_configure() -> bool:
    """SMTP exploitable ? (hôte + expéditeur — vérification sans connexion)."""
    return bool(
        (os.getenv("SMTP_HOST") or "").strip() and valider_email(os.getenv("EMAIL_FROM"))
    )


def envoyer_email(destinataire: str, sujet: str, corps: str) -> dict:
    """Envoie un email texte en clair au destinataire validé.

    - STARTTLS systématique, timeout 10 s ;
    - lève ValueError si le destinataire est invalide (avant toute connexion) ;
    - lève RuntimeError si la config manque, OSError/smtplib sur échec réseau ;
      ces exceptions remontent au dispatch pour déclencher un retry.
    """
    cible = str(destinataire or "").strip()
    if not valider_email(cible):
        raise ValueError(f"destinataire email invalide : {destinataire!r}")

    hote = (os.getenv("SMTP_HOST") or "").strip()
    if not hote:
        raise RuntimeError("SMTP_HOST non configuré — envoi email impossible")

    brut_port = (os.getenv("SMTP_PORT") or str(SMTP_PORT_DEFAUT)).strip()
    try:
        port = int(brut_port)
    except ValueError as exc:
        raise RuntimeError(f"SMTP_PORT invalide : {brut_port!r}") from exc

    expediteur = (os.getenv("EMAIL_FROM") or "").strip()
    if not valider_email(expediteur):
        raise RuntimeError("EMAIL_FROM absent ou invalide — expéditeur obligatoire")

    nom = (os.getenv("EMAIL_FROM_NAME") or NOM_EXPEDITEUR_DEFAUT).strip()
    utilisateur = (os.getenv("SMTP_USER") or "").strip()
    motdepasse = os.getenv("SMTP_PASSWORD") or ""

    message = EmailMessage()
    message["From"] = formataddr((nom, expediteur))
    message["To"] = cible  # seule adresse du message — pas de Cc/Bcc
    message["Subject"] = sujet or "Notification LAWOL.mr"
    message.set_content(corps)

    with smtplib.SMTP(hote, port, timeout=SMTP_TIMEOUT_S) as serveur:
        serveur.ehlo()
        serveur.starttls()
        serveur.ehlo()
        if utilisateur and motdepasse:
            serveur.login(utilisateur, motdepasse)
        serveur.send_message(message)  # destinataires dérivés de To uniquement

    return {"destinataire": cible, "hote": hote, "port": port}
