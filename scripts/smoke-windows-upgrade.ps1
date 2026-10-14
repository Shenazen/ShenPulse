param(
    [Parameter(Mandatory = $true)]
    [string]$PreviousVersion,

    [Parameter(Mandatory = $true)]
    [string]$CurrentVersion
)

$ErrorActionPreference = 'Stop'

function Invoke-UpgradeSmoke {
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$packageJson = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
. (Join-Path $PSScriptRoot 'lib\smoke-registry-isolation.ps1')
. (Join-Path $PSScriptRoot 'lib\smoke-process-isolation.ps1')
Assert-ShenPulseSmokeRegistryIsolation -PackageJson $packageJson | Out-Null
$previousInstaller = Join-Path $projectRoot "dist\ShenPulseSetup-$PreviousVersion-x64.exe"
$currentInstaller = Join-Path $projectRoot "dist\ShenPulseSetup-$CurrentVersion-x64.exe"
foreach ($installer in @($previousInstaller, $currentInstaller)) {
    if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
        throw "Installateur introuvable : $installer"
    }
}

$temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$smokeRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $temporaryBase "ShenPulseUpgradeSmoke-$PreviousVersion-to-$CurrentVersion-$PID")
)
if (
    -not $smokeRoot.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase) -or
    [System.IO.Path]::GetFileName($smokeRoot) -notlike 'ShenPulseUpgradeSmoke-*'
) {
    throw "Dossier temporaire inattendu : $smokeRoot"
}

$installRoot = Join-Path $smokeRoot 'installation'
$userDataRoot = Join-Path $smokeRoot 'user-data'
$backupRoot = Join-Path $smokeRoot 'shortcuts'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'ShenPulse.lnk'
$startMenuShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\ShenPulse.lnk'
$shortcutBackups = @(
    [pscustomobject]@{
        Path = $desktopShortcut
        Backup = Join-Path $backupRoot 'desktop.lnk'
        Existed = Test-Path -LiteralPath $desktopShortcut
    },
    [pscustomobject]@{
        Path = $startMenuShortcut
        Backup = Join-Path $backupRoot 'start-menu.lnk'
        Existed = Test-Path -LiteralPath $startMenuShortcut
    }
)

New-Item -ItemType Directory -Path $installRoot, $userDataRoot, $backupRoot -Force | Out-Null
foreach ($shortcut in $shortcutBackups) {
    if ($shortcut.Existed) {
        Copy-Item -LiteralPath $shortcut.Path -Destination $shortcut.Backup -Force
    }
}

$smokeSucceeded = $false
try {
    Install-Version -Installer $previousInstaller -Destination $installRoot

    $installedExecutable = Join-Path $installRoot 'ShenPulse.exe'
    Assert-InstalledVersion -Executable $installedExecutable -ExpectedVersion $PreviousVersion

    $markerPath = Join-Path $userDataRoot 'upgrade-preservation-marker.txt'
    Set-Content -LiteralPath $markerPath -Value 'ShenPulse upgrade preservation test' -Encoding UTF8
    Start-And-Stop-Version -Executable $installedExecutable -UserDataDirectory $userDataRoot

    Install-Version -Installer $currentInstaller -Destination $installRoot
    Assert-InstalledVersion -Executable $installedExecutable -ExpectedVersion $CurrentVersion
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        throw 'Les données utilisateur ont été supprimées pendant la mise à jour.'
    }
    Start-And-Stop-Version -Executable $installedExecutable -UserDataDirectory $userDataRoot

    $smokeSucceeded = $true
    Write-Output "Mise à jour $PreviousVersion -> $CurrentVersion validée avec conservation des données utilisateur."
}
catch {
    # La sortie du diagnostic ne doit pas être remplacée par une erreur finally.
    Write-Error -ErrorRecord $_ -ErrorAction Continue
    throw
}
finally {
    try {
        Stop-ShenPulseSmokeProcesses -Executable (Join-Path $installRoot 'ShenPulse.exe') | Out-Null

        $uninstallerPath = Join-Path $installRoot 'Uninstall ShenPulse.exe'
        if (Test-Path -LiteralPath $uninstallerPath -PathType Leaf) {
            $cleanupUninstaller = Start-Process `
                -FilePath $uninstallerPath `
                -ArgumentList @('/S', '/currentuser', "_?=$installRoot") `
                -WindowStyle Hidden `
                -Wait -PassThru
            if ($cleanupUninstaller.ExitCode -ne 0) { throw 'Le désinstalleur de nettoyage a échoué.' }
            Wait-ShenPulseSmokeRegistryIsolation -PackageJson $packageJson | Out-Null
        }
    }
    finally {

    foreach ($shortcut in $shortcutBackups) {
        if ($shortcut.Existed -and (Test-Path -LiteralPath $shortcut.Backup)) {
            Copy-Item -LiteralPath $shortcut.Backup -Destination $shortcut.Path -Force
        }
        elseif (-not $shortcut.Existed -and (Test-Path -LiteralPath $shortcut.Path)) {
            Remove-Item -LiteralPath $shortcut.Path -Force
        }
    }

    Assert-ShenPulseSmokeRegistryIsolation -PackageJson $packageJson | Out-Null

    $resolvedSmokeRoot = [System.IO.Path]::GetFullPath($smokeRoot)
    if (
        $smokeSucceeded -and
        (Test-Path -LiteralPath $resolvedSmokeRoot) -and
        $resolvedSmokeRoot.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase) -and
        [System.IO.Path]::GetFileName($resolvedSmokeRoot) -like 'ShenPulseUpgradeSmoke-*'
    ) {
        Remove-Item -LiteralPath $resolvedSmokeRoot -Recurse -Force
    }
    }
}

}

function Install-Version {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Installer,

        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    $process = Start-Process `
        -FilePath $Installer `
        -ArgumentList @('/S', '/currentuser', "/D=$Destination") `
        -WindowStyle Hidden `
        -Wait `
        -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Installation échouée pour $Installer (code $($process.ExitCode))."
    }
}

function Assert-InstalledVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Executable,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedVersion
    )

    if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
        throw "Exécutable installé introuvable : $Executable"
    }
    $actualVersion = (Get-Item -LiteralPath $Executable).VersionInfo.ProductVersion
    $expectedWindowsVersion = if (($ExpectedVersion -split '\.').Count -eq 3) {
        "$ExpectedVersion.0"
    }
    else {
        $ExpectedVersion
    }
    if ($actualVersion -ne $expectedWindowsVersion) {
        throw "Version installée inattendue : $actualVersion au lieu de $expectedWindowsVersion."
    }
}

function Start-And-Stop-Version {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Executable,

        [Parameter(Mandatory = $true)]
        [string]$UserDataDirectory
    )

    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Start-Process `
        -FilePath $Executable `
        -ArgumentList @("--shenpulse-smoke-user-data-dir=$UserDataDirectory") `
        -WorkingDirectory (Split-Path -Parent $Executable) `
        -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 5

    $running = @(
        Get-Process -Name ShenPulse -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -eq $Executable }
    )
    if ($running.Count -eq 0) {
        throw "L'application installée ne s'est pas lancée : $Executable"
    }
    Stop-ShenPulseSmokeProcesses -Executable $Executable | Out-Null
}

Invoke-UpgradeSmoke
