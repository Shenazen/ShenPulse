[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version,

  [string]$InstallerPath = '',
  [string]$SiteDirectory = '',
  [string]$IdentityFile = 'C:\Users\alexa\.ssh\shenpulse_vps',
  [string]$SshHost = '213.32.22.185',
  [string]$SshUser = 'debian',
  [string]$RemoteRoot = '/var/www/shenpulse',
  [switch]$Publish
)

# Publication limitée à la vitrine et à un EXE versionné. Le backend, les jeux,
# les anciens installateurs et les secrets ne font jamais partie de l'archive.
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5 propage -WhatIf jusqu'à des commandes internes de
# Get-FileHash, ce qui peut supprimer son résultat. Les contrôles ci-dessous
# sont strictement en lecture seule ; la préférence d'origine est restaurée
# avant tout ShouldProcess, staging, connexion SSH ou autre écriture.
$releaseWhatIfPreference = $WhatIfPreference
$WhatIfPreference = $false
try {
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$projectPackage = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Version -ne [string]$projectPackage.version) { throw 'La version demandée ne correspond pas à package.json.' }
if ($SshHost -ne '213.32.22.185' -or $SshUser -ne 'debian' -or $RemoteRoot -ne '/var/www/shenpulse') {
  throw 'Destination différente de la configuration VPS ShenPulse vérifiée : arrêter et contrôler la procédure.'
}
if (-not $InstallerPath) { $InstallerPath = Join-Path $projectRoot "dist\ShenPulseSetup-$Version.exe" }
if (-not $SiteDirectory) { $SiteDirectory = Join-Path $projectRoot 'website\dist' }
$InstallerPath = (Resolve-Path -LiteralPath $InstallerPath).ProviderPath
$SiteDirectory = (Resolve-Path -LiteralPath $SiteDirectory).ProviderPath.TrimEnd('\', '/')
$IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).ProviderPath
$installerName = "ShenPulseSetup-$Version.exe"
if ([IO.Path]::GetFileName($InstallerPath) -ne $installerName) { throw "L'installateur public doit porter le nom $installerName." }
if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) { throw 'Installateur absent.' }
if ((Get-Item -LiteralPath $SiteDirectory).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Le site doit être un dossier réel, pas un lien.' }

$requiredFiles = @('index.html', '404.html', 'app.js', 'app/legal-pages.js', 'content.js', 'game-catalog.js', 'styles.css')
$allowedExtensions = @('.html', '.css', '.js', '.xml', '.txt', '.webmanifest', '.png', '.webp', '.jpg', '.jpeg', '.svg', '.gif', '.ico', '.woff', '.woff2')
$publicFiles = @(Get-ChildItem -LiteralPath $SiteDirectory -File -Recurse | ForEach-Object {
  if ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Lien refusé : $($_.Name)" }
  $relative = $_.FullName.Substring($SiteDirectory.Length + 1).Replace('\', '/')
  if ($relative -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or $relative.Contains('..') -or $relative -match '(^|/)-') {
    throw "Chemin de publication non sûr : $relative"
  }
  if ($relative -match '^(downloads|games|private|server|protected-match-media)(/|$)' -or $allowedExtensions -notcontains $_.Extension.ToLowerInvariant()) {
    throw "Fichier hors périmètre de la vitrine : $relative"
  }
  [pscustomobject]@{ Path = $relative; Hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
})
foreach ($directory in Get-ChildItem -LiteralPath $SiteDirectory -Directory -Recurse) {
  if ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Dossier lié refusé : $($directory.Name)" }
}
foreach ($required in $requiredFiles) {
  if ($publicFiles.Path -notcontains $required) { throw "Site incomplet : $required" }
}
$expectedDownload = "/downloads/$installerName"
foreach ($file in @('app.js', 'index.html')) {
  if (-not [IO.File]::ReadAllText((Join-Path $SiteDirectory $file)).Contains($expectedDownload)) {
    throw "Le fichier $file ne référence pas l'installateur $Version. Reconstruire et valider le site après les builds."
  }
}
$installerHash = (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash.ToLowerInvariant()
$installerSize = (Get-Item -LiteralPath $InstallerPath).Length
} finally {
  $WhatIfPreference = $releaseWhatIfPreference
}
$target = "$SshUser@$SshHost"
$sshOptions = @('-i', $IdentityFile, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10')

Write-Host "EXE : $installerName, $installerSize octets, SHA-256 $installerHash"
Write-Host "Site : $($publicFiles.Count) fichiers statiques ; destination $target`:$RemoteRoot/dist"
Write-Host 'Ordre : préparation privée, contrôle SHA-256, EXE versionné, sauvegarde vitrine, modules/contenu, app.js, HTML.'
Write-Host 'Conservés : downloads existants, games, backend, private, .env, données et processus PM2.'
if (-not $Publish) {
  Write-Host 'Plan uniquement. Ajouter -Publish après validation explicite des contrôles de release.'
  return
}
if (-not $PSCmdlet.ShouldProcess("$target`:$RemoteRoot", "Publier la vitrine et $installerName")) { return }

# Tous les identifiants interpolés dans Bash proviennent des valeurs validées
# ci-dessus ou de nombres/empreintes générés localement, jamais d'un secret.
$releaseId = "public-site-$Version-$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ'))-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
$artifactDirectory = Join-Path $projectRoot ".artifacts\public-site-release\$releaseId"
New-Item -ItemType Directory -Path $artifactDirectory | Out-Null
$archivePath = Join-Path $artifactDirectory 'site.tar.gz'
$checksumPath = Join-Path $artifactDirectory 'site.sha256'
$orderPath = Join-Path $artifactDirectory 'publish-order.txt'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($checksumPath, (($publicFiles | ForEach-Object { "$($_.Hash)  $($_.Path)" }) -join "`n") + "`n", $utf8NoBom)
$firstFiles = @($publicFiles.Path | Where-Object { $_ -notin @('app.js', 'index.html', '404.html') } | Sort-Object)
[IO.File]::WriteAllText($orderPath, (($firstFiles + @('app.js', 'index.html', '404.html')) -join "`n") + "`n", $utf8NoBom)
& tar -czf $archivePath -C $SiteDirectory -- @($publicFiles.Path)
if ($LASTEXITCODE -ne 0) { throw "Échec de création de l'archive de vitrine." }
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$remoteStage = "$RemoteRoot/.deploy-staging/$releaseId"
$remoteBackup = "$RemoteRoot/.public-site-backups/pre-$releaseId"

$prepare = @"
set -euo pipefail
test "`$(realpath -e '$RemoteRoot')" = '$RemoteRoot'
test "`$(realpath -e '$RemoteRoot/dist')" = '$RemoteRoot/dist'
test "`$(realpath -e '$RemoteRoot/dist/downloads')" = '$RemoteRoot/dist/downloads'
test -d '$RemoteRoot/server'
test ! -e '$remoteStage'
mkdir -m 700 -- '$remoteStage'
# end
"@
$prepare.Replace("`r", '') | & ssh @sshOptions $target 'bash -s'
if ($LASTEXITCODE -ne 0) { throw 'Préparation VPS refusée ; vérifier les cibles et l’empreinte SSH sans les contourner.' }
& scp @sshOptions $InstallerPath "${target}:$remoteStage/$installerName.part"
if ($LASTEXITCODE -ne 0) { throw 'Envoi de l’installateur interrompu : aucun lien public modifié.' }
& scp @sshOptions $archivePath $checksumPath $orderPath "${target}:$remoteStage/"
if ($LASTEXITCODE -ne 0) { throw 'Envoi du site interrompu : aucun fichier public modifié.' }

$publishScript = @"
set -euo pipefail
root='$RemoteRoot'
stage='$remoteStage'
backup='$remoteBackup'
public="`$root/dist"
test "`$(realpath -e "`$root")" = '$RemoteRoot'
test "`$(realpath -e "`$public")" = '$RemoteRoot/dist'
test "`$(realpath -e "`$public/downloads")" = '$RemoteRoot/dist/downloads'
printf '%s  %s\n' '$installerHash' "`$stage/$installerName.part" | sha256sum -c -
printf '%s  %s\n' '$archiveHash' "`$stage/site.tar.gz" | sha256sum -c -
mkdir -m 700 -- "`$stage/site"
tar -xzf "`$stage/site.tar.gz" --no-same-owner -C "`$stage/site"
test -z "`$(find "`$stage/site" -type l -print -quit)"
(cd "`$stage/site" && sha256sum -c "`$stage/site.sha256")
while IFS= read -r file; do
  case "`$file" in ''|/*|*..*|downloads|downloads/*|games|games/*|private|private/*|server|server/*|protected-match-media|protected-match-media/*) exit 71;; esac
  case "`$file" in *[!a-zA-Z0-9._/-]*) exit 72;; esac
  test -f "`$stage/site/`$file"
  parent="`$(dirname "`$public/`$file")"
  test "`$(realpath -m "`$parent")" = "`$parent"
  test ! -L "`$public/`$file"
  test ! -d "`$public/`$file"
done < "`$stage/publish-order.txt"
# Une version déjà publiée n'est jamais écrasée avec un contenu différent.
if [ -e "`$public/downloads/$installerName" ]; then
  test ! -L "`$public/downloads/$installerName"
  printf '%s  %s\n' '$installerHash' "`$public/downloads/$installerName" | sha256sum -c -
else
  install -m 644 -- "`$stage/$installerName.part" "`$public/downloads/.$installerName.$releaseId.part"
  printf '%s  %s\n' '$installerHash' "`$public/downloads/.$installerName.$releaseId.part" | sha256sum -c -
  mv -T -- "`$public/downloads/.$installerName.$releaseId.part" "`$public/downloads/$installerName"
fi
# Toutes les sauvegardes précèdent la première modification de la vitrine.
mkdir -m 700 -- "`$backup"
cp -- "`$stage/site.sha256" "`$backup/new-site.sha256"
cp -- "`$stage/publish-order.txt" "`$backup/publish-order.txt"
while IFS= read -r file; do
  if [ -f "`$public/`$file" ]; then
    mkdir -p -- "`$backup/public/`$(dirname "`$file")"
    cp -p -- "`$public/`$file" "`$backup/public/`$file"
  else
    printf '%s\n' "`$file" >> "`$backup/previously-absent.txt"
  fi
done < "`$stage/publish-order.txt"
while IFS= read -r file; do
  mkdir -p -- "`$(dirname "`$public/`$file")"
  install -m 644 -- "`$stage/site/`$file" "`$public/`$file.$releaseId.part"
  mv -T -- "`$public/`$file.$releaseId.part" "`$public/`$file"
done < "`$stage/publish-order.txt"
(cd "`$public" && sha256sum -c "`$stage/site.sha256")
printf '%s  %s\n' '$installerHash' "`$public/downloads/$installerName" | sha256sum -c -
printf 'Publication terminée. Sauvegarde : %s\n' "`$backup"
# end
"@
# Conservation du script exact et des empreintes pour le rapport de release.
[IO.File]::WriteAllText((Join-Path $artifactDirectory 'publish-remote.sh'), $publishScript.Replace("`r", ''), $utf8NoBom)
$publishScript.Replace("`r", '') | & ssh @sshOptions $target 'bash -s'
if ($LASTEXITCODE -ne 0) { throw "Publication interrompue. Ne pas relancer aveuglément : inspecter $remoteStage et la sauvegarde $remoteBackup." }
Write-Host "Contrôles HTTP à effectuer : https://www.shenpulse.leuridan.fr/ et https://www.shenpulse.leuridan.fr$expectedDownload"
Write-Host "Rapport local et script conservés : $artifactDirectory"
