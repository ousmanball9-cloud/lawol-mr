"""Session client : token signé HMAC-SHA256, sans aucun canal externe.

Payload = ``{"tel": "...", "exp": <epoch>}`` encodé base64url, signature =
HMAC-SHA256 du payload codé, clé = ``SESSION_SECRET`` (env, ≥32 caractères,
voir lawol-mr/.env en local — jamais committé). Le token part en
``Authorization: Bearer`` sur les endpoints mutants du profil.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

# Import à effet de bord : charge lawol-mr/.env dans os.environ (load_dotenv)
from apps.api.app.core.config import settings as _settings  # noqa: F401

# Nom du cookie partagé avec le middleware Next.js (lecture seule côté front)
NOM_COOKIE = "lawol_token"

DUREE_PAR_DEFAUT_MINUTES = 60 * 24 * 7  # 7 jours
_SECRET_MIN = 32
_DUREE_MIN_MINUTES = 5


class SessionNonConfiguree(Exception):
    """SESSION_SECRET absent ou trop court : impossible de signer/vérifier."""


def duree_session_minutes() -> int:
    """Durée de validité du token (SESSION_EXPIRE_MINUTES, défaut 7 jours)."""
    brut = os.environ.get("SESSION_EXPIRE_MINUTES", "").strip()
    try:
        return max(_DUREE_MIN_MINUTES, int(brut)) if brut else DUREE_PAR_DEFAUT_MINUTES
    except ValueError:
        return DUREE_PAR_DEFAUT_MINUTES


def _secret() -> str:
    """Clé HMAC tirée uniquement de l'environnement — zéro secret en dur."""
    secret = os.environ.get("SESSION_SECRET", "").strip()
    if len(secret) < _SECRET_MIN:
        raise SessionNonConfiguree(
            "SESSION_SECRET absent ou trop court (min 32 caractères) : "
            "ajoute-le dans lawol-mr/.env (local) ou dans les variables Railway/Vercel"
        )
    return secret


def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _deb64u(texte: str) -> bytes:
    return base64.urlsafe_b64decode(texte + "=" * (-len(texte) % 4))


def _signature(payload_code: str) -> str:
    mac = hmac.new(
        _secret().encode("utf-8"), payload_code.encode("utf-8"), hashlib.sha256
    ).digest()
    return _b64u(mac)


def creer_token(telephone: str) -> tuple[str, int]:
    """(token signé, expiration epoch) pour un téléphone donné."""
    expiration = int(time.time()) + duree_session_minutes() * 60
    payload = _b64u(
        json.dumps({"tel": telephone, "exp": expiration}, separators=(",", ":")).encode(
            "utf-8"
        )
    )
    return f"{payload}.{_signature(payload)}", expiration


def verifier_token(token: str | None) -> dict | None:
    """Payload décodé si signature ET expiration valides, sinon None."""
    if not token or token.count(".") != 1:
        return None
    payload_code, signature = token.split(".")
    if not payload_code or not signature:
        return None
    if not hmac.compare_digest(signature, _signature(payload_code)):
        return None
    try:
        donnees = json.loads(_deb64u(payload_code))
    except (ValueError, TypeError):
        return None
    if not isinstance(donnees, dict):
        return None
    telephone, expiration = donnees.get("tel"), donnees.get("exp")
    if not isinstance(telephone, str) or not isinstance(expiration, (int, float)):
        return None
    if expiration < time.time():
        return None
    return {"telephone": telephone, "exp": int(expiration)}
