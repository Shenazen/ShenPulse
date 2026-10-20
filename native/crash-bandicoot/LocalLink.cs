using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;


namespace ShenPulse.Crash
{
    // Only the main loop applies memory edits; the worker handles local TCP framing.
    public sealed class LocalLink : IDisposable
    {
        private sealed class Session
        {
            public TcpClient client;
            public readonly Dictionary<int, string> replies = new Dictionary<int, string>();
            public readonly Queue<int> replyOrder = new Queue<int>();
        }
        private sealed class Pending
        {
            public Session session;
            public string json;
            public DateTime received;
        }
        private readonly int port;
        private readonly ConcurrentQueue<Pending> queue = new ConcurrentQueue<Pending>();
        private readonly ManualResetEvent stopping = new ManualResetEvent(false);
        private volatile Session current;
        private readonly Thread worker;
        private readonly Action<string> trace;

        public LocalLink(int port, Action<string> trace = null)
        {
            if (port < 1 || port > 65535) throw new ArgumentOutOfRangeException("port");
            this.port = port;
            this.trace = trace ?? delegate { };
            worker = new Thread(Run) { IsBackground = true, Name = "ShenPulse Crash local" };
            worker.Start();
        }

        private void Run()
        {
            while (!stopping.WaitOne(0))
            {
                var session = new Session { client = new TcpClient { NoDelay = true } };
                try
                {
                    session.client.Connect(IPAddress.Loopback, port);
                    if (stopping.WaitOne(0)) break;
                    current = session;
                    trace("Connexion à ShenPulse établie.");
                    var stream = session.client.GetStream();
                    var bytes = new byte[4096];
                    using (var frame = new MemoryStream())
                    {
                        int length;
                        while (!stopping.WaitOne(0) && (length = stream.Read(bytes, 0, bytes.Length)) > 0)
                            for (int i = 0; i < length; i++)
                            {
                                if (bytes[i] != 0)
                                {
                                    if (frame.Length >= 65536) throw new InvalidDataException("Frame too large");
                                    frame.WriteByte(bytes[i]); continue;
                                }
                                if (frame.Length > 0)
                                {
                                    if (queue.Count >= 128) throw new InvalidDataException("Queue full");
                                    queue.Enqueue(new Pending { session = session, json = Encoding.UTF8.GetString(frame.ToArray()), received = DateTime.UtcNow });
                                    frame.SetLength(0);
                                }
                            }
                    }
                }
                catch (Exception) { /* ShenPulse may be closed; reconnect locally. */ }
                finally
                {
                    if (ReferenceEquals(current, session)) { current = null; trace("Connexion à ShenPulse fermée ; nouvelle tentative automatique."); }
                    session.client.Close();
                }
                stopping.WaitOne(1000);
            }
        }

        public bool Connected { get { return current != null; } }

        public void Pump(Func<Request, string> execute)
        {
            Pending pending;
            for (int count = 0; count < 8 && queue.TryDequeue(out pending); count++)
            {
                if (stopping.WaitOne(0) || !ReferenceEquals(current, pending.session)) continue;
                int id = 0;
                string response;
                try
                {
                    var request = Protocol.Decode(pending.json, out id);
                    if (pending.session.replies.TryGetValue(id, out response)) { Send(pending.session, response); continue; }
                    if ((DateTime.UtcNow - pending.received).TotalSeconds > 5) throw new InvalidOperationException("Interaction expirée pendant une pause ou un chargement.");
                    response = Protocol.Encode(new Reply { id = id, status = 0, message = execute(request) });
                }
                catch (Exception error)
                {
                    response = Protocol.Encode(new Reply { id = id, status = error is InvalidOperationException ? 3 : 1, message = error.Message });
                }
                if (id > 0)
                {
                    pending.session.replies[id] = response;
                    pending.session.replyOrder.Enqueue(id);
                    while (pending.session.replyOrder.Count > 1024) pending.session.replies.Remove(pending.session.replyOrder.Dequeue());
                }
                Send(pending.session, response);
            }
        }

        private void Send(Session session, string json)
        {
            if (!ReferenceEquals(current, session)) return;
            try { var bytes = Encoding.UTF8.GetBytes(json + "\0"); session.client.GetStream().Write(bytes, 0, bytes.Length); }
            catch (Exception) { session.client.Close(); }
        }

        public void Dispose()
        {
            stopping.Set();
            var session = current; current = null;
            if (session != null) session.client.Close();
            worker.Join(1500);
            Pending ignored; while (queue.TryDequeue(out ignored)) { }
        }
    }
}
