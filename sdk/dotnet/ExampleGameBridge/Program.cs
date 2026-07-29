using ShenPulse.GameSdk;

using var server = new SimpleTcpEffectServer(28379, async request =>
{
    Console.WriteLine(
        $"Effect={request.Effect.Code}, Viewer={request.Effect.Viewer}, " +
        $"Quantity={request.Effect.Quantity}, Duration={request.Effect.Duration}");

    // Replace this switch with calls into the game or mod API.
    await Task.Yield();
    return request.Effect.Code switch
    {
        "spawn_enemy" => EffectResponse.Success(request, "Enemy spawned"),
        "heal_player" => EffectResponse.Success(request, "Player healed"),
        "damage_player" => EffectResponse.Success(request, "Damage applied"),
        _ => EffectResponse.Failure(request, "Unsupported effect")
    };
});

Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    server.Stop();
};

Console.WriteLine("ShenPulse example bridge listening on 127.0.0.1:28379");
await server.RunAsync();

