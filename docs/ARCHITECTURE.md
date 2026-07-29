# Architecture

```text
TikTok direct / plateforme / relais autorisé
          │ événement normalisé
          ▼
 SourceHub ──► EventPipeline ──► RuleEngine ──► ActionRunner
                                      │              │
                                      │              ├─ Overlay / TTS / audio
                                      │              ├─ OBS / HTTP / Spotify
                                      │              └─ GameHub
                                      │                    ├─ TCP / WebSocket
                                      ▼                    ├─ HTTP / UDP
                               ActivityStore               └─ Minecraft RCON
                                      │
                         HTTP + SSE + WebSocket local
                                      │
                          OBS / LIVE Studio / SDK
```

Le processus principal Electron possède les accès réseau et fichier. Le renderer
n'accède qu'à une API IPC étroite exposée par `preload.js`.

Les événements internes utilisent un schéma stable :

```json
{
  "id": "uuid",
  "type": "gift",
  "source": "demo",
  "timestamp": "2026-07-27T18:00:00.000Z",
  "user": { "id": "42", "name": "viewer", "displayName": "Viewer" },
  "data": { "giftId": "rose", "giftName": "Rose", "count": 1, "value": 1 }
}
```

Les packs de jeux sont déclaratifs et n'injectent pas de code dans des processus.
Ils décrivent les effets et le protocole du mod ou du serveur local.
