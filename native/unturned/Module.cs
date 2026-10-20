using System.Reflection;
using SDG.Framework.Modules;
using UnityEngine;

[assembly: AssemblyTitle("ShenPulse Unturned")]
[assembly: AssemblyVersion("1.0.1.0")]

namespace ShenPulse.Unturned
{
    public sealed class Nexus : IModuleNexus
    {
        private GameObject root;
        public void initialize()
        {
            root = new GameObject("ShenPulse.Unturned");
            Object.DontDestroyOnLoad(root);
            root.AddComponent<Bridge>();
            Debug.Log("[ShenPulse] Unturned 1.0.1 : passerelle locale prête.");
        }
        public void shutdown() { ZombieSpawns.Shutdown(); if (root != null) Object.Destroy(root); }
    }

    public sealed class Bridge : MonoBehaviour
    {
        private LocalLink link;
        private void Awake() { link = new LocalLink(58435); }
        private void Update() { if (link != null) link.Pump(Effects.Execute); }
        private void OnDestroy() { if (link != null) { link.Dispose(); link = null; } }
    }
}
