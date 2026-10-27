from datetime import date, datetime
from enum import Enum
from typing import Any, Literal, Optional
from uuid import UUID

import bleach
from apps.api.app.modules.scraper.engine import (
    CategorieBourse,
    categorie_bourse_pour_offre,
)
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ---------- Enums (mêmes valeurs que le schéma SQL) ----------
class TypeOffre(str, Enum):
    """Types ACCEPTÉS À L'ÉCRITURE (refonte 100 % bourses, commit d884e2f)."""

    BOURSE = "bourse"


class TypeOffreDb(str, Enum):
    """Valeurs du type SQL `type_offre` (infra/supabase/schema.sql) — LECTURE seule.

    La colonne Postgres garde les types hérités (`stage_pfe`, `stage_ete`,
    `emploi_junior`, `alternance`, + `bourse` ajouté par migration) : le
    sérialiseur public les accepte tels quels pour ne jamais faire échouer
    la liste sur une ligne legacy. L'écriture reste bridée à TypeOffre.BOURSE.
    """

    STAGE_PFE = "stage_pfe"
    STAGE_ETE = "stage_ete"
    EMPLOI_JUNIOR = "emploi_junior"
    ALTERNANCE = "alternance"
    BOURSE = "bourse"


class Filiere(str, Enum):
    INFORMATIQUE = "informatique"
    GENIE_CIVIL = "genie_civil"
    ELECTRIQUE = "electrique"
    MECANIQUE = "mecanique"
    GESTION = "gestion"
    FINANCE = "finance"
    DROIT = "droit"
    MEDECINE = "medecine"
    AGRONOMIE = "agronomie"
    GENIE_PROCEDES = "genie_procedes"
    ENVIRONNEMENT = "environnement"
    GENIE_CHIMIQUE = "genie_chimique"
    GENIE_INDUSTRIEL = "genie_industriel"
    TELECOMS = "telecoms"
    RESEAUX = "reseaux"
    CYBERSECURITE = "cybersecurite"
    DATA_SCIENCE = "data_science"
    INTELLIGENCE_ARTIFICIELLE = "intelligence_artificielle"
    MATHEMATIQUES = "mathematiques"
    PHYSIQUE = "physique"
    CHIMIE = "chimie"
    BIOLOGIE = "biologie"
    GEOLOGIE = "geologie"
    HYDRAULIQUE = "hydraulique"
    TOPOGRAPHIE = "topographie"
    ARCHITECTURE = "architecture"
    URBANISME = "urbanisme"
    SCIENCES_POLITIQUES = "sciences_politiques"
    SOCIOLOGIE = "sociologie"
    PSYCHOLOGIE = "psychologie"
    LANGUES = "langues"
    LETTRES = "lettres"
    HISTOIRE = "histoire"
    GEOGRAPHIE = "geographie"
    AUTRE = "autre"


class Ville(str, Enum):
    NOUAKCHOTT = "nouakchott"
    NOUADHIBOU = "nouadhibou"
    KAEDI = "kaedi"
    ROSSO = "rosso"
    ALEG = "aleg"
    AUTRE = "autre"


class PaysEtudes(str, Enum):
    """Pays d'études pour les bourses internationales."""
    FRANCE = "france"
    CANADA = "canada"
    USA = "usa"
    ALLEMAGNE = "allemagne"
    ROYAUME_UNI = "royaume_uni"
    ESPAGNE = "espagne"
    ITALIE = "italie"
    BELGIQUE = "belgique"
    SUISSE = "suisse"
    PAYS_BAS = "pays_bas"
    SUEDE = "suede"
    NORVEGE = "norvege"
    FINLANDE = "finlande"
    DANEMARK = "danemark"
    AUTRICHE = "autriche"
    IRLANDE = "irlande"
    PORTUGAL = "portugal"
    GRECE = "grece"
    POLOGNE = "pologne"
    TURQUIE = "turquie"
    MAROC = "maroc"
    TUNISIE = "tunisie"
    ALGERIE = "algerie"
    SENEGAL = "senegal"
    COTE_IVOIRE = "cote_ivoire"
    # Destinations réellement présentes dans le catalogue (mesure du 27/10/2026 :
    # 38 offres actives nommaient un de ces pays sans qu'il existe dans l'enum —
    # elles tombaient donc dans `autre` et devenaient introuvables par le filtre
    # « Pays d'études », qui ne liste que des valeurs de l'enum).
    JAPON = "japon"
    CHINE = "chine"
    COREE_SUD = "coree_sud"
    INDE = "inde"
    AFRIQUE_DU_SUD = "afrique_du_sud"
    AUSTRALIE = "australie"
    NOUVELLE_ZELANDE = "nouvelle_zelande"
    RUSSIE = "russie"
    QATAR = "qatar"
    ARABIE_SAOUDITE = "arabie_saoudite"
    EGYPTE = "egypte"
    BRESIL = "bresil"
    MEXIQUE = "mexique"
    AUTRE = "autre"


