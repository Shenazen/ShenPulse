param(
 [Parameter(Mandatory=$true)][string]$ManagedDirectory,
 [Parameter(Mandatory=$true)][string]$Compiler,
 [string]$BaseArchive='',
 [string]$OutputPath=''
)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
if(!$BaseArchive){$BaseArchive=Join-Path $repo '.artifacts/game-pack-builds/frog-sqwad/1.0.0/frog-sqwad-shenpulse-1.0.0.zip'}
if((Get-FileHash -LiteralPath $BaseArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'f6ecdb5e077701a2f46eaf8c95b8316cff79d4631946b32c90020af14d9eed16'){throw 'Unexpected baseline archive'}
if(!$OutputPath){$OutputPath=Join-Path $repo '.artifacts/game-pack-builds/frog-sqwad/1.0.1/frog-sqwad-shenpulse-1.0.1.zip'}
$work=Join-Path ([IO.Path]::GetTempPath()) ('ShenPulseFrogBuild-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($work)|Out-Null
try {
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $payload=Join-Path $work 'payload'
 [IO.Compression.ZipFile]::ExtractToDirectory([IO.Path]::GetFullPath($BaseArchive),$payload)
 $plugin=Join-Path $payload 'BepInEx/plugins/CrowdControl'
 $support=Join-Path $plugin 'ShenPulse.Frog.Runtime.dll'
 $args=@('/nologo','/target:library','/nostdlib+','/deterministic+','/langversion:latest',('/out:"'+$support+'"'))
 $args+=@(Get-ChildItem -LiteralPath $ManagedDirectory -Filter '*.dll' -File | ForEach-Object {'/r:"'+$_.FullName+'"'})
 $args+='"'+(Join-Path $PSScriptRoot 'game-mods/frog-sqwad/Runtime.cs')+'"'
 $response=Join-Path $work 'compiler.rsp';[IO.File]::WriteAllLines($response,$args)
 & $Compiler ('@'+$response)
 if($LASTEXITCODE -ne 0){throw 'Frog runtime compilation failed'}
 $module=Join-Path $plugin 'CrowdControl.dll';$patched=Join-Path $work 'patched.dll'
 & (Join-Path $PSScriptRoot 'game-mods/frog-sqwad/apply-corrections.ps1') -ModulePath $module -ManagedDirectory $ManagedDirectory -SupportPath $support -OutputPath $patched
 Copy-Item -LiteralPath $patched -Destination $module -Force
 $metadata=Get-Content -LiteralPath (Join-Path $payload 'shenpulse-module.json') -Raw | ConvertFrom-Json
 $metadata.version='1.0.1'
 $metadata.files=@('CrowdControl.dll','ShenPulse.Frog.Runtime.dll') | ForEach-Object {
  [ordered]@{file=('BepInEx/plugins/CrowdControl/'+$_);sha256=(Get-FileHash -LiteralPath (Join-Path $plugin $_) -Algorithm SHA256).Hash.ToLowerInvariant()}
 }
 [IO.File]::WriteAllText((Join-Path $payload 'shenpulse-module.json'),($metadata|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
 [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath)))|Out-Null
 if(Test-Path -LiteralPath $OutputPath){Remove-Item -LiteralPath $OutputPath -Force}
 $stream=[IO.File]::Open([IO.Path]::GetFullPath($OutputPath),[IO.FileMode]::Create)
 $zip=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
 try {
  foreach($file in (Get-ChildItem -LiteralPath $payload -Recurse -File | Sort-Object FullName)){
   $relative=$file.FullName.Substring($payload.Length+1).Replace('\','/')
   if($relative -match '(?i)\.Qa\.|LogOutput|^BepInEx/(cache|interop)/'){throw 'Unexpected development file'}
   $entry=$zip.CreateEntry($relative,[IO.Compression.CompressionLevel]::Optimal)
   $entry.LastWriteTime=[DateTimeOffset]::new(2000,1,1,0,0,0,[TimeSpan]::Zero)
   $output=$entry.Open()
   try {$bytes=[IO.File]::ReadAllBytes($file.FullName);$output.Write($bytes,0,$bytes.Length)} finally {$output.Dispose()}
  }
 } finally {$zip.Dispose();$stream.Dispose()}
 Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256
} finally {
 $resolved=[IO.Path]::GetFullPath($work)
 $allowed=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
 if(!$resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe build directory'}
 Remove-Item -LiteralPath $resolved -Recurse -Force
}
