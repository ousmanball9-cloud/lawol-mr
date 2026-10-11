"""Code PIN client : validation + hash PBKDF2 (jamais stocké en clair).

Le hash vit dans profils.metadata['code_pin_hash'] (jsonb, zéro migration) au
format ``pbkdf2_sha256$<itérations>$<sel_hex>$<digest_hex>``.
Comparaisons toujours en `hmac.compare_digest` (temps constant) — jamais naive.
"""

import hashlib
import hmac
import re
import secrets

_ALGO = "pbkdf2_sha256"
_ITERATIONS = 200_000
_PATTERN = re.compile(r"^\d{4,6}$")


def pin_valide(code: str | None) -> bool:
    """4 à 6 chiffres exactement (aucune autre caractère accepté)."""
    return bool(code) and bool(_PATTERN.fullmatch(code))


def hasher_pin(code: str) -> str:
    """Hash PBKDF2-HMAC-SHA256 avec sel aléatoire → chaîne stockable en jsonb."""
    if not pin_valide(code):
        raise ValueError("Code PIN invalide : 4 à 6 chiffres attendus")
    sel = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", code.encode("utf-8"), bytes.fromhex(sel), _ITERATIONS
    ).hex()
    return f"{_ALGO}${_ITERATIONS}${sel}${digest}"


def verifier_pin(code: str | None, hash_stoque: str | None) -> bool:
    """Vérifie un PIN contre le hash stocké (comparaison à temps constant)."""
    if not pin_valide(code) or not hash_stoque or not isinstance(hash_stoque, str):
        return False
    try:
        algo, iterations, sel, digest = hash_stoque.split("$")
        if algo != _ALGO:
            return False
        candidat = hashlib.pbkdf2_hmac(
            "sha256", code.encode("utf-8"), bytes.fromhex(sel), int(iterations)
        ).hex()
    except (ValueError, TypeError):
        # Hash corrompu dans metadata → refus net, jamais d'erreur 500
        return False
    return hmac.compare_digest(candidat, digest)
