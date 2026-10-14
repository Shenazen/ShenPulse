$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$packageJson = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw |
    ConvertFrom-Json
. (Join-Path $PSScriptRoot 'lib\smoke-registry-isolation.ps1')
. (Join-Path $PSScriptRoot 'lib\smoke-process-isolation.ps1')
Assert-ShenPulseSmokeRegistryIsolation -PackageJson $packageJson | Out-Null
$version = [string]$packageJson.version
$expectedWindowsVersion = if (($version -split '\.').Count -eq 3) { "$version.0" } else { $version }
$installerPath = Join-Path $projectRoot "dist\ShenPulseSetup-$version-x64.exe"
if (-not (Test-Path -LiteralPath $installerPath)) {
    throw "Installateur introuvable : $installerPath"
}

$temporaryBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$smokeRoot = Join-Path $temporaryBase "ShenPulseInstallerSmoke-$version-$PID"
$smokeRoot = [System.IO.Path]::GetFullPath($smokeRoot)
if (-not $smokeRoot.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Dossier de test inattendu : $smokeRoot"
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

New-Item -ItemType Directory -Path $installRoot,$backupRoot -Force | Out-Null
foreach ($shortcut in $shortcutBackups) {
    if ($shortcut.Existed) {
        Copy-Item -LiteralPath $shortcut.Path -Destination $shortcut.Backup -Force
    }
}

$smokeSucceeded = $false
try {
    $installer = Start-Process `
        -FilePath $installerPath `
        -ArgumentList @('/S', '/currentuser', "/D=$installRoot") `
        -WindowStyle Hidden `
        -Wait `
        -PassThru
    if ($installer.ExitCode -ne 0) {
        throw "L'installation silencieuse a échoué avec le code $($installer.ExitCode)."
    }

    $installedExecutable = Join-Path $installRoot 'ShenPulse.exe'
    $uninstallerPath = Join-Path $installRoot 'Uninstall ShenPulse.exe'
    if (-not (Test-Path -LiteralPath $installedExecutable)) {
        throw "ShenPulse.exe est absent après l'installation."
    }
    if (-not (Test-Path -LiteralPath $uninstallerPath)) {
        throw "Le désinstalleur est absent après l'installation."
    }

    $installedVersion = (Get-Item -LiteralPath $installedExecutable).VersionInfo.ProductVersion
    if ($installedVersion -ne $expectedWindowsVersion) {
        throw "Version installée inattendue : $installedVersion au lieu de $expectedWindowsVersion."
    }

    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Start-Process `
        -FilePath $installedExecutable `
        -ArgumentList @("--shenpulse-smoke-user-data-dir=$userDataRoot") `
        -WorkingDirectory $installRoot `
        -WindowStyle Hidden | Out-Null
    Start-Sleep -Seconds 5
    $running = @(
        Get-Process -Name ShenPulse -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -eq $installedExecutable }
    )
    if ($running.Count -eq 0) {
        throw "L'application installée ne s'est pas lancée."
    }

    Stop-ShenPulseSmokeProcesses -Executable $installedExecutable | Out-Null

    $uninstaller = Start-Process `
        -FilePath $uninstallerPath `
        -ArgumentList @('/S', '/currentuser', "_?=$installRoot") `
        -WindowStyle Hidden `
        -Wait `
        -PassThru
    if ($uninstaller.ExitCode -ne 0) {
        throw "La désinstallation silencieuse a échoué avec le code $($uninstaller.ExitCode)."
    }
    Wait-ShenPulseSmokeRegistryIsolation -PackageJson $packageJson | Out-Null

    for ($attempt = 0; $attempt -lt 20 -and (Test-Path -LiteralPath $installedExecutable); $attempt++) {
        Start-Sleep -Milliseconds 500
    }
    if (Test-Path -LiteralPath $installedExecutable) {
        throw "L'application est encore présente après la désinstallation."
    }

    $smokeSucceeded = $true
    Write-Output "Installation, lancement et désinstallation de ShenPulse $version validés."
}
catch {
    # Conserver le diagnostic primaire même si le contrôle de nettoyage échoue.
    Write-Error -ErrorRecord $_ -ErrorAction Continue
    throw
}
finally {
    try {
        Stop-ShenPulseSmokeProcesses -Executable (Join-Path $installRoot 'ShenPulse.exe') | Out-Null

        $remainingUninstaller = Join-Path $installRoot 'Uninstall ShenPulse.exe'
        if (Test-Path -LiteralPath $remainingUninstaller) {
            $cleanupUninstaller = Start-Process `
                -FilePath $remainingUninstaller `
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

    if (
        $smokeSucceeded -and
        (Test-Path -LiteralPath $smokeRoot) -and
        $smokeRoot.StartsWith($temporaryBase, [System.StringComparison]::OrdinalIgnoreCase) -and
        ([System.IO.Path]::GetFileName($smokeRoot) -like 'ShenPulseInstallerSmoke-*')
    ) {
        Remove-Item -LiteralPath $smokeRoot -Recurse -Force
    }
    }
}
