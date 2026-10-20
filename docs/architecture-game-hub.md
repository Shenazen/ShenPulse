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

The Mortuary Assistant utilise `websocket-server` : ShenPulse écoute uniquement
sur `127.0.0.1:58434` et le mod s'y connecte directement. Les effets sont envoyés
en JSON (`type: 1`), avec une durée convertie de secondes en millisecondes.
Seuls les accusés `type: 0` corrélés à la demande confirment le déclenchement ;
les états du jeu et mises à jour des effets restent des événements séparés.
La fermeture ou reconnexion rejette les demandes en attente sans les rejouer.

Le ZIP versionné du mod est livré dans `resources/installer-assets`, contrôlé
en taille et SHA-256 avant extraction. `scripts/build-the-mortuary-assistant-mod.ps1`
reconstruit l'adaptation à partir de deux entrées épinglées, conserve les licences
du chargeur et l'attribution, supprime la détection du logiciel compagnon et les
mentions à l'écran. Les gardes et implémentations d'effets sont conservées.
L'installation sauvegarde puis retire l'ancien DLL pour éviter deux mods actifs.
Le prérequis .NET 6 est installé seulement s'il manque.

Unturned réutilise `tcp-server` sur `127.0.0.1:58435`. Son module original
ShenPulse utilise le chargeur natif `IModuleNexus`, sans logiciel compagnon.
Les 27 commandes passent par une file bornée et sont exécutées sur le fil Unity
avant confirmation. Le harnais C# vérifie la fragmentation, les bornes,
la déduplication et la reconnexion. L’archive n’embarque aucune DLL du jeu.
Voir [le contrat et la construction Unturned](unturned.fr.md).

Crash Bandicoot N. Sane Trilogy utilise `tcp-server` sur `127.0.0.1:58436`.
Son pont autonome rejoint le jeu Steam, vérifie la version et les emplacements
mémoire, exécute 26 commandes et restaure les modifications temporaires.
Voir [la qualification Crash](crash-bandicoot.fr.md).

Les illustrations sont résolues par `game-catalog/interaction-art.js` à partir
du registre local `resources/catalogs/game-interaction-art.json`. Seul le champ
`image` des effets sans visuel est ajouté ; les identifiants, paramètres,
transports et règles restent inchangés. Le même catalogue alimente les cartes,
l’éditeur et les exports d’overlays. Voir [les visuels des interactions](interaction-art.fr.md).

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
