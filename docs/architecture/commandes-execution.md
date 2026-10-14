# Contrat des commandes exécutables

La page **Commandes** réutilise la collection historique `commands`. Une commande commençant par `!` peut désormais contenir une cible `execution`, au lieu de seulement produire une réponse textuelle. Aucun profil ni ancien texte n'est effacé lors de cette évolution.

## Modules partagés

`src/shared/command-execution.js` est un module pur compatible Node et navigateur (`ShenPulseCommandExecution`). Il fournit `normalizeCommandExecution`, `describeCommandExecution`, la liste `MUSIC_OPERATIONS` et le dictionnaire `OVERLAY_OPERATIONS`. Dans le navigateur, charger ce module avant `chatbot-command.js`.

`src/shared/chatbot-command.js` conserve les règles de nommage, alias, plateformes, audiences et cooldowns historiques. Les commandes restent insensibles à la casse : `!skip titre` correspond à `!skip`, mais pas `!skipper`. L'aperçu ajoute une description d'exécution ; il ne lance aucune action et ne consomme aucun cooldown.

## Schéma de données

```js
// Contrôle musical simple.
{ kind: 'command', command: '!skip', execution: { type: 'music', operation: 'next' } }

// Recherche Spotify à partir des arguments du chat.
{ kind: 'command', command: '!musique', execution: { type: 'music', operation: 'queue', useArgs: true } }

// Référence vers une action déjà enregistrée dans le profil actif.
{ kind: 'command', command: '!ballon', execution: { type: 'action', actionId: 'action_balloon' } }

// Effet sur un compteur existant.
{ kind: 'command', command: '!victoire', execution: { type: 'overlay', overlayKey: 'winCounter', operation: 'adjust', amount: 1 } }
```

Les opérations musicales sont `next`, `previous`, `play`, `pause`, `queue`, `play_track`, `play_playlist` et `volume`. Pour une recherche, choisir `query` ou `useArgs`. Une référence fixe de titre utilise `uri: 'spotify:track:…'`. Une playlist utilise `playlistId` ou une URI Spotify de playlist ; les identifiants contiennent 22 caractères alphanumériques. Les liens HTTPS de `open.spotify.com` sont transformés en URI sans requête réseau. Le volume est un entier de 0 à 100.

| Overlay | Opérations autorisées |
| --- | --- |
| `timer` | `add`, `remove`, `set`, `pause`, `resume`, `reset` |
| `winCounter` | `adjust`, `set`, `reset`, `multiplier`, `random` |
| `likeGoal`, `coinJar` | `adjust`, `set`, `reset` |
| `wheel` | `spin` |
| `multiplierTimer` | `add`, `set`, `pause`, `resume`, `reset` |

Les secondes sont entières et limitées à la capacité existante du moteur (86 399 999 secondes). Les compteurs acceptent ±100 000 pour les victoires et ±100 000 000 pour les likes ou diamants. Un multiplicateur est compris entre 1 et 100 ; celui des victoires dure de 1 à 3 600 secondes. Une valeur définie pour un temps, des likes ou des diamants ne peut pas être négative.

## Sécurité et compatibilité

La normalisation construit un objet neuf avec uniquement les champs pertinents. Elle ne transmet aucune configuration arbitraire, URL réseau, action embarquée, choix temporaire de roue ou identifiant d'effet fourni dans le chat. `actionId` et `wheelId` sont des références, pas des commandes système. Le moteur doit contrôler à nouveau leur existence, les droits et l'appartenance au profil actif au moment d'exécuter ; un changement de compte/profil ne doit jamais réutiliser une référence d'un autre espace.

Le parseur partagé continue de lire les anciennes entrées sans `execution` pour
la compatibilité des profils/imports. ShenPulse n'affiche ni n'exécute toutefois
ces anciennes réponses, auto-réponses et messages programmés. Le moteur de
production fonctionne en mode commandes exécutables uniquement ; l'IPC refuse
les nouvelles mutations sans effet Musique, Action ou Overlay. Aucune donnée
historique n'est effacée ou convertie automatiquement. Un texte historique
présent dans une commande exécutable reste conservé mais n'est jamais envoyé.

Recevoir une commande TikTok suffit pour lancer un effet local autorisé : envoyer un message dans le chat est une permission distincte. Les contrôles Spotify restent soumis à une connexion et aux capacités réelles du compte/service. Une validation de forme ne prouve jamais la disponibilité d'un appareil, d'un compte musical ou d'un overlay.

Les tests de `tests/command-execution-contract.test.js` vérifient le contrat commun Node/navigateur, les bornes, les cibles interdites, la séparation des arguments et la conservation des données historiques.