class TypeFinancement(str, Enum):
    """Type de financement de la bourse."""
    FULLY_FUNDED = "fully_funded"        # 100% couvert (frais de scolarité + vie + voyage)
    PARTIEL = "partiel"                   # Partiellement couvert (ex: frais scolarité seulement)
    AUTO_FINANCE = "auto_finance"         # Non financée / auto-financée
    INCONNU = "inconnu"                   # Non précisé dans l'annonce


class TriOffres(str, Enum):
    """Ordre de la liste publique (`GET /api/v1/offres?tri=`) — vocabulaire du front."""

    URGENT = "urgent"  # date_limite croissante : les plus urgentes d'abord
    RECENTES = "recentes"  # date_scrape décroissant : ordre historique (défaut)


class SourceType(str, Enum):
    LINKEDIN = "linkedin"
    ENTREPRISE = "entreprise"
    ANPE = "anpe"
    UNIVERSITE = "universite"
    WHATSAPP = "whatsapp"
    AUTRE = "autre"


class StatutPublication(str, Enum):
    """Statut de publication d'une offre entreprise (migration 003_p6.sql)."""

    ACTIVE = "active"
    PENDING_REVIEW = "pending_review"
    REJETEE = "rejetee"


# ---------- Sanitisation (anti-XSS) ----------
def _sanitize(v: str) -> str:
    if isinstance(v, str):
        return bleach.clean(v, tags=[], attributes={}, strip=True)
    return v


# ---------- Offres ----------
class OffreStageBase(BaseModel):
    source: SourceType
    source_name: str = Field(min_length=2, max_length=100)
    source_url: str = Field(max_length=500)
    titre: str = Field(min_length=3, max_length=300)
    entreprise: str = Field(min_length=2, max_length=200)
    ville: Ville = Ville.NOUAKCHOTT
    pays_etudes: Optional[PaysEtudes] = None
    filieres_cibles: list[Filiere] = Field(default_factory=list)
    type_offre: TypeOffre = TypeOffre.BOURSE
    type_financement: TypeFinancement = TypeFinancement.INCONNU
    description: str = ""
    date_limite: date
    contact_email: Optional[EmailStr] = None
    contact_whatsapp: Optional[str] = None
    # jsonb `offres.metadata` : axe FINANCEUR (`categorie_bourse`) et autres
    # clés libres. Écrit par `BaseScraper.save` sans écraser les clés existantes.
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("titre", "entreprise", "description", mode="before")
    @classmethod
    def sanitize_fields(cls, v):
        return _sanitize(v)


class OffreStageCreate(OffreStageBase):
    pass


