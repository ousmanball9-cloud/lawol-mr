# Test HORS LIGNE de scripts\deploy-render.ps1 et scripts\preuve-api.ps1.
# Aucun appel reseau, aucune cle API, aucun service Render, aucun uvicorn.
# Rejoue la revue independante du 12/11 :
#   - parsing CORS (dont le cas d'UNE seule origine : piege value/Count) ;
#   - selection du workspace (jamais owners[0], jamais un homonyme d'un autre workspace) ;
#   - refus d'une URL de service vide (sinon la preuve tombe sur l'API locale -> faux VERT).
#
# Usage : powershell -File scripts\test-deploy-render.ps1
# Sortie : une ligne par cas, puis VERT / ROUGE. Exit 0 = VERT, 1 = ROUGE.

param(
    [string]$Repo = ""
)

$ErrorActionPreference = "Stop"
if (-not $Repo) { $Repo = Split-Path -Parent $PSScriptRoot }

$deploy = Join-Path $Repo "scripts\deploy-render.ps1"
$preuve = Join-Path $Repo "scripts\preuve-api.ps1"
foreach ($f in @($deploy, $preuve)) {
    if (-not (Test-Path $f)) { "KO - script introuvable : $f"; exit 1 }
}

$script:total = 0
$script:echecs = New-Object System.Collections.ArrayList

function Check {
    param([string]$Nom, [scriptblock]$Corps)
    $script:total++
    try {
        $null = & $Corps
        "  [OK] $Nom"
    }
    catch {
        [void]$script:echecs.Add("$Nom -> $($_.Exception.Message)")
        "  [KO] $Nom -> $($_.Exception.Message)"
    }
}

function DoitEchouer {
    param([scriptblock]$Corps, [string]$Attendu = "")
    try { $null = & $Corps }
    catch {
        if ($Attendu -and $_.Exception.Message -notmatch $Attendu) {
            throw "message inattendu : $($_.Exception.Message)"
        }
        return
    }
    throw "aucune erreur levee alors qu'un echec etait attendu"
}

# --- Chargement des fonctions SANS executer le corps du script --------------
. $deploy -TestUnitaires
$ErrorActionPreference = "Stop"   # le script source force "Continue"

foreach ($fn in @("ConvertTo-CorsOrigines", "Assert-UrlDeploiement", "Select-RenderOwner", "Select-ServiceExistant")) {
    if (-not (Get-Command $fn -CommandType Function -ErrorAction SilentlyContinue)) {
        "KO - fonction absente de deploy-render.ps1 : $fn"; exit 1
    }
}

"--- CORS_ORIGINS (normalisation pour Render) ---"

Check "1 seule origine (chaine brute) -> tableau d'1 element, pas un objet value/Count" {
    $r = ConvertTo-CorsOrigines "https://lawol-mr.vercel.app" "https://lawol-mr.vercel.app"
    if ($r -ne '["https://lawol-mr.vercel.app"]') { throw "obtenu : $r" }
    $t = ConvertFrom-Json $r
    if (@($t).Count -ne 1) { throw "elements : $(@($t).Count)" }
}

Check "1 seule origine (deja entre crochets et guillemets) -> meme resultat" {
    $r = ConvertTo-CorsOrigines '["https://lawol-mr.vercel.app"]' "https://lawol-mr.vercel.app"
    if ($r -ne '["https://lawol-mr.vercel.app"]') { throw "obtenu : $r" }
}

Check "origines http:// ecartees, prod conservee" {
    $r = ConvertTo-CorsOrigines '["https://a.example","http://localhost:3000","https://lawol-mr.vercel.app"]' "https://lawol-mr.vercel.app"
    if ($r -ne '["https://a.example","https://lawol-mr.vercel.app"]') { throw "obtenu : $r" }
}

Check "origine prod TOUJOURS ajoutee quand .env l'oublie" {
    $r = ConvertTo-CorsOrigines '["https://a.example"]' "https://lawol-mr.vercel.app"
    if ($r -notlike '*"https://lawol-mr.vercel.app"*') { throw "prod absente : $r" }
}

Check "doublons supprimes (ordre conserve)" {
    $r = ConvertTo-CorsOrigines 'https://a.example,https://a.example,https://lawol-mr.vercel.app' "https://lawol-mr.vercel.app"
    if ($r -ne '["https://a.example","https://lawol-mr.vercel.app"]') { throw "obtenu : $r" }
}

Check "valeur vide ou absente -> prod seule" {
    foreach ($brut in @("", "   ", $null)) {
        $r = ConvertTo-CorsOrigines $brut "https://lawol-mr.vercel.app"
        if ($r -ne '["https://lawol-mr.vercel.app"]') { throw "entree '$brut' -> $r" }
    }
}

Check "aucune fuite de 'value' ni 'Count' dans la sortie serialisee" {
    $r = ConvertTo-CorsOrigines '["https://a.example"]' "https://lawol-mr.vercel.app"
    if ($r -match 'value|Count') { throw "serialisation suspecte : $r" }
}

"--- Workspace Render (jamais owners[0]) ---"

$owners = @(
    [pscustomobject]@{ owner = [pscustomobject]@{ id = "usr-my"; name = "My Workspace" } },
    [pscustomobject]@{ owner = [pscustomobject]@{ id = "usr-lawol"; name = "Lawol" } }
)

