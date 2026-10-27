"""Preuve MOCKÉE de l'axe « catégorie de bourse » (FINANCEUR) — zéro réseau.

Décision 20/10/2026 : le catalogue « 100 % bourses » gagne un second axe, le
FINANCEUR, SANS toucher à l'enum PostgreSQL `type_offre` (NATURE). La catégorie
vit dans `offres.metadata['categorie_bourse']` (jsonb déjà présent → aucune
migration SQL). Taxonomie validée :
    gouvernementale | institutionnelle | fondation | entreprise | inconnu
Défaut `inconnu` : un financeur n'est JAMAIS deviné.

Prouve :
    1. `scraper/engine.py` : la table par source, la normalisation des noms
       (`daad-scholarship` / `DAAD_SCHOLARSHIP`), le repli mots-clés sur
       l'organisme (ambassade, ministère, consulat, government scholarship) et
       le défaut `inconnu` ;
    2. les listes de sources dérivées de la règle (formes DB `-` et `_`) ;
    3. `BaseScraper.save` : `metadata['categorie_bourse']` écrit SANS écraser
       les autres clés, `type_offre` inchangé (non-régression) ;
    4. `OffreStagePublic` : lecture depuis `metadata`, ligne legacy sans
       metadata → `inconnu`, valeur hors taxonomie → `inconnu` ;
    5. `GET /api/v1/offres?categorie=` : filtre serveur par source, `inconnu`
       = tout sauf les sources classées, valeur inconnue → 422 ;
    6. `GET /api/v1/offres/categories` : comptage RÉEL des offres actives à
       échéance future (route déclarée AVANT `/offres/{offre_id}` → 200).

Usage : python -X utf8 scripts/test-categorie-bourse.py
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


# ------------------------- Faux Supabase (zéro réseau) -------------------------
class _Resultat:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _FauxNot:
    """`table.not_.in_(...)` — l'exclusion utilisée par `categorie=inconnu`."""

    def __init__(self, table):
        self._table = table

    def in_(self, colonne, valeurs):
        self._table._filtres.append(("not_in", colonne, list(valeurs)))
        return self._table


def _valeur(ligne, colonne):
    """Valeur d'une colonne, y compris un chemin jsonb `metadata->>clé`."""
    if colonne == "metadata->>categorie_bourse":
        md = ligne.get("metadata")
        return md.get("categorie_bourse") if isinstance(md, dict) else None
    return ligne.get(colonne)


class _FauxTable:
    """Chaîne minimale : select/eq/gte/in_/or_/not_.in_/order/range/upsert."""

    def __init__(self, base, nom):
        self._base, self._nom = base, nom
        self._filtres = []
        self._count = None
        self._head = False
        self._range = None

    def select(self, *_a, count=None, head=False, **_k):
        self._count, self._head = count, head
        return self

    def eq(self, colonne, valeur):
        self._filtres.append(("eq", colonne, valeur))
        return self

    def gte(self, colonne, valeur):
        self._filtres.append(("gte", colonne, valeur))
        return self

    def in_(self, colonne, valeurs):
        self._filtres.append(("in", colonne, list(valeurs)))
        return self

    def or_(self, expression):
        """`or=(metadata->>categorie_bourse.is.null,...eq.inconnu)`."""
        self._filtres.append(("or", expression, None))
        return self

    @property
    def not_(self):
        return _FauxNot(self)

    def order(self, *_a, **_k):
        return self

    def range(self, debut, fin):
        self._range = (debut, fin)
        return self

    def upsert(self, donnees, on_conflict=None):
        self._base.upserts.append((self._nom, copy.deepcopy(donnees), on_conflict))
        return self

    def execute(self):
        lignes = [copy.deepcopy(ligne) for ligne in self._base.offres]
        for operation, colonne, valeur in self._filtres:
            if operation == "eq":
                lignes = [lg for lg in lignes if _valeur(lg, colonne) == valeur]
            elif operation == "gte":
                lignes = [lg for lg in lignes if str(_valeur(lg, colonne) or "") >= str(valeur)]
            elif operation == "in":
                lignes = [lg for lg in lignes if _valeur(lg, colonne) in valeur]
            elif operation == "not_in":
                lignes = [lg for lg in lignes if _valeur(lg, colonne) not in valeur]
            elif operation == "or":
                # Sémantique PostgREST des deux formes utilisées par la route.
                conditions = []
                for morceau in colonne.split(","):
                    morceau = morceau.strip()
                    if morceau.endswith(".is.null"):
                        conditions.append(
                            (morceau[: -len(".is.null")], None, True)
                        )
                    elif ".eq." in morceau:
                        col, val = morceau.split(".eq.", 1)
                        conditions.append((col, val, False))
                lignes = [
                    lg
                    for lg in lignes
                    if any(
                        (_valeur(lg, col) is None) if est_null else (_valeur(lg, col) == val)
                        for col, val, est_null in conditions
                    )
                ]
        if self._range:
            debut, fin = self._range
            lignes = lignes[debut : fin + 1]
        compte = len(lignes) if self._count == "exact" else None
        return _Resultat([] if self._head else lignes, count=compte)


