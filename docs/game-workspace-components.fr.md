# Composants des pages de jeux

La page Supermarket est un adaptateur des composants communs. Pour un autre jeu, fournir ses données et ses capacités à ShenPulseGameWorkspace.createContext, puis appeler renderPage ; ne pas recopier le HTML ni le CSS du jeu.

## Découpage vérifié

| Partie | Composant commun | Données propres au jeu |
| --- | --- | --- |
| En-tête, titre, statistiques, installation, lancement | workspace/sections.js | hero, actions, état d’installation |
| Téléphone, caméra, image de jeu, modèles, couleurs, mouvement, URL | workspace/preview.js | preview, capacités de chaque modèle |
| Guide de préparation et bouton d’aide | workspace/sections.js | guide, tour.steps |
| Visite avec surbrillance, navigation et focus | workspace/tour.js | sélecteurs, textes et conditions de présence |
| Cartes, cadeaux, effets, paramètres, actions multiples, sons | workspace/interactions.js | pack.effects, rows, bindings et actions |
| Follow/Likes, seuils et lignes inactives | workspace/free-events.js | freeTypes, freeDefaults et règles |
| Catalogue, catégories, recherche et carte d’effet | workspace/catalog.js | effets et ui.catalog |
| Choix des cadeaux, studios, résultats et erreurs de popup | workspace/dialogs.js | données fournies par les contrôleurs |
| Wins et overlays optionnels, repliables ou non | workspace/sections.js | features.wins/overlays, cards, renderCard/renderBody |
| Conditions de jeu et touches | features/games/conditions.js | guide, type du connecteur et contrôles enregistrés |
| Connexion/session viewers et messages/progression | features/games/interactions.js et access.js | session, droits et progression du runtime |
| Mises à jour locales et conservation des iframes | workspace/updates.js | anciennes/nouvelles vues et portée du profil |
| Styles et adaptation à la largeur | styles/game-workspace.css | variables de présentation communes |

Les conditions, états de session et progressions sont déjà des composants utilisés par plusieurs jeux. Les adaptateurs les injectent par fragments ; les composants de présentation n’interrogent ni le runtime ni les IPC.

## Contrat de réutilisation

- pack conserve les vrais identifiants d’effets, paramètres et durées ; rows conserve les identifiants de règles et d’actions.
- actions et bindings relient la vue aux contrôleurs du jeu. classAliases sert uniquement à la compatibilité des contrôleurs historiques.
- features active les sections utiles. Les fournisseurs des wins/overlays ne sont jamais appelés si leur section est désactivée.
- sectionOrder règle l’ordre des sections. La visite guidée se place dans l’en-tête ; ses cibles absentes sont ignorées.
- Les labels sont échappés. Les callbacks de fragments et de cartes fournissent uniquement du HTML de confiance produit par le renderer.
- Les écritures, droits, sauvegardes, associations cadeaux/actions et gardes asynchrones restent dans les contrôleurs et le processus principal. Ce ne sont pas des responsabilités des composants visuels.

## Optimisations

Le contexte possède un index des effets et un cache de listes d’options limités au rendu courant. Aucune donnée d’un compte ou profil n’est gardée dans un cache global.

Un catalogue fermé ne crée ni cartes ni images. À l’ouverture, le contrôleur synchronise son état et appelle populateCatalog(ctx, details). Au repli, la même fonction libère les cartes ; recherche et catégorie restent dans ui.catalog. La recherche et les catégories actualisent uniquement leurs résultats et conservent le champ de recherche monté.

Le renderer utilise patchPage(content, ancienneVue, nouvelleVue) pour mettre à jour les composants modifiés. Les autres cartes, les brouillons actifs et les iframes inchangées restent montés. Un autre compte, profil, jeu, une nouvelle source iframe ou une structure incompatible impose le rendu normal. Le plan est validé avant toute mutation. Les pages sans workspace ne sont pas analysées.

## Vérifications

Les tests couvrent une seconde page de jeu indépendante, deux instances, les sections optionnelles, la consultation seule, les caractères malveillants, les fenêtres réduites, le focus, les filtres, la persistance par IPC et les réponses asynchrones obsolètes.

Mesure locale indicative sur 12 interactions par défaut : HTML initial de 163 658 à 130 535 octets ; éléments DOM de 1 584 à 1 229 ; cartes du catalogue replié de 42 à 0. La durée de génération de cette vue est passée d’environ 3,81 à 2,08 ms dans cette mesure. Ce n’est pas une garantie de temps d’ouverture de l’application.


