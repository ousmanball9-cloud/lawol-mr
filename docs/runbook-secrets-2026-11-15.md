# Runbook - lever les 2 portes bloquantes (etat mesure le 15/11/2026)
API prod : https://lawol-api.onrender.com (Render `srv-dbr2mglbedkc738p2nb0`, plan free, reveil 30-90 s) ; front : https://lawol-mr.vercel.app ; `lawol.mr` = NXDOMAIN, jamais une URL valide.
L'email part de l'API donc de Render (Vercel n'a aucune variable SMTP, c'est normal). Aucune valeur secrete n'est ecrite dans ce fichier.

## PORTE 1 - SMTP : 0 notification jamais delivree (deadline 23/11/2026)

### E1.1 Creer le mot de passe d'application Gmail
- [ ] Validation en 2 etapes activee : https://myaccount.google.com/security
- [ ] https://myaccount.google.com/apppasswords -> nom `LAWOL API Render` -> Creer : relever les 16
      caracteres (4 groupes de 4) et **retirer les espaces**. Ce mot de passe-la, pas celui du compte Google.
Alternative (memes 6 variables, seul l'hote change) : `Brevo` = `smtp-relay.brevo.com` port `587`,
user = login du compte, pass = cle SMTP ; `Resend` = `smtp.resend.com` port `587`, user = `resend`, pass = cle API.

### E1.2 Poser les 6 variables sur Render (5 obligatoires ; EMAIL_FROM_NAME a un defaut)
Dashboard Render -> service `lawol-api` -> *Environment* -> *Add Environment Variable*.

| Variable | Exemple NON secret | Remarque |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | obligatoire, sinon l'email reste desactive (`email_configure()`) |
| `SMTP_PORT` | `587` | 587 = STARTTLS (defaut du code) ; si 587 echoue, le moteur bascule seul sur 465 SSL |
| `SMTP_USER` | `ousmanball9@gmail.com` | adresse Gmail qui a cree le mot de passe |
| `SMTP_PASSWORD` | *(16 car., jamais ici)* | secret : saisie clavier uniquement |
| `EMAIL_FROM` | `ousmanball9@gmail.com` | email valide obligatoire ; = `SMTP_USER` chez Gmail |
| `EMAIL_FROM_NAME` | `LAWOL.mr` | valeur par defaut si absent |

Voie API (cle `RENDER_API_KEY` requise) - une cle a la fois :
```powershell
$id = "srv-dbr2mglbedkc738p2nb0"
$h  = @{ Authorization = "Bearer $env:RENDER_API_KEY" }
function Set-RenderVar($k,$v){ Invoke-RestMethod -Method Put -Headers $h -ContentType "application/json" -Uri "https://api.render.com/v1/services/$id/env-vars/$k" -Body (@{value=$v} | ConvertTo-Json -Compress) | Out-Null }
Set-RenderVar "SMTP_HOST" "smtp.gmail.com"
Set-RenderVar "SMTP_PORT" "587"
Set-RenderVar "SMTP_USER" "ousmanball9@gmail.com"
Set-RenderVar "EMAIL_FROM" "ousmanball9@gmail.com"
Set-RenderVar "EMAIL_FROM_NAME" "LAWOL.mr"
$mdp = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Read-Host -AsSecureString "Mot de passe application Gmail")))
Set-RenderVar "SMTP_PASSWORD" $mdp
Remove-Variable mdp
```
**INTERDIT** : `PUT /v1/services/$id/env-vars` (sans `/$k`) remplace TOUT et supprime les cles absentes (`SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`...) : l'API refuse alors de demarrer.

### E1.3 Declencher le redeploiement (une variable seule ne s'applique pas)
Dashboard : *Save changes* puis *Deploy latest commit*. Une ecriture API ne deploie jamais (voie API : `$id` et `$h` viennent de E1.2).
```powershell
Invoke-RestMethod -Method Post -Headers $h -ContentType "application/json" -Uri "https://api.render.com/v1/services/$id/deploys" -Body '{"clearCache":"do_not_clear"}'
(Invoke-RestMethod -Headers $h -Uri "https://api.render.com/v1/services/$id/deploys?limit=1").deploy.status
```
- [ ] Statut `live` (sinon `build_failed` : lire les logs du build dans le dashboard).
### E1.4 Preuve : 3 elements, sinon ce n'est pas prouve
```powershell
curl.exe -s -o NUL -w "%{http_code}`n" https://lawol-api.onrender.com/health/ready
cd D:\opencode\lawol-mr
python -X utf8 scripts/verify-envoi-live.py --live --dest etudiant@exemple.mr
```
- [ ] `200` sur `/health/ready` (relancer une fois : reveil 30-90 s) - prouve API + base, PAS le SMTP.
- [ ] Harnais : exit `0` et `RESULTAT : preuve live d'envoi email VALIDE` (il lit les 6 variables
      dans `D:\opencode\lawol-mr\.env`, memes valeurs que Render, fichier gitignore).
