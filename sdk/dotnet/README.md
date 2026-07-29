# SDK C# ShenPulse

Le SDK implémente le protocole SimpleTCP utilisé par les packs de jeux. Il écoute
uniquement sur `IPAddress.Loopback`, décode les messages JSON terminés par NUL et
retourne un résultat `success`, `temporary-failure` ou `permanent-failure`.

```powershell
dotnet run --project ExampleGameBridge
```

Dans ShenPulse, sélectionnez « Jeu personnalisé — SimpleTCP », cliquez sur
« Tester », puis déclenchez un effet. L'exemple ne modifie aucun jeu : remplacez
le `switch` par l'API autorisée du jeu ou du mod.

