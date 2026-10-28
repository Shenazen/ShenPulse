# GTA V KOTH Enhanced — intégration ShenPulse

Mode distinct `gtav-koth-enhanced`. Catalogue et fiche communs aux autres jeux : six aides et six pièges, mêmes cadeaux, titres courts, événements de wins séparés et modèles d’overlays intégrés.

## Fonctionnement et origine

La fiche publique [GTA V KOTH](https://streamtoearn.io/games/gta5koth), consultée le 27 octobre 2026, décrit la montée d’une rampe, ses réglages et 751 entrées. Seuls les identifiants des 741 modèles de véhicules ont été relevés ; aucun binaire, compte, serveur ou code StreamToEarn n’est utilisé.

Le module est écrit dans `native/gtav-koth-enhanced`, avec le SDK ScriptHookV déjà utilisé par ShenPulse. Les dix familles de la référence (nettoyage, saut de rampe, départ, sommet, impact, compagnon, tronc, super saut, obstacle et immobilisation) sont implémentées localement. Sept commandes de préparation et d’aide supplémentaires et les opérations communes de wins complètent la fiche. Un véhicule absent de l’édition installée est refusé explicitement.

La rampe est construite au-dessus de la zone de l’aéroport. F10 ouvre le menu : création/retrait, animation, essai de véhicule/obstacle, compagnon, angle de 5 à 60 degrés, longueur de 5 à 95 conteneurs, cinq designs, téléportation au sommet et retour au départ. Les flèches appliquent immédiatement les réglages, conservés dans %LOCALAPPDATA%/ShenPulse/GtaMode/koth-settings.ini. Dix secondes au sommet donnent une win ; une chute sous la rampe ou une mort en retire une. Après une victoire, retour au départ après cinq secondes. Les obstacles sont limités à 256 entités simultanées. Une vague accepte jusqu’à 100 obstacles ; elle est refusée si la capacité restante ne suffit pas, sans effacer les obstacles déjà présents. Aucun obstacle de rampe n’a de durée de vie : il est retiré seulement lorsque toute sa boîte physique est passée à plus de 12 m sous le plan de la rampe, pendant trois secondes. Les compagnons restent limités à 45 secondes. Les effets temporaires utilisent l’horloge réelle de Windows ; une durée écoulée est rétablie dès le passage suivant du script, y compris après une pause. Pour recevoir les interactions en arrière-plan, désactiver la pause lorsque GTA devient inactif.

## Séparation des modes GTA

Un seul ASI est enregistré : `ShenPulseMontChiliadEnhanced.asi`. Le nouveau point d’entrée sélectionne KOTH ou l’entrée Mont Chiliad existante ; les sources et comportements du Mont Chiliad restent compilés séparément sans réécriture. L’installation de KOTH ne remplace aucune sauvegarde.

Avant le lancement, ShenPulse écrit atomiquement une sélection UTF-16 dans `%LOCALAPPDATA%/ShenPulse/GtaMode/selection.ini`. La sélection est liée au dossier du jeu. Un changement de mode est refusé si GTA est déjà ouvert. KOTH utilise exclusivement `127.0.0.1:58469`, le Mont Chiliad conserve son port 58430. Aucun endpoint distant de gameplay.

KOTH exige `GTA5_Enhanced.exe` et le marqueur du nouveau module. L’installateur Mont Chiliad 1.0.10 distribue le même module commun pour ne pas écraser la capacité KOTH lors d’une réparation. Les fichiers remplacés sont sauvegardés par le déploiement normal.

## Distribution et vérification

Tous les binaires et ScriptHookV sont téléchargés depuis Backblaze, avec taille et SHA-256 vérifiés. Aucun ASI supplémentaire n’entre dans le paquet Electron. Le registre est dans `scripts/manifests/game-packs.json`.

Compiler : `scripts/build-gtav-koth-plugin.ps1` (sortie temporaire Windows par défaut). Conserver l’artefact final dans `.artifacts/game-pack-builds/gtav-koth-enhanced/1.0.5`, puis actualiser les empreintes avant toute nouvelle publication immuable.

Le harnais de géométrie couvre les neuf couples angle/longueur, l’exclusion des côtés et les hauteurs invalides et la politique de durées (52 assertions). Les tests JavaScript couvrent la fiche, les cadeaux, le routage des compteurs, le choix atomique du mode, le refus de Legacy et d’un ancien module, ainsi que l’ordre du lancement. Ces tests ne remplacent pas les essais visuels dans GTA V Enhanced. Seul le mode Histoire est pris en charge.

## Historique des premiers essais du 27 octobre 2026

GTA V Enhanced Rockstar 1.0.1158.16 a chargé le module et créé la rampe. Le menu F10 et le design 2 ont été observés à l’écran. Une campagne de 22 commandes natives a réussi : compagnon, saut, tronc, tonneau, sept familles de véhicules, blocage cinq secondes, ragdoll, impact, soin, protection, sprint, super saut, téléportations et nettoyage. Le flux natif confirme une victoire supplémentaire lors du maintien au sommet. Ces essais ne constituent pas un essai individuel des 741 véhicules.

Deux correctifs issus du test réel : délai du premier lancement porté à dix minutes, et rattachement au jeu ouvert sans rouvrir l’image ASI verrouillée par le chargeur Windows. Le mode sélectionné doit correspondre exactement au dossier et la connexion au port natif doit encore être confirmée par ShenPulse avant d’activer la session. Le test unitaire reproduit le cas où l’ASI ne peut pas être rouvert après sélection.

Le module 1.0.1 respecte les durées demandées pour le blocage, la protection, le sprint, le super saut et la chute (1 à 3 600 secondes). Les essais natifs ont confirmé un blocage de deux secondes puis sa libération, ainsi que la fin de la protection, du sprint et du super saut configurés à trois secondes. La chute de deux secondes a été acceptée par GTA. Le relevé des états est échantillonné chaque seconde ; le temps de détection de fin inclut cet échantillonnage. Le menu F10 neutralise les contrôles du jeu pendant ses réglages.

L’installation finale 1.0.1 depuis Backblaze a été vérifiée sur ce PC : 536 064 octets, SHA-256 `b494e57e3dc081711fdf7f4e4a2daf2970d6a55bbb88ab9d726633208f4f1631`. Une seule instance GTA a été lancée après la mise à jour. ShenPulse 2.1.0 confirme le rattachement au même processus après sa propre relance. Les contrôles ciblés comptent 78 tests réussis et le lint valide les imports et la syntaxe.

Dernier contrôle de bout en bout : après réactivation sur le processus GTA déjà ouvert, le bouton Tester de « TP sommet » a provoqué une victoire native et fait passer le compteur ShenPulse de 1 à 2. Une interaction Retour départ issue d’un vrai cadeau TikTok a également été enregistrée comme réussie pendant cette session. Le jeu et ShenPulse restent ouverts pour les essais manuels.

## Revue complète du 27 octobre 2026

Le catalogue contient désormais 772 effets : les 741 véhicules, 17 opérations natives (dont la nouvelle sortie de prison) et 14 opérations d’overlay. La prison crée quatre barrières visibles avant l’immobilisation ; la sortie de prison exige une prison active. Les sorties temporisées et le nettoyage sont restaurés à l’échéance.

La campagne individuelle native a accepté 758 effets sur 758. Chaque véhicule a été créé avec contrôle de son modèle réel, puis supprimé avant le suivant ; aucun remplacement par un autre véhicule n’est utilisé. Les opérations dépendantes ont été ordonnées : prison puis sortie, création puis retrait/recréation, protection avant impact. Les 14 opérations d’overlay ont été testées via leurs vrais handlers IPC et ActionRunner sur un compteur isolé, avec remise du microphone dans son état initial. Résultats détaillés : .artifacts/gtav-koth-review/live-full-audit.json et overlay-full-audit.json.

Onze configurations de rampe ont été vérifiées : cinq designs, bornes angle/longueur et animation activée/désactivée. Le compteur était encore en cours après trois secondes ; la victoire est survenue après 10 041 ms. Le contrôle visuel a révélé ensuite un décalage entre les textures natives et les noms de couleurs : le module 1.0.3 peint les faces supérieures exactes des conteneurs avec les palettes jaune clair/foncé, vert clair/foncé, bleu et rouge. Les collisions restent celles des conteneurs. Les sommets sont précalculés, le dessin est limité aux conteneurs à moins de 900 m et suit l’animation. Cette correction ne change pas les effets de véhicules.

Module final 1.0.3 : 548 864 octets, SHA-256 f211fd17bab0dc58b3326d7fe49353dfe5bb04a2b8524953ee532d2f5b8561c6. Publication immuable et vérification après téléchargement sur Backblaze, installation dans GTA Enhanced vérifiée avec la même empreinte. L’application reste en version 2.1.0.

La galerie regroupe les deux modes sous GTA Enhanced/Amélioré, avec la jaquette officielle Enhanced. Les identifiants des modes sont conservés dans les actions et règles ; les filtres/compteurs respectent les modes visibles. Chaque véhicule possède son illustration issue du catalogue officiel Cfx (https://docs.fivem.net/docs/game-references/vehicle-models/ et https://docs.fivem.net/vehicles/). L’affiche officielle est fournie par la page Steam de GTA V Enhanced (app 3240220). Les images spécifiques des autres opérations réemploient les illustrations ShenPulse adaptées ou les nouvelles créations détaillées dans asset-prompts/gtav-koth-20261027.md.

Dix cadeaux sont associés aux wins KOTH ; le multiplicateur utilise Hand Hearts. La migration ajoute seulement les associations d’origine vides et répare le libellé de course ambigu connu, en conservant les cadeaux et montants personnalisés. Les six aides et six pièges restent séparés des wins.

La seconde campagne complète, sur le module final 1.0.3, confirme de nouveau les 758 effets natifs (741 véhicules) sans échec et une victoire après 10 033 ms. Rapport : .artifacts/gtav-koth-review/live-full-audit-final.json. Les cinq palettes ont été observées à l’écran. Les 764 ressources publiques (images natives et wins disponibles dans cette publication) ont été comparées octet par octet, sans écart. La suite complète compte 3 012 tests réussis, aucun échec ; le lint et la construction Electron passent.

## Historique : correction physique après retour utilisateur

Les campagnes précédentes vérifiaient la création et le modèle exact ; elles ne démontraient pas une descente durable. Le retour utilisateur a montré cette limite : tronc presque vertical et véhicules susceptibles de se bloquer après leur impulsion initiale. La correction oriente le tronc en travers de la pente, aligne le tangage des véhicules vers le bas, active explicitement la physique, la gravité, les collisions et la visibilité à longue distance, libère le frein à main et entretient la descente par une force physique proportionnelle à la masse. Un plancher de vitesse descendante entretient également le mouvement des chenilles, en conservant les composantes latérale et normale. Un petit déblocage physique est limité aux obstacles presque immobiles sur la rampe. Aucun déplacement forcé de position des obstacles après leur création.

Le placement initial tient compte de la boîte du modèle orienté et de sa longueur pour limiter le porte-à-faux au sommet. Les collisions du modèle sont demandées sans refuser un véhicule sur le seul indicateur de disponibilité préalable, qui peut rester faux avant son instanciation (bateaux). La physique des obstacles déjà présents continue pendant les chargements de modèles. Les éléments ferroviaires et les quatre modèles à origine très profonde (Kosatka, Cargo Plane, Cargo Plane 2 et Jet) utilisent leur modèle exact sous forme d’objet dynamique. Cela évite les contrôleurs propres au rail, au vol et à l’eau sur ces obstacles de rampe. Une garde au sol calculée dans les coordonnées du modèle corrige leur pénétration initiale. La durée de vie est adaptée à la longueur : 45 à 180 secondes au lieu de 45 secondes fixes. Les compagnons conservent leur comportement et leurs 45 secondes.

Les essais de physique utilisent des trajectoires réelles sur au moins cinq secondes, avec distance descendue sur la rampe, vitesse, hauteur et visibilité. Le mode de diagnostic protège et immobilise temporairement le personnage, désactive ses collisions, puis rétablit explicitement sa collision et sa vulnérabilité antérieures. Les contre-tests individuels éliminent les chocs entre modèles géants ; les collisions avec la rampe et la physique restent actives. Les interactions normales gardent leurs collisions. Les essais ne recréent pas la rampe et ne changent pas ses réglages. Le harnais indépendant de politique physique passe 99 assertions. Il vérifie également le placement des gabarits longs, le maintien d’une vitesse descendante et la conservation des composantes latérale et normale des collisions.

## Historique : validation de la correction physique 1.0.4

La campagne réelle couvre les 743 obstacles (741 véhicules, tronc et tonneau). Les trajectoires sont échantillonnées pendant au moins cinq secondes, puis les 19 cas ambigus sont repris individuellement. Le personnage immobilisé peut bloquer une trajectoire : le diagnostic final désactive donc temporairement ses collisions et restaure son état initial après chaque essai. Les derniers correctifs de production concernent uniquement les quatre modèles profonds identifiés dans les mesures. Ils sont repris séparément avec le module final, parmi 18 contre-tests représentatifs, sans échec restant.

Résultat consolidé : 575 descentes encore actives au terme du suivi et 168 descentes suivies d’une sortie latérale. Une sortie par le bord reste possible, notamment pour les deux-roues et les grands gabarits ; ce contrôle ne garantit pas que chaque obstacle parcourt toute la rampe ni toutes les combinaisons de pente, longueur et collisions simultanées. Les autres opérations et les wins conservent les vérifications précédentes ; les commandes qui reconstruisent ou téléportent ne sont pas rejouées pendant cette campagne de trajectoires.

Suivis prolongés sur le module final : Rhino 203.3 m en 20.3 s, encore en descente ; tronc 293.2 m en 20.8 s, encore en descente. Les événements de fin du diagnostic confirment le retour des collisions et de la vulnérabilité d’origine du personnage.

Module installé et publié : 569344 octets, SHA-256 `c9303e9e5c05e306eee710aaef524a4d6788e7519f34421a014fe11c008334ae`. Backblaze : KOTH 1.0.4 et module commun Mont Chiliad 1.0.9, publications immuables vérifiées après téléchargement par le vrai téléchargeur ShenPulse, dans un dossier vide. L’application reste en 2.1.0. Les 42 tests JavaScript ciblés, les 99 assertions natives de physique et de placement, le lint et la construction Electron passent. ShenPulse a été relancé puis rattaché au même processus GTA, sans nouvelle ouverture du jeu.

Les réglages initiaux (20 degrés, 30 sections, multicolore, sans animation) restent identiques octet par octet. Rapports locaux : `.artifacts/gtav-koth-motion/candidate-d-full-results.json`, `candidate-e-individual-results.json`, `final-targeted-results.json`, `combined-verification.json`, `long-results.json` et `cold-download-verification.json`.


## Arrivée, avalanches et contrôle réel — module 1.0.5

Tous les centres d’obstacles sont placés dans les derniers mètres de la zone de victoire (progression 359,5 à 361,1 m sur la rampe de 363,6 m utilisée), indépendamment de leur gabarit. Les vagues sont préparées avec leurs collisions désactivées, espacées selon leurs boîtes orientées sur plusieurs couches si nécessaire, puis rendues visibles et libérées ensemble. Les collisions entre obstacles et avec le joueur restent actives. Aucune orientation n’est verrouillée après l’apparition : véhicules et motos peuvent se retourner, rouler et glisser ; les forces de descente et le déblocage préservent ces mouvements.

Le nettoyage ne dépend plus d’une durée, de la capacité ou d’une victoire. L’obstacle reste présent tant que sa boîte physique n’a pas entièrement chuté sous le plan de la rampe. La vérification exige trois secondes sous ce plan, puis mesure à nouveau la boîte avant suppression. La capacité est de 256 ; une nouvelle vague de 1 à 100 obstacles est refusée si elle ne tient pas, sans retirer les objets existants. Les compagnons gardent leur durée propre de 45 secondes.

Les bords latéraux sont rehaussés de 1,3 m. Un conteneur incliné de 15° supplémentaires est ajouté vers le début du parcours pour servir de rampe et d’abri. Les chocs peuvent toujours éjecter un obstacle par-dessus un bord ; aucune barrière invisible ne remplace les collisions du jeu. Une sortie latérale n’est pas une disparition anticipée : le modèle reste présent jusqu’à sa chute complète.

« Hasard Obstacle » tire parmi les 743 modèles (741 véhicules, tronc et tonneau). Une liste mélangée est épuisée avant un nouveau cycle, avec protection contre la répétition entre la fin d’un cycle et le début du suivant. L’illustration propre est enregistrée dans resources/game-interactions/gtav-koth-enhanced/koth_random_obstacle.png et publiée avec les autres images publiques ; prompt et mode de génération dans asset-prompts/gtav-koth-20261027.md.

Les essais du 27 octobre ont été faits avec le personnage normal au départ, sans protection, immobilisation, suppression des collisions ni modification des réglages. Le diagnostic ne fait désormais que journaliser. Bilan :

- 743 modèles distincts sur 743 créés dans la zone d’arrivée, suivis jusqu’à leur chute, aucun manquant, retrait anticipé ou blocage restant. Les modèles sont testés avec leurs collisions mutuelles actives ; ce bilan ne prétend pas que chaque trajectoire reste sur la rampe jusqu’à son extrémité.
- Tronc, Rhino, moto Bati et tonneau repris séparément jusqu’à leur chute.
- Six Rhinos ont repoussé le personnage de 360,4 m à 356,0 m en deux secondes, hors de la zone de victoire, avant les dix secondes requises. Le joueur a ensuite pu regagner cette zone et gagner normalement ; les obstacles restants ont continué leur descente après la victoire.
- Vague réelle de 100 modèles différents : 100 entités existantes et visibles simultanément, préparation 1 782 ms, joueur au départ à 3,8 m ; les 100 ont ensuite chuté et été nettoyés, aucun disparu prématurément.
- Total de 853 entités suivies sur les quatre campagnes. Réglages identiques octet par octet : 20°, 30 sections, multicolore, animation désactivée.

Le harnais natif passe 16 262 assertions de placement, de cycle de vie, de capacité, d’abri et de tirage sans répétition. Les 43 tests JavaScript ciblés, le lint et la construction Electron passent. Les échantillons périodiques des quatre campagnes donnent une médiane de 9,88 ms par image et un 95e centile de 15,03 ms ; ces mesures concernent ce PC et ne constituent pas une garantie sur d’autres configurations.

Module commun : 583 168 octets, SHA-256 `91a2c3bee026a7ce5db628d62bf78c5e575c7c34724e1ee120aada738670e5d3`. Versions immuables Backblaze KOTH 1.0.5 et Mont Chiliad Enhanced 1.0.10 ; les deux ont été retéléchargées dans un dossier vide par le vrai téléchargeur ShenPulse, avec taille et empreinte vérifiées. L’image publique Hasard Obstacle est également identique octet par octet à sa source. ShenPulse reste en version 2.1.0 et le même processus GTA est conservé après les essais.

Rapport consolidé : `.artifacts/gtav-koth-avalanche/final-verification.json` ; trajectoires : `final-motion-audit.jsonl` ; campagnes : `critical-results.json`, `all-results.json`, `finish-results.json`, `stress-results.json` ; téléchargement : `cold-download-verification.json`.


## Chrono et défaite — module 1.0.6

La durée de manche se règle sur la fiche ShenPulse, avec 15 minutes par défaut et un choix conservé par profil. Le chrono et les dix secondes de maintien au sommet sont suivis par le module natif puis projetés vers les overlays. La victoire exige dix secondes complètes avant la fin du délai. Une mort, une chute hors de la rampe ou un TIME OUT retire exactement une win, même si un multiplicateur est actif. Un événement natif n’est traité qu’une seule fois.

Le joueur est invulnérable uniquement dans le volume de la rampe, sans supprimer les collisions ni les réactions physiques. L’impact garde les chutes et les poussées. Après une défaite, la reprise attend la fin de la réapparition GTA, le retour du contrôle et une position stable au départ : les transitions de l’hôpital ne peuvent pas créer une seconde pénalité. Les sauvegardes du mode Histoire et les réglages F10 de la rampe ne sont pas modifiés par les essais.

Essais réels du module final, le 27 octobre 2026 : victoire après dix secondes (+1), arrivée avec moins de dix secondes restantes puis TIME OUT (-1), trois impacts au sommet avec réaction physique et vie inchangée (200), chute sans décès avec fin de protection et -1, mort hors rampe puis réapparition et manche suivante avec une seule pénalité. Le premier correctif avait révélé une double pénalité pendant la transition d’hôpital ; ce cas a été reproduit puis corrigé avant publication. Les rapports finaux sont dans .artifacts/koth-rounds/final-e-live-*.json. Les réglages F10 sont identiques octet par octet à leur état initial.

Le harnais natif passe 3 364 assertions et les 47 tests JavaScript ciblés passent. Le lancement respecte désormais les dix minutes de préparation prévues pour le premier chargement GTA, sans démarrer de seconde instance. La construction Electron passe.

Pack publié et retéléchargé dans un dossier vide par le vrai téléchargeur ShenPulse : KOTH 1.0.6, module commun Mont Chiliad Enhanced 1.0.11, 591 360 octets, SHA-256 7ea57e739f265580ad4f6b1657d8409aa85cedbfc937ddd4a17151dd184688b6. Les trois fichiers du runtime wins public ont également été publiés et vérifiés. L’application reste en 2.1.0.
