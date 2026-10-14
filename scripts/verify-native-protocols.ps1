param([string]$OutputDirectory = "")

$ErrorActionPreference = "Stop"
$nativeProtocolRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("ShenPulseNativeProtocols-" + [guid]::NewGuid().ToString("N"))
}
$nativeProtocolOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $nativeProtocolOutput -Force | Out-Null
. (Join-Path $PSScriptRoot "lib\visual-studio-environment.ps1")
Initialize-ShenPulseVisualStudioEnvironment

$gtaHarness = Join-Path $nativeProtocolRoot "native\gtav-montchiliad-enhanced\tests\ProtocolHarness.cpp"
$gtaProtocol = Join-Path $nativeProtocolRoot "native\gtav-montchiliad-enhanced\src\protocol-json.cpp"
$gtaProtocolExecutable = Join-Path $nativeProtocolOutput "GtaProtocol.exe"
& cl.exe /nologo /EHsc /std:c++17 /MT /W3 ("/Fo" + $nativeProtocolOutput.TrimEnd('\') + '\') ("/Fe" + $gtaProtocolExecutable) $gtaHarness $gtaProtocol
if ($LASTEXITCODE -ne 0) { throw "Compilation du test de protocole GTA échouée." }
& $gtaProtocolExecutable
if ($LASTEXITCODE -ne 0) { throw "Régression du protocole GTA." }

$cultProtocol = Join-Path $nativeProtocolRoot "native\cult-of-the-lamb-reliability\Domains\Protocol.cs"
$cultHarness = Join-Path $nativeProtocolRoot "native\cult-of-the-lamb-reliability\Tests\ProtocolHarness.cs"
$cultProtocolExecutable = Join-Path $nativeProtocolOutput "CultProtocol.exe"
$cultCompiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $cultCompiler /nologo /target:exe /optimize+ ("/out:" + $cultProtocolExecutable) $cultProtocol $cultHarness
if ($LASTEXITCODE -ne 0) { throw "Compilation du test de protocole Cult échouée." }
& $cultProtocolExecutable
if ($LASTEXITCODE -ne 0) { throw "Régression du protocole Cult." }
Write-Output "Tests natifs isolés : $nativeProtocolOutput"
