from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

# Charge le .env à la racine du projet (lawol-mr/.env)
# config.py est dans apps/api/app/core/ → 4 niveaux au-dessus = racine
ENV_PATH = Path(__file__).resolve().parents[4] / ".env"
load_dotenv(ENV_PATH)


class Settings(BaseSettings):
    # App
    APP_NAME: str = "LAWOL.mr API"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # WhatsApp (Meta Cloud API) — plus tard
    META_WHATSAPP_TOKEN: str = ""
    META_PHONE_NUMBER_ID: str = ""
    META_APP_SECRET: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "lawol-verify-2026"  # token secret pour la vérification du webhook
    WHATSAPP_TEMPLATE_NAME: str = "offre_stage_match"

    # Security
    ADMIN_PASSWORD_HASH: str = ""
    JWT_SECRET: str = "change-me-in-production-min-32-chars"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = {"env_file": str(ENV_PATH), "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    # Fail-fast : jamais de secret par défaut en production
    if s.APP_ENV == "production" and s.JWT_SECRET == "change-me-in-production-min-32-chars":
        raise RuntimeError("JWT_SECRET non défini — refus de démarrer en production")
    if s.APP_ENV == "production" and not s.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY manquante — refus de démarrer en production")
    return s


settings = get_settings()