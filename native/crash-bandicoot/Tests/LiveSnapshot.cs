using System;
using System.Diagnostics;
using System.Collections.Generic;
using ShenPulse.Crash;
class LiveSnapshot
{
    static void Main()
    {
        using (var m = new ProcessMemory(Process.GetProcessesByName("CrashBandicootNSaneTrilogy")[0]))
        {
            var game = new GameSession(m);
            var sites = new Dictionary<string, string>();
            long[] offsets = { 0x589A17, 0xAFAA4C, 0x4A90B0, 0x48E8EF, 0x32B244, 0x32BA20, 0xAFA6F0, 0x4ADD5D, 0x4AD54E, 0x482146, 0x48209C, 0x13A65D0, 0x13A65D4, 0x18BE838, 0x1ABEFC8, 0x1ABEFCC, 0x1ABEFD0 };
            int[] lengths = { 1, 1, 1, 1, 8, 1, 1, 1, 9, 8, 8, 4, 4, 4, 4, 4, 4 };
            for (int i = 0; i < offsets.Length; i++) sites[offsets[i].ToString("X")] = BitConverter.ToString(m.Read(offsets[i], lengths[i]));
            Console.WriteLine(Protocol.Encode(new { state = game.State(), life = game.Count("life"), fruit = game.Count("fruit"), boxes = game.Count("boxes"), sites = sites }));
        }
    }
}
