"""Routes /api/v1/candidatures — dossier de candidature réellement généré.

Contrat :
- POST /api/v1/candidatures/{offre_id}/dossier → 200
  ``{statut: "dossier_pret", url, expire_dans, offre_id, pieces, genere_le}``.
  Le corps accepte ``{telephone?, lettre?, pieces?}`` :
  · ``telephone`` sert de contrôle d'appartenance (403 s'il diffère du token) ;
  · ``lettre``  texte libre ; vide/absent → gabarit honnête (aucune invention) ;
  · ``pieces``  ids de documents du coffre ; absent → toutes les pièces ;
                un id inconnu est simplement ignoré (jamais d'erreur).

Sécurité :
- garde Bearer identique aux routes du profil : sans token → 401 ; un
  ``telephone`` de corps différent du token → 403 (zéro dossier inter-profils) ;
- bucket PRIVÉ ``documents`` ; l'objet vit sous ``dossiers/{tel DU TOKEN}/
  {offre_id}.pdf`` — le chemin est reconstruit uniquement avec l'identifiant
  de l'offre lu EN BASE et le téléphone du token, jamais avec une valeur client ;
- l'URL de téléchargement est SIGNÉE et courte (60 s) : aucune URL publique
  permanente n'existe (``get_public_url`` n'est jamais appelé) ;
- offre inexistante/inactive/expirée → 404 ; profil absent → 404 ;
- aucune écriture SQL, aucun envoi email (lot 2) : seule la génération du PDF
  et son dépôt dans le bucket privé sont effectués.
"""

from datetime import date, datetime, timezone
from typing import Optional

from apps.api.app.core.database import supabase
from apps.api.app.modules.auth.garde import session_profil
from fastapi import APIRouter, Depends, HTTPException
from fpdf import FPDF
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/candidatures", tags=["candidatures"])

BUCKET = "documents"  # bucket PRIVÉ (le même que le coffre-fort)
PREFIXE_DOSSIERS = "dossiers"
CLE_DOCUMENTS = "documents"  # clé de profils.metadata (jsonb, sans migration)
TTL_URL_SIGNEE = 60  # durée de vie du lien de téléchargement (secondes)
LETTRE_MAX = 6000  # borne le texte fourni (anti-abus de payload)
PIECES_MAX = 20
NOM_PIECE_MAX = 80


# ---------- Corps de requête ----------
class DossierDemande(BaseModel):
    """Corps optionnel : contrôle d'appartenance + lettre + pièces sélectionnées."""

    telephone: Optional[str] = None
    lettre: Optional[str] = None
    # None = toutes les pièces du coffre ; [] = aucune (choix explicite).
    pieces: Optional[list[str]] = Field(default=None)


# ---------- Helpers de lecture ----------
def _profil(telephone: str) -> dict | None:
    """Ligne profil (identité + metadata) ou None si le numéro n'existe pas."""
    res = (
        supabase.table("profils")
        .select("id, telephone, prenom, nom, filiere, niveau, metadata")
        .eq("telephone", telephone)
        .execute()
    )
    return dict(res.data[0]) if res.data else None


def _offre(offre_id: str) -> dict | None:
    """Offre PUBLIQUE : active et échéance future (même garde que le détail)."""
    res = (
        supabase.table("offres")
        .select("*")
        .eq("id", offre_id)
        .eq("active", True)
        .gte("date_limite", date.today().isoformat())
        .execute()
    )
    return dict(res.data[0]) if res.data else None


def _documents_du_profil(profil: dict) -> list[dict]:
    """Entrées documents valides de metadata (tolère un jsonb corrompu)."""
    metadata = profil.get("metadata")
    entrees = metadata.get(CLE_DOCUMENTS) if isinstance(metadata, dict) else None
    if not isinstance(entrees, list):
        return []
    return [e for e in entrees if isinstance(e, dict) and e.get("id")]


def _pieces_choisies(documents: list[dict], demandes: Optional[list[str]]) -> list[dict]:
    """Pièces retenues : toutes si ``demandes`` absent, sinon les ids connus.

    Un id fourni mais absent du coffre est ignoré (aucune erreur), et l'ordre
    du coffre est conservé — le PDF reste stable d'une génération à l'autre.
    """
    if demandes is None:
        return list(documents)
    voulus = {str(i) for i in demandes[:PIECES_MAX] if isinstance(i, str) and i}
    return [d for d in documents if str(d.get("id")) in voulus]


def _nom_piece(document: dict) -> str:
    """Nom lisible et borné d'une pièce (jamais de chemin Storage)."""
    nom = document.get("nom")
    if not isinstance(nom, str) or not nom.strip():
        return "Pièce sans nom"
    return nom.strip()[:NOM_PIECE_MAX]


