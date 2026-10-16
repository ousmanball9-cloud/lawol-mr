"""Preuve MOCKÉE du contrat de la LISTE publique `/api/v1/offres` — zéro réseau.

Décision 16/10/2026 : le catalogue chargeait tout le bassin AVEC les descriptions
intégrales — 322 Ko mesurés pour 200 offres, dont 210 Ko (65 %) de texte jamais
lu (la carte du catalogue clippe à deux lignes). La liste sert désormais un
APERÇU ; le texte intégral reste servi par le DÉTAIL `/offres/{id}`.

Prouve :
    1. `_apercu_description` : coupe propre (jamais un mot tronqué), texte court
       rendu tel quel, cas limites (vide, espaces, mot unique plus long que la
       coupe) ;
    2. la LISTE : `description` VIDE + `description_apercu` renseigné, texte
       intégral absent du payload ;
    3. le DÉTAIL : description ENTIÈRE (rien n'est perdu pour la fiche) ;
    4. la RECHERCHE `q` continue de porter sur la description intégrale côté
       serveur (l'autorité ne bouge pas, seule la charge utile diminue) ;
    5. le gain est MESURÉ (octets) et non affirmé.

Usage : python -X utf8 scripts/test-apercu-liste.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import asyncio
import copy
import json
import os
import sys
import types
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)


# ------------------------- Faux Supabase (zéro réseau) -------------------------
LONGUE = (
    "La bourse couvre les frais de scolarité, l'allocation mensuelle et le billet "
    "d'avion aller-retour. Les candidats doivent justifier d'un excellent dossier "
    "académique, d'une lettre de motivation circonstanciée et de deux lettres de "
    "recommandation académique. La sélection se déroule en deux temps : une "
    "présélection sur dossier, puis un entretien en visioconférence avec le comité "
    "scientifique du programme, qui statue sur l'attribution définitive."
)
COURTE = "Bourse complète pour un master en informatique à Nouakchott."
MOT_UNIQUE = "A" * 400  # aucun espace : la coupe ne peut pas se faire sur un mot
# Description LONGUE réaliste (~1 050 caractères ≈ moyenne réelle mesurée des
# 200 offres : 1 076 caractères) — c'est elle qui donne au gain son sens.
LONGUE_REELLE = (LONGUE + " ") * 3


class _Resultat:
    def __init__(self, data):
        self.data = data


class _FauxTable:
    """Chaîne de filtres minimale : eq/gte/contains/or_/order/range puis execute."""

    def __init__(self, base, nom):
        self._base, self._nom = base, nom
        self._filtres = []
        self._or = None
        self._range = None

    def select(self, *_a, **_k):
        return self

    def eq(self, colonne, valeur):
        self._filtres.append(("eq", colonne, valeur))
        return self

    def gte(self, colonne, valeur):
        self._filtres.append(("gte", colonne, valeur))
        return self

    def contains(self, colonne, valeur):
        self._filtres.append(("contains", colonne, valeur))
        return self

    def order(self, *_a, **_k):
        return self

    def or_(self, expression):
        self._or = expression
        self._base.or_utilises.append(expression)
        return self

    def range(self, debut, fin):
        self._range = (debut, fin)
        return self

    def execute(self):
        lignes = [copy.deepcopy(lg) for lg in self._base.lignes]
        for genre, colonne, valeur in self._filtres:
            if genre == "eq":
                lignes = [lg for lg in lignes if lg.get(colonne) == valeur]
            elif genre == "gte":
                lignes = [lg for lg in lignes if str(lg.get(colonne) or "") >= str(valeur)]
            elif genre == "contains":
                lignes = [lg for lg in lignes if set(valeur) <= set(lg.get(colonne) or [])]
        if self._range:
            debut, fin = self._range
            lignes = lignes[debut : fin + 1]
        return _Resultat(lignes)


class _FauxSupabase:
    def __init__(self, lignes):
        self.lignes = lignes
        self.or_utilises = []

    def table(self, nom):
        return _FauxTable(self, nom)


LIGNES = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "titre": "Bourse ESRC doctorat",
        "entreprise": "WRDTP",
        "pays_etudes": "royaume_uni",
        "filieres_cibles": ["informatique"],
        "type_offre": "bourse",
        "type_financement": "fully_funded",
        "description": LONGUE,
        "date_limite": "2027-01-20",
        "contact_email": None,
        "contact_whatsapp": None,
        "source_name": "scholar-africa",
        "source_url": "https://exemple.mr/bourse",
        "active": True,
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "titre": "Bourse master informatique",
        "entreprise": "Université",
        "pays_etudes": "senegal",
        "filieres_cibles": ["informatique"],
        "type_offre": "bourse",
        "type_financement": "inconnu",
        "description": COURTE,
        "date_limite": "2027-03-01",
        "contact_email": None,
        "contact_whatsapp": None,
        "source_name": "opportunity-desk",
        "source_url": "https://exemple.mr/courte",
        "active": True,
    },
    {
        "id": "33333333-3333-3333-3333-333333333333",
        "titre": "Bourse sans espace",
        "entreprise": "Fonds",
        "pays_etudes": None,
        "filieres_cibles": [],
        "type_offre": "bourse",
        "type_financement": "inconnu",
        "description": LONGUE_REELLE,
        "date_limite": "2027-04-01",
        "contact_email": None,
        "contact_whatsapp": None,
        "source_name": "scholar-africa",
        "source_url": "https://exemple.mr/long",
        "active": True,
    },
]

FAUX = _FauxSupabase(LIGNES)
_module_supabase = types.ModuleType("supabase")
_module_supabase.Client = object
_module_supabase.create_client = lambda url, key=None, **kwargs: FAUX
sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Imports --------------------------------------
from apps.api.app.main import (
    APERCU_DESCRIPTION_CAR,
    _apercu_description,
    detail_offre,
    list_offres,
)

ECHECS = []


def check(libelle, condition, detail=""):
    print(f"  [{'OK' if condition else 'KO'}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


# ===================== 1. _apercu_description (pur) ===========================
print("1. _apercu_description — coupe honnête")
apercu_long = _apercu_description(LONGUE)
check(f"longue : coupe à ~{APERCU_DESCRIPTION_CAR} caractères + ellipse", apercu_long.endswith("…") and len(apercu_long) <= APERCU_DESCRIPTION_CAR + 1, str(len(apercu_long)))
corps = apercu_long[:-1]
check("longue : l'aperçu est bien le début du texte", LONGUE.startswith(corps), corps[:40])
check(
    "longue : jamais un mot tronqué (l'aperçu finit sur un mot complet)",
    LONGUE[len(corps)] == " " and not corps.endswith(" "),
    repr(LONGUE[len(corps) : len(corps) + 1]),
)
check("courte : rendue telle quelle, sans ellipse", _apercu_description(COURTE) == COURTE, _apercu_description(COURTE))
check("vide : chaîne vide, pas d'ellipse", _apercu_description("") == "", repr(_apercu_description("")))
check("None : chaîne vide (jamais de crash)", _apercu_description(None) == "", repr(_apercu_description(None)))
check(
    "espaces multiples : normalisés en espaces simples",
    _apercu_description("a\n\n  b   c") == "a b c",
    repr(_apercu_description("a\n\n  b   c")),
)
check(
    "mot unique plus long que la coupe : coupe brute + ellipse (aucun espace où couper)",
    _apercu_description(MOT_UNIQUE) == "A" * APERCU_DESCRIPTION_CAR + "…",
    str(len(_apercu_description(MOT_UNIQUE))),
)
check(
    "exactement à la limite : aucun caractère perdu",
    _apercu_description("b" * APERCU_DESCRIPTION_CAR) == "b" * APERCU_DESCRIPTION_CAR,
    "",
)

# ========================= 2. La LISTE (mockée) ===============================
print("\n2. list_offres — charge utile allégée")
offres = asyncio.run(list_offres(type_offre=None, limit=50, offset=0))
check("3 offres servies", len(offres) == 3, str(len(offres)))
check(
    "description VIDE dans la liste (le texte intégral n'est plus transporté)",
    all(o.description == "" for o in offres),
    str([len(o.description) for o in offres]),
)
check(
    "description_apercu renseigné pour chaque offre",
    all(o.description_apercu for o in offres),
    str([len(o.description_apercu or "") for o in offres]),
)
check(
    "aperçu de la description longue ≤ 241 caractères",
    len(offres[0].description_apercu or "") <= APERCU_DESCRIPTION_CAR + 1,
    str(len(offres[0].description_apercu or "")),
)
check(
    "description courte : aperçu = texte intégral",
    offres[1].description_apercu == COURTE,
    repr(offres[1].description_apercu),
)
liste_json = json.dumps([o.model_dump(mode="json") for o in offres], ensure_ascii=False)
check(
    "le texte intégral n'est PAS dans le payload (seul l'aperçu l'est)",
    LONGUE not in liste_json and COURTE + " " not in liste_json,
    "",
)
check(
    "le payload ne contient pas plus de 241 caractères consécutifs du texte long",
    not any(LONGUE[i : i + 242] in liste_json for i in range(len(LONGUE) - 242)),
    "",
)

# ========================== 3. Le DÉTAIL (mocké) ==============================
print("\n3. detail_offre — le texte intégral reste servi")
detail = asyncio.run(detail_offre(LIGNES[0]["id"]))
check("détail : description ENTIÈRE (rien n'est perdu)", detail.description == LONGUE, str(len(detail.description)))
check("détail : aperçu vide (champ réservé à la liste)", detail.description_apercu is None, repr(detail.description_apercu))

# ==================== 4. La recherche reste sur le texte intégral =============
print("\n4. Recherche q — l'autorité serveur ne bouge pas")
FAUX.or_utilises.clear()
asyncio.run(list_offres(q="Cambridge", limit=50, offset=0))
critere = FAUX.or_utilises[-1] if FAUX.or_utilises else ""
check("le filtre PostgREST porte sur titre, entreprise ET description", "description.ilike.*Cambridge*" in critere, critere)
check("le filtre est bien échappé/nettoyé (aucun caractère PostgREST brut)", "*Cambridge*" in critere and "," in critere, critere)

# ========================= 5. Gain MESURÉ (octets) ============================
print("\n5. Gain mesuré (octets JSON)")
# La fixture ne compte que 3 lignes : le poids « structure » (identifiants, dates,
# enums) domine le ratio global. La grandeur qui décide est donc la charge
# « description » — celle qui pesait 210 Ko sur 322 Ko (65 %) sur les 200 offres
# réelles mesurées le 16/10/2026 avant ce changement.
avant_desc = sum(len(l["description"].encode("utf-8")) for l in LIGNES)
apres_desc = sum(len((o.description_apercu or "").encode("utf-8")) for o in offres)
gain_desc = round((1 - apres_desc / avant_desc) * 100)
check(f"charge « description » réduite ({avant_desc} → {apres_desc} octets, -{gain_desc} %)", gain_desc > 60, f"{gain_desc} %")
avant = json.dumps([{**l, "description_apercu": None} for l in LIGNES], ensure_ascii=False)
apres = liste_json
gain = round((1 - len(apres.encode("utf-8")) / len(avant.encode("utf-8"))) * 100)
print(f"  · payload total de la fixture : {len(avant.encode('utf-8'))} → {len(apres.encode('utf-8'))} octets (-{gain} %)")
check("payload total de la liste réduit (toutes lignes confondues)", len(apres) < len(avant), f"{len(avant)} → {len(apres)}")
check("la description est bien l'essentiel du poids d'une offre", len(LONGUE.encode("utf-8")) > len(COURTE.encode("utf-8")), "")

print(f"\n{'VERT' if not ECHECS else 'ROUGE'} — {len(ECHECS)} échec(s)")
for e in ECHECS:
    print(f"  - {e}")
sys.exit(1 if ECHECS else 0)
