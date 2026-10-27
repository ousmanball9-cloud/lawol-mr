"""Preuve MOCKÉE du filtrage `/api/v1/matches` — zéro réseau.

Prouve (exigences 27/10/2026) :
    1. Offre EXPIRÉE (date_limite < aujourd'hui) → exclue (inner join offre.active + date_limite >= today)
    2. Offre INACTIVE (active=false) → exclue (même inner join)
    3. Match avec statut_candidature = "pas_interesse" → EXCLU par défaut (inclure_masquees=false)
    4. Match avec statut_candidature = "pas_interesse" → INCLUS si inclure_masquees=true
    5. Offre VALIDE (active + date_limite future + pas masquée) → RETENUE

Usage : python -X utf8 scripts/test-matches-visibilite.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import asyncio
import copy
import os
import sys
import types
from datetime import UTC, datetime, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)

_MAINTENANT = datetime.now(UTC).date()
AUJOURDHUI = _MAINTENANT.isoformat()
HIER = (_MAINTENANT - timedelta(days=1)).isoformat()
DEMAIN = (_MAINTENANT + timedelta(days=1)).isoformat()
DANS_30_JOURS = (_MAINTENANT + timedelta(days=30)).isoformat()


# ------------------------- Faux Supabase (zéro réseau) -------------------------
class _Resultat:
    def __init__(self, data):
        self.data = data


class _FauxTable:
    """Chaîne de filtres minimale : eq/neq/gte/contains/or_/order/limit puis execute."""

    def __init__(self, base, nom):
        self._base, self._nom = base, nom
        self._filtres = []
        self._range = None
        self._limit = None
        self._order = None

    def select(self, *_a, **_k):
        return self

    def eq(self, colonne, valeur):
        self._filtres.append(("eq", colonne, valeur))
        return self

    def neq(self, colonne, valeur):
        self._filtres.append(("neq", colonne, valeur))
        return self

    def gte(self, colonne, valeur):
        self._filtres.append(("gte", colonne, valeur))
        return self

    def contains(self, colonne, valeur):
        self._filtres.append(("contains", colonne, valeur))
        return self

    def order(self, colonne, desc=False):
        self._order = (colonne, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        lignes = [copy.deepcopy(lg) for lg in self._base.lignes]
        for genre, colonne, valeur in self._filtres:
            if genre == "eq":
                lignes = [lg for lg in lignes if lg.get(colonne) == valeur]
            elif genre == "neq":
                lignes = [lg for lg in lignes if lg.get(colonne) != valeur]
            elif genre == "gte":
                lignes = [lg for lg in lignes if str(lg.get(colonne) or "") >= str(valeur)]
            elif genre == "contains":
                lignes = [lg for lg in lignes if set(valeur) <= set(lg.get(colonne) or [])]
        if self._order:
            colonne, desc = self._order
            lignes.sort(key=lambda x: x.get(colonne) or "", reverse=desc)
        if self._limit:
            lignes = lignes[: self._limit]
        return _Resultat(lignes)


class _FauxSupabase:
    def __init__(self, lignes):
        self.lignes = lignes
        self.dernier_select = None

    def table(self, nom):
        return _FauxTable(self, nom)


# ---------- Fixtures : profils, offres, matches ----------
PROFIL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
PROFIL_TELEPHONE = "2220000001"

OFFRES = [
    # 0 : offre VALIDE (active + date_limite future)
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "titre": "Bourse Master Informatique France",
        "entreprise": "Campus France",
        "pays_etudes": "france",
        "ville": "nouakchott",
        "type_offre": "bourse",
        "description": "Bourse complète pour master en informatique à Paris.",
        "date_limite": DANS_30_JOURS,
        "contact_email": "contact@campusfrance.org",
        "contact_whatsapp": None,
        "source_name": "campus-france",
        "source_url": "https://campusfrance.org/bourse-1",
        "filieres_cibles": ["informatique"],
        "active": True,
    },
    # 1 : offre EXPIRÉE (date_limite = hier)
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "titre": "Bourse expirée hier",
        "entreprise": "Ancien Fonds",
        "pays_etudes": "senegal",
        "ville": "dakar",
        "type_offre": "bourse",
        "description": "Cette offre est expirée depuis hier.",
        "date_limite": HIER,
        "contact_email": None,
        "contact_whatsapp": None,
        "source_name": "fonds-ancien",
        "source_url": "https://exemple.mr/expirée",
        "filieres_cibles": ["gestion"],
        "active": True,
    },
    # 2 : offre INACTIVE (active=false)
    {
        "id": "33333333-3333-3333-3333-333333333333",
        "titre": "Bourse inactive",
        "entreprise": "Fonds Inactif",
        "pays_etudes": "maroc",
        "ville": "rabat",
        "type_offre": "bourse",
        "description": "Cette offre est inactive.",
        "date_limite": DANS_30_JOURS,
        "contact_email": None,
        "contact_whatsapp": None,
        "source_name": "fonds-inactif",
        "source_url": "https://exemple.mr/inactive",
        "filieres_cibles": ["droit"],
        "active": False,
    },
    # 3 : offre VALIDE (active + date_limite future)
    {
        "id": "44444444-4444-4444-4444-444444444444",
        "titre": "Bourse Doctorat Allemagne",
        "entreprise": "DAAD",
        "pays_etudes": "allemagne",
        "ville": "berlin",
        "type_offre": "bourse",
        "description": "Bourse DAAD pour doctorat en Allemagne.",
        "date_limite": DANS_30_JOURS,
        "contact_email": "daad@daad.de",
        "contact_whatsapp": None,
        "source_name": "daad",
        "source_url": "https://daad.de/bourse-2",
        "filieres_cibles": ["informatique", "mathematiques"],
        "active": True,
    },
]

MATCHES = [
    # 0 : match VALIDE (offre 0) — aucun statut (null)
    {
        "id": "m1111111-1111-1111-1111-111111111111",
        "offre_id": "11111111-1111-1111-1111-111111111111",
        "profil_id": PROFIL_ID,
        "score": 95,
        "notifie": False,
        "postule": False,
        "favori": False,
        "statut_candidature": None,
        "date_match": AUJOURDHUI,
    },
    # 1 : match avec offre EXPIRÉE (offre 1) — doit être EXCLU par inner join
    {
        "id": "m2222222-2222-2222-2222-222222222222",
        "offre_id": "22222222-2222-2222-2222-222222222222",
        "profil_id": PROFIL_ID,
        "score": 80,
        "notifie": False,
        "postule": False,
        "favori": False,
        "statut_candidature": None,
        "date_match": AUJOURDHUI,
    },
    # 2 : match avec offre INACTIVE (offre 2) — doit être EXCLU par inner join
    {
        "id": "m3333333-3333-3333-3333-333333333333",
        "offre_id": "33333333-3333-3333-3333-333333333333",
        "profil_id": PROFIL_ID,
        "score": 70,
        "notifie": False,
        "postule": False,
        "favori": False,
        "statut_candidature": None,
        "date_match": AUJOURDHUI,
    },
    # 3 : match VALIDE (offre 3) — statut "pas_interesse" → EXCLU par défaut
    {
        "id": "m4444444-4444-4444-4444-444444444444",
        "offre_id": "44444444-4444-4444-4444-444444444444",
        "profil_id": PROFIL_ID,
        "score": 90,
        "notifie": False,
        "postule": False,
        "favori": False,
        "statut_candidature": "pas_interesse",
        "date_match": AUJOURDHUI,
    },
]

# On joint matches + offres pour simuler l'inner join offre:offres!inner
# Le faux Supabase ne fait pas de vraie jointure, on le simule en filtrant
# les matches dont l'offre ne passe pas les filtres offre.active + date_limite

class _FauxSupabaseAvecJointure:
    """Supabase mock qui simule l'inner join offre:offres!inner."""

    def __init__(self, matches, offres):
        self._matches = matches
        self._offres = {o["id"]: o for o in offres}

    def table(self, nom):
        if nom == "profils":
            return _FauxTableProfil(self)
        if nom == "matches":
            return _FauxTableMatchesAvecOffres(self)
        raise ValueError(f"Table inconnue: {nom}")


