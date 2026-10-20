using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Threading;
using System.Windows.Forms;

namespace ShenPulse.Crash
{
    static class Program
    {
        internal const string SupportedHash = "170c61d37fb5277dd94b3e41f7a918f227b76bc67aa338f5c97f63ac317b6af3";
        static string Hash(string file)
        {
            using (var sha = SHA256.Create()) using (var input = File.OpenRead(file))
                return BitConverter.ToString(sha.ComputeHash(input)).Replace("-", "").ToLowerInvariant();
        }
        internal static void Trace(string message)
        {
            try
            {
                string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ShenPulse", "game-logs");
                Directory.CreateDirectory(dir);
                string path = Path.Combine(dir, "crash-bandicoot.log");
                if (File.Exists(path) && new FileInfo(path).Length > 1048576) File.WriteAllText(path, "");
                File.AppendAllText(path, DateTime.UtcNow.ToString("o") + " [" + Process.GetCurrentProcess().Id + "] " + message + Environment.NewLine);
            }
            catch { }
        }
        internal static void Log(Exception error) { Trace(error.ToString()); }
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string root = AppDomain.CurrentDomain.BaseDirectory;
                if (args.Length == 2 && args[0] == "--game-root") root = Path.GetFullPath(args[1]);
                string executable = Path.Combine(root, "CrashBandicootNSaneTrilogy.exe");
                if (!File.Exists(executable)) throw new InvalidOperationException("Installez le pont depuis ShenPulse dans le dossier de Crash Bandicoot N. Sane Trilogy.");
                if (Hash(executable) != SupportedHash) throw new InvalidOperationException("Cette version de Crash Bandicoot n’est pas encore compatible. Version Steam 2964270 requise.");
                Trace("Démarrage du pont 1.0.1.");
                Process game = Launcher.Open(executable, root, Trace);
                using (game)
                {
                    bool owner;
                    using (var singleton = new Mutex(true, "Local\\ShenPulse.Crash." + game.Id, out owner))
                    {
                        if (!owner) return;
                        try
                        {
                            using (var memory = new ProcessMemory(game))
                            using (var link = new LocalLink(58436, Trace))
                            {
                                var effects = new Effects(new GameSession(memory));
                                var clock = Stopwatch.StartNew(); double last = clock.Elapsed.TotalSeconds;
                                try
                                {
                                    while (!game.HasExited)
                                    {
                                        double now = clock.Elapsed.TotalSeconds;
                                        try { effects.Tick(now - last, link.Connected); }
                                        catch (Exception error) { Log(error); }
                                        last = now;
                                        link.Pump(effects.Execute);
                                        Thread.Sleep(25);
                                    }
                                }
                                finally
                                {
                                    if (!game.HasExited) effects.StopAll();
                                    Trace("Fin du jeu ; arrêt du pont.");
                                }
                            }
                        }
                        finally { singleton.ReleaseMutex(); }
                    }
                }
            }
            catch (Exception error)
            {
                Log(error);
                MessageBox.Show(error.Message, "ShenPulse · Crash Bandicoot", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }
    }
}