- [ ] Email **reellement recu** dans la boite du destinataire (verifier les spams).
- [ ] `matches.notifie = true` relu en base (le harnais l'imprime a l'etape 7).
Un "SMTP a accepte" sans email recu n'est pas une preuve. Prod de bout en bout (optionnel, max 20
emails, profils opt-in seulement) : `curl.exe -s -X POST https://lawol-api.onrender.com/api/v1/notifications/run -H "x-admin-token: $env:ADMIN_PASSWORD_HASH"`
-> attendu `{"matches_trouves":n,"notifies":>0,"erreurs":0,"ignores":k}` ; header = valeur de `ADMIN_PASSWORD_HASH` (identique au secret GitHub `SCRAPER_TOKEN`). Couverture : `python scripts/couverture-notifications.py`.

## PORTE 2 - token Supabase : 401 Invalid access token (controle base perdu)

### E2.1 Creer un Personal Access Token (scope projet, lecture)
- [ ] https://supabase.com/dashboard/account/tokens -> *Generate new token*
- [ ] Scope : projet `kvubvhxamgkxgxkmfxpp`, permissions *Project Settings: Read*, *Backups: Read*,
      *Logs: Read* ; expiration 90 jours ; affiche une seule fois.

### E2.2 Le coller puis verifier qu'il est valide
```powershell
$pat = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Read-Host -AsSecureString "PAT Supabase")))
Set-Content -Path "$env:APPDATA\opencode\supabase-token.txt" -Value $pat -NoNewline -Encoding ASCII
$pat = (Get-Content "$env:APPDATA\opencode\supabase-token.txt" -Raw).Trim()
curl.exe -s -o NUL -w "%{http_code}`n" -H "Authorization: Bearer $pat" https://api.supabase.com/v1/projects
```
- [ ] `%APPDATA%\opencode\supabase-token.txt` contient le token seul, **sans saut de ligne** (un PAT classique fait 44 car.).
- [ ] `200` = valide ; `401` = invalide/revoque/expire (recreer) ; `403` = scope insuffisant.
      Ne jamais afficher `$pat` (longueur + empreinte suffisent).

### E2.3 Premiere mesure ensuite : les backups
```powershell
curl.exe -s -H "Authorization: Bearer $pat" "https://api.supabase.com/v1/projects/kvubvhxamgkxgxkmfxpp/database/backups"
```
- [ ] Lire le resultat. Plan free : `{"backups":[]...}` attendu (Supabase ne sauvegarde automatiquement
      qu'a partir du plan Pro). Backups vide = risque "base sans backup" **confirme**, pas infirme ;
      action suivante : dump hors depot (`npx supabase db dump --db-url <DATABASE_URL> -f backup-2026-11-15.sql`).
Lecture seule cote outillage : `supabase.configurer(ref="kvubvhxamgkxgxkmfxpp")` puis `supabase.backups` / `supabase.sante`.
## Si on ne fait rien, et comment revenir en arriere

| Porte | Consequence datee | Marche arriere |
|---|---|---|
| 1 SMTP | 16/11 au 23/11 : 0 email, aucun etudiant prevenu ; apres le 23/11 le jalon M4 glisse au 14/12. | `Set-RenderVar "SMTP_HOST" ""` + redeploiement : `email_configure()` = faux, repli WhatsApp, aucun crash. Puis revoquer le mot de passe sur https://myaccount.google.com/apppasswords et supprimer les variables dans *Environment*. |
| 2 Token | Aucun controle sante/logs/backups : panne ou base sans sauvegarde invisible jusqu'a la perte. | Revoquer le token sur https://supabase.com/dashboard/account/tokens puis `Remove-Item "$env:APPDATA\opencode\supabase-token.txt"` (outils a l'arret, prod non touchee). |

## Secrets a ne JAMAIS coller dans un fichier versionne
Mot de passe d'application Gmail, `SMTP_PASSWORD`, PAT Supabase (`sbp_...`), `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ANON_KEY`, `JWT_SECRET`, `SESSION_SECRET`, `ADMIN_PASSWORD_HASH` (= `SCRAPER_TOKEN`), `RENDER_API_KEY`, `DATABASE_URL`.
Emplacements autorises seulement : dashboard Render, `.env` local (gitignore `.env`, `.env.*`), `%APPDATA%\opencode\supabase-token.txt`. Jamais de `git add`, jamais d'ecran partage.
