using System;
using System.Collections.Generic;
namespace ShenPulse.ShopGames {
    internal sealed class ViewerSpawnQueue {
        private sealed class Batch { public string viewer; public int remaining; }
        private readonly Queue<Batch> batches = new Queue<Batch>();
        public const int Maximum = 20000;
        public int Count { get; private set; }
        public string Viewer { get { return batches.Count == 0 ? null : batches.Peek().viewer; } }
        public bool Enqueue(int count, string viewer) {
            if (count < 1 || count > Maximum - Count) return false;
            batches.Enqueue(new Batch { viewer = viewer, remaining = count }); Count += count; return true;
        }
        // Un essai refusé par le jeu ne retire ni le client ni son donateur.
        public void Spawned() {
            if (batches.Count == 0) throw new InvalidOperationException("Aucun client en attente.");
            if (--batches.Peek().remaining == 0) batches.Dequeue(); Count--;
        }
        public void Clear() { batches.Clear(); Count = 0; }
    }
}
