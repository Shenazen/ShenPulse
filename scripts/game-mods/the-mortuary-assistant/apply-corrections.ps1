param(
  [Parameter(Mandatory=$true)][string] $Payload,
  [Parameter(Mandatory=$true)][string] $InteropDirectory,
  [Parameter(Mandatory=$true)][string] $Compiler,
  [string] $RuntimeDirectory = 'C:/Program Files/dotnet/shared/Microsoft.NETCore.App/6.0.36'
)
$ErrorActionPreference = 'Stop'
$assembly = Join-Path $Payload 'Mods/ShenPulse.TheMortuaryAssistant.dll'
$support = Join-Path $Payload 'UserLibs/ShenPulse.Mortuary.Support.dll'
$references = @()
foreach ($directory in @($RuntimeDirectory, $InteropDirectory, (Join-Path $Payload 'MelonLoader/net6'), (Join-Path $Payload 'UserLibs'))) {
  foreach ($file in Get-ChildItem -LiteralPath $directory -Filter '*.dll' -File) {
    try { [Reflection.AssemblyName]::GetAssemblyName($file.FullName) | Out-Null; $references += ('/r:' + $file.FullName) } catch {}
  }
}
$arguments = @('/nologo', '/target:library', '/nostdlib+', '/langversion:latest', '/deterministic+', ('/out:' + $support), ('/r:' + $assembly)) + $references + @(Join-Path $PSScriptRoot 'Support.cs')
$responseFile = Join-Path $Payload 'support-build.rsp'
[IO.File]::WriteAllLines($responseFile, @($arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }), [Text.UTF8Encoding]::new($false))
try { & $Compiler ('@' + $responseFile) }
finally { Remove-Item -LiteralPath $responseFile -ErrorAction SilentlyContinue }
if ($LASTEXITCODE -ne 0) { throw 'Mortuary support compilation failed.' }
$resolver = [Mono.Cecil.DefaultAssemblyResolver]::new()
foreach ($directory in @((Join-Path $Payload 'UserLibs'), (Join-Path $Payload 'Mods'), $InteropDirectory, $RuntimeDirectory, (Join-Path $Payload 'MelonLoader/net6'))) { $resolver.AddSearchDirectory($directory) }
$reader = [Mono.Cecil.ReaderParameters]::new(); $reader.AssemblyResolver = $resolver
$mod = [Mono.Cecil.ModuleDefinition]::ReadModule($assembly, $reader)
$helper = [Mono.Cecil.ModuleDefinition]::ReadModule($support, $reader)
try {
  $fixes = $helper.Types | Where-Object FullName -eq 'ShenPulse.MortuarySupport.Corrections'
  function Forward([string] $typeName, [string] $methodName, [string] $helperName, [bool] $withArgument, [bool] $unbox) {
    $type = $mod.Types | Where-Object Name -eq $typeName
    $method = $type.Methods | Where-Object Name -eq $methodName
    if (@($method).Count -ne 1) { throw "Unexpected method: $typeName.$methodName" }
    $method.Body.Instructions.Clear(); $method.Body.ExceptionHandlers.Clear(); $method.Body.Variables.Clear()
    if ($withArgument) { $method.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Ldarg_0)) }
    $target = $mod.ImportReference(($fixes.Methods | Where-Object Name -eq $helperName))
    $method.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Call, $target))
    if ($unbox) { $method.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Unbox_Any, $method.ReturnType)) }
    $method.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Ret))
  }
  Forward 'EffectGame' 'FindItem' 'FindItem' $true $false
  Forward 'FillEmbalmingMachine' 'Test' 'TestFill' $false $true
  Forward 'FillEmbalmingMachine' 'Start' 'Fill' $false $true
  Forward 'DemonicActivity' 'Start' 'DemonicActivity' $false $true
  Forward 'PossessionAdjustmentPatch' 'Prefix' 'AdjustPossession' $true $false
  $strip = $mod.Types | Where-Object Name -eq 'GiveLetteringStrip' | ForEach-Object Methods | Where-Object Name -eq 'get_ItemTerms'
  $changes = 0
  foreach ($instruction in $strip.Body.Instructions) {
    if ($instruction.OpCode.Name -eq 'ldstr' -and $instruction.Operand -in @('letter', 'strip')) { $instruction.Operand = 'sigilPaper'; $changes++ }
  }
  if ($changes -ne 2) { throw 'Unexpected strip item terms.' }
  $set = $mod.Types | Where-Object Name -eq 'TimedPossession' | ForEach-Object Methods | Where-Object Name -eq 'Set'
  $target = $mod.ImportReference(($fixes.Methods | Where-Object Name -eq 'SetPassivePossession'))
  $set.Body.Instructions.Clear(); $set.Body.ExceptionHandlers.Clear(); $set.Body.Variables.Clear()
  $set.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Ldarg_0))
  $set.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Ldarg_1))
  $set.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Call, $target))
  $set.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Ret))
  $possession = $mod.Types | Where-Object Name -eq 'TimedPossession'
  $tick = [Mono.Cecil.MethodDefinition]::new('Tick', [Mono.Cecil.MethodAttributes]::Public -bor [Mono.Cecil.MethodAttributes]::Virtual -bor [Mono.Cecil.MethodAttributes]::HideBySig, $mod.TypeSystem.Void)
  $tick.Parameters.Add([Mono.Cecil.ParameterDefinition]::new('unscaledDeltaTime', [Mono.Cecil.ParameterAttributes]::None, $mod.TypeSystem.Single))
  $tick.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Ldarg_0))
  $tick.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Call, $mod.ImportReference(($fixes.Methods | Where-Object Name -eq 'TickPossession'))))
  $tick.Body.Instructions.Add([Mono.Cecil.Cil.Instruction]::Create([Mono.Cecil.Cil.OpCodes]::Ret))
  $possession.Methods.Add($tick)
  $mod.Write($assembly + '.patched')
} finally { $mod.Dispose(); $helper.Dispose(); $resolver.Dispose() }
Move-Item -LiteralPath ($assembly + '.patched') -Destination $assembly -Force
Write-Host 'Applied tested game 3.0.2 corrections: exact items, native machine slots, possession rate and forced manifestation.'
