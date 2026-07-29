param(
  [string]$GamePath = "C:\Program Files (x86)\Steam\steamapps\common\Cult of the Lamb",
  [string]$OutputPath = "private\installer-assets\cult-of-the-lamb\ShenPulseCultReliability.dll"
)

$ErrorActionPreference = "Stop"

function Resolve-WorkspacePath {
  param([string]$TargetPath)
  if ([System.IO.Path]::IsPathRooted($TargetPath)) {
    return [System.IO.Path]::GetFullPath($TargetPath)
  }
  return [System.IO.Path]::GetFullPath(
    (Join-Path (Get-Location) $TargetPath)
  )
}

$sourcePath = Resolve-WorkspacePath (
  "native\cult-of-the-lamb-reliability\ShenPulseCultReliability.cs"
)
$output = Resolve-WorkspacePath $OutputPath
$bepInEx = Join-Path $GamePath "BepInEx\core\BepInEx.dll"
$harmony = Join-Path $GamePath "BepInEx\core\0Harmony.dll"
$unity = Join-Path $GamePath (
  "Cult Of The Lamb_Data\Managed\UnityEngine.dll"
)
$unityCore = Join-Path $GamePath (
  "Cult Of The Lamb_Data\Managed\UnityEngine.CoreModule.dll"
)
$netstandard = Join-Path $GamePath (
  "Cult Of The Lamb_Data\Managed\netstandard.dll"
)
$compiler = Join-Path $env:WINDIR (
  "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
)

foreach (
  $required in @(
    $sourcePath,
    $bepInEx,
    $harmony,
    $unity,
    $unityCore,
    $netstandard,
    $compiler
  )
) {
  if (-not (Test-Path -LiteralPath $required)) {
    throw "Fichier requis introuvable: $required"
  }
}

New-Item -ItemType Directory -Force -Path (
  Split-Path -Parent $output
) | Out-Null

& $compiler `
  /nologo `
  /target:library `
  /platform:anycpu `
  /optimize+ `
  "/out:$output" `
  "/reference:$bepInEx" `
  "/reference:$harmony" `
  "/reference:$unity" `
  "/reference:$unityCore" `
  "/reference:$netstandard" `
  $sourcePath

if ($LASTEXITCODE -ne 0) {
  throw "Compilation de ShenPulseCultReliability.dll echouee."
}

Write-Host "[cult-of-the-lamb-reliability] $output"
