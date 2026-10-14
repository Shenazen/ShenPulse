# Lecture seule : NSIS peut désinstaller le produit enregistré malgré /D temporaire.
# Refuser le smoke avant toute installation ou sauvegarde si ce produit existe.
function Get-ShenPulseNsisGuid {
    param([Parameter(Mandatory = $true)]$PackageJson)

    $appId = [string]$PackageJson.build.appId
    if ([string]::IsNullOrWhiteSpace($appId)) {
        throw 'Identité NSIS absente : smoke interdit.'
    }
    $explicitGuid = [string]$PackageJson.build.nsis.guid
    if (-not [string]::IsNullOrWhiteSpace($explicitGuid)) {
        throw 'GUID NSIS personnalisé non qualifié : smoke interdit.'
    }

    # UUIDv5 utilisé par electron-builder/NsisTarget, avec octets réseau RFC 4122.
    $namespaceBytes = ([Guid]'50e065bc-3134-11e6-9bab-38c9862bdaf3').ToByteArray()
    [Array]::Reverse($namespaceBytes, 0, 4)
    [Array]::Reverse($namespaceBytes, 4, 2)
    [Array]::Reverse($namespaceBytes, 6, 2)
    $sha1 = [Security.Cryptography.SHA1]::Create()
    try {
        $digest = $sha1.ComputeHash([byte[]]($namespaceBytes + [Text.Encoding]::UTF8.GetBytes($appId)))
    }
    finally { $sha1.Dispose() }
    $guidBytes = [byte[]]$digest[0..15]
    $guidBytes[6] = ($guidBytes[6] -band 15) -bor 80
    $guidBytes[8] = ($guidBytes[8] -band 63) -bor 128
    [Array]::Reverse($guidBytes, 0, 4)
    [Array]::Reverse($guidBytes, 4, 2)
    [Array]::Reverse($guidBytes, 6, 2)
    return ([Guid]::new($guidBytes)).ToString()
}

function Assert-ShenPulseSmokeRegistryIsolation {
    param(
        [Parameter(Mandatory = $true)]$PackageJson,
        # Point d'injection pour tests synthétiques, jamais fourni par les smokes.
        [scriptblock]$RegistryKeyExists
    )

    $guid = Get-ShenPulseNsisGuid -PackageJson $PackageJson
    if (-not $RegistryKeyExists) {
        $RegistryKeyExists = {
            param($Hive, $View, $SubKey)
            $registryBase = $null
            $registryTarget = $null
            try {
                $registryBase = [Microsoft.Win32.RegistryKey]::OpenBaseKey($Hive, $View)
                $registryTarget = $registryBase.OpenSubKey($SubKey, $false)
                return $null -ne $registryTarget
            }
            finally {
                if ($registryTarget) { $registryTarget.Close() }
                if ($registryBase) { $registryBase.Close() }
            }
        }
    }
    $checkedKeys = 0
    foreach ($registryHive in @([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryHive]::LocalMachine)) {
        foreach ($registryView in @([Microsoft.Win32.RegistryView]::Registry64, [Microsoft.Win32.RegistryView]::Registry32)) {
            foreach ($relativeKey in @("Software\$guid", "Software\Microsoft\Windows\CurrentVersion\Uninstall\$guid")) {
                try { $exists = & $RegistryKeyExists $registryHive $registryView $relativeKey }
                catch { throw 'Lecture du registre impossible : smoke interdit par précaution.' }
                if ($exists -isnot [bool]) { throw 'Contrôle du registre indéterminé : smoke interdit.' }
                if ($exists) {
                    throw [System.Management.Automation.ErrorRecord]::new(
                        [InvalidOperationException]::new('Une installation ShenPulse est enregistrée. Utiliser une VM ou un compte Windows isolé pour ce smoke.'),
                        'SHENPULSE_SMOKE_REGISTRY_OCCUPIED',
                        [System.Management.Automation.ErrorCategory]::ResourceExists,
                        $guid
                    )
                }
                $checkedKeys += 1
            }
        }
    }
    return [pscustomobject]@{ Guid = $guid; CheckedKeys = $checkedKeys }
}

# Le désinstalleur NSIS peut terminer dans un enfant détaché. Attendre uniquement
# son nettoyage normal, sans supprimer ni réparer directement une clé du registre.
function Wait-ShenPulseSmokeRegistryIsolation {
    param(
        [Parameter(Mandatory = $true)]$PackageJson,
        [ValidateRange(1, 30000)][int]$TimeoutMs = 10000,
        [ValidateRange(1, 1000)][int]$PollIntervalMs = 250,
        [scriptblock]$AssertIsolation = { param($Package) Assert-ShenPulseSmokeRegistryIsolation -PackageJson $Package }
    )
    $elapsed = [Diagnostics.Stopwatch]::StartNew()
    while ($true) {
        try { return & $AssertIsolation $PackageJson }
        catch {
            if (($_.FullyQualifiedErrorId -split ',')[0] -ne 'SHENPULSE_SMOKE_REGISTRY_OCCUPIED') { throw }
            if ($elapsed.ElapsedMilliseconds -ge $TimeoutMs) {
                throw 'Le désinstalleur n’a pas libéré le registre dans le délai autorisé : smoke interrompu.'
            }
        }
        Start-Sleep -Milliseconds ([Math]::Max(1, [Math]::Min($PollIntervalMs, $TimeoutMs - $elapsed.ElapsedMilliseconds)))
    }
}
