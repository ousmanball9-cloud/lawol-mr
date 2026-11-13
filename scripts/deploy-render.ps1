# Deploiement de l'API LAWOL.mr sur Render (plan gratuit, sans carte).
# Remplace Cloud Run : la Mauritanie n'est pas un pays de facturation Google Cloud.
#
# Prerequis (utilisateur, une fois) :
#   1. compte Render cree avec GitHub, depot lawol-mr autorise
#   2. cle API Render creee (Account Settings -> API Keys)
#   3. setx RENDER_API_KEY "rnd_xxx"   puis NOUVEAU terminal
#
# Usage : powershell -File deploy-render.ps1 [-Simulation] [-OwnerId usr-xxx] [-Service lawol-api]
#   -Simulation    : construit et affiche les variables (sans les valeurs secretes),
#                    ne fait AUCUN appel reseau, ne cree rien. Sert de porte de controle.
#   -TestUnitaires : ne charge QUE les fonctions (aucun appel reseau, aucune cle requise).
#                    Utilise par scripts\test-deploy-render.ps1 pour tester hors ligne.
# Lecture de .env en local ; aucun secret n'est ecrit dans le depot.
#
# Garde-fous (revue du 12/11) :
#   - une URL de service vide fait ECHOUER le script : la transmettre a preuve-api.ps1
#     relancerait une preuve sur l'API LOCALE et rendrait un faux VERT ;
#   - l'exit code de la preuve est propage (un verdict ROUGE echoue le deploiement) ;
#   - un service existant n'est reutilise que dans LE workspace demande (ownerId) ;
#   - l'attente du build dure 40 min au plus, puis distingue « en cours » de « echoue ».

param(
    [string]$Service = "lawol-api",
    [string]$OwnerId = "",
    [string]$Region = "frankfurt",
    [string]$RepoUrl = "https://github.com/ousmanball9-cloud/lawol-mr",
    [string]$Branch = "main",
    [string]$Repo = "D:\opencode\lawol-mr",
    [string]$OwnerName = "Lawol",
    [switch]$Simulation,
    [switch]$TestUnitaires
)

$ErrorActionPreference = "Continue"
$api = "https://api.render.com/v1"
$origineProd = "https://lawol-mr.vercel.app"

function Invoke-RenderApi {
    param([string]$Methode, [string]$Chemin, $Corps = $null)
    $p = @{ Uri = "$api$Chemin"; Method = $Methode; Headers = $entetes; TimeoutSec = 60 }
    $avecCorps = $false
    if ($null -ne $Corps) {
        $p.Body = ($Corps | ConvertTo-Json -Depth 8 -Compress)
        $p.ContentType = "application/json"
        $avecCorps = $true
    }
    try { return Invoke-RestMethod @p }
    catch {
        $detail = ""
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $detail = [string]$_.ErrorDetails.Message }
        # Le corps de reponse d'un appel qui PORTE un corps (env-vars) peut re-echoer
        # les valeurs envoyees : jamais de secret dans un message d'erreur ni un log.
        if ($avecCorps) { $detail = "<masque : appel avec corps (secrets potentiels)>" }
        throw "Render $Methode $Chemin -> $($_.Exception.Message) $detail"
    }
}

function ConvertTo-CorsOrigines {
    # Normalise CORS_ORIGINS en liste JSON de chaines, pour la variable d'env Render.
    # Seules les origines https:// sont transmises (une origine http:// en prod est
    # inutile et ouvre le navigateur a du contenu non chiffre) ; l'origine prod est
    # TOUJOURS presente, sinon le front reel recoit des 403 navigateur.
    #
    # Parse par REGEX, jamais par ConvertFrom-Json.
    # ConvertFrom-Json n'énumère pas son tableau dans le pipeline → @(...) emballe un Object[] dans un Object[] → ConvertTo-Json sérialise value/Count
    param([string]$Brut, [string]$OrigineProd = "https://lawol-mr.vercel.app")

    $origines = @()
    if (-not [string]::IsNullOrWhiteSpace($Brut)) {
        foreach ($m in [regex]::Matches($Brut, '"(?<u>https?://[^"]+)"')) { $origines += $m.Groups['u'].Value }
        foreach ($m in [regex]::Matches($Brut, '(?<u>https?://[^",\[\]\s]+)')) {
            if ($origines -notcontains $m.Groups['u'].Value) { $origines += $m.Groups['u'].Value }
        }
    }

    $uniques = @()
    foreach ($o in $origines) {
        if ($o -notlike "https://*") { continue }
        if ($uniques -notcontains $o) { $uniques += $o }
    }
    if ($uniques -notcontains $OrigineProd) { $uniques += $OrigineProd }
    return "[" + (($uniques | ForEach-Object { '"' + $_ + '"' }) -join ',') + "]"
}

