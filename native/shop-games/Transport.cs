using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace ShenPulse.ShopGames {
    public sealed class Request {
        public string id, token, code, gameId, viewer;
        public int quantity = 1;
        public double duration, expiresAt;
        public Dictionary<string, object> parameters = new Dictionary<string, object>();
        public double Number(string name, double fallback) {
            object value;
            double number;
            return parameters != null && parameters.TryGetValue(name, out value) && double.TryParse(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out number) && !double.IsInfinity(number) && !double.IsNaN(number) ? number : fallback;
        }
        public string Text(string name, string fallback = "") { object v; return parameters != null && parameters.TryGetValue(name, out v) ? Convert.ToString(v) : fallback; }
    }
    public sealed class Reply {
        public string id, gameId, message;
        public int status;
        public bool ready, executionConfirmed;
        public object metadata;
        public static Reply Success(string text = "Interaction exécutée.") { return new Reply { status = 0, message = text, executionConfirmed = true }; }
        public static Reply Unavailable(string text) { return new Reply { status = 3, message = text }; }
    }
    public sealed class Configuration { public string gameId, token; public int port; }
    public sealed class Transport : IDisposable {
        private readonly Configuration config;
        private readonly Action<Action> enqueue;
        private readonly Func<Request, Reply> execute;
        private readonly Action<string> log;
        private TcpListener listener;
        private volatile bool running;
        private const int MaximumBytes = 32768;
        public Transport(string configPath, string gameId, int port, Action<Action> enqueue, Func<Request, Reply> execute, Action<string> log) {
            config = JsonConvert.DeserializeObject<Configuration>(File.ReadAllText(configPath));
            if (config == null || config.gameId != gameId || config.port != port || config.token == null || config.token.Length != 64) throw new InvalidOperationException("Configuration ShenPulse invalide.");
            this.enqueue = enqueue; this.execute = execute; this.log = log;
        }
        public void Start() {
            listener = new TcpListener(IPAddress.Loopback, config.port);
            listener.Start(8); running = true;
            new Thread(Loop) { IsBackground = true, Name = "ShenPulse " + config.gameId }.Start();
            log("Module ShenPulse prêt sur 127.0.0.1:" + config.port);
        }
        private void Loop() {
            while (running) {
                try {
                    using (TcpClient client = listener.AcceptTcpClient()) {
                        client.ReceiveTimeout = 3000; client.SendTimeout = 3000;
                        using (NetworkStream stream = client.GetStream()) {
                            var bytes = new List<byte>(); int b;
                            while (bytes.Count <= MaximumBytes && (b = stream.ReadByte()) >= 0 && b != 10) bytes.Add((byte)b);
                            if (bytes.Count == 0 || bytes.Count > MaximumBytes) continue;
                            Request request = JsonConvert.DeserializeObject<Request>(Encoding.UTF8.GetString(bytes.ToArray()));
                            if (request == null || request.token != config.token || request.gameId != config.gameId || string.IsNullOrEmpty(request.id)) continue;
                            Reply response = null;
                            // Une demande expirée n’est jamais exécutée après le délai de l’application.
                            using (var done = new ManualResetEventSlim()) {
                                int canceled = 0;
                                enqueue(delegate {
                                    try { if (Volatile.Read(ref canceled) == 0 && Now() <= request.expiresAt) response = execute(request); }
                                    catch (Exception e) { response = new Reply { status = 1, message = (e.InnerException ?? e).Message }; }
                                    finally { try { done.Set(); } catch (ObjectDisposedException) {} }
                                });
                                // Un diagnostic expirant après une seconde ne doit pas
                                // bloquer le serveur pendant dix secondes et saturer
                                // les tentatives suivantes lorsque le jeu perd le focus.
                                int remaining = (int)Math.Min(10000, Math.Max(0, request.expiresAt - Now()));
                                if (!done.Wait(remaining)) { Interlocked.Exchange(ref canceled, 1); response = Reply.Unavailable("La partie ne répond pas. Fermez les menus et reprenez le jeu."); }
                            }
                            if (response == null) response = Reply.Unavailable("Demande expirée.");
                            response.id = request.id; response.gameId = config.gameId;
                            byte[] reply = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(response) + "\n");
                            stream.Write(reply, 0, reply.Length);
                        }
                    }
                } catch (Exception e) { if (running) log("Connexion ShenPulse : " + e.Message); }
            }
        }
        public static double Now() { return (DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds; }
        public void Dispose() { running = false; if (listener != null) listener.Stop(); }
    }
}
