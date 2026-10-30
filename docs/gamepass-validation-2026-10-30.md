# Essais Game Pass du 30 octobre 2026

Application : 2.1.1. Les nouvelles fiches restent réservées au propriétaire. Aucun push ni publication Store effectués pendant ces essais.

| Jeu / édition installée | Résultat réel | Distribution |
| --- | --- | --- |
| BALL x PIT Xbox 1.0.301.0 | Les 35 codes ont été acceptés en combat. Mesures de vie, vitesse, états, drapeaux, expiration et conflits ; mise K.-O. testée en dernier. Certains premiers essais utilisent 1.0.1 ; les corrections, expirations et conflits ont ensuite été vérifiés sur 1.0.2. Steam non testé. | Pack 1.0.2 publié sur Backblaze, taille et SHA-256 vérifiés, installé par ShenPulse. |
| CloverPit Xbox 1.4.3.0 | 79 codes avec changement d’état mesuré. Le 80e, rangement d’un charme, refuse correctement quand aucun tiroir n’est débloqué ; son chemin de réussite reste à tester avec un tiroir disponible. | Pack 1.0.0 installé depuis Backblaze et connecté à ShenPulse. Aucun correctif binaire appliqué pendant ces essais. |
| Brotato Xbox 1.154.0.0 / jeu 1.1.15.4 | Les 44 codes ont répondu en vague. Mesures de vie, statistiques, vitesse, taille, ennemis renforcés, expiration de l’invincibilité et nettoyage lors d’un redémarrage. Mise K.-O. vérifiée à la fin. Steam non testé sur ce PC. | Pack 1.0.2 publié sur Backblaze, taille et SHA-256 vérifiés. Téléchargement et réparation depuis l’application empaquetée vérifiés. |
| Fallout: New Vegas Ultimate Edition Xbox 1.1.0.0, édition française | 56 codes exécutés en partie. Quantités de 28 dons mesurées, puis la référence Ranger corrigée et les munitions Ranger/Gobi vérifiées à l’écran via l’application. Membres 100 → 0, invincibilité et ralenti avant/pendant/après, 16 apparitions, météo, +250 XP et mort en dernier. La commande sonore est acceptée par le moteur ; le volume de sortie n’a pas été mesuré. Steam non testé. | Pack Xbox autonome 1.1.0 sur Backblaze, taille et SHA-256 vérifiés. Installation et lancement depuis ShenPulse empaqueté vérifiés, connexion TCP réelle et session active. |

## BALL x PIT : corrections

- Durées temporaires indépendantes du ralentissement du jeu.
- Restauration de la vitesse choisie par le joueur.
- Implémentation de l’effet de désactivation des petites balles.
- Exclusion mutuelle des effets incompatibles.
- Un démarrage refusé ne lance plus une fin d’effet capable d’annuler un autre effet actif.

Archive : installer-assets/ball-x-pit/1.0.2/ball-x-pit-shenpulse-1.0.2.zip.
SHA-256 : 094f76dc29afff2f4ac8816247daa854832c55ce068d53ae5dbad65fe7dc8dfc.

## CloverPit : conditions et mesures

Ajout/retrait de pièces (100, 1 000 et 50 %), tickets (1 et 5), dette versée, intérêts, tours, probabilité 666, valeurs/probabilités de chacun des sept symboles, combinaisons et charmes testés par paires quand possible.

Les refus pendant une transition de dette ont été retestés une fois la partie disponible. Les tours ont été vérifiés pendant une vraie manche : 7 → 8 → 7.

Les noms internes pyramid/pyramidInverted correspondent aux combinaisons présentées sur le tableau sous Zig/Zag avec une base ×4. Le candidat de modification fondé seulement sur le nom interne n’a été ni installé ni publié. Les charmes testés ont bien été ajoutés à la liste équipée ; le jeu indique explicitement l’absence de tiroir lors du rangement.

## Limites des éditions

### Brotato : adaptation native Game Pass

