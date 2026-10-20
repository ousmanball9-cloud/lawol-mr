"""Garde d'administration v1 — définition UNIQUE, partagée par les routes admin.

Fonction extraite **à l'identique** de ``modules/entreprises/routes.py`` (mêmes
messages, même comportement) au moment où le module entreprises est devenu
inimportable — il importe des modèles archivés depuis le passage « 100 %
bourses » (commit d884e2f), donc plus aucune route ne peut réutiliser sa garde
tant qu'elle vit là-bas. Elle vit désormais ici et les trois consommateurs
pointent sur cette seule définition :

  · ``apps/api/app/modules/parametres/routes.py`` (réglages + stats visites) ;
  · ``apps/api/app/main.py`` (4 tâches de maintenance : scraper, matching,
    notifications, rappels J-12 / J-3) ;
  · ``apps/api/app/modules/entreprises/routes.py`` (file de validation, à
    réactiver le jour où ce module redeviendra importable).

Comportement : cookie de session posé par ``/api/admin/login``, ou token admin
(égal au hash du mot de passe admin) via ``?token=``, ``x-admin-token`` ou
``Authorization: Bearer …``.

Le cookie n'est **plus** une constante publique : c'est une valeur DÉRIVÉE du
secret serveur, ``sha256("lawol-admin|" + ADMIN_PASSWORD_HASH)`` en hexadécimal,
que seul le serveur peut calculer (formule identique côté Next dans
``apps/web/app/api/admin/login/route.ts``). La constante ``"authenticated"``
— écrite en clair dans le code, donc rejouable par n'importe qui (200 mesuré en
prod le 20/10/2026) — n'est plus JAMAIS acceptée.

  - rien d'identifié                        → 401 (authentification requise)
  - identifié mais faux (cookie ou token)   → 403 (identifiants invalides)
"""

import hashlib
import secrets

from apps.api.app.core.config import settings
from fastapi import HTTPException, Request

# Préfixe de dérivation du cookie (identique côté Next, ne pas modifier seul).
PREFIXE_COOKIE = "lawol-admin|"


def cookie_admin_attendu() -> str:
    """Valeur attendue du cookie ``lawol_admin`` : dérivée du secret serveur.

    Sans ``ADMIN_PASSWORD_HASH`` configuré, la valeur serait publiquement
    calculable (``sha256("lawol-admin|")``) : on renvoie alors une chaîne vide,
    que le cookie ne peut jamais égaler (``compare_digest`` sur vide = refus,
    géré explicitement par l'appelant).
    """
    if not settings.ADMIN_PASSWORD_HASH:
        return ""
    return hashlib.sha256(
        (PREFIXE_COOKIE + settings.ADMIN_PASSWORD_HASH).encode("utf-8")
    ).hexdigest()


def _admin_autorise(request: Request) -> None:
    """Protection admin (v1, identique à la philosophie web) : token admin (hash
    du mot de passe admin), ou cookie de session dérivé posé par
    /api/admin/login.

    - rien d'identifié  -> 401 (authentification requise)
    - identifié mais faux (cookie ou token) -> 403 (identifiants invalides)
    """
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

    cookie = request.cookies.get("lawol_admin")
    if cookie is not None:
        attendu = cookie_admin_attendu()
        if attendu and secrets.compare_digest(cookie, attendu):
            return
        raise HTTPException(403, "Cookie d'administration invalide")

    raise HTTPException(401, "Authentification admin requise (cookie lawol_admin ou token)")
