# Migration de l'API Railway → Cloud Run (préparée le 12/11/2026)

> État : **tout est prêt, rien n'est déployé**. L'API de production est hors service
> depuis que l'essai Railway est terminé (`Application not found` sur tous les chemins).
> Le contenu de la base n'est pas concerné : Supabase répond, les données sont intactes.

## 1. Ce qui est déjà prêt

| Élément | État | Preuve |
|---|---|---|
| `Dockerfile` racine | **compatible Cloud Run tel quel** (écoute `${PORT}`, `PYTHONPATH=/app`) | lecture du fichier, aucun changement requis |
| Lot V5-A (filtres serveur) | déployé côté web, prouvé en local | `preuve-api.ps1` **VERT** : contrat OpenAPI expose `financement` + `cloture30`, 296 offres, 168 `fully_funded` (0 hors critère), 133 en fenêtre 30 j (0 hors fenêtre), 85 combinées |
| Script de déploiement | `scripts/deploy-cloudrun.ps1` | à exécuter une fois `gcloud` authentifié |
| Script de preuve | `scripts/preuve-api.ps1 -Base <url>` | même harnais pour local et prod |

## 2. Ce qui reste à faire (dans cet ordre)

```text
1. gcloud auth login            # navigateur, une seule fois (utilisateur)
2. gcloud projects list         # noter le PROJECT_ID
3. gcloud billing projects describe <PROJECT_ID>   # billingEnabled: true attendu
4. powershell -File scripts\deploy-cloudrun.ps1 -Projet <PROJECT_ID>
5. powershell -File scripts\preuve-api.ps1 -Base <URL renvoyée par Cloud Run>
6. Vercel → projet lawol-mr → Settings → Environment Variables
   NEXT_PUBLIC_API_URL = <URL Cloud Run>   (Production + Preview)
7. Redéployer le front (Deployments → Redeploy)
8. node apps/web/scripts/verify-etats-offres.mjs https://lawol-mr.vercel.app
```

## 3. Coût et garde-fous

- `--min-instances 0` : aucune instance au repos → facturation nulle sans trafic.
- `--max-instances 3` : plafond dur, empêche tout emballement.
- `--memory 512Mi --cpu 1 --timeout 300`.
- Quota gratuit mensuel Cloud Run (ordre de grandeur) : 2 M requêtes, ~180 000 vCPU·s,
  ~360 000 GiB·s. Le trafic LAWOL est très en dessous.
- **À faire côté console** : alerte de budget à 1 $ sur le projet.

## 4. Pièges identifiés avant de commencer

1. **`CORS_ORIGINS` doit contenir `https://lawol-mr.vercel.app`** — sinon le front reçoit
   des 403 navigateur alors que l'API répond en curl. Le script transmet la variable
   telle qu'elle est dans `.env` ; la vérifier avant.
2. **Les variables front (`NEXT_PUBLIC_*`) ne servent à rien côté API** : le script les ignore
   par liste blanche. Les recopier n'aurait aucun effet, mais donnerait l'illusion d'un réglage.
3. **Valeurs vides** : le script les ignore et les liste. Une variable vide écraserait un défaut
   du code (`APP_ENV`, `CORS_ORIGINS`) — c'est volontaire.
4. **Le fichier d'environnement temporaire** est supprimé en fin de script (`finally`), et
   `.env` est exclu de l'image (`.dockerignore`).
5. **L'URL Cloud Run change avec le service** : ne pas la coder en dur ailleurs que dans
   `NEXT_PUBLIC_API_URL` et dans ce document après déploiement.

## 5. Retour arrière

- Le service Cloud Run se supprime en une commande (`gcloud run services delete lawol-api`).
- Côté Vercel, il suffit de remettre l'ancienne valeur de `NEXT_PUBLIC_API_URL`
  (historique conservé dans les variables d'environnement) puis de redéployer.
- Aucune donnée n'est touchée : Supabase reste la seule base.

## 6. Ce que la migration NE règle pas

- **V5-B (TTFB froid)** : `min-instances 0` signifie un démarrage à froid (~2-5 s) au premier
  appel après une période d'inactivité. C'est mesurable et c'est le lot V5-B, pas la migration.
- **Les clés expirées des outils** : le token Railway est mort (`Not Authorized`), le token
  Supabase de gestion aussi (`Invalid access token`). Sans impact sur la production, mais ils
  devront être régénérés pour retrouver les vérifications automatiques.