class _FauxSupabase:
    def __init__(self, offres):
        self.offres = offres
        self.upserts = []

    def table(self, nom):
        return _FauxTable(self, nom)


def _ligne(id_offre, source_name, metadata=None, jours=30, entreprise="Organisme"):
    """Ligne `offres` brute telle que la sert PostgREST."""
    return {
        "id": id_offre,
        "titre": f"Bourse de test {id_offre[:2]}",
        "entreprise": entreprise,
        "pays_etudes": None,
        "filieres_cibles": ["informatique"],
        "type_offre": "bourse",
        "type_financement": "inconnu",
        "description": "Bourse d'études de test.",
        "date_limite": (datetime.now(UTC).date() + timedelta(days=jours)).isoformat(),
        "contact_email": None,
        "contact_whatsapp": None,
        "source_name": source_name,
        "source_url": f"https://exemple.mr/{id_offre}",
        "active": True,
        **({"metadata": metadata} if metadata is not None else {}),
    }


OFFRES = [
    # 1 : DAAD officiel (daad.de) → gouvernementale, metadata riche à préserver
    _ligne("11111111-1111-1111-1111-111111111111", "daad",
           {"categorie_bourse": "gouvernementale", "content_hash": "aaa"}),
    # 2 : Erasmus+ (programme de l'UE) → institutionnelle (valeur écrite par le
    #     backfill : le filtre ne lit QUE metadata, jamais la source)
    _ligne("22222222-2222-2222-2222-222222222222", "erasmus",
           {"categorie_bourse": "institutionnelle"}),
    # 3 : fondation
    _ligne("33333333-3333-3333-3333-333333333333", "mastercard-foundation",
           {"categorie_bourse": "fondation"}),
    # 4 : source NON classée + aucun metadata → inconnu (legacy)
    _ligne("44444444-4444-4444-4444-444444444444", "scholar-africa"),
    # 5 : source d'emploi → inconnu
    _ligne("55555555-5555-5555-5555-555555555555", "beta_mr", {}),
    # 6 : Campus France (gouvernementale) mais ÉCHUE → jamais comptée
    _ligne("66666666-6666-6666-6666-666666666666", "campus-france",
           {"categorie_bourse": "gouvernementale"}, jours=-5),
    # 7 : valeur invalide en base (« bidon ») → normalisée « inconnu » par la
    #     reprise (`backfill-categorie.py`) ; lue telle quelle, elle serait
    #     inconnue aussi. Le filtre ne lit que des valeurs de la taxonomie.
    _ligne("77777777-7777-7777-7777-777777777777", "source-inconnue-xyz",
           {"categorie_bourse": "inconnu"}),
    # 8 : daadscholarship.com = BLOG privé, pas le DAAD officiel → inconnu
    _ligne("88888888-8888-8888-8888-888888888888", "daad-scholarship", {}),
]

