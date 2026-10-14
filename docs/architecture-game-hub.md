# Architecture des interactions de jeu

La façade [game-hub.js](../src/main/game-hub.js) conserve ses six exports et
les événements `effect-start`, `effect-result`, `bridge-message` et
`bridge-error`. Les catalogues, protocoles, ports, délais et stratégies de
reprise existants ne sont pas changés.

## Domaines internes

| Module sous `src/main/game-hub/` | Responsabilité |
| --- | --- |
| `interaction-management.js` | Migration versionnée, initialisation et réparation des interactions. |
| `interaction-defaults.js` | Fabrique des règles, résolution des cadeaux et réparations ciblées. |
| `commands.js` | Validation de pack, interpolation et paramètres initiaux partagés. |
| `effect-payload.js` | Charge utile d'un effet indépendante de l'état global. |
| `http-bridges.js` | Registre unique des cinq passerelles HTTP natives. |
| `transports.js` | TCP client/serveur, WebSocket, HTTP et UDP. |
| `rcon.js` | Encodage, lecture et échange RCON historiques. |

Le hub décide si l'effet est autorisé, recherche le pack, déclenche les
événements et sélectionne le transport. La charge utile et les règles par
défaut partagent la même fabrique de paramètres initiaux. Les diagnostics et
l'exécution partagent aussi le registre des passerelles, ce qui évite deux
listes de connecteurs maintenues séparément.

## Copies et confidentialité

Une exécution ne demande plus de snapshot complet du store pour lire la
sélection ou le connecteur. Les lectures utilisent seulement :

- `session.activeGamePackId`, et seulement si aucun pack explicite n'est fourni ;
- `commerce.subscription` et `commerce.gameEntitlements` pour le verrou d'accès ;
- `game.connectorOverrides` pour le connecteur et sa référence de secret.

La validation propriétaire des packs réservés reste obligatoire. L'accès
au coffre utilise toujours `getSecret` et aucune charge utile ne reçoit
les workspaces, le catalogue complet, les jetons de compte ou l'historique.
Les paramètres et commandes gardent leur conversion et leur neutralisation
historiques ; changer leur sens serait une modification fonctionnelle distincte.

## Connexions et cycle de vie

Les maps de sockets et ponts restent sur la façade et sont consultées par
le domaine de transports : il n'existe pas de second cache caché. Les connexions
actives sont réutilisées comme auparavant. `disconnectAll()` ferme les
connexions, attend les ponts serveur et vide les mêmes maps.

Le TCP client conserve le JSON terminé par NUL et la corrélation
`requestId`. Le serveur TCP conserve ses reprises d'erreurs temporaires
configurées. HTTP reste annulable ; UDP utilise un socket ponctuel.
RCON conserve ses identifiants d'authentification et de commande.

## Tests et extensions

`game-hub.test.js` et les tests d'intégration des jeux couvrent les vrais
catalogues, commandes, cadeaux, roues et transports. Les six tests
`game-hub-architecture.test.js` protègent les exports, l'ordre des événements,
les projections minimales, le verrou commercial, les paramètres indépendants,
le registre HTTP et le partage des caches.

Pour une nouvelle passerelle HTTP compatible, injecter son service dans le
constructeur et ajouter son type au registre ; vérifier diagnostic et effet.
Pour un protocole différent, créer son domaine et conserver le contrôle
d'accès dans le hub avant tout effet ou ouverture de connexion.
