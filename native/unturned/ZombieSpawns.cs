using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Reflection.Emit;
using HarmonyLib;
using SDG.Unturned;
using UnityEngine;

namespace ShenPulse.Unturned
{
    // Only zombies created by ShenPulse receive this behaviour. The map's zombies are untouched.
    public static class ZombieSpawns
    {
        private static readonly HashSet<Zombie> owned = new HashSet<Zombie>();
        private static readonly FieldInfo seekerField = typeof(Zombie).GetField("seeker", BindingFlags.Instance | BindingFlags.NonPublic);
        private static readonly FieldInfo regionsField = typeof(ZombieManager).GetField("_regions", BindingFlags.Static | BindingFlags.NonPublic);
        private static readonly Action<Zombie> update = (Action<Zombie>)Delegate.CreateDelegate(typeof(Action<Zombie>), typeof(Zombie).GetMethod("OnUpdate", BindingFlags.Instance | BindingFlags.NonPublic));
        private static Harmony harmony;
        private static ZombieRegion spawnRegion;

        public static void Spawn(Player player, Request request, List<Vector3> points)
        {
            EnsurePatched();
            if (owned.Count(z => z != null && !z.isDead) + points.Count > 256)
                throw new InvalidOperationException("La limite de 256 zombies ShenPulse encore en vie est atteinte.");
            var templates = points.Select(Template).ToArray();
            var region = GetRegion();
            for (int i = 0; i < points.Count; i++)
            {
                byte type = templates[i];
                var table = LevelZombies.tables[type];
                byte shirt = Clothing(table, 0), pants = Clothing(table, 1), hat = Clothing(table, 2), gear = Clothing(table, 3);
                var zombie = region.zombies.FirstOrDefault(z => z != null && z.isDead);
                if (zombie != null)
                {
                    var previous = zombie.GetComponent<SpawnedZombie>();
                    if (previous != null) { previous.Release(); UnityEngine.Object.Destroy(previous); }
                    zombie.sendRevive(type, (byte)request.parameters.speciality, shirt, pants, hat, gear, points[i], 0);
                }
                else
                {
                    ZombieManager.instance.addZombie(region.nav, type, (byte)request.parameters.speciality,
                        shirt, pants, hat, gear, 0, 0, points[i], 0, false);
                    zombie = region.zombies[region.zombies.Count - 1];
                }
                var original = (IUnturnedPathfindingMovementComponentInterface)seekerField.GetValue(zombie);
                var movement = new RoamingMovement(zombie, original);
                seekerField.SetValue(zombie, movement);
                var companion = zombie.gameObject.AddComponent<SpawnedZombie>();
                companion.Initialize(zombie, movement);
                owned.Add(zombie);
                zombie.alert(player);
            }
        }

        private static byte Template(Vector3 point)
        {
            if (LevelZombies.tables == null || LevelZombies.tables.Count == 0)
                throw new InvalidOperationException("Cette carte ne contient aucun modèle de zombie disponible.");
            byte closest = 0;
            float distance = float.PositiveInfinity;
            // Singleplayer creates and destroys town zombies when entering/leaving. Use map spawn
            // definitions rather than requiring a currently instantiated zombie in another town.
            foreach (var region in LevelZombies.zombies)
            {
                if (region == null) continue;
                foreach (var candidate in region)
                {
                    if (candidate.type >= LevelZombies.tables.Count) continue;
                    float next = (candidate.point - point).sqrMagnitude;
                    if (next < distance) { closest = candidate.type; distance = next; }
                }
            }
            return closest;
        }

        private static byte Clothing(ZombieTable table, int slot)
        {
            var clothes = table.slots[slot];
            return clothes.table.Count > 0 && UnityEngine.Random.value < clothes.chance
                ? (byte)UnityEngine.Random.Range(0, clothes.table.Count) : byte.MaxValue;
        }

        private static ZombieRegion GetRegion()
        {
            var regions = ZombieManager.regions;
            if (spawnRegion != null && regions.Contains(spawnRegion)) return spawnRegion;
            if (regions.Length >= byte.MaxValue) throw new InvalidOperationException("Cette carte possède trop de régions de zombies.");
            spawnRegion = new ZombieRegion((byte)regions.Length);
            var expanded = new ZombieRegion[regions.Length + 1];
            Array.Copy(regions, expanded, regions.Length);
            expanded[regions.Length] = spawnRegion;
            regionsField.SetValue(null, expanded);
            spawnRegion.init();
            // A separate runtime-only region prevents town unloading from deleting gift zombies.
            return spawnRegion;
        }