class OffreStagePublic(BaseModel):
    id: UUID
    titre: str
    entreprise: str
    pays_etudes: Optional[PaysEtudes] = None
    filieres_cibles: list[Filiere]
    # Lecture : TypeOffreDb (valeurs SQL legacy incluses) — voir note en tête de fichier.
    type_offre: TypeOffreDb
    type_financement: TypeFinancement = TypeFinancement.INCONNU
    description: str
    # Renseigné par la LISTE `/offres` uniquement : aperçu court de la description
    # (la carte du catalogue n'affiche que deux lignes). Le détail `/offres/{id}`
    # sert le texte intégral dans `description` et laisse ce champ vide.
    description_apercu: Optional[str] = None
    date_limite: date
    contact_email: Optional[EmailStr] = None
    contact_whatsapp: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    active: bool = True
    # Axe FINANCEUR (≠ `type_offre`, la nature) : lu dans
    # `metadata['categorie_bourse']` ; ligne legacy sans metadata → même règle
    # par source que le filtre `?categorie=` (sinon « inconnu »).
    categorie_bourse: str = CategorieBourse.INCONNU.value

    @model_validator(mode="before")
    @classmethod
    def _categorie_bourse_depuis_metadata(cls, data):
        if isinstance(data, dict) and "categorie_bourse" not in data:
            return {
                **data,
                "categorie_bourse": categorie_bourse_pour_offre(
                    data.get("metadata"),
                    data.get("source_name"),
                    data.get("entreprise") or "",
                    data.get("titre") or "",
                ),
            }
        return data

    @model_validator(mode="after")
    def _apercu_de_secours(self):
        """Garantit TOUJOURS un aperçu lisible sur une carte.

        Mesuré le 27/10/2026 sur le catalogue live : 12 cartes affichées,
        **11 aperçus rendus**. Trois offres n'avaient qu'une amorce vide ou
        inutile (« Test », « Date de clôture : 31 October 2026. ») : la carte
        paraissait cassée et l'étudiant n'avait rien à lire pour décider.

        Le repli est calculé ici (et non dans une route) pour que TOUT
        consommateur en hérite : titre + organisme + date limite, sans jamais
        inventer de contenu.
        """
        actuel = (self.description_apercu or "").strip()
        if len(actuel) >= 40:
            return self
        texte = (self.description or "").strip()
        if len(texte) >= 40:
            self.description_apercu = texte[:180].rstrip()
        else:
            self.description_apercu = (
                f"{self.titre} — {self.entreprise}. "
                f"Candidature avant le {self.date_limite:%d/%m/%Y}."
            )
        return self

    model_config = {"from_attributes": True}


