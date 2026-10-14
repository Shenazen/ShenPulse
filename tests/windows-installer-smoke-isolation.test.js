"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { UUID } = require("builder-util-runtime");
const packageJson = require("../package.json");
const root = path.resolve(__dirname, "..");
const helper = "scripts/lib/smoke-registry-isolation.ps1";

function powershell(script) {
  const encoded = Buffer.from(`$ErrorActionPreference = 'Stop'\n. './${helper}'\n. './scripts/lib/smoke-process-isolation.ps1'\n${script}`, "utf16le").toString("base64");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
    { cwd: root, encoding: "utf8", timeout: 15_000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}

test("les deux smokes vérifient le registre avant toute sauvegarde ou installation", () => {
  for (const file of ["scripts/smoke-windows-installer.ps1", "scripts/smoke-windows-upgrade.ps1"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const guard = source.indexOf("Assert-ShenPulseSmokeRegistryIsolation -PackageJson $packageJson");
    assert.ok(guard > 0);
    assert.ok(guard < source.indexOf("New-Item -ItemType Directory"));
    assert.ok(guard < source.indexOf("Copy-Item -LiteralPath $shortcut.Path"));
    assert.match(source, /lib\\smoke-registry-isolation\.ps1/);
    assert.equal(source.match(/Assert-ShenPulseSmokeRegistryIsolation -PackageJson \$packageJson/g)?.length, 2);
    assert.ok(source.lastIndexOf("Assert-ShenPulseSmokeRegistryIsolation") > source.indexOf("Copy-Item -LiteralPath $shortcut.Backup"));
    assert.doesNotMatch(source, /Stop-Process|Wait-Process/);
    assert.match(source, /Write-Error -ErrorRecord \$_ -ErrorAction Continue/);
    assert.match(source, /\$smokeSucceeded -and/);
    assert.match(source, /Wait-ShenPulseSmokeRegistryIsolation -PackageJson \$packageJson/);
  }
});

test("attente de nettoyage bornée : état occupé seulement, sans masquer erreurs de lecture", { skip: process.platform !== "win32" }, () => {
  const result = JSON.parse(powershell(`
    $package = Get-Content './package.json' -Raw | ConvertFrom-Json
    $script:attempts = 0
    $occupied = [System.Management.Automation.ErrorRecord]::new(
      [InvalidOperationException]::new('Installation encore presente'),
      'SHENPULSE_SMOKE_REGISTRY_OCCUPIED', [System.Management.Automation.ErrorCategory]::ResourceExists, $null)
    $result = Wait-ShenPulseSmokeRegistryIsolation -PackageJson $package -TimeoutMs 1000 -PollIntervalMs 1 -AssertIsolation {
      $script:attempts += 1
      if ($script:attempts -lt 3) { throw $occupied }
      [pscustomobject]@{ CheckedKeys = 8 }
    }
    $timeoutBlocked = $false
    try { Wait-ShenPulseSmokeRegistryIsolation -PackageJson $package -TimeoutMs 10 -PollIntervalMs 1 -AssertIsolation { throw $occupied } | Out-Null }
    catch { if ($_.Exception.Message -notlike '*smoke interrompu*') { throw }; $timeoutBlocked = $true }
    $readBlocked = $false
    try { Wait-ShenPulseSmokeRegistryIsolation -PackageJson $package -AssertIsolation { Write-Error 'Lecture refusee' -ErrorId 'PermissionDenied' -ErrorAction Stop } | Out-Null }
    catch { if (($_.FullyQualifiedErrorId -split ',')[0] -ne 'PermissionDenied') { throw }; $readBlocked = $true }
    @{ Attempts = $script:attempts; CheckedKeys = $result.CheckedKeys; TimeoutBlocked = $timeoutBlocked; ReadBlocked = $readBlocked } | ConvertTo-Json -Compress
  `));
  assert.deepEqual(result, { Attempts: 3, CheckedKeys: 8, TimeoutBlocked: true, ReadBlocked: true });
});

test("arrêt du smoke limité au chemin exact et PID revalidé, jamais au préfixe", { skip: process.platform !== "win32" }, () => {
  const result = JSON.parse(powershell(`
    $script:stoppedIds = @()
    $target = 'C:\\fixture-only\\installation\\ShenPulse.exe'
    $snapshots = @(
      [pscustomobject]@{ Id = 1; Path = $target },
      [pscustomobject]@{ Id = 2; Path = 'C:\\fixture-only\\installation-other\\ShenPulse.exe' },
      [pscustomobject]@{ Id = 3; Path = 'C:\\fixture-only\\installation\\child\\ShenPulse.exe' }
    )
    $options = @{
      Executable = $target
      ListProcesses = { $snapshots }
      FindProcess = { param($ProcessId) [pscustomobject]@{ Id = $ProcessId; Path = 'c:/FIXTURE-ONLY/installation/ShenPulse.exe' } }
      StopProcess = { param($Process) $script:stoppedIds += $Process.Id }
      WaitProcess = {}
    }
    $result = Stop-ShenPulseSmokeProcesses @options
    $options.FindProcess = { param($ProcessId) [pscustomobject]@{ Id = $ProcessId; Path = 'C:\\fixture-only\\another-app.exe' } }
    $changedPidBlocked = $false
    try { Stop-ShenPulseSmokeProcesses @options | Out-Null }
    catch { if ($_.Exception.Message -notlike '*PID*') { throw }; $changedPidBlocked = $true }
    @{ StoppedIds = @($script:stoppedIds); Stopped = $result.Stopped; ChangedPidBlocked = $changedPidBlocked } | ConvertTo-Json -Compress
  `));
  assert.deepEqual(result.StoppedIds, [1]);
  assert.equal(result.Stopped, 1);
  assert.equal(result.ChangedPidBlocked, true);
});

test("seule la disparition du PID est tolérée ; droits et timeout restent bloquants", { skip: process.platform !== "win32" }, () => {
  const result = JSON.parse(powershell(`
    $target = 'C:\\fixture-only\\installation\\ShenPulse.exe'
    $fixture = [pscustomobject]@{ Id = 1; Path = $target }
    $options = @{ Executable = $target; ListProcesses = { $fixture }; FindProcess = { $fixture }; StopProcess = {}; WaitProcess = {} }
    $missing = { Write-Error 'Processus termine' -ErrorId 'NoProcessFoundForGivenId' -ErrorAction Stop }
    $options.FindProcess = $missing
    $missingAtRead = Stop-ShenPulseSmokeProcesses @options
    $options.FindProcess = { $fixture }
    $options.StopProcess = $missing
    $missingAtStop = Stop-ShenPulseSmokeProcesses @options
    $blocked = 0
    $options.StopProcess = { Write-Error 'Acces refuse' -ErrorId 'PermissionDenied' -ErrorAction Stop }
    try { Stop-ShenPulseSmokeProcesses @options | Out-Null }
    catch { if (($_.FullyQualifiedErrorId -split ',')[0] -ne 'PermissionDenied') { throw }; $blocked += 1 }
    $options.StopProcess = {}
    $options.WaitProcess = { Write-Error 'Processus encore actif' -ErrorId 'ProcessNotTerminated' -ErrorAction Stop }
    try { Stop-ShenPulseSmokeProcesses @options | Out-Null }
    catch { if (($_.FullyQualifiedErrorId -split ',')[0] -ne 'ProcessNotTerminated') { throw }; $blocked += 1 }
    @{ Missing = $missingAtRead.AlreadyExited + $missingAtStop.AlreadyExited; Blocked = $blocked } | ConvertTo-Json -Compress
  `));
  assert.equal(result.Missing, 2);
  assert.equal(result.Blocked, 2);
});

test("Path absent exige HasExited vrai, sans masquer processus vivant ou erreur de droits", { skip: process.platform !== "win32" }, () => {
  const result = JSON.parse(powershell(`
    $target = 'C:\\fixture-only\\installation\\ShenPulse.exe'
    $snapshot = [pscustomobject]@{ Id = 1; Path = $target }
    $options = @{ Executable = $target; ListProcesses = { $snapshot }; FindProcess = {}; StopProcess = { throw 'Ne doit pas arreter' }; WaitProcess = {} }
    $options.FindProcess = { [pscustomobject]@{ Id = 1; Path = $null; HasExited = $true } }
    $gone = Stop-ShenPulseSmokeProcesses @options
    $blocked = 0
    foreach ($reader in @(
      { [pscustomobject]@{ Id = 1; Path = $null; HasExited = $false } },
      { [pscustomobject]@{ Id = 1; Path = $null; HasExited = 'true' } },
      { [pscustomobject]@{ Id = 1; Path = 'C:\\fixture-only\\other.exe'; HasExited = $false } },
      { [pscustomobject]@{ Id = 1; Path = 'C:\\fixture-only\\other.exe'; HasExited = $true } }
    )) {
      $options.FindProcess = $reader
      try { Stop-ShenPulseSmokeProcesses @options | Out-Null }
      catch { if ($_.Exception.Message -notlike '*PID*') { throw }; $blocked += 1 }
    }
    $denied = [pscustomobject]@{ Id = 1; Path = $null }
    $denied | Add-Member -MemberType ScriptProperty -Name HasExited -Value { throw 'PermissionDenied' }
    $options.FindProcess = { $denied }
    try { Stop-ShenPulseSmokeProcesses @options | Out-Null }
    catch { $blocked += 1 }
    @{ AlreadyExited = $gone.AlreadyExited; Stopped = $gone.Stopped; Blocked = $blocked } | ConvertTo-Json -Compress
  `));
  assert.deepEqual(result, { AlreadyExited: 1, Stopped: 0, Blocked: 5 });
});

test("processus Windows jetable réellement terminé reconnu sans tenter d’arrêt", { skip: process.platform !== "win32" }, () => {
  const result = JSON.parse(powershell(`
    $executable = Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    $child = Start-Process -FilePath $executable -ArgumentList @('-NoProfile', '-NonInteractive', '-Command', 'exit 0') -WindowStyle Hidden -PassThru
    if (-not $child.WaitForExit(5000)) { throw 'Le processus jetable ne se termine pas.' }
    $snapshot = [pscustomobject]@{ Id = $child.Id; Path = $executable }
    Stop-ShenPulseSmokeProcesses -Executable $executable -ListProcesses { $snapshot } -FindProcess { $child } -StopProcess { throw 'Ne doit pas arreter' } | ConvertTo-Json -Compress
  `));
  assert.deepEqual(result, { Stopped: 0, AlreadyExited: 1 });
});

test("UUID NSIS identique à electron-builder et huit clés absentes synthétiques", { skip: process.platform !== "win32" }, () => {
  const result = JSON.parse(powershell(`
    $package = Get-Content './package.json' -Raw | ConvertFrom-Json
    Assert-ShenPulseSmokeRegistryIsolation -PackageJson $package -RegistryKeyExists { $false } | ConvertTo-Json -Compress
  `));
  assert.equal(result.Guid, UUID.v5(packageJson.build.appId, UUID.parse("50e065bc-3134-11e6-9bab-38c9862bdaf3")));
  assert.equal(result.CheckedKeys, 8);
});

test("chaque clé ou erreur de lecture synthétique bloque, sans mutation du registre", { skip: process.platform !== "win32" }, () => {
  const result = JSON.parse(powershell(`
    $package = Get-Content './package.json' -Raw | ConvertFrom-Json
    $rejected = 0
    for ($blockedIndex = 0; $blockedIndex -lt 8; $blockedIndex++) {
      $script:callIndex = 0
      $script:blockedIndex = $blockedIndex
      try {
        Assert-ShenPulseSmokeRegistryIsolation -PackageJson $package -RegistryKeyExists {
          $blocked = $script:callIndex -eq $script:blockedIndex
          $script:callIndex += 1
          return $blocked
        } | Out-Null
        throw 'Le garde a laissé passer une clé existante.'
      }
      catch {
        if ($_.Exception.Message -notlike '*installation ShenPulse*') { throw }
        $rejected += 1
      }
    }
    foreach ($reader in @({ throw 'Lecture refusée' }, { $null })) {
      try {
        Assert-ShenPulseSmokeRegistryIsolation -PackageJson $package -RegistryKeyExists $reader | Out-Null
        throw 'Le garde a laissé passer une lecture indéterminée.'
      }
      catch {
        if ($_.Exception.Message -notlike '*smoke interdit*') { throw }
        $rejected += 1
      }
    }
    @{ Rejected = $rejected } | ConvertTo-Json -Compress
  `));
  assert.equal(result.Rejected, 10);
});

test("identité absente ou GUID NSIS personnalisé refusés avant lecture", { skip: process.platform !== "win32" }, () => {
  assert.equal(powershell(`
    $rejected = 0
    foreach ($package in @(@{ build = @{ appId = '' } }, @{ build = @{ appId = 'fixture'; nsis = @{ guid = 'custom' } } })) {
      try {
        Assert-ShenPulseSmokeRegistryIsolation -PackageJson $package -RegistryKeyExists { throw 'Ne doit pas lire le registre' } | Out-Null
      }
      catch { if ($_.Exception.Message -like '*smoke interdit*') { $rejected += 1 } else { throw } }
    }
    if ($rejected -ne 2) { throw 'Identité non qualifiée acceptée.' }
    Write-Output $rejected
  `), "2");
});