FAUX = _FauxSupabase(OFFRES)
_module_supabase = types.ModuleType("supabase")
_module_supabase.Client = object
_module_supabase.create_client = lambda url, key=None, **kwargs: FAUX
sys.modules["supabase"] = _module_supabase  # AVANT tout import de l'app

# ------------------------------- Imports --------------------------------------
from fastapi.testclient import TestClient

from apps.api.app.main import app, categories_offres, list_offres
from apps.api.app.modules.scraper.engine import (
    CATEGORIE_BOURSE_PAR_SOURCE,
    CATEGORIES_BOURSE,
    CategorieBourse,
    _cle_source,
    categorie_bourse_pour_offre,
    categorie_bourse_pour_source,
    sources_bourse_connues,
    sources_classifiees,
)
from apps.api.app.modules.scraper.sources.base import BaseScraper
from apps.api.app.modules.shared.models import (
    OffreStageCreate,
    OffreStagePublic,
    SourceType,
    TypeOffre,
    Ville,
)

CLIENT = TestClient(app)
ECHECS = []


def check(libelle, condition, detail=""):
    print(f"  [{'OK' if condition else 'KO'}] {libelle}" + ("" if condition else f"  → {detail}"))
    if not condition:
        ECHECS.append(libelle)


# ===================== 1. Taxonomie + règle par source =======================
print("1. engine — taxonomie et catégorie par source")
check(
    "taxonomie exacte (5 valeurs, défaut inconnu)",
    CATEGORIES_BOURSE == ("gouvernementale", "institutionnelle", "fondation",
                          "entreprise", "inconnu"),
    str(CATEGORIES_BOURSE),
)
check(
    "toutes les valeurs de la table appartiennent à la taxonomie",
    set(CATEGORIE_BOURSE_PAR_SOURCE.values()) <= set(CATEGORIES_BOURSE),
    str(sorted(set(CATEGORIE_BOURSE_PAR_SOURCE.values()) - set(CATEGORIES_BOURSE))),
)
check("DAAD officiel (daad.de) → gouvernementale",
      categorie_bourse_pour_source("daad") == "gouvernementale",
      categorie_bourse_pour_source("daad"))
check("daad-scholarship (blog privé, forme DB) → inconnu",
      categorie_bourse_pour_source("daad-scholarship") == "inconnu",
      categorie_bourse_pour_source("daad-scholarship"))
check("DAAD_SCHOLARSHIP (casse) → inconnu (même blog, jamais le DAAD officiel)",
      categorie_bourse_pour_source("DAAD_SCHOLARSHIP") == "inconnu",
      categorie_bourse_pour_source("DAAD_SCHOLARSHIP"))
check("erasmus (programme de l'UE) → institutionnelle",
      categorie_bourse_pour_source("erasmus") == "institutionnelle", "")
check("erasmus_plus (programme de l'UE) → institutionnelle",
      categorie_bourse_pour_source("erasmus_plus") == "institutionnelle", "")
check("eiffel → gouvernementale",
      categorie_bourse_pour_source("eiffel") == "gouvernementale", "")
check("campus_france (opère les bourses de l'État français) → gouvernementale",
      categorie_bourse_pour_source("campus_france") == "gouvernementale", "")
check("campus-france (forme DB) → gouvernementale",
      categorie_bourse_pour_source("campus-france") == "gouvernementale", "")
check("mastercard-foundation → fondation",
      categorie_bourse_pour_source("mastercard-foundation") == "fondation", "")
check("mastercard_foundation (underscore) → fondation",
      categorie_bourse_pour_source("mastercard_foundation") == "fondation", "")
check("beta_mr (emploi) → inconnu",
      categorie_bourse_pour_source("beta_mr") == "inconnu", "")
check("linkedin (emploi) → inconnu",
      categorie_bourse_pour_source("linkedin") == "inconnu", "")
check("source inconnue, organisme vide → inconnu (jamais deviné)",
      categorie_bourse_pour_source("scholar-africa") == "inconnu", "")
check("source None → inconnu",
      categorie_bourse_pour_source(None) == "inconnu", "")


