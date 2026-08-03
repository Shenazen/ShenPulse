# ShenPulse

ShenPulse est une application Windows locale qui transforme les événements d'un
livestream en alertes, overlays, commandes et effets de jeu. Elle est conçue pour
être distribuée par le Microsoft Store sous l'identité
`ShenPulse.ShenPulse_mammcwaggkw0m`.

## Fonctionnalités

- moteur de règles avec filtres, seuils, probabilités, cooldowns et priorités ;
- événements chat, cadeau, abonnement, follow, partage, like, raid et test ;
- catalogue global de 122 sons, règles TTS pour chaque type d'événement et
  catalogue partagé de 932 cadeaux TikTok ;
- alertes audio/vidéo, synthèse vocale, objectifs, compte à rebours et roue ;
- overlays locaux pour OBS et sources HTTPS publiques pour TikTok LIVE Studio ;
- API locale HTTP, SSE et WebSocket au format `{ "event": "...", "data": {} }` ;
- connecteurs WebSocket génériques pour des fournisseurs autorisés ;
- passerelles jeux TCP, WebSocket, HTTP, UDP et Minecraft RCON ;
- installateurs versionnés Backblaze pour GTA V Mont Chiliad, Cult of the Lamb
  et les serveurs Minecraft, avec contrôle SHA-256, bridges locaux,
  Java/PaperMC, plugins et AutoClicker ;
- client OBS WebSocket 5, webhooks et connexion Spotify OAuth PKCE ;
- profils importables/exportables et journal d'activité local ;
- SDK C# optionnel pour écrire des passerelles de jeu.

## Démarrage

Prérequis : Windows 10 19041 ou plus récent, Node.js 22+.

```powershell
npm install
npm start
```

Au premier lancement, le mode Démo est disponible sans compte externe. OBS peut
utiliser les sources locales sur `127.0.0.1`. TikTok LIVE Studio utilise les
sources HTTPS permanentes générées par le relais temps réel ShenPulse.

## Tests et package Store

```powershell
npm run verify
npm run build:store
```

Le package Store est généré dans `dist/`. Consultez
[`docs/STORE_SUBMISSION.md`](docs/STORE_SUBMISSION.md) avant l'envoi dans
Partner Center, ainsi que [`docs/FEATURE_MATRIX.md`](docs/FEATURE_MATRIX.md)
pour distinguer les fonctions intégrées des connexions qui nécessitent un compte,
un endpoint ou un mod tiers.

## Connexions TikTok et autres plateformes

Pour TikTok, renseignez uniquement le `@` public du créateur. ShenPulse surveille
automatiquement le compte, détecte le passage en LIVE et se reconnecte entre les
sessions. Cette intégration utilise un connecteur tiers non affilié à TikTok et
peut dépendre des évolutions de la plateforme.

Les autres plateformes peuvent être reliées avec un endpoint WebSocket autorisé,
un relais local ou un fournisseur pour lequel vous possédez les droits et
identifiants nécessaires.

## Connexion Spotify

Ouvrez **Sons & voix > Connecter Spotify**, puis autorisez l'application
ShenPulse avec votre compte Spotify. L'autorisation utilise PKCE : aucun Client
Secret n'est embarqué. Les jetons reçus sont chiffrés localement avec le
coffre-fort Windows. Le contrôle de lecture nécessite un compte Spotify Premium
et un appareil Spotify actif. L'application Spotify ShenPulse doit déclarer
`http://127.0.0.1:21215/spotify/callback` dans ses URI de redirection.

## Sécurité

- `contextIsolation` est activé et `nodeIntegration` désactivé ;
- le renderer est protégé par une Content Security Policy ;
- l'API locale écoute exclusivement sur loopback et exige un jeton ;
- le relais public ne reçoit que l'état nécessaire aux widgets, sous un
  identifiant aléatoire révocable ; seule l'installation authentifiée peut y
  publier ;
- les secrets sont chiffrés avec le coffre-fort Windows via Electron ;
- aucune télémétrie n'est activée par défaut.

L'architecture et les procédures du relais sont détaillées dans
[`docs/PUBLIC_OVERLAYS.md`](docs/PUBLIC_OVERLAYS.md).
