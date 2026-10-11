"""Dépendances FastAPI : garde de session pour les endpoints mutants du profil."""

from apps.api.app.modules.auth.session import SessionNonConfiguree, verifier_token
from fastapi import Depends, Header, HTTPException


async def session_profil(authorization: str | None = Header(default=None)) -> str:
    """Téléphone porté par le token Bearer (401 si absent/invalide/expiré)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Connexion requise : token de session manquant")
    try:
        donnees = verifier_token(authorization[len("Bearer ") :].strip())
    except SessionNonConfiguree:
        raise HTTPException(
            503, "Session serveur non configurée (SESSION_SECRET manquant)"
        )
    if not donnees:
        raise HTTPException(401, "Session invalide ou expirée — reconnecte-toi")
    return donnees["telephone"]


def garde_profil(telephone: str, session: str = Depends(session_profil)) -> str:
    """Garde principal : token valide ET appartenant au téléphone de la ressource."""
    if session != telephone:
        raise HTTPException(403, "Ce profil ne t'appartient pas")
    return session