        private static void EnsurePatched()
        {
            if (harmony != null) return;
            if (seekerField == null || regionsField == null || update == null) throw new InvalidOperationException("Version Unturned incompatible avec les apparitions.");
            var instance = new Harmony("com.shenpulse.unturned.roaming");
            try
            {
                instance.Patch(typeof(Zombie).GetMethod("tick"), transpiler: new HarmonyMethod(typeof(ZombieSpawns).GetMethod("KeepChasing")));
                instance.Patch(typeof(ZombieManager).GetMethod("getZombiesInRadius"), postfix: new HarmonyMethod(typeof(ZombieSpawns).GetMethod("IncludeRoamingZombies")));
            }
            catch
            {
                instance.Unpatch(typeof(Zombie).GetMethod("tick"), HarmonyPatchType.Transpiler, instance.Id);
                throw;
            }
            harmony = instance;
        }

        public static void IncludeRoamingZombies(Vector3 center, float sqrRadius, List<Zombie> result)
        {
            if (!Provider.isServer || Provider.clients.Count != 1) return;
            foreach (var zombie in owned)
                if (zombie != null && !zombie.isDead && (zombie.transform.position - center).sqrMagnitude < sqrRadius && !result.Contains(zombie))
                    result.Add(zombie);
        }

        public static IEnumerable<CodeInstruction> KeepChasing(IEnumerable<CodeInstruction> instructions)
        {
            var getter = typeof(PlayerMovement).GetProperty("nav").GetGetMethod();
            var replacement = typeof(ZombieSpawns).GetMethod("NavigationForZombie");
            int matched = 0;
            foreach (var instruction in instructions)
            {
                if (instruction.Calls(getter))
                {
                    matched++;
                    var self = new CodeInstruction(OpCodes.Ldarg_0);
                    self.labels.AddRange(instruction.labels);
                    self.blocks.AddRange(instruction.blocks);
                    yield return self;
                    yield return new CodeInstruction(OpCodes.Call, replacement);
                }
                else yield return instruction;
            }
            if (matched != 1) throw new InvalidOperationException("La logique de poursuite de cette version Unturned a changé.");
        }

        public static byte NavigationForZombie(PlayerMovement movement, Zombie zombie)
        {
            byte navigation = movement.nav;
            // Change only the decision in Zombie.tick, never the player's real navigation state.
            return navigation == byte.MaxValue && Provider.isServer && Provider.clients.Count == 1 && owned.Contains(zombie)
                ? zombie.bound : navigation;
        }

        public static void UpdateOutsideRegion(Zombie zombie)
        {
            var player = Player.LocalPlayer;
            if (Level.isLoaded && Provider.isServer && Provider.clients.Count == 1 && player != null && player.movement.bound != zombie.bound)
            {
                update(zombie);
                if (LevelNavigation.bounds.Count == 0 || LevelZombies.zombies.Length == 0) zombie.tick();
            }
        }

        public static void Release(Zombie zombie, RoamingMovement movement)
        {
            owned.Remove(zombie);
            if (zombie != null && ReferenceEquals(seekerField.GetValue(zombie), movement)) seekerField.SetValue(zombie, movement.Original);
            movement.Dispose();
        }

        public static void Shutdown()
        {
            foreach (var zombie in owned.ToArray())
                if (zombie != null) { var companion = zombie.GetComponent<SpawnedZombie>(); if (companion != null) companion.Release(); }
            owned.Clear();
            if (harmony != null)
            {
                harmony.Unpatch(typeof(Zombie).GetMethod("tick"), HarmonyPatchType.Transpiler, harmony.Id);
                harmony.Unpatch(typeof(ZombieManager).GetMethod("getZombiesInRadius"), HarmonyPatchType.Postfix, harmony.Id);
                harmony = null;
            }
        }
    }

    public sealed class SpawnedZombie : MonoBehaviour
    {
        private Zombie zombie;
        private RoamingMovement movement;
        public void Initialize(Zombie value, RoamingMovement controller) { zombie = value; movement = controller; }
        private void LateUpdate()
        {
            if (zombie == null || zombie.isDead) { Release(); Destroy(this); return; }
            ZombieSpawns.UpdateOutsideRegion(zombie);
        }
        public void Release()
        {
            if (movement == null) return;
            ZombieSpawns.Release(zombie, movement);
            movement = null;
        }
        private void OnDestroy() { Release(); }
    }
}
