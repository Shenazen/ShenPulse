param([string]$BuildDirectory="")
$ErrorActionPreference="Stop"
$projectRoot=Split-Path -Parent $PSScriptRoot
$legacyRoot=Join-Path $projectRoot "native\gtav-montchiliad-enhanced"
$kothRoot=Join-Path $projectRoot "native\gtav-koth-enhanced"
$buildRoot=if($BuildDirectory){[IO.Path]::GetFullPath($BuildDirectory)}else{Join-Path ([IO.Path]::GetTempPath()) "ShenPulseKoth-build"}
. (Join-Path $PSScriptRoot "lib\visual-studio-environment.ps1")
Initialize-ShenPulseVisualStudioEnvironment
[IO.Directory]::CreateDirectory($buildRoot)|Out-Null
$sources=@(Get-ChildItem -LiteralPath (Join-Path $legacyRoot "src") -Filter "*.cpp" | Where-Object Name -ne "ShenPulseMontChiliadEnhanced.cpp" | Select-Object -ExpandProperty FullName)
$sources+=@(Get-ChildItem -LiteralPath (Join-Path $kothRoot "src") -Filter "*.cpp" | Select-Object -ExpandProperty FullName)
$sources+=@(Get-ChildItem -LiteralPath (Join-Path $projectRoot "native\gtav-hiking-enhanced\src") -Filter "*.cpp" | Select-Object -ExpandProperty FullName)
$output=Join-Path $buildRoot "ShenPulseMontChiliadEnhanced.asi"
$argsList=@("/nologo","/LD","/O2","/EHsc","/std:c++17","/MT","/W3","/DNDEBUG","/D_WINDOWS","/D_USRDLL",("/I"+(Join-Path $legacyRoot "sdk\inc")),("/Fo"+$buildRoot.Replace('\','/').TrimEnd('/')+'/'))+$sources+@("/link","/NOLOGO","/SUBSYSTEM:WINDOWS","/OPT:REF","/OPT:ICF",("/LIBPATH:"+(Join-Path $legacyRoot "sdk\lib")),"ScriptHookV.lib","Ws2_32.lib","User32.lib",("/OUT:"+$output))
$response=Join-Path $buildRoot "compile.rsp"
$quoted=@($argsList|ForEach-Object { if($_ -match ' '){ '"'+$_+'"' }else{$_} })
[IO.File]::WriteAllText($response,($quoted -join " "),([Text.UTF8Encoding]::new($false)))
& cl.exe ("@"+$response)
if($LASTEXITCODE -ne 0){throw "KOTH native build failed."}
Get-Item -LiteralPath $output | Select-Object FullName,Length
Get-FileHash -LiteralPath $output -Algorithm SHA256
