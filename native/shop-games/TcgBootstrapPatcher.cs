using System;
using System.IO;
using System.Linq;
using Mono.Cecil;
using Mono.Cecil.Cil;
public static class TcgBootstrapPatcher {
    public static void Main(string[] args) {
        var resolver = new DefaultAssemblyResolver();
        resolver.AddSearchDirectory(Path.GetDirectoryName(args[0]));
        if (args.Length > 2) resolver.AddSearchDirectory(args[2]);
        using (var source = AssemblyDefinition.ReadAssembly(args[0], new ReaderParameters { AssemblyResolver = resolver }))
        using (var bootstrap = AssemblyDefinition.ReadAssembly(args[1])) {
            if (source.MainModule.AssemblyReferences.Any(r => r.Name.StartsWith("BepInEx"))) throw new InvalidOperationException("Une entrée BepInEx existe déjà. Restaurer la copie originale sauvegardée avant de réparer.");
            var application = source.MainModule.Types.Single(t => t.FullName == "UnityEngine.Application");
            var entry = bootstrap.MainModule.Types.Single(t => t.FullName == "BepInEx.Bootstrap.Entrypoint").Methods.Single(m => m.Name == "Init");
            var constructor = application.Methods.FirstOrDefault(m => m.IsConstructor && m.IsStatic);
            if (constructor == null) {
                constructor = new MethodDefinition(".cctor", MethodAttributes.Private | MethodAttributes.Static | MethodAttributes.SpecialName | MethodAttributes.RTSpecialName | MethodAttributes.HideBySig, source.MainModule.TypeSystem.Void);
                application.Methods.Add(constructor); constructor.Body.Instructions.Add(Instruction.Create(OpCodes.Ret));
            }
            application.IsBeforeFieldInit = false;
            constructor.Body.GetILProcessor().InsertBefore(constructor.Body.Instructions[0], Instruction.Create(OpCodes.Call, source.MainModule.ImportReference(entry)));
            using(var output = new MemoryStream()) { source.Write(output); byte[] bytes=output.ToArray(); Console.OpenStandardOutput().Write(bytes,0,bytes.Length); }
        }
    }
}
