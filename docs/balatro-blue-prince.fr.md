# Balatro et Blue Prince

Intégration locale du 21 octobre 2026. Les deux jeux utilisent le parcours
Installation → Interactions → Overlays → Lancement. Les déclencheurs restent
désactivés jusqu’au choix du créateur ; aucune association cadeau n’est inventée.
Les identifiants des 69 anciennes interactions Blue Prince sont conservés.

## Installation

- Balatro Steam : Lovely 0.10.0, Steamodded 26.1002.0 et adaptation du module
  Apache 2.0 Crowd Control. Construire le module avec `node scripts/build-balatro-mod.js`.
- Balatro Xbox Game Pass : chargement Lua dans `Assets/main.lua`, module isolé
  dans `Assets/shenpulse`. Le moteur GDK, l’exécutable et les sauvegardes restent
  ceux du jeu installé. Canal de fichiers locaux corrélés par identifiant et
  jeton, car cette édition ne fournit pas LuaSocket.
- Blue Prince Steam/Game Pass : archive officielle Crowd Control 1.1.0 et
  BepInEx 6 be.790, nécessaires pour Unity 6000.0.58f2. L’ancien BepInEx be.755
  de l’archive officielle provoquait une erreur fatale CLR sur le PC de test.
- Les téléchargements sont limités aux origines officielles avec taille et
  SHA-256 imposés. Les fichiers remplacés sont sauvegardés par l’installateur
  transactionnel. Une réparation exige la fermeture du jeu.

## Catalogues et conditions

Balatro : 125 commandes du pack public Crowd Control, transmises avec leur
casse exacte. Les effets nécessitent la sélection des cartes dans une mise et
les ressources correspondantes : cartes, jokers, consommables, etc.
`destroyDeck` détruit une carte du paquet, conformément à son implémentation.

Blue Prince : 76 identifiants enregistrés par le module, dont 75 exécutables.
L’entrée `force_kick` est explicitement verrouillée : son `Start` renvoie un
succès sans action et son `Tick` renvoie seulement une notification de fin.
Aucune autre méthode du module ne réalise cet effet. Elle ne doit donc jamais
être présentée comme opérationnelle ni recevoir un déclencheur actif.

Les ressources et objets demandent un joueur contrôlable. Les relances de plans
demandent l’écran de choix des pièces ; les plans/couleurs imposés ne peuvent pas
être remplacés tant que leur sélection n’est pas consommée. Les changements de
vitesse sont temporaires, en secondes dans ShenPulse et millisecondes sur le
protocole du module. `adddicebig` donne réellement 25 dés, selon le module.

## Validation sur ce PC

Jeux Xbox Game Pass dans `C:/XboxGames`, installés par le véritable installateur
ShenPulse avec un magasin de test isolé. Sauvegardes natives copiées avant les
essais. Aucune édition Steam n’était disponible pour un essai réel.

- Balatro : les 125 commandes ont renvoyé un succès du moteur GDK au cours
  d’essais dans une nouvelle manche. Vérification des variations d’argent,
  mains, défausses et cartes, ainsi que des dix écrans de boosters. Les effets
  destructifs ont été testés dans cette manche dédiée.
- Blue Prince : connexion native, ajouts/retraits de ressources, pelle,
  boussole, changements de vitesse et fin des effets, relances de plans
  individuels et complètes, et remplacement par une couleur confirmés en jeu.
  Les 75 commandes ne constituent pas 75 validations individuelles : les autres
  objets/plans dépendent des ressources et de la progression de cette partie.
- Le protocole couvre les enums numériques et camelCase de ConnectorLib.JSON,
  les réponses fragmentées, refus temporaires et fins d’effets.
- Tests automatisés du hub, des droits Pro, de la conservation des règles,
  du catalogue, des archives et de la réparation GDK sans double injection.

## Sources

- [Code public Balatro](https://github.com/WarpWorld/CCPack-PC-Balatro)
- [Guide Crowd Control Balatro](https://crowdcontrol.live/guides/balatro/)
- [Guide Crowd Control Blue Prince](https://crowdcontrol.live/guides/blueprince/)
- [Builds officiels BepInEx](https://builds.bepinex.dev/projects/bepinex_be)

Les licences et crédits du code Balatro restent dans `native/balatro/upstream`
et dans le module distribué. Le mod binaire Blue Prince est téléchargé depuis
son origine officielle, sans redistribution dans ce dépôt.