class _FauxTableProfil:
    def __init__(self, base):
        self._base = base

    def select(self, *_a, **_k):
        return self

    def eq(self, colonne, valeur):
        self._filtre = (colonne, valeur)
        return self

    def execute(self):
        if self._filtre == ("telephone", PROFIL_TELEPHONE):
            return _Resultat([{"id": PROFIL_ID, "telephone": PROFIL_TELEPHONE}])
        return _Resultat([])


class _FauxTableMatchesAvecOffres:
    """Simule : matches.select(...).eq("profil_id", ...).eq("offre.active", True).gte("offre.date_limite", today).neq("statut_candidature", "pas_interesse")"""

    def __init__(self, base):
        self._base = base
        self._filtres = []
        self._limit = 50
        self._order = None

    def select(self, colonnes):
        self._colonnes = colonnes
        return self

    def eq(self, colonne, valeur):
        self._filtres.append(("eq", colonne, valeur))
        return self

    def neq(self, colonne, valeur):
        self._filtres.append(("neq", colonne, valeur))
        return self

    def or_(self, expression):
        """`or=(a.is.null,b.neq.v)` — sémantique SQL PostgREST reproduite."""
        self._filtres.append(("or", expression, None))
        return self

    def gte(self, colonne, valeur):
        self._filtres.append(("gte", colonne, valeur))
        return self

    def order(self, colonne, desc=False):
        self._order = (colonne, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        # 1. Filtrer matches par profil_id
        lignes = [copy.deepcopy(m) for m in self._base._matches if m["profil_id"] == PROFIL_ID]

        # 2. Filtrer par offre (inner join simulé) : offre.active = true + date_limite >= today
        lignes = [
            m
            for m in lignes
            if self._base._offres.get(m["offre_id"], {}).get("active") is True
            and self._base._offres.get(m["offre_id"], {}).get("date_limite", "") >= AUJOURDHUI
        ]

        # 3. Appliquer filtres explicites (statut_candidature != "pas_interesse" si demandé)
        for genre, colonne, valeur in self._filtres:
            if genre == "eq" and colonne == "offre.active" or genre == "gte" and colonne == "offre.date_limite":
                # Déjà fait dans l'inner join simulé
                pass
            elif genre == "neq" and colonne == "statut_candidature":
                # SÉMANTIQUE SQL : `!=` sur un NULL ne rend ni vrai ni faux, la
                # ligne est ÉCARTÉE. C'est le piège qui a vidé la liste du profil
                # le 27/10/2026 : le mock « gentil » (None != valeur → True)
                # masquait le défaut. Il doit désormais le reproduire.
                lignes = [
                    lg
                    for lg in lignes
                    if lg.get(colonne) is not None and lg.get(colonne) != valeur
                ]
            elif genre == "or":
                # expressions prises en charge : `<col>.is.null` et
                # `<col>.neq.<valeur>`, séparées par une virgule
                conditions = []
                # `or_` enregistre l'expression dans le champ `colonne`
                # (filtre = ("or", expression, None)).
                for morceau in colonne.split(","):
                    morceau = morceau.strip()
                    if morceau.endswith(".is.null"):
                        colonne_null = morceau[: -len(".is.null")]
                        conditions.append(lambda lg, c=colonne_null: lg.get(c) is None)
                    elif ".neq." in morceau:
                        colonne_neq, valeur_neq = morceau.split(".neq.", 1)
                        conditions.append(
                            lambda lg, c=colonne_neq, v=valeur_neq: lg.get(c) != v
                        )
                lignes = [lg for lg in lignes if any(test(lg) for test in conditions)]
            elif genre == "eq" and colonne == "profil_id":
                lignes = [lg for lg in lignes if lg.get(colonne) == valeur]

        # 4. Ordonner
        if self._order:
            colonne, desc = self._order
            lignes.sort(key=lambda x: x.get(colonne) or "", reverse=desc)

        # 5. Limiter
        if self._limit:
            lignes = lignes[: self._limit]

        # 6. Enrichir avec les données de l'offre et du profil (selon colonnes demandées)
        resultat = []
        for m in lignes:
            offre = self._base._offres.get(m["offre_id"], {})
            enriched = {**m}
            if "offre" in str(self._colonnes):
                enriched["offre"] = offre
            if "profil" in str(self._colonnes):
                enriched["profil"] = {"id": PROFIL_ID, "prenom": "Test", "nom": "Étudiant", "telephone": PROFIL_TELEPHONE, "filiere": "informatique", "niveau": "master"}
            resultat.append(enriched)

        return _Resultat(resultat)


FAUX_SUPABASE = _FauxSupabaseAvecJointure(MATCHES, OFFRES)
_module_supabase = types.ModuleType("supabase")
_module_supabase.Client = object
_module_supabase.create_client = lambda url, key=None, **kwargs: FAUX_SUPABASE
sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Imports --------------------------------------
from apps.api.app.main import list_matches

ECHECS = []


def check(libelle, condition, detail=""):
    print(f"  [{'OK' if condition else 'KO'}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


# ======================== Tests du filtrage /api/v1/matches =====================
print("=== Tests GET /api/v1/matches (mock Supabase, zéro réseau) ===\n")

# -- 1. Par défaut (inclure_masquees=false) : offre expirée exclue --
print("1. Offre EXPIRÉE (date_limite < aujourd'hui) → exclue par inner join")
res = asyncio.run(list_matches(profil_id=PROFIL_ID, inclure_masquees=False, session=PROFIL_TELEPHONE))
ids = [m["id"] for m in res]
check("match m2222222 (offre expirée) absent", "m2222222-2222-2222-2222-222222222222" not in ids, f"présent dans {ids}")
check("match m1111111 (offre valide) présent", "m1111111-1111-1111-1111-111111111111" in ids, f"absent de {ids}")
check("match m4444444 (offre valide masquée) absent par défaut", "m4444444-4444-4444-4444-444444444444" not in ids, f"présent dans {ids}")

# -- 2. Par défaut : offre inactive exclue --
print("\n2. Offre INACTIVE (active=false) → exclue par inner join")
check("match m3333333 (offre inactive) absent", "m3333333-3333-3333-3333-333333333333" not in ids, f"présent dans {ids}")

# -- 3. Par défaut : statut "pas_interesse" exclu --
print("\n3. statut_candidature = 'pas_interesse' → EXCLU par défaut (inclure_masquees=false)")
check("match m4444444 (pas_interesse) absent", "m4444444-4444-4444-4444-444444444444" not in ids, f"présent dans {ids}")

# -- 4. Avec inclure_masquees=true : statut "pas_interesse" INCLUS --
print("\n4. inclure_masquees=true → statut 'pas_interesse' INCLUS")
res_masquees = asyncio.run(list_matches(profil_id=PROFIL_ID, inclure_masquees=True, session=PROFIL_TELEPHONE))
ids_masquees = [m["id"] for m in res_masquees]
check("match m4444444 (pas_interesse) présent avec inclure_masquees=true", "m4444444-4444-4444-4444-444444444444" in ids_masquees, f"absent de {ids_masquees}")
check("match m1111111 (valide) toujours présent", "m1111111-1111-1111-1111-111111111111" in ids_masquees, f"absent de {ids_masquees}")
check("match m2222222 (expirée) TOUJOURS absent (inner join offre)", "m2222222-2222-2222-2222-222222222222" not in ids_masquees, f"présent dans {ids_masquees}")
check("match m3333333 (inactive) TOUJOURS absent (inner join offre)", "m3333333-3333-3333-3333-333333333333" not in ids_masquees, f"présent dans {ids_masquees}")

# -- 5. Offre VALIDE retenue dans tous les cas --
print("\n5. Offre VALIDE (active + date_limite future + pas masquée) → RETENUE")
check("match m1111111 présent par défaut", "m1111111-1111-1111-1111-111111111111" in ids, f"absent de {ids}")
check("match m1111111 présent avec inclure_masquees=true", "m1111111-1111-1111-1111-111111111111" in ids_masquees, f"absent de {ids_masquees}")

# -- 6. Vérifier enrichissement offre + profil --
print("\n6. Enrichissement réponse : offre + profil présents")
for m in res:
    check(f"match {m['id'][:8]}... a clé 'offre'", "offre" in m, f"clés: {list(m.keys())}")
    check(f"match {m['id'][:8]}... a clé 'profil'", "profil" in m, f"clés: {list(m.keys())}")
    if "offre" in m:
        check("offre a titre", "titre" in m["offre"], f"offre: {m['offre']}")
        check("offre a date_limite", "date_limite" in m["offre"], f"offre: {m['offre']}")

# -- 7. Repli D8 : borné à la colonne absente, toute autre erreur remonte --
print("\n7. Repli D8 : colonne absente = repli ; autre erreur = remontée")
import apps.api.app.main as _api


class _TableQuiEchoue:
    """Table `matches` qui lève l'erreur demandée à l'exécution."""

    def __init__(self, erreur):
        self._erreur = erreur

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def gte(self, *_a, **_k):
        return self

    def or_(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        raise self._erreur


class _SupabaseEchoueUneFois:
    """1er appel `matches` en échec, le suivant (repli) fonctionne."""

    def __init__(self, erreur, base):
        self._erreur, self._base, self.appels = erreur, base, 0

    def table(self, nom):
        if nom == "profils":
            return _FauxTableProfil(self._base)
        self.appels += 1
        if self.appels == 1:
            return _TableQuiEchoue(self._erreur)
        return _FauxTableMatchesAvecOffres(self._base)


check(
    "erreur de colonne (PGRST204) reconnue comme 'colonne absente'",
    _api._colonne_absente(
        RuntimeError(
            "PGRST204: Could not find the 'statut_candidature' column of "
            "'matches' in the schema cache"
        )
    ),
)
check(
    "une panne réseau n'est PAS prise pour une colonne absente",
    not _api._colonne_absente(RuntimeError("connexion perdue / timeout")),
)

_supabase_origine = _api.supabase
try:
    # a) colonne absente -> repli borné, champs neutres complétés
    _api.supabase = _SupabaseEchoueUneFois(
        RuntimeError(
            "PGRST204: Could not find the 'statut_candidature' column of "
            "'matches' in the schema cache"
        ),
        FAUX_SUPABASE,
    )
    repli = asyncio.run(
        list_matches(profil_id=PROFIL_ID, inclure_masquees=False, session=PROFIL_TELEPHONE)
    )
    check("colonne absente → repli déclenché (des lignes reviennent)", len(repli) > 0, f"{len(repli)} ligne(s)")
    check(
        "repli → champs manquants complétés (postule/favori/statut_candidature)",
        all(
            {"postule", "favori", "statut_candidature"} <= set(m.keys()) for m in repli
        ),
    )

    # b) autre erreur -> elle doit REMONTER (jamais de résultat faux en silence)
    _api.supabase = _SupabaseEchoueUneFois(RuntimeError("connexion perdue"), FAUX_SUPABASE)
    remontee = False
    try:
        asyncio.run(
            list_matches(profil_id=PROFIL_ID, inclure_masquees=False, session=PROFIL_TELEPHONE)
        )
    except RuntimeError:
        remontee = True
    check("panne réelle → exception remontée (filtre jamais désactivé en silence)", remontee)
finally:
    _api.supabase = _supabase_origine

print(f"\n{'VERT' if not ECHECS else 'ROUGE'} — {len(ECHECS)} échec(s)")
for e in ECHECS:
    print(f"  - {e}")
sys.exit(1 if ECHECS else 0)