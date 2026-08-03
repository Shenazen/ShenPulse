$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$packageJsonPath = Join-Path $projectRoot 'package.json'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = [string]$packageJson.build.buildVersion
if ([string]::IsNullOrWhiteSpace($version)) {
    $version = [string]$packageJson.version
}
if ([string]::IsNullOrWhiteSpace($version)) {
    throw "Version de package absente : $packageJsonPath"
}

$temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$temporaryOutput = Join-Path $temporaryBase "ShenPulseRelease-$version-$PID"
$resolvedTemporaryOutput = [System.IO.Path]::GetFullPath($temporaryOutput)
if (-not $resolvedTemporaryOutput.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Dossier temporaire inattendu : $resolvedTemporaryOutput"
}

$distDirectory = Join-Path $projectRoot 'dist'
$expectedArtifactName = "ShenPulseSetup-$version-x64.exe"
$expectedTemporaryArtifact = Join-Path $resolvedTemporaryOutput $expectedArtifactName
$finalArtifact = Join-Path $distDirectory $expectedArtifactName
$websiteArtifactName = "ShenPulseSetup-$version.exe"
$websiteArtifact = Join-Path $distDirectory $websiteArtifactName
$electronBuilder = Join-Path $projectRoot 'node_modules\.bin\electron-builder.cmd'

New-Item -ItemType Directory -Path $resolvedTemporaryOutput -Force | Out-Null
New-Item -ItemType Directory -Path $distDirectory -Force | Out-Null

try {
    & $electronBuilder `
        --win nsis `
        --x64 `
        "--config.directories.output=$resolvedTemporaryOutput"
    if ($LASTEXITCODE -ne 0) {
        throw "electron-builder a échoué avec le code $LASTEXITCODE."
    }
    if (-not (Test-Path -LiteralPath $expectedTemporaryArtifact)) {
        throw "Installateur NSIS introuvable : $expectedTemporaryArtifact"
    }

    Copy-Item -LiteralPath $expectedTemporaryArtifact -Destination $finalArtifact -Force
    Copy-Item -LiteralPath $expectedTemporaryArtifact -Destination $websiteArtifact -Force
    Write-Output "Installateur Windows prêt : $finalArtifact"
    Write-Output "Copie pour le site prête : $websiteArtifact"
}
finally {
    if (
        (Test-Path -LiteralPath $resolvedTemporaryOutput) -and
        $resolvedTemporaryOutput.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase) -and
        ([System.IO.Path]::GetFileName($resolvedTemporaryOutput) -like 'ShenPulseRelease-*')
    ) {
        Remove-Item -LiteralPath $resolvedTemporaryOutput -Recurse -Force
    }
}
