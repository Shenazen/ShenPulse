using System;
using System.IO;
using System.Reflection;
namespace BepInEx.Bootstrap {
    public static class Entrypoint {
        private static bool started;
        public static void Init() {
            if (started) return;
            started = true;
            string managed = Path.GetDirectoryName(typeof(Entrypoint).Assembly.Location);
            string root = Path.GetFullPath(Path.Combine(managed, "..", ".."));
            string core = Path.Combine(root, "BepInEx", "core"), plugin = Path.Combine(root, "BepInEx", "plugins", "ShenPulseTCG");
            try {
                AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs args) {
                    string name = new AssemblyName(args.Name).Name + ".dll";
                    if (Path.GetFileName(name) != name) return null;
                    foreach (string directory in new[] { core, plugin, managed }) if (File.Exists(Path.Combine(directory, name))) return Assembly.LoadFrom(Path.Combine(directory, name));
                    return null;
                };
                Assembly loader = Assembly.LoadFrom(Path.Combine(core, "BepInEx.dll"));
                string executable = Path.Combine(root, "Card Shop Simulator.exe");
                loader.GetType("BepInEx.Paths", true).GetMethod("SetExecutablePath", BindingFlags.Static|BindingFlags.Public|BindingFlags.NonPublic).Invoke(null, new object[] { executable, Path.Combine(root,"BepInEx"), managed, new[] { managed, core } });
                Type chain = loader.GetType("BepInEx.Bootstrap.Chainloader",true);
                chain.GetMethod("Initialize").Invoke(null,new object[] { executable,false,null });
                chain.GetMethod("Start").Invoke(null,null);
            } catch(Exception e) { try { File.AppendAllText(Path.Combine(root,"shenpulse-tcg-bootstrap.log"),e.ToString()+Environment.NewLine); } catch {} }
        }
    }
}
