using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using BepInEx.Logging;
using HarmonyLib;
using Fusion;
using Il2CppInterop.Runtime;
using Il2CppInterop.Runtime.InteropTypes;
using TMPro;
using UnityEngine;
using Object = UnityEngine.Object;
namespace ShenPulse.ShopGames {
    internal static class ShiftRuntime {
        private sealed class Label { public GameObject owner; public TMP_Text text; public bool initiallyActive; }
        private sealed class Awaiting { public long prefab; public string viewer; public double until; }
        private static readonly System.Diagnostics.Stopwatch clock = System.Diagnostics.Stopwatch.StartNew();
        private static readonly QueuedViewerNames queued = new QueuedViewerNames();
        private static readonly Dictionary<long, Label> labels = new Dictionary<long, Label>();
        private static readonly List<Awaiting> awaiting = new List<Awaiting>();
        private static readonly HashSet<string> Codes = new HashSet<string>(("spawn_mystery spawn_human spawn_doppel spawn_thief spawn_rat spawn_roach spawn_monster spawn_pet funds blackout stuck_player heal_player damage_player tax wheel_token spawn_nuisance panic surprise_delivery spawn_box blood_delivery spawn_item red_fog empty_shelves trapped_parcel invert_camera inventory_max inventory_min search_name break_barricade trigger_trap dumpster_monster spawn_clones exorcise slow_motion fast_forward reset_effects").Split(' '));
        private static readonly HashSet<string> QueuedCodes = new HashSet<string>(new[] { "spawn_mystery", "spawn_human", "spawn_doppel" });
        private static Type actions;
        private static ManualLogSource log;
        private static Harmony harmony;
        private static TemporaryEffects temporary;
        private static string currentSpawnViewer;
        private static long scene;
        private static int day = -1;
        private static float? pendingScale;
        private static bool previousRunInBackground;
        private const BindingFlags Members = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;
        private static double Now { get { return clock.Elapsed.TotalSeconds; } }
        private static object Invoke(string method, params object[] args) { return actions.GetMethod(method, Members).Invoke(null, args); }
        private static object Field(string name) { return actions.GetField(name, Members).GetValue(null); }
        private static void Field(string name, object value) { actions.GetField(name, Members).SetValue(null, value); }
        private static bool Alive(Il2CppObjectBase value) { return value != null && !value.WasCollected && (!(value is Object) || (Object)value != null); }
        private static T[] All<T>() where T : Component {
            var result = new List<T>();
            foreach (Object raw in Resources.FindObjectsOfTypeAll(Il2CppType.Of<T>())) {
                T item = raw.TryCast<T>();
                if (Alive(item) && item.gameObject.scene.IsValid()) result.Add(item);
            }
            return result.ToArray();
        }
        private static PlayerManager Player() { return (PlayerManager)Invoke("LocalPlayer"); }
        private static Camera Camera() { return (Camera)Invoke("PlayerCamera"); }
        private static object Observe(Func<object> read) { try { return read(); } catch { return null; } }
        public static void Start(Assembly module, ManualLogSource logger) {
            actions = module.GetTypes().Single(type => type.Name == "GameActions"); log = logger;
            temporary = new TemporaryEffects(() => Now, key => log.LogInfo("Fin de l’effet " + key), (key, error) => log.LogWarning("Restauration " + key + " : " + error.Message));
            previousRunInBackground = Application.runInBackground; Application.runInBackground = true;
            harmony = new Harmony("com.shenpulse.shiftatmidnight.reliability");
            harmony.Patch(typeof(CurrentDayManager).GetMethod("ActuallySpawnNPC"), prefix: new HarmonyMethod(typeof(ShiftRuntime), "BeforeNpc"));
        }
        public static void Stop() { if (temporary != null) temporary.Reset(); if (harmony != null) harmony.UnpatchSelf(); ClearNames(); Application.runInBackground = previousRunInBackground; }
        private static void BeforeNpc(CurrentDayManager __instance) {
            try {
                int index = __instance.npcIndex;
                if (__instance.todaysNpcs == null || index < 0 || index >= __instance.todaysNpcs.Count) return;
                Npc npc = __instance.todaysNpcs[index];
                if (!Alive(npc) || !Alive(npc.prefab)) return;
                long prefab = npc.prefab.Pointer.ToInt64();
                string viewer = queued.Consume(index, prefab);
                if (!string.IsNullOrWhiteSpace(viewer)) awaiting.Add(new Awaiting { prefab = prefab, viewer = viewer, until = Now + 120 });
            } catch (Exception error) { log.LogWarning("Attribution du prochain client : " + error.Message); }
        }
        public static void Spawned(object rawPrefab, object rawResult) {
            try {
                var prefab = rawPrefab as NetworkObject; var result = rawResult as NetworkObject;
                if (!Alive(prefab) || !Alive(result)) return;
                long key = prefab.gameObject.Pointer.ToInt64();
                Awaiting match = awaiting.FirstOrDefault(item => item.until > Now && item.prefab == key);
                string viewer = match == null ? currentSpawnViewer : match.viewer;
                if (match != null) awaiting.Remove(match);
                if (!string.IsNullOrWhiteSpace(viewer)) Name(result.gameObject, null, viewer);
            } catch (Exception error) { log.LogWarning("Nom à l’apparition : " + error.Message); }
        }
        public static bool Name(object rawOwner, object rawAnchor, string viewer) {
            var owner = rawOwner as GameObject; var anchor = rawAnchor as Transform;
            if (!Alive(owner) || string.IsNullOrWhiteSpace(viewer)) return false;
            long key = owner.Pointer.ToInt64(); Label label;
            if (!labels.TryGetValue(key, out label) || !Alive(label.text)) {
                var holder = new GameObject("ShenPulse - nom du donateur");
                holder.transform.SetParent(owner.transform, false);
                holder.transform.position = Alive(anchor) ? anchor.position + Vector3.up * .45f : owner.transform.position + Vector3.up * 2.3f;
                var text = holder.AddComponent<TextMeshPro>();
                TMP_FontAsset font = TMP_Settings.defaultFontAsset;
                if (font != null) text.font = font;
                text.fontSize = 2.5f; text.alignment = TextAlignmentOptions.Center; text.color = Color.white;
                text.rectTransform.sizeDelta = new Vector2(10, 1.2f); text.enableWordWrapping = false;
                text.overflowMode = TextOverflowModes.Overflow; text.richText = false;
                label = new Label { owner = owner, text = text, initiallyActive = owner.activeInHierarchy };
                labels[key] = label;
            }
            string name = viewer.Trim(); int length = Math.Min(48, name.Length);
            if (length < name.Length && char.IsHighSurrogate(name[length - 1])) length--;
            label.text.text = name.Substring(0, length);
            return true;
        }
        private static void ClearNames() {
            foreach (Label label in labels.Values) if (Alive(label.text)) Object.Destroy(label.text.gameObject);
            labels.Clear(); queued.Clear(); awaiting.Clear();
        }
        public static void Tick() {
            if (temporary == null) return;
            temporary.Tick();
            if (pendingScale.HasValue && Time.timeScale > 0) { Time.timeScale = pendingScale.Value; pendingScale = null; }
            CurrentDayManager current = CurrentDayManager.Instance;
            long pointer = Alive(current) ? current.Pointer.ToInt64() : 0;
            if (pointer != scene || (pointer != 0 && current.curDay != day)) {
                temporary.Reset(); ClearNames(); scene = pointer; day = pointer == 0 ? -1 : current.curDay;
            }
            awaiting.RemoveAll(item => item.until <= Now);
            Camera camera = Camera();
            foreach (var pair in labels.ToArray()) {
                Label label = pair.Value;
                if (!Alive(label.owner) || !Alive(label.text) || (label.initiallyActive && !label.owner.activeInHierarchy)) {
                    if (Alive(label.text)) Object.Destroy(label.text.gameObject);
                    labels.Remove(pair.Key); continue;
                }
                if (label.owner.activeInHierarchy) label.initiallyActive = true;
                if (Alive(camera)) label.text.transform.rotation = camera.transform.rotation;
            }
        }
        public static object Snapshot() {
            var current = CurrentDayManager.Instance;
            PlayerManager player = Player();
            var store = StoreManager.Instance;
            return new {
                host = Observe(() => FusionNetworkManager.Instance.GetRunner().IsServer), nightActive = Alive(current) && current.startedDay,
                day = Alive(current) ? current.curDay : -1, npcIndex = Alive(current) ? current.npcIndex : -1,
                occurrence = Alive(current) ? current.curOccurrence : -1,
                queuedNpcs = Alive(current) && current.todaysNpcs != null ? current.todaysNpcs.Count : 0,
                revenue = Alive(store) ? (object)store.actualRevenue : null,
                health = Alive(player) ? (object)player.health : null, maxHealth = Alive(player) ? (object)player.maxHealth : null,
                playerStuck = Alive(player) && player.stuck, playerDead = !Alive(player) || player.dead,
                inventorySlots = Observe(() => SaveManager.Instance.maxInventorySpace),
                scale = Time.timeScale, focused = Application.isFocused, runInBackground = Application.runInBackground,
                fog = RenderSettings.fog, fogDensity = RenderSettings.fogDensity, cameraFlipped = Field("_flipActive"),
                shelves = Observe(() => All<RestockShelf>().Where(shelf => !shelf.tutorialShelf).Select(shelf => new { id = shelf.Pointer.ToInt64(), count = shelf.productsOnShelf, capacity = shelf.maxProductsOnShelf }).ToArray()),
                nuisanceCustomers = All<NuisanceCustomer>().Length,
                namedCustomers = labels.Values.Count(label => Alive(label.owner) && Alive(label.text) && label.owner.activeInHierarchy),
                customerLabels = labels.Where(pair => Alive(pair.Value.owner) && Alive(pair.Value.text) && pair.Value.owner.activeInHierarchy).Select(pair => new { actor = pair.Key, viewer = pair.Value.text.text }).ToArray(),
                queuedViewerNames = queued.Count, pendingViewerSpawns = awaiting.Count,
                timedEffects = temporary.Keys.Select(key => new { effect = key, remainingSeconds = Math.Ceiling(temporary.Remaining(key)) }).ToArray()
            };
        }
        private static void RestoreSpeed(float value, string viewer) {
            Field("_speedRestoreAt", 0f);
            if (Time.timeScale <= 0) { pendingScale = value; return; }
            Invoke("ChangeGameSpeed", value, 1f, viewer);
            Field("_speedRestoreAt", 0f);
        }
        public static Reply Execute(Request request, Func<Reply> dispatch) {
            Tick();
            if (request.code == "__status") return new Reply { status = 0, ready = (bool)Invoke("Ready", "connexion"), metadata = Snapshot() };
            if (!Codes.Contains(request.code)) return new Reply { status = 2, message = "Interaction Shift At Midnight inconnue." };
            if (request.code == "reset_effects") { temporary.Reset(); return new Reply { status = 0, executionConfirmed = true, message = "Effets temporaires rétablis.", metadata = Snapshot() }; }
            if (!(bool)Invoke("Ready", "interaction ShenPulse")) return Reply.Unavailable("Chargez le magasin dans une partie solo ou hébergée par vous.");
            if (Time.timeScale <= 0) return Reply.Unavailable("Reprenez la partie avant de lancer cette interaction.");
            float seconds = (float)Math.Clamp(request.duration > 0 ? request.duration : request.Number("duree", request.code == "stuck_player" ? 6 : request.code == "slow_motion" || request.code == "fast_forward" ? 20 : 10), 1, 120);
            string viewer = string.IsNullOrWhiteSpace(request.viewer) ? "ShenPulse" : request.viewer;
            Reply response;
            switch (request.code) {
                case "slow_motion": case "fast_forward": {
                    float original = Time.timeScale;
                    float factor = (float)Math.Clamp(request.Number("facteur", request.code == "slow_motion" ? .5 : 1.5), .25, 2);
                    temporary.Run("speed", seconds, () => { Invoke("ChangeGameSpeed", factor, seconds, viewer); Field("_speedRestoreAt", float.MaxValue); }, () => RestoreSpeed(original, viewer));
                    break;
                }
                case "stuck_player": {
                    PlayerManager player = Player();
                    if (!Alive(player) || player.dead) return Reply.Unavailable("Le joueur doit être vivant et contrôlable.");
                    if (player.stuck && !temporary.Active("stuck")) return Reply.Unavailable("Le joueur est déjà bloqué par le jeu. Libérez-le avant cet effet.");
                    temporary.Run("stuck", seconds, () => { if (!player.stuck) Invoke("StuckPlayer", 1f, viewer); }, () => { if (Alive(player) && player.stuck) player.GetUnstuck(); });
                    break;
                }
                case "invert_camera": {
                    Camera camera = Camera(); if (!Alive(camera)) return Reply.Unavailable("La caméra du joueur est indisponible.");
                    Matrix4x4 original = camera.projectionMatrix;
                    temporary.Run("camera", seconds, () => { Invoke("InvertCamera", seconds, viewer); Field("_flipEndAt", float.MaxValue); }, () => { Field("_flipActive", false); if (Alive(camera)) camera.projectionMatrix = original; });
                    break;
                }
                case "red_fog":
                    temporary.Run("fog", seconds, () => { Invoke("RedFog", seconds, (float)Math.Clamp(request.Number("densite", .08), .01, .4), viewer); Field("_fogRestoreAt", float.MaxValue); }, () => { Field("_fogRestoreAt", 0f); Invoke("TickFog"); }); break;
                default: {
                    CurrentDayManager current = CurrentDayManager.Instance;
                    bool queuedCustomer = QueuedCodes.Contains(request.code);
                    if (queuedCustomer && !current.startedDay) return Reply.Unavailable("Commencez la nuit pour ajouter un client.");
                    int before = current.todaysNpcs == null ? 0 : current.todaysNpcs.Count;
                    int index = current.npcIndex;
                    currentSpawnViewer = request.code == "spawn_thief" || request.code == "spawn_nuisance" ? viewer : null;
                    try { response = dispatch(); } finally { currentSpawnViewer = null; }
                    if (response.status != 0) return response;
                    if (queuedCustomer && current.todaysNpcs != null && current.todaysNpcs.Count > before) {
                        int count = current.todaysNpcs.Count - before; int at = Math.Clamp(index, 0, before);
                        var prefabs = new long[count];
                        for (int n = 0; n < count; n++) prefabs[n] = current.todaysNpcs[at + n].prefab.Pointer.ToInt64();
                        queued.Insert(at, prefabs, viewer);
                    }
                    response.executionConfirmed = false;
                    response.message = queuedCustomer ? "Client ajouté à la file de nuit ; son nom sera affiché à son arrivée." : "Commande acceptée par le module du jeu.";
                    response.metadata = Snapshot(); return response;
                }
            }
            response = Reply.Success(); response.metadata = Snapshot(); return response;
        }
    }
}
