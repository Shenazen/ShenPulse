param(
    [Parameter(Mandatory = $true)]
    [string]$PreviousVersion,

    [Parameter(Mandatory = $true)]
    [string]$CurrentVersion
)

$ErrorActionPreference = 'Stop'

function Invoke-UpgradeSmoke {
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
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

    Write-Output "Mise à jour $PreviousVersion -> $CurrentVersion validée avec conservation des données utilisateur."
}
finally {
    $remainingProcesses = @(
        Get-Process -Name ShenPulse -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Path -and $_.Path.StartsWith(
                    $installRoot,
                    [System.StringComparison]::OrdinalIgnoreCase
                )
            }
    )
    foreach ($process in $remainingProcesses) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }

    $uninstallerPath = Join-Path $installRoot 'Uninstall ShenPulse.exe'
    if (Test-Path -LiteralPath $uninstallerPath -PathType Leaf) {
        Start-Process `
            -FilePath $uninstallerPath `
            -ArgumentList @('/S', '/currentuser') `
            -WindowStyle Hidden `
            -Wait | Out-Null
    }

    foreach ($shortcut in $shortcutBackups) {
        if ($shortcut.Existed -and (Test-Path -LiteralPath $shortcut.Backup)) {
            Copy-Item -LiteralPath $shortcut.Backup -Destination $shortcut.Path -Force
        }
        elseif (-not $shortcut.Existed -and (Test-Path -LiteralPath $shortcut.Path)) {
            Remove-Item -LiteralPath $shortcut.Path -Force
        }
    }

    $resolvedSmokeRoot = [System.IO.Path]::GetFullPath($smokeRoot)
    if (
        (Test-Path -LiteralPath $resolvedSmokeRoot) -and
        $resolvedSmokeRoot.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase) -and
        [System.IO.Path]::GetFileName($resolvedSmokeRoot) -like 'ShenPulseUpgradeSmoke-*'
    ) {
        Remove-Item -LiteralPath $resolvedSmokeRoot -Recurse -Force
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
        -ArgumentList @("--user-data-dir=$UserDataDirectory") `
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
    foreach ($process in $running) {
        Stop-Process -Id $process.Id -Force
    }
    Wait-Process -Id $running.Id -Timeout 10 -ErrorAction SilentlyContinue
}

Invoke-UpgradeSmoke
