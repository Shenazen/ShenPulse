# Organisation des tests de ShenPulse

La commande `npm test` découvre tous les fichiers `tests/*.test.js`. Les tests de domaine restent à ce niveau : leurs chemins fondés sur `__dirname`, leurs mocks et leur résolution CommonJS conservent le même contexte que les anciennes suites. Les fixtures et outils partagés sont dans `tests/helpers/` ; ce dossier n'est pas une suite supplémentaire.

## Suites de contrats réparties par responsabilité

| Ancienne suite | Domaines actuels | Scénarios conservés |
| --- | --- | --- |
| `renderer-dialog.test.js` | Shell/profils/dashboard ; `renderer-dialog-games` ; `renderer-dialog-actions-audio` ; `renderer-dialog-commerce`. | 51 |
| `game-runtime-contract.test.js` | Déploiements ; `game-runtime-installers` ; `game-runtime-minecraft` ; `game-runtime-integrated`. | 28 |
| `account-service.test.js` | Authentification ; `account-service-entitlements` ; `account-service-payments`. | 18 |
| `catalog-regressions.test.js` | Jeux/catalogue ; `catalog-overlay-designs` ; `catalog-overlay-previews`. | 44 |

Les 141 blocs `test(...)` de ces quatre suites ont été conservés textuellement, avec seulement la normalisation CRLF habituelle du dépôt. La répartition ne change ni les scénarios, ni les assertions, ni les valeurs attendues. Le plus grand fichier de cette répartition comporte 652 lignes, contre 1 381 avant le découpage.

`account-service-fixtures.js` contient le store mémoire et le générateur de réponses HTTP utilisés par les trois suites du compte. Chaque appel crée son propre état, ses secrets et ses compteurs ; les tests ne partagent pas de session Firebase et n'écrivent aucun secret utilisateur.

`catalog-regression-fixtures.js` lit une seule fois les sources du catalogue, des overlays et du renderer pour les trois suites correspondantes. La racine est résolue depuis le dossier des helpers avec les mêmes cibles absolues qu'avant. Ces snapshots ne sont pas modifiés par les tests.

## Contrats sur des sources découpées

Les assertions qui portent sur plusieurs modules lisent leurs graphes réels avec les helpers existants : `main-source-bundles`, `source-bundles`, `original-game-sources`, `legacy-game-host-source` et `native-source-bundles`. Un test ne doit pas recopier dans la façade du texte déplacé uniquement pour satisfaire une expression régulière. Les lectures de Vue gardent les blocs de style requis, et les lectures TypeScript incluent les moteurs métier extraits.

Pour un nouveau test, choisir le domaine concerné et garder le comportement testé explicite. Réutiliser une fixture uniquement si elle a le même contrat ; deux mocks aux comportements différents ne doivent pas être fusionnés artificiellement. Les scénarios indépendants gardent leurs propres données, timers, fichiers temporaires et nettoyage.

## Non-régression du rendu 3D

`coin-pusher-three-architecture.test.js` protège l'API publique, les fonctions géométriques, les coordonnées, les limites et les textures Canvas. `coin-pusher-scene-composition.test.js` complète ces contrats avec de vrais objets Three.js et un backend WebGL simulé : traces d'arbre/matériaux/matrices, thèmes, pools, atlas, callbacks périmés, croissance des capacités, qualité adaptative et libération des ressources. Les fixtures de traces ont été capturées avant la composition du renderer.

Ces tests ne mesurent ni les FPS ni la RAM du système et ne remplacent pas une vérification visuelle sur le GPU de la machine. Le contrôle sémantique ciblé du rendu est possible avec les types disponibles du dépôt ; une validation TypeScript strictement complète nécessiterait notamment les déclarations Three.js absentes de la configuration actuelle.

## Vérification

Exécuter `npm run lint`, puis `npm test` pour la validation globale. Une suite peut aussi être exécutée seule avec `node --test tests/<domaine>.test.js` ; aucun ordre entre suites ne doit être requis. Le mode global `--test-isolation=none` reste inchangé dans `package.json`.
