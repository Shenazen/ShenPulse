# Organisation de Coin Pusher

`CoinPusherGame.vue` compose une seule instance du jeu. Il conserve les références
Vue utilisées dans le template, les événements navigateur, la boucle d'animation,
les images et le choix entre WebGL et Canvas. Le découpage ne remplace pas la
simulation et ne réduit aucune capacité de pièces, combo ou file d'attente.

## Modules du jeu

| Fichier | Responsabilité |
| --- | --- |
| `types.ts` | Pièces, particules, scores, lots et requêtes audio |
| `constants.ts` | Dimensions, cadences et budgets historiques |
| `presentation.ts` | Formatage et calculs purs partagés par le template et les contrôleurs |
| `state.ts` | État numérique mutable propre à une instance |
| `resources.ts` | Contrat typé des références et collections ; chaque contrôleur utilise un sous-ensemble explicite |
| `drops.ts` | Cadeaux normalisés, déduplication, lots et apparition progressive |
| `simulation.ts` | Physique, collisions, piles, transitions de pièces et particules |
| `scoring.ts` | Points, classement et regroupement des effets visuels par frame |
| `rounds.ts` | Pause, reprise, chrono, poussées, podium et réinitialisation |
| `mystery.ts` | File de révélations, résolution du débordement et timers annulables |
| `audio.ts` | File priorisée, cadence de lecture et fermeture du contexte audio |
| `legacy-renderer.ts` | Dessin Canvas de compatibilité lorsque WebGL n'est pas disponible |
| `settings/` | Réglages et stockage, accessibles par la façade publique `../coinPusherSettings.ts` |
| `three/` | Composition du rendu 3D, textures, atlas et ressources GPU |

Les fabriques reçoivent les collections existantes et des références Vue. Elles
ne recopient pas la population physique à chaque frame et ne possèdent pas
d'état global mutable. Les callbacks entre contrôleurs sont injectés : importer
un module ne démarre ni animation, ni audio, ni timer. Les positions et images
qui peuvent changer passent par des getters, afin de ne pas figer un ancien état.

## Invariants importants

- `maxCoins` limite uniquement les pièces simultanément simulées. Un lot en
  attente reste complet, y compris les combos supérieurs à cette capacité.
- La poussée finale vide les lots ciblés et attend le comptage ainsi que les
  effets mystère avant de publier le podium. Les reprises après pause restent
  possibles et les cadeaux ne s'ajoutent pas après la fin de manche.
- Les identifiants de cadeaux restent dédupliqués pendant cinq minutes.
- Les sons restent regroupés par clé, avec dix requêtes et une cadence de
  vingt-quatre millisecondes. Les priorités et gains restent identiques.
- Les effets mystère conservent huit éléments en attente ; le débordement est
  résolu immédiatement, sans perdre l'effet associé au cadeau.
- Le démontage retire les cinq abonnements navigateur et annule les timers de
  révélations, toasts et annonces. Le contexte audio est fermé par son propriétaire.

## Vérification

`npm run games:build` recompile les vrais modules Vue/TS et les styles extraits.
`node --test tests/coin-pusher*.test.js` exécute les contrats du jeu, des profils
et du rendu 3D.

`tests/coin-pusher-game-architecture.test.js` charge le vrai script du composant
avec ses imports. Les traces enregistrées avant l'extraction des contrôleurs
vérifient douze cadeaux dédupliqués, cent vingt pas de physique, les scores
agrégés, deux cents pièces comptées malgré une capacité simultanée de quatre-
vingts, douze mystères résolus et 4 219 opérations Canvas identiques. Les tests
vérifient aussi le montage/démontage et l'isolation de deux instances.

Les tests de contrats source suivent le graphe réel d'imports avec
`tests/helpers/original-game-sources.js`. Ils ne reposent pas sur une copie de
l'ancien fichier monolithique. Les fixtures ne doivent pas être régénérées
automatiquement pour faire passer une régression : analyser d'abord tout écart.
