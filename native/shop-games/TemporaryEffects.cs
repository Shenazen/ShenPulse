using System;
using System.Collections.Generic;
using System.Linq;

namespace ShenPulse.ShopGames {
    // Horloge réelle monotone fournie par l'hôte, indépendante de timeScale.
    internal sealed class TemporaryEffects {
        private sealed class Effect { public double until; public Action restore; public object baseline; }
        private readonly Dictionary<string, Effect> effects = new Dictionary<string, Effect>();
        private readonly Func<double> now;
        private readonly Action<string> ended;
        private readonly Action<string, Exception> failed;
        public TemporaryEffects(Func<double> now, Action<string> ended, Action<string, Exception> failed) { this.now = now; this.ended = ended; this.failed = failed; }
        public string[] Keys { get { return effects.Keys.ToArray(); } }
        public bool Active(string key) { Effect value; return effects.TryGetValue(key, out value) && value.until > now(); }
        public double Deadline(string key) { return effects[key].until; }
        public double Remaining(string key) { return Math.Max(0, effects[key].until - now()); }
        public object Baseline(string key, Func<object> read) {
            if (effects.ContainsKey(key) && !Active(key)) Restore(key);
            Effect value; return effects.TryGetValue(key, out value) ? value.baseline : read();
        }
        public void Run(string key, double seconds, Action apply, Action restore, object baseline = null) {
            Tick();
            // Réappliquer permet de passer du ralenti à l'accélération, mais
            // ni les cadeaux répétés ni les clics n'allongent le blocage.
            if (!effects.ContainsKey(key)) effects[key] = new Effect { until = now() + Math.Max(1, Math.Min(120, seconds)), restore = restore, baseline = baseline };
            try { apply(); } catch { Restore(key); throw; }
        }
        public void Tick() { foreach (string key in Keys) if (!Active(key)) Restore(key); }
        public void Restore(string key) {
            Effect value; if (!effects.TryGetValue(key, out value)) return;
            effects.Remove(key);
            try { value.restore(); } catch (Exception error) { failed(key, error); }
            ended(key);
        }
        public void Reset() { foreach (string key in Keys) Restore(key); }
    }
}
