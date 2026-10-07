# Dockerfile pour l'API LAWOL.mr — Railway
FROM python:3.11-slim

WORKDIR /app

# Copier le code
COPY . .

# Installer les dépendances Python
RUN pip install --no-cache-dir -r apps/api/requirements.txt

# Variables d'environnement
ENV PYTHONPATH=/app
ENV PYTHONUTF8=1

# Port
EXPOSE 8000

# Démarrer l'API
CMD ["sh", "-c", "cd apps/api && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
