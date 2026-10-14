# Configuration et événements Coin Pusher

`../../coinPusherSettings.ts` est une façade compatible : elle expose toujours les mêmes 78 valeurs/fonctions publiques, ainsi que les types existants. Aucune clé de stockage ni nom d’événement n’a changé.

Les modules isolent les valeurs par défaut, les types, les normaliseurs de profil, les paliers de diamants, le calcul des valeurs de cadeau, leur reconnaissance, les événements LIVE, les dépôts de pièces et les commandes de partie. `storage-settings.ts` gère les profils ; `storage-events.ts` gère les derniers événements persistés. Les primitives de conversion, les identités et les images sont des dépendances de bas niveau sans accès au stockage.

Le découpage distingue `diamond-tiers.ts`, `gift-values.ts` et `gift-matching.ts` : les normaliseurs utilisent les calculs de diamants sans dépendre du chargement d’un profil. Cela évite une boucle de dépendances à l’initialisation.

Les migrations historiques et les limites restent dans les normaliseurs. Les montants très grands continuent d’être calculés avec `BigInt`, puis bornés à `Number.MAX_SAFE_INTEGER`. Les objets par défaut sont recréés pour ne pas partager de tableaux mutables entre profils.

`tests/coin-pusher-settings-architecture.test.js` compare les profils, cadeaux, commandes, 78 exports et cas limites capturés avant le déplacement. Il vérifie aussi la persistance, les événements publics et la remontée d’un échec de sauvegarde.
