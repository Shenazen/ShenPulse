// Domaine RewardsAndPlayer : meme classe plugin, methodes et champs conserves.
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
    }
}
