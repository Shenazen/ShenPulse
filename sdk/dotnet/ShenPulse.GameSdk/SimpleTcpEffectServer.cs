using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace ShenPulse.GameSdk;

public sealed class SimpleTcpEffectServer : IDisposable
{
    private readonly TcpListener _listener;
    private readonly Func<EffectRequest, Task<EffectResponse>> _handler;
    private readonly JsonSerializerOptions _jsonOptions;
    private CancellationTokenSource? _lifetime;

    public SimpleTcpEffectServer(
        int port,
        Func<EffectRequest, Task<EffectResponse>> handler,
        IPAddress? address = null)
    {
        if (port < 1 || port > 65535) throw new ArgumentOutOfRangeException(nameof(port));
        _handler = handler ?? throw new ArgumentNullException(nameof(handler));
        _listener = new TcpListener(address ?? IPAddress.Loopback, port);
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
    }

    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        if (_lifetime != null) throw new InvalidOperationException("Server is already running.");
        _lifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _listener.Start();

        try
        {
            while (!_lifetime.Token.IsCancellationRequested)
            {
                TcpClient client = await _listener.AcceptTcpClientAsync().ConfigureAwait(false);
                _ = HandleClientAsync(client, _lifetime.Token);
            }
        }
        catch (ObjectDisposedException) when (_lifetime.Token.IsCancellationRequested)
        {
        }
        catch (SocketException) when (_lifetime.Token.IsCancellationRequested)
        {
        }
    }

    public void Stop()
    {
        _lifetime?.Cancel();
        _listener.Stop();
    }

    private async Task HandleClientAsync(TcpClient client, CancellationToken cancellationToken)
    {
        using (client)
        using (NetworkStream stream = client.GetStream())
        {
            var buffer = new byte[8192];
            using var message = new MemoryStream();

            while (!cancellationToken.IsCancellationRequested)
            {
                int read = await stream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)
                    .ConfigureAwait(false);
                if (read == 0) return;

                for (int index = 0; index < read; index++)
                {
                    if (buffer[index] != 0)
                    {
                        if (message.Length >= 1024 * 1024) return;
                        message.WriteByte(buffer[index]);
                        continue;
                    }

                    EffectResponse response;
                    try
                    {
                        string json = Encoding.UTF8.GetString(message.ToArray());
                        var request = JsonSerializer.Deserialize<EffectRequest>(json, _jsonOptions)
                            ?? throw new JsonException("Empty request.");
                        response = await _handler(request).ConfigureAwait(false);
                        response.RequestId = request.RequestId;
                    }
                    catch (Exception exception)
                    {
                        response = new EffectResponse
                        {
                            Status = "permanent-failure",
                            Message = exception.Message
                        };
                    }

                    byte[] responseBytes = Encoding.UTF8.GetBytes(
                        JsonSerializer.Serialize(response, _jsonOptions) + "\0");
                    await stream.WriteAsync(responseBytes, 0, responseBytes.Length, cancellationToken)
                        .ConfigureAwait(false);
                    message.SetLength(0);
                }
            }
        }
    }

    public void Dispose()
    {
        Stop();
        _lifetime?.Dispose();
    }
}

