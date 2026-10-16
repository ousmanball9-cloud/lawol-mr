from datetime import date, datetime
from enum import Enum
from typing import Literal, Optional
from uuid import UUID

import bleach
from pydantic import BaseModel, EmailStr, Field, field_validator


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


class PreferencesAvanceesUpdate(BaseModel):
    """PATCH /profils/{tel}/preferences — corps partiel (seuls champs fournis)."""

    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)
    pays_favoris: Optional[list[PaysEtudes]] = None
    financement_min: Optional[TypeFinancement] = None


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
