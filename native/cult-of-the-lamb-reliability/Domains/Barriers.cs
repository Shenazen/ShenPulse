// Domaine Barriers : meme classe plugin, methodes et champs conserves.
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
    public sealed partial class ShenPulseCultReliability
    {
        private float barrierDurationSeconds;
        private float barrierScanEndsAt;
        private readonly List<object> patchedBarriers = new List<object>();

        private void PrepareBarrierExtension(long durationMs)
        {
            barrierDurationSeconds = Math.Max(
                3f,
                (durationMs > 0 ? durationMs : 10000) / 1000f
            );
            barrierScanEndsAt = Time.realtimeSinceStartup + 2f;
            patchedBarriers.Clear();
        }

        private void ExtendSpawnedBarriers()
        {
            Type barrierType;
            try
            {
                barrierType = FindType("BarrierAbility");
            }
            catch
            {
                return;
            }
            UnityEngine.Object[] barriers =
                UnityEngine.Object.FindObjectsOfType(barrierType);
            for (int index = 0; index < barriers.Length; index += 1)
            {
                object barrier = barriers[index];
                if (barrier == null || patchedBarriers.Contains(barrier))
                {
                    continue;
                }
                SetMemberIfPresent(
                    barrier,
                    "activeTime",
                    barrierDurationSeconds
                );
                SetMemberIfPresent(barrier, "activeTimer", 0f);
                patchedBarriers.Add(barrier);
            }
        }
    }
}
