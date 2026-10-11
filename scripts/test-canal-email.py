# -*- coding: utf-8 -*-
"""Preuve MOCKÉE du dispatch canal-agnostique (Lot E) — zéro réseau, zéro cred.

Patch : smtplib.SMTP → FauxSMTP (jamais de connexion réelle) et
canal.envoyer_message_texte / canal.whatsapp_configure → factices.

Prouve :
  1. WhatsApp OK  → {whatsapp: True, email: False, ok: True} et SMTP intouché ;
  2. WhatsApp KO  → repli email réellement construit (To = email du profil,
                     From/Subject, STARTTLS, login SMTP_*, timeout 10 s,
                     aucun Cc/Bcc → pas de relais ouvert) ;
  3. WhatsApp indisponible (token Meta absent) → sender jamais appelé, email ;
  4. WhatsApp KO sans email → {False, False, False} (retry côté notifier) ;
  5. email invalide → jamais de tentative de connexion ;
  6. SMTP en échec → ok=False (le notifier n'enregistre pas → retry) ;
  7. injection envoi_whatsapp → WhatsApp seul, zéro email (chemin preuve) ;
  8. validation des adresses (valider_email / envoyer_email avant connexion).

Usage : python -X utf8 scripts/test-canal-email.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import os
import sys
from email.utils import formataddr
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))

from apps.api.app.modules.notifications import canal, email_sender  # noqa: E402

# --- Config SMTP factice (valeurs bidon — aucun secret réel) --------------
os.environ.update(
    {
        "SMTP_HOST": "smtp.test.local",
        "SMTP_PORT": "587",
        "SMTP_USER": "user-test",
        "SMTP_PASSWORD": "bidon-non-utilise",
        "EMAIL_FROM": "no-reply@lawol.test",
        "EMAIL_FROM_NAME": "LAWOL (test)",
    }
)

_checks: list[tuple[bool, str]] = []


def check(ok: bool, libelle: str) -> None:
    _checks.append((bool(ok), libelle))
    print(f"  [{'OK' if ok else 'KO'}] {libelle}")


class FauxSMTP:
    """SMTP simulé : aucune connexion réseau, tout est enregistré."""

    instances: list = []
    echec = False

    def __init__(self, hote, port, timeout=None):
        self.hote = hote
        self.port = port
        self.timeout = timeout
        self.tls = False
        self.identifiants = None
        self.messages = []
        FauxSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def ehlo(self):
        pass

    def starttls(self):
        self.tls = True

    def login(self, utilisateur, motdepasse):
        self.identifiants = (utilisateur, motdepasse)

    def send_message(self, message):
        if FauxSMTP.echec:
            raise OSError("SMTP simulé en échec")
        self.messages.append(message)


# --- Patchs -----------------------------------------------------------------
SMTP_REEL = email_sender.smtplib.SMTP
email_sender.smtplib.SMTP = FauxSMTP

WA_APPELS: list[tuple[str, str]] = []
WA_ERREUR: list[Exception] = []


def wa_ok(telephone: str, texte: str) -> dict:
    WA_APPELS.append((telephone, texte))
    return {"id": "factice"}


def wa_ko(telephone: str, texte: str) -> dict:
    WA_APPELS.append((telephone, texte))
    raise RuntimeError("token Meta invalide (simulé)")


def _reset(**kwargs):
    """Remet les compteurs à zéro et applique les patchs de canal."""
    WA_APPELS.clear()
    FauxSMTP.instances.clear()
    FauxSMTP.echec = False
    canal.envoyer_message_texte = kwargs.get("envoi_whatsapp", wa_ok)
    canal.whatsapp_configure = kwargs.get("whatsapp_configure", lambda: True)


def dernier_message():
    if not FauxSMTP.instances or not FauxSMTP.instances[-1].messages:
        return None, None
    s = FauxSMTP.instances[-1]
    return s, s.messages[-1]


# --- Cas 1 : WhatsApp OK → aucun email --------------------------------------
print("\n=== Cas 1 : WhatsApp disponible et réussi ===")
_reset()
r = canal.envoyer_notification({"telephone": "22290000001"}, "Bonjour !")
print(f"  resultat={r}  appelWA={len(WA_APPELS)}  SMTP={len(FauxSMTP.instances)}")
check(r == {"whatsapp": True, "email": False, "ok": True}, "WhatsApp OK → ok=True, email=False")
check(len(WA_APPELS) == 1, "WhatsApp appelé une seule fois")
check(len(FauxSMTP.instances) == 0, "SMTP jamais ouvert quand WhatsApp réussit (zéro doublon)")

# --- Cas 2 : WhatsApp KO → repli email --------------------------------------
print("\n=== Cas 2 : WhatsApp KO → repli email ===")
_reset(envoi_whatsapp=wa_ko)
profil = {"telephone": "22290000001", "email": "etudiant@exemple.mr"}
r = canal.envoyer_notification(profil, "Plus que 3 jours pour postuler !")
serveur, msg = dernier_message()
print(f"  resultat={r}  SMTP={len(FauxSMTP.instances)}")
check(r == {"whatsapp": False, "email": True, "ok": True}, "WhatsApp KO → repli email ok=True")
check(msg is not None, "un message email a été construit (SMTP simulé)")
check(msg is not None and msg["To"] == "etudiant@exemple.mr", "To = email du profil UNIQUEMENT")
check(
    msg is not None
    and str(msg["From"]) == formataddr(("LAWOL (test)", "no-reply@lawol.test")),
    "From = EMAIL_FROM_NAME <EMAIL_FROM>",
)
check(msg is not None and msg["Subject"] == canal.SUJET_DEFAUT, "Subject = sujet par défaut")
check(
    msg is not None and "Plus que 3 jours" in msg.get_content(),
    "corps du message = texte de notification",
)
check(
    msg is not None and msg["Cc"] is None and msg["Bcc"] is None,
    "aucun Cc/Bcc → pas de relais ouvert",
)
check(serveur is not None and serveur.tls, "STARTTLS négocié")
check(serveur is not None and serveur.timeout == 10, "timeout SMTP = 10 s")
check(
    serveur is not None and serveur.identifiants == ("user-test", "bidon-non-utilise"),
    "login SMTP_USER / SMTP_PASSWORD (env, jamais en dur)",
)

# --- Cas 3 : token Meta absent → sender jamais appelé ----------------------
print("\n=== Cas 3 : WhatsApp non configuré (token absent) ===")
_reset(envoi_whatsapp=wa_ko, whatsapp_configure=lambda: False)
r = canal.envoyer_notification({"telephone": "22290000001", "email": "etu@exemple.mr"}, "Alerte")
check(r == {"whatsapp": False, "email": True, "ok": True}, "token absent → email pris en charge")
check(len(WA_APPELS) == 0, "sender WhatsApp jamais invoqué sans token Meta")

# --- Cas 4 : WhatsApp KO, pas d'email ---------------------------------------
print("\n=== Cas 4 : WhatsApp KO sans email sur le profil ===")
_reset(envoi_whatsapp=wa_ko)
r = canal.envoyer_notification({"telephone": "22290000001"}, "Message")
check(r == {"whatsapp": False, "email": False, "ok": False}, "aucun canal → ok=False (retry)")
check(len(FauxSMTP.instances) == 0, "aucune tentative SMTP sans email au profil")

# --- Cas 5 : email invalide → aucune connexion ------------------------------
print("\n=== Cas 5 : adresse email invalide ===")
_reset(envoi_whatsapp=wa_ko)
r = canal.envoyer_notification({"telephone": "22290000001", "email": "pas-un-email"}, "Message")
check(r == {"whatsapp": False, "email": False, "ok": False}, "email invalide ignoré → ok=False")
check(len(FauxSMTP.instances) == 0, "zéro connexion SMTP sur adresse invalide")

# --- Cas 6 : SMTP en échec → ok=False ---------------------------------------
print("\n=== Cas 6 : SMTP en échec (exception) ===")
_reset(envoi_whatsapp=wa_ko)
FauxSMTP.echec = True
r = canal.envoyer_notification(
    {"telephone": "22290000001", "email": "etu@exemple.mr"}, "Message"
)
check(r == {"whatsapp": False, "email": False, "ok": False}, "SMTP en échec → ok=False (retry)")
FauxSMTP.echec = False

# --- Cas 7 : injection d'envoi (chemin preuve) ------------------------------
print("\n=== Cas 7 : envoi_whatsapp injecté (hors-ligne) ===")
_reset()
r = canal.envoyer_notification(
    {"telephone": "22290000001", "email": "etu@exemple.mr"},
    "Preuve",
    envoi_whatsapp=wa_ok,
    sujet="Preuve",
)
check(r == {"whatsapp": True, "email": False, "ok": True}, "injection → WhatsApp seul, zéro email")
check(len(WA_APPELS) == 1, "l'envoi injecté est appelé une fois")

# --- Cas 8 : validation des adresses ---------------------------------------
print("\n=== Cas 8 : validation destinataire (anti relais) ===")
_reset()
check(email_sender.valider_email("a.b+c@exemple.mr"), "adresse valide acceptée")
check(not email_sender.valider_email("pas-un-email"), "adresse sans @ rejetée")
check(not email_sender.valider_email("x@localhost"), "domaine sans point rejeté")
check(not email_sender.valider_email(""), "adresse vide rejetée")
check(not email_sender.valider_email(None), "None rejeté")
avant = len(FauxSMTP.instances)
try:
    email_sender.envoyer_email("pas-un-email", "s", "c")
    check(False, "envoyer_email(adresse invalide) lève ValueError")
except ValueError:
    check(True, "envoyer_email(adresse invalide) lève ValueError")
check(len(FauxSMTP.instances) == avant, "ValueError AVANT toute connexion SMTP")

# SMTP non configuré → email_configure() False
os.environ.pop("SMTP_HOST", None)
check(not email_sender.email_configure(), "SMTP_HOST absent → email_configure() = False")
os.environ["SMTP_HOST"] = "smtp.test.local"

# --- Nettoyage des patchs ---------------------------------------------------
email_sender.smtplib.SMTP = SMTP_REEL


def main() -> int:
    ko = [lib for ok, lib in _checks if not ok]
    print(f"\n=== SYNTHESE : {len(_checks) - len(ko)}/{len(_checks)} checks OK ===")
    for lib in ko:
        print(f"  KO -> {lib}")
    return 1 if ko else 0


if __name__ == "__main__":
    raise SystemExit(main())
