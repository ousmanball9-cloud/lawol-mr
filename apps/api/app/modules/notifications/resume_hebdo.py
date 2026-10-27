"""Résumé hebdomadaire par email : « ce qui est nouveau pour toi cette semaine ».

Pourquoi un module (et pas un script seul) : la tâche doit tourner là où vivent
les secrets SMTP, c'est-à-dire sur Railway. Le script `scripts/resume_hebdo.py`
et l'endpoint admin `POST /api/v1/notifications/resume-hebdo` appellent donc tous
les deux `run_resume_hebdo()` — une seule logique, deux déclencheurs.

Règles NON négociables (décidées le 27/10/2026) :

1. **0 offre = 0 email.** Un résumé vide est du bruit ; il ne part jamais.
2. **Anti-doublon par SEMAINE ISO**, pas par jour : `profils.metadata`
   (`jsonb`, zéro migration) porte `dernier_resume = "AAAA-MM-JJ"`. Un profil
   déjà servi cette semaine est sauté, même si le job est relancé 10 fois.
3. **L'état n'est écrit qu'après un envoi RÉUSSI.** Un échec SMTP laisse
   `dernier_resume` intact → le profil est resservi au run suivant (jamais de
   perte silencieuse).
4. **Un profil en erreur n'arrête pas les suivants** (il est compté dans
   `erreurs` et le job continue).
5. **Fenêtre = 7 jours** sur `matches.date_match`, alignée sur
   `dashboard/summary.calculer_resume` (même définition, deux usages).
6. Le résumé ne liste que des offres **encore utiles** : offre `active` et
   `date_limite >= aujourd'hui`.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from apps.api.app.core.database import supabase
from apps.api.app.modules.notifications.canal import envoyer_email_profil

CLE_DERNIER_RESUME = "dernier_resume"
FENETRE_JOURS = 7
MAX_OFFRES_PAR_MAIL = 12
MAX_PROFILS = 500
SITE = "https://lawol-mr.vercel.app"

# Libellé honnête du type d'offre (jamais « Bourse » par défaut : un stage ou un
# emploi junior annoncé comme bourse serait un mensonge — défaut corrigé le
# 27/10 sur les cartes du profil, même règle ici).
LIBELLES_TYPE = {
    "bourse": "Bourse d'études",
    "stage_pfe": "Stage PFE",
    "stage_ete": "Stage d'été",
    "emploi_junior": "Emploi junior",
    "alternance": "Alternance",
}


def _date_iso(valeur) -> date | None:
    """Date d'une colonne Supabase, `None` si absente ou illisible."""
    if isinstance(valeur, date):
        return valeur
    if not valeur:
        return None
    try:
        return date.fromisoformat(str(valeur)[:10])
    except (TypeError, ValueError):
        return None


def semaine_iso(jour: date) -> str:
    """Clé de semaine ISO (« 2026-W43 ») — l'unité de l'anti-doublon."""
    annee, semaine, _ = jour.isocalendar()
    return f"{annee}-W{semaine:02d}"


def deja_servi(metadata: dict | None, aujourdhui: date) -> bool:
    """Vrai si un résumé est déjà parti pour la MÊME semaine ISO."""
    if not isinstance(metadata, dict):
        return False
    dernier = _date_iso(metadata.get(CLE_DERNIER_RESUME))
    return bool(dernier and semaine_iso(dernier) == semaine_iso(aujourdhui))


def libelle_type(valeur: str | None) -> str:
    """Libellé lisible du type d'offre ; repli neutre si valeur inconnue."""
    if not valeur:
        return "Offre"
    return LIBELLES_TYPE.get(valeur, str(valeur).replace("_", " "))


