using System;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace ShenPulse.Unturned
{
    public sealed class Parameters
    {
        public int assetId;
        public float value = 25;
        public float radius = 8;
        public float force = 10;
        public int speciality = 1;
    }

    public sealed class Request
    {
        public int id;
        public int type;
        public string code;
        public int quantity = 1;
        public Parameters parameters = new Parameters();
    }

    public sealed class Reply
    {
        public int id;
        public int type = 0;
        public int status;
        public string message;
    }

    public static class Protocol
    {
        public static readonly string[] Codes = {
            "spawn_enemy", "spawn_animals", "spawn_vehicles", "give_item", "drop_item",
            "heal", "food", "water", "virus", "stamina", "oxygen", "kill_all_zombies",
            "kill_all_animals", "day", "night", "set_time", "add_experience", "airdrop",
            "inventory_shuffle", "drop_all_items", "break_item", "repair_item", "item_rain",
            "respawn", "slap", "set_weather", "boom"
        };

        public static Request Decode(string json, out int id)
        {
            id = 0;
            if (json == null || json.Length > 65536) throw new ArgumentException("Requête trop longue.");
            JObject data;
            using (var text = new StringReader(json))
            using (var reader = new JsonTextReader(text) { MaxDepth = 8 })
            {
                data = JObject.Load(reader);
                if (reader.Read()) throw new ArgumentException("Une seule requête est autorisée par trame.");
            }
            if (data["id"] != null && data["id"].Type == JTokenType.Integer) id = data["id"].Value<int>();
            if (data["quantity"] != null && data["quantity"].Type != JTokenType.Integer)
                throw new ArgumentException("La quantité doit être un nombre entier.");
            var request = data.ToObject<Request>(JsonSerializer.Create(new JsonSerializerSettings {
                TypeNameHandling = TypeNameHandling.None, MaxDepth = 8, MissingMemberHandling = MissingMemberHandling.Ignore
            }));
            if (request == null || id < 1 || request.type != 1 || Array.IndexOf(Codes, request.code) < 0)
                throw new ArgumentException("Interaction Unturned inconnue ou requête invalide.");
            if (request.quantity < 1 || request.quantity > 50)
                throw new ArgumentException("La quantité doit être comprise entre 1 et 50.");
            var p = request.parameters;
            if (p == null) throw new ArgumentException("Paramètres manquants.");
            Range(p.value, -100000, 100000); Range(p.radius, 1, 30); Range(p.force, 1, 30);
            if (p.assetId < 0 || p.assetId > 65535 || p.speciality < 1 || p.speciality > 24)
                throw new ArgumentException("Identifiant d’objet ou type de zombie invalide.");
            switch (request.code)
            {
                case "heal": case "food": case "water": case "virus": case "stamina": case "oxygen":
                    Range(p.value * request.quantity, -100, 100); break;
                case "set_time": Range(p.value, 0, 100); break;
                case "set_weather": Range(p.value, 0, 2); if (p.value != (int)p.value) throw new ArgumentException("Météo invalide."); break;
                case "add_experience": Range(p.value * request.quantity, -100000, 100000); break;
                case "boom": Range(p.value, 1, 100); break;
            }
            return request;
        }

        private static void Range(float value, float min, float max)
        {
            if (float.IsNaN(value) || float.IsInfinity(value) || value < min || value > max)
                throw new ArgumentException("Paramètre hors des limites autorisées.");
        }
    }
}