# ---------- Texte du PDF ----------
_REMPLACEMENTS = {
    "\u2019": "'",
    "\u2018": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2013": "-",
    "\u2014": "-",
    "\u2026": "...",
    "\u0153": "oe",
    "\u0152": "OE",
    "\u20ac": "EUR",
    "\u2022": "-",
    "\u00a0": " ",
    "\u202f": " ",
}


def _texte_pdf(valeur: object) -> str:
    """Texte sûr pour les polices cœur de fpdf2 (Latin-1), sans planter.

    Les caractères typographiques sont translittérés ; tout caractère hors
    Latin-1 (arabe, emoji) devient « ? » — le PDF se génère toujours, et le
    contenu affiché reste fidèle pour le français.
    """
    texte = "" if valeur is None else str(valeur)
    for avant, apres in _REMPLACEMENTS.items():
        texte = texte.replace(avant, apres)
    return texte.encode("latin-1", "replace").decode("latin-1")


class _DossierPDF(FPDF):
    """PDF du dossier : un pied de page identique sur CHAQUE page.

    `footer()` est appelé par fpdf2 à chaque saut de page — écrire le pied de
    page depuis le corps du document (set_y(-15) + cell) déclenchait un saut
    automatique et produisait une page blanche (mesuré le 20/10/2026).
    """

    def __init__(self, date_fr: str):
        super().__init__(format="A4")
        self._date_fr = date_fr

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(110, 110, 130)
        self.cell(
            0,
            6,
            text=_texte_pdf(f"LAWOL.mr — dossier généré le {self._date_fr}"),
            align="C",
        )


def _lettre_gabarit(offre: dict, profil: dict) -> str:
    """Lettre de motivation par défaut : factuelle, sans promesse inventée."""
    titre = offre.get("titre") or "l'offre"
    organisme = offre.get("entreprise") or "votre organisme"
    filiere = profil.get("filiere")
    niveau = profil.get("niveau")
    formation = (
        f"en {filiere}, niveau {niveau}"
        if filiere and niveau
        else (f"en {filiere}" if filiere else "dans mon parcours universitaire")
    )
    return (
        "Madame, Monsieur,\n\n"
        f"Je souhaite présenter ma candidature à l'offre « {titre} » publiée par "
        f"{organisme}. Étudiant(e) {formation}, je souhaite mettre à profit ma "
        "formation et ma motivation au service de ce projet.\n\n"
        "Ce dossier rassemble les pièces que j'ai déposées dans mon coffre-fort "
        "LAWOL. Je reste à votre disposition pour tout complément d'information.\n\n"
        "Je vous prie d'agréer, Madame, Monsieur, l'expression de ma considération "
        "distinguée.\n\n"
        f"{profil.get('prenom') or ''} {profil.get('nom') or ''}".strip()
    )