## Portée du choix de cadeaux

Le composant GiftBrowser accepte des groupes de cadeaux et de variantes, un sous-ensemble régional/LIVE, ses identifiants, une portée (live, standard ou inconnue), les références déjà utilisées et le nombre de résultats visibles. Les cadeaux du LIVE ne sont pris en compte que pour le créateur et la salle courants. Une réponse complète vide ne provoque jamais de substitution silencieuse par le catalogue mondial.

La case « Afficher tous les cadeaux » élargit explicitement la portée. Recherche et filtres de prix conservent ce choix. Le compteur indique le nombre de groupes correspondant à la portée et aux filtres ; les résultats supplémentaires sont affichés par lots de 60. Les variantes gardent leurs identifiants et restent sélectionnables dans un détail repliable : un dessin semblable ne fusionne jamais leurs règles ou leurs alias.

Hors liste TikTok vérifiée, le catalogue standard embarqué reste visible avec une indication explicite ; il n’est pas présenté comme une preuve de disponibilité en France. Une réponse de salle actualise la fenêtre déjà ouverte sans effacer la recherche. Les changements de compte, profil, créateur, salle ou session de dialogue invalident les réponses précédentes. Le rafraîchissement ne lance pas de nouvelle recherche réseau à chaque filtre.

## Déploiement sur les jeux externes

external-workspace.js compose maintenant les 45 fiches externes avec ces mêmes composants. Les 11 jeux ShenPulse restent sur leurs pages propres ; le choix suit aussi le logo affiché par l’administration. Les noms historiques supermarket-* des contrôleurs et market-* des attributs restent des façades de compatibilité, avec un contexte lié au jeu sélectionné.

La configuration native (touches ZQSD, gestes de Dead by Daylight, ROM et BizHawk, serveur et chrono Minecraft) reste dans une section réutilisable, sans modifier son contrat d’installation ou de lancement. Les wins et overlays complémentaires utilisent les composants existants quand ils sont proposés par le jeu. Les fiches de référence gardent leur état indisponible : la migration ne crée aucun module de jeu.

Les trois modèles, les couleurs, les cadeaux régionaux, les sons, les actions multiples, le catalogue repliable et la visite sont communs. Les écritures différées vérifient compte, profil et jeu. Les grands menus d’effets construisent leurs options au premier usage pour éviter une croissance quadratique du DOM. Les images manquantes ou répétées ont une illustration vectorielle distincte ; les images propres à un effet restent conservées.

Le relais public conserve le format historique de Supermarket et ajoute une collection par jeu. La source choisit sa fiche avec le paramètre jeu, et chaque réaction conserve son packId. Le modèle 3 emploie l’image de l’effet sélectionné. Les fichiers d’illustrations publics sont servis depuis une liste issue du catalogue ; ils ne sont pas dupliqués dans le paquet de l’application.

Le studio construit une identité et une URL propres au jeu et au profil ; ses exécutables viennent de l’installation et du manifeste. La disposition validée caméra/jeu/cadeaux est conservée. Les opérations de retrait sont proposées uniquement aux modules qui disposent d’une restauration suivie des fichiers (Supermarket, TCG et Shift) ; les autres installateurs conservent leurs capacités actuelles.

## Réorganisation des interactions

workspace/reorder.js fournit la poignée commune aux 45 fiches : glisser-déposer avec repère d’insertion, défilement au bord de la zone, annulation par Échap et déplacement avec les flèches du clavier. Les saisies et interrupteurs gardent leur comportement habituel. Le déplacement reste dans la colonne actuelle ; le sélecteur Aide/Neutre/Piège conserve son rôle.

Le contrôleur injecte onMove et protège compte, profil et jeu au moment de l’écriture. Le canal game:interactions:move est réservé au renderer principal authentifié et vérifie l’accès au jeu. Il réordonne uniquement gameInteraction.displayOrder : les priorités, l’ordre physique des règles, les cadeaux et leurs alias, les actions, sons et conditions sont conservés. Les ajouts ultérieurs se placent après les cartes déjà classées ; le retour aux valeurs par défaut retire cet ordre personnalisé.

