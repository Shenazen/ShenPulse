using System;
using System.Collections.Generic;
using System.Reflection;
using FrogSqwad.Character;
using Fusion;
using UnityEngine;
using UnityEngine.AI;

namespace ShenPulse.FrogSqwad
{
    /// <summary>Temporary modifiers must not exhaust the game's fifteen buff slots.</summary>
    public static class Runtime
    {
        private static readonly PropertyInfo BuffsProperty = typeof(PlayerManager).GetProperty(
            "_playerBuffs", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        private static NetworkRunner cachedRunner;
        private static readonly Dictionary<int, List<NetworkObject>> EnemyPrefabs = new Dictionary<int, List<NetworkObject>>();

        public static NetworkObject SpawnCart(NetworkRunner runner, Vector3 position, Quaternion rotation)
        {
            foreach (var entry in runner.Prefabs.GetEntries())
            {
                if (!System.Text.RegularExpressions.Regex.IsMatch(entry.Item2.Description ?? "", "trolley|cart", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) continue;
                var prefab = runner.Prefabs.Load(entry.Item1, true);
                // A room containing a trolley is not a trolley prefab.
                if (prefab && prefab.GetComponent<TrolleyBehaviour>())
                    return runner.Spawn(prefab, position, rotation);
            }
            foreach (var trolley in UnityEngine.Object.FindObjectsByType<TrolleyBehaviour>(FindObjectsSortMode.None))
            {
                var template = trolley.Object;
                if (template && template.IsValid && template.GetComponent<TrolleyBehaviour>())
                    return runner.Spawn(template, position, rotation);
            }
            return null;
        }

        public static bool TrySpawnEnemy(FrogNetworkMovementPhysics player, int kind, out string reason)
        {
            reason = null;
            // The snail uses its own chasing/targeting system in the original dispatcher.
            if (kind == 6 || !player || !player.Runner || !player.Runner.IsServer) return false;
            var runner = player.Runner;
            if (cachedRunner != runner)
            {
                cachedRunner = runner;
                EnemyPrefabs.Clear();
                foreach (var entry in runner.Prefabs.GetEntries())
                {
                    var description = entry.Item2.Description ?? "";
                    if (!System.Text.RegularExpressions.Regex.IsMatch(description, "enemy|mutant|slime|snake|wasp|bat|crab", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) continue;
                    try
                    {
                        var prefab = runner.Prefabs.Load(entry.Item1, true);
                        var enemy = prefab ? prefab.GetComponentInChildren<EnemyBehaviourBase>(true) : null;
                        if (!enemy) continue;
                        int category = enemy is FlyingEnemyBehaviour ? 2 : enemy is SlimeEnemyBehaviour ? 3 : enemy is RangedEnemyBehaviour ? 4 : enemy is FrogEnemyBehaviour ? 5 : 1;
                        List<NetworkObject> list;
                        if (!EnemyPrefabs.TryGetValue(category, out list)) EnemyPrefabs[category] = list = new List<NetworkObject>();
                        list.Add(prefab);
                        // Slimes, ranged enemies and frogs can also be ground enemies.
                        if (category != 1 && enemy is GroundEnemyBehaviour)
                        {
                            if (!EnemyPrefabs.TryGetValue(1, out list)) EnemyPrefabs[1] = list = new List<NetworkObject>();
                            list.Add(prefab);
                        }
                    }
                    catch (Exception error) { Debug.LogWarning("ShenPulse: ennemi non disponible : " + error.Message); }
                }
            }
            var candidates = new List<NetworkObject>();
            foreach (var entry in EnemyPrefabs) if (kind == 0 || entry.Key == kind) candidates.AddRange(entry.Value);
            if (candidates.Count == 0) return false;
            var template = candidates[UnityEngine.Random.Range(0, candidates.Count)];
            Vector3 position = player.transform.position + UnityEngine.Random.onUnitSphere * 3f;
            position.y = player.transform.position.y + 1f;
            NavMeshHit hit;
            if (kind != 2 && NavMesh.SamplePosition(position, out hit, 12f, NavMesh.AllAreas)) position = hit.position;
            var spawned = runner.Spawn(template, position, Quaternion.identity);
            if (!spawned) return false;
            var agent = spawned.GetComponentInChildren<NavMeshAgent>();
            if (agent) { agent.enabled = true; if (NavMesh.SamplePosition(position, out hit, 12f, NavMesh.AllAreas)) agent.Warp(hit.position); }
            var flying = spawned.GetComponentInChildren<FlyingEnemyBehaviour>();
            var paths = SingletonBehaviour<FlyingEnemyPathManager>.Instance;
            if (flying && paths && paths.Pathway != null) flying.SetupPath(paths.Pathway);
            Debug.Log("ShenPulse: nouvel ennemi " + spawned.name + " / " + spawned.Id);
            return true;
        }

        public static void ApplyBuff(PlayerManager manager, PlayerRef player, PlayerBuffType type, float amount)
        {
            if (float.IsNaN(amount) || float.IsInfinity(amount)) throw new ArgumentOutOfRangeException("amount");
            NetworkString<_64> key = default(NetworkString<_64>);
            bool registered = false;
            foreach (var entry in manager.PlayerRefToUID)
                if (entry.Key == player) { key = entry.Value; registered = true; break; }
            if (!registered) throw new InvalidOperationException("Le joueur n’est pas encore prêt.");

            var dictionary = (NetworkDictionary<NetworkString<_64>, PlayerBuffs>)BuffsProperty.GetValue(manager, null);
            var buffs = dictionary.Get(key);
            var values = new List<PlayerBuff>();
            // Cancel exact opposite pairs, retaining the individual permanent upgrades and their counts.
            foreach (var value in buffs.Buffs) AddOrCancel(values, value);
            AddOrCancel(values, new PlayerBuff { BuffType = type, Increase = amount });
            if (values.Count > 15) throw new InvalidOperationException("Les emplacements de bonus sont tous utilisés.");
            buffs.Buffs.Clear();
            foreach (var value in values) buffs.Buffs.Add(value);
            dictionary.Set(key, buffs);
        }

        private static void AddOrCancel(List<PlayerBuff> values, PlayerBuff value)
        {
            if (Math.Abs(value.Increase) < 0.00001f) return;
            for (int index = values.Count - 1; index >= 0; index--)
                if (values[index].BuffType == value.BuffType &&
                    Math.Abs(values[index].Increase + value.Increase) < 0.00001f)
                { values.RemoveAt(index); return; }
            values.Add(value);
        }
    }
}