def _generer_pdf(
    offre: dict, profil: dict, pieces: list[dict], lettre: str, date_generation: datetime
) -> bytes:
    """PDF A4 : page de garde + lettre de motivation + liste des pièces."""
    nom_etudiant = " ".join(
        p for p in (profil.get("prenom"), profil.get("nom")) if isinstance(p, str) and p
    ).strip() or "Étudiant LAWOL"
    organisme = offre.get("entreprise") or "Organisme non précisé"
    titre = offre.get("titre") or "Offre sans titre"
    date_fr = date_generation.strftime("%d/%m/%Y")

    pdf = _DossierPDF(date_fr)
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_margins(20, 20, 20)
    pdf.set_title(_texte_pdf(f"Dossier de candidature — {titre}"))

    # 1 · Page de garde
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(46, 46, 96)
    pdf.cell(0, 14, text="DOSSIER DE CANDIDATURE", new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(180, 180, 210)
    pdf.line(20, pdf.get_y() + 2, 190, pdf.get_y() + 2)
    pdf.ln(10)

    champs = [
        ("Offre", titre),
        ("Organisme", organisme),
        ("Étudiant", nom_etudiant),
        ("Téléphone", profil.get("telephone") or ""),
        ("Date", date_fr),
    ]
    for libelle, valeur in champs:
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(90, 90, 110)
        pdf.cell(38, 8, text=_texte_pdf(f"{libelle} :"))
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(30, 30, 50)
        pdf.multi_cell(
            0, 8, text=_texte_pdf(valeur or "Non précisé"), new_x="LMARGIN", new_y="NEXT"
        )

    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(110, 110, 130)
    pdf.multi_cell(
        0,
        5,
        text=_texte_pdf(
            "Dossier généré par LAWOL.mr à partir des pièces du coffre-fort de "
            "l'étudiant. Les pièces originales restent stockées dans un espace privé."
        ),
        new_x="LMARGIN",
        new_y="NEXT",
    )

    # 2 · Lettre de motivation
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(46, 46, 96)
    pdf.cell(0, 10, text="LETTRE DE MOTIVATION", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(30, 30, 50)
    for paragraphe in (lettre or "").split("\n"):
        if paragraphe.strip():
            pdf.multi_cell(0, 6, text=_texte_pdf(paragraphe.strip()), new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
        else:
            pdf.ln(3)

    # 3 · Pièces du coffre sélectionnées
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(46, 46, 96)
    pdf.cell(0, 10, text="PIÈCES JOINTES (COFFRE-FORT)", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(30, 30, 50)
    if pieces:
        for document in pieces:
            pdf.multi_cell(
                0,
                7,
                text=_texte_pdf(f"- {_nom_piece(document)}"),
                new_x="LMARGIN",
                new_y="NEXT",
            )
    else:
        pdf.multi_cell(
            0,
            7,
            text=_texte_pdf(
                "Aucune pièce du coffre-fort n'a été sélectionnée pour ce dossier."
            ),
            new_x="LMARGIN",
            new_y="NEXT",
        )

    sortie = pdf.output()
    return bytes(sortie)


# ---------- Storage privé ----------
def _cle_dossier(telephone: str, offre_id: str) -> str:
    """Clé RELATIVE au bucket privé (aucune valeur client dans le chemin)."""
    return f"{PREFIXE_DOSSIERS}/{telephone}/{offre_id}.pdf"


def _lien_signe(cle: str) -> str:
    """URL signée 60 s d'un objet du bucket privé — jamais d'URL publique."""
    try:
        reponse = supabase.storage.from_(BUCKET).create_signed_url(cle, TTL_URL_SIGNEE)
    except Exception as e:  # Storage indisponible
        raise HTTPException(500, f"Impossible de préparer le lien du dossier : {e}") from e
    url = reponse.get("signedURL") or reponse.get("signedUrl")
    if not url:
        raise HTTPException(500, "Impossible de préparer le lien du dossier")
    return url


# ---------- Génération du dossier ----------
@router.post("/{offre_id}/dossier")
async def generer_dossier(
    offre_id: str,
    demande: DossierDemande | None = None,
    session: str = Depends(session_profil),
):
    """Génère le PDF du dossier, le dépose dans le bucket privé, renvoie le lien.

    Garde : Bearer obligatoire (401). Un ``telephone`` de corps différent du
    token → 403. Offre absente/inactive/expirée → 404 ; profil absent → 404.
    Une pièce demandée mais absente du coffre est ignorée (jamais d'échec).
    """
    demande = demande or DossierDemande()

    # 403 inter-profils : le token fait foi, jamais le corps.
    if demande.telephone and demande.telephone != session:
        raise HTTPException(403, "Ce dossier ne t'appartient pas")

    offre = _offre(offre_id)
    if offre is None:
        raise HTTPException(404, "Offre introuvable")

    profil = _profil(session)
    if profil is None:
        raise HTTPException(404, "Profil non trouvé")

    pieces = _pieces_choisies(_documents_du_profil(profil), demande.pieces)

    lettre = (demande.lettre or "").strip()[:LETTRE_MAX]
    gabarit = not lettre
    if gabarit:
        lettre = _lettre_gabarit(offre, profil)

    maintenant = datetime.now(timezone.utc)
    try:
        contenu = _generer_pdf(offre, profil, pieces, lettre, maintenant)
    except Exception as e:  # génération impossible → 500 explicite, jamais un PDF vide
        raise HTTPException(500, f"Impossible de générer le dossier : {e}") from e

    # Identifiant d'offre lu EN BASE : aucune valeur client n'entre dans la clé.
    cle = _cle_dossier(session, str(offre["id"]))
    try:
        supabase.storage.from_(BUCKET).upload(
            cle,
            contenu,
            {"content-type": "application/pdf", "upsert": True},
        )
    except Exception as e:
        raise HTTPException(500, f"Échec d'écriture du dossier : {e}") from e

    return {
        "statut": "dossier_pret",
        "url": _lien_signe(cle),
        "expire_dans": TTL_URL_SIGNEE,
        "offre_id": str(offre["id"]),
        "pieces": [_nom_piece(d) for d in pieces],
        "lettre_source": "gabarit" if gabarit else "fournie",
        "genere_le": maintenant.isoformat(),
    }
