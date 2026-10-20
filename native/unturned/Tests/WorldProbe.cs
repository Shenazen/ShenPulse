using System;
using System.Collections;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;
using HarmonyLib;
using SDG.Framework.Modules;
using SDG.Unturned;
using ShenPulse.Unturned;
using UnityEngine;

// Explicit developer QA only. This assembly is never included in the installer archive.
public sealed class WorldProbeNexus : IModuleNexus
{
    private GameObject root;
    public void initialize()
    {
        root = new GameObject("ShenPulse.WorldQA");
        UnityEngine.Object.DontDestroyOnLoad(root);
        root.AddComponent<WorldProbe>();
    }
    public void shutdown() { if (root != null) UnityEngine.Object.Destroy(root); }
}

public sealed class WorldProbe : MonoBehaviour
{
    private static string testName;
    private string report;
    private Harmony harmony;
    private bool finished;
    private float deadline;

    private void Awake()
    {
        report = Environment.GetEnvironmentVariable("SHENPULSE_UNTURNED_QA_REPORT");
        if (String.IsNullOrEmpty(report)) { Destroy(gameObject); return; }
        testName = "ShenPulseQA_" + Guid.NewGuid().ToString("N");
        deadline = Time.realtimeSinceStartup + 220;
        Application.runInBackground = true;
        Application.targetFrameRate = 60;
        StartCoroutine(Guarded(Run()));
    }

    private void Update() { if (!finished && Time.realtimeSinceStartup > deadline) Finish("FAIL: game-world QA timed out."); }
    private IEnumerator Guarded(IEnumerator routine)
    {
        while (true)
        {
            object next;
            try { if (!routine.MoveNext()) break; next = routine.Current; }
            catch (Exception error) { Finish("FAIL: " + error); yield break; }
            yield return next;
        }
    }

    public static void IsolateLevel(ref LevelInfo newInfo)
    {
        newInfo = new LevelInfo(newInfo.path, testName, newInfo.size, newInfo.type, false, newInfo.configData, newInfo.publishedFileId, newInfo.hash);
    }

