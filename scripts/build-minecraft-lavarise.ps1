param(
  [Parameter(Mandatory=$true)][string]$InputPlugin,
  [Parameter(Mandatory=$true)][string]$JavaHome,
  [Parameter(Mandatory=$true)][string]$LibrariesRoot
)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$sourceRoot=Join-Path $PSScriptRoot 'minecraft/lavarise'
$buildRoot=Join-Path $env:TEMP ('shenpulse-lavarise-build-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($buildRoot) | Out-Null
$toolClasses=Join-Path $buildRoot 'tools'
$gameClasses=Join-Path $buildRoot 'classes'
[IO.Directory]::CreateDirectory($toolClasses) | Out-Null
[IO.Directory]::CreateDirectory($gameClasses) | Out-Null
$asm=Get-ChildItem -LiteralPath (Join-Path $LibrariesRoot 'org/ow2/asm') -Recurse -Filter '*.jar' | Select-Object -ExpandProperty FullName
$libraries=Get-ChildItem -LiteralPath $LibrariesRoot -Recurse -Filter '*.jar' | Select-Object -ExpandProperty FullName
$toolClasspath=[string]::Join([IO.Path]::PathSeparator,$asm)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$inputZip=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $InputPlugin).Path)
try {$reader=[IO.StreamReader]::new($inputZip.GetEntry('plugin.yml').Open());try{$descriptor=$reader.ReadToEnd()}finally{$reader.Dispose()}}finally{$inputZip.Dispose()}
$main=[regex]::Match($descriptor,'(?m)^main:\s*(\S+)').Groups[1].Value
if(-not $main){throw 'Point principal du module manquant.'}
& (Join-Path $JavaHome 'bin/javac.exe') -proc:none -encoding UTF-8 -classpath $toolClasspath -d $toolClasses (Join-Path $sourceRoot 'tools/PrepareLavaRise.java')
if($LASTEXITCODE -ne 0){throw 'Compilation du préparateur impossible.'}
$prepared=Join-Path $buildRoot 'shenpulse-lavarise.jar'
& (Join-Path $JavaHome 'bin/java.exe') -classpath ([string]::Join([IO.Path]::PathSeparator,@($toolClasses,$toolClasspath))) fr.shenpulse.minecraft.tools.PrepareLavaRise $InputPlugin $prepared $main
if($LASTEXITCODE -ne 0){throw 'Préparation du module impossible.'}
$classpath=[string]::Join([IO.Path]::PathSeparator,@($prepared)+$libraries)
$sources=Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'src') -Recurse -Filter '*.java' | Select-Object -ExpandProperty FullName
& (Join-Path $JavaHome 'bin/javac.exe') -proc:none -encoding UTF-8 -classpath $classpath -d $gameClasses $sources
if($LASTEXITCODE -ne 0){throw 'Compilation de la connexion ShenPulse impossible.'}
[IO.File]::Copy((Join-Path $sourceRoot 'plugin.yml'),(Join-Path $gameClasses 'plugin.yml'))
[IO.File]::Copy((Join-Path $sourceRoot 'config.yml'),(Join-Path $gameClasses 'config.yml'))
& (Join-Path $JavaHome 'bin/jar.exe') --update --file $prepared -C $gameClasses .
if($LASTEXITCODE -ne 0){throw 'Assemblage du module impossible.'}
Write-Output ('SHENPULSE_LAVARISE_BUILD='+$buildRoot)
