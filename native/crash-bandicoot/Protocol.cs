using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;

namespace ShenPulse.Crash
{
    public sealed class Request
    {
        public int id, quantity, duration;
        public string code;
    }
    public sealed class Reply
    {
        public int id, type = 0, status;
        public string message;
    }
    public static class Protocol
    {
        static JavaScriptSerializer Serializer() { return new JavaScriptSerializer { MaxJsonLength = 65536, RecursionLimit = 12 }; }
        public static string Encode(object value) { return Serializer().Serialize(value); }
        static int Number(Dictionary<string, object> data, string key, int fallback)
        {
            object value;
            if (!data.TryGetValue(key, out value)) return fallback;
            if (!(value is int)) throw new ArgumentException("Entier attendu : " + key);
            return (int)value;
        }
        public static Request Decode(string json, out int id)
        {
            id = 0;
            var data = Serializer().DeserializeObject(json) as Dictionary<string, object>;
            if (data == null) throw new ArgumentException("Requête invalide.");
            id = Number(data, "id", 0);
            if (id <= 0 || Number(data, "type", 1) != 1) throw new ArgumentException("Identifiant ou type invalide.");
            object code;
            if (!data.TryGetValue("code", out code) || !(code is string)) throw new ArgumentException("Code absent.");
            string text = (string)code;
            if (text != "__status" && text != "__stop" && Array.IndexOf(Recipes.Counters, text) < 0 && Recipes.For(text) == null)
                throw new ArgumentException("Interaction inconnue.");
            var request = new Request { id = id, code = text, quantity = Number(data, "quantity", 1), duration = Number(data, "duration", 0) };
            if (request.duration < 0 || request.duration > 600 || request.quantity < 1 || request.quantity > 255) throw new ArgumentException("Paramètre hors limites.");
            return request;
        }
    }
}