Check "selection par nom : 'Lawol' retenu, pas 'My Workspace' (owners[0])" {
    $o = Select-RenderOwner $owners "Lawol"
    if ($o.id -ne "usr-lawol") { throw "workspace retenu : $($o.id)" }
}

Check "nom ambigu (2 workspaces identiques) -> echec explicite" {
    $double = $owners + [pscustomobject]@{ owner = [pscustomobject]@{ id = "usr-lawol2"; name = "Lawol" } }
    DoitEchouer { Select-RenderOwner $double "Lawol" } "ambiguite"
}

Check "nom absent -> echec explicite" {
    DoitEchouer { Select-RenderOwner $owners "Inexistant" } "Aucun workspace"
}

"--- Service existant (filtre ownerId) ---"

$services = @(
    [pscustomobject]@{ service = [pscustomobject]@{ id = "srv-ailleurs"; name = "lawol-api"; ownerId = "usr-my"; serviceDetails = [pscustomobject]@{ url = "https://ailleurs.onrender.com" } } },
    [pscustomobject]@{ service = [pscustomobject]@{ id = "srv-lawol"; name = "lawol-api"; ownerId = "usr-lawol"; serviceDetails = [pscustomobject]@{ url = "https://lawol-api.onrender.com" } } }
)

Check "homonyme d'un AUTRE workspace ignore" {
    $s = Select-ServiceExistant $services "lawol-api" "usr-inconnu"
    if ($null -ne $s) { throw "service retenu a tort : $($s.id)" }
}

Check "service du bon workspace retenu" {
    $s = Select-ServiceExistant $services "lawol-api" "usr-lawol"
    if (-not $s -or $s.id -ne "srv-lawol") { throw "service retenu : $($s.id)" }
}

Check "arret au PREMIER match (pas le dernier)" {
    $deux = @(
        [pscustomobject]@{ service = [pscustomobject]@{ id = "srv-1"; name = "lawol-api"; ownerId = "usr-lawol" } },
        [pscustomobject]@{ service = [pscustomobject]@{ id = "srv-2"; name = "lawol-api"; ownerId = "usr-lawol" } }
    )
    $s = Select-ServiceExistant $deux "lawol-api" "usr-lawol"
    if ($s.id -ne "srv-1") { throw "service retenu : $($s.id)" }
}

Check "OwnerId vide -> refus (jamais de selection non filtree)" {
    DoitEchouer { Select-ServiceExistant $services "lawol-api" "" } "OwnerId vide"
}

"--- URL de preuve (refus d'une URL vide) ---"

Check "URL vide -> echec (sinon preuve sur l'API locale = faux VERT)" {
    DoitEchouer { Assert-UrlDeploiement "" } "URL de service vide"
}

Check "URL faite d'espaces -> echec" {
    DoitEchouer { Assert-UrlDeploiement "   " } "URL de service vide"
}

Check "URL valide normalisee (slash final retire)" {
    $u = Assert-UrlDeploiement " https://lawol-api.onrender.com/ "
    if ($u -ne "https://lawol-api.onrender.com") { throw "obtenu : '$u'" }
}

Check "URL non http(s) -> echec" {
    DoitEchouer { Assert-UrlDeploiement "ftp://exemple" } "non http"
}

"--- preuve-api.ps1 : cible vide refusee AVANT tout appel ---"

Check "sans -Base : exit non nul + message KO, aucun demarrage local" {
    $sortie = Join-Path $env:TEMP ("preuve-vide-" + [guid]::NewGuid().ToString("N") + ".txt")
    $erreur = "$sortie.err"
    try {
        $p = Start-Process -FilePath "powershell" `
            -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $preuve) `
            -PassThru -WindowStyle Hidden -RedirectStandardOutput $sortie -RedirectStandardError $erreur
        if (-not $p.WaitForExit(30000)) { try { $p.Kill() } catch { }; throw "delai depasse : le script a tente de demarrer quelque chose" }
        $code = $p.ExitCode
        $txt = ""
        if (Test-Path $sortie) { $txt = Get-Content $sortie -Raw }
        if ($code -eq 0) { throw "exit 0 alors qu'une cible vide doit echouer" }
        if ($txt -notmatch "KO") { throw "message KO absent : $txt" }
        if ($txt -match "Cible :") { throw "le script a continue vers une cible : $txt" }
    }
    finally {
        foreach ($f in @($sortie, $erreur)) { if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue } }
    }
}

"--- Garde-fous presents dans le script (anti-regression) ---"

Check "deploy-render.ps1 : URL verifiee, exit code propage, ownerId filtre, plafond 40 min" {
    $src = Get-Content $deploy -Raw
    if ($src -notmatch 'Assert-UrlDeploiement \$url') { throw "URL non verifiee avant la preuve" }
    if ($src -notmatch '\$LASTEXITCODE') { throw "exit code de la preuve non propage" }
    if ($src -notmatch 'service\.ownerId -ne \$Owner') { throw "filtre ownerId absent" }
    if ($src -notmatch '\$i -lt 240') { throw "plafond d'attente != 40 min" }
    if ($src -notmatch 'avecCorps') { throw "masquage du detail des appels avec corps absent" }
}

""
if ($script:echecs.Count -eq 0) {
    "VERT - $script:total/$script:total cas passes (hors ligne, aucun appel reseau)."
    exit 0
}
"ROUGE - $($script:echecs.Count) echec(s) sur $script:total cas :"
foreach ($e in $script:echecs) { "  - $e" }
exit 1
