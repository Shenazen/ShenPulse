# Compteurs des overlays

## Source commune des tapotages

Le tableau de bord et le Like Goal utilisent `liveLikeCount` dans
`src/shared/live-statistics.js` : le total de likes du LIVE fourni par la
plateforme (`statistics.liveSession.platformLikes`) prévaut ; si la plateforme
ne le fournit pas, le compteur des événements réels du LIVE (`liveSession.likes`)
est utilisé. Les cumuls historiques et les likes du simulateur ne sont pas
utilisés pour le bilan réel.

Rejoindre une salle à 18 300 likes et recevoir un lot de 30 tapotages donne donc
18 300 dans les deux affichages, pas 30 dans le Like Goal. Les lots restent
distincts pour les règles de jeu et le classement des tapoteurs : le total de la
salle ne doit pas être attribué au seul spectateur du premier événement reçu.

Le noyau enregistre les statistiques avant l'état des overlays. Il publie ensuite
la valeur absolue `data.likeGoalCurrent` vers les overlays OBS et les aperçus
ShenPulse. Le runtime remplace sa valeur avec ce total au lieu de réadditionner
le lot. L'hydratation, les animations et le relais public conservent le même
contrat, sans nouvelle requête ni boucle de polling.

Un spectateur bloqué reste comptabilisé dans les statistiques. Pour garder aussi
les overlays OBS locaux synchronisés, son tapotage réel publie uniquement le
total anonyme sur le canal `like-goal` : aucune identité ni événement brut n'est
diffusé et aucune commande, règle ou action de fin d'objectif n'est exécutée.
Les événements bloqués de simulation ne déclenchent pas cette publication.

## Arrêt, reprise et commandes explicites

- Après la fin du LIVE, le dernier compteur reste visible ; les événements réels
  hors session ne le modifient pas.
- Reprendre la même salle conserve les statistiques du LIVE et réinitialise les
  overlays avec ce même total, même avant le prochain événement.
- Une nouvelle salle démarre à zéro.
- Le chargement disque et le changement de compte corrigent les anciens
  compteurs divergents lorsqu'un bilan réel existe. Les objectifs, thèmes et
  autres configurations ne sont pas modifiés.
- Les commandes explicites `set`, `reset`, les ajustements et le simulateur
  restent fonctionnels. Ils marquent une valeur manuelle (`likeGoalManual`)
  conservée à la lecture, sans changer les statistiques du tableau de bord.
  Le prochain tapotage réel recale le Like Goal sur le total du LIVE ; démarrer
  une session remet également les overlays en mode LIVE.
- Sans bilan réel ni total absolu dans un ancien événement d'aperçu, le runtime
  garde le comportement compatible d'addition des lots.

## Vérification

`tests/like-goal-live-count.test.js` couvre la connexion en cours de LIVE, les
totaux répétés ou retardés, le fallback, les simulations, les opérations
manuelles, la reprise, la migration, l'isolation de compte, le relais et le
pipeline sans clonage complet. `tests/overlay-dom.test.js` vérifie également
l'affichage dans le vrai DOM du runtime, après hydratation et avec un total zéro.

### Validation locale du 13 octobre 2026

`npm run verify` : 1 246 tests réussis, aucun échec ; lint et audit de cycles
valides. Le journal complet est conservé dans
`release/overlays-like-goal-verification.log`. Les tests utilisent des états
isolés : aucun cadeau, message, action IRL ou événement n'est envoyé au LIVE
réel. Aucun déploiement du site ou du runtime public n'est effectué.

Le paquet local `dist/win-unpacked` a été reconstruit puis relancé avec l'accord
de l'utilisateur. Quinze fichiers de fonctionnement et ressources ont été
comparés octet par octet aux sources dans `app.asar`, sans divergence. Le LIVE
s'est reconnecté. Une lecture seule de l'API locale après relance a confirmé
31 270 tapotages dans les deux compteurs, sans valeur manuelle active. Aucun
événement de test n'a été injecté pour ce contrôle.
