"""Envoi d'email transactionnel — stdlib uniquement (smtplib + email.message).

Filet de sécurité des notifications (brief bourses § Lot E : canal-agnostique).
WhatsApp reste le canal principal ; l'email rattrape ce que WhatsApp rate.

Configuration — 100 % variables d'environnement, aucun secret en dur :
    SMTP_HOST       hôte SMTP (ex. smtp.gmail.com) — obligatoire
    SMTP_PORT       port (défaut 587 → STARTTLS, ou 465 → SSL implicite)
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

Note Railway : port 587 (STARTTLS) souvent bloqué → fallback auto sur 465 (SSL).
"""
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

# Limites : connexion SMTP bornée (jamais d'attente infinie en prod)
SMTP_TIMEOUT_S = 10
SMTP_PORT_DEFAUT = 587
SMTP_PORT_SSL = 465
NOM_EXPEDITEUR_DEFAUT = "LAWOL.mr"

# Format raisonnable (local@domaine.tld) — filtre grossier anti-abus, pas
# une RFC 5332 complète : on valide ce qu'on envoie, on ne relaye rien d'autre.
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


def _essayer_smtp(hote: str, port: int, use_ssl: bool, expediteur: str, nom: str,
                  utilisateur: str, motdepasse: str, message: EmailMessage,
                  timeout: int) -> dict:
    """Tente une connexion SMTP (STARTTLS ou SSL implicite)."""
    if use_ssl:
        contexte = ssl.create_default_context()
        with smtplib.SMTP_SSL(hote, port, timeout=timeout, context=contexte) as serveur:
            if utilisateur and motdepasse:
                serveur.login(utilisateur, motdepasse)
            serveur.send_message(message)
    else:
        with smtplib.SMTP(hote, port, timeout=timeout) as serveur:
            serveur.ehlo()
            serveur.starttls()
            serveur.ehlo()
            if utilisateur and motdepasse:
                serveur.login(utilisateur, motdepasse)
            serveur.send_message(message)
    return {"destinataire": message["To"], "hote": hote, "port": port, "ssl": use_ssl}


def envoyer_email(destinataire: str, sujet: str, corps: str) -> dict:
    """Envoie un email texte en clair au destinataire validé.

    - Essaie d'abord le port configuré (587 STARTTLS par défaut)
    - Si échec réseau → fallback auto sur 465 (SSL implicite)
    - Lève ValueError si destinataire invalide (avant toute connexion)
    - Lève RuntimeError si config manquante, OSError/smtplib sur échec réseau
      → ces exceptions remontent au dispatch pour déclencher un retry.
    """
    cible = str(destinataire or "").strip()
    if not valider_email(cible):
        raise ValueError(f"destinataire email invalide : {destinataire!r}")

    hote = (os.getenv("SMTP_HOST") or "").strip()
    if not hote:
        raise RuntimeError("SMTP_HOST non configuré — envoi email impossible")

    # Port configuré (défaut 587)
    brut_port = (os.getenv("SMTP_PORT") or str(SMTP_PORT_DEFAUT)).strip()
    try:
        port_config = int(brut_port)
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

    # 1. Tentative port configuré (STARTTLS)
    try:
        return _essayer_smtp(hote, port_config, use_ssl=False, expediteur=expediteur,
                             nom=nom, utilisateur=utilisateur, motdepasse=motdepasse,
                             message=message, timeout=SMTP_TIMEOUT_S)
    except Exception as e:
        print(f"🔍 DEBUG envoyer_email: exception type={type(e).__name__}, errno={getattr(e, 'errno', None)}, msg={e}")
        # Si erreur réseau (pas auth) → fallback 465 SSL
        if isinstance(e, OSError) and e.errno in (101, 110, 111, 113):  # Network unreachable, timeout, connection refused, no route
            print(f"⚠️ SMTP {port_config} injoignable ({e}) → fallback 465 SSL")
            try:
                return _essayer_smtp(hote, SMTP_PORT_SSL, use_ssl=True, expediteur=expediteur,
                                     nom=nom, utilisateur=utilisateur, motdepasse=motdepasse,
                                     message=message, timeout=SMTP_TIMEOUT_S)
            except Exception as e2:
                raise RuntimeError(f"Échec SMTP {port_config} + fallback 465 : {e2}") from e2
        # Autre erreur (auth, etc.) → on propage
        raise
