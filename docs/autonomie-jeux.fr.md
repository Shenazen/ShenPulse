# Autonomie des jeux ShenPulse

Audit du **22 octobre 2026**, sur l’ensemble des **53 fiches du catalogue**, y compris les fiches masquées ou privées.

## Résultat

**37 jeux ou modes disposent d’une intégration locale.** Leur installation et leur lancement ne nécessitent pas le logiciel Crowd Control, son client Slim, un compte Crowd Control ou une session auprès de ses services d’interactions.

**16 fiches ne disposent pas encore d’un module autonome ShenPulse.** Elles restent consultables comme références, avec leurs identifiants conservés. Leurs effets ne sont pas exécutables : un nom d’illustration contenant « native » ne suffit plus à ouvrir une passerelle générique. Leurs associations personnalisées sont conservées pour une future intégration.

Les modules tiers, leurs noms de fichiers techniques et leurs crédits sont conservés. Certains visuels et liens de documentation proviennent toujours de leurs auteurs ; ces références ne pilotent pas les interactions.

## Corrections

- Pokémon Rouge/Bleu et Super Mario Kart : installateurs **1.1.0**, remplacement du client Slim par **ShenPulse.EmulatorHost**, qui charge les packs locaux vérifiés par SHA-256. Aucun chargeur de packs distant ni service de compte n’est lancé. L’ancien générateur HTTP facultatif de surnoms utilise sa solution locale de repli.
- Le nouvel hôte ne valide une interaction qu’après la réponse de son pack. Sa fermeture demande la restauration des effets temporaires avant de terminer le processus.
- Connexions dédiées : ETS2 **58441**, Blue Prince **58442**, RE3 **58443**, Pokémon **58444**, Super Mario Kart **58445**, Fallout 4 **5846**. Les autres ports ShenPulse déjà distincts sont conservés.
- Blue Prince **1.0.1**, RE3 **2.1.4**, Fallout 4 **1.0.1** : préparation vérifiée du port dans les archives existantes, avec refus d’une empreinte inconnue et sauvegarde des fichiers remplacés. Les changements restent limités aux paramètres de connexion.
- Les anciens paramètres enregistrés ne redirigent plus un module natif vers un autre port ou type de connexion. Les associations aux cadeaux, actions, roues et overlays conservent leurs identifiants.
- Suppression du mécanisme qui fermait le logiciel Crowd Control pour libérer un port. Un autre programme reste intact en cas de conflit.
- Les téléchargements d’installation n’acceptent plus les serveurs de mods Crowd Control. Les packs proviennent de Backblaze ; les composants officiels .NET et certains chargeurs conservent leurs origines Microsoft/GitHub/BepInEx.
- Les deux nouvelles archives d’émulation sont sur Backblaze, avec taille et SHA-256 vérifiés après publication. Les binaires restent hors des sources et du paquet principal de l’application.

## Vérifications et limites

- **2 743 tests réussis**, lint réussi, compilation de l’application autonome réussie. L’application reconstruite est ouverte sur ce PC ; les actions, profils et associations de jeux ont été comparés à la sauvegarde et conservés.
- Les **313 effets Pokémon** et les **87 effets Super Mario Kart** sont chargés dans le véritable hôte compilé, sans exécuter Slim.
- Le protocole mémoire réel de cet hôte est testé avec un pair BizHawk simulé : connexion, écriture d’un effet, refus sans connexion et refus d’un code inconnu. Il s’agit de tests de protocole et de mémoire, pas de 400 essais manuels en jeu.
- Les deux jeux ont aussi été démarrés dans le véritable BizHawk avec leurs ROM et leur connecteur Lua. Les deux connexions à ShenPulse ont réussi. Les programmes d’essai ont été fermés après vérification.
- Les archives réelles de Blue Prince, RE3 et Fallout sont extraites, configurées, contrôlées par empreinte puis testées contre les cas anciens ou altérés.
- Les commandes TCP des autres modules, leurs durées et les accès normaux Pro restent couverts par les tests existants. ETS2 a également été testé en jeu avec feux de détresse, klaxon, essuie-glaces et reconnexion.
- Cet audit n’est pas une revalidation manuelle de tous les effets dans tous les jeux. Les conditions propres aux jeux restent nécessaires : sauvegarde chargée, menus fermés, versions et DLC compatibles, Steam ou Game Pass selon le module.
- Sur ce PC, Pokémon et Super Mario Kart ont été réparés et enregistrés en **1.1.0**. Blue Prince et RE3 restent enregistrés à leur ancienne version, mais leurs exécutables n’ont pas été retrouvés : leur réparation réelle n’a pas été effectuée. Leurs fichiers et associations n’ont pas été supprimés.
- Pour les autres utilisateurs, une publication de l’application contenant le correctif reste nécessaire, suivie d’une réparation des interactions des jeux concernés. Les archives seules ne mettent pas à jour un ancien client ShenPulse.

