using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Concurrent;
using BepInEx;
using HarmonyLib;
using UnityEngine;
using Object = UnityEngine.Object;

namespace ShenPulse.ShopGames {
    [BepInPlugin("com.shenpulse.tcg", "ShenPulse TCG Card Shop Simulator", "1.0.4")]
    public sealed class TcgPlugin : BaseUnityPlugin {
        private readonly ConcurrentQueue<Action> jobs = new ConcurrentQueue<Action>();
        private TemporaryEffects temporary;
        private readonly System.Diagnostics.Stopwatch clock = System.Diagnostics.Stopwatch.StartNew();
        private float? pendingTimeScale;
        private int lastBoxesAffected;
        private readonly Dictionary<Component, TextMesh> viewerLabels = new Dictionary<Component, TextMesh>();
        private readonly Dictionary<Component, object> customerSpeeds = new Dictionary<Component, object>();
        private CustomerAttribution<Component> attribution;
        private Harmony customerHooks;
        private static TcgPlugin active;
        private float customerSpeedFactor;
        private readonly Dictionary<string, Type> types = new Dictionary<string, Type>();
        private Font viewerFont;
        private Transport transport;
        private Assembly game;
        private bool previousRunInBackground, ownsBackgroundSetting;
        private const BindingFlags Members = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance | BindingFlags.FlattenHierarchy;
        private void Awake() {
            game = AppDomain.CurrentDomain.GetAssemblies().Single(a => a.GetName().Name == "Assembly-CSharp");
            attribution = new CustomerAttribution<Component>(Label, ClearLabel, () => clock.Elapsed.TotalSeconds);
            temporary = new TemporaryEffects(() => clock.Elapsed.TotalSeconds,
                key => { attribution.Stop(key); Logger.LogInfo("Fin de l’effet " + key); },
                (key, error) => Logger.LogWarning("Restauration " + key + " : " + error.Message));
            active = this;
            customerHooks = new Harmony("com.shenpulse.tcg.customers");
            customerHooks.Patch(T("Customer").GetMethod("ActivateCustomer", Members), postfix: new HarmonyMethod(typeof(TcgPlugin), "CustomerActivated"));
            customerHooks.Patch(T("Customer").GetMethod("DeactivateCustomer", Members), postfix: new HarmonyMethod(typeof(TcgPlugin), "CustomerDeactivated"));
            transport = new Transport(Path.Combine(Paths.ConfigPath, "ShenPulse.tcg-card-shop-simulator.json"), "tcg-card-shop-simulator", 58447, a => jobs.Enqueue(a), Execute, s => Logger.LogInfo(s));
            transport.Start();
            previousRunInBackground = Application.runInBackground;
            Application.runInBackground = true;
            ownsBackgroundSetting = true;
            Logger.LogInfo("Exécution en arrière-plan activée (précédemment : " + previousRunInBackground + ").");
        }
        private void Update() {
            temporary.Tick();
            if (pendingTimeScale.HasValue && Time.timeScale > 0) { Time.timeScale = pendingTimeScale.Value; pendingTimeScale = null; }
            Action action;
            for (int i = 0; i < 4 && jobs.TryDequeue(out action); i++) action();
            temporary.Tick();
            Camera camera = viewerLabels.Count > 0 ? PlayerCamera() : null;
            foreach (var pair in viewerLabels.ToArray()) {
                TextMesh label = pair.Value;
                if (pair.Key == null || label == null || !IsActiveCustomer(pair.Key)) { ClearLabel(pair.Key); continue; }
                if (camera != null) label.transform.rotation = camera.transform.rotation;
            }
        }
        private void OnDestroy() {
            if (transport != null) transport.Dispose();
            Reset();
            foreach (Component customer in viewerLabels.Keys.ToArray()) ClearLabel(customer);
            if (customerHooks != null) customerHooks.UnpatchSelf();
            if (active == this) active = null;
            if (ownsBackgroundSetting) Application.runInBackground = previousRunInBackground;
        }
        private static void CustomerActivated(Component __instance) {
            if (active == null) return;
            try { active.attribution.Activated(__instance); active.ApplyCustomerSpeed(__instance); }
            catch (Exception e) { active.Logger.LogWarning("Nom/vitesse du client : " + e.Message); }
        }
        private static void CustomerDeactivated(Component __instance) {
            if (active == null) return;
            try { active.attribution.Deactivated(__instance); active.RestoreCustomerSpeed(__instance); }
            catch (Exception e) { active.Logger.LogWarning("Départ du client : " + e.Message); }
        }
        private Type T(string name) {
            Type value;
            if (types.TryGetValue(name, out value)) return value;
            value = game.GetTypes().FirstOrDefault(t => t.Name == name) ?? throw new InvalidOperationException("API du jeu absente : " + name);
            types[name] = value; return value;
        }
        private object Instance(string type) { var value = Object.FindObjectOfType(T(type)); if (value == null) throw new InvalidOperationException("Chargez une partie : " + type + " indisponible."); return value; }
        private object Get(object target, string name) {
            Type type = target as Type ?? target.GetType(); object instance = target is Type ? null : target;
            FieldInfo field = type.GetField(name, Members); if (field != null) return field.GetValue(instance);
            PropertyInfo property = type.GetProperty(name, Members); if (property != null) return property.GetValue(instance, null);
            throw new MissingMemberException(type.Name, name);
        }
        private void Set(object target, string name, object value) {
            Type type = target as Type ?? target.GetType(); object instance = target is Type ? null : target;
            FieldInfo field = type.GetField(name, Members); if (field == null) throw new MissingFieldException(type.Name, name);
            field.SetValue(instance, Convert.ChangeType(value, field.FieldType));
        }
        private object Call(object target, string name, params object[] arguments) {
            Type type = target as Type ?? target.GetType();
            var methods = type.GetMethods(Members).Where(m => m.Name == name && m.GetParameters().Length == arguments.Length && !m.ContainsGenericParameters);
            foreach (MethodInfo method in methods) {
                var parameters = method.GetParameters(); object[] converted = new object[arguments.Length]; bool match = true;
                for (int n = 0; n < arguments.Length; n++) {
                    object value = arguments[n]; Type expected = parameters[n].ParameterType;
                    try { converted[n] = value == null || expected.IsInstanceOfType(value) ? value : expected.IsEnum ? Enum.ToObject(expected, value) : Convert.ChangeType(value, expected); }
                    catch { match = false; break; }
                }
                if (match && (!(target is Type) || method.IsStatic)) return method.Invoke(method.IsStatic ? null : target, converted);
            }
            throw new MissingMethodException(type.Name, name);
        }
        private object Global(string type, string method, params object[] args) {
            try { return Call(T(type), method, args); } catch (MissingMethodException) { return Call(Instance(type), method, args); }
        }
        private List<object> List(object value) { var items = value as IEnumerable; return items == null ? new List<object>() : items.Cast<object>().Where(o => o != null).ToList(); }
        private double N(Request r, string name, double fallback) { return r.Number(name, fallback); }
        private void Event(string type, params object[] args) { Call(T("CEventManager"), "QueueEvent", Activator.CreateInstance(T(type), args)); }
        private void Timed(string key, float seconds, Action apply, Action restore, object baseline = null) { temporary.Run(key, seconds, apply, restore, baseline); }
        private void Reset() { if (temporary != null) temporary.Reset(); }
        private Reply Execute(Request r) {
            object player = Object.FindObjectOfType(T("InteractionPlayerController"));
            bool loaded = player != null;
            // Le mode UI est aussi utilisé à la caisse et par l'immobilisation.
            // Il ne doit pas bloquer les autres interactions pendant ces actions.
            bool ready = loaded && Time.timeScale > 0;
            if (r.code == "__status") return new Reply { status = 0, ready = ready, metadata = loaded ? Snapshot() : null };
            if (r.code == "tout_annuler") { Reset(); return Reply.Success("Effets temporaires rétablis."); }
            if (!ready) return Reply.Unavailable("Chargez la boutique et fermez les menus avant de lancer une interaction.");
            float seconds = Mathf.Clamp((float)(r.duration > 0 ? r.duration : N(r, "duree", r.code == "bloque" ? 6 : 20)), 1, 120);
            int count = Math.Min(10, Math.Max(1, r.quantity));
            switch (r.code) {
                case "argent_plus": case "jackpot": Event("CEventPlayer_AddCoin", (float)(N(r, "montant", r.code == "jackpot" ? 5000 : 100) * count), false); break;
                case "argent_moins": Event("CEventPlayer_ReduceCoin", (float)Math.Abs(N(r, "montant", 100) * count), false); break;
                case "xp_boutique": Event("CEventPlayer_AddShopExp", (int)(N(r, "montant", 200) * count), false); break;
                case "faillite": Event("CEventPlayer_ReduceCoin", Convert.ToSingle(Get(T("CPlayerData"), "m_CoinAmountDouble")), false); break;
                case "clients": case "foule": case "client_puant": case "viewer_client": case "reputation": {
                    int total = (int)Math.Min(20, N(r, "nombre", r.code == "foule" ? 10 : r.code == "clients" ? 3 : 1) * count);
                    for (int i = 0; i < total; i++) {
                        object customer = Global("CustomerManager", "GetNewCustomerPrefab", r.code == "client_puant");
                        if (customer == null) throw new InvalidOperationException("Aucun client disponible dans cette journée.");
                        Call(Instance("CustomerManager"), "UpdateCustomerCount", 1);
                        Call(customer, "ActivateCustomer", r.code == "client_puant", true);
                        ((Component)customer).gameObject.SetActive(true);
                        if (r.code == "client_puant") Call(customer, "SetSmelly");
                        attribution.Name((Component)customer, r.viewer);
                    }
                    break;
                }
                case "clients_rapides": case "clients_lents": case "employes_rapides": case "employes_lents": {
                    bool workers = r.code.StartsWith("employes");
                    if (!workers) { CustomerSpeed(r, seconds); break; }
                    var actors = List(Global(workers ? "WorkerManager" : "CustomerManager", workers ? "GetWorkerList" : "GetCustomerList"));
                    if (actors.Count == 0) throw new InvalidOperationException("Aucun personnage disponible.");
                    var saved = actors.Select(a => new KeyValuePair<object, object>(a, Get(a, "m_ExtraSpeedMultiplier"))).ToArray();
                    float factor = (float)N(r, "facteur", r.code.EndsWith("lents") ? 0.35 : 4);
                    Timed(workers ? "workers" : "customers", seconds, () => { foreach (var a in saved) Call(a.Key, "SetExtraSpeedMultiplier", factor); }, () => { foreach (var a in saved) Set(a.Key, "m_ExtraSpeedMultiplier", a.Value); });
                    break;
                }
                case "appoint": case "file_appoint":
                    TemporaryField("change", Instance("CustomerManager"), "m_CustomerExactChangeChance", r.code == "appoint" ? 0 : 100, seconds);
                    attribution.Track("change", r.viewer, temporary.Deadline("change"), true, ActiveCustomers()); break;
                case "rush":
                    TemporaryField("rush", Instance("CustomerManager"), "m_TimePerCustomer", 1.2f, seconds);
                    attribution.Track("rush", r.viewer, temporary.Deadline("rush"), true, new Component[0]); break;
                case "temps_rapide": TemporaryField("clock", Instance("LightManager"), "m_TimerLerpSpeed", (float)N(r, "facteur", 3), seconds); break;
                case "joueur_rapide": case "joueur_lent": {
                    object walker = Get(Instance("InteractionPlayerController"), "m_WalkerCtrl");
                    float speed = Convert.ToSingle(temporary.Baseline("walk", () => Get(walker, "movementSpeed")));
                    TemporaryField("walk", walker, "movementSpeed", speed * (float)N(r, "facteur", r.code == "joueur_rapide" ? 2.2 : 0.45), seconds); break;
                }
                case "jeu_accelere": case "jeu_ralenti": {
                    float previous = Time.timeScale;
                    Timed("time", seconds, () => Time.timeScale = Mathf.Clamp((float)N(r, "facteur", r.code == "jeu_accelere" ? 1.6 : 0.55), 0.1f, 3f),
                        () => { if (Time.timeScale > 0) Time.timeScale = previous; else pendingTimeScale = previous; }); break;
                }
                case "muet": { float volume = AudioListener.volume; Timed("sound", seconds, () => AudioListener.volume = 0, () => AudioListener.volume = volume); break; }
                case "lumieres": {
                    object lights = Instance("LightManager"); bool previous = Convert.ToBoolean(Call(lights, "IsShopLightOn"));
                    Timed("lights", seconds, () => SetLights(lights, !previous), () => SetLights(lights, previous)); break;
                }
                case "fov_fou": {
                    object control = Get(player, "m_CameraFOVController");
                    if (control == null || PlayerCamera() == null) throw new InvalidOperationException("Caméra du joueur indisponible.");
                    Timed("fov", seconds, () => Call(control, "StartInterpolateToFOV", Mathf.Clamp((float)N(r, "fov", 95), 30, 110)), () => Call(control, "StopInterpolateFOV")); break;
                }
                case "bloque": {
                    var walker = (CMF.AdvancedWalkerController)Get(player, "m_WalkerCtrl");
                    bool stopped = Convert.ToBoolean(temporary.Baseline("freeze", () => Get(walker, "isStopMovement")));
                    Timed("freeze", seconds, () => walker.SetStopMovement(true), () => { if (walker != null) walker.SetStopMovement(stopped); }, stopped); break;
                }
                case "son": Global("SoundManager", "PlayAudio", r.Text("nom", "SFX_PercStarJingle3"), 1f, 1f); break;
                case "fanfare": Global("SoundManager", "GenericPurchase", 1f, 1f); Global("SoundManager", "PlayAudio", "SFX_FinalizeCard", 1f, 1.2f); break;
                case "colis": case "gros_colis": {
                    Array items = Enum.GetValues(T("EItemType"));
                    object item = string.IsNullOrEmpty(r.Text("objet")) ? items.GetValue(UnityEngine.Random.Range(1, items.Length)) : Enum.Parse(T("EItemType"), r.Text("objet"), true);
                    int quantity = (int)N(r, "quantite", Convert.ToDouble(Global("RestockManager", "GetMaxItemCountInBox", item, r.code == "gros_colis")));
                    if (Global("RestockManager", "SpawnPackageBoxItem", item, Math.Min(50, Math.Max(1, quantity)), r.code == "gros_colis") == null) throw new InvalidOperationException("Livraison refusée par le jeu."); break;
                }
                case "boom_marche": case "crash_marche": {
                    var prices = (ICollection)Get(T("CPlayerData"), "m_ItemPricePercentChangeList");
                    for (int i = 1; i < prices.Count; i++) { object item = Enum.ToObject(T("EItemType"), i); Global("CPlayerData", "AddItemPricePercentChange", item, (float)(Math.Abs(N(r, "pourcent", 25)) * (r.code == "crash_marche" ? -1 : 1))); Event("CEventPlayer_ItemPriceChanged", item, Global("CPlayerData", "GetItemPrice", item, true)); } break;
                }
                case "agrandir_magasin": Call(Instance("UnlockRoomManager"), "StartUnlockNextRoom"); break;
                case "licence_offerte": UnlockProduct(); break;
                case "employe_arrive": HireWorker(); break;
                case "meuble_offert": DeliverFurniture(); break;
                case "relooking": {
                    object floor = Get(T("CPlayerData"), "m_EquippedFloorDecoIndex"), wall = Get(T("CPlayerData"), "m_EquippedWallDecoIndex");
                    Timed("decor", seconds, () => { Global("ShopCustomizationManager", "ChangeFloorMaterial", UnityEngine.Random.Range(0, 4), false); Global("ShopCustomizationManager", "ChangeWallMaterial", UnityEngine.Random.Range(0, 4), false); }, () => { Global("ShopCustomizationManager", "ChangeFloorMaterial", floor, false); Global("ShopCustomizationManager", "ChangeWallMaterial", wall, false); }); break;
                }
                case "avis_positif": case "avis_negatif": {
                    AddReview(r.code == "avis_positif");
                    Component reviewer = ActiveCustomers().OrderBy(c => Vector3.Distance(c.transform.position, ((Component)player).transform.position)).FirstOrDefault();
                    if (reviewer != null) attribution.Name(reviewer, r.viewer);
                    break;
                }
                case "teleport": Teleport(); break;
                case "lancer_carton": case "chaos_cartons": ThrowBoxes(r.code == "chaos_cartons", (float)N(r, "force", 9)); break;
                case "remplir_rayons": FillShelves(); break;
                case "vider_rayon": EmptyShelf(); break;
                default: return new Reply { status = 2, message = "Interaction TCG inconnue : " + r.code };
            }
            var response = Reply.Success();
            response.metadata = Snapshot();
            // Les événements financiers sont traités par le gestionnaire du jeu
            // après cette frame. Leur acceptation ne prouve pas encore la mutation.
            if (r.code == "argent_plus" || r.code == "argent_moins" || r.code == "jackpot" || r.code == "faillite" || r.code == "xp_boutique") { response.executionConfirmed = false; response.message = "Commande acceptée par le gestionnaire du jeu."; }
            return response;
        }
        private Camera PlayerCamera() {
            try { var player = Object.FindObjectOfType(T("InteractionPlayerController")); return player == null ? null : Get(player, "m_Cam") as Camera; }
            catch { return null; }
        }
        private object Observe(Func<object> read) { try { return read(); } catch { return null; } }
        private int ActiveActors(string type, string method) { return List(Global(type, method)).OfType<Component>().Count(actor => actor != null && actor.gameObject.activeInHierarchy); }
        private void SetLights(object lights, bool expected) { if (Convert.ToBoolean(Call(lights, "IsShopLightOn")) != expected) Call(lights, "ToggleShopLight"); }
        private object Snapshot() {
            return new { money = Get(T("CPlayerData"), "m_CoinAmountDouble"), level = Get(T("CPlayerData"), "m_ShopLevel"), scale = Time.timeScale,
                focused = Application.isFocused, runInBackground = Application.runInBackground,
                uiMode = Observe(() => Get(Instance("InteractionPlayerController"), "m_IsInUIMode")),
                fov = Observe(() => PlayerCamera().fieldOfView),
                moveSpeed = Observe(() => Get(Get(Instance("InteractionPlayerController"), "m_WalkerCtrl"), "movementSpeed")),
                movementBlocked = Observe(() => Get(Get(Instance("InteractionPlayerController"), "m_WalkerCtrl"), "isStopMovement")),
                lightsOn = Observe(() => Call(Instance("LightManager"), "IsShopLightOn")),
                audioVolume = AudioListener.volume,
                customers = Observe(() => ActiveActors("CustomerManager", "GetCustomerList")), workers = Observe(() => ActiveActors("WorkerManager", "GetWorkerList")),
                productBoxes = Observe(() => Object.FindObjectsOfType(T("InteractablePackagingBox_Item")).Length),
                shelfItems = Observe(() => Compartments().Sum(compartment => Convert.ToInt32(Call(compartment, "GetItemCount")))),
                shelfStock = Observe(() => Compartments().OfType<ShelfCompartment>().Where(c => c != null && c.isActiveAndEnabled && c.m_CanPutItem && !c.m_CanPutBox).Select(c => new { id = c.GetInstanceID(), item = c.GetItemType().ToString(), count = c.GetItemCount(), capacity = c.GetMaxItemCount() }).ToArray()),
                boxes = Observe(() => NearbyBoxes().Select(box => new { id = box.GetInstanceID(), kinematic = box.m_Rigidbody.isKinematic, speed = box.m_Rigidbody.linearVelocity.magnitude, distance = Vector3.Distance(box.transform.position, PlayerPosition()) }).ToArray()),
                lastBoxesAffected = lastBoxesAffected,
                namedCustomers = viewerLabels.Count(pair => pair.Key != null && pair.Value != null && IsActiveCustomer(pair.Key)),
                customerLabels = viewerLabels.Where(pair => pair.Key != null && pair.Value != null && IsActiveCustomer(pair.Key)).Select(pair => new { customer = pair.Key.GetInstanceID(), viewer = pair.Value.text }).ToArray(),
                activeEffects = temporary.Keys,
                timedEffects = temporary.Keys.Select(key => new { effect = key, remainingSeconds = Math.Ceiling(temporary.Remaining(key)) }).ToArray() };
        }
        private bool IsActiveCustomer(Component customer) { return customer != null && customer.gameObject.activeInHierarchy && Convert.ToBoolean(Get(customer, "m_IsActive")); }
        private Component[] ActiveCustomers() { return List(Global("CustomerManager", "GetCustomerList")).OfType<Component>().Where(IsActiveCustomer).ToArray(); }
        private void CustomerSpeed(Request r, float seconds) {
            Component[] customers = ActiveCustomers();
            if (customers.Length == 0) throw new InvalidOperationException("Aucun client disponible.");
            Timed("customers", seconds, () => {}, () => { foreach (Component customer in customerSpeeds.Keys.ToArray()) RestoreCustomerSpeed(customer); });
            customerSpeedFactor = (float)N(r, "facteur", r.code == "clients_lents" ? 0.35 : 4);
            foreach (Component customer in customers) ApplyCustomerSpeed(customer);
            attribution.Track("customers", r.viewer, temporary.Deadline("customers"), true, customers);
        }
        private void ApplyCustomerSpeed(Component customer) {
            if (!temporary.Active("customers")) return;
            if (!customerSpeeds.ContainsKey(customer)) customerSpeeds[customer] = Get(customer, "m_ExtraSpeedMultiplier");
            Call(customer, "SetExtraSpeedMultiplier", customerSpeedFactor);
        }
        private void RestoreCustomerSpeed(Component customer) {
            object original;
            if (!customerSpeeds.TryGetValue(customer, out original)) return;
            customerSpeeds.Remove(customer);
            if (customer != null) Set(customer, "m_ExtraSpeedMultiplier", original);
        }
        private void TemporaryField(string key, object target, string name, object value, float seconds) {
            object old = temporary.Baseline(key, () => Get(target, name));
            Timed(key, seconds, () => Set(target, name, value), () => Set(target, name, old), old);
        }
        private void ClearLabel(Component customer) {
            TextMesh label;
            if (!viewerLabels.TryGetValue(customer, out label)) return;
            viewerLabels.Remove(customer);
            // Destroy est différé par Unity : masquer immédiatement évite deux
            // noms superposés si ce personnage est réactivé dans la même frame.
            if (label != null) { label.gameObject.SetActive(false); Object.Destroy(label.gameObject); }
        }
        private void Label(Component customer, string viewer) {
            if (customer == null || string.IsNullOrEmpty(viewer)) return;
            if (viewerFont == null) {
                try { viewerFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); } catch { viewerFont = Font.CreateDynamicFontFromOSFont("Arial", 48); }
                if (viewerFont == null) throw new InvalidOperationException("Police du nom de client indisponible.");
            }
            TextMesh text;
            if (!viewerLabels.TryGetValue(customer, out text) || text == null) {
                var label = new GameObject("ShenPulse Viewer"); label.transform.SetParent(customer.transform, false); label.transform.localPosition = Vector3.up * 2.1f;
                text = label.AddComponent<TextMesh>(); text.font = viewerFont; text.GetComponent<Renderer>().sharedMaterial = viewerFont.material;
                text.fontSize = 48; text.characterSize = 0.04f; text.anchor = TextAnchor.MiddleCenter; text.color = Color.cyan; text.richText = false;
                viewerLabels[customer] = text;
            }
            // Les surnoms TikTok peuvent contenir des emojis (paires UTF-16).
            int length = Math.Min(48, viewer.Length);
            if (length < viewer.Length && char.IsHighSurrogate(viewer[length - 1])) length--;
            text.text = viewer.Substring(0, length);
        }
        private void UnlockProduct() {
            var unlocked = (IList)Get(T("CPlayerData"), "m_IsItemLicenseUnlocked");
            var stock = List(Get(Get(Instance("InventoryBase"), "m_StockItemData_SO"), "m_RestockDataList")); int level = Convert.ToInt32(Get(T("CPlayerData"), "m_ShopLevel"));
            for (int i = 0; i < Math.Min(unlocked.Count, stock.Count); i++) if (!Convert.ToBoolean(unlocked[i]) && Convert.ToInt32(Get(stock[i], "licenseShopLevelRequired")) <= level) { Global("CPlayerData", "SetUnlockItemLicense", i); return; }
            throw new InvalidOperationException("Aucune licence produit accessible à ce niveau.");
        }
        private void HireWorker() {
            var workers = List(Get(Instance("WorkerManager"), "m_WorkerDataList")); int level = Convert.ToInt32(Get(T("CPlayerData"), "m_ShopLevel"));
            for (int i = 0; i < workers.Count; i++) if (!Convert.ToBoolean(Global("CPlayerData", "GetIsWorkerHired", i)) && Convert.ToInt32(Get(workers[i], "shopLevelRequired")) <= level) { Global("CPlayerData", "SetIsWorkerHired", i, true); Call(Instance("WorkerManager"), "ActivateWorker", i, true); return; }
            throw new InvalidOperationException("Aucun employé accessible à ce niveau.");
        }
        private void DeliverFurniture() {
            var furniture = List(Get(Get(Instance("InventoryBase"), "m_ObjectData_SO"), "m_ObjectDataList")).Where(o => { string name = Convert.ToString(Get(o, "objectType")); return name != "None" && name != "Card3d" && !name.StartsWith("PackageBox") && Get(o, "spawnPrefab") != null; }).ToArray();
            if (furniture.Length == 0) throw new InvalidOperationException("Aucun meuble disponible.");
            var position = (Transform)Global("RestockManager", "GetRandomPackageSpawnPos");
            Global("ShelfManager", "SpawnInteractableObjectInPackageBox", Get(furniture[UnityEngine.Random.Range(0, furniture.Length)], "objectType"), position.position, position.rotation);
        }
        private void AddReview(bool positive) {
            var method = T("CustomerReviewManager").GetMethods(Members).First(m => m.Name == "AddCustomerReview" && m.GetParameters().Length == 4);
            var p = method.GetParameters(); var values = new object[] { Enum.GetValues(p[0].ParameterType).GetValue(1), Enum.GetValues(p[1].ParameterType).GetValue(1), positive ? 2 : 0, Convert.ToInt32(Get(T("CPlayerData"), "m_ShopLevel")) };
            method.Invoke(null, values);
        }
        private List<object> Compartments() { return List(Get(Instance("ShelfManager"), "m_SpawnedShelfList")).SelectMany(s => List(Get(s, "m_ItemCompartmentList"))).ToList(); }
        private void EmptyShelf() {
            ShelfCompartment compartment = Compartments().OfType<ShelfCompartment>().FirstOrDefault(c => c.GetItemCount() > 0 && c.m_CanPutItem && !c.m_CanPutBox);
            if (compartment == null) throw new InvalidOperationException("Aucun rayon rempli.");
            TcgShopOperations.Empty(compartment);
        }
        private void FillShelves() {
            int added = TcgShopOperations.Fill(Compartments().OfType<ShelfCompartment>());
            if (added == 0) throw new InvalidOperationException("Aucun emplacement disponible dans les rayons étiquetés.");
        }
        private void Teleport() {
            var player = (Component)Instance("InteractionPlayerController");
            for (int i = 0; i < 16; i++) {
                Vector3 trial = player.transform.position + new Vector3(UnityEngine.Random.Range(-5f, 5f), 3, UnityEngine.Random.Range(-5f, 5f)); RaycastHit hit;
                if (!Physics.Raycast(trial, Vector3.down, out hit, 7f, -1, QueryTriggerInteraction.Ignore)) continue;
                Vector3 point = hit.point + Vector3.up * 0.1f;
                if (Physics.CheckCapsule(point + Vector3.up * 0.5f, point + Vector3.up * 1.5f, 0.3f, -1, QueryTriggerInteraction.Ignore)) continue;
                Global("InteractionPlayerController", "SetPlayerPos", point); return;
            }
            throw new InvalidOperationException("Aucun emplacement libre trouvé pour la téléportation.");
        }
        private Vector3 PlayerPosition() {
            var player = (InteractionPlayerController)Instance("InteractionPlayerController");
            return player.m_PlayerRigidbody != null ? player.m_PlayerRigidbody.position : player.m_Cam != null ? player.m_Cam.transform.position : player.transform.position;
        }
        private InteractablePackagingBox[] NearbyBoxes() {
            Vector3 origin = PlayerPosition();
            return Object.FindObjectsOfType<InteractablePackagingBox>().Where(box => box.m_Rigidbody != null && box.gameObject.activeInHierarchy
                && !Convert.ToBoolean(Get(box, "m_IsBeingHold")) && !Convert.ToBoolean(Get(box, "m_IsMovingObject"))
                && (!(box is InteractablePackagingBox_Item) || !((InteractablePackagingBox_Item)box).m_IsStored)
                && Vector3.Distance(box.transform.position, origin) <= 8).OrderBy(box => Vector3.Distance(box.transform.position, origin)).ToArray();
        }
        private void ThrowBoxes(bool all, float strength) {
            Vector3 origin = PlayerPosition();
            var boxes = NearbyBoxes().Take(all ? 20 : 1).ToArray();
            lastBoxesAffected = 0;
            if (boxes.Length == 0) throw new InvalidOperationException("Aucun carton libre à moins de 8 mètres. Posez les cartons au sol, hors des mains et des étagères.");
            Camera camera = PlayerCamera();
            Vector3 forward = camera != null ? camera.transform.forward : Vector3.forward;
            foreach (InteractablePackagingBox box in boxes) {
                Vector3 direction = all ? box.transform.position - origin : forward;
                direction.y = 0;
                if (direction.sqrMagnitude < 0.01f) direction = forward;
                TcgShopOperations.LaunchBox(box, direction.normalized + Vector3.up, Mathf.Clamp(strength, 1, 12));
                lastBoxesAffected++;
            }
        }
    }
}
