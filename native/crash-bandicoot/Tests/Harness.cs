using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using ShenPulse.Crash;

class Harness
{
    sealed class Memory : IMemory
    {
        public readonly Dictionary<long, byte> bytes = new Dictionary<long, byte>();
        public int failAfter = -1;
        public byte[] Read(long at, int count) { return Enumerable.Range(0, count).Select(i => bytes.ContainsKey(at + i) ? bytes[at + i] : (byte)0).ToArray(); }
        public void Seed(long at, byte[] value) { for (int i = 0; i < value.Length; i++) bytes[at + i] = value[i]; }
        public void Write(long at, byte[] value)
        {
            Seed(at, value);
            if (failAfter == 0) { failAfter = -1; throw new Exception("Simulated partial write"); }
            if (failAfter > 0) failAfter--;
        }
        public void Ptr(long at, long pointer) { Seed(at, BitConverter.GetBytes(pointer)); }
    }
    static int checks;
    static void Check(bool condition, string message) { checks++; if (!condition) throw new Exception(message); }
    static void Fails(Action action) { bool failed = false; try { action(); } catch { failed = true; } Check(failed, "Expected rejection"); }
    static Memory Setup()
    {
        var m = new Memory();
        m.Ptr(0x1AAC858, 0x100000); m.Ptr(-0x100080, 0x200000); m.Seed(-0x200000, new byte[] { 1 });
        m.Ptr(0x1A61CF8, 0x300000); m.Seed(0x1A83178, new byte[] { 0x20 });
        m.Seed(0x1A5C6E0, Encoding.ASCII.GetBytes("crash3/l311_dinomight/l311_dinomight\0"));
        m.Ptr(0x1AA27C8, 0x400000); m.Seed(-0x400010, BitConverter.GetBytes(5));
        m.Ptr(0x1A69A98, 0x500000); m.Ptr(-0x500020, 0x600000); m.Ptr(-0x6021F8, 0x700000);
        m.Ptr(-0x700010, 0x800000); m.Ptr(-0x800018, 0x900000);
        m.Ptr(-0x9005F0, 0xA00000); m.Seed(-0xA00010, BitConverter.GetBytes(30));
        m.Ptr(-0x9006B8, 0xB00000); m.Seed(-0xB00010, BitConverter.GetBytes(5));
        m.Ptr(-0x900610, 0xC00000); m.Seed(-0xC00010, BitConverter.GetBytes(100));
        return m;
    }
    static void Seed(Memory m, Recipe recipe)
    {
        foreach (var edit in recipe.edits) m.Seed(edit.offset, edit.expected ?? new byte[edit.value.Length]);
    }
    static void Network()
    {
        var server = new TcpListener(IPAddress.Loopback, 0); server.Start();
        try
        {
            using (var link = new LocalLink(((IPEndPoint)server.LocalEndpoint).Port))
            using (var client = server.AcceptTcpClient())
            {
                client.ReceiveTimeout = 2000; int calls = 0;
                byte[] bytes = Encoding.UTF8.GetBytes("{\"id\":7,\"type\":1,\"code\":\"givelife\",\"quantity\":2}\0");
                var stream = client.GetStream(); stream.Write(bytes, 0, 9); Thread.Sleep(30);
                link.Pump(r => { calls++; return "ok"; }); Check(calls == 0, "Partial frame executed");
                stream.Write(bytes, 9, bytes.Length - 9);
                for (int i = 0; i < 100 && calls == 0; i++) { Thread.Sleep(10); link.Pump(r => { calls++; return "ok"; }); }
                Check(calls == 1, "Complete frame not executed");
                stream.Write(bytes, 0, bytes.Length);
                Thread.Sleep(50); link.Pump(r => { calls++; return "bad"; }); Check(calls == 1, "Duplicate request executed twice");
                byte[] reply = new byte[4096]; int read = stream.Read(reply, 0, reply.Length);
                Check(Encoding.UTF8.GetString(reply, 0, read).Contains("\"status\":0"), "No success reply");
            }
        }
        finally { server.Stop(); }
    }
    static void Main(string[] args)
    {
        try
        {
            string[] codes = System.IO.File.ReadAllLines(args[0]);
            Check(codes.Length == 26, "26 effects required");
            var gate = new StartupGate();
            Check(!gate.Observe(101, false, 0), "Bootstrap without a window accepted");
            Check(!gate.Observe(101, false, 1500), "Long bootstrap without a window accepted");
            Check(!gate.Observe(0, false, 1750), "Absent process accepted");
            Check(!gate.Observe(202, true, 2000), "Replacement process accepted before stable window");
            Check(gate.Observe(202, true, 3000), "Steam replacement not accepted after stable window");
            Check(!gate.Observe(303, true, 3100), "Changed PID reused previous stability interval");
            Check(!gate.Observe(303, false, 4200), "Closed window accepted");
            Check(!gate.Observe(303, true, 4400), "Reopened window reused previous stability interval");
            Check(gate.Observe(303, true, 5400), "Reopened window never accepted");
            foreach (string code in codes)
            {
                var m = Setup(); var game = new GameSession(m); var engine = new Effects(game);
                Check(game.State() == null, "Gameplay state");
                var recipe = Recipes.For(code);
                if (recipe == null)
                {
                    string counter = code.Substring(4); int before = game.Count(counter);
                    engine.Execute(new Request { code = code, quantity = 2 });
                    Check(game.Count(counter) == before + (code.StartsWith("give") ? 2 : -2), code);
                    Fails(() => engine.Execute(new Request { code = code, quantity = 256 }));
                    continue;
                }
                Seed(m, recipe);
                byte[][] original = recipe.edits.Select(e => m.Read(e.offset, e.value.Length)).ToArray();
                engine.Execute(new Request { code = code, quantity = 1, duration = 2 });
                Check(recipe.edits.All(e => m.Read(e.offset, e.value.Length).SequenceEqual(e.value)), code + " application");
                m.Seed(-0x300059, new byte[] { 1 }); engine.Tick(100, true);
                Check(recipe.edits.Select((e, i) => m.Read(e.offset, e.value.Length).SequenceEqual(original[i])).All(v => v), code + " pause restoration");
                Check(engine.ActiveCount == 1, "Pause consumed remaining duration");
                m.Seed(-0x300059, new byte[] { 0 }); engine.Tick(.1, true); engine.Tick(1, true);
                Check(engine.ActiveCount == 1, "Resume expired too early"); engine.Tick(1.1, true);
                Check(engine.ActiveCount == 0, "Effect did not expire");
                Check(recipe.edits.Select((e, i) => m.Read(e.offset, e.value.Length).SequenceEqual(original[i])).All(v => v), code + " expiry restoration");
                engine.Execute(new Request { code = code, duration = 30 }); engine.Tick(0, false);
                Check(engine.ActiveCount == 0, "Disconnect did not stop");
            }
            var mem = Setup(); Seed(mem, Recipes.For("crashsize_200")); var fx = new Effects(new GameSession(mem));
            mem.failAfter = 1; Fails(() => fx.Execute(new Request { code = "crashsize_200", duration = 10 }));
            Check(Recipes.For("crashsize_200").edits.All(e => mem.Read(e.offset, e.value.Length).SequenceEqual(e.expected ?? new byte[e.value.Length])), "Partial write rollback");
            Seed(mem, Recipes.For("groundspeed_300"));
            fx.Execute(new Request { code = "groundspeed_300", duration = 2 });
            fx.Execute(new Request { code = "groundspeed_300", duration = 2 }); fx.Tick(3, true);
            Check(fx.ActiveCount == 1, "Repeated effect did not extend");
            fx.Execute(new Request { code = "groundspeed_50", duration = 2 });
            Check(fx.ActiveCount == 1 && BitConverter.ToSingle(mem.Read(0x13A65D0, 4), 0) == .5f, "Variant replacement");
            fx.Tick(2, true); Check(fx.ActiveCount == 1, "Replacement lost remaining time"); fx.Tick(2, true); Check(fx.ActiveCount == 0, "Replacement expiry");
            int id;
            Fails(() => Protocol.Decode("{\"id\":1,\"code\":\"unknown\"}", out id));
            Fails(() => Protocol.Decode("{\"id\":1,\"code\":\"givelife\",\"quantity\":1.5}", out id));
            Fails(() => Protocol.Decode("{\"id\":1,\"code\":\"infinitejump\",\"duration\":601}", out id));
            mem.Seed(0x1A83178, new byte[] { 0 }); Fails(() => fx.Execute(new Request { code = "givelife", quantity = 1 }));
            mem.Seed(0x1A83178, new byte[] { 0x20 });
            mem.Seed(0x1A5C6E0, new byte[64]); mem.Seed(0x1A5C6E0, Encoding.ASCII.GetBytes("crash1/bonus/test\0"));
            Check(new GameSession(mem).State() == null, "Playable bonus area rejected by its name");
            mem.Seed(0x1A5C6E0, new byte[64]); mem.Seed(0x1A5C6E0, Encoding.ASCII.GetBytes("crash2/l200_hub\0"));
            Fails(() => fx.Execute(new Request { code = "givelife", quantity = 1 }));
            Network();
            Console.WriteLine("Crash native checks PASS: " + checks);
        }
        catch (Exception error) { Console.Error.WriteLine(error); Environment.ExitCode = 1; }
    }
}
