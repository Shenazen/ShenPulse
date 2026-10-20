using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using Newtonsoft.Json.Linq;
using ShenPulse.Unturned;

public static class ProtocolHarness
{
    private static void Check(bool ok, string message) { if (!ok) throw new Exception(message); }
    private static string Message(int id, string code, int quantity = 1)
    {
        return "{\"id\":" + id + ",\"type\":1,\"code\":\"" + code + "\",\"quantity\":" + quantity + ",\"parameters\":{\"value\":1}}";
    }
    private static void Reject(string json)
    {
        int id;
        try { Protocol.Decode(json, out id); }
        catch (Exception) { return; }
        throw new Exception("Invalid request was accepted: " + json);
    }
    private static void Write(NetworkStream stream, string json)
    {
        var data = Encoding.UTF8.GetBytes(json + "\0"); stream.Write(data, 0, data.Length);
    }
    private static JObject Reply(LocalLink link, NetworkStream stream, Func<Request, string> execute)
    {
        var deadline = DateTime.UtcNow.AddSeconds(3);
        while (!stream.DataAvailable && DateTime.UtcNow < deadline) { link.Pump(execute); Thread.Sleep(5); }
        Check(stream.DataAvailable, "No acknowledgement");
        stream.ReadTimeout = 2000;
        using (var bytes = new MemoryStream())
        {
            int next;
            while ((next = stream.ReadByte()) > 0) bytes.WriteByte((byte)next);
            return JObject.Parse(Encoding.UTF8.GetString(bytes.ToArray()));
        }
    }
    public static int Main()
    {
        try
        {
            Check(Protocol.Codes.Length == 27, "Expected 27 commands");
            int id;
            foreach (var code in Protocol.Codes) Check(Protocol.Decode(Message(1, code), out id).code == code, "Missing command");
            Reject(Message(1, "unknown")); Reject(Message(1, "heal", 0)); Reject(Message(1, "heal", 51));
            Reject(Message(1, "heal").Replace("\"quantity\":1", "\"quantity\":1.5"));
            Reject(Message(1, "heal").Replace("\"value\":1", "\"value\":101"));
            Reject(Message(1, "set_weather").Replace("\"value\":1", "\"value\":3"));
            Reject(Message(1, "heal").Replace("\"value\":1", "\"value\":\"NaN\""));
            Reject(Message(1, "heal") + "{}"); Reject("null"); Reject(new string('x', 65537));
            var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start();
            int port = ((IPEndPoint)listener.LocalEndpoint).Port;
            using (var link = new LocalLink(port))
            {
                var acceptance = listener.AcceptTcpClientAsync();
                Check(acceptance.Wait(3000), "Local connection failed");
                using (var socket = acceptance.Result)
                {
                    var stream = socket.GetStream(); int executions = 0;
                    int mainThread = Thread.CurrentThread.ManagedThreadId;
                    Func<Request, string> execute = request => {
                        Check(Thread.CurrentThread.ManagedThreadId == mainThread, "Effect ran off the game thread");
                        if (request.code == "day") throw new InvalidOperationException("Partie non chargée");
                        executions++; return "Exécuté : " + request.code;
                    };
                    var data = Encoding.UTF8.GetBytes(Message(1, "heal") + "\0");
                    stream.Write(data, 0, 7); stream.Write(data, 7, data.Length - 7);
                    Thread.Sleep(50);
                    Check(executions == 0 && !stream.DataAvailable, "Acknowledged before main-thread execution");
                    var first = Reply(link, stream, execute);
                    Check(first.Value<int>("id") == 1 && first.Value<int>("status") == 0 && executions == 1, "Wrong success");
                    Check(first.Value<string>("message").Contains("Exécuté"), "UTF-8 response corrupted");
                    Write(stream, Message(1, "heal")); Reply(link, stream, execute);
                    Check(executions == 1, "Duplicate command executed twice");
                    Write(stream, Message(2, "heal", 51));
                    Check(Reply(link, stream, execute).Value<int>("status") == 1 && executions == 1, "Invalid effect executed");
                    Write(stream, Message(3, "day"));
                    Check(Reply(link, stream, execute).Value<int>("status") == 3, "Temporary failure was hidden");
                    Write(stream, Message(4, "heal")); Thread.Sleep(30); socket.Close(); Thread.Sleep(50);
                    link.Pump(execute);
                    Check(executions == 1, "Queued command survived a lost connection");
                    var reconnect = listener.AcceptTcpClientAsync();
                    Check(reconnect.Wait(4000), "Reconnection failed");
                    using (var second = reconnect.Result)
                    {
                        Write(second.GetStream(), Message(1, "heal"));
                        Check(Reply(link, second.GetStream(), execute).Value<int>("status") == 0 && executions == 2, "New session reused stale replies");
                    }
                }
            }
            listener.Stop();
            Console.WriteLine("Unturned native protocol passed: 27 commands, bounds, UTF-8, fragmented frames, main-thread execution, deduplication, rejection and reconnection.");
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
