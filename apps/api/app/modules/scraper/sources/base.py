"""Classe de base des scrapers — contrat commun pour toutes les sources."""
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Iterable

from apps.api.app.core.database import supabase
from apps.api.app.modules.shared.models import OffreStageCreate


class BaseScraper(ABC):
    """Un scraper = une source. Il retourne des OffreStageCreate valides (Pydantic)."""

    source_name: str  # ex: "mauritel", "anpe", "snim"

    @abstractmethod
    def fetch(self) -> Iterable[OffreStageCreate]:
        """Collecte les offres. Doit gérer ses erreurs et yield des objets valides."""
        raise NotImplementedError

    def save(self, offres: list[OffreStageCreate]) -> tuple[int, int]:
        """Insère/upsert les offres (upsert sur source_url = idempotent)."""
        inserted = 0
        errors = 0
        for o in offres:
            try:
                data = o.model_dump(mode="json")
                res = supabase.table("offres").upsert(data, on_conflict="source_url").execute()
                if res.data:
                    inserted += 1
            except Exception as e:  # noqa: BLE001 — log et continue
                errors += 1
                print(f"⚠️ {self.source_name}: insertion échouée - {e}")
        return inserted, errors

    def log(self, status: str, nouvelles: int, total: int, erreur: str | None = None, duree_ms: int = 0):
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
