$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$nativeRoot = Join-Path $projectRoot "native\gtav-montchiliad-enhanced"
$sourcePath = Join-Path $nativeRoot "src\ShenPulseMontChiliadEnhanced.cpp"
$includePath = Join-Path $nativeRoot "sdk\inc"
$libraryPath = Join-Path $nativeRoot "sdk\lib"
$buildRoot = Join-Path $nativeRoot "build"
$outputPath = Join-Path $buildRoot "ShenPulseMontChiliadEnhanced.asi"
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"

if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
  throw "Source GTA Enhanced introuvable : $sourcePath"
}
if (-not (Test-Path -LiteralPath (Join-Path $libraryPath "ScriptHookV.lib") -PathType Leaf)) {
  throw "SDK ScriptHookV Enhanced incomplet."
}
if (-not (Test-Path -LiteralPath $vswhere -PathType Leaf)) {
  throw "Visual Studio Build Tools est requis pour compiler le module GTA Enhanced."
}

$visualStudio = & $vswhere -latest -products "*" -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $visualStudio) {
  throw "Les outils C++ x64 de Visual Studio sont introuvables."
}
$vsDevCmd = Join-Path $visualStudio "Common7\Tools\VsDevCmd.bat"
if (-not (Test-Path -LiteralPath $vsDevCmd -PathType Leaf)) {
  throw "VsDevCmd.bat est introuvable."
}

$environmentLines = & $env:ComSpec /d /s /c "`"$vsDevCmd`" -no_logo -arch=x64 -host_arch=x64 >nul && set"
foreach ($line in $environmentLines) {
  $separator = $line.IndexOf("=")
  if ($separator -le 0) { continue }
  $name = $line.Substring(0, $separator)
  $value = $line.Substring($separator + 1)
  Set-Item -LiteralPath "Env:$name" -Value $value
}

New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
$objectPath = Join-Path $buildRoot "ShenPulseMontChiliadEnhanced.obj"
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
  "/Fo$objectPath",
  $sourcePath,
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
