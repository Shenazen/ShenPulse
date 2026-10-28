# Jeux autonomes ShenPulse

Les fiches shenfarm, shenpaint, shenkite et splash-bombes utilisent la page partagée des jeux et un achat séparé de 9,99 €. Les anciens jeux intégrés gardent leur présentation. Les exécutables ne sont jamais embarqués dans ShenPulse : les manifestes versionnés pointent vers Backblaze et imposent taille et SHA-256.

## Connexion

Le jeu est installé dans userData/games/<id>. Au premier lancement, ShenPulse génère une paire Ed25519 et un jeton aléatoire. La clé privée et le jeton restent dans le coffre Windows ; seule la clé publique est inscrite dans l’emplacement déclaré par shenpulse-game.json. Le serveur écoute exclusivement 127.0.0.1, refuse les connexions de navigateur et attend le bonjour natif avec le jeton exact. Il signe une licence valable deux minutes, renouvelée toutes les trente secondes.

Le pont partagé par GameRuntime et GameHub conserve les vérifications du compte, du profil, de l’abonnement et de l’achat. Une seule instance du jeu est lancée. Une copie déjà ouverte depuis un autre dossier est refusée. Les journaux Unity ne conditionnent pas la connexion : certaines versions normales désactivent leurs journaux.

Chaque effet utilise les codes natifs vérifiés : type: action, texte, id, pseudo, avatar, combo. Le catalogue natif suit les cadeaux choisis dans ShenPulse. Les événements gratuits sont traités par les règles ShenPulse pour éviter les doublons. Les actions de score natives conservent leurs valeurs prévues par le jeu ; les variantes fixes de ShenKite ne sont pas présentées comme des montants arbitraires.

## Préparation autorisée des packs

L’utilisateur a confirmé son accord de modification et de redistribution. Les originaux installés restent intacts. Les scripts travaillent sur des copies ignorées par Git :

1. Lancer scripts/prepare-shen-native-games.js avec Node et --source-root=<dossier des quatre versions autorisées>. Le script prépare les noms, les métadonnées IL2CPP 38/39, les identifiants de shaders et un emplacement de clé publique vide.
2. Lancer scripts/brand-shen-native-game.py avec Python et --stage=<copie préparée>. Il applique les véritables logos ShenPulse et l’identité Unity. Nécessite UnityPy et Pillow.
3. Mettre également à jour les informations et l’icône PE avec rcedit, et les fichiers RuntimeInitializeOnLoads.json / ScriptingAssemblies.json pour que les noms internes restent cohérents.
4. Avant compression, remettre uniquement l’emplacement de clé publique du descripteur à 64 zéros ; ne jamais publier une clé privée ou un jeton. Vérifier les noms de shaders dans Resources/unity_builtin_extra et le titre composé de ShenKite (SHEN + KITE).
5. Compresser la copie dans .artifacts/game-pack-builds/<id>/<version>/, calculer son SHA-256 et mettre à jour les deux manifestes : scripts/manifests/game-packs.json et src/main/game-installers/shen-native-games.js.
6. Publier avec scripts/publish-game-packs.js sous Electron et le profil du coffre Windows. Une version publiée est immuable. L’outil relit l’objet public et vérifie son contenu complet.

Les paquets conservent les crédits et licences tierces applicables, ainsi qu’un avis d’adaptation autorisée. Le contrôle de marque doit examiner le contenu des fichiers et les pixels des écrans d’accueil ; une simple recherche textuelle ne suffit pas.

## Désinstallation et tests

La désinstallation déplace uniquement le dossier géré vers une sauvegarde récupérable, jeu fermé, sans toucher aux parties Unity ni aux cartes du profil. Les chemins externes et les liens symboliques sont refusés. Un changement de compte pendant l’opération provoque une restauration.

tests/shen-native-games.test.js couvre le protocole, la signature, le coffre, les droits, le profil, les cadeaux, les quantités, le véritable GameHub et la désinstallation. Les essais graphiques restent nécessaires sur une partie jouable. sent: true confirme l’envoi au jeu, pas une mesure de son état interne.

## Multijoueur ShenPaint

ShenPaint utilise Unity Relay et l’authentification anonyme du même projet Unity Gaming Services que Color Strike. Il n’utilise aucun serveur ni compte SyncLive. Le jeu parle au pont ShenPulse sur 127.0.0.1:58534 ; ce pont établit la connexion TLS fiable au relais Unity seulement lorsqu’une salle est créée ou rejointe. Le mode solo et le duo local n’ouvrent pas de relais distant.

Le code de salle permet à trois invités de rejoindre l’hôte. Les versions sont contrôlées avant l’entrée et les noms et places sont conservés. Les données natives sont fragmentées puis reconstituées avec des limites de taille, de mémoire et de durée. Le verrouillage et l’exclusion restent disponibles. Une coupure du lien local jeu/application conserve la salle pendant 60 secondes et permet sa reprise ; la fermeture de ShenPulse libère les relais.

Le pack ShenPaint 1.0.2-shenpulse1 remplace explicitement l’ancienne adresse multijoueur par le pont local. Ne pas republier les anciennes archives sous la même version. tests/paint-network.test.js vérifie la licence locale, le protocole natif, le routage, les limites, le verrouillage et la reprise. Les essais avec le service Unity réel et deux exécutables du jeu complètent ces tests.
