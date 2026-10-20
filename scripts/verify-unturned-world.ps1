param([string]$GameDirectory = 'C:\Program Files (x86)\Steam\steamapps\common\Unturned')
$ErrorActionPreference = 'Stop'
if (Get-Process Unturned, Unturned_BE -ErrorAction SilentlyContinue) { throw 'Close Unturned before running the isolated developer world test.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repo = Split-Path -Parent $PSScriptRoot
$work = Join-Path ([IO.Path]::GetTempPath()) ('ShenPulseUnturnedQA-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
[IO.File]::WriteAllText((Join-Path $repo '.tmp\unturned-research\world-qa-directory.txt'), $work)
$modules = Join-Path $work 'Modules'
$bundle = Join-Path $repo 'resources\installer-assets\unturned\1.0.1\unturned-shenpulse-1.0.1.zip'
[IO.Compression.ZipFile]::ExtractToDirectory($bundle, $work)
$payload = Join-Path $modules 'ShenPulse.Unturned'
$managed = Join-Path $GameDirectory 'Unturned_Data\Managed'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
$arguments = @('/nologo','/noconfig','/nostdlib+','/target:library','/codepage:65001',('/out:' + (Join-Path $payload 'ShenPulse.WorldQA.dll')),('/reference:' + (Join-Path $payload 'ShenPulse.Unturned.dll')),('/reference:' + (Join-Path $payload '0Harmony.dll')))
foreach ($reference in @('mscorlib.dll','System.dll','System.Core.dll','System.Runtime.dll','System.Collections.dll','netstandard.dll','Assembly-CSharp.dll','UnturnedDat.dll','UnityEngine.CoreModule.dll','UnityEngine.PhysicsModule.dll','SDG.NetTransport.dll','com.rlabrecque.steamworks.net.dll')) { $arguments += '/reference:' + (Join-Path $managed $reference) }
$arguments += Join-Path $repo 'native\unturned\Tests\WorldProbe.cs'
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'World QA module compilation failed.' }
$manifestPath = Join-Path $payload 'ShenPulse.Unturned.module'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$manifest.Assemblies += [pscustomobject]@{Path='/ShenPulse.WorldQA.dll';Role='Client';Load_As_Byte_Array=$true}
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
$report = Join-Path $work 'result.log'
[IO.File]::WriteAllText($report, '')
$gameLog = Join-Path $work 'game.log'
$env:SHENPULSE_UNTURNED_QA_REPORT = $report
$gameArguments = '-batchmode -nographics -nosound -DisableSteamCloudRead -ModulesPath "{0}" -logFile "{1}"' -f $modules.Replace('\','/'), $gameLog
try { $game = Start-Process -FilePath (Join-Path $GameDirectory 'Unturned.exe') -WorkingDirectory $GameDirectory -ArgumentList $gameArguments -WindowStyle Hidden -PassThru }
finally { Remove-Item Env:SHENPULSE_UNTURNED_QA_REPORT -ErrorAction SilentlyContinue }
Write-Output ('World QA PID: ' + $game.Id)
Write-Output ('World QA directory: ' + $work)
$deadline = (Get-Date).AddSeconds(240)
do {
  Start-Sleep -Seconds 2
  if ((Get-Date) -ge $deadline) { throw ('QA exceeded its deadline. Inspect the test process and logs at ' + $work) }
} until ($game.HasExited)
if (Test-Path -LiteralPath $report) { Get-Content -LiteralPath $report }
if (!(Test-Path -LiteralPath $report) -or !(Select-String -LiteralPath $report -Pattern '^PASS: isolated Unturned world QA completed\.$' -Quiet)) { throw ('World QA failed. Inspect ' + $gameLog) }
