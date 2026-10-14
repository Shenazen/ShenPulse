// Domaine Dungeon : meme classe plugin, methodes et champs conserves.
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
        private static string MoveToAdjacentRoom(
            string code,
            uint id
        )
        {
            if (!IsDungeonRoomReady())
            {
                return Response(
                    id,
                    3,
                    "Attends que la salle de croisade soit completement chargee.",
                    0
                );
            }
            object teleportDisabled = ReadStaticMember(
                FindType("ActivateMiniMap"),
                "DisableTeleporting"
            );
            if (teleportDisabled != null
                && Convert.ToBoolean(teleportDisabled))
            {
                return Response(
                    id,
                    3,
                    "Le changement de salle est temporairement verrouille.",
                    0
                );
            }

            int dx = code == "teleleft" ? -1
                : code == "teleright" ? 1
                : 0;
            int dy = code == "teleup" ? -1
                : code == "teledown" ? 1
                : 0;
            object generator = ReadStaticMember(
                FindType("MMBiomeGeneration.BiomeGenerator"),
                "Instance"
            );
            object room = ReadMember(generator, "CurrentRoom");
            int x = Convert.ToInt32(ReadMember(room, "x"));
            int y = Convert.ToInt32(ReadMember(room, "y"));
            object target = InvokeStatic(
                FindType("MMBiomeGeneration.BiomeRoom"),
                "GetRoom",
                x + dx,
                y + dy
            );
            if (target == null)
            {
                return Response(
                    id,
                    3,
                    "Aucune salle accessible n'existe dans cette direction.",
                    0
                );
            }

            InvokeStatic(
                FindType("MMBiomeGeneration.BiomeGenerator"),
                "ChangeRoom",
                new Vector2Int(dx, dy)
            );
            object roomManager = ReadStaticMember(
                FindType("RoomManager"),
                "Instance"
            );
            if (roomManager != null)
            {
                InvokeInstance(
                    roomManager,
                    "PlaceAndPositionPlayer",
                    true
                );
            }
            return Response(id, 0, string.Empty, 0);
        }

        private static void PrepareTeleportTarget()
        {
            GameObject player = GameObject.FindWithTag("Player");
            object playerFarming = ReadStaticMember(
                FindType("PlayerFarming"),
                "Instance"
            );
            object spells = ReadMember(playerFarming, "playerSpells");
            object state = ReadMember(spells, "state");
            if (player == null || spells == null || state == null) return;

            float angle = Convert.ToSingle(ReadMember(state, "LookAngle"));
            object vectorValue = InvokeStatic(
                FindType("Utils"),
                "DegreeToVector2",
                angle
            );
            Vector2 direction =
                vectorValue is Vector2
                    ? (Vector2)vectorValue
                    : Vector2.right;
            if (direction.sqrMagnitude < 0.01f)
            {
                direction = Vector2.right;
            }
            direction.Normalize();
            SetMember(
                spells,
                "targetPosition",
                player.transform.position
                    + new Vector3(direction.x, direction.y, 0f) * 6f
            );
        }

        private static bool IsDungeonRoomReady()
        {
            object generator = ReadStaticMember(
                FindType("MMBiomeGeneration.BiomeGenerator"),
                "Instance"
            );
            object room = ReadMember(generator, "CurrentRoom");
            return generator != null
                && room != null
                && GameObject.FindWithTag("Player") != null;
        }
    }
}
