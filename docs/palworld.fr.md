# Palworld — Steam et Xbox / Game Pass

Le module ShenPulse propose 74 interactions natives en solo, avec six aides et six pièges par défaut. Le jeu original est requis. Les serveurs publics et le multijoueur ne sont pas pris en charge.

## Installation et lancement

1. Fermer Palworld, puis utiliser « Installer automatiquement » dans sa fiche ShenPulse.
2. Lorsque les deux éditions sont présentes, choisir Steam ou Xbox / Game Pass. Pour Xbox, le dossier cible est `Content` ; pour Steam, la racine du jeu.
3. ShenPulse télécharge le pack Backblaze, vérifie sa taille et son SHA-256, sauvegarde les fichiers remplacés et prépare le module dans `Pal/Binaries/Win64` ou `Pal/Binaries/WinGDK`.
4. « Lancer le jeu » utilise l’édition choisie. Une instance de l’autre édition est refusée ; une instance de la bonne édition est réutilisée. Pour changer de plateforme, relancer l’installation.
5. Charger un monde solo et fermer les menus. La session ShenPulse doit être active pour que les événements viewers déclenchent les interactions.

Le transport utilise des fichiers locaux et un jeton généré à l’installation. Le module ne se connecte à aucun service tiers. Les commandes expirées, mal identifiées ou portant un autre jeton sont refusées. Une réponse positive confirme l’exécution native, pas seulement la connexion.

## Conditions des effets

- Les tailles des Pals nécessitent des Pals chargés autour du joueur. Les captures nécessitent une sphère et une cible capturable.
- Le raid nécessite une base construite appartenant au joueur, le personnage dans son périmètre et les invasions autorisées par le monde. Un autre raid ne peut pas être démarré tant qu’un raid est en préparation ou en cours. La confirmation apparaît après environ dix secondes ; le compte à rebours et les vagues restent ceux du jeu.
- La météorite vise un sol compatible devant le joueur. Le dépôt natif reste après la chute et peut provoquer des dégâts et des déplacements physiques à l’impact.
- La réapparition nécessite un personnage K.-O. Les autres commandes sont refusées à la mort, pendant une pause ou en multijoueur.
- Les effets temporaires expirent et rétablissent leur valeur initiale. Les soins, l’expérience, les apparitions et les événements peuvent être sauvegardés par Palworld. Utiliser un monde d’essai pour les premiers tests.

## Distribution et reconstruction

Archive : [palworld-shenpulse-1.0.0.zip](https://f003.backblazeb2.com/file/shenpulse-media/installer-assets/palworld/1.0.0/palworld-shenpulse-1.0.0.zip).

- Taille : `8733611` octets.
- SHA-256 : `dcd496afdcdc51da61ac794043c287ca26fd0f169e81a7d23b8bca78e247d407`.
- Sources : `native/palworld/{main,core,effects}.lua` et `MemberVariableLayout.ini`.
- Construction : `node scripts/build-palworld-pack.js` après placement de l’archive UE4SS épinglée dans `.artifacts/palworld`.
- Publication : registre `scripts/manifests/game-packs.json`, outil `scripts/publish-game-packs.js --game=palworld`.
- UE4SS épinglé : `UE4SS_v3.0.1-1183-gcdbc0b66.zip`, SHA-256 `e4a47e23e2eeb8379c4fc388d1b1686f01c6c5930d84a2ee4a6a9574b274e681` ; licence MIT conservée dans le pack.

Les binaires du chargeur restent dans `.artifacts` et Backblaze ; ils ne sont pas embarqués dans ShenPulse. Les sondes et commandes de diagnostic des essais ne sont pas distribuées. L’installateur retire les sondes locales connues avant le déploiement final.

## Validation du 28 octobre 2026

Versions testées : Palworld `v1.0.5.102999`, Steam AppID `1623730` et Xbox `PocketpairInc.Palworld` version package `1.10.2999.0`. ShenPulse de développement : `2.1.0`.

- 74 codes vérifiés sur Steam et 74 sur Game Pass : propriétés et expiration des effets, ressources et expérience, tailles et captures, caméra, apparitions, recherche policière, météorite, raid, mort et réapparition. Les relevés détaillés restent dans `.artifacts/palworld/results-{steam,xbox}.json`.
- Installation réelle par la fiche ShenPulse depuis Backblaze sur les deux éditions, vérification des fichiers de production et absence de `qa.lua`.
- Lancements réels depuis ShenPulse vers l’édition choisie ; connexions actives en monde solo. Soin complet déclenché depuis le bouton de test de la fiche Steam et santé complète constatée en jeu.
- Téléchargement public de l’archive vérifié intégralement, taille et SHA-256 concordants. Un transfert interrompu a été refusé, puis la nouvelle tentative s’est terminée correctement.
- 33 tests ciblés passent, incluant préparation et intégrité de chaque édition, sélection de lancement, accès révoqué, transfert du cadeau/viewer/durée dans la session active et boutons de la fiche. `npm run lint` passe.
- Nouvelle application Windows construite et ouverte. Cette validation ne constitue pas une publication Store : les autres utilisateurs devront recevoir la mise à jour de ShenPulse contenant cette intégration.

Les sauvegardes d’origine ont été copiées avant les essais. Les résultats concernent les versions ci-dessus ; une mise à jour de Palworld peut nécessiter une nouvelle validation du chargeur et des API natives.

### Avertissement de demarrage Steam

Le menu Steam affiche encore un avertissement concernant une erreur de la derniere session, meme apres une sortie par le menu. Aucun nouveau rapport de crash n’a ete cree pendant les essais du pack final (dernier rapport local : 28/10/2026 01:17). Le bouton OK permet de charger et jouer ; l’origine de cet indicateur persistant n’est pas identifiee. Les rapports historiques ont ete conserves a leur emplacement initial. Aucun contournement du message ni modification du controle des erreurs du jeu n’est distribue.
