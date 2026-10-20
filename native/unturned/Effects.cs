using System;
using System.Collections.Generic;
using System.Linq;
using SDG.Unturned;
using UnityEngine;
using Random = UnityEngine.Random;

namespace ShenPulse.Unturned
{
    public static class Effects
    {
        public static string Execute(Request request)
        {
            var player = Player.LocalPlayer;
            if (!Level.isLoaded || !Provider.isServer || player == null || Provider.clients.Count != 1)
                throw new InvalidOperationException("Chargez une partie solo Unturned pour utiliser les interactions.");
            if (player.life.isDead && request.code != "respawn")
                throw new InvalidOperationException("Le survivant doit être en vie pour cette interaction.");
            var p = request.parameters;
            float value = p.value * request.quantity;
            switch (request.code)
            {
                case "spawn_enemy": SpawnZombies(player, request); break;
                case "spawn_animals": SpawnAnimals(player, request); break;
                case "spawn_vehicles": SpawnVehicles(player, request); break;
                case "give_item": Items(player, request, true, false); break;
                case "drop_item": Items(player, request, false, false); break;
                case "item_rain": Items(player, request, false, true); break;
                case "heal": player.life.serverModifyHealth(value); break;
                case "food": player.life.serverModifyFood(value); break;
                case "water": player.life.serverModifyWater(value); break;
                case "virus": player.life.serverModifyVirus(value); break;
                case "stamina": player.life.serverModifyStamina(value); break;
                case "oxygen": if (value >= 0) player.life.askBreath((byte)value); else player.life.askSuffocate((byte)-value); break;
                case "kill_all_zombies":
                    foreach (var zombie in ZombieManager.AllZombies.ToArray())
                        if (zombie != null && !zombie.isDead) ZombieManager.sendZombieDead(zombie, Vector3.up, ERagdollEffect.None);
                    break;
                case "kill_all_animals":
                    foreach (var animal in AnimalManager.animals.ToArray())
                        if (animal != null && !animal.isDead) AnimalManager.sendAnimalDead(animal, Vector3.up, ERagdollEffect.None);
                    break;
                case "day": LightingManager.time = (uint)(LightingManager.cycle * LevelLighting.transition); break;
                case "night": LightingManager.time = (uint)(LightingManager.cycle * (LevelLighting.bias + LevelLighting.transition)); break;
                case "set_time": LightingManager.time = (uint)(LightingManager.cycle * p.value / 100f); break;
                case "add_experience": player.skills.ServerModifyExperience((int)value); break;
                case "airdrop": Airdrop(player); break;
                case "inventory_shuffle": Shuffle(player); break;
                case "drop_all_items": DropAll(player); break;
                case "break_item": Quality(player, 0); break;
                case "repair_item": Quality(player, 100); break;
                case "respawn":
                    if (player.life.isDead) player.life.ServerRespawn(false);
                    else if (!player.teleportToRandomSpawnPoint()) throw new InvalidOperationException("Aucun point de réapparition disponible.");
                    break;
                case "slap": player.movement.pendingLaunchVelocity += Vector3.up * p.force + player.transform.forward * p.force * 0.4f; break;
                case "set_weather": Weather((int)p.value); break;
                case "boom": Boom(player, p); break;
                default: throw new ArgumentException("Interaction Unturned inconnue.");
            }
            return "Interaction exécutée dans Unturned.";
        }

        private static Vector3 Ground(Player player, float radius)
        {
            for (int attempt = 0; attempt < 24; attempt++)
            {
                var circle = Random.insideUnitCircle.normalized * Random.Range(3f, Mathf.Max(3, radius));
                var point = player.transform.position + new Vector3(circle.x, 0, circle.y);
                RaycastHit hit;
                if (!Physics.Raycast(point + Vector3.up * 2, Vector3.down, out hit, 100, RayMasks.BLOCK_COLLISION)) continue;
                if (hit.normal.y < 0.65f) continue;
                var ground = hit.point + Vector3.up * 0.1f;
                if (Physics.CheckCapsule(ground + Vector3.up * 0.4f, ground + Vector3.up * 1.5f, 0.3f, RayMasks.BLOCK_COLLISION)) continue;
                return ground + Vector3.up * 0.4f;
            }
            throw new InvalidOperationException("Aucune place libre au sol près du joueur après plusieurs essais.");
        }

        private static List<Vector3> Positions(Player player, Request request)
        {
            var points = new List<Vector3>();
            for (int i = 0; i < request.quantity; i++) points.Add(Ground(player, request.parameters.radius));
            return points;
        }

        private static void SpawnZombies(Player player, Request request)
        {
            ZombieSpawns.Spawn(player, request, Positions(player, request));
        }

