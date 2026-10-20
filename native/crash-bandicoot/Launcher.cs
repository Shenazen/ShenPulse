using System;
using System.Diagnostics;
using System.Threading;

namespace ShenPulse.Crash
{
    // A launcher/DRM bootstrap can exit and be replaced by Steam. A process
    // name alone does not identify the lasting game instance.
    public sealed class StartupGate
    {
        private int candidate;
        private double windowSince;
        public bool Observe(int id, bool windowReady, double milliseconds)
        {
            if (id <= 0 || !windowReady) { candidate = 0; return false; }
            if (id != candidate) { candidate = id; windowSince = milliseconds; return false; }
            return milliseconds - windowSince >= 1000;
        }
    }

    static class Launcher
    {
        internal const string SteamUri = "steam://run/731490";
        internal static Process Find(string executable)
        {
            foreach (var process in Process.GetProcessesByName("CrashBandicootNSaneTrilogy"))
                try
                {
                    if (String.Equals(process.MainModule.FileName, executable, StringComparison.OrdinalIgnoreCase) && !process.HasExited) return process;
                    process.Dispose();
                }
                catch { process.Dispose(); }
            return null;
        }
        internal static Process Open(string executable, string root, Action<string> trace)
        {
            using (var existing = Find(executable))
            {
                if (existing == null)
                {
                    trace("Lancement du jeu via Steam.");
                    using (var started = Process.Start(new ProcessStartInfo(SteamUri) { WorkingDirectory = root, UseShellExecute = true })) { }
                }
                else trace("Jeu déjà ouvert ; attente de sa fenêtre.");
            }
            var clock = Stopwatch.StartNew();
            var gate = new StartupGate();
            while (clock.Elapsed.TotalSeconds < 90)
            {
                var process = Find(executable);
                if (process == null) gate.Observe(0, false, clock.Elapsed.TotalMilliseconds);
                else
                {
                    try
                    {
                        process.Refresh();
                        if (gate.Observe(process.Id, !process.HasExited && process.MainWindowHandle != IntPtr.Zero, clock.Elapsed.TotalMilliseconds))
                        {
                            trace("Fenêtre du jeu stable, processus " + process.Id + ".");
                            return process;
                        }
                    }
                    catch { gate.Observe(0, false, clock.Elapsed.TotalMilliseconds); }
                    process.Dispose();
                }
                Thread.Sleep(250);
            }
            throw new InvalidOperationException("Steam n’a pas ouvert la fenêtre de Crash Bandicoot dans le dossier installé. Vérifiez les éventuelles demandes de Steam puis relancez depuis ShenPulse.");
        }
    }
}
