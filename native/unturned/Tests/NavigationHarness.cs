using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Reflection.Emit;
using System.Runtime.CompilerServices;
using HarmonyLib;
using SDG.Unturned;
using ShenPulse.Unturned;

public static class NavigationHarness
{
    public static int Main(string[] arguments)
    {
        AppDomain.CurrentDomain.AssemblyResolve += (sender, request) => {
            var file = Path.Combine(arguments[0], new AssemblyName(request.Name).Name + ".dll");
            return File.Exists(file) ? Assembly.LoadFrom(file) : null;
        };
        try { Run(); return 0; } catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static void Run()
    {
        var getter = typeof(PlayerMovement).GetProperty("nav").GetGetMethod();
        var tick = typeof(Zombie).GetMethod("tick");
        var original = PatchProcessor.GetOriginalInstructions(tick).ToList();
        Check(original.Count(i => i.Calls(getter)) == 1, "The installed game must expose the expected navigation decision.");
        var rewritten = ZombieSpawns.KeepChasing(original).ToList();
        Check(!rewritten.Any(i => i.Calls(getter)), "The original town restriction must be replaced.");
        var replacement = typeof(ZombieSpawns).GetMethod("NavigationForZombie");
        int offset = rewritten.FindIndex(i => i.Calls(replacement));
        Check(offset > 0 && rewritten[offset - 1].opcode == OpCodes.Ldarg_0, "The replacement receives the actual zombie instance.");
        Check(rewritten.Count == original.Count + 1, "All other game instructions must be retained.");
        bool rejected = false;
        try { ZombieSpawns.KeepChasing(new[] { new CodeInstruction(OpCodes.Ret) }).ToArray(); }
        catch (InvalidOperationException) { rejected = true; }
        Check(rejected, "An incompatible game must be rejected rather than patched loosely.");
        Console.WriteLine("Unturned navigation tests passed: actual game IL rewrite, zombie-specific argument, incompatible-version rejection.");
    }

    private static void Check(bool value, string message) { if (!value) throw new Exception(message); }
}
