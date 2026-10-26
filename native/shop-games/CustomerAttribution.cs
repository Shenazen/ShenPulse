using System;
using System.Collections.Generic;
using System.Linq;

namespace ShenPulse.ShopGames {
    // La durée vient du même minuteur que l'effet : un nom ne peut donc pas
    // être attribué à une nouvelle arrivée après la fin de cet effet.
    internal sealed class CustomerAttribution<T> {
        private sealed class Window { public string viewer; public double until; public long order; public bool arrivals; }
        private readonly Dictionary<string, Window> windows = new Dictionary<string, Window>();
        private readonly Action<T, string> name;
        private readonly Action<T> clear;
        private readonly Func<double> now;
        private long order;
        public CustomerAttribution(Action<T, string> name, Action<T> clear, Func<double> now) { this.name = name; this.clear = clear; this.now = now; }
        public void Track(string key, string viewer, double until, bool arrivals, IEnumerable<T> affected) {
            windows[key] = new Window { viewer = viewer, until = until, arrivals = arrivals, order = ++order };
            foreach (T customer in affected) Name(customer, viewer);
        }
        public void Name(T customer, string viewer) { if (!string.IsNullOrWhiteSpace(viewer)) name(customer, viewer.Trim()); }
        public void Activated(T customer) {
            // Les personnages sont réutilisés par le jeu. Un nouveau passage
            // commence toujours sans le nom du passage précédent.
            clear(customer);
            Window current = windows.Values.Where(w => w.arrivals && w.until > now()).OrderByDescending(w => w.order).FirstOrDefault();
            if (current != null) Name(customer, current.viewer);
        }
        public void Deactivated(T customer) { clear(customer); }
        public void Stop(string key) { windows.Remove(key); }
    }
}