function Assert-UrlDeploiement {
    # Refuse toute URL vide ou non http(s) : c'est la porte qui empeche de lancer la
    # preuve sur une cible implicite (preuve-api.ps1 sans -Base = API locale).
    param([string]$Url)
    if ([string]::IsNullOrWhiteSpace($Url)) {
        throw "URL de service vide : preuve impossible. Une URL vide ferait demarrer preuve-api.ps1 sur l'API LOCALE (faux VERT)."
    }
    $propre = $Url.Trim()
    $absolue = $null
    if (-not [Uri]::TryCreate($propre, [UriKind]::Absolute, [ref]$absolue)) {
        throw "URL de service invalide : '$propre'."
    }
    if ($absolue.Scheme -notin @("http", "https")) {
        throw "URL de service non http(s) : '$propre'."
    }
    return $propre.TrimEnd("/")
}

function Select-RenderOwner {
    # Choix EXPLICITE : ne jamais prendre owners[0] — mesure du 12/11, ce compte
    # porte 2 workspaces et owners[0] = "My Workspace" (le service aurait ete cree
    # au mauvais endroit, silencieusement).
    param($Owners, [string]$Nom)
    $choisi = @($Owners | Where-Object { $_ -and $_.owner -and $_.owner.name -eq $Nom })
    if ($choisi.Count -eq 1) { return $choisi[0].owner }
    if ($choisi.Count -gt 1) { throw "$($choisi.Count) workspaces nommes '$Nom' : lever l'ambiguite avec -OwnerId." }
    throw "Aucun workspace nomme '$Nom'."
}

function Select-ServiceExistant {
    # Un service homonyme peut vivre dans un AUTRE workspace du meme compte : le
    # reutiliser ecrirait les variables et le deploiement au mauvais endroit.
    # Filtre obligatoire sur ownerId, arret au premier match.
    param($Services, [string]$Nom, [string]$Owner)
    if ([string]::IsNullOrWhiteSpace($Owner)) {
        throw "OwnerId vide : refus de selectionner un service sans filtrer le workspace."
    }
    foreach ($e in @($Services)) {
        if (-not $e -or -not $e.service) { continue }
        if ($e.service.name -ne $Nom) { continue }
        if ($e.service.ownerId -ne $Owner) { continue }
        return $e.service
    }
    return $null
}

# --- Porte de test hors ligne : fonctions chargees, corps du script non execute --
if ($TestUnitaires) { return }

