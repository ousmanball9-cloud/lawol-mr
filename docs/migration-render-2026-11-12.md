# Migration de l'API Railway → Render (12/11/2026) — runbook

> État : **bascule faite et prouvée**. L'API tourne sur `https://lawol-api.onrender.com`.
> `scripts/preuve-api.ps1` est **VERT** contre cette URL le 12/11/2026.
> L'ancienne URL `https://lawol-mr-production.up.railway.app` est **morte**
> (`Application not found` : l'essai Railway est terminé) — ne plus la citer.

## 1. Identité du service (à ne pas confondre)

| Élément | Valeur |
|---|---|
| URL publique | `https://lawol-api.onrender.com` |
| Service Render (id) | `srv-dbr2mglbedkc738p2nb0` |
| Nom du service | `lawol-api` |
| Workspace Render | Lawol |
| Type / runtime | Web, **Docker** (`Dockerfile` racine, contexte `.`) |
| Plan | **free** (sans carte bancaire, sans SLA) |
| Région | `frankfurt` |
| Branche déployée | `main`, `autoDeploy: true` |
| Health check | `GET /health` |
| Blueprint | `render.yaml` (racine du dépôt) |
| Script de déploiement | `scripts/deploy-render.ps1` (API Render, clé `RENDER_API_KEY`) |
| Harnais de preuve | `scripts/preuve-api.ps1 -Base https://lawol-api.onrender.com` |

## 2. Pourquoi Render et pas Cloud Run

Cloud Run est impossible : la Mauritanie ne figure pas dans les pays de facturation
Google Cloud. Voir `docs/migration-cloudrun-2026-11-12.md` (archivé, conservé comme trace).

## 3. Variables d'environnement

Les valeurs ne sont **jamais** dans le dépôt : `render.yaml` les déclare en
`sync: false`, elles sont saisies dans le dashboard Render (Environment) ou poussées
par `scripts/deploy-render.ps1` depuis `.env`.

Valeurs fixes (dans le blueprint) :

| Clé | Valeur |
|---|---|
| `APP_ENV` | `production` |
| `PYTHONPATH` | `/app` |
| `PYTHONUTF8` | `1` |

À fournir (secrets, hors dépôt) :

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `SESSION_SECRET`, `CORS_ORIGINS`,
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`,
`EMAIL_FROM_NAME`.

Deux points qui ont déjà coûté des pannes :

- `CORS_ORIGINS` doit contenir `https://lawol-mr.vercel.app`, sinon le front
  reçoit un CORS bloquant (le site paraît vide).
- `ADMIN_PASSWORD_HASH` doit être **identique** au secret GitHub `SCRAPER_TOKEN`
  (c'est la valeur envoyée en `x-admin-token` par les crons) ; sinon 403.

## 4. Cold start du plan free — à connaître avant de conclure à une panne

Le plan gratuit met le service **en veille après ~15 min sans requête entrante**.
La première requête suivante paie le réveil (conteneur Docker à relancer :
compter **30 à 90 s**, parfois plus au premier passage après un déploiement).

Conséquences opérationnelles :

- Un `curl` manuel qui expire n'est **pas** une preuve que l'API est morte :
  relancer une seconde fois (le service est alors chaud).
- Les workflows `.github/workflows/scraper-cron.yml` et `resume-hebdo.yml`
  appellent l'URL **en dur** et retentent 3 fois sur `5xx`/`000` (60 s entre
  tentatives) — c'est ce qui absorbe le réveil. Ne pas remplacer l'URL par un
  secret GitHub non configuré : un secret absent ferait échouer les crons en
  silence (leçon du 20/10 au 26/10/2026).
- `--max-time` du cron scraper est de 900 s : une collecte longue n'est pas
  coupée par le réveil.
- Le plan free n'a **pas de SLA** : c'est un risque accepté (registre des
  risques, ligne « Free tier »).

## 5. Procédure de redéploiement

```text
1. scripts\deploy-render.ps1              # crée/actualise le service, pousse les vars, lance le build
2. attendre le statut live : GET /v1/services/<id>/deploys (statuts live | build_failed | canceled)
3. powershell -File scripts\preuve-api.ps1 -Base https://lawol-api.onrender.com
```

Un push sur `main` redéploie automatiquement (`autoDeploy: true`) ; le build
Docker reste la seule voie, aucun build local n'est requis.

## 6. Retour arrière

Trois niveaux, du moins cher au plus lourd :

1. **Rollback Render (immédiat, sans git)** — dashboard Render → service
   `lawol-api` → *Deploys* → déployer de nouveau (⋮ → *Rollback*) le dernier
   déploiement sain. C'est la voie normale quand un build `live` casse
   l'application.
2. **Retour au commit précédent** — `git revert <commit>` puis push sur `main`
   (autoDeploy reconstruit l'image d'avant).
3. **Changer d'hôte à nouveau** — dernier recours seulement : l'API ne dépend
   d'aucune ressource Render propre (tout l'état est dans Supabase). Le
   `Dockerfile` racine écoute `${PORT}`, donc l'image est portable ; il faut
   alors mettre à jour **les deux URLs en dur** des workflows GitHub
   (`.github/workflows/scraper-cron.yml`, `.github/workflows/resume-hebdo.yml`)
   et la section Identité de `AGENTS.md`, puis rejouer `preuve-api.ps1`.

> Un retour vers Railway n'est **pas** une option : l'essai est terminé, l'ancienne
> URL est morte et le service n'existe plus.

## 7. Vérifier que la bascule est complète

```powershell
# 0 occurrence attendue
Select-String -Path .github\workflows\*.yml,AGENTS.md,docs\prd.md -Pattern "up\.railway\.app"

# les 2 workflows doivent parser
python -c "import yaml,glob;[yaml.safe_load(open(f,encoding='utf-8')) for f in glob.glob('.github/workflows/*.yml')];print('YAML OK')"
```
