# Connecteurs

## TikTok LIVE automatique

Renseignez seulement le `@` TikTok depuis la barre supérieure. ShenPulse tente
immédiatement de détecter le LIVE et poursuit automatiquement la surveillance si
le compte est hors ligne. Aucun endpoint, jeton ou mot de passe TikTok n'est
demandé.

## WebSocket plateforme

Configurez une URL `ws://` ou `wss://` qui émet l'un des formats suivants :

```json
{ "event": "gift", "data": { "uniqueId": "alice", "giftName": "Rose", "repeatCount": 1 } }
```

```json
{ "type": "follow", "user": { "id": "1", "displayName": "Alice" }, "data": {} }
```

Types reconnus : `chat`, `gift`, `like`, `follow`, `share`, `subscribe`,
`raid`, `join`, `roomUser`, `streamEnd`.

## Passerelle de jeu

Un pack JSON associe un effet à une charge utile. Avec SimpleTCP, ShenPulse envoie
du JSON UTF-8 terminé par `NUL` et attend facultativement une réponse.

```json
{
  "requestId": "uuid",
  "type": 1,
  "effect": { "code": "spawn_zombie", "viewer": "Alice", "quantity": 1 }
}
```

Le mod répond avec :

```json
{ "requestId": "uuid", "status": "success", "message": "Zombie spawned" }
```
