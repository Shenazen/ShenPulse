using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using BepInEx.Logging;
using HarmonyLib;
using Il2CppInterop.Runtime.InteropTypes;
using TMPro;
using UnityEngine;
using GameLocale = UnityEngine.Localization.Locale;
using UnityEngine.Localization.Settings;
using Object = UnityEngine.Object;
namespace ShenPulse.ShopGames {
    internal static class MarketRuntime {
        private sealed class NameEntry { public Transform target; public string viewer; }
        private sealed class HiddenText { public TMP_Text text; public bool enabled; }
        private static readonly System.Diagnostics.Stopwatch clock = System.Diagnostics.Stopwatch.StartNew();
        private static readonly ViewerSpawnQueue customers = new ViewerSpawnQueue();
        private static readonly Dictionary<long,NameEntry> names = new Dictionary<long,NameEntry>();
        private static readonly Dictionary<long,HiddenText> hidden = new Dictionary<long,HiddenText>();
        private static readonly HashSet<string> Timed = new HashSet<string>(("InvertControls SpeedBoost SlowMotion LightsOff ChangeFOV FlipCamera GameSpeedUp GameSlowDown ChangeLanguage AutoDiscount ForceMath").Split(' '));
        private static Type helper, component, nameType;
        private static ManualLogSource log;
        private static Harmony harmony;
        private static TemporaryEffects temporary;
        private static FirstPersonController motion;
        private static float baseMove, baseSprint, baseRotation, movement = 1;
        private static bool inverted, previousBackground;
        private static long scene;
        private static int day = -1;
        private static double nextDrain;
        private static float? pendingScale;
        private const BindingFlags Members = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;
        private const BindingFlags InstanceMembers = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
        private static double Now { get { return clock.Elapsed.TotalSeconds; } }
        private static bool Alive(Il2CppObjectBase value) { return value != null && !value.WasCollected && (!(value is Object) || (Object)value != null); }
        private static object Invoke(string method, params object[] args) { return helper.GetMethod(method, Members).Invoke(null, args); }
        private static object Field(string name) { return component.GetField(name, Members).GetValue(null); }
        private static void Field(string name, object value) { component.GetField(name, Members).SetValue(null, value); }
        private static FirstPersonController Player() { return (FirstPersonController)Invoke("GetFirstPersonController"); }
        private static PlayerInteraction Interaction() { return Object.FindObjectOfType<PlayerInteraction>(); }
        public static bool Ready() { return Alive(Player()) && Alive(NoktaSingleton<DayCycleManager>.Instance) && Alive(NoktaSingleton<MoneyManager>.Instance); }
        private static bool Paused() { var input = Interaction(); return Time.timeScale <= 0 || (Alive(input) && (input.m_Paused || input.m_InGameMenu)); }
        private static bool OpenForCustomers() {
            var manager = NoktaSingleton<CustomerManager>.Instance;
            var store = NoktaSingletonPunCallbacks<StoreStatus>.Instance;
            return Alive(manager) && Alive(store) && store.IsOpen && !manager.TooLateToSpawnCustomers;
        }
        public static void Start(Assembly module, ManualLogSource logger) {
            helper = module.GetTypes().Single(t => t.Name == "GameHelper");
            component = module.GetTypes().Single(t => t.Name == "ShenPulseComponent");
            nameType = component.GetNestedType("Etiquette", BindingFlags.NonPublic);
            log = logger;
            temporary = new TemporaryEffects(() => Now, key => log.LogInfo("Fin de l’effet " + key), (key,e) => log.LogWarning("Restauration " + key + " : " + e.Message));
            previousBackground = Application.runInBackground; Application.runInBackground = true;
            harmony = new Harmony("com.shenpulse.supermarket.reliability");
            foreach (string method in new[] { "OnEnable", "OnDisable" }) harmony.Patch(typeof(Customer).GetMethod(method), postfix: new HarmonyMethod(typeof(MarketRuntime), "CustomerReused"));
        }
        public static void Stop() { if (temporary != null) temporary.Reset(); if (harmony != null) harmony.UnpatchSelf(); ClearCustomers(); Application.runInBackground = previousBackground; }
        public static void NativeTimer(string id, float seconds, Action restore) { temporary.Run("native-" + id, seconds, () => {}, restore); }
        public static bool Active(string id) { return temporary != null && temporary.Active("native-" + id); }
        public static void QueueCustomers(int count, string viewer) {
            if (!customers.Enqueue(count, viewer)) { log.LogWarning("File de clients pleine : interaction refusée sans ajout partiel."); return; }
            Field("_poolClients", (long)customers.Count);
        }
        public static void DrainCustomers() {
            if (Now < nextDrain || customers.Count == 0 || !Ready() || Paused() || !OpenForCustomers()) return;
            nextDrain = Now + .1;
            var manager = NoktaSingleton<CustomerManager>.Instance;
            for (int n = 0; n < 5 && customers.Count > 0 && manager.CanSpawnCustomer; n++) {
                Customer customer = manager.SpawnCustomer();
                if (!Alive(customer)) { nextDrain = Now + 1; break; }
                Label(customer.transform, customers.Viewer); customers.Spawned();
                Field("_poolClients", (long)customers.Count);
            }
        }
        private static IList NativeNames() { return (IList)Field("_etiquettes"); }
        private static void RemoveName(long key) {
            IList list = NativeNames();
            for (int n = list.Count - 1; n >= 0; n--) {
                var target = nameType.GetField("Cible", InstanceMembers).GetValue(list[n]) as Transform;
                if (!Alive(target) || target.Pointer.ToInt64() == key) list.RemoveAt(n);
            }
            names.Remove(key);
        }
        private static void CustomerReused(Customer __instance) { if (Alive(__instance)) RemoveName(__instance.transform.Pointer.ToInt64()); }
        public static void Label(object rawTarget, string viewer) {
            var target = rawTarget as Transform;
            if (!Alive(target) || string.IsNullOrWhiteSpace(viewer)) return;
            long key = target.Pointer.ToInt64(); RemoveName(key);
            string text = viewer.Trim(); int length = Math.Min(48,text.Length);
            if (length < text.Length && char.IsHighSurrogate(text[length-1])) length--;
            text = text.Substring(0,length);
            var entry = Activator.CreateInstance(nameType, true);
            nameType.GetField("Cible", InstanceMembers).SetValue(entry,target);
            nameType.GetField("Pseudo", InstanceMembers).SetValue(entry,text);
            nameType.GetField("Visible", InstanceMembers).SetValue(entry,true);
            NativeNames().Add(entry); names[key] = new NameEntry { target = target, viewer = text };
        }
        private static void ClearCustomers() { customers.Clear(); names.Clear(); NativeNames().Clear(); Field("_poolClients",0L); }
        public static void Tick() {
            if (temporary == null) return;
            try {
                temporary.Tick();
                if (pendingScale.HasValue && !Paused()) { Time.timeScale = pendingScale.Value; pendingScale = null; }
                var current = NoktaSingleton<DayCycleManager>.Instance;
                long pointer = Alive(current) ? current.Pointer.ToInt64() : 0;
                int currentDay = pointer == 0 ? -1 : current.CurrentDay;
                if (scene != pointer || day != currentDay) {
                    temporary.Reset(); if (scene != pointer) ClearCustomers(); scene = pointer; day = currentDay;
                }
                foreach (var pair in names.ToArray()) if (!Alive(pair.Value.target) || !pair.Value.target.gameObject.activeInHierarchy) RemoveName(pair.Key);
                if (temporary.Active("math")) HideChange();
            } catch (Exception error) { log.LogWarning("Suivi des interactions : " + error.Message); }
        }
        private static void CaptureMotion() {
            var player = Player();
            if (Alive(motion) && motion.Pointer == player.Pointer) return;
            temporary.Restore("movement"); temporary.Restore("controls");
            motion = player; baseMove = player.MoveSpeed; baseSprint = player.SprintSpeed; baseRotation = player.RotationSpeed; movement = 1; inverted = false;
        }
        private static void ApplyMotion() {
            if (!Alive(motion)) return;
            float sign = inverted ? -1 : 1;
            motion.MoveSpeed = baseMove * movement * sign; motion.SprintSpeed = baseSprint * movement * sign; motion.RotationSpeed = baseRotation * sign;
            if (!temporary.Active("movement") && !temporary.Active("controls")) motion = null;
        }
        private static void HideChange() {
            foreach (var screen in Object.FindObjectsOfType<CashRegisterScreen>()) {
                var text = screen.m_CorrectChangeText; if (!Alive(text)) continue;
                long key = text.Pointer.ToInt64();
                if (!hidden.ContainsKey(key)) hidden[key] = new HiddenText { text = text, enabled = text.enabled };
                text.enabled = false;
            }
        }
        private static void RestoreChange() { foreach (var value in hidden.Values) if (Alive(value.text)) value.text.enabled = value.enabled; hidden.Clear(); }
        private static void RestoreSpeed(float speed) { if (Paused()) pendingScale = speed; else Time.timeScale = speed; }
        private static bool SaleSlot(DisplaySlot slot) { return !(bool)Invoke("IsInsideStorageArea", slot.transform.position); }
        private static int TossBoxes() {
            int count=0;var player=Player();var held=Invoke("GetActiveBoxInteraction") as BoxInteraction;
            foreach(var box in Object.FindObjectsOfType<Box>()) {
                if(box.Racked||box.OnPlacementArea||box.IsBoxOccupied||box.InAnimationTransition||(Alive(held)&&Alive(held.Box)&&held.Box.Pointer==box.Pointer)||box.transform.IsChildOf(player.transform)||Vector3.Distance(box.transform.position,player.transform.position)>8||(bool)Invoke("IsInsideStorageArea",box.transform.position))continue;
                var body=box.RigidBody;if(!Alive(body))continue;box.SetStatic(false);box.ToggleInstanced(false);if(Alive(box.m_MainCollider))box.m_MainCollider.enabled=true;
                body.isKinematic=false;body.useGravity=true;body.detectCollisions=true;body.AddForce(Vector3.up*3+UnityEngine.Random.insideUnitSphere*2,ForceMode.VelocityChange);body.AddTorque(UnityEngine.Random.insideUnitSphere*3,ForceMode.VelocityChange);body.WakeUp();count++;
            }return count;
        }
        private static int[] EmployeeIds(Il2CppSystem.Collections.Generic.List<int> source) {
            var result=new List<int>();if(source!=null)foreach(int id in source)result.Add(id);return result.ToArray();
        }
        private static int DismissEmployees() {
            var e=NoktaSingleton<EmployeeManager>.Instance;if(!Alive(e))throw new InvalidOperationException("Gestionnaire des employés indisponible.");
            int count=0;
            count+=EmployeeOperations.Dismiss(EmployeeIds(e.m_CashiersData),e.FireCashier,e.IsCashierHired);
            count+=EmployeeOperations.Dismiss(EmployeeIds(e.m_RestockersData),e.FireRestocker,e.IsRestockerHired);
            count+=EmployeeOperations.Dismiss(EmployeeIds(e.m_JanitorsData),e.FireJanitor,e.IsJanitorHired);
            count+=EmployeeOperations.Dismiss(EmployeeIds(e.m_SecurityGuardsData),e.FireSecurityGuard,e.IsSecurityGuardHired);
            count+=EmployeeOperations.Dismiss(EmployeeIds(e.m_CustomerHelpersData),e.FireCustomerHelper,e.IsCustomerHelperHired);
            count+=EmployeeOperations.Dismiss(EmployeeIds(e.m_BakersData),e.FireBaker,e.IsBakerHired);
            count+=EmployeeOperations.Dismiss(EmployeeIds(e.m_IceCreamHelpersData),e.FireIceCreamHelper,e.IsIceCreamHelperHired);
            return count;
        }
        private static object EmployeeSnapshot() {
            var e=NoktaSingleton<EmployeeManager>.Instance;if(!Alive(e))return null;
            return new {cashiers=EmployeeIds(e.m_CashiersData),restockers=EmployeeIds(e.m_RestockersData),janitors=EmployeeIds(e.m_JanitorsData),security=EmployeeIds(e.m_SecurityGuardsData),helpers=EmployeeIds(e.m_CustomerHelpersData),bakers=EmployeeIds(e.m_BakersData),iceCream=EmployeeIds(e.m_IceCreamHelpersData)};
        }
        private static object HeldSnapshot() {
            var box=Invoke("GetActiveBoxInteraction") as BoxInteraction;
            return new {box=Alive(box)&&Alive(box.Box),placing=Alive(box)&&box.m_PlacingMode};
        }
        public static object Snapshot() {
            var player = Player(); var input = Interaction(); var manager = NoktaSingleton<CustomerManager>.Instance;
            var store = NoktaSingletonPunCallbacks<StoreStatus>.Instance; var money = NoktaSingleton<MoneyManager>.Instance;
            var camera = Camera.main;
            var cycle=NoktaSingleton<DayCycleManager>.Instance;var level=NoktaSingleton<StoreLevelManager>.Instance;var section=NoktaSingleton<SectionManager>.Instance;var licenses=NoktaSingleton<ProductLicenseManager>.Instance;var prices=NoktaSingletonPunCallbacks<PriceManager>.Instance;
            return new {
                ready = Ready(), paused = Paused(), open = Alive(store) && store.IsOpen,
                money = Alive(money) ? (object)money.Money : null, scale = Time.timeScale,
                move = Alive(player) ? (object)player.MoveSpeed : null, sprint = Alive(player) ? (object)player.SprintSpeed : null,
                rotation = Alive(player) ? (object)player.RotationSpeed : null, movementAllowed = Alive(player) && player.MovementInteraction,
                focused = Application.isFocused, runInBackground = Application.runInBackground,
                customers = Alive(manager) && manager.ActiveCustomers != null ? manager.ActiveCustomers.Count : 0,
                shoplifters = Alive(manager) && manager.Shoplifters != null ? manager.Shoplifters.Count : 0,
                canSpawn = Alive(manager) && manager.CanSpawnCustomer, queuedCustomers = customers.Count,
                customerLabels = names.Where(p=>Alive(p.Value.target)&&p.Value.target.gameObject.activeInHierarchy).Select(p=>new { actor=p.Key, viewer=p.Value.viewer }).ToArray(),
                fov = Field("FovOverride"), cameraFov = Alive(camera) ? (object)camera.fieldOfView : null, flipped = Field("FlipCameraActive"),
                locale = LocalizationSettings.SelectedLocale == null ? null : LocalizationSettings.SelectedLocale.Identifier.Code,
                mathHidden = hidden.Count,
                day=Alive(cycle)?cycle.CurrentDay:-1,hour=Alive(cycle)?cycle.CurrentHour:-1,minute=Alive(cycle)?cycle.CurrentMinute:-1,am=Alive(cycle)&&cycle.AM,clockSeconds=Alive(cycle)?cycle.CurrentTimeInSeconds:-1,clockTime=Alive(cycle)?cycle.CurrentTime:-1,clockGameTime=Alive(cycle)?cycle.CurrentGameTime:-1,clockDayStart=Alive(cycle)?cycle.DayStartingTime:-1,clockDayLength=Alive(cycle)?cycle.DayDurationInGameTimeInSeconds:-1,held=HeldSnapshot(),
                level=Alive(level)?level.CurrentLevel:-1,maxLevel=Alive(level)&&level.MaxLevel,upgradeLevel=Alive(section)?section.m_StoreUpgradeLevel:-1,
                unlockedLicenses=Alive(licenses)?licenses.UnlockedLicenseCount:0,allLicenses=Alive(licenses)&&licenses.HasAllLicencesUnlocked,
                position = Alive(player) ? new { x=player.transform.position.x,y=player.transform.position.y,z=player.transform.position.z } : null,
                employees = EmployeeSnapshot(),
                droppedProducts = Object.FindObjectsOfType<Product>().Count(p=>p.IsDropped),
                boxes = Object.FindObjectsOfType<Box>().Where(b=>Alive(b.RigidBody)).Select(b=>new { id=b.Pointer.ToInt64(), speed=b.RigidBody.velocity.magnitude, position=new{x=b.transform.position.x,y=b.transform.position.y,z=b.transform.position.z}, racked=b.Racked, occupied=b.IsBoxOccupied }).ToArray(),
                storeLights = Alive(NoktaSingletonPunCallbacks<StoreLightManager>.Instance) ? (object)NoktaSingletonPunCallbacks<StoreLightManager>.Instance.TurnOn : null,
                storageLights = Alive(NoktaSingletonPunCallbacks<StorageLightManager>.Instance) ? (object)NoktaSingletonPunCallbacks<StorageLightManager>.Instance.TurnOn : null,
                shelves = Object.FindObjectsOfType<DisplaySlot>().Select(slot=> new { id=slot.Pointer.ToInt64(), product=slot.ProductID, count=slot.ProductCount, full=slot.Full, price=Alive(prices)&&slot.ProductID>0?prices.SellingPrice(slot.ProductID):0 }).ToArray(),
                timedEffects = temporary.Keys.Select(key=>new { effect=key, remainingSeconds=Math.Ceiling(temporary.Remaining(key)) }).ToArray()
            };
        }
        public static Reply Execute(Request request, Func<Request,Reply> dispatch) {
            Tick();
            if (request.code == "__status") return new Reply { status=0, ready=Ready(), metadata=Snapshot() };
            if (request.code == "ResetEffects") { temporary.Reset(); return new Reply { status=0, executionConfirmed=true, message="Effets temporaires rétablis.", metadata=Snapshot() }; }
            if (!Ready() || Paused()) return Reply.Unavailable("Chargez votre supermarché et fermez les menus avant cette interaction.");
            if ((request.code == "SpawnCustomers" || request.code == "CustomerRush" || request.code == "SpawnShoplifter") && !OpenForCustomers()) return Reply.Unavailable("Ouvrez le magasin pendant les heures de visite avant d’ajouter des clients.");
            if (request.code == "SpawnShoplifter" && !NoktaSingleton<CustomerManager>.Instance.CanSpawnCustomer) return Reply.Unavailable("La capacité d’accueil du magasin est atteinte. Attendez le départ de clients avant d’ajouter un voleur.");
            if ((request.code == "Teleport" || request.code == "TeleportOutside") && !Player().MovementInteraction) return Reply.Unavailable("Quittez la caisse, l’ordinateur ou le déplacement de meubles avant cette téléportation.");
            if (request.code == "FireAllEmployees") {
                int dismissed=DismissEmployees();
                return dismissed>0 ? new Reply { status=0,executionConfirmed=true,message=dismissed+" employé(s) renvoyé(s).",metadata=Snapshot() } : Reply.Unavailable("Aucun employé engagé à renvoyer.");
            }
            if (request.code == "ThrowItem" || request.code == "DropAllItems" || request.code == "ClearInventory") {
                var heldBox=Invoke("GetActiveBoxInteraction") as BoxInteraction;
                bool carryingBox=Alive(heldBox)&&Alive(heldBox.Box);
                if(request.code=="ClearInventory") {if(carryingBox)return Reply.Unavailable("Posez le carton tenu avant de vider le stock.");}
                else {
                    var holder=Invoke("GetPlayerObjectHolder") as PlayerObjectHolder;
                    if(!carryingBox&&(!Alive(holder)||holder.CurrentObject==null))return Reply.Unavailable("Prenez un objet ou un carton en main avant cette interaction.");
                }
            }
            float seconds=(float)Math.Clamp(request.duration > 0 ? request.duration : request.Number("count",request.quantity>1?request.quantity:20),1,120);
            switch (request.code) {
                case "ClearInventory": {
                    int changed=MarketStock.ClearStock();
                    return changed>0?new Reply{status=0,executionConfirmed=true,message="Stock vidé ; les étiquettes des rayons sont conservées.",metadata=Snapshot()}:Reply.Unavailable("Le stock est déjà vide.");
                }
                case "DropAllItems": {
                    var held=Invoke("GetActiveBoxInteraction") as BoxInteraction;
                    if(!Alive(held)||!Alive(held.Box))return dispatch(request);
                    held.DropBox();
                    return !Alive(held.Box)?new Reply{status=0,executionConfirmed=true,message="Carton posé et commandes libérées.",metadata=Snapshot()}:Reply.Unavailable("Le jeu n’a pas libéré le carton tenu.");
                }
                case "SpeedUpTime": {
                    var cycle=NoktaSingleton<DayCycleManager>.Instance;
                    float before=cycle.CurrentGameTime,target=MarketTime.AdvanceElapsed(before,cycle.DayDurationInGameTimeInSeconds);
                    if(target<=before+.01f)return Reply.Unavailable("La journée est déjà terminée. Commencez la suivante avant d’avancer l’horloge.");
                    int absolute=MarketTime.SecondsOfDay(target,cycle.DayStartingTime),hour=absolute/3600%24;
                    cycle.CurrentTime=target;cycle.CurrentGameTime=target;
                    cycle.m_CurrentTimeInHours=hour%12==0?12:hour%12;
                    cycle.m_CurrentTimeInMinutes=absolute/60%60;cycle.m_CurrentTimeInSeconds=absolute%60;cycle.m_AM=hour<12;
                    cycle.OnTimeChanged?.Invoke();cycle.OnFullHour?.Invoke();
                    return new Reply{status=0,executionConfirmed=true,message="Cycle du jeu avancé de deux heures, dans la limite de la journée.",metadata=Snapshot()};
                }
                case "RandomizePrices": {
                    var prices=NoktaSingletonPunCallbacks<PriceManager>.Instance;
                    if(!Alive(prices))return Reply.Unavailable("Les prix du magasin sont indisponibles.");
                    temporary.Restore("native-AutoDiscount");int changed=0;
                    foreach(int id in Object.FindObjectsOfType<DisplaySlot>().Where(s=>s.ProductID>0&&SaleSlot(s)).Select(s=>s.ProductID).Distinct()) {
                        float before=prices.SellingPrice(id),after=Mathf.Max(.1f,(float)Math.Round(before*UnityEngine.Random.Range(.5f,2f),2));
                        if(Mathf.Abs(after-before)<.005f)after=(float)Math.Round(before+.01f,2);
                        prices.SetPrice_Order(id,after,0,0);if(Mathf.Abs(prices.SellingPrice(id)-before)>.005f)changed++;
                    }
                    return changed>0?new Reply{status=0,executionConfirmed=true,message=changed+" prix de vente modifié(s).",metadata=Snapshot()}:Reply.Unavailable("Aucun prix de produit en rayon à modifier.");
                }
                case "Teleport": case "TeleportOutside": {
                    bool moved=MarketTeleport.Move(Player(),request.code=="TeleportOutside");
                    return moved?new Reply{status=0,executionConfirmed=true,message="Joueur déplacé vers un point de sol libre.",metadata=Snapshot()}:Reply.Unavailable("Aucun emplacement libre et accessible trouvé près du magasin. Le joueur reste à sa place.");
                }
                case "FillShelves": case "EmptyShelf": case "AntiChaos": {
                    int changed=request.code=="FillShelves"?MarketStock.Fill(SaleSlot):request.code=="EmptyShelf"?MarketStock.Empty(SaleSlot):MarketStock.ReturnLoose(SaleSlot);
                    return changed>0 ? new Reply{status=0,executionConfirmed=true,message=changed+" rayon(s) ou produit(s) mis à jour.",metadata=Snapshot()} : Reply.Unavailable("Aucun produit ou rayon compatible à modifier dans cette situation.");
                }
                case "GameSpeedUp": case "GameSlowDown": {
                    float original=Time.timeScale;
                    temporary.Run("time",seconds,()=>Time.timeScale=request.code=="GameSpeedUp"?2f:.5f,()=>RestoreSpeed(original)); break;
                }
                case "SpeedBoost": case "SlowMotion":
                    CaptureMotion(); temporary.Run("movement",seconds,()=>{movement=request.code=="SpeedBoost"?3f:.3f;ApplyMotion();},()=>{movement=1;ApplyMotion();}); break;
                case "InvertControls":
                    CaptureMotion(); temporary.Run("controls",seconds,()=>{inverted=true;ApplyMotion();},()=>{inverted=false;ApplyMotion();}); break;
                case "ChangeFOV": {
                    object original=Field("FovOverride");
                    temporary.Run("fov",seconds,()=>Field("FovOverride",(float?)UnityEngine.Random.Range(25f,115f)),()=>{Field("FovOverride",original);if(Alive(Camera.main))Camera.main.ResetProjectionMatrix();}); break;
                }
                case "FlipCamera": {
                    bool original=(bool)Field("FlipCameraActive");
                    temporary.Run("flip",seconds,()=>Field("FlipCameraActive",true),()=>Field("FlipCameraActive",original)); break;
                }
                case "LightsOff": {
                    var store=NoktaSingletonPunCallbacks<StoreLightManager>.Instance;var storage=NoktaSingletonPunCallbacks<StorageLightManager>.Instance;
                    bool a=Alive(store)&&store.TurnOn,b=Alive(storage)&&storage.TurnOn;
                    if(!Alive(store)&&!Alive(storage)) return Reply.Unavailable("Aucun éclairage disponible dans ce magasin.");
                    temporary.Run("lights",seconds,()=>{if(Alive(store))store.TurnOn=false;if(Alive(storage))storage.TurnOn=false;},()=>{if(Alive(store))store.TurnOn=a;if(Alive(storage))storage.TurnOn=b;});break;
                }
                case "ChangeLanguage": {
                    GameLocale original=LocalizationSettings.SelectedLocale;
                    var available=LocalizationSettings.AvailableLocales.Locales;
                    var choices=new List<GameLocale>();foreach(var locale in available)if(Alive(locale)&&locale!=original)choices.Add(locale);
                    if(!Alive(original)||choices.Count==0)return Reply.Unavailable("Les traductions du jeu ne sont pas encore chargées.");
                    temporary.Run("language",seconds,()=>LocalizationSettings.SelectedLocale=choices[UnityEngine.Random.Range(0,choices.Count)],()=>{if(Alive(original))LocalizationSettings.SelectedLocale=original;});break;
                }
                case "ForceMath":
                    if(Object.FindObjectsOfType<CashRegisterScreen>().Length==0)return Reply.Unavailable("Placez une caisse dans le magasin avant cet effet.");
                    temporary.Run("math",seconds,HideChange,RestoreChange);break;
                default: {
                    if(Timed.Contains(request.code)) request.quantity=(int)Math.Ceiling(seconds);
                    Reply response=dispatch(request);if(request.code=="CartChaos")log.LogInfo("Cartons libres projetés : "+TossBoxes());response.metadata=Snapshot();return response;
                }
            }
            return new Reply { status=0,executionConfirmed=true,message="Effet temporaire appliqué.",metadata=Snapshot() };
        }
    }
}
