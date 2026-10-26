using System;
using ShenPulse.ShopGames;
class ShiftQueueHarness {
    static int checks;
    static void Check(bool value, string message) { checks++; if (!value) throw new Exception(message); }
    static int Main() {
        try {
            var names = new QueuedViewerNames();
            Check(names.Consume(0, 100) == null, "Ordinary customers must stay anonymous.");
            names.Insert(3, new long[] { 100, 101 }, "Alice");
            names.Insert(3, new long[] { 200 }, "Bob");
            Check(names.Count == 3, "Inserting a new gift must retain the queued names.");
            Check(names.Consume(3, 200) == "Bob", "The newly inserted client must use its own donor.");
            Check(names.Consume(4, 100) == "Alice" && names.Consume(5, 101) == "Alice", "Previous clients must shift with the real game queue.");
            Check(names.Count == 0, "Consumed names must leave the queue.");
            names.Insert(6, new long[] { 300 }, "Claire");
            Check(names.Consume(6, 301) == null, "A different prefab must never inherit this donor.");
            Check(names.Consume(6, 300) == null, "A mismatching entry must not be reused later.");
            names.Insert(7, new long[] { 100 }, "David"); names.Insert(8, new long[] { 100 }, "Elise");
            Check(names.Consume(7, 100) == "David" && names.Consume(8, 100) == "Elise", "Identical customer prefabs must keep distinct donors.");
            names.Insert(9, new long[] { 100, 200 }, "Farid");
            Check(names.Consume(10, 200) == "Farid" && names.Count == 0, "Skipped indices must discard obsolete labels.");
            names.Insert(11, new long[] { 100 }, "Gaelle"); names.Insert(11, new long[0], "Nobody");
            Check(names.Consume(11, 100) == "Gaelle", "An empty insertion must not erase queued donors.");
            for (int n = 0; n < 100; n++) names.Insert(0, new long[] { 123 }, "Viewer " + n);
            bool correct = true; for (int n = 0; n < 100; n++) correct &= names.Consume(n, 123) == "Viewer " + (99 - n);
            Check(correct && names.Count == 0, "A gift burst must retain the exact reverse insertion order.");
            names.Insert(0, new long[] { 100 }, "Old night"); names.Clear();
            Check(names.Consume(0, 100) == null, "A new night must not reuse old names.");
            double now = 0; bool stuck = false; double scale = 1;
            var effects = new TemporaryEffects(() => now, key => {}, (key, error) => { throw error; });
            effects.Run("stuck", 6, () => stuck = true, () => stuck = false);
            now = 5; effects.Run("stuck", 60, () => stuck = true, () => stuck = true);
            Check(effects.Remaining("stuck") == 1, "Repeated gifts must not prolong immobilization.");
            now = 6; effects.Tick(); Check(!stuck, "The player must regain control at the real deadline.");
            effects.Run("speed", 20, () => scale = .5, () => scale = 1);
            now = 10; effects.Run("speed", 20, () => scale = 1.5, () => scale = .5);
            Check(scale == 1.5 && effects.Deadline("speed") == 26, "Changing factor must not change duration or baseline.");
            now = 26; effects.Tick(); Check(scale == 1, "The initial game speed must be restored.");
            Console.WriteLine(checks + " Shift behavior checks passed"); return 0;
        } catch(Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