## Catalogue vérifié

| Jeu ou mode | Intégration | Port local |
|---|---|---|
| Crash Bandicoot N. Sane Trilogy | Module TCP local | 58436 |
| Unturned | Module TCP local | 58435 |
| The Mortuary Assistant | Module WebSocket local | 58434 |
| Find The Needle Demo | Moteur HTTP local | — |
| Les Loups-Garous de Thiercelieux | Moteur intégré | — |
| Coin Pusher Live | Moteur intégré | — |
| Puissance 4 Arena | Moteur intégré | — |
| DealOrNoDeal | Moteur intégré | — |
| Le Pont des Diamants | Moteur intégré | — |
| Diamond Drop Live | Moteur intégré | — |
| Color Strike | Moteur HTTP local | — |
| Climb | Moteur HTTP local | — |
| ShenPulse Cube Wars | Moteur HTTP local | — |
| ShenPulse Stack Tower | Moteur HTTP local | — |
| Clash Of ShenPulse | Moteur HTTP local | — |
| Pokémon Rouge/Bleu | BizHawk et hôte local ShenPulse | 58444 |
| Super Mario Kart | BizHawk et hôte local ShenPulse | 58445 |
| Fortnite | Clavier/souris ShenPulse | — |
| Rocket League | Clavier/souris ShenPulse | — |
| Demonologist | Clavier/souris ShenPulse | — |
| Euro Truck Simulator 2 | Module TCP local | 58441 |
| Resident Evil 3 | Module TCP local | 58443 |
| GTA V Mont Chiliad | Module TCP local | 58430 |
| Minecraft Bedrock Box | Serveur Minecraft géré | — |
| Minecraft SandBox 3 | Serveur Minecraft géré | — |
| Minecraft Survival | Serveur Minecraft géré | — |
| Cult of the Lamb | Module TCP local | 58431 |
| Stardew Valley | Module TCP local | 58432 |
| Terraria | Module TCP local | 58433 |
| Escape From Duckov | Module TCP local | 58440 |
| Blue Prince | Module TCP local | 58442 |
| Hollow Knight: Silksong | Référence, module non disponible | — |
| Hollow Knight | Référence, module non disponible | — |
| Supermarket Simulator | Référence, module non disponible | — |
| Egging On | Module TCP local | 58439 |
| Balatro | Module TCP local | 58437 |
| Celeste | Référence, module non disponible | — |
| Dead by Daylight | Clavier/souris ShenPulse | — |
| Deep Rock Galactic | Référence, module non disponible | — |
| DREDGE | Module TCP local | 58438 |
| Fallout 4 | Module TCP local | 5846 |
| Hades | Référence, module non disponible | — |
| Inscryption | Référence, module non disponible | — |
| No Man's Sky | Référence, module non disponible | — |
| Palworld | Référence, module non disponible | — |
| Resident Evil 7 Biohazard | Référence, module non disponible | — |
| Vampire Survivors | Référence, module non disponible | — |
| ARK: Survival Ascended | Clavier/souris ShenPulse | — |
| Cities Skylines | Référence, module non disponible | — |
| Kingdom Come: Deliverance II | Référence, module non disponible | — |
| Deep Rock Galactic: Survivor | Référence, module non disponible | — |
| Hades II | Référence, module non disponible | — |
| Wobbly Life | Référence, module non disponible | — |
