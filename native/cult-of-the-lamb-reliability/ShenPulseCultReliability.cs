using BepInEx;
using BepInEx.Logging;
using HarmonyLib;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using System.Text.RegularExpressions;
using UnityEngine;

namespace ShenPulse.CultOfTheLamb
{
    [BepInPlugin(
        "ShenPulse.CultOfTheLamb.Reliability",
        "ShenPulse Cult of the Lamb Reliability",
        "1.2.3"
    )]
    [BepInDependency("ShenPulse.CultOfTheLamb.Bridge")]
    public sealed partial class ShenPulseCultReliability : BaseUnityPlugin
    {
        private static ShenPulseCultReliability instance;
        private Harmony harmony;

        private void Awake()
        {
            instance = this;
            Type bridgeType = FindType("ShenPulse.CultOfTheLamb.ShenPulseCultBridge");
            MethodInfo executeEffect = AccessTools.Method(bridgeType, "ExecuteEffect");
            MethodInfo prefix = AccessTools.Method(
                typeof(ShenPulseCultReliability),
                "ExecuteEffectPrefix"
            );
            if (executeEffect == null || prefix == null)
            {
                throw new MissingMethodException(
                    bridgeType.FullName,
                    "ExecuteEffect"
                );
            }
            harmony = new Harmony(
                "ShenPulse.CultOfTheLamb.Reliability.Patches"
            );
            harmony.Patch(executeEffect, new HarmonyMethod(prefix));
            Logger.LogInfo(
                "Correctifs de fiabilite ShenPulse 1.2.3 charges."
            );
        }

        private void OnDestroy()
        {
            RestoreTimeScale();
            ClearFrozenEnemies();
            if (harmony != null) harmony.UnpatchSelf();
            if (ReferenceEquals(instance, this)) instance = null;
        }

        private void Update()
        {
            if (timeScaleActive)
            {
                if (Time.realtimeSinceStartup >= timeScaleEndsAt)
                {
                    RestoreTimeScale();
                }
                else
                {
                    // Cult of the Lamb reimpose parfois sa propre valeur.
                    // La valeur ShenPulse doit donc rester stable tout l'effet.
                    Time.timeScale = requestedTimeScale;
                }
            }

            if (freezeActive)
            {
                if (Time.realtimeSinceStartup >= freezeEndsAt)
                {
                    ClearFrozenEnemies();
                }
                else
                {
                    FreezeCurrentEnemies();
                }
            }

            if (Time.realtimeSinceStartup < barrierScanEndsAt)
            {
                ExtendSpawnedBarriers();
            }
        }
    }
}