# ===================== 2. Repli mots-clés sur l'organisme ====================
print("\n2. engine — repli mots-clés financeur public")
check("« Ambassade de France » → gouvernementale",
      categorie_bourse_pour_source("portail-x", "Ambassade de France en Mauritanie")
      == "gouvernementale", "")
check("« Ministère de l'Enseignement Supérieur » → gouvernementale",
      categorie_bourse_pour_source("portail-x", "Ministère de l'Enseignement Supérieur")
      == "gouvernementale", "")
check("« Ministry of Education » → gouvernementale",
      categorie_bourse_pour_source("portail-x", "Ministry of Education")
      == "gouvernementale", "")
check("« Consulat général » → gouvernementale",
      categorie_bourse_pour_source("portail-x", "Consulat général de France")
      == "gouvernementale", "")
check("« Government Scholarship Program » → gouvernementale",
      categorie_bourse_pour_source("portail-x", "Government Scholarship Program")
      == "gouvernementale", "")
check("« Gouvernement du Brésil » (cas MESRS réel) → gouvernementale",
      categorie_bourse_pour_source("MESRS Mauritanie", "Gouvernement du Brésil")
      == "gouvernementale", "")
check("organisme privé nommé (TotalEnergies) → entreprise",
      categorie_bourse_pour_source("portail-x", "TotalEnergies Mauritanie")
      == "entreprise", "")
check("source classée PRIME sur l'organisme (beta_mr + ambassade → inconnu)",
      categorie_bourse_pour_source("beta_mr", "Ambassade de France") == "inconnu", "")

# --- Mots-clés ambigus : ne doivent PAS classer (défaut inconnu) ---
check("mot-clé ambigu « government » seul (pas « government scholarship ») → inconnu",
      categorie_bourse_pour_source("portail-x", "Government Agency XYZ")
      == "inconnu", "")
check("mot-clé ambigu « ministry » seul (pas « ministry of education ») → inconnu",
      categorie_bourse_pour_source("portail-x", "Ministry of Something")
      == "inconnu", "")
check("mot-clé ambigu « embassy » seul (pas nom de pays) → inconnu",
      categorie_bourse_pour_source("portail-x", "Embassy Office")
      == "inconnu", "")
check("mot-clé ambigu « consulate » seul → inconnu",
      categorie_bourse_pour_source("portail-x", "Consulate General Services")
      == "inconnu", "")


# ===================== 3. Listes de sources dérivées =========================
print("\n3. engine — listes de sources dérivées de la règle")
connues = sources_bourse_connues()
check("sources connues : daad + campus-france présents, beta_mr absent",
      {"daad", "campus-france"} <= set(connues) and "beta_mr" not in connues,
      str(connues))
check("sources connues : daad-scholarship EXCLU (blog privé → inconnu)",
      "daad-scholarship" not in connues and "daad_scholarship" not in connues,
      str(connues))
check("categorie=inconnu n'a AUCUNE source explicite",
      sources_classifiees("inconnu") == [], str(sources_classifiees("inconnu")))
check("valeur hors taxonomie → aucune source (pas de requête in.() vide)",
      sources_classifiees("bidon") == [], str(sources_classifiees("bidon")))
gouv = sources_classifiees("gouvernementale")
check("gouvernementale contient daad/eiffel/campus-france, PAS erasmus ni daad-scholarship",
      {"daad", "eiffel", "campus-france"} <= set(gouv)
      and "erasmus" not in gouv
      and "daad-scholarship" not in gouv,
      str(gouv))
inst = sources_classifiees("institutionnelle")
check("institutionnelle contient erasmus/erasmus-plus, PAS campus-france",
      {"erasmus", "erasmus-plus"} <= set(inst) and "campus-france" not in inst,
      str(inst))

# --- Normalisation - / _ (formes DB) ---
check("daad-scholarship (forme DB tiret) → daad_scholarship (même clé canonique)",
      _cle_source("daad-scholarship") == "daad_scholarship", "")
check("DAAD-Scholarship (casse + tiret) → daad_scholarship",
      _cle_source("DAAD-Scholarship") == "daad_scholarship", "")