def offres_de_la_semaine(
    profil_id: str, *, aujourdhui: date, depuis: date | None = None
) -> list[dict]:
    """Offres encore utiles dont le match est né dans la fenêtre (7 j par défaut)."""
    debut = depuis or (aujourdhui - timedelta(days=FENETRE_JOURS))
    try:
        res = (
            supabase.table("matches")
            .select(
                "id, date_match, statut_candidature, "
                "offre:offres!inner(id, titre, entreprise, ville, pays_etudes, "
                "type_offre, date_limite, active)"
            )
            .eq("profil_id", profil_id)
            .gte("date_match", debut.isoformat())
            .eq("offre.active", True)
            .gte("offre.date_limite", aujourdhui.isoformat())
            # Catalogue 100 % bourses : un email est une lecture comme une autre.
            # Sans ce filtre, un match créé AVANT la règle (ou par un ancien run)
            # ferait partir une offre d'emploi par mail — invisible sur le site,
            # donc impossible à corriger par l'étudiant.
            .eq("offre.type_offre", "bourse")
            .order("date_match", desc=True)
            .limit(MAX_OFFRES_PAR_MAIL * 4)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — remonté au profil appelant
        raise RuntimeError(f"lecture des matches impossible : {exc}") from exc

    offres: list[dict] = []
    vus: set[str] = set()
    for ligne in res.data or []:
        offre = ligne.get("offre") or {}
        identifiant = offre.get("id")
        if not identifiant or identifiant in vus:
            continue
        # « Pas intéressé » (statut_candidature) = l'étudiant l'a écartée :
        # la lui renvoyer par email serait irrespectueux et contraire au geste.
        if ligne.get("statut_candidature") == "pas_interesse":
            continue
        if _date_iso(offre.get("date_limite")) is None:
            continue
        vus.add(identifiant)
        offres.append(offre)
        if len(offres) >= MAX_OFFRES_PAR_MAIL:
            break
    return offres


def rediger_resume(
    profil: dict, offres: list[dict], *, aujourdhui: date
) -> tuple[str, str] | None:
    """`(sujet, texte)` du résumé, ou `None` s'il n'y a rien à envoyer."""
    if not offres:
        return None

    prenom = str(profil.get("prenom") or "").strip()
    bonjour = f"Bonjour {prenom}," if prenom else "Bonjour,"
    nombre = len(offres)
    sujet = (
        f"LAWOL.mr — {nombre} nouvelle{'s' if nombre > 1 else ''} "
        f"offre{'s' if nombre > 1 else ''} pour toi cette semaine"
    )

    lignes = [
        bonjour,
        "",
        (
            f"Voici {nombre} offre{'s' if nombre > 1 else ''} qui "
            f"{'correspondent' if nombre > 1 else 'correspond'} à ton profil, "
            "repérée" + ("s" if nombre > 1 else "") + " cette semaine :"
        ),
        "",
    ]
    for offre in offres:
        titre = str(offre.get("titre") or "Offre").strip()
        organisme = str(offre.get("entreprise") or "").strip()
        type_libelle = libelle_type(offre.get("type_offre"))
        limite = _date_iso(offre.get("date_limite"))
        lignes.append(f"• {titre} — {organisme}".rstrip(" —"))
        lignes.append(f"  {type_libelle}")
        if limite:
            lignes.append(f"  Clôture le {limite.strftime('%d/%m/%Y')}")
        lignes.append(f"  {SITE}/offres/{offre.get('id')}")
        lignes.append("")

    telephone = str(profil.get("telephone") or "").strip()
    lignes.append("Tu peux les retrouver dans ton espace (et écarter celles qui ne")
    lignes.append("t'intéressent pas) :")
    lignes.append(f"{SITE}/profil/{telephone}")
    lignes.append("")
    lignes.append("Bon courage,")
    lignes.append("L'équipe LAWOL.mr")
    lignes.append("")
    lignes.append(f"(Résumé du {aujourdhui.strftime('%d/%m/%Y')} — un seul par semaine.)")
    return sujet, "\n".join(lignes)


def _profils(limite: int) -> list[dict]:
    res = (
        supabase.table("profils")
        .select("id, telephone, email, prenom, nom, actif, metadata")
        .eq("actif", True)
        .limit(limite)
        .execute()
    )
    return res.data or []


def run_resume_hebdo(
    *,
    aujourdhui: date | None = None,
    appliquer: bool = False,
    limite: int = MAX_PROFILS,
    envoi=None,
) -> dict:
    """Envoie le résumé hebdomadaire aux profils actifs qui ont du nouveau.

    `appliquer=False` (défaut) = simulation : aucune écriture, aucun envoi,
    aucun réseau sortant. `envoi` injecte le transport d'email pour les
    preuves hors-ligne (signature `(profil, texte, sujet) -> bool`).

    Bilan : `{"profils", "envoyes", "sans_nouveaute", "deja_servis",
    "erreurs", "details"}`.
    """
    jour = aujourdhui or datetime.now(UTC).date()
    bilan = {
        "date": jour.isoformat(),
        "semaine": semaine_iso(jour),
        "mode": "envoi" if appliquer else "simulation",
        "profils": 0,
        "envoyes": 0,
        "sans_nouveaute": 0,
        "sans_adresse": 0,
        "deja_servis": 0,
        "erreurs": 0,
        "details": [],
    }

    for profil in _profils(limite):
        bilan["profils"] += 1
        telephone = str(profil.get("telephone") or "").strip()
        try:
            if deja_servi(profil.get("metadata"), jour):
                bilan["deja_servis"] += 1
                bilan["details"].append({"profil": telephone, "etat": "deja_servi"})
                continue

            offres = offres_de_la_semaine(profil.get("id"), aujourdhui=jour)
            redige = rediger_resume(profil, offres, aujourdhui=jour)
            if redige is None:
                bilan["sans_nouveaute"] += 1
                bilan["details"].append({"profil": telephone, "etat": "sans_nouveaute"})
                continue

            sujet, texte = redige
            if not appliquer:
                bilan["envoyes"] += 1
                bilan["details"].append(
                    {
                        "profil": telephone,
                        "etat": "simule",
                        "offres": len(offres),
                        "sujet": sujet,
                    }
                )
                continue

            if envoi is not None:
                ok = bool(envoi(profil, texte, sujet))
                raison = "" if ok else "refus du transport"
            else:
                # UN SEUL appel : appeler deux fois enverrait deux emails en cas
                # de résultat ambigu.
                resultat = envoyer_email_profil(profil, texte, sujet=sujet)
                ok = bool(resultat.get("ok"))
                raison = resultat.get("raison") or ""

            if not ok:
                # Distinguer « pas d'adresse » (rien à retenter) d'une panne
                # réelle : sans cette distinction, un profil sans email serait
                # compté en erreur à chaque run, pour toujours.
                if raison in ("adresse absente", "adresse invalide"):
                    bilan["sans_adresse"] += 1
                    bilan["details"].append(
                        {"profil": telephone, "etat": "sans_adresse", "raison": raison}
                    )
                    continue
                # Rien n'est marqué : le profil repartira au prochain run.
                raise RuntimeError(raison or "aucun canal email n'a accepté le message")

            metadata = dict(profil.get("metadata") or {})
            metadata[CLE_DERNIER_RESUME] = jour.isoformat()
            supabase.table("profils").update({"metadata": metadata}).eq(
                "id", profil.get("id")
            ).execute()

            bilan["envoyes"] += 1
            bilan["details"].append(
                {"profil": telephone, "etat": "envoye", "offres": len(offres)}
            )
        except Exception as exc:  # noqa: BLE001 — un profil KO n'arrête pas les autres
            bilan["erreurs"] += 1
            bilan["details"].append(
                {
                    "profil": telephone,
                    "etat": "erreur",
                    "erreur": f"{type(exc).__name__}: {exc}",
                }
            )

    return bilan
