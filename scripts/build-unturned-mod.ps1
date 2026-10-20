param(
  [string]$GameDirectory = 'C:\Program Files (x86)\Steam\steamapps\common\Unturned',
  [string]$OutputPath = '',
  [switch]$RunTests
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$repo = Split-Path -Parent $PSScriptRoot
$managed = Join-Path $GameDirectory 'Unturned_Data\Managed'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'The .NET Framework C# compiler is required.' }
if (!(Test-Path -LiteralPath (Join-Path $managed 'Assembly-CSharp.dll'))) { throw 'An installed Unturned client is required for its API references.' }
if (!$OutputPath) { $OutputPath = Join-Path $repo 'resources\installer-assets\unturned\1.0.1\unturned-shenpulse-1.0.1.zip' }
$work = Join-Path $repo ('.tmp\unturned-build-' + [guid]::NewGuid().ToString('N'))
$payload = Join-Path $work 'payload\Modules\ShenPulse.Unturned'
[void][IO.Directory]::CreateDirectory($payload)
$harmonyCache = Join-Path $repo '.tmp\unturned-dependencies\Harmony-Fat.2.4.3.0.zip'
$harmonyHash = '2aad201cc048899e3e0d558cc08173d91cfa4b8a2d6d9a5231fca5c295081880'
if (!(Test-Path -LiteralPath $harmonyCache)) {
  [void][IO.Directory]::CreateDirectory((Split-Path -Parent $harmonyCache))
  Invoke-WebRequest -Uri 'https://github.com/pardeike/Harmony/releases/download/v2.4.3/Harmony-Fat.2.4.3.0.zip' -OutFile $harmonyCache -UseBasicParsing
}
if ((Get-FileHash -LiteralPath $harmonyCache -Algorithm SHA256).Hash.ToLowerInvariant() -ne $harmonyHash) { throw 'Harmony archive integrity verification failed.' }
$harmonyArchive = [IO.Compression.ZipFile]::OpenRead($harmonyCache)
try { [IO.Compression.ZipFileExtensions]::ExtractToFile($harmonyArchive.GetEntry('net452/0Harmony.dll'), (Join-Path $payload '0Harmony.dll'), $true) } finally { $harmonyArchive.Dispose() }
$references = @('mscorlib.dll','System.dll','System.Core.dll','System.Runtime.dll','System.Collections.dll','netstandard.dll','Assembly-CSharp.dll','UnturnedDat.dll','SDG.NetTransport.dll','UnityEngine.CoreModule.dll','UnityEngine.PhysicsModule.dll','Newtonsoft.Json.dll','com.rlabrecque.steamworks.net.dll')
$arguments = @('/nologo','/noconfig','/target:library','/optimize+','/nostdlib+','/codepage:65001',('/out:' + (Join-Path $payload 'ShenPulse.Unturned.dll')))
foreach ($reference in $references) { $arguments += '/reference:' + (Join-Path $managed $reference) }
$arguments += '/reference:' + (Join-Path $payload '0Harmony.dll')
$source = Join-Path $repo 'native\unturned'
foreach ($file in @('Protocol.cs','LocalLink.cs','Module.cs','Effects.cs','ZombieSpawns.cs','RoamingMovement.cs')) { $arguments += Join-Path $source $file }
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'Unturned module compilation failed.' }
$config = @{ Name='ShenPulse.Unturned'; Version='1.0.1.0'; IsEnabled=$true; Dependencies=@(); Assemblies=@(@{Path='/0Harmony.dll'; Role='Client'; Load_As_Byte_Array=$true}, @{Path='/ShenPulse.Unturned.dll'; Role='Client'; Load_As_Byte_Array=$true}) }
[IO.File]::WriteAllText((Join-Path $payload 'ShenPulse.Unturned.module'), ($config | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $payload 'README.txt'), "ShenPulse Unturned 1.0.1`r`nModule original ShenPulse. Partie solo, lancement sans BattlEye via Unturned.exe.`r`nZombies autour du joueur, y compris hors des villes et zones de navigation.`r`nConnexion sortante TCP 127.0.0.1:58435. Aucun compte ou logiciel tiers requis.`r`nLes bibliotheques du jeu ne sont pas redistribuees. Licences incluses dans THIRD-PARTY-NOTICES.txt.`r`n", [Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath (Join-Path $source 'THIRD-PARTY-NOTICES.txt') -Destination $payload
if ($RunTests) {
  $harness = Join-Path $work 'UnturnedProtocolTests.exe'
  & $compiler /nologo /target:exe /optimize+ ('/out:' + $harness) ('/reference:' + (Join-Path $managed 'Newtonsoft.Json.dll')) (Join-Path $source 'Protocol.cs') (Join-Path $source 'LocalLink.cs') (Join-Path $source 'Tests\ProtocolHarness.cs')
  if ($LASTEXITCODE -ne 0) { throw 'Unturned protocol test compilation failed.' }
  Copy-Item -LiteralPath (Join-Path $managed 'Newtonsoft.Json.dll') -Destination $work
  & $harness
  if ($LASTEXITCODE -ne 0) { throw 'Unturned protocol tests failed.' }
  $navigationHarness = Join-Path $work 'UnturnedNavigationTests.exe'
  $testArguments = @('/nologo','/target:exe','/codepage:65001',('/out:' + $navigationHarness),('/reference:' + (Join-Path $payload 'ShenPulse.Unturned.dll')),('/reference:' + (Join-Path $payload '0Harmony.dll')))
  foreach ($reference in @('Assembly-CSharp.dll','UnturnedDat.dll','UnityEngine.CoreModule.dll','System.Runtime.dll','System.Collections.dll','netstandard.dll')) { $testArguments += '/reference:' + (Join-Path $managed $reference) }
  $testArguments += Join-Path $source 'Tests\NavigationHarness.cs'
  & $compiler @testArguments
  if ($LASTEXITCODE -ne 0) { throw 'Unturned navigation test compilation failed.' }
  Copy-Item -LiteralPath (Join-Path $payload 'ShenPulse.Unturned.dll') -Destination $work
  Copy-Item -LiteralPath (Join-Path $payload '0Harmony.dll') -Destination $work
  & $navigationHarness $managed
  if ($LASTEXITCODE -ne 0) { throw 'Unturned navigation tests failed.' }
}
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $OutputPath))
$temporaryZip = Join-Path $work 'unturned.zip'
$zip = [IO.Compression.ZipFile]::Open($temporaryZip, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in (Get-ChildItem -LiteralPath (Join-Path $work 'payload') -Recurse -File | Sort-Object FullName)) {
    $relative = $file.FullName.Substring((Join-Path $work 'payload').Length + 1).Replace('\','/')
    $entry = $zip.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = [DateTimeOffset]::new(2026,10,20,0,0,0,[TimeSpan]::Zero)
    $inputStream = [IO.File]::OpenRead($file.FullName)
    $outputStream = $entry.Open()
    try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() }
  }
} finally { $zip.Dispose() }
Copy-Item -LiteralPath $temporaryZip -Destination $OutputPath -Force
[pscustomobject]@{Path=$OutputPath;Size=(Get-Item -LiteralPath $OutputPath).Length;SHA256=(Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLowerInvariant() } | ConvertTo-Json -Compress