check("daad scholarship (espace) → daad_scholarship",
      _cle_source("daad scholarship") == "daad_scholarship", "")
check("mastercard-foundation (tiret) → mastercard_foundation",
      _cle_source("mastercard-foundation") == "mastercard_foundation", "")
check("campus-france (tiret) → campus_france",
      _cle_source("campus-france") == "campus_france", "")

# --- Cas positifs par catégorie (nouvelles sources) ---
print("\n3b. engine — cas positifs par catégorie (nouvelles sources)")
# Gouvernementale
check("chevening (UK government) → gouvernementale",
      categorie_bourse_pour_source("chevening") == "gouvernementale", "")
check("fulbright (US government) → gouvernementale",
      categorie_bourse_pour_source("fulbright") == "gouvernementale", "")
check("australia_awards → gouvernementale",
      categorie_bourse_pour_source("australia_awards") == "gouvernementale", "")
check("mext (Japan government) → gouvernementale",
      categorie_bourse_pour_source("mext") == "gouvernementale", "")
check("kgsp (Korea government) → gouvernementale",
      categorie_bourse_pour_source("kgsp") == "gouvernementale", "")
check("turkiye_burslari → gouvernementale",
      categorie_bourse_pour_source("turkiye_burslari") == "gouvernementale", "")
check("swiss_government_excellence → gouvernementale",
      categorie_bourse_pour_source("swiss_government_excellence") == "gouvernementale", "")

# Institutionnelle
check("erasmus_mundus → institutionnelle",
      categorie_bourse_pour_source("erasmus_mundus") == "institutionnelle", "")
check("commonwealth_scholarship → institutionnelle",
      categorie_bourse_pour_source("commonwealth_scholarship") == "institutionnelle", "")
check("eacea (EU agency) → institutionnelle",
      categorie_bourse_pour_source("eacea") == "institutionnelle", "")
check("sciences_po (université) → institutionnelle",
      categorie_bourse_pour_source("sciences_po") == "institutionnelle", "")
check("afd (agence française) → institutionnelle",
      categorie_bourse_pour_source("afd") == "institutionnelle", "")
check("giz (agence allemande) → institutionnelle",
      categorie_bourse_pour_source("giz") == "institutionnelle", "")
check("usaid (agence US) → institutionnelle",
      categorie_bourse_pour_source("usaid") == "institutionnelle", "")
check("unesco (ONU) → institutionnelle",
      categorie_bourse_pour_source("unesco") == "institutionnelle", "")
check("banque_mondiale → institutionnelle",
      categorie_bourse_pour_source("banque_mondiale") == "institutionnelle", "")

# Fondation
check("ford_foundation → fondation",
      categorie_bourse_pour_source("ford_foundation") == "fondation", "")
check("gates_foundation → fondation",
      categorie_bourse_pour_source("gates_foundation") == "fondation", "")
check("rockefeller_foundation → fondation",
      categorie_bourse_pour_source("rockefeller_foundation") == "fondation", "")
check("wellcome_trust → fondation",
      categorie_bourse_pour_source("wellcome_trust") == "fondation", "")
check("open_society_foundations → fondation",
      categorie_bourse_pour_source("open_society_foundations") == "fondation", "")
check("al_ghurair_foundation → fondation",
      categorie_bourse_pour_source("al_ghurair_foundation") == "fondation", "")
check("sawiris_foundation → fondation",
      categorie_bourse_pour_source("sawiris_foundation") == "fondation", "")

# Entreprise
check("ocp (Maroc) → entreprise",
      categorie_bourse_pour_source("ocp") == "entreprise", "")
check("attijariwafa (banque) → entreprise",
      categorie_bourse_pour_source("attijariwafa") == "entreprise", "")
check("maroc_telecom → entreprise",
      categorie_bourse_pour_source("maroc_telecom") == "entreprise", "")
check("inwi → entreprise",
      categorie_bourse_pour_source("inwi") == "entreprise", "")
check("orange → entreprise",
      categorie_bourse_pour_source("orange") == "entreprise", "")
check("shell → entreprise",
      categorie_bourse_pour_source("shell") == "entreprise", "")