# ---------- Profils étudiants ----------
class ProfilEtudiantBase(BaseModel):
    telephone: str = Field(pattern=r"^222\d{8}$")
    nom: str = Field(min_length=2, max_length=100)
    prenom: str = Field(min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    universite: str = Field(min_length=2, max_length=200)
    filiere: Filiere
    niveau: str = Field(min_length=1, max_length=50)
    pays_etudes: Optional[PaysEtudes] = None
    types_recherches: list[TypeOffre] = Field(default_factory=lambda: [TypeOffre.BOURSE])
    filieres_interet: list[Filiere] = Field(default_factory=list)
    optin_at: Optional[datetime] = None
    optin_texte: Optional[str] = None

    @field_validator("nom", "prenom", "universite", mode="before")
    @classmethod
    def sanitize_fields(cls, v):
        return _sanitize(v)


class ProfilEtudiantCreate(ProfilEtudiantBase):
    """Création de profil.

    `code_pin` (4-6 chiffres) est optionnel côté API mais exigé par le frontend :
    il est hashé dans profils.metadata['code_pin_hash'], JAMAIS stocké en clair
    et jamais renvoyé dans une réponse (ProfilEtudiant n'expose pas metadata).
    """

    code_pin: Optional[str] = Field(default=None, pattern=r"^\d{4,6}$")


class ConnexionProfilRequete(BaseModel):
    """POST /api/v1/profils/{tel}/connexion — vérification du code PIN."""

    code_pin: str = Field(pattern=r"^\d{4,6}$")


class SessionProfilReponse(BaseModel):
    """Token de session signé (HMAC) + téléphone + durée restante en minutes."""

    token: str
    telephone: str
    expires_in_minutes: int


class ProfilEtudiantUpdate(BaseModel):
    """Champs modifiables par l'étudiant (tous optionnels)."""

    nom: Optional[str] = Field(default=None, min_length=2, max_length=100)
    prenom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    universite: Optional[str] = Field(default=None, min_length=2, max_length=200)
    filiere: Optional[Filiere] = None
    niveau: Optional[str] = Field(default=None, min_length=1, max_length=50)
    pays_etudes: Optional[PaysEtudes] = None
    filieres_interet: Optional[list[Filiere]] = None

    @field_validator("nom", "prenom", "universite", mode="before")
    @classmethod
    def sanitize_fields(cls, v):
        return _sanitize(v)


class ProfilEtudiant(ProfilEtudiantBase):
    id: UUID
    actif: bool = True
    date_inscription: date
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Matches ----------
class Match(BaseModel):
    id: UUID
    offre_id: UUID
    profil_id: UUID
    score: int = 100
    notifie: bool = False
    postule: bool = False
    date_match: date

    model_config = {"from_attributes": True}


# ---------- P5 : favoris, statut de candidature, préférences, dashboard ----------
class StatutCandidature(str, Enum):
    """Statut de candidature attendu (pas de CHECK côté SQL, validation Pydantic)."""

    # Pipeline bourses (audit 2026-10) : à préparer → postulé → en cours →
    # réponse → présélection → entretien → obtenue/refusée.
    A_PREPARER = "a_preparer"
    POSTULE = "postule"
    EN_COURS = "en_cours"
    REPONSE_RECUE = "reponse_recue"
    PRES_SELECTION = "pres_selection"
    ENTRETIEN = "entretien"
    ACCEPTE = "accepte"
    REFUSE = "refuse"
    # « Pas intéressé » (27/10/2026) : ce n'est PAS une étape du pipeline de
    # candidature, c'est un rejet du match par l'étudiant. Valeur ajoutée ici
    # (aucun CHECK côté SQL) pour que la liste du profil cesse d'afficher une
    # offre écartée, tout en la gardant RÉVERSIBLE (statut remis à null).
    PAS_INTERESSE = "pas_interesse"


STATUTS_TERMINES = {StatutCandidature.ACCEPTE.value, StatutCandidature.REFUSE.value}


class FavoriUpdate(BaseModel):
    """PATCH /matches/{id}/favori — corps strict : booléen obligatoire."""

    favori: bool


class StatutUpdate(BaseModel):
    """PATCH /matches/{id}/statut — statut obligatoire, null = remise à zéro."""

    statut: Optional[StatutCandidature] = None


class PosteAnnee(BaseModel):
    """Poste et nombre d'offres pour l'année en cours (dashboard)."""
    poste: str
    count: int


class PublicationUpdate(BaseModel):
    statut: Literal["active", "rejetee"]


class PreferencesAvancees(BaseModel):
    """Préférences avancées stockées dans profils.metadata['prefs_avancees']."""
    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)
    pays_favoris: list[PaysEtudes] = Field(default_factory=list)  # pays d'études préférés
    financement_min: Optional[TypeFinancement] = None  # niveau minimal de financement
    # Lues par le moteur (`matching/engine.py`, filtres `villes_exclues` /
    # `types_masques`) mais ABSENTES de ce modèle jusqu'au 27/10/2026 : le front
    # les envoyait, Pydantic les ignorait silencieusement → l'étudiant cochait,
    # rien n'était enregistré, et le matching ne filtrait jamais.
    # types_masques utilise TypeOffreDb (valeurs SQL legacy incluses) pour accepter
    # les types existants en base (stage_pfe, stage_ete, emploi_junior, alternance, bourse).
    villes_exclues: list[Ville] = Field(default_factory=list)
    types_masques: list[TypeOffreDb] = Field(default_factory=list)


class PreferencesAvanceesUpdate(BaseModel):
    """PATCH /profils/{tel}/preferences — corps partiel (seuls champs fournis)."""

    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)
    pays_favoris: Optional[list[PaysEtudes]] = None
    financement_min: Optional[TypeFinancement] = None
    villes_exclues: Optional[list[Ville]] = None
    # TypeOffreDb : accepte valeurs legacy (stage_pfe, stage_ete,
    # emploi_junior, alternance, bourse)
    types_masques: Optional[list[TypeOffreDb]] = None


class StatsResponse(BaseModel):
    offres_actives: int
    etudiants_actifs: int
    matches_total: int
    matches_notifies: int
    matches_postules: int = 0
    taux_notification: float
    offres_en_attente: int = 0


class DashboardProfil(BaseModel):
    id: UUID
    nom: str
    prenom: str
    score_profil: int = Field(ge=0, le=100)


class ResumeHebdo(BaseModel):
    offres_dispo: int = 0
    nouvelles_7j: int = 0
    postules_total: int = 0
    en_cours: int = 0


class DashboardResponse(BaseModel):
    profil: DashboardProfil
    resume: ResumeHebdo
    postes_annee: list['PosteAnnee']


# Resolve forward references
DashboardResponse.model_rebuild()
