param(
 [Parameter(Mandatory=$true)][string]$ModulePath,
 [Parameter(Mandatory=$true)][string]$ManagedDirectory,
 [Parameter(Mandatory=$true)][string]$SupportPath,
 [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Add-Type -Path (Join-Path $repo '.tmp-cecil/package/lib/net40/Mono.Cecil.dll')
$resolver=[Mono.Cecil.DefaultAssemblyResolver]::new()
$resolver.AddSearchDirectory($ManagedDirectory)
$resolver.AddSearchDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ModulePath)))
$parameters=[Mono.Cecil.ReaderParameters]::new();$parameters.AssemblyResolver=$resolver
$module=[Mono.Cecil.AssemblyDefinition]::ReadAssembly($ModulePath,$parameters)
$support=[Mono.Cecil.AssemblyDefinition]::ReadAssembly($SupportPath,$parameters)
try {
 $method=$support.MainModule.Types | Where-Object FullName -eq 'ShenPulse.FrogSqwad.Runtime' | ForEach-Object {$_.Methods} | Where-Object Name -eq 'ApplyBuff'
 $import=$module.MainModule.ImportReference($method)
 $patched=0
 foreach($type in $module.MainModule.Types){foreach($m in $type.Methods){if(!$m.HasBody){continue};foreach($instruction in $m.Body.Instructions){
  if($instruction.Operand -is [Mono.Cecil.MethodReference] -and $instruction.Operand.FullName -eq 'System.Void FrogSqwad.Character.PlayerManager::ApplyBuff(Fusion.PlayerRef,FrogSqwad.Character.PlayerBuffType,System.Single)'){
   $instruction.OpCode=[Mono.Cecil.Cil.OpCodes]::Call;$instruction.Operand=$import;$patched++
  }
 }}}
 if($patched -ne 1){throw ('Unexpected number of native buff calls: '+$patched)}
 $spawn=$support.MainModule.Types | Where-Object FullName -eq 'ShenPulse.FrogSqwad.Runtime' | ForEach-Object {$_.Methods} | Where-Object Name -eq 'TrySpawnEnemy'
 $spawn=$module.MainModule.ImportReference($spawn)
 $target=$module.MainModule.Types | Where-Object Name -eq 'EnemySpawnHelper' | ForEach-Object {$_.Methods} | Where-Object Name -eq 'TrySpawnEnemyNearPlayer'
 if(!$target -or !$target.HasBody){throw 'Native enemy dispatcher missing'}
 $il=$target.Body.GetILProcessor();$first=$target.Body.Instructions[0]
 $prefix=@(
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ldarg_0),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ldarg_1),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ldarg_2),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Call,$spawn),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Brfalse,$first),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ldc_I4_1),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ret)
 )
 foreach($instruction in $prefix){$il.InsertBefore($first,$instruction)}
 $cart=$support.MainModule.Types | Where-Object FullName -eq 'ShenPulse.FrogSqwad.Runtime' | ForEach-Object {$_.Methods} | Where-Object Name -eq 'SpawnCart'
 $cart=$module.MainModule.ImportReference($cart)
 $target=$module.MainModule.Types | Where-Object Name -eq 'WorldPropSpawnHelper' | ForEach-Object {$_.Methods} | Where-Object Name -eq 'TrySpawnProp'
 if(!$target -or !$target.HasBody){throw 'Native world prop dispatcher missing'}
 $il=$target.Body.GetILProcessor();$first=$target.Body.Instructions[0]
 $prefix=@(
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ldarg_1),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ldc_I4_1),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Bne_Un,$first),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ldarg_0),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ldarg_2),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ldarg_3),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Call,$cart),
  $il.Create([Mono.Cecil.Cil.OpCodes]::Ret)
 )
 foreach($instruction in $prefix){$il.InsertBefore($first,$instruction)}
 $module.Write([IO.Path]::GetFullPath($OutputPath))
} finally {$support.Dispose();$module.Dispose();$resolver.Dispose()}
