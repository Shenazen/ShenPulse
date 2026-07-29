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
    public sealed class ShenPulseCultReliability : BaseUnityPlugin
    {
        private static ShenPulseCultReliability instance;
        private Harmony harmony;

        private bool timeScaleActive;
        private float requestedTimeScale = 1f;
        private float previousTimeScale = 1f;
        private float timeScaleEndsAt;

        private bool freezeActive;
        private float freezeEndsAt;
        private readonly List<object> frozenEnemies = new List<object>();

        private float barrierDurationSeconds;
        private float barrierScanEndsAt;
        private readonly List<object> patchedBarriers = new List<object>();

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

        private static string AddFollower(uint id)
        {
            object playerFarming = ReadStaticMember(
                FindType("PlayerFarming"),
                "Instance"
            );
            object location = ReadStaticMember(
                FindType("PlayerFarming"),
                "Location"
            );
            Component player = playerFarming as Component;
            if (player == null || location == null)
            {
                return Response(
                    id,
                    3,
                    "Charge le village du culte avant d'ajouter un fidele.",
                    0
                );
            }
            if (Convert.ToInt32(location) != 1)
            {
                return Response(
                    id,
                    3,
                    "Cette interaction doit etre lancee au village du culte.",
                    0
                );
            }

            Vector3 spawnPosition =
                player.transform.position + new Vector3(1.5f, 0f, 0f);
            object follower = InvokeStatic(
                FindType("FollowerManager"),
                "CreateNewFollower",
                location,
                spawnPosition,
                true
            );
            if (follower == null)
            {
                return Response(
                    id,
                    3,
                    "Le village n'a pas pu creer le nouveau fidele.",
                    0
                );
            }
            return Response(id, 0, string.Empty, 0);
        }

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

        private static string SetWeapon(
            string rawRequest,
            string code,
            uint id
        )
        {
            if (!IsDungeonRoomReady())
            {
                return Response(
                    id,
                    3,
                    "Le changement d'arme doit etre utilise pendant une croisade.",
                    0
                );
            }
            int weaponValue;
            if (!int.TryParse(
                code.Substring("weapon_".Length),
                out weaponValue
            ))
            {
                return Response(id, 2, "Arme ShenPulse inconnue.", 0);
            }

            object playerFarming = ReadStaticMember(
                FindType("PlayerFarming"),
                "Instance"
            );
            object playerWeapon = ReadMember(
                playerFarming,
                "playerWeapon"
            );
            if (playerWeapon == null)
            {
                return Response(
                    id,
                    3,
                    "L'arme n'est pas encore disponible dans cette salle.",
                    0
                );
            }

            int level = Math.Max(
                1,
                Math.Min(10, (int)ReadLong(rawRequest, "level", 3))
            );
            object weapon = Enum.ToObject(
                FindType("EquipmentType"),
                weaponValue
            );
            object dataManager = ReadStaticMember(
                FindType("DataManager"),
                "Instance"
            );
            if (dataManager != null)
            {
                SetMember(dataManager, "CurrentRunWeaponLevel", level);
            }
            InvokeInstance(playerWeapon, "SetWeapon", weapon, level);

            try
            {
                object currentWeaponInfo = ReadMember(
                    playerFarming,
                    "CurrentWeaponInfo"
                );
                object weaponData = ReadMember(
                    currentWeaponInfo,
                    "WeaponData"
                );
                string animation = Convert.ToString(
                    ReadMember(weaponData, "PickupAnimationKey")
                );
                object spine = ReadMember(playerFarming, "Spine");
                object animationState = ReadMember(
                    spine,
                    "AnimationState"
                );
                if (!string.IsNullOrEmpty(animation))
                {
                    InvokeInstance(
                        animationState,
                        "SetAnimation",
                        0,
                        animation,
                        false
                    );
                }
            }
            catch
            {
                // L'arme est deja equipee ; l'animation est seulement visuelle.
            }
            return Response(id, 0, string.Empty, 0);
        }

        private static string GiveTarot(uint id)
        {
            if (!IsDungeonRoomReady())
            {
                return Response(
                    id,
                    3,
                    "La carte de tarot doit etre donnee pendant une croisade.",
                    0
                );
            }
            object playerFarming = ReadStaticMember(
                FindType("PlayerFarming"),
                "Instance"
            );
            if (playerFarming == null)
            {
                return Response(
                    id,
                    3,
                    "Le joueur n'est pas encore charge.",
                    0
                );
            }
            object card = InvokeStatic(
                FindType("TarotCards"),
                "DrawRandomCard",
                playerFarming,
                true
            );
            if (card == null)
            {
                return Response(
                    id,
                    3,
                    "Aucune nouvelle carte de tarot n'est disponible.",
                    0
                );
            }
            InvokeStatic(
                FindType("TrinketManager"),
                "AddTrinket",
                card,
                playerFarming
            );
            return Response(id, 0, string.Empty, 0);
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

        private static string KillPlayer(uint id)
        {
            if (!IsDungeonRoomReady())
            {
                return Response(
                    id,
                    3,
                    "L'elimination de l'agneau doit etre testee pendant une croisade.",
                    0
                );
            }
            GameObject player = GameObject.FindWithTag("Player");
            object health =
                player == null
                    ? null
                    : player.GetComponent(FindType("Health"));
            if (health == null || !IsAlive(health))
            {
                return Response(
                    id,
                    3,
                    "L'agneau n'est pas dans un etat ou il peut etre elimine.",
                    0
                );
            }
            return ForceKill(health, player)
                ? Response(id, 0, string.Empty, 0)
                : Response(
                    id,
                    3,
                    "Le jeu a empeche l'elimination de l'agneau.",
                    0
                );
        }

        private static bool ForceKill(object health, GameObject attacker)
        {
            Component component = health as Component;
            if (component == null) return false;
            try
            {
                PropertyInfo enabledProperty = component.GetType()
                    .GetProperty(
                        "enabled",
                        BindingFlags.Public | BindingFlags.Instance
                    );
                if (enabledProperty != null)
                {
                    enabledProperty.SetValue(component, true, null);
                }
                SetMemberIfPresent(health, "invincible", false);
                SetMemberIfPresent(health, "untouchable", false);
                SetMemberIfPresent(
                    health,
                    "GodMode",
                    Enum.ToObject(FindType("Health+CheatMode"), 0)
                );
                object attackType = Enum.ToObject(
                    FindType("Health+AttackTypes"),
                    9
                );
                object forceKill = Enum.ToObject(
                    FindType("Health+AttackFlags"),
                    2048
                );
                GameObject source =
                    attacker == null ? component.gameObject : attacker;
                InvokeInstance(
                    health,
                    "DealDamage",
                    float.PositiveInfinity,
                    source,
                    component.transform.position,
                    false,
                    attackType,
                    false,
                    forceKill
                );
                bool damageOrderAccepted = true;
                if (IsAlive(health))
                {
                    SetMemberIfPresent(health, "HP", 1f);
                    InvokeInstance(
                        health,
                        "DealDamage",
                        float.PositiveInfinity,
                        source,
                        component.transform.position,
                        false,
                        attackType,
                        false,
                        forceKill
                    );
                }
                // Cult of the Lamb termine la mort et désactive le composant
                // pendant sa mise à jour suivante. Le retour réseau doit
                // confirmer l'ordre immédiatement au lieu de le classer en
                // échec alors que l'ennemi disparaît juste après.
                return damageOrderAccepted;
            }
            catch
            {
                return false;
            }
        }

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

        private static Type FindType(string fullName)
        {
            Assembly[] assemblies = AppDomain.CurrentDomain.GetAssemblies();
            for (int index = 0; index < assemblies.Length; index += 1)
            {
                Type type = assemblies[index].GetType(fullName, false);
                if (type != null) return type;
            }
            throw new TypeLoadException(fullName);
        }

        private static object ReadStaticMember(Type type, string name)
        {
            const BindingFlags flags =
                BindingFlags.Public
                | BindingFlags.NonPublic
                | BindingFlags.Static
                | BindingFlags.IgnoreCase;
            FieldInfo field = type.GetField(name, flags);
            if (field != null) return field.GetValue(null);
            PropertyInfo property = type.GetProperty(name, flags);
            return property == null
                ? null
                : property.GetValue(null, null);
        }

        private static object ReadMember(object target, string name)
        {
            if (target == null) return null;
            const BindingFlags flags =
                BindingFlags.Public
                | BindingFlags.NonPublic
                | BindingFlags.Instance
                | BindingFlags.IgnoreCase;
            Type type = target.GetType();
            FieldInfo field = type.GetField(name, flags);
            if (field != null) return field.GetValue(target);
            PropertyInfo property = type.GetProperty(name, flags);
            return property == null
                ? null
                : property.GetValue(target, null);
        }

        private static void SetMember(
            object target,
            string name,
            object value
        )
        {
            if (target == null) throw new NullReferenceException(name);
            const BindingFlags flags =
                BindingFlags.Public
                | BindingFlags.NonPublic
                | BindingFlags.Instance
                | BindingFlags.IgnoreCase;
            Type type = target.GetType();
            FieldInfo field = type.GetField(name, flags);
            if (field != null)
            {
                field.SetValue(target, value);
                return;
            }
            PropertyInfo property = type.GetProperty(name, flags);
            if (property == null || !property.CanWrite)
            {
                throw new MissingMemberException(type.FullName, name);
            }
            property.SetValue(target, value, null);
        }

        private static void SetMemberIfPresent(
            object target,
            string name,
            object value
        )
        {
            try
            {
                SetMember(target, name, value);
            }
            catch
            {
            }
        }

        private static object InvokeStatic(
            Type type,
            string name,
            params object[] arguments
        )
        {
            return InvokeBest(type, null, name, true, arguments);
        }

        private static object InvokeInstance(
            object target,
            string name,
            params object[] arguments
        )
        {
            if (target == null) throw new NullReferenceException(name);
            return InvokeBest(
                target.GetType(),
                target,
                name,
                false,
                arguments
            );
        }

        private static object InvokeBest(
            Type type,
            object target,
            string name,
            bool isStatic,
            object[] arguments
        )
        {
            BindingFlags flags =
                BindingFlags.Public
                | BindingFlags.NonPublic
                | (isStatic
                    ? BindingFlags.Static
                    : BindingFlags.Instance);
            MethodInfo[] methods = type.GetMethods(flags);
            for (int index = 0; index < methods.Length; index += 1)
            {
                MethodInfo method = methods[index];
                if (method.Name != name
                    || method.GetParameters().Length != arguments.Length)
                {
                    continue;
                }
                ParameterInfo[] parameters = method.GetParameters();
                bool compatible = true;
                for (
                    int parameterIndex = 0;
                    parameterIndex < parameters.Length;
                    parameterIndex += 1
                )
                {
                    object argument = arguments[parameterIndex];
                    Type parameterType =
                        parameters[parameterIndex].ParameterType;
                    if (argument == null)
                    {
                        compatible =
                            !parameterType.IsValueType
                            || Nullable.GetUnderlyingType(parameterType)
                                != null;
                    }
                    else
                    {
                        compatible =
                            parameterType.IsInstanceOfType(argument)
                            || (
                                parameterType.IsEnum
                                && argument.GetType() == parameterType
                            );
                    }
                    if (!compatible) break;
                }
                if (!compatible) continue;
                try
                {
                    return method.Invoke(target, arguments);
                }
                catch (TargetInvocationException error)
                {
                    throw error.InnerException ?? error;
                }
            }
            throw new MissingMethodException(type.FullName, name);
        }

        private static long ReadLong(
            string json,
            string property,
            long fallback
        )
        {
            Match match = Regex.Match(
                json ?? string.Empty,
                "\""
                    + Regex.Escape(property)
                    + "\"\\s*:\\s*(-?[0-9]+)",
                RegexOptions.IgnoreCase
            );
            long value;
            return match.Success
                && long.TryParse(match.Groups[1].Value, out value)
                    ? value
                    : fallback;
        }

        private static string Response(
            uint id,
            int status,
            string message,
            long timeRemaining
        )
        {
            return "{\"id\":"
                + id
                + ",\"status\":"
                + status
                + ",\"timeRemaining\":"
                + Math.Max(0, timeRemaining)
                + ",\"message\":\""
                + JsonEscape(message)
                + "\"}";
        }

        private static string JsonEscape(string value)
        {
            return (value ?? string.Empty)
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n");
        }

        private static string RootMessage(Exception error)
        {
            Exception current = error;
            while (current != null && current.InnerException != null)
            {
                current = current.InnerException;
            }
            return current == null
                ? "Erreur inconnue."
                : current.Message;
        }
    }
}