        private static void Airdrop(Player player)
        {
            var node = LevelManager.GetRandomAirdropNode();
            var cargo = node != null ? node.GetCargoSpawnTableOrLogWarning() : null;
            if (cargo == null) throw new InvalidOperationException("Cette carte ne contient pas de cargaison de largage aérien.");
            LevelManager.SpawnAirdrop(player.transform.position, cargo);
        }

        private static Asset Pick(EAssetType type, int id)
        {
            if (id != 0)
            {
                var asset = Assets.find(type, (ushort)id);
                if (asset == null) throw new ArgumentException("Cet identifiant n’existe pas dans les objets chargés du jeu.");
                return asset;
            }
            var assets = Assets.find(type).Where(asset => asset != null && asset.id != 0).ToArray();
            if (assets.Length == 0) throw new InvalidOperationException("Aucun objet compatible chargé pour cette interaction.");
            return assets[Random.Range(0, assets.Length)];
        }

        private static void SpawnAnimals(Player player, Request request)
        {
            var asset = Pick(EAssetType.ANIMAL, request.parameters.assetId);
            foreach (var point in Positions(player, request)) AnimalManager.spawnAnimal(asset.id, point, Quaternion.identity);
        }

        private static void SpawnVehicles(Player player, Request request)
        {
            var asset = Pick(EAssetType.VEHICLE, request.parameters.assetId);
            foreach (var point in Positions(player, request))
                if (VehicleManager.spawnVehicleV2(asset.id, point + Vector3.up, Quaternion.identity) == null)
                    throw new InvalidOperationException("Le jeu a refusé l’apparition du véhicule.");
        }

        private static void Items(Player player, Request request, bool inventory, bool rain)
        {
            var asset = Pick(EAssetType.ITEM, request.parameters.assetId);
            for (int i = 0; i < request.quantity; i++)
            {
                var item = new Item(asset.id, EItemOrigin.ADMIN);
                if (inventory && player.inventory.tryAddItem(item, false)) continue;
                var circle = Random.insideUnitCircle * request.parameters.radius;
                var point = rain ? player.transform.position + new Vector3(circle.x, 15, circle.y) : player.transform.position + player.transform.forward * 2 + Vector3.up;
                ItemManager.dropItem(item, point, true, true, true);
            }
        }

        private static List<Item> TakeInventory(Player player)
        {
            player.equipment.dequip();
            var items = new List<Item>();
            // Only personal inventory: never storage chests or ground-item pages.
            for (byte page = 0; page < PlayerInventory.STORAGE; page++)
                for (int i = player.inventory.getItemCount(page) - 1; i >= 0; i--)
                {
                    var item = player.inventory.getItem(page, (byte)i).item;
                    items.Add(item); player.inventory.removeItem(page, (byte)i);
                }
            return items;
        }

        private static void Shuffle(Player player)
        {
            var items = TakeInventory(player);
            for (int i = items.Count - 1; i > 0; i--)
            {
                int j = Random.Range(0, i + 1); var item = items[i]; items[i] = items[j]; items[j] = item;
            }
            foreach (var item in items)
                if (!player.inventory.tryAddItem(item, false)) ItemManager.dropItem(item, player.transform.position + Vector3.up, true, true, true);
        }

        private static void DropAll(Player player)
        {
            foreach (var item in TakeInventory(player)) ItemManager.dropItem(item, player.transform.position + Vector3.up, true, true, true);
        }

        private static void Quality(Player player, byte value)
        {
            if (player.equipment.asset == null || player.equipment.equippedPage >= PlayerInventory.STORAGE)
                throw new InvalidOperationException("Équipez un objet compatible avant cette interaction.");
            player.inventory.sendUpdateQuality(player.equipment.equippedPage, player.equipment.equipped_x, player.equipment.equipped_y, value);
            player.equipment.quality = value; player.equipment.sendUpdateQuality();
        }

        private static void Weather(int mode)
        {
            if (mode == 0) { LightingManager.DisableWeather(); return; }
            var weather = mode == 1 ? WeatherAssetBase.DEFAULT_RAIN.Find() : WeatherAssetBase.DEFAULT_SNOW.Find();
            if (weather == null) throw new InvalidOperationException("Cette météo n’est pas disponible sur la carte.");
            LightingManager.ActivatePerpetualWeather(weather);
        }

        private static void Boom(Player player, Parameters parameters)
        {
            var point = player.transform.position;
            var explosion = new ExplosionParameters(point, parameters.radius, EDeathCause.GRENADE);
            explosion.playerDamage = parameters.value;
            explosion.zombieDamage = parameters.value;
            explosion.animalDamage = parameters.value;
            explosion.vehicleDamage = parameters.value;
            // Buildings, containers and resources are not destroyed by this effect.
            explosion.barricadeDamage = explosion.structureDamage = explosion.resourceDamage = explosion.objectDamage = 0;
            List<EPlayerKill> kills;
            DamageTool.explode(explosion, out kills);
            EffectManager.sendEffect(20, EffectManager.INSANE, point);
        }
    }
}
