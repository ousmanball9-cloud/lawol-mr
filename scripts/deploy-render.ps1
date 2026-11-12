# Deploiement de l'API LAWOL.mr sur Render (plan gratuit, sans carte).
# Remplace Cloud Run : la Mauritanie n'est pas un pays de facturation Google Cloud.
#
# Prerequis (utilisateur, une fois) :
#   1. compte Render cree avec GitHub, depot lawol-mr autorise
#   2. cle API Render creee (Account Settings -> API Keys)
#   3. setx RENDER_API_KEY "rnd_xxx"   puis NOUVEAU terminal
#
# Usage : powershell -File deploy-render.ps1 [-OwnerId usr-xxx] [-Service lawol-api]
# Lecture de .env en local ; aucun secret n'est ecrit dans le depot.

param(
    [string]$Service = "lawol-api",
    [string]$OwnerId = "",
    [string]$Region = "frankfurt",
    [string]$RepoUrl = "https://github.com/ousmanball9-cloud/lawol-mr",
    [string]$Branch = "main",
    [string]$Repo = "D:\opencode\lawol-mr"
)

$ErrorActionPreference = "Continue"
$api = "https://api.render.com/v1"

# --- 0. Cle API : variable d'env, sinon registre Utilisateur (jamais affichee) ---
$cle = $env:RENDER_API_KEY
if (-not $cle) {
    $cle = [Environment]::GetEnvironmentVariable("RENDER_API_KEY", "User")
}
if (-not $cle) { throw "RENDER_API_KEY absente. Faire : setx RENDER_API_KEY `"rnd_xxx`" puis rouvrir le terminal." }
"Cle API : presente (longueur $($cle.Length), empreinte " + (Get-FileHash -InputStream ([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($cle))) -Algorithm SHA256).Hash.Substring(0, 12) + ")"

$entetes = @{ Authorization = "Bearer $cle"; Accept = "application/json" }

function Invoke-RenderApi {
    param([string]$Methode, [string]$Chemin, $Corps = $null)
    $p = @{ Uri = "$api$Chemin"; Method = $Methode; Headers = $entetes; TimeoutSec = 60 }
    if ($null -ne $Corps) {
        $p.Body = ($Corps | ConvertTo-Json -Depth 8 -Compress)
        $p.ContentType = "application/json"
    }
    try { return Invoke-RestMethod @p }
    catch {
        $detail = ""
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
        throw "Render $Methode $Chemin -> $($_.Exception.Message) $detail"
    }
}

# --- 1. Proprietaire (workspace) --------------------------------------------
if (-not $OwnerId) {
    $owners = Invoke-RenderApi "GET" "/owners?limit=20"
    if (-not $owners) { throw "Aucun workspace Render visible avec cette cle." }
    $OwnerId = $owners[0].owner.id
    "Workspace : $($owners[0].owner.name) ($OwnerId)"
}

# --- 2. Variables d'environnement depuis .env (liste blanche) ----------------
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

$valeurs = [ordered]@{}
foreach ($ligne in Get-Content $envPath -Encoding UTF8) {
    if ($ligne -match '^\s*#' -or $ligne -notmatch '=') { continue }
    $i = $ligne.IndexOf('=')
    $k = $ligne.Substring(0, $i).Trim()
    $v = $ligne.Substring($i + 1).Trim()
    if ($v.Length -ge 2 -and $v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
    if (($cles -contains $k) -and -not [string]::IsNullOrWhiteSpace($v)) { $valeurs[$k] = $v }
}
$vides = @($cles | Where-Object { $valeurs.Keys -notcontains $_ })
"Variables a transmettre : $($valeurs.Count) | ignorees (vides/absentes) : $($vides.Count)"

# Garde-fou : le front sera refuse si l'origine n'est pas declaree.
if (-not $valeurs.Contains("CORS_ORIGINS") -or $valeurs["CORS_ORIGINS"] -notmatch "lawol-mr\.vercel\.app") {
    "AVERTISSEMENT : CORS_ORIGINS ne contient pas lawol-mr.vercel.app -> ajouter avant de conclure."
}

# --- 3. Service existant ? sinon creation -----------------------------------
$id = $null; $url = $null
$existants = Invoke-RenderApi "GET" "/services?name=$Service&limit=20"
foreach ($e in $existants) { if ($e.service.name -eq $Service) { $id = $e.service.id; $url = $e.service.serviceDetails.url } }

if ($id) {
    "Service existant : $Service ($id)"
}
else {
    $corps = @{
        type          = "web_service"
        name          = $Service
        ownerId       = $OwnerId
        repo          = $RepoUrl
        branch        = $Branch
        autoDeploy    = "yes"
        serviceDetails = @{
            env                 = "docker"
            plan                = "free"
            region              = $Region
            healthCheckPath     = "/health"
            envSpecificDetails  = @{
                dockerfilePath = "./Dockerfile"
                dockerContext  = "./"
            }
        }
    }
    $cree = Invoke-RenderApi "POST" "/services" $corps
    $id = $cree.service.id
    $url = $cree.service.serviceDetails.url
    "Service cree : $Service ($id)"
}

# --- 4. Variables d'environnement (upsert complet) --------------------------
$liste = @()
foreach ($k in $valeurs.Keys) { $liste += @{ key = $k; value = [string]$valeurs[$k] } }
if ($liste.Count -gt 0) {
    $null = Invoke-RenderApi "PUT" "/services/$id/env-vars" $liste
    "Variables ecrites : $($liste.Count)"
}

# --- 5. Deploiement ---------------------------------------------------------
$null = Invoke-RenderApi "POST" "/services/$id/deploys" @{ clearCache = "do_not_clear" }
"Deploiement lance. Attente du statut (max 12 min)..."

$final = ""
for ($i = 0; $i -lt 72; $i++) {
    Start-Sleep -Seconds 10
    $d = Invoke-RenderApi "GET" "/services/$id/deploys?limit=1"
    if (-not $d) { continue }
    $final = $d[0].deploy.status
    if ($final -in @("live", "build_failed", "canceled", "deactivated", "pre_deploy_failed")) { break }
}
"Statut final : $final"

$s = Invoke-RenderApi "GET" "/services/$id"
$url = $s.serviceDetails.url
"URL du service : $url"

if ($final -ne "live") {
    throw "Le deploiement n'est pas 'live' (statut : $final). Voir les logs dans le dashboard Render."
}

# --- 6. Preuve immediate ----------------------------------------------------
"--- Preuve ---"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Repo "scripts\preuve-api.ps1") -Base $url
