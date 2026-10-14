param(
  # Une sortie isolée permet de vérifier une refonte sans écraser le module publié.
  [string]$BuildDirectory = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$nativeRoot = Join-Path $projectRoot "native\gtav-montchiliad-enhanced"
$sourcePath = Join-Path $nativeRoot "src\ShenPulseMontChiliadEnhanced.cpp"
$sourcePaths = @(
  Get-ChildItem -LiteralPath (Join-Path $nativeRoot "src") -Filter "*.cpp" -File |
    Sort-Object -Property Name |
    Select-Object -ExpandProperty FullName
)
$includePath = Join-Path $nativeRoot "sdk\inc"
$libraryPath = Join-Path $nativeRoot "sdk\lib"
$buildRoot = if ($BuildDirectory) {
  [System.IO.Path]::GetFullPath($BuildDirectory)
} else {
  Join-Path $nativeRoot "build"
}
$outputPath = Join-Path $buildRoot "ShenPulseMontChiliadEnhanced.asi"

if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
  throw "Source GTA Enhanced introuvable : $sourcePath"
}
if (-not (Test-Path -LiteralPath (Join-Path $libraryPath "ScriptHookV.lib") -PathType Leaf)) {
  throw "SDK ScriptHookV Enhanced incomplet."
}
. (Join-Path $PSScriptRoot "lib\visual-studio-environment.ps1")
Initialize-ShenPulseVisualStudioEnvironment

New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
$objectDirectory = $buildRoot.TrimEnd('\') + '\'
$pdbPath = Join-Path $buildRoot "ShenPulseMontChiliadEnhanced.pdb"
$importLibraryPath = Join-Path $buildRoot "ShenPulseMontChiliadEnhanced.lib"

$compilerArguments = @(
  "/nologo",
  "/LD",
  "/O2",
  "/EHsc",
  "/std:c++17",
  "/MT",
  "/W3",
  "/DNDEBUG",
  "/D_WINDOWS",
  "/D_USRDLL",
  "/I$includePath",
  "/Fo$objectDirectory"
) + $sourcePaths + @(
  "/link",
  "/NOLOGO",
  "/SUBSYSTEM:WINDOWS",
  "/OPT:REF",
  "/OPT:ICF",
  "/LIBPATH:$libraryPath",
  "ScriptHookV.lib",
  "Ws2_32.lib",
  "/OUT:$outputPath",
  "/PDB:$pdbPath",
  "/IMPLIB:$importLibraryPath"
)

& cl.exe @compilerArguments
if ($LASTEXITCODE -ne 0) {
  throw "La compilation du module GTA Enhanced a échoué (code $LASTEXITCODE)."
}
if (-not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
  throw "La compilation n’a produit aucun module .asi."
}

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputPath).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $outputPath).Length
Write-Output "Module GTA Enhanced compilé."
Write-Output "Fichier : $outputPath"
Write-Output "Taille  : $size"
Write-Output "SHA-256 : $hash"
