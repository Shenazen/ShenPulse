// Domaine TimeEffects : meme classe plugin, methodes et champs conserves.
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
        private bool timeScaleActive;
        private float requestedTimeScale = 1f;
        private float previousTimeScale = 1f;
        private float timeScaleEndsAt;

        private string ApplyTimeScale(
            uint id,
            long durationMs,
            float multiplier
        )
        {
            long safeDuration = durationMs > 0 ? durationMs : 10000;
            if (!timeScaleActive)
            {
                previousTimeScale =
                    Time.timeScale > 0.01f ? Time.timeScale : 1f;
            }
            requestedTimeScale = multiplier;
            timeScaleEndsAt =
                Time.realtimeSinceStartup + safeDuration / 1000f;
            timeScaleActive = true;
            Time.timeScale = requestedTimeScale;
            return Response(id, 0, string.Empty, safeDuration);
        }

        private void RestoreTimeScale()
        {
            if (!timeScaleActive) return;
            Time.timeScale =
                previousTimeScale > 0.01f ? previousTimeScale : 1f;
            timeScaleActive = false;
            requestedTimeScale = 1f;
            timeScaleEndsAt = 0f;
        }
    }
}
