using System;
using System.Linq;
using System.Reflection;
using System.Collections.Generic;
using BepInEx;
using BepInEx.Logging;
using Newtonsoft.Json;

namespace ShenPulse.ShopGames {
    // Adaptation des deux modules sans contrôle d’accès tiers. Les modules TCG et
    // Hogwarts à licence distante ne sont ni patchés ni chargés par cet adaptateur.
    public static class Il2CppAdapter {
        private static Transport transport;
        private static Assembly module;
        private static string gameId;
        private static Capture capture;
        private static MethodInfo Method(Type t, string name) { return t.GetMethod(name, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance); }
        private static Type Type(string name) { return module.GetTypes().Single(t => t.Name == name); }
        public static void Start(string id) {
            gameId = id;
            bool shift = id == "shift-at-midnight";
            module = AppDomain.CurrentDomain.GetAssemblies().Single(a => a.GetName().Name == (shift ? "ShenPulse.ShiftAtMidnight.Module" : "ShenPulse.Supermarket.Module"));
            capture = new Capture(); Logger.Listeners.Add(capture);
            Action<Action> enqueue = action => Method(Type(shift ? "ActionQueue" : "ShenPulseComponent"), shift ? "Enqueue" : "RunOnMainThread").Invoke(null, new object[] { action });
            var logger = Logger.CreateLogSource("ShenPulse.Adapter");
            transport = new Transport(System.IO.Path.Combine(Paths.ConfigPath, "ShenPulse." + id + ".json"), id, shift ? 58446 : 58448, enqueue, Execute, text => logger.LogInfo(text));
            transport.Start();
#if SHENPULSE_SHIFT
            if (shift) ShiftRuntime.Start(module, logger);
#endif
#if SHENPULSE_MARKET
            if (!shift) MarketRuntime.Start(module, logger);
#endif
        }
        public static void Stop() {
#if SHENPULSE_SHIFT
            if (gameId == "shift-at-midnight") ShiftRuntime.Stop();
#endif
#if SHENPULSE_MARKET
            if (gameId == "supermarket-simulator") MarketRuntime.Stop();
#endif
            if (transport != null) transport.Dispose(); if (capture != null) Logger.Listeners.Remove(capture); }
        private static Reply Execute(Request request) {
            capture.Begin();
            try { return gameId == "shift-at-midnight" ? Shift(request) : Market(request); }
            finally { capture.End(); }
        }
        private static Reply Shift(Request r) {
#if SHENPULSE_SHIFT
            Reply result = ShiftRuntime.Execute(r, () => DispatchShift(r));
            return r.code != "__status" && capture.Failure != null ? Reply.Unavailable(capture.Failure) : result;
#else
            return DispatchShift(r);
#endif
        }
        public static void Tick() {
#if SHENPULSE_SHIFT
            if (gameId == "shift-at-midnight") ShiftRuntime.Tick();
#endif
#if SHENPULSE_MARKET
            if (gameId == "supermarket-simulator") MarketRuntime.Tick();
#endif
        }
        public static void RecordSpawn(object prefab, object result) {
#if SHENPULSE_SHIFT
            ShiftRuntime.Spawned(prefab, result);
#endif
        }
        public static bool AddViewerLabel(object owner, object anchor, string viewer) {
#if SHENPULSE_SHIFT
            return ShiftRuntime.Name(owner, anchor, viewer);
#else
            return false;
#endif
        }
        private static Reply DispatchShift(Request r) {
            Type actions = Type("GameActions");
            if (r.code == "__status") return new Reply { status = 0, ready = (bool)Method(actions, "Ready").Invoke(null, new object[] { "connexion" }), message = "Module ShenPulse chargé." };
            Type evt = Type("TikTokEvent");
            object input = Activator.CreateInstance(evt);
            evt.GetField("type").SetValue(input, r.code);
            evt.GetField("user").SetValue(input, r.viewer ?? "ShenPulse");
            evt.GetField("count").SetValue(input, Math.Min(20, Math.Max(1, r.quantity)));
            evt.GetField("amount").SetValue(input, (float)r.Number("amount", r.duration));
            evt.GetField("text").SetValue(input, r.Text("text", r.viewer));
            Method(Type("BridgeServer"), "Dispatch").Invoke(null, new object[] { input });
            Type queue = Type("ActionQueue");
            for (int n = 0; n < 8 && (int)queue.GetProperty("PendingCount").GetValue(null) > 0; n++) Method(queue, "Drain").Invoke(null, null);
            return capture.Failure == null ? Reply.Success() : Reply.Unavailable(capture.Failure);
        }
        public static void RegisterTimer(string id, float seconds, Action restore) {
#if SHENPULSE_MARKET
            MarketRuntime.NativeTimer(id, seconds, restore);
#endif
        }
        public static bool ActiveTimer(string id) {
#if SHENPULSE_MARKET
            return MarketRuntime.Active(id);
#else
            return false;
#endif
        }
        public static void QueueCustomers(int count, string viewer) {
#if SHENPULSE_MARKET
            MarketRuntime.QueueCustomers(count, viewer);
#endif
        }
        public static void DrainCustomers() {
#if SHENPULSE_MARKET
            MarketRuntime.DrainCustomers();
#endif
        }
        public static void LabelCustomer(object target, string viewer) {
#if SHENPULSE_MARKET
            MarketRuntime.Label(target, viewer);
#endif
        }
        private static Reply Market(Request r) {
#if SHENPULSE_MARKET
            Reply result = MarketRuntime.Execute(r, DispatchMarket);
            return r.code != "__status" && capture.Failure != null ? Reply.Unavailable(capture.Failure) : result;
#else
            return DispatchMarket(r);
#endif
        }
        private static Reply DispatchMarket(Request r) {
            // Le contrôle de partie se fait sur le thread Unity, comme l’exécution.
            bool ready = MarketReady();
            if (r.code == "__status") return new Reply { status = 0, ready = ready, message = "Module ShenPulse chargé." };
            if (!ready) return Reply.Unavailable("Chargez votre supermarché et fermez les menus avant de lancer cette interaction.");
            Type plugin = Type("ShenPulsePlugin");
            object instance = plugin.GetField("Instance", BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public).GetValue(null);
            object manager = plugin.GetField("_effectManager", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(instance);
            object catalog = manager.GetType().GetField("_effects", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(manager);
            if (!(bool)Method(catalog.GetType(), "ContainsKey").Invoke(catalog, new object[] { r.code })) return new Reply { status = 2, message = "Interaction Supermarket inconnue." };
            object definition = catalog.GetType().GetProperty("Item").GetValue(catalog, new object[] { r.code });
            int maximum = (int)definition.GetType().GetField("MaxCount").GetValue(definition);
            string raw = (string)Method(manager.GetType(), "Execute").Invoke(manager, new object[] { r.code, r.viewer ?? "ShenPulse", Math.Min(maximum, Math.Max(1, r.quantity)) });
            var result = JsonConvert.DeserializeObject<Dictionary<string, object>>(raw);
            if (result == null || !result.ContainsKey("success") || !Convert.ToBoolean(result["success"])) return new Reply { status = 2, message = result != null && result.ContainsKey("error") ? Convert.ToString(result["error"]) : "Effet refusé par le jeu." };
            var queue = (Queue<Action>)Type("ShenPulseComponent").GetField("_mainThreadQueue", BindingFlags.Static | BindingFlags.NonPublic).GetValue(null);
            for (int n = 0; n < 256; n++) {
                Action action;
                lock (queue) { if (queue.Count == 0) break; action = queue.Dequeue(); }
                action();
            }
            // Certaines opérations sont encore différées par le jeu après cette
            // file (arrivée d'un client, livraison, temporisation). L'acquittement
            // ne garantit donc pas leur résultat final à l'écran.
            return capture.Failure == null ? new Reply { status = 0, executionConfirmed = false, message = "Commande acceptée par le module du jeu." } : Reply.Unavailable(capture.Failure);
        }
        private static bool MarketReady() {
            var game = AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a => a.GetName().Name == "Assembly-CSharp");
            if (game == null) return false;
            var type = game.GetTypes().FirstOrDefault(t => t.Name == "PlayerInteraction");
            var unity = AppDomain.CurrentDomain.GetAssemblies().FirstOrDefault(a => a.GetName().Name == "UnityEngine.CoreModule");
            var obj = unity == null ? null : unity.GetType("UnityEngine.Object");
            var find = obj == null ? null : obj.GetMethods().FirstOrDefault(m => m.Name == "FindObjectOfType" && m.IsGenericMethodDefinition && m.GetGenericArguments().Length == 1 && m.GetParameters().Length == 0);
            return type != null && find != null && find.MakeGenericMethod(type).Invoke(null, null) != null;
        }
        private sealed class Capture : ILogListener {
            public LogLevel LogLevelFilter { get { return LogLevel.All; } }
            private bool active;
            public string Failure;
            public void Begin() { Failure = null; active = true; }
            public void End() { active = false; }
            public void LogEvent(object sender, LogEventArgs e) {
                if (!active || !e.Source.SourceName.Contains("ShenPulse")) return;
                string message = Convert.ToString(e.Data);
                bool refused = message.IndexOf("sans effet", StringComparison.OrdinalIgnoreCase) >= 0 || message.IndexOf("ignore :", StringComparison.OrdinalIgnoreCase) >= 0;
                if (!refused && (e.Level & (LogLevel.Error | LogLevel.Fatal | LogLevel.Warning)) == 0) return;
                if (Failure == null) Failure = Convert.ToString(e.Data);
            }
            public void Dispose() {}
        }
    }
}
