using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ShenPulse.GameSdk;

public sealed class EffectRequest
{
    [JsonPropertyName("requestId")]
    public string RequestId { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public int Type { get; set; }

    [JsonPropertyName("effect")]
    public EffectPayload Effect { get; set; } = new EffectPayload();
}

public sealed class EffectPayload
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("viewer")]
    public string Viewer { get; set; } = string.Empty;

    [JsonPropertyName("viewerId")]
    public string ViewerId { get; set; } = string.Empty;

    [JsonPropertyName("quantity")]
    public double Quantity { get; set; } = 1;

    [JsonPropertyName("duration")]
    public double Duration { get; set; }

    [JsonPropertyName("parameters")]
    public Dictionary<string, object> Parameters { get; set; } = new Dictionary<string, object>();
}

public sealed class EffectResponse
{
    [JsonPropertyName("requestId")]
    public string RequestId { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "success";

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    public static EffectResponse Success(EffectRequest request, string message = "") =>
        new EffectResponse { RequestId = request.RequestId, Status = "success", Message = message };

    public static EffectResponse Retry(EffectRequest request, string message) =>
        new EffectResponse { RequestId = request.RequestId, Status = "temporary-failure", Message = message };

    public static EffectResponse Failure(EffectRequest request, string message) =>
        new EffectResponse { RequestId = request.RequestId, Status = "permanent-failure", Message = message };
}

