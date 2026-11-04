param(
 [Parameter(Mandatory=$true)][ValidateRange(1,5)][int]$Number,
 [Parameter(Mandatory=$true)][string]$ModulePath,
 [Parameter(Mandatory=$true)][string]$InteropDirectory,
 [Parameter(Mandatory=$true)][string]$CoreDirectory,
 [Parameter(Mandatory=$true)][string]$SupportPath,
 [Parameter(Mandatory=$true)][string]$OutputPath,
 [Parameter(Mandatory=$true)][string]$RuntimeDirectory
)
$ErrorActionPreference='Stop'
trap {
 if($module){$module.Dispose()};if($support){$support.Dispose()};if($native){$native.Dispose()}
 throw $_
}
[Reflection.Assembly]::Load([IO.File]::ReadAllBytes((Join-Path $CoreDirectory 'Mono.Cecil.dll'))) | Out-Null
$resolver=[Mono.Cecil.DefaultAssemblyResolver]::new()
$resolver.AddSearchDirectory($CoreDirectory)
$resolver.AddSearchDirectory($InteropDirectory)
$resolver.AddSearchDirectory((Split-Path -Parent $ModulePath))
$resolver.AddSearchDirectory((Split-Path -Parent $SupportPath))
$resolver.AddSearchDirectory($RuntimeDirectory)
$parameters=[Mono.Cecil.ReaderParameters]::new();$parameters.AssemblyResolver=$resolver
$native=[Mono.Cecil.ModuleDefinition]::ReadModule((Join-Path $InteropDirectory 'Assembly-CSharp.dll'),$parameters)
$module=[Mono.Cecil.ModuleDefinition]::ReadModule($ModulePath,$parameters)
$support=[Mono.Cecil.ModuleDefinition]::ReadModule($SupportPath,$parameters)
$type=$support.Types | Where-Object FullName -eq 'ShenPulse.FinalFantasy.Runtime'
function AllTypes($roots){foreach($t in $roots){$t;AllTypes $t.NestedTypes}}
foreach($t in (AllTypes $module.Types)){foreach($m in $t.Methods){if(!$m.HasBody){continue};$processor=$m.Body.GetILProcessor();foreach($ins in @($m.Body.Instructions)){
 $call=$ins.Operand
 if($call -isnot [Mono.Cecil.MethodReference]){continue}
 if($Number -ne 4 -and $t.FullName -eq 'CrowdControl.Delegates.Effects.Implementations.RenameCharacter' -and $call.DeclaringType.FullName -eq 'Last.Management.OwnedCharacterClient' -and $call.Name -eq 'UpdateName'){
  $ins.OpCode=[Mono.Cecil.Cil.OpCodes]::Call;$ins.Operand=$module.ImportReference(($type.Methods | Where-Object Name -eq 'RenameMember'))
 }
 if($t.FullName -eq 'CrowdControl.Utilities.EncounterUtility' -and $m.Name -eq 'TryStartRandomEncounter' -and $call.DeclaringType.FullName -eq 'System.Random' -and $call.Name -eq 'Next' -and $call.Parameters.Count -eq 2){
  $zero=$processor.Create([Mono.Cecil.Cil.OpCodes]::Ldc_I4_0);$processor.InsertAfter($ins,$zero);$processor.InsertAfter($ins,$processor.Create([Mono.Cecil.Cil.OpCodes]::Pop))
 }
 if($call.DeclaringType.FullName -eq 'Last.Management.OwnedItemClient' -and $call.Name -eq 'AddOwnedItem' -and $call.Parameters.Count -eq 2){
  $original=$call.Parameters[0].ParameterType.FullName
  $unchanged=($native.Types | Where-Object FullName -eq 'Last.Management.OwnedItemClient').Methods | Where-Object {$_.Name -eq 'AddOwnedItem' -and $_.Parameters.Count -eq 2 -and $_.Parameters[0].ParameterType.FullName -eq $original}
  if($unchanged){continue}
  $target=($native.Types | Where-Object FullName -eq 'Last.Management.OwnedItemClient').Methods | Where-Object {$_.Name -eq 'AddOwnedItem' -and $_.Parameters.Count -gt 2 -and $_.Parameters[0].ParameterType.FullName -eq $original} | Sort-Object {$_.Parameters.Count} | Select-Object -First 1
  if(!$target){throw 'Native AddOwnedItem not found'}
  foreach($extra in @($target.Parameters | Select-Object -Skip 2)){
   if($extra.ParameterType.FullName -eq 'System.Boolean'){$processor.InsertBefore($ins,$processor.Create([Mono.Cecil.Cil.OpCodes]::Ldc_I4_0))}
   elseif($extra.ParameterType.FullName -eq 'Il2CppSystem.Collections.Generic.List`1<Last.UI.ItemListContentData>'){$processor.InsertBefore($ins,$processor.Create([Mono.Cecil.Cil.OpCodes]::Ldnull))}
   else {throw ('Unsupported item argument: '+$extra.ParameterType.FullName)}
  }
  $ins.Operand=$module.ImportReference($target)
 }
 if($call.DeclaringType.FullName -eq 'Last.Interpreter.Instructions.External/Character' -and $call.Name -eq 'RemoveCondition' -and $call.Parameters.Count -eq 2){
  $unchanged=(($native.Types | Where-Object FullName -eq 'Last.Interpreter.Instructions.External').NestedTypes | Where-Object Name -eq 'Character').Methods | Where-Object {$_.Name -eq 'RemoveCondition' -and $_.Parameters.Count -eq 2}
  if($unchanged){continue}
  $target=(($native.Types | Where-Object FullName -eq 'Last.Interpreter.Instructions.External').NestedTypes | Where-Object Name -eq 'Character').Methods | Where-Object {$_.Name -eq 'RemoveCondition' -and $_.Parameters.Count -eq 3} | Select-Object -First 1
  $processor.InsertBefore($ins,$processor.Create([Mono.Cecil.Cil.OpCodes]::Ldnull));$ins.Operand=$module.ImportReference($target)
 }
 if($call.DeclaringType.FullName -eq 'Last.Management.OwnedItemClient' -and $call.Name -eq 'RemoveOwnedItem' -and $call.Parameters.Count -eq 3 -and $call.Parameters[2].ParameterType.FullName -ne 'System.Int32'){
  $unchanged=($native.Types | Where-Object FullName -eq 'Last.Management.OwnedItemClient').Methods | Where-Object {$_.Name -eq 'RemoveOwnedItem' -and $_.Parameters.Count -eq 3 -and $_.Parameters[2].ParameterType.FullName -eq $call.Parameters[2].ParameterType.FullName}
  if($unchanged){continue}
  $target=($native.Types | Where-Object FullName -eq 'Last.Management.OwnedItemClient').Methods | Where-Object {$_.Name -eq 'RemoveOwnedItem' -and $_.Parameters.Count -eq 2} | Select-Object -First 1
  $processor.InsertBefore($ins,$processor.Create([Mono.Cecil.Cil.OpCodes]::Pop));$ins.Operand=$module.ImportReference($target)
 }
 if($call.DeclaringType.FullName -eq 'Last.Data.User.OwnedItemData' -and $call.Name -eq 'get_NaturalName'){$ins.OpCode=[Mono.Cecil.Cil.OpCodes]::Call;$ins.Operand=$module.ImportReference(($type.Methods | Where-Object Name -eq 'ItemName'))}
 if($t.FullName -eq 'CrowdControl.Delegates.Effects.Implementations.ViewerBattle' -and $m.Name -eq 'ResolveSprites' -and $call.DeclaringType.FullName -eq 'CrowdControl.Utilities.AvatarLoader' -and $call.Name -eq 'TryGet'){
  $baseArg=$ins.Previous.Previous.Previous
  if($baseArg.OpCode -eq [Mono.Cecil.Cil.OpCodes]::Ldnull){$baseArg.OpCode=[Mono.Cecil.Cil.OpCodes]::Ldstr;$baseArg.Operand='ghost'}
 }
}}}
function Forward($method,$target){
 $method.Body.ExceptionHandlers.Clear();$method.Body.Variables.Clear();$method.Body.Instructions.Clear()
 $il=$method.Body.GetILProcessor();$il.Emit([Mono.Cecil.Cil.OpCodes]::Call,$module.ImportReference($target));$il.Emit([Mono.Cecil.Cil.OpCodes]::Ret)
}
($module.Types | Where-Object FullName -eq 'CrowdControl.Harmony.updatePatch').CustomAttributes.Clear()
$state=$module.Types | Where-Object FullName -eq 'CrowdControl.GameStateManager'
Forward ($state.Methods | Where-Object Name -eq 'GetGameState') ($type.Methods | Where-Object Name -eq 'State')
$encounter=$module.Types | Where-Object FullName -eq 'CrowdControl.Utilities.EncounterUtility'
if($encounter){Forward ($encounter.Methods | Where-Object Name -eq 'CanStartEncounter') ($type.Methods | Where-Object Name -eq 'CanEncounter')}
$plugin=$module.Types | Where-Object FullName -eq 'CrowdControl.CrowdControlMod'
# An unoccupied party slot must be skipped, including the fifth-slot checks in FF V.
$ko=$plugin.Methods | Where-Object Name -eq 'KOcheck'
$koProcessor=$ko.Body.GetILProcessor();$koFirst=$ko.Body.Instructions[0]
$koProcessor.InsertBefore($koFirst,$koProcessor.Create([Mono.Cecil.Cil.OpCodes]::Ldarg_0))
$koProcessor.InsertBefore($koFirst,$koProcessor.Create([Mono.Cecil.Cil.OpCodes]::Call,$module.ImportReference(($type.Methods | Where-Object Name -eq 'MissingMember'))))
$koProcessor.InsertBefore($koFirst,$koProcessor.Create([Mono.Cecil.Cil.OpCodes]::Brfalse,$koFirst))
$koProcessor.InsertBefore($koFirst,$koProcessor.Create([Mono.Cecil.Cil.OpCodes]::Ldc_I4_1))
$koProcessor.InsertBefore($koFirst,$koProcessor.Create([Mono.Cecil.Cil.OpCodes]::Ret))
foreach($mapping in @(@('changeHP','ChangeFieldHp'),@('setHP','SetFieldHp'))){
 $method=$plugin.Methods | Where-Object Name -eq $mapping[0]
 $processor=$method.Body.GetILProcessor();$first=$method.Body.Instructions[0]
 $processor.InsertBefore($first,$processor.Create([Mono.Cecil.Cil.OpCodes]::Call,$module.ImportReference(($type.Methods | Where-Object Name -eq 'InBattle'))))
 $processor.InsertBefore($first,$processor.Create([Mono.Cecil.Cil.OpCodes]::Brtrue,$first))
 foreach($parameter in $method.Parameters){$processor.InsertBefore($first,$processor.Create([Mono.Cecil.Cil.OpCodes]::Ldarg,$parameter))}
 $processor.InsertBefore($first,$processor.Create([Mono.Cecil.Cil.OpCodes]::Call,$module.ImportReference(($type.Methods | Where-Object Name -eq $mapping[1]))))
 $processor.InsertBefore($first,$processor.Create([Mono.Cecil.Cil.OpCodes]::Ret))
}
# Preserve the older misspelled effect code in saved user configurations.
$giveItem=$module.Types | Where-Object FullName -eq 'CrowdControl.Delegates.Effects.Implementations.GiveItem'
foreach($attribute in $giveItem.CustomAttributes){
 if($attribute.AttributeType.Name -ne 'EffectAttribute'){continue}
 $values=@($attribute.ConstructorArguments[0].Value)
 if(@($values | Where-Object Value -eq 'giveitem_Phoenix+Down_8').Count){
  $values += [Mono.Cecil.CustomAttributeArgument]::new($module.TypeSystem.String,'giveitem_Phoeni+Down_8')
  $attribute.ConstructorArguments[0]=[Mono.Cecil.CustomAttributeArgument]::new($attribute.ConstructorArguments[0].Type,[Mono.Cecil.CustomAttributeArgument[]]$values)
 }
}
$load=$plugin.Methods | Where-Object Name -eq 'Load'
$il=$load.Body.GetILProcessor();$ret=$load.Body.Instructions | Where-Object OpCode -eq ([Mono.Cecil.Cil.OpCodes]::Ret) | Select-Object -Last 1
$il.InsertBefore($ret,$il.Create([Mono.Cecil.Cil.OpCodes]::Ldarg_0));$il.InsertBefore($ret,$il.Create([Mono.Cecil.Cil.OpCodes]::Call,$module.ImportReference(($type.Methods | Where-Object Name -eq 'Initialize'))))
$writer=[Mono.Cecil.WriterParameters]::new();$writer.Timestamp=0
$module.Write($OutputPath,$writer)
$module.Dispose();$support.Dispose();$native.Dispose()
Write-Output ('Adapted Game Pass module: '+$OutputPath)
