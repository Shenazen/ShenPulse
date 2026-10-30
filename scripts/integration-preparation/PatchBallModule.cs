using System;
using System.Linq;
using Mono.Cecil;
using Mono.Cecil.Cil;
public static class PatchBallModule {
  static void SetConflicts(ModuleDefinition module, TypeDefinition type, params string[] conflicts) {
    var old=type.CustomAttributes.Single(a=>a.AttributeType.Name=="EffectAttribute");
    var ctor=new MethodReference(".ctor",module.TypeSystem.Void,old.AttributeType){HasThis=true};
    ctor.Parameters.Add(new ParameterDefinition(module.TypeSystem.String));
    ctor.Parameters.Add(new ParameterDefinition(module.TypeSystem.Single));
    ctor.Parameters.Add(new ParameterDefinition(new ArrayType(module.TypeSystem.String)));
    var attr=new CustomAttribute(ctor);attr.ConstructorArguments.Add(old.ConstructorArguments[0]);attr.ConstructorArguments.Add(old.ConstructorArguments[1]);
    attr.ConstructorArguments.Add(new CustomAttributeArgument(new ArrayType(module.TypeSystem.String),conflicts.Select(s=>new CustomAttributeArgument(module.TypeSystem.String,s)).ToArray()));
    type.CustomAttributes.Remove(old);type.CustomAttributes.Add(attr);
  }
  static TypeDefinition AddDisableBabyBalls(ModuleDefinition module, TypeDefinition mod) {
    var source=module.Types.Single(t=>t.Name=="MaxDmg");
    var type=new TypeDefinition(source.Namespace,"DisableBabyBalls",source.Attributes,source.BaseType);module.Types.Add(type);
    var oldFlag=mod.Fields.Single(f=>f.Name=="maxdmg");var newFlag=mod.Fields.Single(f=>f.Name=="disableBabyBalls");
    foreach(var original in source.Methods) {
      var method=new MethodDefinition(original.Name,original.Attributes,original.ReturnType);type.Methods.Add(method);
      foreach(var p in original.Parameters)method.Parameters.Add(new ParameterDefinition(p.Name,p.Attributes,p.ParameterType));
      method.Body.InitLocals=original.Body.InitLocals;method.Body.MaxStackSize=original.Body.MaxStackSize;
      foreach(var v in original.Body.Variables)method.Body.Variables.Add(new VariableDefinition(v.VariableType));
      var instructions=original.Body.Instructions.ToDictionary(i=>i,i=>Instruction.Create(OpCodes.Nop));
      foreach(var i in original.Body.Instructions) {
        var clone=instructions[i];clone.OpCode=i.OpCode;object operand=i.Operand;
        if(operand==oldFlag)operand=newFlag;
        else if(operand is Instruction)operand=instructions[(Instruction)operand];
        else if(operand is Instruction[])operand=((Instruction[])operand).Select(x=>instructions[x]).ToArray();
        else if(operand is VariableDefinition)operand=method.Body.Variables[original.Body.Variables.IndexOf((VariableDefinition)operand)];
        else if(operand is ParameterDefinition)operand=method.Parameters[original.Parameters.IndexOf((ParameterDefinition)operand)];
        clone.Operand=operand;method.Body.Instructions.Add(clone);
      }
      foreach(var h in original.Body.ExceptionHandlers)method.Body.ExceptionHandlers.Add(new ExceptionHandler(h.HandlerType){CatchType=h.CatchType,TryStart=instructions[h.TryStart],TryEnd=h.TryEnd==null?null:instructions[h.TryEnd],HandlerStart=instructions[h.HandlerStart],HandlerEnd=h.HandlerEnd==null?null:instructions[h.HandlerEnd],FilterStart=h.FilterStart==null?null:instructions[h.FilterStart]});
    }
    var sourceAttr=source.CustomAttributes.Single(a=>a.AttributeType.Name=="EffectAttribute");var attr=new CustomAttribute(sourceAttr.Constructor);
    attr.ConstructorArguments.Add(new CustomAttributeArgument(module.TypeSystem.String,"disablebabyballs"));
    attr.ConstructorArguments.Add(sourceAttr.ConstructorArguments[1]);attr.ConstructorArguments.Add(sourceAttr.ConstructorArguments[2]);type.CustomAttributes.Add(attr);
    SetConflicts(module,type,"disablebabyballs","babyballsonly");
    var prefix=module.Types.Single(t=>t.Name=="ballChangePatch").Methods.Single(m=>m.Name=="Prefix");var first=prefix.Body.Instructions[0];var il=prefix.Body.GetILProcessor();
    foreach(var instruction in new[]{Instruction.Create(OpCodes.Ldsfld,newFlag),Instruction.Create(OpCodes.Brfalse,first),Instruction.Create(OpCodes.Ldarg_1),Instruction.Create(OpCodes.Ldind_U1),Instruction.Create(OpCodes.Brfalse,first),Instruction.Create(OpCodes.Ldc_I4_0),Instruction.Create(OpCodes.Ret)})il.InsertBefore(first,instruction);
    return type;
  }
  static void RejectFailedTimedStarts(ModuleDefinition module) {
    var timed=module.Types.Single(t=>t.Name=="TimedEffectState");var iterator=timed.NestedTypes.Single(t=>t.Name.StartsWith("<Start>"));
    var response=iterator.Fields.Single(f=>f.Name.Contains("response"));var stateType=timed.NestedTypes.Single(t=>t.Name=="EffectState");
    var helper=new MethodDefinition("ShenPulseStateAfterStart",MethodAttributes.Public|MethodAttributes.Static,stateType);helper.Parameters.Add(new ParameterDefinition(response.FieldType));timed.Methods.Add(helper);
    var statusType=module.GetTypeReferences().Single(t=>t.FullName=="ConnectorLib.JSON.EffectStatus");var status=new FieldReference("status",statusType,response.FieldType);var il=helper.Body.GetILProcessor();var fail=Instruction.Create(OpCodes.Ldc_I4_4);
    il.Emit(OpCodes.Ldarg_0);il.Emit(OpCodes.Brfalse,fail);il.Emit(OpCodes.Ldarg_0);il.Emit(OpCodes.Ldfld,status);il.Emit(OpCodes.Brtrue,fail);il.Emit(OpCodes.Ldc_I4_1);il.Emit(OpCodes.Ret);il.Append(fail);il.Emit(OpCodes.Ret);
    var move=iterator.Methods.Single(m=>m.Name=="MoveNext");var call=move.Body.Instructions.Single(i=>(i.Operand as MethodReference)?.Name=="set_State"&&i.Previous.OpCode==OpCodes.Ldc_I4_1);
    var value=call.Previous;value.OpCode=OpCodes.Ldarg_0;var moveIl=move.Body.GetILProcessor();moveIl.InsertAfter(value,Instruction.Create(OpCodes.Ldfld,response));moveIl.InsertBefore(call,Instruction.Create(OpCodes.Call,helper));
  }
  public static void Main(string[] args) {
    var resolver=new DefaultAssemblyResolver();resolver.AddSearchDirectory(System.IO.Path.GetDirectoryName(args[0]));foreach(var dir in System.IO.Directory.GetDirectories(@"C:/Program Files/dotnet/shared/Microsoft.NETCore.App"))resolver.AddSearchDirectory(dir);
    using(var module=ModuleDefinition.ReadModule(args[0],new ReaderParameters{AssemblyResolver=resolver,ReadingMode=ReadingMode.Deferred})) {
      var types=module.Types.ToArray();
      var mod=types.Single(t=>t.Name=="CrowdControlMod");
      AddDisableBabyBalls(module,mod);
      RejectFailedTimedStarts(module);
      var pickups=types.Where(t=>t.Name.StartsWith("AbundantPickups")).ToArray();
      var pickupIds=pickups.Select(t=>(string)t.CustomAttributes.Single(a=>a.AttributeType.Name=="EffectAttribute").ConstructorArguments[0].Value).ToArray();
      foreach(var t in pickups)SetConflicts(module,t,pickupIds);
      foreach(var name in new[]{"DisableMovement","FastPlayer","HyperPlayer"})SetConflicts(module,types.Single(t=>t.Name==name),"disablemovement","fastplayer","hyperplayer");
      foreach(var name in new[]{"LockedAimLeft","LockedAimRight","LockedAimUp","LockedAimSweep","RandomAim"})SetConflicts(module,types.Single(t=>t.Name==name),"lockedaimleft","lockedaimright","lockedaimup","lockedaimsweep","randomaim");
      SetConflicts(module,types.Single(t=>t.Name=="BabyBallsOnly"),"disablebabyballs","babyballsonly");
      var delta=mod.Methods.Single(m=>m.Name=="get_DeltaTime");
      var deltaCall=delta.Body.Instructions.Single(i=>(i.Operand as MethodReference)?.Name=="get_deltaTime");
      var old=(MethodReference)deltaCall.Operand;
      deltaCall.Operand=new MethodReference("get_unscaledDeltaTime",old.ReturnType,old.DeclaringType){HasThis=old.HasThis,CallingConvention=old.CallingConvention};
      foreach(var type in types.Where(t=>new[]{"GameSpeedFast","GameSpeedSlow"}.Contains(t.Name))) {
        var tick=type.Methods.Single(m=>m.Name=="Tick");
        var timeGetter=(MethodReference)tick.Body.Instructions.Select(i=>i.Operand).OfType<MethodReference>().First(m=>m.DeclaringType.Name=="TimeMgr"&&m.Name=="get_I");
        var setSpeed=(MethodReference)tick.Body.Instructions.Select(i=>i.Operand).OfType<MethodReference>().First(m=>m.DeclaringType.Name=="TimeMgr"&&m.Name=="SetGameSpeed");
        var speedGetter=(MethodReference)tick.Body.Instructions.Select(i=>i.Operand).OfType<MethodReference>().First(m=>m.DeclaringType.Name=="TimeMgr"&&m.Name=="get__gameSpeed");
        var previousSpeed=new FieldDefinition("shenPulsePreviousSpeed",FieldAttributes.Private,module.TypeSystem.Single);
        type.Fields.Add(previousSpeed);
        var start=type.Methods.Single(m=>m.Name=="Start");
        var startIl=start.Body.GetILProcessor();var first=start.Body.Instructions[0];
        startIl.InsertBefore(first,Instruction.Create(OpCodes.Ldarg_0));
        startIl.InsertBefore(first,Instruction.Create(OpCodes.Call,timeGetter));
        startIl.InsertBefore(first,Instruction.Create(OpCodes.Callvirt,speedGetter));
        startIl.InsertBefore(first,Instruction.Create(OpCodes.Stfld,previousSpeed));
        var stop=type.Methods.Single(m=>m.Name=="Stop");
        foreach(var instruction in stop.Body.Instructions) {
          var method=instruction.Operand as MethodReference;
          if(method?.DeclaringType.Name=="GridMgr"&&method.Name=="get_I")instruction.Operand=timeGetter;
          if(method?.DeclaringType.Name=="GridMgr"&&method.Name=="SetScrollSpeedMult")instruction.Operand=setSpeed;
        }
        var reset=stop.Body.Instructions.Single(i=>i.OpCode==OpCodes.Ldc_R4 && (float)i.Operand==1f);
        reset.OpCode=OpCodes.Ldarg_0;reset.Operand=null;
        stop.Body.GetILProcessor().InsertAfter(reset,Instruction.Create(OpCodes.Ldfld,previousSpeed));
        var attr=type.CustomAttributes.Single(a=>a.AttributeType.Name=="EffectAttribute");
        var ctor=new MethodReference(".ctor",module.TypeSystem.Void,attr.AttributeType){HasThis=true};
        ctor.Parameters.Add(new ParameterDefinition(module.TypeSystem.String));
        ctor.Parameters.Add(new ParameterDefinition(module.TypeSystem.Single));
        ctor.Parameters.Add(new ParameterDefinition(new ArrayType(module.TypeSystem.String)));
        var replacement=new CustomAttribute(ctor);
        replacement.ConstructorArguments.Add(attr.ConstructorArguments[0]);
        replacement.ConstructorArguments.Add(attr.ConstructorArguments[1]);
        replacement.ConstructorArguments.Add(new CustomAttributeArgument(new ArrayType(module.TypeSystem.String),new[]{new CustomAttributeArgument(module.TypeSystem.String,"gamespeedfast"),new CustomAttributeArgument(module.TypeSystem.String,"gamespeedslow")}));
        type.CustomAttributes.Remove(attr);type.CustomAttributes.Add(replacement);
      }
      foreach(var attr in module.Assembly.CustomAttributes.Where(a=>a.AttributeType.Name=="MelonInfoAttribute")) {
        attr.ConstructorArguments[1]=new CustomAttributeArgument(module.TypeSystem.String,"ShenPulse");
        attr.ConstructorArguments[2]=new CustomAttributeArgument(module.TypeSystem.String,args.Length>2?args[2]:"1.0.2");
        attr.ConstructorArguments[3]=new CustomAttributeArgument(module.TypeSystem.String,"ShenPulse");
        if(attr.ConstructorArguments.Count>4)attr.ConstructorArguments[4]=new CustomAttributeArgument(module.TypeSystem.String,string.Empty);
      }
      if(args.Length>3) {
        var codes=module.Types.SelectMany(t=>t.CustomAttributes.Where(a=>a.AttributeType.Name=="EffectAttribute")).SelectMany(a=>a.ConstructorArguments[0].Value is string?new[]{(string)a.ConstructorArguments[0].Value}:((CustomAttributeArgument[])a.ConstructorArguments[0].Value).Select(x=>(string)x.Value)).ToArray();
        var missing=System.IO.File.ReadAllLines(args[3]).Where(s=>!string.IsNullOrWhiteSpace(s)&&!codes.Contains(s)).ToArray();
        if(missing.Length>0)throw new InvalidOperationException("Catalogue sans implémentation : "+string.Join(", ",missing));
      }
      module.Write(args[1]);
      Console.WriteLine("BALL x PIT : horloge réelle, restauration de vitesse et conflits corrigés.");
    }
  }
}
