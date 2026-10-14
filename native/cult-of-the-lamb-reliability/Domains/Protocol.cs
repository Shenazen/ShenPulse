// Domaine Protocol : meme classe plugin, methodes et champs conserves.
using System;
using System.Text.RegularExpressions;

namespace ShenPulse.CultOfTheLamb
{
    public sealed partial class ShenPulseCultReliability
    {
        private static long ReadLong(
            string json,
            string property,
            long fallback
        )
        {
            Match match = Regex.Match(
                json ?? string.Empty,
                "\""
                    + Regex.Escape(property)
                    + "\"\\s*:\\s*(-?[0-9]+)",
                RegexOptions.IgnoreCase
            );
            long value;
            return match.Success
                && long.TryParse(match.Groups[1].Value, out value)
                    ? value
                    : fallback;
        }

        private static string Response(
            uint id,
            int status,
            string message,
            long timeRemaining
        )
        {
            return "{\"id\":"
                + id
                + ",\"status\":"
                + status
                + ",\"timeRemaining\":"
                + Math.Max(0, timeRemaining)
                + ",\"message\":\""
                + JsonEscape(message)
                + "\"}";
        }

        private static string JsonEscape(string value)
        {
            return (value ?? string.Empty)
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n");
        }

        private static string RootMessage(Exception error)
        {
            Exception current = error;
            while (current != null && current.InnerException != null)
            {
                current = current.InnerException;
            }
            return current == null
                ? "Erreur inconnue."
                : current.Message;
        }
    }
}
