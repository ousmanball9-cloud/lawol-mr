from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import date, datetime
from enum import Enum
from typing import Literal, Optional
from uuid import UUID, uuid4
import bleach


# ---------- Enums (mêmes valeurs que le schéma SQL) ----------
class TypeOffre(str, Enum):
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
    AUTRE = "autre"


class Ville(str, Enum):
    NOUAKCHOTT = "nouakchott"
    NOUADHIBOU = "nouadhibou"
    KAEDI = "kaedi"
    ROSSO = "rosso"
    ALEG = "aleg"
    AUTRE = "autre"


class SourceType(str, Enum):
    LINKEDIN = "linkedin"
    ENTREPRISE = "entreprise"
    ANPE = "anpe"
    UNIVERSITE = "universite"
    WHATSAPP = "whatsapp"
    AUTRE = "autre"


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
    filieres_cibles: list[Filiere] = Field(default_factory=list)
    type_offre: TypeOffre = TypeOffre.STAGE_PFE
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
    ville: Ville
    filieres_cibles: list[Filiere]
    type_offre: TypeOffre
    description: str
    date_limite: date
    contact_email: Optional[EmailStr] = None
    contact_whatsapp: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None

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
    ville: Ville = Ville.NOUAKCHOTT
    types_recherches: list[TypeOffre] = Field(default_factory=lambda: [TypeOffre.STAGE_PFE])
    filieres_interet: list[Filiere] = Field(default_factory=list)
    optin_at: Optional[datetime] = None
    optin_texte: Optional[str] = None

    @field_validator("nom", "prenom", "universite", mode="before")
    @classmethod
    def sanitize_fields(cls, v):
        return _sanitize(v)


class ProfilEtudiantCreate(ProfilEtudiantBase):
    pass


class ProfilEtudiantUpdate(BaseModel):
    """Champs modifiables par l'étudiant (tous optionnels)."""

    nom: Optional[str] = Field(default=None, min_length=2, max_length=100)
    prenom: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    universite: Optional[str] = Field(default=None, min_length=2, max_length=200)
    filiere: Optional[Filiere] = None
    niveau: Optional[str] = Field(default=None, min_length=1, max_length=50)
    ville: Optional[Ville] = None
    types_recherches: Optional[list[TypeOffre]] = None
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

    POSTULE = "postule"
    EN_COURS = "en_cours"
    REPONSE_RECUE = "reponse_recue"
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


class PreferencesAvancees(BaseModel):
    """Préférences avancées stockées dans profils.metadata['prefs_avancees']."""

    villes_exclues: list[Ville] = Field(default_factory=list)
    types_masques: list[TypeOffre] = Field(default_factory=list)
    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)


class PreferencesAvanceesUpdate(BaseModel):
    """PATCH /profils/{tel}/preferences — corps partiel (seuls champs fournis)."""

    villes_exclues: Optional[list[Ville]] = None
    types_masques: Optional[list[TypeOffre]] = None
    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)


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


class PosteAnnee(BaseModel):
    poste: str
    count: int


class DashboardResponse(BaseModel):
    profil: DashboardProfil
    resume: ResumeHebdo
    postes_annee: list[PosteAnnee]


# ---------- Stats (dashboard admin) ----------
class StatsResponse(BaseModel):
    offres_actives: int
    etudiants_actifs: int
    matches_total: int
    matches_notifies: int
    matches_postules: int = 0
    taux_notification: float
    # File de validation P6-A (0 tant que la migration 003_p6.sql n'est pas appliquée)
    offres_en_attente: int = 0


# ---------- P6-A : entreprises & pipeline offres ----------
class StatutPublication(str, Enum):
    """Statut de publication d'une offre (colonne offres.statut_publication)."""

    ACTIVE = "active"
    PENDING_REVIEW = "pending_review"
    REJETEE = "rejetee"


class EntrepriseInscription(BaseModel):
    """POST /api/v1/entreprises/inscription — fiche + compte entreprise."""

    nom: str = Field(min_length=2, max_length=200)
    secteur: Optional[str] = Field(default=None, max_length=120)
    ville: Ville = Ville.NOUAKCHOTT
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)  # v1 : min 8 caractères
    description: Optional[str] = Field(default=None, max_length=2000)
    site_url: Optional[str] = Field(default=None, max_length=300)
    telephone: Optional[str] = Field(default=None, max_length=30)

    @field_validator("nom", "secteur", "description", mode="before")
    @classmethod
    def sanitize_fields(cls, v):
        return _sanitize(v)


class EntrepriseLogin(BaseModel):
    """POST /api/v1/entreprises/login."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenEntreprise(BaseModel):
    """POST /logout + envoi du token dans le corps (dépôt d'offre).

    Token absent → 401 côté handler ; token court → 422 (validation)."""

    token: Optional[str] = Field(default=None, min_length=8, max_length=64)


class EntrepriseInscriptionReponse(BaseModel):
    entreprise_id: UUID
    message: str = "Compte créé"


class EntrepriseLoginReponse(BaseModel):
    token: str
    entreprise_id: UUID
    expires_in_jours: int = 7


class OffreEntrepriseCreate(OffreStageCreate):
    """Offre déposée par une entreprise : le corps reprend OffreStageCreate
    auquel s'ajoute le token d'authentification. source/source_name/
    source_url/entreprise sont calculés côté serveur (règles métier P6-A)."""

    token: Optional[str] = Field(default=None, min_length=8, max_length=64)
    source: Optional[SourceType] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    entreprise: Optional[str] = None


class OffreEntrepriseResume(BaseModel):
    id: UUID
    titre: str
    ville: Ville
    type_offre: TypeOffre
    date_limite: date
    statut_publication: StatutPublication = StatutPublication.ACTIVE
    active: bool = True
    url_publique: Optional[str] = None
    nb_matches: int = 0
    nb_postules: int = 0


class OffreEntrepriseReponse(BaseModel):
    id: UUID
    statut_publication: StatutPublication
    message: str = "Offre soumise à validation"


class ProfilCandidature(BaseModel):
    id: UUID
    nom: str
    prenom: str
    telephone: str
    universite: str
    filiere: str
    niveau: str
    ville: str


class OffreCandidature(BaseModel):
    id: UUID
    titre: str
    entreprise: str
    ville: str
    type_offre: str
    date_limite: date


class CandidatureEntreprise(BaseModel):
    """Une ligne du suivi employeur : le match + l'étudiant + l'offre."""

    match_id: UUID
    date_match: date
    score: int = 100
    notifie: bool = False
    postule: bool = False
    favori: bool = False
    statut_candidature: Optional[str] = None
    profil: ProfilCandidature
    offre: OffreCandidature


class EntreprisePublique(BaseModel):
    id: UUID
    nom: str
    ville: Ville = Ville.NOUAKCHOTT
    secteur: Optional[str] = None
    nb_offres_actives: int = 0


class EntrepriseFiche(EntreprisePublique):
    description: Optional[str] = None
    site_url: Optional[str] = None
    telephone: Optional[str] = None
    email_contact: Optional[str] = None
    logo_url: Optional[str] = None
    verifiee: bool = False
    created_at: Optional[datetime] = None
    offres: list[OffreEntrepriseResume] = Field(default_factory=list)


class PublicationUpdate(BaseModel):
    """PATCH /api/v1/admin/offres/{id}/publication — file de validation."""

    statut: Literal["active", "rejetee"]
