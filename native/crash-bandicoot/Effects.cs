using System;
using System.Collections.Generic;
using System.Linq;

namespace ShenPulse.Crash
{
    public sealed class Effects
    {
        sealed class Active
        {
            public string code;
            public Recipe recipe;
            public double remaining;
            public bool applied;
        }
        readonly GameSession game;
        readonly Dictionary<string, Active> active = new Dictionary<string, Active>();
        public Effects(GameSession game) { this.game = game; }
        public int ActiveCount { get { return active.Count; } }
        void Apply(Active item)
        {
            // Validate every site before any write; only a supported, unmodified build is accepted.
            foreach (var e in item.recipe.edits)
            {
                e.original = game.Memory.Read(e.offset, e.value.Length);
                if (e.expected != null && !e.expected.SequenceEqual(e.original))
                    throw new InvalidOperationException("Version du jeu ou modification mémoire incompatible avec cette interaction.");
            }
            var written = new List<Edit>();
            try
            {
                foreach (var e in item.recipe.edits) { written.Add(e); game.Memory.Write(e.offset, e.value); }
                item.applied = true;
            }
            catch
            {
                // Include the failing write, which may have partially completed.
                foreach (var e in Enumerable.Reverse(written)) game.Memory.Write(e.offset, e.original);
                throw;
            }
        }
        void Restore(Active item)
        {
            if (!item.applied) return;
            foreach (var e in item.recipe.edits)
            {
                var current = game.Memory.Read(e.offset, e.value.Length);
                if (!current.SequenceEqual(e.value) && !current.SequenceEqual(e.original))
                    throw new InvalidOperationException("La mémoire a été changée par un autre outil. Restauration automatique interrompue.");
            }
            // Restore code before its backing constants, in reverse application order.
            foreach (var e in item.recipe.edits.Reverse()) game.Memory.Write(e.offset, e.original);
            item.applied = false;
        }
        public string Execute(Request request)
        {
            if (request.code == "__stop") { StopAll(); return "Effets arrêtés et restaurés."; }
            if (request.code == "__status")
            {
                string state = game.State();
                return Protocol.Encode(new { ready = state == null, state = state, lives = state == null ? game.Count("life") : -1,
                    fruit = state == null ? game.Count("fruit") : -1, boxes = state == null ? game.Count("boxes") : -1, active = ActiveCount });
            }
            string reason = game.State();
            if (reason != null) throw new InvalidOperationException(reason);
            if (Array.IndexOf(Recipes.Counters, request.code) >= 0)
            {
                string counter = request.code.Substring(4);
                int limit = counter == "fruit" ? 255 : counter == "life" ? 99 : game.Count("maxboxes");
                int maximum = counter == "fruit" ? 255 : 9;
                if (request.quantity < 1 || request.quantity > maximum) throw new ArgumentException("Quantité hors limites.");
                long address = game.Counter(counter);
                int before = BitConverter.ToInt32(game.Memory.Read(address, 4), 0);
                long after = (long)before + (request.code.StartsWith("give") ? request.quantity : -request.quantity);
                if (before < 0 || before > limit || after < 0 || after > limit) throw new InvalidOperationException("Le compteur du jeu ne permet pas cette variation.");
                try { game.Memory.Write(address, BitConverter.GetBytes((int)after)); }
                catch { game.Memory.Write(address, BitConverter.GetBytes(before)); throw; }
                return "Compteur mis à jour : " + after + ".";
            }
            var recipe = Recipes.For(request.code);
            if (recipe == null) throw new ArgumentException("Interaction inconnue.");
            double duration = request.duration == 0 ? recipe.seconds : request.duration;
            Active prior;
            active.TryGetValue(recipe.group, out prior);
            if (prior != null && prior.code == request.code)
            {
                prior.remaining = Math.Min(3600, prior.remaining + duration);
                return "Durée de l’effet prolongée.";
            }
            var next = new Active { code = request.code, recipe = recipe, remaining = Math.Min(3600, duration + (prior == null ? 0 : prior.remaining)) };
            if (prior != null) Restore(prior);
            try { Apply(next); }
            catch { if (prior != null) Apply(prior); throw; }
            active[recipe.group] = next;
            return "Interaction appliquée.";
        }
        public void Tick(double elapsedSeconds, bool connected)
        {
            if (!connected) { StopAll(); return; }
            bool ready = game.State() == null;
            foreach (var item in active.Values.ToArray())
            {
                if (!ready) { Restore(item); continue; }
                if (!item.applied) { Apply(item); continue; }
                item.remaining -= Math.Max(0, elapsedSeconds);
                if (item.remaining <= 0) { Restore(item); active.Remove(item.recipe.group); }
            }
        }
        public void StopAll()
        {
            foreach (var item in active.Values.ToArray()) { Restore(item); active.Remove(item.recipe.group); }
        }
    }
}
