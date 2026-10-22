using System;
using System.Collections.Concurrent;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using ConnectorLib;
using CrowdControl.Common;
using CrowdControl.Games;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// Offline adapter for the existing console packs. No Slim executable, account,
// remote pack loader, payment service or Crowd Control session is started.
// Third-party libraries and pack authorship remain in the distribution notices.
internal static class Program
{
    static Program()
    {
        Console.InputEncoding = new UTF8Encoding(false);
        Console.OutputEncoding = new UTF8Encoding(false);
        Output = Console.Out;
    }
    private static readonly TextWriter Output;
    private static readonly object OutputLock = new object();
    private static readonly ConcurrentDictionary<Guid, TaskCompletionSource<EffectResponse>> Pending = new();
    private static EffectPack Pack;
    private static LuaConnector Connector;
    private static readonly UserRecord Player = new("00000000-0000-0000-0000-000000000001", "shenpulse", "local", "ShenPulse", "shenpulse");

    public static async Task Main()
    {
        Console.SetOut(TextWriter.Null); // Library diagnostics cannot become protocol frames.
        AssemblyLoadContext.Default.Resolving += (context, name) =>
        {
            string file = Path.Combine(AppContext.BaseDirectory, name.Name + ".dll");
            return File.Exists(file) ? context.LoadFromAssemblyPath(file) : null;
        };
#pragma warning disable SYSLIB0014
        // The original Pokémon pack has an optional HTTP nickname generator.
        // Its normal fallback generates names locally when HTTP is unavailable.
        WebRequest.RegisterPrefix("https:", new OfflineRequests());
        WebRequest.RegisterPrefix("http:", new OfflineRequests());
#pragma warning restore SYSLIB0014
        try
        {
            string line;
            while ((line = await Console.In.ReadLineAsync()) != null)
            {
                if (line.Length > 65536) continue;
                await Handle(line);
            }
        }
        finally { DisposePack(); }
    }

    private static void Write(object value)
    {
        lock (OutputLock) { Output.WriteLine(JsonConvert.SerializeObject(value)); Output.Flush(); }
    }

    private static void Notify(string method, string value) => Write(new { type = "call", method, args = new[] { value } });

    private static async Task Handle(string line)
    {
        string id = "";
        try
        {
            JObject call = JObject.Parse(line); id = (string)call["id"] ?? "";
            if ((string)call["type"] != "call") throw new InvalidOperationException("Requête locale invalide.");
            JArray args = call["args"] as JArray ?? new JArray();
            object result;
            switch ((string)call["method"])
            {
                case "logLevel": result = true; break;
                case "loadPack": LoadPack((string)args[0], (string)args[1]); result = new object[] { true, "" }; break;
                case "loadConnector":
                    if ((string)args[0] != "Lua" || Pack == null) throw new InvalidOperationException("Connecteur local invalide.");
                    if (Connector == null)
                    {
                        Connector = new LuaConnector(IPAddress.Loopback);
                        Connector.ConnectionStatusChanged += (_, state) => Notify("connectionStatusChanged", state.Item1.ToString().ToLowerInvariant());
                        Pack.GameConnector = Connector;
                        var ready = await Connector.Connect();
                        if (!ready.success) throw new InvalidOperationException(ready.message);
                    }
                    result = new object[] { true, "" }; break;
                case "effectRequest": result = await Trigger(args[0] as JObject); break;
                case "packInfo":
                    if (Pack == null) throw new InvalidOperationException("Aucun pack chargé.");
                    result = new { effects = Pack.Effects.Keys.ToArray(), connected = Connector?.Connected == true, offline = true }; break;
                case "stopAllEffects": Pack?.StopAllEffects(true); result = true; break;
                default: throw new InvalidOperationException("Commande locale inconnue.");
            }
            Write(new { id, type = "return", value = result });
        }
        catch (Exception error)
        {
            Write(new { id, type = "exception", message = error.GetBaseException().Message });
        }
    }

    private static void LoadPack(string file, string name)
    {
        string expected = name switch
        {
            "PokemonRedBlue" => "586f82e6a888abda25ba5c518d11d70befa52495b2484890759b6e45c7578329",
            "SuperMarioKart" => "44a2c9e04e641532b42a9f3084b4155b3189c8f2afd797fa20919ad798ba6c4b",
            _ => throw new InvalidOperationException("Pack local non autorisé.")
        };
        string canonical = Path.GetFullPath(file ?? "");
        string allowed = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "Packs", name + ".dll"));
        if (!string.Equals(canonical, allowed, StringComparison.OrdinalIgnoreCase) ||
            Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(canonical))).ToLowerInvariant() != expected)
            throw new InvalidOperationException("Le pack local est absent ou altéré. Réinstallez les interactions depuis ShenPulse.");
        DisposePack();
        Assembly assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(canonical);
        Type type = assembly.GetTypes().Single(t => t.Name == name && typeof(EffectPack).IsAssignableFrom(t));
        Pack = (EffectPack)Activator.CreateInstance(type, Player, new Func<CrowdControlBlock, bool>(Receive), new Action<object>(_ => {}));
        Pack.GameStateChanged += (_, state) => Notify("gameStateChanged", state.ToString().ToLowerInvariant());
        Pack.PackStateChanged += (_, state) => Notify("packStateChanged", state.ToString().ToLowerInvariant());
    }

    private static async Task<object> Trigger(JObject incoming)
    {
        if (Pack == null || Connector?.Connected != true)
            throw new InvalidOperationException("BizHawk n’est pas connecté à ShenPulse. Lancez le jeu depuis ShenPulse.");
        string code = (string)incoming?["effect"]?["id"] ?? "";
        if (!Pack.Effects.ContainsKey(code)) throw new InvalidOperationException("Interaction locale inconnue.");
        var request = new EffectRequest(code)
        {
            Target = Player, Origin = Player, Viewers = new() { Player },
            Quantity = 1, Free = true, RetryMaxAttempts = 0
        };
        var completion = new TaskCompletionSource<EffectResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
        Pending[request.ID] = completion;
        try
        {
            Pack.ProcessRequest(request);
            EffectResponse response = await completion.Task.WaitAsync(TimeSpan.FromSeconds(12));
            return new object[] { response.Status.IsSuccess(), response.Message ?? "" };
        }
        finally { Pending.TryRemove(request.ID, out _); }
    }

    private static bool Receive(CrowdControlBlock block)
    {
        if (block is EffectResponse response && (response.Status.IsSuccess() || response.Status.IsFailure()) &&
            Pending.TryGetValue(response.Request, out var completion)) completion.TrySetResult(response);
        block.InvokeSent();
        return true;
    }

    private static void DisposePack()
    {
        try { Pack?.StopAllEffects(true); } catch { }
        try { Pack?.Dispose(); } catch { }
        try { Connector?.Dispose(); } catch { }
        Pack = null; Connector = null;
        foreach (var completion in Pending.Values) completion.TrySetException(new InvalidOperationException("Le pont local est arrêté."));
        Pending.Clear();
    }

#pragma warning disable SYSLIB0014
    private sealed class OfflineRequests : IWebRequestCreate
    {
        public WebRequest Create(Uri uri) => new OfflineRequest();
    }
    private sealed class OfflineRequest : WebRequest
    {
        public override int Timeout { get; set; }
        public override WebResponse GetResponse() => throw new WebException("Le pont ShenPulse fonctionne hors ligne.");
    }
#pragma warning restore SYSLIB0014
}
