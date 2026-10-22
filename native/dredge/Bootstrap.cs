using System;
using System.IO;
using System.Reflection;

// L’entrée gérée évite le proxy natif incompatible avec le lanceur GDK.
// Aucun préchargeur de patchs tiers n’est exécuté ; Chainloader charge les plugins.
namespace BepInEx.Bootstrap {
    public static class Entrypoint {
        private static bool started;
        public static void Init() {
            if (started) return;
            started = true;
            string managed = Path.GetDirectoryName(typeof(Entrypoint).Assembly.Location);
            string root = Path.GetFullPath(Path.Combine(managed, "..", ".."));
            string core = Path.Combine(root, "BepInEx", "core");
            try {
                AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs args) {
                    string name = new AssemblyName(args.Name).Name + ".dll";
                    if (Path.GetFileName(name) != name) return null;
                    foreach (string directory in new string[] { core, Path.Combine(root, "BepInEx/plugins/Crowdcontrol"), managed }) {
                        string file = Path.Combine(directory, name);
                        if (File.Exists(file)) return Assembly.LoadFrom(file);
                    }
                    return null;
                };
                Assembly bepin = Assembly.LoadFrom(Path.Combine(core, "BepInEx.dll"));
                string executable = Path.Combine(root, "DREDGE.exe");
                // Initialiser Paths avant le constructeur statique de Chainloader
                // est nécessaire avec BepInEx 5.4 (ConfigFile utilise déjà ces chemins).
                bepin.GetType("BepInEx.Paths", true).GetMethod("SetExecutablePath", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
                    .Invoke(null, new object[] { executable, Path.Combine(root, "BepInEx"), managed, new string[] { managed, core } });
                Type chainloader = bepin.GetType("BepInEx.Bootstrap.Chainloader", true);
                chainloader.GetMethod("Initialize").Invoke(null, new object[] { executable, false, null });
                chainloader.GetMethod("Start").Invoke(null, null);
            } catch (Exception e) {
                // Une erreur de module ne doit pas rendre Unity.Application inutilisable.
                try { File.AppendAllText(Path.Combine(root, "shenpulse-dredge-bootstrap.log"), e.ToString() + Environment.NewLine); } catch { }
            }
        }
    }
}
