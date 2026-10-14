# Jeux : catalogues, installation et exécution

## Façades conservées

`game-runtime.js` conserve `GameRuntimeService` et ses utilitaires publics.
Il orchestre fenêtres, processus et installations ; les opérations disque et
réseau sont organisées sous `game-runtime/`.

| Module | Responsabilité |
|---|---|
| `installation.js` | séquence, progression, erreurs et nettoyage |
| `target-selection.js` | cibles proposées, dialogues et choix |
| `asset-download.js` | téléchargement, taille, SHA-256 et progression |
| `asset-deployment.js`, `deployments.js` | staging et déploiements |
| `archives.js`, `paths.js` | extraction et chemins sûrs |
| `gta-save.js` | sauvegarde GTA Enhanced |
| `discovery.js` | recherche des jeux installés |
| `processes.js`, `housekeeping.js` | démarrage, fermeture et nettoyage |
| `minecraft-server.js` | processus et configuration serveur |
| `constants.js` | constantes du runtime |

Le contexte est fourni explicitement par la façade : store, application,
dialogues, fenêtre et callbacks nécessaires. Les modules métier n'importent pas
Electron pour ouvrir une fenêtre au chargement.
Le contrôle d'accès précède lancement ou téléchargement ; l'opération se retire
de `activeInstalls` même après annulation ou erreur.

## Garanties à conserver

- Validation des URL d'assets et chemins enfants avant écriture.
- Vérification de taille et SHA-256 avant utilisation.
- Staging avant déplacement et protection des sauvegardes existantes.
- Conservation des choix de cibles, cas « setup only » et erreurs.
- Aucun téléchargement ou lancement réel dans les tests d'architecture.

Les helpers de recherche des émulateurs sont dans `runtime-files.js`.
Ils acceptent un prédicat et renvoient aucun résultat pour une racine absente.
Le helper des archives a une autre politique (erreur sur racine invalide et ordre
de parcours historique) : il reste séparé.

## Catalogues et manifestes

`game-catalog.js` assemble jeux internes/externes, guides et effets depuis
`game-catalog/` et retourne des copies indépendantes.
Les modes Minecraft sont séparés : Bedrock, sandbox et survie.
Les associations historiques restent ordonnées.

`game-installer-manifest.js` assemble un manifeste par jeu dans
`game-installers/`. URL, versions, tailles, empreintes et ordre d'assemblage
n'ont pas changé lors de l'extraction. L'objet garde son gel historique.
Une mise à jour d'asset relève d'une opération distincte.

`catalogs.js` assemble cadeaux, sons et médias depuis `catalogs/`.
Identifiants, caches, apprentissage et fusions sont conservés.
Les catalogues de mods réutilisent `game-catalog/mapping.js` pour leur contrat
commun d'association déclencheur/effet.

## Jeux et compatibilité

Les sources Vue sont dans `src/renderer/games/original-src/`, non dans le bundle
`games/original/`. Chaque jeu charge à la demande sa logique, son CSS et ses
dépendances. Une file ordonnée conserve les événements reçus pendant l'import ;
détruire l'hôte empêche leur rejeu.

L'hôte historique `games/host.html` charge les déclarations de
`game-host/common.js`, `deal.js`, `coin-pusher.js` et `connect-four.js`
avant `host.js`, qui conserve état et écouteurs. Cet ordre est testé.

Les traductions proviennent de `i18n/fr/` et `i18n/en/`, un fichier par domaine.
`messages.ts` conserve clés et ordre des langues.

## Validation

Les tests d'installation vérifient droits, progression, métadonnées, projections
et nettoyage sans installer un jeu. Les tests de runtime, accès et intégrations
couvrent les contrats historiques. Les traces des jeux comparent opérations,
géométries, ressources et styles compilés.

Un test simulé ne prouve pas une interaction physique avec tous les jeux/mods :
versions, comptes, réseaux et matériels externes nécessitent leurs propres essais.
