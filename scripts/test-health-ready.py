"""Preuve du readiness `GET /health/ready` — zéro réseau (Supabase simulé).

Contexte mesuré : `GET /health` (`apps/api/app/main.py`) répond **200 même quand
Supabase est en erreur** (le corps dit `database: "error"`, mais le statut HTTP
reste 200) et interroge la base à chaque probe. Un health-check Render branché
sur `/health` est donc un faux vert.

Décision : `/health` est INCHANGÉ au caractère près (Render pointe dessus), et la
vérité est ajoutée à côté :

    · base OK  -> 200 {"status": "ready",     "database": "ok"}
    · base KO  -> 503 {"status": "not_ready", "database": "error"}

Ce harnais prouve :
    1. base OK  : `/health/ready` = 200 + corps exact ;
    2. base KO  : `/health/ready` = 503 + corps exact (jamais 500) ;
    3. base KO  : exception inattendue -> 503 aussi (aucune exception non gérée) ;
    4. le corps 503 ne fuit aucun détail d'erreur (2 clés, rien d'autre) ;
    5. `/health` reste 200 dans les DEUX cas (comportement historique préservé) ;
    6. `/health` est inchangé au caractère près (empreinte SHA-256 du bloc source) ;
    7. `/health/ready` est bien exposé dans le contrat OpenAPI.

Usage : python -X utf8 scripts/test-health-ready.py
"""
import ast
import hashlib
import os
import sys
import types
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
sys.path.insert(0, str(RACINE))

# Console Windows (cp1252) : sans cela, un libelle accentue ou une exception
# contenant un caractere hors cp1252 fait planter le harnais au moment meme ou
# il rend son verdict (mesure du 13/11 : UnicodeEncodeError sur le cas 2).
# Le harnais doit etre lancable sans drapeau, donc il force sa sortie en UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001 — un harnais ne doit jamais echouer sur son affichage
    pass
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)

# ----------------------- Faux Supabase (zéro réseau) --------------------------

ETAT = {"panne": None, "tables": []}


class _PanneSimulee(Exception):
    """Panne « exotique » : le readiness doit la traiter comme les autres."""