La page et les overlays lisent le même ordre avec shared/game-interaction-order.js. Les mouvements ne rechargent pas l’iframe et une erreur de sauvegarde conserve l’ordre précédent. Un changement de page ou de profil annule le geste en cours.

## Presets et wins

Le catalogue applique les titres courts sans modifier les codes, identifiants ou paramètres techniques. presentation.js choisit les douze cadeaux communs ; starter-effects.js porte la sélection métier par jeu. Les modules indisponibles restent verrouillés. La migration ne remplace que les anciens presets intacts, écrit leur sauvegarde locale avant retrait et conserve les règles personnalisées, actions liées et événements gratuits. Un cadeau déjà occupé par une règle conservée ne reçoit pas un second effet par défaut.

workspace/wins.js regroupe les paliers positifs/négatifs et les actions de compteur, indépendamment des colonnes de jeu. L’IPC game:wins:level valide les montants, signes, droits et compte/profil et refuse de retirer une règle contenant d’autres actions. Les réglages des sources restent dans Overlays. Les opérations inversion, reset et multiplicateur utilisent le compteur du profil existant.

La source game-wins.html lit la projection publique minimale du même jeu/profil : compteur sur la caméra, multiplicateur actif, cadeaux positifs/négatifs autour du jeu et reset. Elle masque un profil différent ou un accès désactivé. L’aperçu utilise la même source avec un multiplicateur explicitement marqué Exemple quand aucun bonus ne tourne ; cette simulation n’est jamais ajoutée au studio. Les trois adaptateurs de studio ajoutent cette quatrième source uniquement aux jeux disposant de wins, sans confondre les deux URL de sources navigateur.

## Fonctions complémentaires des wins

Les actions Mute et Démute utilisent le même moteur de règles, le même choix de cadeaux et la portée compte/profil/jeu. Le service GameMuteService sérialise les demandes ; le pont Core Audio Windows ne coupe que le micro d’entrée Windows par défaut. Le helper garde l’état initial, rétablit uniquement un mute qu’il possède, surveille sa durée, la fermeture de stdin et la disparition du processus ShenPulse. Un micro déjà coupé manuellement reste dans son état initial. Le runtime n’est publié qu’après confirmation du système et est vidé lors d’un changement de profil ou redémarrage.

La configuration gameWinsFeatures, isolée par jeu dans le profil, contient le style du chrono et le montant/activation Super Fan. Super Fan reste une décision manuelle +/− après l’abonnement, conformément à son explication. Le HUD groupe Mute / Reset / Démute au-dessus du jeu, Super Fan juste dessous et l’inversion au bas de la colonne négative. Le compteur de mute ne paraît que pendant un mute actif. Installer le compteur met à jour sa source HUD avec overlayOnly et conserve caméra, jeu et cadeaux existants. Les sources et polices sont hébergées avec les overlays publics ; aucune modification des packs de jeux n’est nécessaire.

## Sections d’overlays par jeu et reprise des anciens réglages TCG

La politique partagée showOverlaySection masque la section « Les overlays » pour Demonologist, Escape from Duckov, Euro Truck Simulator 2, Find The Needle, Fortnite, Pokémon Rouge/Bleu, Resident Evil 3, Rocket League et Super Mario Kart. Les configurations enregistrées, les règles de wins et l’aperçu des cadeaux restent conservés.

TCG utilise le nettoyage 2026102606, limité aux anciennes règles simples marquées comme générées automatiquement. Les cartes starter existantes, les règles personnelles, les événements gratuits et les actions multiples restent conservés. Les anciennes cartes retirées sont sauvegardées avant la migration ; les cartes manquantes parmi les six aides et six pièges sont ensuite ajoutées avec les cadeaux communs. La migration ne se répète pas aux ouvertures suivantes et ne relance pas le nettoyage historique des autres jeux.


### Modèles des wins GTA

Sur GTA, les deux cartes de la section Overlays proposent séparément le modèle 1 intégré au LIVE et le modèle 2 avec cadre illustré. Le modèle intégré est le défaut ; le modèle illustré réutilise le design et la configuration déjà enregistrés pour winCounter et multiplierTimer. Les choix sont sauvegardés par jeu et profil dans gameWinsFeatures.counterModel et multiplierModel, via le même IPC protégé que les options des wins.

