"""Preuve MOCKÉE de la garde admin fermée (cookie dérivé) + des 4 tâches de
maintenance gardées (LAWOL.mr, FastAPI).

Contexte (failles P0 prouvées en prod le 20/10/2026) :
  1. `_admin_autorise` acceptait le cookie `lawol_admin == "authenticated"` —
     valeur CONSTANTE, écrite en clair dans le code, donc rejouable par
     n'importe qui (`curl -H "Cookie: lawol_admin=authenticated"` → 200 sur
     /api/v1/admin/stats/visites).
  2. `POST /api/v1/scraper/run`, `/matching/run`, `/notifications/run`,
     `/notifications/deadlines` n'avaient AUCUNE garde (POST anonyme →
     logique atteinte, offres insérées en prod).

Prouve (zéro réseau, zéro Supabase réel) :
   1. Ancien cookie `authenticated` REFUSÉ (403) partout — plus jamais accepté ;
   2. cookie DÉRIVÉ `sha256("lawol-admin|" + ADMIN_PASSWORD_HASH)` ACCEPTÉ ;
   3. token valide accepté (x-admin-token, Authorization Bearer, ?token=) :
      comportement inchangé ;
   4. token faux → 403, rien → 401 ;
   5. les 4 routes de maintenance refusent SANS identité (401) et avec une
      identité fausse (403) SANS exécuter la logique (compteurs à zéro) ;
   6. secret absent (`ADMIN_PASSWORD_HASH=""`) : le cookie dérivé serait
      publiquement calculable → aucun cookie accepté ;
   7. statique : `admin.py` ne compare plus jamais à la constante, `main.py`
      appelle la garde en PREMIÈRE instruction des 4 endpoints (vérifié par
      `ast`), le login Next calcule la même formule, le workflow envoie
      `x-admin-token` depuis `secrets.SCRAPER_TOKEN` (aucun secret en clair).

Usage : python -X utf8 scripts/test-garde-admin.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import ast
import hashlib
import os
import sys
import types
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)

# ----------------------- Faux Supabase (zéro réseau) --------------------------
# Aucune requête ne doit être émise : sur refus la logique n'est jamais atteinte,
# et sur acceptation les jobs sont remplacés par des compteurs.


class _FauxSupabase:
    def table(self, nom):  # pragma: no cover — jamais atteint dans ce harnais
        raise AssertionError(f"Supabase réel sollicité (table {nom!r})")


FAUX = _FauxSupabase()
_module_supabase = types.ModuleType("supabase")
_module_supabase.Client = object
_module_supabase.create_client = lambda url, key=None, **kwargs: FAUX
sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Application ---------------------------------
from fastapi.testclient import TestClient

from apps.api.app import main as main_module
from apps.api.app.core.config import settings
from apps.api.app.modules.auth import admin as module_admin
from apps.api.app.modules.whatsapp import notifier as module_notifier

# Identité admin de test : le token attendu est le hash configuré (jamais un
# secret réel) → preuve déterministe quel que soit le .env de la machine.
TOKEN_ADMIN = "hash-admin-de-test-bidon"
settings.ADMIN_PASSWORD_HASH = TOKEN_ADMIN
COOKIE_DERIVE = hashlib.sha256(("lawol-admin|" + TOKEN_ADMIN).encode("utf-8")).hexdigest()

client = TestClient(main_module.app)

# Compteurs : prouvent que la logique métier N'EST PAS atteinte sur refus.
APPELS = {"scraper": 0, "matching": 0, "notifications": 0, "deadlines": 0}


def _bombe(nom):
    def _f(*args, **kwargs):
        APPELS[nom] += 1
        if nom == "scraper":
            return []
        if nom == "matching":
            return {"examines": 0, "matches": 0, "ignores_deja": 0}
        return {"envois": 0}

    return _f


def _remettre_a_zero():
    for cle in APPELS:
        APPELS[cle] = 0


main_module.get_scrapers = _bombe("scraper")
main_module.run_matching_job = _bombe("matching")
module_notifier.run_notification_job = _bombe("notifications")
module_notifier.run_deadline_job = _bombe("deadlines")

ROUTES = [
    ("scraper", "/api/v1/scraper/run"),
    ("matching", "/api/v1/matching/run"),
    ("notifications", "/api/v1/notifications/run"),
    ("deadlines", "/api/v1/notifications/deadlines"),
]

ECHECS = []


def check(libelle, condition, detail=""):
    etat = "OK" if condition else "KO"
    print(f"  [{etat}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


def corps(r):
    try:
        return r.json()
    except ValueError:
        return {}


def ko(r):
    return f"{r.status_code} {str(corps(r))[:200]}"


def poste(url, **kwargs):
    return client.post(url, **kwargs)


# ============ 1. Cookie public « authenticated » : REFUSÉ partout =============
print("\n1. Ancien cookie lawol_admin=authenticated refusé (403, zéro exécution)")
for nom, url in ROUTES:
    _remettre_a_zero()
    r = poste(url, cookies={"lawol_admin": "authenticated"})
    check(f"POST {url} + cookie authenticated → 403", r.status_code == 403, ko(r))
    check(f"…logique {nom} NON exécutée", APPELS[nom] == 0, str(APPELS))

r = client.get("/api/v1/admin/stats/visites", cookies={"lawol_admin": "authenticated"})
check(
    "GET /api/v1/admin/stats/visites + cookie authenticated → 403",
    r.status_code == 403,
    ko(r),
)

# ============ 2. Cookie DÉRIVÉ : accepté ======================================
print("\n2. Cookie dérivé sha256(lawol-admin| + ADMIN_PASSWORD_HASH) accepté")
check(
    "formule identique côté API",
    module_admin.cookie_admin_attendu() == COOKIE_DERIVE,
    module_admin.cookie_admin_attendu(),
)
for nom, url in ROUTES:
    _remettre_a_zero()
    r = poste(url, cookies={"lawol_admin": COOKIE_DERIVE})
    check(f"POST {url} + cookie dérivé → 200", r.status_code == 200, ko(r))
    check(f"…logique {nom} exécutée (garde non bloquante)", APPELS[nom] == 1, str(APPELS))

# cookie dérivé d'un AUTRE secret → refusé
r = poste(
    ROUTES[0][1],
    cookies={"lawol_admin": hashlib.sha256(b"lawol-admin|autre-secret").hexdigest()},
)
check("cookie dérivé d'un autre secret → 403", r.status_code == 403, ko(r))

# ============ 3. Token admin : comportement INCHANGÉ =========================
print("\n3. Token admin valide accepté (3 transports), faux → 403, rien → 401")
_remettre_a_zero()
r = poste(ROUTES[0][1], headers={"x-admin-token": TOKEN_ADMIN})
check("x-admin-token valide → 200", r.status_code == 200, ko(r))
r = poste(ROUTES[1][1], headers={"Authorization": f"Bearer {TOKEN_ADMIN}"})
check("Authorization: Bearer valide → 200", r.status_code == 200, ko(r))
r = poste(f"{ROUTES[2][1]}?token={TOKEN_ADMIN}")
check("?token= valide → 200", r.status_code == 200, ko(r))
check(
    "les 3 transports acceptés",
    APPELS["scraper"] == 1 and APPELS["matching"] == 1 and APPELS["notifications"] == 1,
    str(APPELS),
)

# ============ 4. Refus (token faux / rien) sur les 4 routes ==================
print("\n4. Les 4 routes de maintenance refusent sans identité valide")
for nom, url in ROUTES:
    _remettre_a_zero()
    r = poste(url, headers={"x-admin-token": "mauvais-token"})
    check(f"POST {url} + token faux → 403", r.status_code == 403, ko(r))
    check(f"…logique {nom} NON exécutée", APPELS[nom] == 0, str(APPELS))
    r = poste(url)
    check(f"POST {url} sans rien → 401", r.status_code == 401, ko(r))
    check(f"…logique {nom} NON exécutée", APPELS[nom] == 0, str(APPELS))
    r = poste(url, cookies={"lawol_admin": "n-importe-quoi"})
    check(f"POST {url} + cookie bidon → 403", r.status_code == 403, ko(r))
    check(f"…logique {nom} NON exécutée", APPELS[nom] == 0, str(APPELS))

# ============ 5. Secret absent : aucun cookie accepté ========================
print("\n5. ADMIN_PASSWORD_HASH absent → aucun cookie accepté (jamais de dérivé public)")
settings.ADMIN_PASSWORD_HASH = ""
try:
    check(
        "cookie_admin_attendu() vide sans secret",
        module_admin.cookie_admin_attendu() == "",
        module_admin.cookie_admin_attendu(),
    )
    r = poste(ROUTES[0][1], cookies={"lawol_admin": COOKIE_DERIVE})
    check("cookie dérivé de l'ancien secret → 403", r.status_code == 403, ko(r))
    r = poste(
        ROUTES[0][1],
        cookies={"lawol_admin": hashlib.sha256(b"lawol-admin|").hexdigest()},
    )
    check(
        "cookie dérivé du secret VIDE → 403 (non calculable publiquement)",
        r.status_code == 403,
        ko(r),
    )
    r = poste(ROUTES[0][1], headers={"x-admin-token": TOKEN_ADMIN})
    check("token refusé aussi (secret absent) → 403", r.status_code == 403, ko(r))
    r = poste(ROUTES[0][1])
    check("sans rien → 401", r.status_code == 401, ko(r))
finally:
    settings.ADMIN_PASSWORD_HASH = TOKEN_ADMIN

# ============ 6. Statique : source réellement fermé ==========================
print("\n6. Contrôles statiques (source, ordre de la garde, formulaire, workflow)")
chemin_admin = RACINE / "apps" / "api" / "app" / "modules" / "auth" / "admin.py"
source_admin = chemin_admin.read_text(encoding="utf-8")
arbre_admin = ast.parse(source_admin)
comparaisons_constante = [
    n
    for n in ast.walk(arbre_admin)
    if isinstance(n, ast.Compare)
    and any(
        isinstance(c, ast.Constant) and c.value == "authenticated"
        for c in [n.left, *n.comparators]
    )
]
check(
    "admin.py ne compare plus le cookie à la constante publique",
    not comparaisons_constante,
    f"{len(comparaisons_constante)} comparaison(s) à 'authenticated'",
)
check(
    "admin.py dérive le cookie (hashlib.sha256)",
    "hashlib.sha256" in source_admin,
    "dérivation absente",
)
check(
    "admin.py compare en temps constant (compare_digest)",
    "secrets.compare_digest" in source_admin,
    "comparaison naïve",
)

source_main = (RACINE / "apps" / "api" / "app" / "main.py").read_text(encoding="utf-8")
arbre_main = ast.parse(source_main)
fonctions = {
    n.name: n
    for n in arbre_main.body
    if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
}
NOMS_ENDPOINTS = {
    "scraper": "trigger_scraper",
    "matching": "trigger_matching",
    "notifications": "trigger_notifications",
    "deadlines": "trigger_deadlines",
}
for nom, _ in ROUTES:
    attendu = NOMS_ENDPOINTS[nom]
    fonction = fonctions.get(attendu)
    if fonction is None:
        check(f"main.py contient {attendu}()", False, str(sorted(fonctions)))
        continue
    corps_fonction = list(fonction.body)
    # Ignorer la docstring (premier Expr constant d'une fonction).
    if (
        corps_fonction
        and isinstance(corps_fonction[0], ast.Expr)
        and isinstance(corps_fonction[0].value, ast.Constant)
        and isinstance(corps_fonction[0].value.value, str)
    ):
        corps_fonction = corps_fonction[1:]
    premiere = corps_fonction[0] if corps_fonction else None
    garde_en_tete = (
        isinstance(premiere, ast.Expr)
        and isinstance(premiere.value, ast.Call)
        and isinstance(premiere.value.func, ast.Name)
        and premiere.value.func.id == "_admin_autorise"
        and len(premiere.value.args) == 1
        and isinstance(premiere.value.args[0], ast.Name)
        and premiere.value.args[0].id == "request"
    )
    check(
        f"{attendu}() appelle _admin_autorise(request) en PREMIÈRE instruction",
        garde_en_tete,
        ast.dump(premiere) if premiere else "corps vide",
    )
    reception_request = any(
        isinstance(a.annotation, ast.Name) and a.annotation.id == "Request"
        for a in fonction.args.args
    )
    check(
        f"{attendu}() reçoit bien un Request",
        reception_request,
        "pas de paramètre Request",
    )

source_login = (
    RACINE / "apps" / "web" / "app" / "api" / "admin" / "login" / "route.ts"
).read_text(encoding="utf-8")
check(
    "login Next calcule le cookie dérivé (préfixe lawol-admin|)",
    '"lawol-admin|"' in source_login,
    "formule absente",
)
check(
    "login Next n'écrit plus la constante publique",
    '"authenticated"' not in source_login,
    "constante encore écrite",
)

workflow = (RACINE / ".github" / "workflows" / "scraper-cron.yml").read_text(
    encoding="utf-8"
)
check(
    "workflow envoie x-admin-token depuis secrets.SCRAPER_TOKEN",
    "x-admin-token: ${{ secrets.SCRAPER_TOKEN }}" in workflow,
    workflow.strip()[:200],
)
check(
    "workflow ne contient aucun secret en clair",
    TOKEN_ADMIN not in workflow and "authenticated" not in workflow,
    "valeur suspecte",
)

# --------------------------------- Bilan -------------------------------------
print(f"\n{'=' * 60}")
if ECHECS:
    print(f"RÉSULTAT : {len(ECHECS)} échec(s) → {ECHECS}")
    sys.exit(1)
print("RÉSULTAT : 100 % des checks sont VERTS (zéro réseau).")