Le pack ne contient aucun fichier du jeu. ShenPulse lit localement l’archive HVP de l’utilisateur, ajoute ses scripts et quatre points d’entrée contrôlés, puis sauvegarde l’archive d’origine. Une signature de code inattendue interrompt l’installation. Les réparations repartent de la même sauvegarde ; le retrait restaure celle-ci et conserve les sauvegardes de partie et les autres mods. Le décodeur LZO1X embarqué est distribué sous licence MIT, sans extension native à compiler.

Le transport gère explicitement le polling TCP et les trames terminées par un octet nul. Les échéances utilisent le temps réel. Les huit bonus/malus de statistiques, trois vitesses globales et deux tailles du joueur ont été mesurés avant, pendant et après expiration. Le renforcement a été mesuré sur 72 ennemis vivants, puis annulé. Les effets conditionnels peuvent refuser si aucune cible n’est disponible.

Archive : installer-assets/brotato/1.0.2/brotato-shenpulse-1.0.2.zip.
SHA-256 : 345babdafd1af794392dc98b0892128c024ed818634edfeb41345d4a97566c19.

### Fallout: New Vegas : module Xbox autonome

L’édition Game Pass utilise un module ShenPulse indépendant du chargeur Steam. Le lanceur vérifie l’identité Xbox, le dossier réellement sélectionné, le processus, onze empreintes de fonctions moteur et le SHA-256 du module avant son chargement. Aucun exécutable du jeu n’est remplacé ; aucune image mémoire ni donnée du jeu n’est distribuée. Une version inconnue est refusée avec un message de mise à jour.

Les commandes sont exécutées sur le thread principal du jeu. Les effets sont refusés dans les menus. Les durées utilisent le temps réel, restaurent l’état précédent et sont nettoyées à la déconnexion. La mort est refusée pendant une invincibilité active. Le transport local est limité à 127.0.0.1, avec trames et file bornées, corrélation des requêtes et protection contre les doubles exécutions.

Les identifiants historiques des effets restent stables. La munition invalide du Ranger Sequoia est corrigée en 00121133 ; le fusil Gobi reçoit désormais des cartouches .308 (0006B53C). Les essais via le véritable service local de l’application ont confirmé 24 munitions .45-70 et 60 cartouches .308 à l’écran.

Archive : installer-assets/fallout-new-vegas/1.1.0/fallout-new-vegas-xbox-shenpulse-1.1.0.zip (248 162 octets).
SHA-256 : 10c84caf2b4c61fbb2f73b2c4f2a47bf1ce5b5eed830a91e4739475f42508455.

L’autorisation Windows du lanceur ShenPulse est nécessaire parce que le jeu Game Pass fonctionne avec un niveau de droits supérieur à l’application. Le lanceur reste limité à ce jeu et à son module adjacent vérifié. Les autres éditions conservent leur pack distinct et ne sont pas déclarées validées par ces essais.

## Preuves locales de test

Les preuves techniques et les sauvegardes de test sont conservées dans le dossier ignoré .artifacts/gamepass-tests, notamment research/brotato-final-results.jsonl et research/fnv-{inventory,state,spawn,other,product}-results.jsonl. Elles contiennent les mesures, pas les jetons de compte. Les sondes temporaires ne font partie d’aucun pack publié. Les tests ciblés d’installation, lancement, plateformes, restauration et distribution ont réussi ; 47 tests sur la dernière sélection, analyse de structure et syntaxe réussie.

## Farming Simulator 25 : Xbox / Game Pass

Édition Xbox 1.25.0.0. Les 41 codes ont été exécutés dans une ferme d’essai avec le mod activé. Les mesures couvrent l’argent, le carburant et les réparations, les vitesses et leur restauration, la force, les téléportations et le retour au concessionnaire avec des outils attelés, le redressement, le saut, les remplissages compatibles, les palettes et balles, la météo, les heures et le changement de jour. La croissance est une demande progressive au moteur, pas une promesse de maturité immédiate. Les opérations sans véhicule ou sur un réservoir incompatible sont refusées.

L’installation détecte le véritable profil Xbox sous LocalCache/Local, ainsi que les éventuelles redirections du répertoire de mods. La copie dans ce profil est vérifiée et sauvegardée pour le retrait. Le transport XML local ne confirme que les commandes exécutées et corrélées à la demande courante. La téléportation native du moteur remplace le déplacement manuel qui déstabilisait les outils attelés.

