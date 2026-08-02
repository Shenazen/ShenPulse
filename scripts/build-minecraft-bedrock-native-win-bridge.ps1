$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $PSScriptRoot "minecraft\bedrock-native-win-bridge"
$serverRoot = Join-Path $env:APPDATA "ShenPulse\games\minecraft-bedrock-box"
$buildRoot = Join-Path $projectRoot ".tmp\minecraft-bedrock-native-win-bridge"
$patcherClasses = Join-Path $buildRoot "patcher-classes"
$bridgeClasses = Join-Path $buildRoot "bridge-classes"
$outputRoot = Join-Path $projectRoot "release\minecraft"
$guardInput = Join-Path $serverRoot "plugins\shenpulse-bedrock-guard.jar"
$guardOutput = Join-Path $outputRoot "shenpulse-bedrock-guard.jar"
$bridgeOutput = Join-Path $outputRoot "shenpulse-bedrock-native-win-bridge.jar"

if (-not (Test-Path -LiteralPath $guardInput -PathType Leaf)) {
  throw "Le garde Bedrock Box installé est introuvable : $guardInput"
}

$librariesRoot = Join-Path $serverRoot "libraries"
$asmJar = Get-ChildItem -LiteralPath (Join-Path $librariesRoot "org\ow2\asm\asm") `
  -Recurse `
  -Filter "asm-*.jar" |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $asmJar) {
  throw "La bibliothèque ASM de PaperMC est introuvable."
}

$paperLibraries = Get-ChildItem -LiteralPath $librariesRoot `
  -Recurse `
  -Filter "*.jar" |
  Select-Object -ExpandProperty FullName
if (-not $paperLibraries) {
  throw "Les bibliothèques PaperMC sont introuvables."
}

Remove-Item -LiteralPath $buildRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $patcherClasses -Force | Out-Null
New-Item -ItemType Directory -Path $bridgeClasses -Force | Out-Null
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

$patcherSource = Join-Path $sourceRoot "tools\DisableEarlyWinPatch.java"
& javac.exe `
  --release 21 `
  -proc:none `
  -encoding UTF-8 `
  -classpath $asmJar `
  -d $patcherClasses `
  $patcherSource
if ($LASTEXITCODE -ne 0) {
  throw "La compilation du neutraliseur de victoire anticipée a échoué."
}

$patcherClasspath = [string]::Join(
  [IO.Path]::PathSeparator,
  @($patcherClasses, $asmJar)
)
& java.exe `
  -classpath $patcherClasspath `
  fr.shenpulse.minecraft.tools.DisableEarlyWinPatch `
  $guardInput `
  $guardOutput `
  (Join-Path $sourceRoot "guard-plugin.yml")
if ($LASTEXITCODE -ne 0) {
  throw "La neutralisation de la victoire anticipée a échoué."
}

$bridgeSources = Get-ChildItem -LiteralPath (Join-Path $sourceRoot "src") `
  -Recurse `
  -Filter "*.java" |
  Select-Object -ExpandProperty FullName
$paperClasspath = [string]::Join([IO.Path]::PathSeparator, $paperLibraries)
& javac.exe `
  --release 21 `
  -proc:none `
  -encoding UTF-8 `
  -classpath $paperClasspath `
  -d $bridgeClasses `
  $bridgeSources
if ($LASTEXITCODE -ne 0) {
  throw "La compilation du relais de victoire native a échoué."
}

$bridgeTestSources = Get-ChildItem -LiteralPath (Join-Path $sourceRoot "test") `
  -Recurse `
  -Filter "*.java" |
  Select-Object -ExpandProperty FullName
$bridgeTestClasspath = [string]::Join(
  [IO.Path]::PathSeparator,
  @($bridgeClasses) + $paperLibraries
)
& javac.exe `
  --release 21 `
  -proc:none `
  -encoding UTF-8 `
  -classpath $bridgeTestClasspath `
  -d $bridgeClasses `
  $bridgeTestSources
if ($LASTEXITCODE -ne 0) {
  throw "La compilation du test de signal de victoire native a échoué."
}
& java.exe `
  -classpath $bridgeTestClasspath `
  fr.shenpulse.minecraft.NativeWinSignalContract
if ($LASTEXITCODE -ne 0) {
  throw "Le test de signal de victoire native a échoué."
}
Remove-Item `
  -LiteralPath (Join-Path $bridgeClasses "fr\shenpulse\minecraft\NativeWinSignalContract.class") `
  -Force

Copy-Item `
  -LiteralPath (Join-Path $sourceRoot "plugin.yml") `
  -Destination (Join-Path $bridgeClasses "plugin.yml") `
  -Force

Push-Location $bridgeClasses
try {
  & jar.exe --create --file $bridgeOutput .
  if ($LASTEXITCODE -ne 0) {
    throw "La création du JAR de relais de victoire native a échoué."
  }
} finally {
  Pop-Location
}

Write-Output $guardOutput
Write-Output $bridgeOutput