# --- 0. Cle API : variable d'env, sinon registre Utilisateur (jamais affichee) ---
if (-not $Simulation) {
    $cle = $env:RENDER_API_KEY
    if (-not $cle) {
        $cle = [Environment]::GetEnvironmentVariable("RENDER_API_KEY", "User")
    }
    if (-not $cle) { throw "RENDER_API_KEY absente. Faire : setx RENDER_API_KEY `"rnd_xxx`" puis rouvrir le terminal." }
    "Cle API : presente (longueur $($cle.Length), empreinte " + (Get-FileHash -InputStream ([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($cle))) -Algorithm SHA256).Hash.Substring(0, 12) + ")"
}

$entetes = @{ Accept = "application/json" }
if (-not $Simulation) { $entetes["Authorization"] = "Bearer $cle" }

# --- 1. Proprietaire (workspace) --------------------------------------------
if ($Simulation) {
    "Simulation : aucun appel reseau (workspace non interroge)."
}
elseif (-not $OwnerId) {
    $owners = Invoke-RenderApi "GET" "/owners?limit=20"
    if (-not $owners) { throw "Aucun workspace Render visible avec cette cle." }
    $noms = @($owners | ForEach-Object { $_.owner.name })
    "Workspaces visibles : " + ($noms -join ', ')
    try { $proprietaire = Select-RenderOwner $owners $OwnerName }
    catch { throw "$($_.Exception.Message) (visibles : $($noms -join ', ')). Relancer avec -OwnerName <nom> ou -OwnerId usr-xxx." }
    $OwnerId = $proprietaire.id
    "Workspace retenu : $($proprietaire.name) ($OwnerId)"
}

# --- 2. Variables d'environnement depuis .env (liste blanche) ----------------
$cles = @(
    "APP_ENV", "DEBUG",
    "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_PASSWORD_HASH", "JWT_SECRET", "JWT_ALGORITHM", "JWT_EXPIRE_MINUTES",
    "SESSION_SECRET", "SESSION_EXPIRE_MINUTES",
    "CORS_ORIGINS",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", "EMAIL_FROM_NAME",
    "META_WHATSAPP_TOKEN", "META_PHONE_NUMBER_ID", "META_APP_SECRET", "WHATSAPP_TEMPLATE_NAME",
    "WHATSAPP_VERIFY_TOKEN",
    "RATTRAPAGE_ACTIF", "SEUIL_RATTRAPAGE_HEURES", "INTERVALLE_RATTRAPAGE_MINUTES"
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
"Variables lues dans .env : $($valeurs.Count) | ignorees (vides/absentes) : $($vides.Count)"

# --- 2 bis. Normalisation PRODUCTION ----------------------------------------
# .env est un fichier de developpement ; deux valeurs y sont fausses en ligne :
#  - APP_ENV=development laisserait l'API en mode dev en production ;
#  - CORS_ORIGINS ne declare pas le domaine reel du front -> 403 navigateur
#    (l'API repondrait en curl, le site resterait casse).
$valeurs["APP_ENV"] = "production"
$valeurs["DEBUG"] = "false"

# JWT_SECRET : le code ne s'en sert que pour un controle « n'est pas la valeur
# par defaut » (apps/api/app/core/config.py:60) et l'API REFUSE de demarrer en
# production avec le placeholder. Il ne signe rien (les sessions utilisent
# SESSION_SECRET en HMAC) : le remplacer ne deconnecte personne.
# MAIS il ne se regenere QU'A LA CREATION : sur un service existant, la valeur
# de production est deja en place et un placeholder .env ne doit jamais l'ecraser.
$placeholderJwt = "change-me-in-production-min-32-chars"
$jwtACompleter = $false
if (-not $valeurs.Contains("JWT_SECRET") -or $valeurs["JWT_SECRET"] -eq $placeholderJwt) {
    $jwtACompleter = $true
    "JWT_SECRET : absent ou placeholder dans .env -> genere UNIQUEMENT si le service doit etre cree."
}

$valeurs["CORS_ORIGINS"] = ConvertTo-CorsOrigines ([string]$valeurs["CORS_ORIGINS"]) $origineProd
"CORS_ORIGINS transmis : $($valeurs["CORS_ORIGINS"])"

# --- Porte de simulation : on s'arrete AVANT toute creation -----------------
if ($Simulation) {
    $nonSecretes = @("APP_ENV", "DEBUG", "SUPABASE_URL", "JWT_ALGORITHM", "JWT_EXPIRE_MINUTES",
        "SESSION_EXPIRE_MINUTES", "CORS_ORIGINS", "SMTP_HOST", "SMTP_PORT", "SMTP_USER",
        "EMAIL_FROM", "EMAIL_FROM_NAME", "WHATSAPP_TEMPLATE_NAME",
        "RATTRAPAGE_ACTIF", "SEUIL_RATTRAPAGE_HEURES", "INTERVALLE_RATTRAPAGE_MINUTES")
    "--- Variables qui seraient transmises (secrets : longueur seule) ---"
    foreach ($k in $valeurs.Keys) {
        if ($k -eq "JWT_SECRET" -and $jwtACompleter) {
            "  JWT_SECRET = (genere a la creation du service ; conserve tel quel s'il existe deja)"
            continue
        }
        $v = [string]$valeurs[$k]
        if ($nonSecretes -contains $k) { "  $k = $v" } else { "  $k (secret, $($v.Length) car.)" }
    }
    "Total : $($valeurs.Count) variables | service : $Service | region : $Region | depot : $RepoUrl#$Branch"
    "Simulation terminee : aucun service cree, aucun appel reseau."
    exit 0
}

# --- 3. Service existant (meme workspace) ? sinon creation ------------------
$id = $null; $url = $null
$existants = Invoke-RenderApi "GET" "/services?name=$Service&limit=20"
$trouve = Select-ServiceExistant $existants $Service $OwnerId

if ($trouve) {
    $id = $trouve.id
    $url = $trouve.serviceDetails.url
    "Service existant : $Service ($id) dans le workspace $OwnerId"
    if ($jwtACompleter) {
        $null = $valeurs.Remove("JWT_SECRET")
        "JWT_SECRET : service existant -> aucune valeur transmise (la valeur en place sur Render est conservee)."
    }
}
else {
    if ($jwtACompleter) {
        $caracteres = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        $aleatoire = -join ((1..64) | ForEach-Object { $caracteres[(Get-Random -Maximum $caracteres.Length)] })
        $valeurs["JWT_SECRET"] = $aleatoire
        "JWT_SECRET : valeur aleatoire generee pour Render (non ecrite dans .env)."
    }
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
# Compteur recalcule APRES normalisation : APP_ENV/DEBUG/CORS sont ajoutees ou
# reecrites, JWT_SECRET peut disparaitre sur un service existant.
$liste = @()
foreach ($k in $valeurs.Keys) { $liste += @{ key = $k; value = [string]$valeurs[$k] } }
"Variables a transmettre : $($liste.Count)"
if ($liste.Count -gt 0) {
    $null = Invoke-RenderApi "PUT" "/services/$id/env-vars" $liste
    "Variables ecrites : $($liste.Count)"
}

# --- 5. Deploiement ---------------------------------------------------------
$lance = Invoke-RenderApi "POST" "/services/$id/deploys" @{ clearCache = "do_not_clear" }
$deployId = $null
if ($lance -and $lance.deploy -and $lance.deploy.id) { $deployId = $lance.deploy.id }
elseif ($lance -and $lance.id) { $deployId = $lance.id }
if (-not $deployId) { throw "Render n'a pas renvoye d'identifiant de deploiement : impossible de suivre CE build." }
"Deploiement lance : $deployId. Attente du statut (max 40 min)..."

$etatsFinaux = @("live", "build_failed", "canceled", "deactivated", "pre_deploy_failed", "update_failed")
$final = ""
for ($i = 0; $i -lt 240; $i++) {
    Start-Sleep -Seconds 10
    $d = Invoke-RenderApi "GET" "/services/$id/deploys/$deployId"
    if (-not $d) { continue }
    $obj = if ($d.deploy) { $d.deploy } else { $d }
    $final = [string]$obj.status
    if ($etatsFinaux -contains $final) { break }
}

$s = Invoke-RenderApi "GET" "/services/$id"
if ($s.service) { $s = $s.service }
$url = $s.serviceDetails.url
"URL du service : $url"

if ($final -ne "live") {
    # Distinguer « encore en cours » de « echoue », et sonder /health AVANT
    # d'echouer : un /health vivant signifie que l'ancien deploiement sert encore.
    if ($etatsFinaux -contains $final) {
        $diagnostic = "ECHOUE (statut '$final')"
    }
    else {
        $diagnostic = "EN COURS apres 40 min (dernier statut connu : '$final')"
    }
    $etatSante = "URL absente : /health non sonde"
    if (-not [string]::IsNullOrWhiteSpace([string]$url)) {
        $cible = ([string]$url).Trim().TrimEnd("/")
        try {
            $null = Invoke-RestMethod "$cible/health" -TimeoutSec 20
            $etatSante = "repond sur /health (le deploiement precedent est encore servi)"
        }
        catch { $etatSante = "ne repond pas sur /health" }
    }
    throw "Deploiement $deployId $diagnostic. Service $Service ($id) : $etatSante. Voir les logs dans le dashboard Render."
}

# --- 6. Preuve immediate ----------------------------------------------------
# URL obligatoire : sans elle, preuve-api.ps1 demarrerait l'API locale (faux VERT).
$urlPreuve = Assert-UrlDeploiement $url
"--- Preuve : $urlPreuve ---"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Repo "scripts\preuve-api.ps1") -Base $urlPreuve
$codePreuve = $LASTEXITCODE
if ($codePreuve -ne 0) {
    throw "Preuve API NON VERTE (exit $codePreuve) sur $urlPreuve : le deploiement n'est pas valide."
}
"Preuve API : VERTE (exit 0) sur $urlPreuve"
