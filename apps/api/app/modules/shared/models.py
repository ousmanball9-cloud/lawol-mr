from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4
import bleach


# ---------- Enums (mêmes valeurs que le schéma SQL) ----------
class TypeOffre(str, Enum):
    STAGE_PFE = "stage_pfe"
    STAGE_ETE = "stage_ete"
    EMPLOI_JUNIOR = "emploi_junior"
    ALTERNANCE = "alternance"


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
    date_match: date

    model_config = {"from_attributes": True}


# ---------- Stats (dashboard admin) ----------
class StatsResponse(BaseModel):
    offres_actives: int
    etudiants_actifs: int
    matches_total: int
    matches_notifies: int
    taux_notification: float