check("bp → entreprise",
      categorie_bourse_pour_source("bp") == "entreprise", "")
check("exxonmobil → entreprise",
      categorie_bourse_pour_source("exxonmobil") == "entreprise", "")


# ===================== 4. Écriture (save) ====================================
print("\n4. BaseScraper.save — metadata posée sans écraser les autres clés")


class _ScraperTest(BaseScraper):
    def __init__(self, nom):
        self.source_name = nom

    def fetch(self):
        return []


def _offre(titre, source_name, metadata=None, entreprise="Exemple SARL"):
    return OffreStageCreate(
        source=SourceType.AUTRE,
        source_name=source_name,
        source_url=f"https://exemple.mr/{abs(hash(titre))}",
        titre=titre,
        entreprise=entreprise,
        ville=Ville.NOUAKCHOTT,
        type_offre=TypeOffre.BOURSE,
        description="Bourse d'études",
        date_limite=datetime.now(UTC).date() + timedelta(days=30),
        metadata=metadata or {},
    )


_ScraperTest("daad").save(
    [_offre("Bourse DAAD 2027", "daad", {"content_hash": "abc123"})]
)
_nom, data, conflit = FAUX.upserts[-1]
check("upsert sur source_url", conflit == "source_url", str(conflit))
check("metadata['categorie_bourse'] = gouvernementale (DAAD officiel)",
      data["metadata"]["categorie_bourse"] == "gouvernementale",
      str(data["metadata"]))
check("les autres clés metadata sont CONSERVÉES",
      data["metadata"].get("content_hash") == "abc123", str(data["metadata"]))
check("non-régression : type_offre reste bourse",
      data["type_offre"] == "bourse", str(data["type_offre"]))

_ScraperTest("daad-scholarship").save(
    [_offre("10 Steps to Study in Canada", "daad-scholarship")]
)
data_blog = FAUX.upserts[-1][1]
check("écriture daadscholarship.com (blog privé) → catégorie inconnue",
      data_blog["metadata"]["categorie_bourse"] == "inconnu",
      str(data_blog["metadata"]))

_ScraperTest("beta_mr").save([_offre("Recrutement juriste", "beta_mr")])
data_emploi = FAUX.upserts[-1][1]
check("source d'emploi : catégorie inconnue + type_offre emploi_junior",
      data_emploi["metadata"]["categorie_bourse"] == "inconnu"
      and data_emploi["type_offre"] == "emploi_junior",
      str((data_emploi["metadata"], data_emploi["type_offre"])))

_ScraperTest("portail-x").save(
    [_offre("Bourse de l'ambassade", "portail-x", {"autre_cle": "gardée"})]
)
data_amb = FAUX.upserts[-1][1]
check("titre nommant une ambassade → gouvernementale, clé voisine conservée",
      data_amb["metadata"]["categorie_bourse"] == "gouvernementale"
      and data_amb["metadata"].get("autre_cle") == "gardée",
      str(data_amb["metadata"]))

# Règle du 27/10 : le financeur est souvent nommé dans le TITRE (les sources
# réelles sont des agrégateurs neutres). On ne devine jamais : seul un indice
# explicite classe, et « fully funded » (montant) ne fait pas une fondation.
_ScraperTest("afterschool-africa").save(
    [_offre("University of Melbourne Graduate Research Scholarships", "afterschool-africa",
            entreprise="afterschool-africa")]
)
check("agrégateur + « University of… » → institutionnelle",
      FAUX.upserts[-1][1]["metadata"]["categorie_bourse"] == "institutionnelle",
      str(FAUX.upserts[-1][1]["metadata"]))

_ScraperTest("scholar-africa").save(
    [_offre("Mastercard Foundation Scholars Program 2027", "scholar-africa",
            entreprise="scholar-africa")]
)
check("« Mastercard Foundation » → fondation",
      FAUX.upserts[-1][1]["metadata"]["categorie_bourse"] == "fondation",
      str(FAUX.upserts[-1][1]["metadata"]))

