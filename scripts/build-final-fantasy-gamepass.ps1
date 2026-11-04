param(
 [Parameter(Mandatory=$true)][ValidateRange(1,5)][int]$Number,
 [Parameter(Mandatory=$true)][string]$InteropDirectory,
 [Parameter(Mandatory=$true)][string]$Compiler,
 [Parameter(Mandatory=$true)][string]$RuntimeDirectory,
 [string]$BaseArchive='',
 [string]$OutputPath=''
)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$id='final-fantasy-'+$Number+'-pixel-remaster'
$definition=(Get-Content -LiteralPath (Join-Path $repo 'resources/catalogs/owner-prepared-modules.json') -Raw | ConvertFrom-Json).$id
if(!$OutputPath){$OutputPath=Join-Path $repo ('.artifacts/game-pack-builds/'+$id+'/1.0.1/'+$id+'-gamepass-shenpulse-1.0.1.zip')}
$work=Join-Path $repo ('.tmp/final-fantasy-build-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($work) | Out-Null
try {
 if(!$BaseArchive){$BaseArchive=Join-Path $work 'base.zip';Invoke-WebRequest -Uri $definition.asset.url -OutFile $BaseArchive}
 if((Get-FileHash -LiteralPath $BaseArchive -Algorithm SHA256).Hash -ne $definition.asset.sha256){throw 'Unexpected baseline archive SHA256'}
 $payload=Join-Path $work 'payload'
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 [IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path $BaseArchive).Path,$payload)
 $core=Join-Path $payload 'BepInEx/core'
 $plugins=Join-Path $payload 'BepInEx/plugins/CrowdControl'
 $support=Join-Path $plugins 'ShenPulse.FinalFantasy.Runtime.dll'
 $references=@{}
 foreach($directory in @($RuntimeDirectory,$InteropDirectory,$core)){
  foreach($file in (Get-ChildItem -LiteralPath $directory -Filter '*.dll' -File)){
   try {
    $bytes=[IO.File]::ReadAllBytes($file.FullName);$pe=[BitConverter]::ToInt32($bytes,60)+24
    $directoryOffset=if([BitConverter]::ToUInt16($bytes,$pe) -eq 0x20b){112}else{96}
    if([BitConverter]::ToUInt32($bytes,$pe+$directoryOffset+112) -ne 0){$references[$file.Name]=$file.FullName}
   } catch {continue}
  }
 }
 $arguments=@('/nologo','/target:library','/nostdlib+','/deterministic+','/langversion:latest',('/out:'+$support))
 $arguments+=@($references.Keys | Sort-Object | ForEach-Object {'/r:'+$references[$_]})
 $arguments+=Join-Path $PSScriptRoot 'game-mods/final-fantasy/Runtime.cs'
 $response=Join-Path $work 'compiler.rsp'
 [IO.File]::WriteAllLines($response,@($arguments | ForEach-Object {'"'+$_+'"'}),[Text.UTF8Encoding]::new($false))
 & $Compiler ('@'+$response)
 if($LASTEXITCODE -ne 0){throw 'Final Fantasy runtime compilation failed'}
 $module=Join-Path $plugins 'CrowdControl.dll'
 $patched=Join-Path $work 'patched.dll'
 & (Join-Path $PSScriptRoot 'game-mods/final-fantasy/apply-corrections.ps1') -Number $Number -ModulePath $module -InteropDirectory $InteropDirectory -CoreDirectory $core -SupportPath $support -OutputPath $patched -RuntimeDirectory $RuntimeDirectory
 Copy-Item -LiteralPath $patched -Destination $module -Force
 $metadataPath=Join-Path $payload 'shenpulse-module.json'
 $metadata=Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
 $metadata.version='1.0.1'
 $metadata.files=@(
  [ordered]@{file='BepInEx/plugins/CrowdControl/CrowdControl.dll';sha256=(Get-FileHash -LiteralPath $module -Algorithm SHA256).Hash.ToLowerInvariant()},
  [ordered]@{file='BepInEx/plugins/CrowdControl/ShenPulse.FinalFantasy.Runtime.dll';sha256=(Get-FileHash -LiteralPath $support -Algorithm SHA256).Hash.ToLowerInvariant()}
 )
 [IO.File]::WriteAllText($metadataPath,($metadata | ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
 [IO.File]::WriteAllText((Join-Path $payload 'ShenPulse-GamePass.txt'),"ShenPulse Game Pass module 1.0.1. Native local connection, field health and encounters adapted for the Microsoft edition. Original authors and notices retained.`r`n",[Text.UTF8Encoding]::new($false))
 $configDirectory=Join-Path $payload 'BepInEx/config'
 [IO.Directory]::CreateDirectory($configDirectory) | Out-Null
 [IO.File]::WriteAllText((Join-Path $configDirectory 'BepInEx.cfg'),"[Logging.Console]`r`nEnabled = false`r`n",[Text.UTF8Encoding]::new($false))
 [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath))) | Out-Null
 $stream=[IO.File]::Open($OutputPath,[IO.FileMode]::Create)
 $zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
 try {
  foreach($file in (Get-ChildItem -LiteralPath $payload -Recurse -File | Sort-Object FullName)){
   $relative=$file.FullName.Substring($payload.Length+1).Replace('\','/')
   if($relative -match '(?i)^BepInEx/(interop|cache)/' -or ($relative -match '(?i)^BepInEx/config/' -and $relative -ne 'BepInEx/config/BepInEx.cfg')){continue}
   if($relative -match '(?i)ShenPulse\.FinalFantasy\.Qa|LogOutput\.log'){throw ('Unexpected development file: '+$relative)}
   $entry=$zip.CreateEntry($relative,[IO.Compression.CompressionLevel]::Optimal)
   $entry.LastWriteTime=[DateTimeOffset]::new(2000,1,1,0,0,0,[TimeSpan]::Zero)
   $output=$entry.Open()
   try {$bytes=[IO.File]::ReadAllBytes($file.FullName);$output.Write($bytes,0,$bytes.Length)} finally {$output.Dispose()}
  }
 } finally {$zip.Dispose();$stream.Dispose()}
 Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256
 (Get-Item -LiteralPath $OutputPath).Length
} finally {
 $resolved=[IO.Path]::GetFullPath($work)
 $allowed=[IO.Path]::GetFullPath((Join-Path $repo '.tmp'))+[IO.Path]::DirectorySeparatorChar
 if(!$resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe temporary build directory'}
 try {Remove-Item -LiteralPath $resolved -Recurse -Force}
 catch {Write-Warning ('Temporary build directory retained: '+$resolved+'; '+$_.Exception.Message)}
}
