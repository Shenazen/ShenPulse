# Unturned — module ShenPulse

Unturned est intégré avec 27 interactions, un installateur automatique Steam
(application `304930`) et un module original ShenPulse. Le mode pris en charge
est une partie solo Windows lancée sans BattlEye via `Unturned.exe`.
L’application tierce utilisée comme référence n’est ni installée ni nécessaire.

Le module utilise le mécanisme natif `IModuleNexus`. L’archive embarquée contient
`ShenPulse.Unturned.dll`, son manifeste `.module`, une notice et la bibliothèque
Harmony 2.4.3 avec ses licences, sous `Modules/ShenPulse.Unturned`. Les bibliothèques
du jeu ne sont pas redistribuées.
L’installateur sauvegarde les fichiers remplacés et conserve les autres modules.

La liaison TCP sortante se reconnecte à `127.0.0.1:58435`, avec des messages JSON
terminés par NUL. La file est bornée à 128 requêtes, les trames à 64 Kio et les
apparitions à 50 par commande. Les commandes sont exécutées depuis `Update`,
sur le fil du jeu. Une confirmation est envoyée après exécution ; une partie
incompatible ou un prérequis absent renvoie un refus explicite. Les requêtes
dupliquées d’une connexion sont reconnues, celles d’une connexion perdue ne
sont pas rejouées et les commandes en attente expirent après cinq secondes.

Les 27 associations initiales attendent un déclencheur. Les apparitions utilisent
les identifiants d’objets, véhicules et animaux chargés par le jeu ; `0` signifie
aléatoire. Les zombies apparaissent et poursuivent le joueur hors des villes,
en utilisant les définitions d’apparition de la carte, même si aucun zombie
ordinaire n’est actuellement instancié. Le largage vise le joueur et
nécessite une cargaison de carte. Le mélange d’inventaire conserve les objets et dépose les surplus
au sol. Les explosions n’endommagent pas les bâtiments, coffres et ressources.

Depuis le module 1.0.1, les zombies ShenPulse utilisent la navigation habituelle
quand les deux positions sont dans la même zone, et le contrôleur de déplacement
sans navigation du jeu ailleurs. Ce dernier respecte les collisions mais peut
buter sur des obstacles. Un correctif Harmony remplace uniquement la lecture de
`PlayerMovement.nav` dans `Zombie.tick` pour les zombies créés par ShenPulse ;
aucun état du joueur ni zombie ordinaire n’est modifié. Un second correctif ajoute
ces zombies aux recherches par rayon pour les explosions et autres dégâts de zone.
Une région temporaire séparée les conserve lors du déchargement d’une ville ;
elle ne modifie ni les zones de navigation ni les fichiers de la carte. Leur animation
et leurs capacités continuent d’être actualisées en dehors des régions du joueur.
À leur mort, le comportement est retiré ; les emplacements morts sont réutilisés
lors d’un prochain déclenchement, sans augmenter indéfiniment la population.
La limite simultanée est de 256 zombies ShenPulse vivants, 50 par commande.
Les apparitions recherchent jusqu’à 24 positions libres au sol avant de refuser.

## Construction et qualification

```powershell
./scripts/build-unturned-mod.ps1 -GameDirectory 'C:\Program Files (x86)\Steam\steamapps\common\Unturned' -RunTests
```

La construction utilise le compilateur C# du .NET Framework et les API du client
installé. Après reconstruction, reporter la taille et l’empreinte SHA-256 du ZIP
dans `src/main/game-installers/unturned.js`. Harmony est téléchargé depuis sa
version officielle épinglée et son SHA-256 est vérifié avant extraction.
Le harnais natif vérifie les 27 codes,
les limites, la fragmentation TCP, UTF-8, les confirmations après exécution, la
déduplication, les refus et la reconnexion. Un second harnais vérifie le remplacement
de la décision de navigation dans l’IL réel du jeu,
ainsi que le refus d’une version incompatible. Les tests JavaScript couvrent le
catalogue, les paramètres, le déploiement sauvegardé et le trajet via `GameHub`.
La compilation contre le jeu ne remplace pas un essai en partie de chaque effet.

`scripts/verify-unturned-world.ps1` lance explicitement un client de test masqué,
avec un autre dossier de modules et une nouvelle identité de carte pour isoler
les sauvegardes. Le module `Tests/WorldProbe.cs` ne fait jamais partie du ZIP livré.

Qualification du 20 octobre 2026 : client Steam 3.26.3.13, carte PEI, partie solo
de test neuve. Les 27 codes ont été exécutés. Vérifications spécifiques : apparition
sans aucun zombie de ville instancié, poursuite et dégâts natifs hors navigation,
recherches par rayon et dégâts d’explosion, suppression du contrôleur à la mort,
réutilisation des zombies morts, quantités successives et persistance lors d’une
entrée/sortie de ville. La qualité de l’objet équipé et la projection native ont
également été contrôlées. Ce test ne couvre pas toutes les cartes et variantes.

Références : [les 27 familles d’interactions](https://streamtoearn.io/games/unturned),
[SDK officiel Unturned](https://github.com/SmartlyDressedGames/U3-SDK), API du client
Steam installé et [fiche Steam](https://store.steampowered.com/app/304930/Unturned/).
