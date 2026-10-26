using System.Collections.Generic;
using System.Linq;
namespace ShenPulse.ShopGames {
    internal sealed class QueuedViewerNames {
        private sealed class Entry { public long prefab; public string viewer; }
        private readonly Dictionary<int, Entry> entries = new Dictionary<int, Entry>();
        public int Count { get { return entries.Count; } }
        public void Insert(int index, long[] prefabs, string viewer) {
            if (prefabs.Length == 0) return;
            foreach (int key in entries.Keys.OrderByDescending(value => value).ToArray()) {
                if (key < index) continue;
                entries[key + prefabs.Length] = entries[key]; entries.Remove(key);
            }
            for (int n = 0; n < prefabs.Length; n++) entries[index + n] = new Entry { prefab = prefabs[n], viewer = viewer };
        }
        public string Consume(int index, long prefab) {
            foreach (int old in entries.Keys.Where(value => value < index).ToArray()) entries.Remove(old);
            Entry entry; if (!entries.TryGetValue(index, out entry)) return null;
            entries.Remove(index);
            return entry.prefab == prefab ? entry.viewer : null;
        }
        public void Clear() { entries.Clear(); }
    }
}
