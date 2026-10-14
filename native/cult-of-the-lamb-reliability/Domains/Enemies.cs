// Domaine Enemies : meme classe plugin, methodes et champs conserves.
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
        private bool freezeActive;
        private float freezeEndsAt;
        private readonly List<object> frozenEnemies = new List<object>();

        private static string SpawnEnemies(string rawRequest, uint id)
        {
            if (!IsDungeonRoomReady())
            {
                return Response(
                    id,
                    3,
                    "Entre dans une salle de croisade avec au moins un ennemi actif.",
                    0
                );
            }
            GameObject player = GameObject.FindWithTag("Player");
            object objectPool = ReadStaticMember(
                FindType("ObjectPool"),
                "instance"
            );
            IDictionary spawnedObjects =
                objectPool == null
                    ? null
                    : InvokeInstance(
                        objectPool,
                        "GetSpawnedObjectsDictionary"
                    ) as IDictionary;
            if (player == null || spawnedObjects == null)
            {
                return Response(
                    id,
                    3,
                    "La salle de combat n'est pas encore prete.",
                    0
                );
            }

            GameObject activeRoot = null;
            GameObject prefab = null;
            foreach (object health in CurrentEnemies())
            {
                Component component = health as Component;
                if (component == null) continue;
                foreach (DictionaryEntry entry in spawnedObjects)
                {
                    GameObject key = entry.Key as GameObject;
                    GameObject value = entry.Value as GameObject;
                    if (key != null
                        && component.transform.IsChildOf(key.transform))
                    {
                        activeRoot = key;
                        prefab = value;
                        break;
                    }
                    if (value != null
                        && component.transform.IsChildOf(value.transform))
                    {
                        activeRoot = value;
                        prefab = key;
                        break;
                    }
                }
                if (prefab != null) break;

                Component enemyRoot =
                    component.GetComponentInParent(FindType("Enemy"));
                activeRoot =
                    enemyRoot == null
                        ? component.gameObject
                        : enemyRoot.gameObject;
            }
            if (activeRoot == null)
            {
                return Response(
                    id,
                    3,
                    "Aucun ennemi actif ne peut servir de modele dans cette salle.",
                    0
                );
            }

            int count = Math.Max(
                1,
                Math.Min(20, (int)ReadLong(rawRequest, "count", 3))
            );
            int spawned = 0;
            Transform parent =
                activeRoot.transform.parent ?? activeRoot.transform;
            for (int index = 0; index < count; index += 1)
            {
                Vector2 offset =
                    UnityEngine.Random.insideUnitCircle
                    * (2.2f + index % 3);
                Vector3 position =
                    player.transform.position
                    + new Vector3(offset.x, offset.y, 0f);
                object created;
                if (prefab != null)
                {
                    created = InvokeStatic(
                        FindType("EnemySpawner"),
                        "Create",
                        position,
                        parent,
                        prefab
                    );
                    if (created == null)
                    {
                        created = InvokeInstance(
                            objectPool,
                            "Spawn",
                            prefab,
                            parent,
                            position
                        );
                    }
                }
                else
                {
                    created = UnityEngine.Object.Instantiate(
                        activeRoot,
                        position,
                        activeRoot.transform.rotation,
                        parent
                    );
                    GameObject clone = created as GameObject;
                    if (clone != null)
                    {
                        clone.name =
                            activeRoot.name + " (ShenPulse)";
                        clone.SetActive(true);
                    }
                }
                if (created != null) spawned += 1;
            }
            return spawned > 0
                ? Response(id, 0, string.Empty, 0)
                : Response(
                    id,
                    3,
                    "Les ennemis n'ont pas pu apparaitre dans cette salle.",
                    0
                );
        }

        private string FreezeEnemies(uint id, long durationMs)
        {
            if (!IsDungeonRoomReady())
            {
                return Response(
                    id,
                    3,
                    "Entre dans une salle de croisade avec des ennemis actifs.",
                    0
                );
            }
            long safeDuration = durationMs > 0 ? durationMs : 10000;
            if (!FreezeCurrentEnemies())
            {
                return Response(
                    id,
                    3,
                    "Aucun ennemi actif ne peut etre gele.",
                    0
                );
            }
            freezeEndsAt =
                Time.realtimeSinceStartup + safeDuration / 1000f;
            freezeActive = true;
            return Response(id, 0, string.Empty, safeDuration);
        }

        private bool FreezeCurrentEnemies()
        {
            bool found = false;
            foreach (object enemy in CurrentEnemies())
            {
                found = true;
                if (frozenEnemies.Contains(enemy)) continue;
                InvokeInstance(enemy, "AddFreezeTime", 1f);
                frozenEnemies.Add(enemy);
            }
            return found;
        }

        private void ClearFrozenEnemies()
        {
            for (int index = 0; index < frozenEnemies.Count; index += 1)
            {
                try
                {
                    InvokeInstance(
                        frozenEnemies[index],
                        "ClearFreezeTime"
                    );
                }
                catch
                {
                }
            }
            frozenEnemies.Clear();
            freezeActive = false;
            freezeEndsAt = 0f;
        }

        private static string KillEnemies(uint id)
        {
            if (!IsDungeonRoomReady())
            {
                return Response(
                    id,
                    3,
                    "Entre dans une salle de croisade avec des ennemis actifs.",
                    0
                );
            }
            GameObject player = GameObject.FindWithTag("Player");
            int killed = 0;
            foreach (object enemy in CurrentEnemies())
            {
                if (ForceKill(enemy, player)) killed += 1;
            }
            return killed > 0
                ? Response(id, 0, string.Empty, 0)
                : Response(
                    id,
                    3,
                    "Aucun ennemi actif n'a pu etre elimine.",
                    0
                );
        }

        private static IEnumerable<object> CurrentEnemies()
        {
            IEnumerable team = ReadStaticMember(
                FindType("Health"),
                "team2"
            ) as IEnumerable;
            if (team == null) yield break;
            foreach (object enemy in team)
            {
                Component component = enemy as Component;
                if (component == null
                    || !component.gameObject.activeInHierarchy
                    || !IsAlive(enemy))
                {
                    continue;
                }
                yield return enemy;
            }
        }

        private static bool IsAlive(object health)
        {
            try
            {
                return Convert.ToSingle(
                    ReadMember(health, "CurrentHP")
                ) > 0f;
            }
            catch
            {
                return false;
            }
        }
    }
}