    private IEnumerator Run()
    {
        Log("Starting isolated QA map: " + testName);
        // Avoid connecting a developer test world to the user's real ShenPulse session.
        yield return null;
        var bridge = UnityEngine.Object.FindObjectOfType<Bridge>();
        if (bridge != null) Destroy(bridge);
        while (!Provider.isInitialized || Assets.isLoading || Level.getLevel("PEI") == null) yield return null;
        harmony = new Harmony("com.shenpulse.unturned.world-qa");
        harmony.Patch(typeof(Level).GetMethod("load"), prefix: new HarmonyMethod(typeof(WorldProbe).GetMethod("IsolateLevel")));
        Provider.map = "PEI";
        Provider.singleplayer(EGameMode.NORMAL, true);
        while (!Level.isLoaded || Level.isLoading || Player.LocalPlayer == null || Provider.clients.Count != 1) yield return null;
        var player = Player.LocalPlayer;
        Check(Level.info.name == testName, "QA must use a new map-save namespace.");
        yield return new WaitForSeconds(2);
        var outside = OutsidePoint();
        player.teleportToLocationUnsafe(outside, 0);
        yield return new WaitForSeconds(2);
        Check(player.movement.nav == byte.MaxValue && player.movement.bound == byte.MaxValue, "The test player must be outside every town and navmesh.");
        Log("Player is outside towns. Existing instantiated town zombies: " + ZombieManager.AllZombies.Count);
        player.life.serverModifyHealth(100);
        byte initialHealth = player.life.health;
        var before = ZombieManager.AllZombies.ToArray();
        Execute("spawn_enemy", new Parameters { radius = 5, speciality = 1 });
        var zombie = ZombieManager.AllZombies.Except(before).Single();
        Check(zombie.bound >= LevelNavigation.bounds.Count, "Gift zombies need their own unload-independent runtime region.");
        Check(zombie.isHunting, "The spawned zombie must target the survivor.");
        var start = zombie.transform.position;
        float distance = (start - player.transform.position).magnitude;
        yield return new WaitForSeconds(6);
        Check(zombie != null && !zombie.isDead && zombie.isHunting, "The zombie must keep hunting outside towns.");
        Check((start - zombie.transform.position).magnitude > 0.5f, "The zombie must actually move off-navmesh.");
        Check((zombie.transform.position - player.transform.position).magnitude < distance, "The zombie must approach the player.");
        Check(player.life.health < initialHealth, "The native zombie attack must damage the player.");
        Check(player.movement.nav == byte.MaxValue, "The player's real navigation state must be preserved.");
        Log("PASS: off-town spawn, movement, sustained pursuit, native attack damage and unchanged player navigation.");
        // Native damage is now proven. Keep the fixture alive while testing travel and other effects.
        Provider.modeConfigData.Zombies.Damage_Multiplier = 0;
        player.life.askHeal(100, true, true);
        var nearby = new List<Zombie>();
        ZombieManager.getZombiesInRadius(player.transform.position, 100, nearby);
        Check(nearby.Contains(zombie), "Native area queries must include off-navmesh zombies.");
        var health = typeof(Zombie).GetField("health", BindingFlags.Instance | BindingFlags.NonPublic);
        ushort beforeExplosion = (ushort)health.GetValue(zombie);
        Execute("boom", new Parameters { radius = 8, value = 5 });
        Check((ushort)health.GetValue(zombie) < beforeExplosion, "An actual explosion must damage an off-town zombie.");
        Log("PASS: off-town native area query and explosion damage.");

        ZombieManager.sendZombieDead(zombie, Vector3.up, ERagdollEffect.None);
        yield return null;
        Check(zombie.GetComponent<SpawnedZombie>() == null, "The temporary controller must be removed on death.");
        int regions = ZombieManager.regions.Length;
        Execute("spawn_enemy", new Parameters { radius = 5, speciality = 1 }, 3);
        Check(ZombieManager.regions.Length == regions, "Repeated gifts must reuse the runtime region.");
        var gifts = ZombieManager.AllZombies.Where(z => z != null && z.GetComponent<SpawnedZombie>() != null).ToArray();
        Check(gifts.Length == 3 && gifts.All(z => !z.isDead), "Dead gift zombies must be reusable without losing new appearances.");
        Log("PASS: death cleanup, repeated gift quantity and dead-slot reuse.");

        var town = LevelZombies.zombies.SelectMany(points => points).First(point => {
            byte navigation; return LevelNavigation.tryGetNavigation(point.point, out navigation);
        }).point;
        player.teleportToLocationUnsafe(town + Vector3.up, 0);
        yield return new WaitForSeconds(2);
        Check(player.movement.bound != byte.MaxValue, "The travel test must enter a native town region.");
        Execute("spawn_enemy", new Parameters { radius = 5, speciality = 1 });
        yield return new WaitForSeconds(1);
        player.teleportToLocationUnsafe(outside, 0);
        yield return new WaitForSeconds(2);
        Check(gifts.All(z => z != null && !z.isDead), "Entering and leaving a town must not delete gift zombies.");
        Log("PASS: town spawning and town-unload persistence.");

        Execute("spawn_animals", new Parameters { assetId = 1, radius = 6 });
        Execute("spawn_vehicles", new Parameters { assetId = 1, radius = 10 });
        Execute("give_item", new Parameters { assetId = 4 });
        Execute("drop_item", new Parameters { assetId = 4 });
        Execute("item_rain", new Parameters { assetId = 4, radius = 6 });
        Execute("airdrop", new Parameters());
        Execute("day", new Parameters());
        Execute("night", new Parameters());
        Execute("set_time", new Parameters { value = 50 });
        Execute("heal", new Parameters { value = 100 });
        Execute("food", new Parameters { value = -5 });
        Execute("water", new Parameters { value = -5 });
        Execute("virus", new Parameters { value = -5 });
        Execute("stamina", new Parameters { value = -5 });
        Execute("oxygen", new Parameters { value = -5 });
        Execute("add_experience", new Parameters { value = 50 });
        Execute("inventory_shuffle", new Parameters());
        Execute("set_weather", new Parameters { value = 1 });
        Execute("set_weather", new Parameters { value = 0 });
        Execute("kill_all_animals", new Parameters());
        Execute("kill_all_zombies", new Parameters());
        bool equipped = false;
        for (byte page = 0; page < PlayerInventory.STORAGE && !equipped; page++)
            for (byte index = 0; index < player.inventory.getItemCount(page); index++)
            {
                var jar = player.inventory.getItem(page, index);
                if (jar.item.id != 4) continue;
                if (page != 0) player.inventory.ReceiveDragItem(page, jar.x, jar.y, 0, 0, 0, 0);
                equipped = true;
                break;
            }
        Check(equipped, "The item-quality fixture must equip a real weapon.");
        player.equipment.ServerEquip(0, 0, 0);
        yield return new WaitForSeconds(1);
        Execute("break_item", new Parameters());
        Check(player.equipment.quality == 0, "Break item must change equipped quality.");
        Execute("repair_item", new Parameters());
        Check(player.equipment.quality == 100, "Repair item must restore equipped quality.");
        Execute("drop_all_items", new Parameters());
        var velocity = player.movement.pendingLaunchVelocity;
        Execute("slap", new Parameters { force = 2 });
        Check(player.movement.pendingLaunchVelocity.y > velocity.y, "Slap must enqueue a native player launch.");
        Execute("respawn", new Parameters());
        Log("PASS: off-town animals, vehicles, items, rain, player-directed airdrop, survival, time, weather and inventory interactions.");
        yield return new WaitForSeconds(1);
        Log("PASS: all 27 interaction codes executed in the isolated world.");
        Finish("PASS: isolated Unturned world QA completed.");
    }

    private static Vector3 OutsidePoint()
    {
        for (int x = -800; x <= 800; x += 40)
            for (int z = -800; z <= 800; z += 40)
            {
                RaycastHit hit;
                if (!Physics.Raycast(new Vector3(x, 500, z), Vector3.down, out hit, 800, RayMasks.BLOCK_COLLISION) || hit.normal.y < 0.9f) continue;
                var point = hit.point + Vector3.up;
                if (SDG.Framework.Water.WaterUtility.isPointUnderwater(point)) continue;
                byte bound;
                if (LevelNavigation.tryGetBounds(point, out bound) || LevelNavigation.tryGetNavigation(point, out bound)) continue;
                if (Physics.CheckCapsule(point + Vector3.up * 0.4f, point + Vector3.up * 1.5f, 0.3f, RayMasks.BLOCK_COLLISION)) continue;
                return point;
            }
        throw new Exception("No dry, open, off-town test terrain was found.");
    }

    private static void Execute(string code, Parameters parameters, int quantity = 1)
    {
        Effects.Execute(new Request { id = 1, type = 1, code = code, quantity = quantity, parameters = parameters });
    }
    private static void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
    private void Log(string message) { Debug.Log("[ShenPulse QA] " + message); File.AppendAllText(report, message + Environment.NewLine); }
    private void Finish(string message)
    {
        if (finished) return;
        finished = true;
        Log(message);
        Application.Quit(message.StartsWith("PASS:") ? 0 : 1);
    }
}