_ScraperTest("opportunities-for-youth").save(
    [_offre("Fully Funded Scholarships for African Students", "opportunities-for-youth",
            entreprise="opportunities-for-youth")]
)
check("« fully funded » seul (montant) → inconnu, PAS fondation",
      FAUX.upserts[-1][1]["metadata"]["categorie_bourse"] == "inconnu",
      str(FAUX.upserts[-1][1]["metadata"]))

_ScraperTest("MESRS Mauritanie").save(
    [_offre("Bourse au Brésil", "MESRS Mauritanie",
            entreprise="Gouvernement du Brésil")]
)
data_mesrs = FAUX.upserts[-1][1]
check("cas MESRS : « Gouvernement du Brésil » → gouvernementale",
      data_mesrs["metadata"]["categorie_bourse"] == "gouvernementale",
      str(data_mesrs["metadata"]))

# --- Non-écrasement des autres clés metadata ---
_ScraperTest("daad").save(
    [_offre("Bourse DAAD 2027", "daad",
            metadata={"content_hash": "abc123", "custom_field": "valeur", "autre": 42})]
)
data_preserve = FAUX.upserts[-1][1]
check("metadata : toutes les clés existantes sont CONSERVÉES (content_hash, custom_field, autre)",
      data_preserve["metadata"].get("content_hash") == "abc123"
      and data_preserve["metadata"].get("custom_field") == "valeur"
      and data_preserve["metadata"].get("autre") == 42,
      str(data_preserve["metadata"]))
check("metadata : categorie_bourse ajoutée sans toucher aux autres",
      data_preserve["metadata"]["categorie_bourse"] == "gouvernementale"
      and len(data_preserve["metadata"]) == 4,
      str(data_preserve["metadata"]))

# Source classée + metadata legacy existant → on REMPLACE la clé categorie_bourse seulement
_ScraperTest("mastercard_foundation").save(
    [_offre("MCF Scholars", "mastercard_foundation",
            metadata={"categorie_bourse": "inconnu", "content_hash": "xyz", "version": 1})]
)
data_replace = FAUX.upserts[-1][1]
check("metadata legacy avec mauvaise categorie_bourse → REMPLACÉE par la bonne (fondation)",
      data_replace["metadata"]["categorie_bourse"] == "fondation"
      and data_replace["metadata"].get("content_hash") == "xyz"
      and data_replace["metadata"].get("version") == 1,
      str(data_replace["metadata"]))


# ===================== 5. Lecture publique ===================================
print("\n5. OffreStagePublic — lecture depuis metadata (legacy toléré)")
check("metadata valide → catégorie servie",
      OffreStagePublic.model_validate(
          _ligne("33333333-3333-3333-3333-333333333333", "mastercard-foundation",
                 {"categorie_bourse": "fondation"})
      ).categorie_bourse == "fondation", "")
check("ligne legacy SANS metadata, source non classée → inconnu (jamais de 500)",
      OffreStagePublic.model_validate(
          _ligne("44444444-4444-4444-4444-444444444444", "scholar-africa")
      ).categorie_bourse == "inconnu", "")
check("ligne legacy SANS metadata, source classée (DAAD officiel) → inconnu EN LECTURE",
      categorie_bourse_pour_offre(None, "daad") == "inconnu",
      categorie_bourse_pour_offre(None, "daad"))
check("… mais la règle d'ÉCRITURE la classe gouvernementale (backfill/ingestion)",
      categorie_bourse_pour_source("daad") == "gouvernementale",
      categorie_bourse_pour_source("daad"))
check("ligne legacy SANS metadata, daad-scholarship (blog) → inconnu des deux côtés",
      categorie_bourse_pour_offre(None, "daad-scholarship") == "inconnu"
      and categorie_bourse_pour_source("daad-scholarship") == "inconnu",
      categorie_bourse_pour_offre(None, "daad-scholarship"))
check("valeur hors taxonomie → inconnu (jamais devinée en lecture)",
      categorie_bourse_pour_offre({"categorie_bourse": "bidon"}) == "inconnu", "")
