$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $PSScriptRoot "minecraft\bedrock-effects-patch"
$serverRoot = Join-Path $env:APPDATA "ShenPulse\games\minecraft-bedrock-box"
$buildRoot = Join-Path $projectRoot ".tmp\minecraft-bedrock-effects-patch"
$classesRoot = Join-Path $buildRoot "classes"
$outputRoot = Join-Path $projectRoot "release\minecraft"
$outputPath = Join-Path $outputRoot "shenpulse-bedrock-effects-patch.jar"

if (-not (Test-Path -LiteralPath $serverRoot -PathType Container)) {
  throw "Le serveur Bedrock Box installé est introuvable : $serverRoot"
}

$javaSources = Get-ChildItem -LiteralPath (Join-Path $sourceRoot "src") `
  -Recurse `
  -Filter "*.java" |
  Select-Object -ExpandProperty FullName
if (-not $javaSources) {
  throw "Aucune source Java trouvée."
}

$classpathFiles = Get-ChildItem -LiteralPath (Join-Path $serverRoot "libraries") `
  -Recurse `
  -Filter "*.jar" |
  Select-Object -ExpandProperty FullName
if (-not $classpathFiles) {
  throw "Les bibliothèques PaperMC sont introuvables."
}

Remove-Item -LiteralPath $buildRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $classesRoot -Force | Out-Null
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

$classpath = [string]::Join(
  [IO.Path]::PathSeparator,
  $classpathFiles
)
& javac.exe `
  --release 21 `
  -proc:none `
  -encoding UTF-8 `
  -classpath $classpath `
  -d $classesRoot `
  $javaSources
if ($LASTEXITCODE -ne 0) {
  throw "La compilation du patch Bedrock Box a échoué."
}

Copy-Item `
  -LiteralPath (Join-Path $sourceRoot "plugin.yml") `
  -Destination (Join-Path $classesRoot "plugin.yml") `
  -Force

Push-Location $classesRoot
try {
  & jar.exe --create --file $outputPath .
  if ($LASTEXITCODE -ne 0) {
    throw "La création du JAR Bedrock Box a échoué."
  }
} finally {
  Pop-Location
}

Write-Output $outputPath
