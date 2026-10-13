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
    try:
        if use_ssl:
            contexte = ssl.create_default_context()
            serveur = smtplib.SMTP_SSL(hote, port, timeout=timeout, context=contexte)
        else:
            serveur = smtplib.SMTP(hote, port, timeout=timeout)
        
        with serveur:
            if not use_ssl:
                serveur.ehlo()
                serveur.starttls()
                serveur.ehlo()
            if utilisateur and motdepasse:
                serveur.login(utilisateur, motdepasse)
            serveur.send_message(message)
        
        return {"destinataire": message["To"], "hote": hote, "port": port, "ssl": use_ssl}
    except Exception as e:
        # Log pour debug mais on ne propage pas ici - le caller gère le fallback
        print(f"🔍 DEBUG _essayer_smtp: {type(e).__name__}: {e} (port={port}, ssl={use_ssl})")
        raise


def envoyer_email(destinataire: str, sujet: str, corps: str) -> dict:
    """Envoie un email texte en clair au destinataire validé.

    Stratégie Railway-friendly :
    1. Essaie port configuré (587 STARTTLS par défaut)
    2. Si ÉCHEC QUELLE QU'EN SOIT LA RAISON (réseau, timeout, auth, etc.) → fallback 465 SSL
    3. Si fallback 465 échoue aussi → lève l'erreur pour retry
    
    Rationale : sur Railway, le port 587 est souvent bloqué (pas de sortie TCP).
    Le fallback doit être AGRESSIF - on essaie 465 dès que 587 échoue.
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

    # Tentative 1 : port configuré (587 STARTTLS)
    try:
        return _essayer_smtp(hote, port_config, use_ssl=False, expediteur=expediteur,
                             nom=nom, utilisateur=utilisateur, motdepasse=motdepasse,
                             message=message, timeout=SMTP_TIMEOUT_S)
    except Exception as e1:
        # LOG forcé pour Railway
        print(f"⚠️ SMTP {port_config} (STARTTLS) ÉCHEC: {type(e1).__name__}: {e1}")
        print(f"   → Tentative fallback 465 (SSL implicite)...")
        
        # Tentative 2 : fallback 465 SSL implicite - TOUJOURS essayé
        try:
            return _essayer_smtp(hote, SMTP_PORT_SSL, use_ssl=True, expediteur=expediteur,
                                 nom=nom, utilisateur=utilisateur, motdepasse=motdepasse,
                                 message=message, timeout=SMTP_TIMEOUT_S)
        except Exception as e2:
            print(f"❌ SMTP 465 (SSL) ÉCHEC aussi: {type(e2).__name__}: {e2}")
            # On lève la dernière erreur pour retry
            raise RuntimeError(f"Échec complet email: 587={e1} / 465={e2}") from e2
