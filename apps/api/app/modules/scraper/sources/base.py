"""Classe de base des scrapers — contrat commun pour toutes les sources."""
import re
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Iterable

from apps.api.app.core.database import supabase
from apps.api.app.modules.scraper.engine import (
    CLE_METADATA_CATEGORIE,
    categorie_bourse_pour_source,
    type_offre_pour_source,
)
from apps.api.app.modules.shared.models import OffreStageCreate

# Clé metadata qui conserve la trace des filières écartées (drift d'enum SQL).
CLE_METADATA_FILIERES_IGNOREES = "filieres_ignorees_base"
# Nombre maximal d'élagages par offre (une valeur d'enum refusée par essai).
# 40 couvre l'écart constaté le 26/10 (25 valeurs absentes de la base) ; le coût
# est payé UNE fois par process grâce à `_FILIERES_REFUSEES`, ensuite les
# offres sont filtrées avant tout appel réseau.
_MAX_ELAGAGES = 40
# Valeur de repli : elle existe dans l'enum SQL d'origine (schema.sql).
_FILIERE_REPLI = "autre"

_PATTERN_ENUM_FILIERE = re.compile(r'invalid input value for enum filiere:\s*"([^"]+)"')

# Mémoire PROCESS des valeurs refusées par l'enum de la base : une valeur
# apprise une fois est élaguée SANS nouvel aller-retour pour toutes les offres
# suivantes (mesuré le 26/10 : l'écart portait sur ~25 valeurs, un retry par
# offre aurait multiplié les requêtes).
_FILIERES_REFUSEES: set[str] = set()


def _elaguer_filiere_refusee(data: dict, erreur: Exception, ignorees: list[str]) -> bool:
    """Retire de ``filieres_cibles`` la valeur d'enum refusée par la base.

    Pourquoi : ``models.Filiere`` (code) et l'enum PostgreSQL ``filiere``
    peuvent diverger — une valeur ajoutée côté Python sans migration SQL fait
    échouer l'upsert et l'offre ENTIÈRE est perdue (mesuré le 26/10/2026 :
    des dizaines d'offres perdues par collecte). Ici l'offre survit, la
    filière fautive est mémorisée (``_FILIERES_REFUSEES``) et tracée dans
    ``metadata['filieres_ignorees_base']``, puis l'insertion est rejouée.

    Retourne True si un élagage a eu lieu (donc : réessayer).
    """
    trouve = _PATTERN_ENUM_FILIERE.search(str(erreur))
    if not trouve:
        return False
    refusee = trouve.group(1)
    _FILIERES_REFUSEES.add(refusee)
    actuelles = list(data.get("filieres_cibles") or [])
    restantes = [f for f in actuelles if f != refusee]
    if len(restantes) == len(actuelles):
        return False
    data["filieres_cibles"] = restantes or [_FILIERE_REPLI]
    ignorees.append(refusee)
    # La trace doit être posée AVANT la nouvelle tentative d'upsert, sinon la
    # clé n'existerait que dans un dict jamais envoyé.
    metadata = dict(data.get("metadata") or {})
    metadata[CLE_METADATA_FILIERES_IGNOREES] = sorted(
        set(metadata.get(CLE_METADATA_FILIERES_IGNOREES) or []) | set(ignorees)
    )
    data["metadata"] = metadata
    return True


def _filtrer_filieres_connues_comme_refusees(data: dict) -> None:
    """Écarte d'emblée les valeurs déjà refusées par la base dans ce process."""
    if not _FILIERES_REFUSEES:
        return
    actuelles = list(data.get("filieres_cibles") or [])
    restantes = [f for f in actuelles if f not in _FILIERES_REFUSEES]
    if len(restantes) == len(actuelles):
        return
    data["filieres_cibles"] = restantes or [_FILIERE_REPLI]
    metadata = dict(data.get("metadata") or {})
    metadata[CLE_METADATA_FILIERES_IGNOREES] = sorted(
        set(metadata.get(CLE_METADATA_FILIERES_IGNOREES) or [])
        | (set(actuelles) - set(restantes))
    )
    data["metadata"] = metadata



