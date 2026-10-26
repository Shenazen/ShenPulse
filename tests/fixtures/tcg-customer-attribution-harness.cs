using System;
using System.Collections.Generic;
using ShenPulse.ShopGames;

class TcgCustomerAttributionHarness {
    static void Check(bool value, string message) { if (!value) throw new Exception(message); }
    static int Main() {
        try {
            float now = 10;
            var labels = new Dictionary<int, string>();
            var names = new CustomerAttribution<int>((id, viewer) => labels[id] = viewer, id => labels.Remove(id), () => now);

            foreach (int id in new[] { 1, 2, 3 }) names.Name(id, "Alice");
            Check(labels.Count == 3 && labels[3] == "Alice", "Each member of a spawned group must carry its donor.");
            names.Name(1, "Bob");
            Check(labels.Count == 3 && labels[1] == "Bob" && labels[2] == "Alice", "Renaming one customer must neither duplicate labels nor rename another.");
            names.Deactivated(1); names.Activated(1);
            Check(!labels.ContainsKey(1), "A pooled customer must lose the name from its previous visit.");

            names.Track("customers", "Claire", 20, true, new[] { 2, 3 });
            names.Activated(4);
            Check(labels[2] == "Claire" && labels[3] == "Claire" && labels[4] == "Claire", "A speed effect must name affected customers and arrivals.");
            names.Track("rush", "David", 16, true, new int[0]);
            Check(labels[4] == "Claire", "An arrival-only effect must not rename existing shoppers.");
            names.Activated(5);
            Check(labels[5] == "David", "The latest active donor must be shown for overlapping arrival effects.");
            names.Name(5, "Elise");
            Check(labels[5] == "Elise", "An explicitly gifted customer must retain its own donor over a global arrival effect.");
            now = 16; names.Activated(6);
            Check(labels[6] == "Claire", "At the exact deadline the expired effect must not name new arrivals.");

            names.Track("customers", "Farid", 30, true, new[] { 2 });
            names.Activated(7);
            Check(labels[2] == "Farid" && labels[7] == "Farid", "A repeated effect must use its new donor and extended deadline.");
            names.Stop("customers"); names.Activated(8);
            Check(!labels.ContainsKey(8) && labels[7] == "Farid", "Canceling an effect must stop naming arrivals while keeping an existing donor visible until departure.");

            names.Track("change", "Gaelle", 40, true, new[] { 2, 3 });
            names.Activated(9);
            Check(labels[2] == "Gaelle" && labels[9] == "Gaelle", "Exact-change effects must also name current and future customers.");
            names.Deactivated(9); now = 40; names.Activated(9);
            Check(!labels.ContainsKey(9), "A reused customer must remain anonymous after all relevant effects expire.");
            names.Track("workers", "Helene", 50, false, new int[0]); names.Activated(10);
            Check(!labels.ContainsKey(10), "An unrelated effect must not name customers.");
            names.Name(10, "  Irene 🦆  "); names.Name(10, " ");
            Check(labels[10] == "Irene 🦆", "Viewer names must preserve Unicode and ignore empty replacements.");
            Console.WriteLine("fourteen customer attribution behavior checks passed");
            return 0;
        } catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