class _Requete:
    def select(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        if ETAT["panne"] is not None:
            raise ETAT["panne"]
        return types.SimpleNamespace(data=[{"id": "00000000-0000-0000-0000-000000000000"}])


class _FauxSupabase:
    def table(self, nom):
        ETAT["tables"].append(nom)
        return _Requete()


FAUX = _FauxSupabase()
_module_supabase = types.ModuleType("supabase")
_module_supabase.Client = object
_module_supabase.create_client = lambda url, key=None, **kwargs: FAUX
sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Application ---------------------------------
from fastapi.testclient import TestClient  # noqa: E402

from apps.api.app import main as main_module  # noqa: E402

client = TestClient(main_module.app)

CHECKS: list[tuple[bool, str]] = []


def check(condition: bool, libelle: str) -> None:
    CHECKS.append((bool(condition), libelle))
    print(f"  [{'OK' if condition else 'KO'}] {libelle}")


def frapper(chemin: str):
    """Appelle la route ; une exception non gérée devient une valeur explicite."""
    try:
        return client.get(chemin)
    except Exception as exc:  # noqa: BLE001 — c'est précisément ce qu'on interdit
        return exc


def panne(exc: Exception | None) -> None:
    ETAT["panne"] = exc


# Empreinte de la FONCTION `/health` (décorateur inclus) relevée AVANT l'ajout :
# elle doit rester identique au caractère près (Render pointe dessus). Extraite
# par AST pour ignorer tout voisin ajouté à côté.
EMPREINTE_HEALTH = "79989f895c42a69741947fc62be49e6fa404ae5781d34bdc5ed4dd23b972fe01"


def empreinte_bloc_health() -> str:
    source = (RACINE / "apps" / "api" / "app" / "main.py").read_text(encoding="utf-8")
    lignes = source.splitlines(keepends=True)
    for noeud in ast.parse(source).body:
        if isinstance(noeud, ast.AsyncFunctionDef) and noeud.name == "health":
            debut = noeud.decorator_list[0].lineno
            bloc = "".join(lignes[debut - 1 : noeud.end_lineno])
            return hashlib.sha256(bloc.encode("utf-8")).hexdigest()
    return "fonction /health introuvable"


print("1. Base OK : /health/ready = 200 ready")
panne(None)
r = frapper("/health/ready")
check(not isinstance(r, Exception), f"aucune exception levée ({r!r})"[:120])
check(getattr(r, "status_code", None) == 200, f"statut 200 (obtenu {getattr(r, 'status_code', r)!r})")
check(getattr(r, "json", lambda: None)() == {"status": "ready", "database": "ok"}, f"corps exact (obtenu {getattr(r, 'text', r)!r})")

print("2. Base KO : /health/ready = 503 not_ready")
panne(RuntimeError("base injoignable (panne simulée)"))
r = frapper("/health/ready")
check(not isinstance(r, Exception), f"aucune exception levée ({r!r})"[:120])
check(getattr(r, "status_code", None) == 503, f"statut 503 (obtenu {getattr(r, 'status_code', r)!r})")
check(getattr(r, "status_code", None) != 500, "jamais 500")
check(getattr(r, "json", lambda: None)() == {"status": "not_ready", "database": "error"}, f"corps exact (obtenu {getattr(r, 'text', r)!r})")

print("3. Panne exotique : 503 aussi, aucune exception non gérée")
panne(_PanneSimulee("panne non standard"))
r = frapper("/health/ready")
check(not isinstance(r, Exception), f"aucune exception levée ({r!r})"[:120])
check(getattr(r, "status_code", None) == 503, f"statut 503 (obtenu {getattr(r, 'status_code', r)!r})")

print("4. Corps 503 : aucune fuite de détail")
panne(RuntimeError("mot-de-passe-super-secret-a-ne-pas-exposer"))
r = frapper("/health/ready")
corps = getattr(r, "json", lambda: {})()
check(sorted(corps.keys()) == ["database", "status"], f"2 clés seulement (obtenu {sorted(corps.keys())})")
check("secret" not in getattr(r, "text", "").lower(), "aucun message d'erreur recopié")

print("5. /health : comportement historique préservé (200 dans les deux cas)")
panne(None)
h_ok = frapper("/health")
check(getattr(h_ok, "status_code", None) == 200, f"base OK -> 200 (obtenu {getattr(h_ok, 'status_code', h_ok)!r})")
check(getattr(h_ok, "json", lambda: {})().get("database") == "ok", "base OK -> database=ok")
panne(RuntimeError("base injoignable (panne simulée)"))
h_ko = frapper("/health")
check(getattr(h_ko, "status_code", None) == 200, f"base KO -> 200 (inchangé, obtenu {getattr(h_ko, 'status_code', h_ko)!r})")
check(getattr(h_ko, "json", lambda: {})().get("database") == "error", "base KO -> database=error")

print("6. /health inchangé au caractère près")
actuelle = empreinte_bloc_health()
check(actuelle == EMPREINTE_HEALTH, f"empreinte de la fonction /health identique ({actuelle[:12]}…)")

print("7. Contrat OpenAPI")
panne(None)
chemins = client.get("/openapi.json").json().get("paths", {})
check("/health/ready" in chemins, "/health/ready exposé dans OpenAPI")
check("/health" in chemins, "/health toujours exposé")

# ---------------------------------- Verdict ----------------------------------
total = len(CHECKS)
verts = sum(1 for ok, _ in CHECKS if ok)
print(f"\n{verts}/{total} vérifications vertes")
if verts != total:
    print("VERDICT : ROUGE")
    sys.exit(1)
print("VERDICT : VERT")
