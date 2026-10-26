using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Mono.Cecil;
using Mono.Cecil.Cil;

// Adaptation de marque et connexion locale des DLL sans contrôle de licence tiers.
// Les originaux TCG/Hogwarts ne sont jamais chargés ni réécrits par cet outil.
public static class PrepareModules {
    static string Brand(string value) { return value == null ? null : System.Text.RegularExpressions.Regex.Replace(value, "sync[ -]?live", "ShenPulse", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Replace("Shift At Midnight TikTok Live", "ShenPulse Shift At Midnight"); }
    static IEnumerable<TypeDefinition> Types(TypeDefinition type) { yield return type; foreach (var child in type.NestedTypes) foreach (var item in Types(child)) yield return item; }
    static void Attributes(IEnumerable<CustomAttribute> attributes) {
        foreach (var attribute in attributes) for (int n=0;n<attribute.ConstructorArguments.Count;n++) {
            var argument=attribute.ConstructorArguments[n];
            if(argument.Value is string) attribute.ConstructorArguments[n]=new CustomAttributeArgument(argument.Type,Brand((string)argument.Value));
        }
    }
    public static void Main(string[] args) {
        string id=args[0], input=args[1], output=args[2], adapter=args[3];
        if (id != "shift-at-midnight" && id != "supermarket-simulator") throw new InvalidOperationException("Module non autorisé pour cette adaptation.");
        var resolver=new DefaultAssemblyResolver(); resolver.AddSearchDirectory(Path.GetDirectoryName(input)); resolver.AddSearchDirectory(Path.GetDirectoryName(adapter));
        using(var assembly=AssemblyDefinition.ReadAssembly(input,new ReaderParameters { AssemblyResolver=resolver }))
        using(var helper=AssemblyDefinition.ReadAssembly(adapter)) {
            var module=assembly.MainModule;
            assembly.Name.Name=id=="shift-at-midnight"?"ShenPulse.ShiftAtMidnight.Module":"ShenPulse.Supermarket.Module";
            module.Name=assembly.Name.Name+".dll";
            Attributes(assembly.CustomAttributes); Attributes(module.CustomAttributes);
            foreach(var reference in module.GetTypeReferences()) { reference.Name=Brand(reference.Name); reference.Namespace=Brand(reference.Namespace); }
            if (id == "supermarket-simulator" && args.Length > 4 && args[4] == "xbox") {
                // Le port Xbox contient ce type dans Assembly-CSharp, tandis que
                // l'édition Steam le place dans NaisuPorter. Aucun fichier du jeu
                // n'est redistribué ni remplacé pour cette adaptation.
                var game = module.AssemblyReferences.Single(a => a.Name == "Assembly-CSharp");
                foreach(var reference in module.GetTypeReferences())
                    if (reference.FullName == "NaisuPorter.CommonScripts.SerializableVector3" && reference.Scope.Name == "NaisuPorter") reference.Scope = game;
            }
            var all=module.Types.SelectMany(Types).ToArray();
            foreach(var type in all) {
                type.Name=Brand(type.Name); type.Namespace=Brand(type.Namespace); Attributes(type.CustomAttributes);
                foreach(var field in type.Fields) { if(field.HasConstant && field.Constant is string) field.Constant=Brand((string)field.Constant); }
                foreach(var method in type.Methods) { Attributes(method.CustomAttributes); if(method.HasBody) foreach(var instruction in method.Body.Instructions) if(instruction.OpCode==OpCodes.Ldstr) instruction.Operand=Brand((string)instruction.Operand); }
            }
            var plugin=all.Single(t=>t.Name==(id=="shift-at-midnight"?"Plugin":"ShenPulsePlugin"));
            var registration=plugin.CustomAttributes.Single(a=>a.AttributeType.Name=="BepInPlugin");
            registration.ConstructorArguments[0]=new CustomAttributeArgument(module.TypeSystem.String,"com.shenpulse."+(id=="shift-at-midnight"?"shiftatmidnight":"supermarket"));
            registration.ConstructorArguments[1]=new CustomAttributeArgument(module.TypeSystem.String,id=="shift-at-midnight"?"ShenPulse Shift At Midnight":"ShenPulse Supermarket Simulator");
            // Remplace uniquement le transport réseau non authentifié par le protocole
            // ShenPulse corrélé. Les fonctions et garde-fous du jeu sont conservés.
            var server=all.Single(t=>t.Name==(id=="shift-at-midnight"?"BridgeServer":"LocalWebSocketServer"));
            var start=server.Methods.Single(m=>m.Name=="Start");
            start.Body=new MethodBody(start); start.Body.Instructions.Add(Instruction.Create(OpCodes.Ret));
            var load=plugin.Methods.Single(m=>m.Name=="Load");
            var entry=helper.MainModule.Types.Single(t=>t.Name=="Il2CppAdapter").Methods.Single(m=>m.Name=="Start");
            var il=load.Body.GetILProcessor();
            var last=load.Body.Instructions.Last(i=>i.OpCode==OpCodes.Ret);
            il.InsertBefore(last,Instruction.Create(OpCodes.Ldstr,id)); il.InsertBefore(last,Instruction.Create(OpCodes.Call,module.ImportReference(entry)));
            if (id == "shift-at-midnight") {
                var bridgeType = helper.MainModule.Types.Single(t => t.Name == "Il2CppAdapter");
                var tick = bridgeType.Methods.Single(m => m.Name == "Tick");
                var pump = all.Single(t => t.Name == "MainThreadPump").Methods.Single(m => m.Name == "Update");
                pump.Body.GetILProcessor().InsertBefore(pump.Body.Instructions[0], Instruction.Create(OpCodes.Call, module.ImportReference(tick)));
                var spawned = all.Single(t => t.Name == "SpawnLogPatch").Methods.Single(m => m.Name == "Postfix");
                var spawnIL = spawned.Body.GetILProcessor(); var firstSpawn = spawned.Body.Instructions[0];
                spawnIL.InsertBefore(firstSpawn, Instruction.Create(OpCodes.Ldarg, spawned.Parameters[0]));
                spawnIL.InsertBefore(firstSpawn, Instruction.Create(OpCodes.Ldarg, spawned.Parameters[2]));
                spawnIL.InsertBefore(firstSpawn, Instruction.Create(OpCodes.Call, module.ImportReference(bridgeType.Methods.Single(m => m.Name == "RecordSpawn"))));
                var label = all.Single(t => t.Name == "GameActions").Methods.Single(m => m.Name == "AttachViewerLabel");
                label.Body = new MethodBody(label);
                label.Body.Instructions.Add(Instruction.Create(OpCodes.Ldarg_0)); label.Body.Instructions.Add(Instruction.Create(OpCodes.Ldarg_1)); label.Body.Instructions.Add(Instruction.Create(OpCodes.Ldarg_2));
                label.Body.Instructions.Add(Instruction.Create(OpCodes.Call, module.ImportReference(bridgeType.Methods.Single(m => m.Name == "AddViewerLabel"))));
                label.Body.Instructions.Add(Instruction.Create(OpCodes.Ret));
                var unload = plugin.Methods.Single(m => m.Name == "Unload");
                var unloadIL = unload.Body.GetILProcessor();
                foreach (var ret in unload.Body.Instructions.Where(i => i.OpCode == OpCodes.Ret).ToArray()) unloadIL.InsertBefore(ret, Instruction.Create(OpCodes.Call, module.ImportReference(bridgeType.Methods.Single(m => m.Name == "Stop"))));
            }
            if (id == "supermarket-simulator") {
                var bridgeType = helper.MainModule.Types.Single(t => t.Name == "Il2CppAdapter");
                var host = all.Single(t => t.Name == "ShenPulseComponent");
                var update = host.Methods.Single(m => m.Name == "Update");
                update.Body.GetILProcessor().InsertBefore(update.Body.Instructions[0], Instruction.Create(OpCodes.Call, module.ImportReference(bridgeType.Methods.Single(m => m.Name == "Tick"))));
                foreach (var pair in new[] {
                    new[] { "AddTimedEffect", "RegisterTimer" }, new[] { "HasActiveEffect", "ActiveTimer" },
                    new[] { "AjouterClientsAuPool", "QueueCustomers" }, new[] { "DrainerPoolClients", "DrainCustomers" },
                    new[] { "EtiqueterClient", "LabelCustomer" }
                }) {
                    var target = host.Methods.Single(m => m.Name == pair[0]); target.Body = new MethodBody(target);
                    foreach (var parameter in target.Parameters) target.Body.Instructions.Add(Instruction.Create(OpCodes.Ldarg, parameter));
                    target.Body.Instructions.Add(Instruction.Create(OpCodes.Call, module.ImportReference(bridgeType.Methods.Single(m => m.Name == pair[1]))));
                    target.Body.Instructions.Add(Instruction.Create(OpCodes.Ret));
                }
                var destroy = new MethodDefinition("OnDestroy", MethodAttributes.Private | MethodAttributes.HideBySig, module.TypeSystem.Void);
                destroy.Body.Instructions.Add(Instruction.Create(OpCodes.Call, module.ImportReference(bridgeType.Methods.Single(m => m.Name == "Stop"))));
                destroy.Body.Instructions.Add(Instruction.Create(OpCodes.Ret)); host.Methods.Add(destroy);
            }
            using (var destination = new MemoryStream()) { assembly.Write(destination); byte[] bytes=destination.ToArray(); Console.OpenStandardOutput().Write(bytes,0,bytes.Length); }
        }
    }
}
