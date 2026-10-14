// Tests des vraies méthodes privées du protocole, sans BepInEx ni Unity en mémoire.
using System;

namespace ShenPulse.CultOfTheLamb
{
    public sealed partial class ShenPulseCultReliability
    {
        public static int Main()
        {
            Require(ReadLong("{\"duration\":-17}", "duration", 10) == -17);
            Require(ReadLong("{\"DuRaTiOn\":42}", "duration", 10) == 42);
            Require(ReadLong("{}", "duration", 10) == 10);
            Require(ReadLong(null, "duration", 10) == 10);
            Require(JsonEscape(null) == string.Empty);
            Require(JsonEscape("a\r\n\"\\") == "a\\r\\n\\\"\\\\");
            Require(Response(7, 3, "a\n\"", -50) == "{\"id\":7,\"status\":3,\"timeRemaining\":0,\"message\":\"a\\n\\\"\"}");
            Require(RootMessage(new Exception("outer", new Exception("inner"))) == "inner");
            Require(RootMessage(null) == "Erreur inconnue.");
            Console.WriteLine("Cult JSON : 9 assertions reussies.");
            return 0;
        }

        private static void Require(bool condition)
        {
            if (!condition) throw new InvalidOperationException("Regression du protocole Cult.");
        }
    }
}
