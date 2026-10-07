"""Vérification de signature Meta (X-Hub-Signature-256).

Meta signe chaque POST avec HMAC-SHA256 du body, clé = META_APP_SECRET.
On vérifie avant de traiter — sinon n'importe qui peut falsifier des messages.
"""
import hashlib
import hmac

from apps.api.app.core.config import settings


def verifier_signature(body_bytes: bytes, signature_recue: str | None) -> bool:
    """Retourne True si la signature est valide (ou absente en dev)."""
    if not settings.META_APP_SECRET:
        # Pas de secret configuré = pas de vérification possible (dev seul)
        return True
    if not signature_recue or not signature_recue.startswith("sha256="):
        return False
    attendu = "sha256=" + hmac.new(
        settings.META_APP_SECRET.encode(),
        body_bytes,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(attendu, signature_recue)