check("metadata absente/None et source inconnue → inconnu",
      categorie_bourse_pour_offre(None) == "inconnu", "")


# ===================== 6. Endpoints publics ==================================
print("\n6. Endpoints — filtre ?categorie= et comptage /offres/categories")


IDS = [ligne["id"] for ligne in OFFRES]


def _indices(offres):
    """Indices 1-based des lignes de `OFFRES` servies par la liste."""
    return {IDS.index(str(o.id)) + 1 for o in offres}


gouv = asyncio.run(
    list_offres(type_offre=None, categorie=CategorieBourse.GOUVERNEMENTALE,
                limit=50, offset=0)
)
check("?categorie=gouvernementale → DAAD officiel uniquement (offre 1)",
      _indices(gouv) == {1}, str(_indices(gouv)))
check("?categorie=gouvernementale EXCLUT daad-scholarship (offre 8, blog privé)",
      8 not in _indices(gouv), str(_indices(gouv)))
check("chaque offre porte sa catégorie dans le payload",
      all(o.categorie_bourse == "gouvernementale" for o in gouv),
      str([o.categorie_bourse for o in gouv]))
check("l'offre Campus France ÉCHUE (6) n'est jamais servie",
      6 not in _indices(gouv), str(_indices(gouv)))

inst = asyncio.run(
    list_offres(type_offre=None, categorie=CategorieBourse.INSTITUTIONNELLE,
                limit=50, offset=0)
)
check("?categorie=institutionnelle → erasmus (offre 2)",
      _indices(inst) == {2} and inst[0].categorie_bourse == "institutionnelle",
      str(_indices(inst)))

inconnu = asyncio.run(
    list_offres(type_offre=None, categorie=CategorieBourse.INCONNU, limit=50, offset=0)
)
check("?categorie=inconnu → lignes sans clé valide (4, 5, 7, 8) et RIEN d'autre",
      _indices(inconnu) == {4, 5, 7, 8}, str(_indices(inconnu)))

fondation = asyncio.run(
    list_offres(type_offre=None, categorie=CategorieBourse.FONDATION, limit=50, offset=0)
)
check("?categorie=fondation → Mastercard Foundation uniquement",
      _indices(fondation) == {3} and fondation[0].categorie_bourse == "fondation",
      str([(str(o.id), o.categorie_bourse) for o in fondation]))

entreprise = asyncio.run(
    list_offres(type_offre=None, categorie=CategorieBourse.ENTREPRISE, limit=50, offset=0)
)
check("?categorie=entreprise (aucune source classée) → liste vide, sans erreur",
      entreprise == [], str(entreprise))

check("?categorie=bidon → 422 (validation FastAPI)",
      CLIENT.get("/api/v1/offres?categorie=bidon").status_code == 422,
      str(CLIENT.get("/api/v1/offres?categorie=bidon").status_code))

reponse = CLIENT.get("/api/v1/offres/categories")
attendus = {
    "gouvernementale": 1,   # daad (officiel) — campus-france est ÉCHUE
    "institutionnelle": 1,  # erasmus
    "fondation": 1,         # mastercard-foundation
    "entreprise": 0,        # aucune source classée
    "inconnu": 4,           # scholar-africa + beta_mr + bidon + daad-scholarship
}
check("/offres/categories → 200 (route déclarée AVANT /offres/{offre_id})",
      reponse.status_code == 200, str(reponse.status_code))
check("comptage réel actives + échéance future",
      reponse.json() == attendus, str(reponse.json()))
check("la réponse expose exactement les 5 catégories de la taxonomie",
      set(reponse.json()) == set(CATEGORIES_BOURSE), str(sorted(reponse.json())))
check("comptage direct (fonction) = même vérité que la route",
      asyncio.run(categories_offres()) == attendus, "")

# --------------------------------- Bilan --------------------------------------
print(f"\n{'=' * 60}")
if ECHECS:
    print(f"RÉSULTAT : {len(ECHECS)} échec(s) → {ECHECS}")
    sys.exit(1)
print("RÉSULTAT : 100 % des checks sont VERTS (zéro réseau, zéro migration SQL).")
