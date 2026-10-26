using System;
using System.Collections.Generic;
using System.Linq;
using ShenPulse.ShopGames;

namespace UnityEngine {
    public struct Vector3 {
        public float x, y, z;
        public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
        public float magnitude { get { return (float)Math.Sqrt(x * x + y * y + z * z); } }
        public Vector3 normalized { get { return this * (1 / magnitude); } }
        public static Vector3 operator *(Vector3 value, float factor) { return new Vector3(value.x * factor, value.y * factor, value.z * factor); }
    }
    public enum ForceMode { Impulse, VelocityChange }
    public static class Random { public static Vector3 insideUnitSphere { get { return new Vector3(.3f, .2f, .1f); } } }
    public class Rigidbody {
        public bool isKinematic = true, awake;
        public float mass = 100;
        public Vector3 force, torque;
        public ForceMode mode;
        public void WakeUp() { awake = true; }
        public void AddForce(Vector3 value, ForceMode kind) { if (isKinematic) throw new Exception("Force ignored on a kinematic box"); force = value; mode = kind; }
        public void AddTorque(Vector3 value, ForceMode kind) { torque = value; }
    }
}
public enum EItemType { None, BasicCardPack, DeckBox }
public class Item { public bool disabled; }
public static class ItemSpawnManager { public static void DisableItem(Item item) { item.disabled = true; } }
public class ShelfCompartment {
    public bool isActiveAndEnabled = true, m_CanPutItem = true, m_CanPutBox, failNextSpawn;
    public EItemType type;
    public int capacity, spawnCalls;
    public List<Item> items = new List<Item>();
    public ShelfCompartment(EItemType type, int count, int capacity) { this.type = type; this.capacity = capacity; for (int i = 0; i < count; i++) items.Add(new Item()); }
    public EItemType GetItemType() { return type; }
    public int GetItemCount() { return items.Count; }
    public int GetMaxItemCount() { return capacity; }
    public Item GetLastItem() { return items.LastOrDefault(); }
    public void RemoveItem(Item item) { items.Remove(item); if (items.Count == 0) type = EItemType.None; }
    public void SetCompartmentItemType(EItemType value) { type = value; }
    public void CalculatePositionList() {}
    public void SpawnItem(int amount, bool fromFront) {
        spawnCalls++;
        if (failNextSpawn) { failNextSpawn = false; throw new Exception("spawn failed"); }
        if (items.Count != 0) throw new Exception("SpawnItem appends: the old stock must first be released");
        for (int i = 0; i < amount; i++) items.Add(new Item());
    }
}
public class InteractablePackagingBox {
    public UnityEngine.Rigidbody m_Rigidbody = new UnityEngine.Rigidbody();
    public bool physicsEnabled;
    public void SetPhysicsEnabled(bool enabled) { physicsEnabled = enabled; m_Rigidbody.isKinematic = !enabled; }
}
class TcgRuntimeEffectsHarness {
    static int checks;
    static void Check(bool valid, string message) { checks++; if (!valid) throw new Exception(message); }
    static int Main() {
        try {
            double now = 0;
            double scale = 1;
            bool frozen = false;
            var ended = new List<string>(); var errors = new List<string>();
            var effects = new TemporaryEffects(() => now, key => ended.Add(key), (key, error) => errors.Add(key));
            effects.Run("time", 20, () => scale = .55, () => scale = 1);
            Check(scale == .55 && effects.Remaining("time") == 20, "Slow motion must start for twenty real seconds.");
            now = 5;
            for (int i = 0; i < 100; i++) effects.Run("time", 20, () => scale = 1.6, () => scale = .55);
            Check(scale == 1.6, "Acceleration must replace slow motion immediately.");
            Check(effects.Deadline("time") == 20 && effects.Remaining("time") == 15, "Repeated gifts must not add time or refresh an active window.");
            now = 20; effects.Tick();
            Check(scale == 1 && ended.Count == 1 && !effects.Active("time"), "The first baseline must be restored exactly once at its real deadline.");
            effects.Run("freeze", 6, () => frozen = true, () => frozen = false);
            now = 25; effects.Run("freeze", 120, () => frozen = true, () => frozen = true);
            Check(frozen && effects.Remaining("freeze") == 1, "A second immobilization must not prolong the original six-second lock.");
            now = 26; effects.Tick();
            Check(!frozen, "Movement must be released at six seconds despite repeated requests.");
            double speed = 3.5;
            object baseline = effects.Baseline("walk", () => speed);
            effects.Run("walk", 20, () => speed = Convert.ToDouble(baseline) * 3, () => speed = Convert.ToDouble(baseline), baseline);
            object repeated = effects.Baseline("walk", () => speed);
            effects.Run("walk", 20, () => speed = Convert.ToDouble(repeated) * 3, () => speed = -1, repeated);
            Check(speed == 10.5 && Convert.ToDouble(repeated) == 3.5, "Repeated multipliers must use the initial movement speed.");
            effects.Reset(); Check(speed == 3.5 && effects.Keys.Length == 0, "Canceling must restore the original movement speed.");
            effects.Run("broken", 1, () => {}, () => { throw new Exception("restore failed"); });
            effects.Run("good", 1, () => frozen = true, () => frozen = false);
            now = 27; effects.Tick();
            Check(errors.SequenceEqual(new[] { "broken" }) && !frozen && effects.Keys.Length == 0, "One failed restoration must not prevent another effect from ending.");
            try { effects.Run("apply-fails", 20, () => { frozen = true; throw new Exception(); }, () => frozen = false); } catch {}
            Check(!frozen && !effects.Active("apply-fails"), "A failed activation must roll back its state.");
            effects.Run("bounded", 1000, () => {}, () => {});
            Check(effects.Remaining("bounded") == 120, "Even a malformed duration must remain bounded.");
            effects.Reset();

            var first = new ShelfCompartment(EItemType.BasicCardPack, 1, 64);
            var large = new ShelfCompartment(EItemType.DeckBox, 0, 180);
            var full = new ShelfCompartment(EItemType.BasicCardPack, 32, 32);
            var unlabelled = new ShelfCompartment(EItemType.None, 0, 24);
            var storedBoxes = new ShelfCompartment(EItemType.BasicCardPack, 1, 8) { m_CanPutBox = true };
            Item previousItem = first.GetLastItem();
            int added = TcgShopOperations.Fill(new[] { first, large, full, unlabelled, storedBoxes });
            Check(added == 243, "Refilling must not stop at twenty-five items or one-hundred-fifty total.");
            Check(first.GetItemCount() == 64 && large.GetItemCount() == 180, "Every assigned shelf must reach its capacity.");
            Check(first.type == EItemType.BasicCardPack && previousItem.disabled, "Native reconstruction must retain the product and release previous pooled items.");
            Check(full.spawnCalls == 0 && unlabelled.spawnCalls == 0 && storedBoxes.spawnCalls == 0, "Full shelves, unassigned shelves and box storage must remain untouched.");
            TcgShopOperations.Empty(first);
            Check(first.GetItemCount() == 0 && first.GetItemType() == EItemType.BasicCardPack, "Emptying must keep the label so the same shelf can be refilled.");
            Check(TcgShopOperations.Fill(new[] { first }) == 64 && first.GetItemCount() == 64, "An emptied shelf must be refillable completely.");
            var failure = new ShelfCompartment(EItemType.DeckBox, 3, 40) { failNextSpawn = true };
            bool failed = false; try { TcgShopOperations.Fill(new[] { failure }); } catch { failed = true; }
            Check(failed && failure.GetItemCount() == 3 && failure.type == EItemType.DeckBox, "A native spawn failure must restore the previous stock.");

            var box = new InteractablePackagingBox();
            TcgShopOperations.LaunchBox(box, new UnityEngine.Vector3(1, 1, 0), 9);
            Check(box.physicsEnabled && !box.m_Rigidbody.isKinematic && box.m_Rigidbody.awake, "A settled carton must be made dynamic and awakened before the force.");
            Check(box.m_Rigidbody.mode == UnityEngine.ForceMode.VelocityChange, "A heavy carton must receive a visible change of velocity independent of its mass.");
            Check(Math.Abs(box.m_Rigidbody.force.magnitude - 9) < .001 && box.m_Rigidbody.torque.magnitude > 0, "Chaos must impart movement and rotation.");
            Console.WriteLine(checks + " runtime behavior checks passed");
            return 0;
        } catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
