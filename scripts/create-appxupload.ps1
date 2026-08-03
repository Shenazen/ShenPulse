$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$distDirectory = Join-Path $projectRoot 'dist'
$packageJsonPath = Join-Path $projectRoot 'package.json'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = [string]$packageJson.build.buildVersion
if ([string]::IsNullOrWhiteSpace($version)) {
    $version = [string]$packageJson.version
}
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "Version de package absente : $packageJsonPath"
}
$packageFileName = "ShenPulse-$version-x64.appx"
$packagePath = Join-Path $distDirectory $packageFileName
$zipPath = Join-Path $distDirectory "ShenPulse-$version-x64.zip"
$uploadPath = Join-Path $distDirectory "ShenPulse-$version-x64.appxupload"

if (-not (Test-Path -LiteralPath $packagePath)) {
    throw "Package Store introuvable : $packagePath"
}

foreach ($target in @($zipPath, $uploadPath)) {
    if (Test-Path -LiteralPath $target) {
        $resolved = (Resolve-Path -LiteralPath $target).Path
        if (-not $resolved.StartsWith((Resolve-Path -LiteralPath $distDirectory).Path)) {
            throw "Chemin de sortie inattendu : $resolved"
        }
        Remove-Item -LiteralPath $resolved -Force
    }
}

Compress-Archive -LiteralPath $packagePath -DestinationPath $zipPath -CompressionLevel Optimal
Move-Item -LiteralPath $zipPath -Destination $uploadPath

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($uploadPath)
try {
    $entry = $archive.Entries | Where-Object { $_.Name -eq $packageFileName }
    if (-not $entry) {
        throw 'Le conteneur AppXUpload ne contient pas le package attendu.'
    }
}
finally {
    $archive.Dispose()
}

Write-Output "AppXUpload prêt : $uploadPath"
