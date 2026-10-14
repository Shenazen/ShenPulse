// Domaine Interception : meme classe plugin, methodes et champs conserves.
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
        private static bool ExecuteEffectPrefix(
            string rawRequest,
            string code,
            uint id,
            long durationMs,
            ref string __result
        )
        {
            if (instance == null) return true;
            try
            {
                return instance.Intercept(
                    rawRequest,
                    (code ?? string.Empty).Trim().ToLowerInvariant(),
                    id,
                    durationMs,
                    ref __result
                );
            }
            catch (Exception error)
            {
                string message = RootMessage(error);
                instance.Logger.LogError(
                    "Interaction corrigee en echec: " + message
                );
                __result = Response(id, 3, message, 0);
                return false;
            }
        }

        private bool Intercept(
            string rawRequest,
            string code,
            uint id,
            long durationMs,
            ref string result
        )
        {
            if (code == "speedup" || code == "slowdown")
            {
                result = ApplyTimeScale(
                    id,
                    durationMs,
                    code == "speedup" ? 2f : 0.5f
                );
                return false;
            }
            if (code == "addfollower")
            {
                result = AddFollower(id);
                return false;
            }
            if (code == "spawn" || code == "spawnhelp")
            {
                result = SpawnEnemies(rawRequest, id);
                return false;
            }
            if (code == "freezeenemies")
            {
                result = FreezeEnemies(id, durationMs);
                return false;
            }
            if (code.StartsWith("weapon_", StringComparison.Ordinal))
            {
                result = SetWeapon(rawRequest, code, id);
                return false;
            }
            if (code == "givetarot")
            {
                result = GiveTarot(id);
                return false;
            }
            if (code == "killenemies"
                || code == "killenemy"
                || code == "killboss")
            {
                result = KillEnemies(id);
                return false;
            }
            if (code == "kill")
            {
                result = KillPlayer(id);
                return false;
            }
            if (code == "castteleport")
            {
                PrepareTeleportTarget();
                return true;
            }
            if (code == "castbarrier")
            {
                PrepareBarrierExtension(durationMs);
                return true;
            }
            if (code == "teleup"
                || code == "teledown"
                || code == "teleleft"
                || code == "teleright")
            {
                result = MoveToAdjacentRoom(code, id);
                return false;
            }
            return true;
        }
    }
}
