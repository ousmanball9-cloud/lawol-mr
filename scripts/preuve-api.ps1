# Preuve des filtres V5-A (financement + cloture30) contre N'IMPORTE QUELLE API.
# -Base http://127.0.0.1:8011 (local)  |  -Base https://lawol-api.onrender.com (prod)
# -Local : demarre l'API locale sur le port 8011 et l'arrete a la fin (mode explicite).
# Lecture seule : aucune ecriture, aucune suppression.
#
# Une cible vide n'est JAMAIS remplacee par l'API locale : le 12/11, un
# `-Base ""` (URL de deploiement vide) a produit un VERT sur l'API de la machine
# au lieu de la production. Le script echoue donc avant tout appel reseau.

param(
    [string]$Base = "",
    [string]$Port = "8011",
    [string]$Repo = "D:\opencode\lawol-mr",
    [switch]$Local
)

$ErrorActionPreference = "Stop"
$proc = $null

if ($Local -and -not [string]::IsNullOrWhiteSpace($Base)) {
    "KO - -Local et -Base sont exclusifs : choisir une seule cible."
    exit 2
}
if (-not $Local -and [string]::IsNullOrWhiteSpace($Base)) {
    "KO - -Base vide : la preuve exige une cible explicite."
    "     prod  : -Base https://lawol-api.onrender.com"
    "     local : -Local (demarre uvicorn sur le port $Port) ou -Base http://127.0.0.1:$Port"
    "Aucune cible implicite : une URL vide ne doit jamais valider une autre API que celle demandee."
    exit 2
}

try {
    if ($Local) {
        $Base = "http://127.0.0.1:$Port"
        $proc = Start-Process -FilePath "python" `
            -ArgumentList "-m","uvicorn","apps.api.app.main:app","--host","127.0.0.1","--port","$Port","--log-level","warning" `
            -WorkingDirectory $Repo -PassThru -WindowStyle Hidden
        $pret = $false
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Milliseconds 1000
            try { $null = Invoke-RestMethod "$Base/health" -TimeoutSec 2; $pret = $true; break } catch { }
        }
        if (-not $pret) { "KO - l'API locale ne demarre pas"; exit 1 }
    }
    $Base = $Base.Trim()
    $Base = $Base.TrimEnd("/")
    "Cible : $Base"

    $o = Invoke-RestMethod "$Base/openapi.json" -TimeoutSec 20
    $params = $o.paths.'/api/v1/offres'.get.parameters | ForEach-Object { $_.name }
    $aFinancement = $params -contains "financement"
    $aCloture = $params -contains "cloture30"
    "1) contrat OpenAPI : financement=$aFinancement cloture30=$aCloture"

    $tous = Invoke-RestMethod "$Base/api/v1/offres?type_offre=bourse&limit=400" -TimeoutSec 30
    $fin = Invoke-RestMethod "$Base/api/v1/offres?type_offre=bourse&financement=fully_funded&limit=400" -TimeoutSec 30
    $clot = Invoke-RestMethod "$Base/api/v1/offres?type_offre=bourse&cloture30=1&limit=400" -TimeoutSec 30
    $deux = Invoke-RestMethod "$Base/api/v1/offres?type_offre=bourse&financement=fully_funded&cloture30=1&limit=400" -TimeoutSec 30

    $horsCritere = @($fin | Where-Object { $_.type_financement -ne "fully_funded" }).Count
    $auj = (Get-Date).Date
    $haut = $auj.AddDays(29)
    $tropLoin = 0; $close = 0; $illisible = 0
    foreach ($x in $clot) {
        if (-not $x.date_limite) { $illisible++; continue }
        $d = [datetime]::Parse($x.date_limite).Date
        if ($d -gt $haut) { $tropLoin++ }
        if ($d -lt $auj) { $close++ }
    }

    "2) catalogue public        : $($tous.Count)"
    "3) financement=fully_funded: $($fin.Count) | hors critere : $horsCritere"
    "4) cloture30=1             : $($clot.Count) | > today+29 : $tropLoin | closes : $close | date illisible : $illisible"
    "5) les deux combines       : $($deux.Count)"

    $ok = $aFinancement -and $aCloture -and
        ($horsCritere -eq 0) -and ($tropLoin -eq 0) -and ($close -eq 0) -and
        ($fin.Count -le $tous.Count) -and ($clot.Count -le $tous.Count) -and
        ($deux.Count -le [Math]::Min($fin.Count, $clot.Count))
    "6) VERDICT : " + $(if ($ok) { "VERT" } else { "ROUGE" })
    exit $(if ($ok) { 0 } else { 1 })
}
catch {
    # Toute erreur reseau/parsing est un KO : jamais un exit 0 silencieux.
    "KO - preuve interrompue : $($_.Exception.Message)"
    exit 1
}
finally {
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}
