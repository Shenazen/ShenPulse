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
[assembly: MelonInfo(typeof(ShenPulseDuckovCompatibility), "ShenPulse Duckov compatibility", "1.0.0", "ShenPulse")]
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
