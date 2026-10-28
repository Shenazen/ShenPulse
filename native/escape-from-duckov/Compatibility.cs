using System;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using HarmonyLib;
using ItemStatsSystem;
using ItemStatsSystem.Items;
using MelonLoader;
using UnityEngine;

[assembly: MelonGame("TeamSoda", "Duckov")]
[assembly: MelonInfo(typeof(ShenPulseDuckovCompatibility), "ShenPulse Duckov compatibility", "1.1.0", "ShenPulse")]
[assembly: MelonPriority(1000)]

// Keep the upstream module intact. Restrict this compatibility fix to the
// enemy-spawn coroutine; normal inventory and other mods keep their behavior.
public sealed class ShenPulseDuckovCompatibility : MelonMod
{
    [ThreadStatic] private static int spawnDepth;

    public override void OnInitializeMelon()
    {
        try
        {
            Assembly module = AppDomain.CurrentDomain.GetAssemblies().First(a => a.GetName().Name == "CrowdControl");
            HarmonyLib.Harmony connection = new HarmonyLib.Harmony("ShenPulse.Duckov.LocalBridge");
            Type network = module.GetType("CrowdControl.NetworkClient", true);
            if (!IsLocalEndpoint(network)) throw new InvalidOperationException("Install the ShenPulse pack with its dedicated local port.");
            connection.Patch(AccessTools.Method(network, "IsCrowdControlProcessRunning"),
                prefix: new HarmonyMethod(typeof(ShenPulseDuckovCompatibility), "UseLocalBridge"));
            LoggerInstance.Msg("ShenPulse local connection ready.");
            Type spawn = module.GetType("CrowdControl.Delegates.Effects.Implementations.Spawn", true);
            MethodInfo method = AccessTools.Method(spawn, "doSpawn");
            AsyncStateMachineAttribute machine = (AsyncStateMachineAttribute)Attribute.GetCustomAttribute(method, typeof(AsyncStateMachineAttribute));
            if (machine == null) throw new InvalidOperationException("Unsupported enemy-spawn implementation.");
            HarmonyLib.Harmony patch = new HarmonyLib.Harmony("ShenPulse.Duckov.Compatibility");
            patch.Patch(AccessTools.Method(machine.StateMachineType, "MoveNext"),
                prefix: new HarmonyMethod(typeof(ShenPulseDuckovCompatibility), "EnterSpawn"),
                finalizer: new HarmonyMethod(typeof(ShenPulseDuckovCompatibility), "LeaveSpawn"));
            patch.Patch(AccessTools.Method(typeof(Slot), "Plug"),
                prefix: new HarmonyMethod(typeof(ShenPulseDuckovCompatibility), "PlugSpawnWeapon"));
            LoggerInstance.Msg("Enemy weapon compatibility ready.");
        }
        catch (Exception error)
        {
            LoggerInstance.Error("Enemy weapon compatibility unavailable: " + error.Message);
        }
    }

    // Only our port-adapted module may skip the unrelated client's process gate.
    // The original TCP loop still handles refusal, disconnect and reconnect.
    private static bool IsLocalEndpoint(Type network)
    {
        FieldInfo host = network.GetField("CV_HOST", BindingFlags.Public | BindingFlags.Static);
        FieldInfo port = network.GetField("CV_PORT", BindingFlags.Public | BindingFlags.Static);
        return host != null && port != null && (string)host.GetValue(null) == "127.0.0.1" && (int)port.GetValue(null) == 58440;
    }
    private static bool UseLocalBridge(ref bool __result) { __result = true; return false; }

    private static void EnterSpawn() { spawnDepth++; }
    private static Exception LeaveSpawn(Exception __exception) { spawnDepth = Math.Max(0, spawnDepth - 1); return __exception; }

    private static bool PlugSpawnWeapon(Slot __instance, Item otherItem, ref Item unpluggedItem, ref bool __result)
    {
        if (spawnDepth == 0 || otherItem == null || __instance == null || __instance.CanPlug(otherItem)) return true;
        CharacterMainControl actor = UnityEngine.Object.FindObjectsOfType<CharacterMainControl>()
            .FirstOrDefault(c => c != null && c.CharacterItem == __instance.Master);
        if (actor == null || actor.IsMainCharacter || __instance != actor.MeleeWeaponSlot()) return true;
        Slot primary = actor.PrimWeaponSlot();
        if (primary == null || !primary.CanPlug(otherItem)) return true;
        __result = primary.Plug(otherItem, out unpluggedItem);
        return false;
    }
}
