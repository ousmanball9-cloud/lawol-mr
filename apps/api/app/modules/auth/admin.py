"""Garde d'administration v1 — définition UNIQUE, partagée par les routes admin.

Fonction extraite **à l'identique** de ``modules/entreprises/routes.py`` (mêmes
messages, même comportement) au moment où le module entreprises est devenu
inimportable — il importe des modèles archivés depuis le passage « 100 %
bourses » (commit d884e2f), donc plus aucune route ne peut réutiliser sa garde
tant qu'elle vit là-bas. Elle vit désormais ici et les deux consommateurs
pointent sur cette seule définition :

  · ``apps/api/app/modules/parametres/routes.py`` (réglages + stats visites) ;
  · ``apps/api/app/modules/entreprises/routes.py`` (file de validation, à
    réactiver le jour où ce module redeviendra importable).

Comportement (inchangé) : cookie de session posé par ``/api/admin/login``, ou
token admin (égal au hash du mot de passe admin) via ``?token=``,
``x-admin-token`` ou ``Authorization: Bearer …``.

  - rien d'identifié                        → 401 (authentification requise)
  - identifié mais faux (cookie ou token)   → 403 (identifiants invalides)
"""

import secrets

from apps.api.app.core.config import settings
from fastapi import HTTPException, Request


def _admin_autorise(request: Request) -> None:
    """Protection admin (v1, identique à la philosophie web) : cookie de session
    posé par /api/admin/login, ou token admin (hash du mot de passe admin).

    - rien d'identifié  -> 401 (authentification requise)
    - identifié mais faux (cookie ou token) -> 403 (identifiants invalides)
    """
    cookie = request.cookies.get("lawol_admin")
    if cookie == "authenticated":
        return

    token = request.query_params.get("token") or request.headers.get("x-admin-token")
    if not token:
        autorisation = request.headers.get("authorization", "")
        if autorisation.lower().startswith("bearer "):
            token = autorisation[7:]

    if token:
        if settings.ADMIN_PASSWORD_HASH and secrets.compare_digest(
            token, settings.ADMIN_PASSWORD_HASH
        ):
            return
        raise HTTPException(403, "Token admin invalide")
    if cookie is not None:
        raise HTTPException(403, "Cookie d'administration invalide")
    raise HTTPException(401, "Authentification admin requise (cookie lawol_admin ou token)")