La source game-wins.html sert aussi les modes counter (720 × 520) et multiplier (900 × 360). Ces URL stables suivent le modèle sauvegardé, le compteur et la durée active. Le HUD complet du téléphone et du studio utilise la même projection. Les cadres illustrés réutilisent le moteur canonique dans une sous-source de la même origine, sans connexion supplémentaire au relais. Les valeurs changent sans recréer le cadre ; les accès aux médias restent sur la même origine. Les règles, cadeaux, actions, nombres de wins et multiplicateurs ne sont pas modifiés par le choix visuel.

Les aperçus sont centrés dans les deux axes à leur taille native et affichent un indicateur pendant le chargement. Le sélecteur de design apparaît pour le modèle 2.


### Minecraft Bedrock et Sandbox : mêmes modèles et chrono avant défaite

Les fiches minecraft-bedrock-box et minecraft-sandbox-3 conservent la composition complète des pages partagées, y compris l’installation du serveur, les interactions, les wins, la visite guidée et le studio. Elles proposent désormais les deux modèles du compteur et du multiplicateur, comme GTA, puis une troisième carte « Timer avant défaite ». Les trois aperçus sont centrés ; chaque choix de modèle reste propre au jeu et au profil.

Le timer de partie lit les dates du service MinecraftRoundTimer. Il démarre avec le serveur prêt, s’arrête à la victoire, au TIME OUT ou à l’arrêt de la session, et suit la relance automatique configurée. Ce n’est pas le timer de victoire interne des effets Bedrock/Sandbox : les commandes de ces effets restent conservées. Le chrono avant défaite ne déclenche pas lui-même de perte de win ; le service existant garde cette responsabilité, une seule fois au TIME OUT. Les réglages de durée et de relance de sa carte utilisent saveGameRoundSettings ; enregistrer pendant une partie redémarre son chrono, comme l’indique le formulaire.

Le modèle 1 est compact et intégré à la caméra, entre le multiplicateur et les wins. Le modèle 2 réutilise le moteur illustré du timer. La source dédiée game-wins.html?mode=round-timer mesure 900 × 360 ; l’URL ne change pas quand le modèle change. Le bouton Aperçu ne démarre aucune partie et ne modifie aucun compteur. Sans partie active, seul l’aperçu montre la durée de la prochaine partie.

La projection locale et le relais public prennent en compte session.game et game.roundSettingsByPack pour publier uniquement le statut, la date de fin et la durée utiles. Les chemins du serveur et les informations internes de session restent locaux. Le jeu et le profil doivent correspondre à la session active. La source complète du téléphone et du studio suit les mêmes modèles et affiche le chrono au même emplacement ; les sources dédiées restent centrées indépendamment de cette disposition.


### Parité des paliers Minecraft Sandbox et Bedrock

Les paliers de wins de Sandbox reprennent la même définition que Bedrock : +1/+3/+20/+45 et −1/−3/−20/−50, avec les mêmes cadeaux. Le catalogue Sandbox 2026102701 ajoute les paliers Galaxy et Interstellar absents des anciens profils. Il conserve les identifiants existants pour préserver les liens d’actions. Un palier manuel déjà configuré avec +3 ou +45 évite l’ajout d’un doublon.

L’ancien −55 ne devient −50 que si la règle générée correspond exactement à son ancien défaut. Un montant, cadeau, titre, interrupteur, ordre de palier ou une action liée personnalisés restent conservés. Une sauvegarde des règles précède cette correction. La migration s’exécute une seule fois par profil ; les suppressions volontaires ultérieures sont respectées. La section Wins et les deux champs indépendants utilisent le même composant sur les deux pages.


### Réglage unique de la durée Minecraft

Les deux modes Bedrock Box et Sandbox utilisent désormais une carte réutilisable « Durée de la partie », placée après les trois étapes et avant les interactions. La fiche historique « Serveur et partie » est retirée de ces deux pages ; les boutons d’installation, de démarrage et les conditions restent dans l’en-tête. Les autres jeux, dont Minecraft Survival, conservent leurs préparations particulières.

La carte d’overlay du chrono configure son apparence et sa source, sans dupliquer la durée. Le formulaire dédié appelle toujours saveGameRoundSettings, avec la même portée par jeu et profil et le même comportement de relance du chrono actif. Le guide pointe vers cette nouvelle carte. shared/minecraft-round-settings.js fournit le défaut commun de 15 minutes au serveur, au formulaire, au compteur et à la projection publique. Les durées enregistrées restent prioritaires.
