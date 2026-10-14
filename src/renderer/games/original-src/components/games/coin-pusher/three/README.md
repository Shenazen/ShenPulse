# Rendu 3D du Coin Pusher

`../../coinPusher3dRenderer.ts` reste le point d’entrée public. Les appels de Vue, les types des événements et les cinq fonctions exportées sont conservés. Le moteur ne se charge que lorsque le jeu Coin Pusher est demandé.

Les modules sont répartis par responsabilité :

| Module | Responsabilité |
| --- | --- |
| `types.ts` | Contrats des pièces, images, sprites, atlas et états du rendu. |
| `constants.ts` | Dimensions, couleurs et limites de ressources ; aucun budget n’a été augmenté. |
| `math.ts` | Capacités GPU, niveau de qualité, empreintes d’avatars et calcul des supports. |
| `positions.ts` | Conversion des coordonnées logiques vers les deux plateaux 3D. |
| `shelf-coordinates.ts` | Calculs du plateau sans dépendance aux constantes 3D, utilisables pendant leur initialisation. |
| `geometry.ts` | Géométries, UV et primitives communes des décors. |
| `machine-textures.ts` | Dessin Canvas des décors et des objets spéciaux. |
| `avatar-canvas.ts` | Dessin et recadrage des tuiles d’avatars. |
| `score-textures.ts` | Dessin des emplacements et des scores flottants. |
| `resources.ts` | Création/configuration des textures et libération dédupliquée des ressources GPU. |
| `coin-instances.ts`, `color-cache.ts` | Pièces, dés et tickets instanciés, poses lissées, couleurs et huit collections de travail réutilisées. |
| `avatar-atlas.ts` | Pages de portraits partagées, huit chargements simultanés, reprises et éviction par inactivité. |
| `floating-scores.ts`, `score-lanes.ts` | Pool de sprites, cache de textures référencées, couloirs et flashes de points. |
| `surface-textures.ts` | Deux surfaces indépendantes, annulation logique par tokens, lots de cibles par thème et recadrage UV uniquement si l'aspect change. |
| `particle-effects.ts` | Positions/couleurs des particules dans des tampons persistants. |
| `machine-materials.ts`, `machine-mechanics.ts`, `machine-decor.ts` | Matériaux partagés, lame/protections latérales et composition du meuble. |
| `galactic-context.ts`, `galactic-palette.ts` | Dépendances explicites des builders visuels et palette de matériaux commune. |
| `galactic-accents.ts`, `galactic-backdrop.ts`, `galactic-cabinet.ts`, `galactic-crown.ts`, `galactic-base.ts` | Accents animés, salle arrière, cadre incliné, écusson/diamant et socle/pousseur. |

Les constantes du pousseur utilisent `logicalShelfZ()` depuis `shelf-coordinates.ts` ; cette fonction ne dépend que des dimensions physiques. `positions.ts` la réexporte pour les appels de rendu. Cette séparation évite une dépendance circulaire entre le calcul des constantes et leur utilisation.

## Composition et cycle de vie

La façade crée les gestionnaires avec les groupes, matériaux ou callbacks nécessaires, puis orchestre les frames dans l'ordre historique. Aucun gestionnaire ne reçoit la façade entière : pas d'héritage, de copie du renderer ou d'affectation de méthodes sur un prototype. Le changement de thème conserve les portraits, les poses et les instances ; seuls les couloirs changent de peau.

Les géométries/materials visibles sont libérés par `disposeObject(scene)` ; les gestionnaires libèrent d'abord leurs ressources hors du graphe (atlas retirés, sprites du pool, textures de cache). Les matériaux communs au châssis ne sont pas possédés par les couloirs : leurs bordures utilisent une copie pour ne pas détruire le meuble lors d'un changement de réglages. `dispose()` est idempotent et invalide les callbacks asynchrones avant de libérer le GPU.

Les limites n'ont pas changé : croissance des capacités par puissances de deux sans suppression de pièces, 64 sprites/textures de scores, atlas 2 048 × 2 048, huit téléchargements de portraits, trois tentatives, 180 frames avant éviction des portraits inactifs. La qualité reste comprise entre 0,68 et 1, avec ombres toutes les une à trois frames selon la charge. Les pauses/onglets masqués ne sont pas considérés comme une surcharge.

Les optimisations de cette composition évitent huit nouvelles collections de travail et six nouvelles structures de cibles par frame. Le recadrage inchangé du plateau ne réécrit plus les UV et ne marque plus leur tampon pour un upload GPU. Ces économies sont des allocations/opérations supprimées, pas une mesure de RAM système ou de FPS.

## Vérification de la migration

`tests/coin-pusher-three-architecture.test.js` compare les traces capturées avant le déplacement : API publique, géométries, positions, capacités, qualité adaptative et huit dessins Canvas. Le test de libération utilise des ressources Three.js réelles partagées entre plusieurs objets et vérifie qu’elles sont libérées une seule fois. Il ne remplace pas une vérification visuelle WebGL.

`tests/coin-pusher-scene-composition.test.js` compare en plus les arbres complets, géométries, matériaux, matrices des instances, dessins Canvas, événements et libérations des thèmes arcade et galactique à leur capture avant découpage. Le backend WebGL est simulé, mais les groupes, matériaux, géométries et instances sont de vrais objets Three.js. Les scénarios couvrent aussi la croissance au-delà de 1 024 pièces, les pools/caches, les callbacks périmés, la cadence UV, la file de portraits et la restauration de contexte. Les assertions d'identité vérifient que les ressources sont réutilisées ; les chiffres de disposal comparent le cycle de vie historique, sans prétendre mesurer le pilote GPU.

La sortie `src/renderer/games/original/` est compilée par `npm run games:build`. Modifier les sources ici, pas les fichiers Vite générés.
