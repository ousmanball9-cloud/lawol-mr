import os
from dotenv import load_dotenv

load_dotenv(r"D:\opencode\lawol-mr\.env")

os.environ["APP_ENV"] = "production"
os.environ["JWT_SECRET"] = "test-secret-local-12345678901234567890"

try:
    from apps.api.app.main import app
    print("API OK - demarrage possible en production")
except Exception as e:
    print(f"ERREUR: {type(e).__name__}: {e}")
