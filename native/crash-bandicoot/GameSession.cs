using System;
using System.Text;

namespace ShenPulse.Crash
{
    public sealed class GameSession
    {
        public readonly IMemory Memory;
        public GameSession(IMemory memory) { Memory = memory; }
        public long Follow(long address, long addition)
        {
            long pointer = BitConverter.ToInt64(Memory.Read(address, 8), 0);
            if (pointer < 0x10000 || pointer > 0x7FFFFFFFFFFF) throw new InvalidOperationException("Le niveau n’est pas encore disponible.");
            return checked(-pointer - addition);
        }
        public string State()
        {
            try
            {
                if (Memory.Read(Follow(Follow(0x1AAC858, 0x80), 0), 1)[0] == 0) return "Chargement en cours.";
                if (Memory.Read(Follow(0x1A61CF8, 0x59), 1)[0] != 0) return "Le jeu est en pause.";
                if ((Memory.Read(0x1A83178, 1)[0] & 0x22) == 0) return "Le personnage n’est pas contrôlable.";
                var bytes = Memory.Read(0x1A5C6E0, 64);
                int end = Array.IndexOf(bytes, (byte)0);
                string level = Encoding.ASCII.GetString(bytes, 0, end < 0 ? bytes.Length : end);
                if (!level.StartsWith("crash", StringComparison.Ordinal) || level.Contains("_hub"))
                    return "Ouvrez un niveau jouable, hors du menu et de la salle de téléportation.";
                return null;
            }
            catch (Exception) { return "Le niveau n’est pas encore disponible."; }
        }
        public long Counter(string name)
        {
            if (name == "life") return Follow(0x1AA27C8, 0x10);
            long table = Follow(Follow(Follow(Follow(Follow(0x1A69A98, 0x20), 0x21F8), 0x10), 0x18), 0);
            long offset = name == "fruit" ? 0x5F0 : name == "boxes" ? 0x6B8 : 0x610;
            return Follow(table - offset, 0x10);
        }
        public int Count(string name) { return BitConverter.ToInt32(Memory.Read(Counter(name), 4), 0); }
    }
}