class BaseScraper(ABC):
    """Un scraper = une source. Il retourne des OffreStageCreate valides (Pydantic)."""

    source_name: str  # ex: "mauritel", "anpe", "snim"

    @abstractmethod
    def fetch(self) -> Iterable[OffreStageCreate]:
        """Collecte les offres. Doit gérer ses erreurs et yield des objets valides."""
        raise NotImplementedError

    def save(self, offres: list[OffreStageCreate]) -> tuple[int, int]:
        """Insère/upsert les offres (upsert sur source_url = idempotent).

        Le `type_offre` est (re)calculé par la règle durable
        `scraper.engine.type_offre_pour_source` AVANT l'écriture : une source
        d'emploi (beta.mr, LinkedIn, sites carrières) ne peut jamais écrire
        `bourse` — elle écrit `emploi_junior`, ou `stage_pfe` pour un stage.

        `metadata['categorie_bourse']` (axe FINANCEUR, jsonb sans migration) est
        posé au même endroit, par `scraper.engine.categorie_bourse_pour_source`.
        Le dict metadata est LU puis MODIFIÉ : les autres clés déjà portées par
        l'offre (`content_hash`, `bourse_generique`…) sont conservées.
        """
        inserted = 0
        errors = 0
        for o in offres:
            try:
                data = o.model_dump(mode="json")
                data["type_offre"] = type_offre_pour_source(
                    self.source_name, o.titre, o.description
                )
                metadata = data.get("metadata")
                metadata = dict(metadata) if isinstance(metadata, dict) else {}
                metadata[CLE_METADATA_CATEGORIE] = categorie_bourse_pour_source(
                    self.source_name, o.entreprise
                )
                data["metadata"] = metadata
                _filtrer_filieres_connues_comme_refusees(data)
                ignorees: list[str] = []
                res = None
                for _ in range(_MAX_ELAGAGES):
                    try:
                        res = supabase.table("offres").upsert(
                            data, on_conflict="source_url"
                        ).execute()
                        break
                    except Exception as e:  # noqa: BLE001
                        if not _elaguer_filiere_refusee(data, e, ignorees):
                            raise
                if res is None:
                    raise RuntimeError("upsert impossible après élagages d'enum")
                if res.data:
                    inserted += 1
            except Exception as e:  # noqa: BLE001 — log et continue
                errors += 1
                print(f"⚠️ {self.source_name}: insertion échouée - {e}")
        return inserted, errors

    def log(
        self, status: str, nouvelles: int, total: int, erreur: str | None = None, duree_ms: int = 0
    ):
        """Trace l'exécution dans scraper_logs (dashboard admin)."""
        try:
            supabase.table("scraper_logs").insert(
                {
                    "source": "entreprise",
                    "source_name": self.source_name,
                    "status": status,
                    "offres_nouvelles": nouvelles,
                    "offres_total": total,
                    "error_message": (erreur or "")[:500] or None,
                    "duration_ms": duree_ms,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            ).execute()
        except Exception as e:  # noqa: BLE001
            print(f"⚠️ log échoué: {e}")

    def run(self) -> dict:
        """Exécution complète : fetch → save → log. Retourne les stats."""
        debut = datetime.now(timezone.utc)
        try:
            offres = list(self.fetch())
            nouvelles, erreurs = self.save(offres)
            duree = int((datetime.now(timezone.utc) - debut).total_seconds() * 1000)
            self.log("success", nouvelles, len(offres), duree_ms=duree)
            return {
                "source": self.source_name,
                "statut": "success",
                "collectees": len(offres),
                "inserrees": nouvelles,
                "erreurs": erreurs,
                "duree_ms": duree,
            }
        except Exception as e:  # noqa: BLE001
            duree = int((datetime.now(timezone.utc) - debut).total_seconds() * 1000)
            self.log("error", 0, 0, erreur=str(e), duree_ms=duree)
            return {
                "source": self.source_name,
                "statut": "error",
                "collectees": 0,
                "inserrees": 0,
                "erreurs": 1,
                "duree_ms": duree,
                "erreur": str(e)[:300],
            }
