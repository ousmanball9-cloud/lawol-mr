# Deploiement Cloud Run de l'API LAWOL.mr (prepare le 12/11/2026, teste en pre-vol).
# Usage : powershell -File deploy-cloudrun.ps1 -Projet <id-projet-gcp> [-Region europe-west1]
# Aucun secret n'est ecrit dans le depot : le fichier d'env est genere a chaud dans le TEMP.
#
# NOTE PowerShell 5.1 : gcloud ecrit ses WARNING/progression sur stderr ; avec
# $ErrorActionPreference = "Stop" PowerShell les transformerait en erreurs fatales.
# On reste donc en "Continue" et on controle explicitement les codes de retour.

param(
    [Parameter(Mandatory = $true)][string]$Projet,
    [string]$Region = "europe-west1",
    [string]$Service = "lawol-api",
    [string]$Repo = "D:\opencode\lawol-mr"
)

$ErrorActionPreference = "Continue"

# --- 0. gcloud : PATH, sinon chemin d'installation par defaut ---------------
$gcloud = (Get-Command gcloud -ErrorAction SilentlyContinue)
if ($gcloud) {
    $gcloud = $gcloud.Source
}
else {
    $defaut = Join-Path $env:LOCALAPPDATA "Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    if (Test-Path $defaut) { $gcloud = $defaut }
    else { throw "gcloud absent : installer Google Cloud CLI puis 'gcloud auth login'." }
}
"gcloud : $gcloud"

# --- 0 bis. Compte actif ----------------------------------------------------
$compte = @(& $gcloud auth list --format="value(account)" 2>$null | Where-Object { $_ -match "@" })
if ($compte.Count -eq 0) { throw "Aucun compte actif : lancer 'gcloud auth login' dans un terminal." }
"Compte : $($compte[0]) | projet : $Projet | region : $Region"

# --- 0 ter. Projet + facturation active ------------------------------------
$etatFacturation = (& $gcloud billing projects describe $Projet --format="value(billingEnabled)" 2>$null)
if ("$etatFacturation".Trim() -notmatch '^(true|True)$') {
    throw "Facturation inactive OU projet '$Projet' introuvable. Verifier : gcloud projects list  puis activer la facturation : https://console.cloud.google.com/billing/linkedaccount?project=$Projet"
}
"Facturation : active"

# --- 1. APIs necessaires (idempotent) ---------------------------------------
"Activation des APIs (run, cloudbuild, artifactregistry)..."
& $gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $Projet | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Activation des APIs refusee (code $LASTEXITCODE)." }

# --- 2. Variables d'environnement depuis .env (liste blanche) ---------------
# Seules les cles utiles a l'API sont transmises ; les valeurs vides sont ignorees
# et signalees (une valeur vide ecraserait un defaut du code).
$cles = @(
    "APP_ENV", "DEBUG",
    "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_PASSWORD_HASH", "JWT_SECRET", "JWT_ALGORITHM", "JWT_EXPIRE_MINUTES",
    "SESSION_SECRET", "SESSION_EXPIRE_MINUTES",
    "CORS_ORIGINS",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", "EMAIL_FROM_NAME",
    "META_WHATSAPP_TOKEN", "META_PHONE_NUMBER_ID", "META_APP_SECRET", "WHATSAPP_TEMPLATE_NAME"
)

$envPath = Join-Path $Repo ".env"
if (-not (Test-Path $envPath)) { throw ".env introuvable dans $Repo" }

$valeurs = @{}
foreach ($ligne in Get-Content $envPath -Encoding UTF8) {
    if ($ligne -match '^\s*#' -or $ligne -notmatch '=') { continue }
    $i = $ligne.IndexOf('=')
    $k = $ligne.Substring(0, $i).Trim()
    $v = $ligne.Substring($i + 1).Trim()
    if ($v.Length -ge 2 -and $v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
    if ($cles -contains $k) { $valeurs[$k] = $v }
}

$vides = @($valeurs.Keys | Where-Object { [string]::IsNullOrWhiteSpace($valeurs[$_]) })
$absentes = @($cles | Where-Object { -not $valeurs.ContainsKey($_) })
$yaml = New-Object System.Collections.Generic.List[string]
foreach ($k in $valeurs.Keys) {
    if ([string]::IsNullOrWhiteSpace($valeurs[$k])) { continue }
    $v = $valeurs[$k].Replace('\', '\\').Replace('"', '\"')
    $yaml.Add("$k`": `"$v`"")
}

$tmpEnv = Join-Path $env:TEMP "lawol-cloudrun-env-$([guid]::NewGuid().ToString('N').Substring(0, 8)).yaml"
$yaml -join "`n" | Out-File -FilePath $tmpEnv -Encoding utf8
"Variables transmises : $($yaml.Count) | vides ignorees : $($vides.Count) ($($vides -join ', ')) | absentes : $($absentes.Count)"

# Controle explicite de la seule variable qui casse silencieusement le front.
$cors = $valeurs["CORS_ORIGINS"]
if (-not $cors -or $cors -notmatch "lawol-mr\.vercel\.app") {
    "AVERTISSEMENT : CORS_ORIGINS ne contient pas lawol-mr.vercel.app -> le front recevra des 403."
}

try {
    # --- 3. Deploiement (build Cloud Build depuis le Dockerfile du depot) ---
    # min-instances 0 = facturation nulle au repos ; max-instances 3 = garde-fou budget.
    & $gcloud run deploy $Service `
        --source $Repo `
        --project $Projet `
        --region $Region `
        --allow-unauthenticated `
        --port 8080 `
        --memory 512Mi `
        --cpu 1 `
        --timeout 300 `
        --min-instances 0 `
        --max-instances 3 `
        --env-vars-file $tmpEnv `
        --format "value(status.url)"
    if ($LASTEXITCODE -ne 0) { throw "Deploiement refuse (code $LASTEXITCODE)." }
}
finally {
    if (Test-Path $tmpEnv) { Remove-Item $tmpEnv -Force }
}