Le contrôle depuis l’application a aussi corrigé une identité Xbox manquante dans le manifeste d’installation. La détection retrouve désormais C:\XboxGames\Farming Simulator 25 (PC)\Content et le lancement Xbox sélectionne gamelaunchhelper.exe ; l’édition Steam conserve son propre lanceur.

Le dernier essai dans l’application reconstruite a terminé l’installation automatique à 100 %, sans sélection manuelle de dossier. Le module dans le jeu et la copie dans le profil Xbox correspondent tous deux au pack final vérifié.

Archive Backblaze : installer-assets/farming-simulator-25/1.0.4/farming-simulator-25-shenpulse-1.0.4.zip (264 535 octets).
SHA-256 : 6898049812a2986182f6f10f393739258b58d0315006fd226a98887d99ce237f.

Preuves : .artifacts/farming-backrooms-tests/farming-results.jsonl ; sauvegarde d’origine conservée dans farming-save-backup/save. Le drapeau temporaire de diagnostic a été retiré. L’édition Steam n’a pas été testée pendant cette session.

## Escape the Backrooms : Xbox / Game Pass

Édition Xbox 1.5.0.0 / jeu 1.5.0 (4261). Les 70 codes ont été exécutés dans des parties d’essai. Les 19 dons d’inventaire et les 19 dépôts au sol, la santé mentale, la marche et le sprint, les sons, la vision troublée et les effets dangereux ont été exercés. Les douze types d’entités ont chacun produit une augmentation mesurée de leur présence dans le niveau après correction. Les effets conditionnels restent soumis à une partie jouable ; les apparitions exigent le solo ou le rôle d’hôte.

Corrections vérifiées :

- Création différée des entités avec placement sur la navigation et gestion explicite des collisions. Des acteurs auparavant détruits dès leur apparition ne sont plus confirmés à tort.
- Limite de huit entités : douze demandes successives donnent huit entités présentes, puis zéro après expiration. Les références conservées entre les appels sont des noms d’objets, pas des objets Unreal susceptibles d’être libérés.
- Quantité trois : exactement trois objets reçus ; demande de vingt avec un inventaire insuffisant : refus sans ajout partiel. L’inventaire lâché libère réellement les emplacements.
- Vision troublée : variation mesurée du champ de vision, puis retour à 90° après cinq secondes. Le chemin natif d’hallucination qui plantait sur cette édition n’est plus appelé.
- Épuisement, évanouissement et douleur : changements mesurés des états et valeurs du personnage. Mort appelée en dernier, suivie de la reprise du niveau.
- Serveur HTTP limité à 127.0.0.1 ; chaque demande reçoit le résultat effectif du moteur. Une réponse invalide ou un refus ne sont pas présentés comme une réussite. Les requêtes du navigateur, les corps trop grands et les requêtes expirées sont refusés.

Archive Backblaze : installer-assets/escape-the-backrooms/1.0.2/escape-the-backrooms-shenpulse-1.0.2.zip (7 529 435 octets).
SHA-256 : aafd2aebb29b91715d9e202b4b70633118530976df8f46a438b664df10daec67.

Téléchargement et installation depuis ShenPulse empaqueté vérifiés : détection du dossier Xbox, remplacement du module, vérification de toutes les dépendances et confirmation « Installation terminée ». Le jeu est lancé via son édition Xbox sélectionnée. Les sondes de mesure locales sont absentes du pack final. Les versions de développement non publiées ont été écartées du registre de distribution.

Preuves ignorées : .artifacts/farming-backrooms-tests/backrooms-http-results.jsonl, backrooms-final-results.jsonl et backrooms-expiry-results.json. Un client de production a également vérifié la connexion, le refus dans le menu et la reconnexion d’un nouveau client sans redémarrage du jeu. Les 43 tests ciblés de cette session passent, ainsi que l’analyse de structure et de syntaxe. Cette validation ne couvre pas Steam ni tous les niveaux et scénarios multijoueurs possibles.
