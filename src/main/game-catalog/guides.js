"use strict";

/** Catalogue de jeux : domaine « guides », données et identifiants conservés. */

const EXTERNAL_GUIDE_URLS = Object.freeze({
  "blue-prince": ["https://crowdcontrol.live/guides/blueprince/"],
  "hollow-knight-silksong": [
    "https://crowdcontrol.live/guides/hollowknightsilksong/",
    "https://streamtoearn.io/games/hollowknight-silksong"
  ],
  "hollow-knight": [
    "https://crowdcontrol.live/guides/hollowknight/",
    "https://streamtoearn.io/games/hollowknight"
  ],
  "supermarket-simulator": [
    "https://crowdcontrol.live/guides/supermarketsimulator/",
    "https://streamtoearn.io/games/supermarketsimulator"
  ],
  "egging-on": [
    "https://crowdcontrol.live/guides/eggingon/",
    "https://streamtoearn.io/games/eggingon"
  ],
  balatro: ["https://crowdcontrol.live/guides/balatro/"],
  celeste: ["https://crowdcontrol.live/guides/celeste/"],
  "dead-by-daylight": ["https://crowdcontrol.live/game/dead-by-daylight/"],
  "deep-rock-galactic": ["https://crowdcontrol.live/guides/deeprockgalactic/"],
  dredge: ["https://crowdcontrol.live/guides/dredge/"],
  "fallout-4": ["https://crowdcontrol.live/guides/fallout4/"],
  hades: ["https://crowdcontrol.live/guides/hades/"],
  inscryption: ["https://crowdcontrol.live/guides/inscryption/"],
  "no-mans-sky": ["https://crowdcontrol.live/game/no-mans-sky-2/"],
  "resident-evil-7-biohazard": ["https://crowdcontrol.live/guides/residentevil7/"],
  "vampire-survivors": ["https://crowdcontrol.live/guides/vampiresurvivors/"],
  "ark-survival-ascended": ["https://crowdcontrol.live/game/ark-survival-ascended/"],
  "cities-skylines": ["https://crowdcontrol.live/guides/citiesskylines/"],
  "kingdom-come-deliverance-2": [
    "https://crowdcontrol.live/guides/kingdomcomedeliverance2/"
  ],
  "deep-rock-galactic-survivor": [
    "https://streamtoearn.io/games/deep-rock-galactic-survivor"
  ],
  "hades-ii": ["https://streamtoearn.io/games/hades2"],
  "wobbly-life": ["https://streamtoearn.io/games/wobblylife"]
});

const GAME_GUIDES = Object.freeze({
  "minecraft-lavarise": {
    mode: "native", summary: "ShenPulse installe et lance votre serveur Lava Rise local et son module autonome.",
    journey: ["installation","interactions","overlays","launch"],
    steps: ["Possédez Minecraft Java Edition et lancez-le une première fois.","Cliquez sur Installer automatiquement et acceptez le CLUF Minecraft. ShenPulse télécharge et prépare automatiquement tout le nécessaire.","Personnalisez les six aides et six pièges, leurs cadeaux et les wins, puis installez les sources sur votre studio.","Lancez le jeu depuis ShenPulse. Dans Minecraft Java 26.1.2, ouvrez Multijoueur puis Connexion directe : 127.0.0.1:25585.","Dans la tour, saisissez /lavarise start, puis fermez le chat. Grimpez et tenez dix secondes au sommet pour gagner."],
    notes: ["Minecraft Java 26.1.2 pour PC requis, depuis Minecraft Launcher ou Xbox / Game Pass si votre compte donne accès à Java Edition.","Gardez ShenPulse ouvert. Aucun raccourci clavier imposé : les commandes sont transmises à votre serveur local.","Les effets de gel, de créatures, de glace et de plateformes mobiles nécessitent une partie commencée et un joueur présent dans la tour.","Retirer le gel nécessite un gel actif ; les équipements temporaires rétablissent ensuite le contenu précédent.","Une victoire ajoute une win ; une défaite en partie en retire une. Le multiplicateur actif s’applique au résultat.","L’arène est recréée automatiquement après une manche. Les cadeaux portent le nom du viewer dans les messages de la partie."], sources: []
  },
  palworld: require("./palworld-guide"),
  "escape-from-duckov": {
    mode: "native", summary: "ShenPulse détecte le jeu Steam, installe les 83 interactions et démarre leur connexion locale.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Installe Escape From Duckov dans Steam et lance-le une première fois, puis ferme le jeu.",
      "Dans Installation, clique sur Installer automatiquement. ShenPulse télécharge le module, vérifie ses fichiers et sauvegarde les fichiers remplacés.",
      "Six aides et six pièges sont proposés avec leurs cadeaux par défaut. Adapte-les ou ajoute tes propres interactions sur cette page.",
      "Choisis le modèle des cartes de cadeaux et installe-les sur ton studio si tu le souhaites, puis clique sur Lancer le jeu.",
      "Charge une partie, pars en expédition hors du refuge et ferme les menus avant de tester les interactions."
    ],
    notes: [
      "Édition Steam PC requise. Le module ne dépend d’aucun raccourci clavier particulier.",
      "Steam doit être ouvert et connecté au compte qui possède le jeu pour permettre son lancement.",
      "Les effets sont refusés dans le refuge, pendant les chargements, en pause ou lorsque le canard est mort.",
      "Remplir, vider ou retirer une arme nécessite une arme à feu tenue en main. Prévois de la place pour recevoir des objets.",
      "Soigner une altération nécessite de subir cette altération. Les apparitions d’ennemis dépendent des points d’apparition présents dans la zone.",
      "Le module conserve les sauvegardes et les préférences MelonLoader existantes. Pour les premiers essais, utilise une partie d’essai sans autres mods.",
      "Conserve ShenPulse ouvert pendant la partie. Le premier lancement peut prendre plus de temps pour préparer MelonLoader."
    ],
    sources: [{ label: "Documentation technique du pack", url: "https://crowdcontrol.live/guides/escapefromduckov/" }]
  },
  ...require("./four-games-guides"),
  ...require("./shop-games-guides"),
  "ark-survival-ascended": {
    mode: "input",
    summary: "ShenPulse détecte ARK Steam ou Xbox Game Pass et prépare ses 29 interactions clavier et souris.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, choisis les déplacements WASD ou ZQSD puis clique sur Installer les interactions. Confirme le dossier détecté.",
      "Associe tes cadeaux ou autres déclencheurs aux interactions souhaitées.",
      "Prépare les fiches d’interactions pour ton LIVE dans l’étape Overlays.",
      "Lance ARK depuis ShenPulse, charge une partie et ferme les menus avant de tester les commandes."
    ],
    notes: [
      "Aucun mod ni autre logiciel d’interactions n’est nécessaire. ShenPulse utilise le jeu déjà installé, sans modifier ses fichiers ni ses sauvegardes.",
      "Les commandes nécessitent le clavier et la souris avec les raccourcis du jeu par défaut. Le choix ZQSD adapte uniquement les déplacements ; les autres touches doivent correspondre aux commandes indiquées dans ARK.",
      "Les effets d’arme, d’objet ou d’inventaire dépendent de l’équipement et de la cible. Ferme le chat et les menus pour éviter d’y envoyer les commandes.",
      "La fenêtre ArkAscended.exe doit être disponible. ShenPulse la place au premier plan pour envoyer les commandes.",
      "Les interactions du pack officiel agissent sur les commandes du joueur. Aucun effet de ressources, météo ou apparition de dinosaures n’est inclus dans ce pack."
    ],
    sources: [{ label: "Référence technique · ARK", url: "https://open-api.crowdcontrol.live/games/ARKSurvivalAscended/packs" }, { label: "Documentation technique des commandes", url: "https://crowdcontrol.live/guides/disrupts" }]
  },
  balatro: {
    mode: "native",
    summary: "ShenPulse installe les interactions adaptées à Balatro Steam ou Xbox Game Pass, puis les active au lancement du jeu.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Ferme Balatro puis clique sur Installer automatiquement. ShenPulse détecte son dossier Steam ou XboxGames.",
      "Associe tes cadeaux et autres déclencheurs aux interactions souhaitées.",
      "Prépare les fiches d’interactions pour ton LIVE dans l’étape Overlays.",
      "Lance Balatro depuis ShenPulse, commence une manche et choisis une mise avant de tester les effets."
    ],
    notes: [
      "Sur Steam, ShenPulse installe Lovely, Steamodded et le module local. Sur Game Pass, l’adaptateur ShenPulse utilise le moteur GDK déjà installé, sans changer les sauvegardes.",
      "Les effets s’exécutent pendant la sélection des cartes. Certains nécessitent des cartes, des jokers, des consommables ou assez de ressources.",
      "Les effets de destruction modifient réellement la manche. Utilise une nouvelle partie pour les essais.",
      "Garde ShenPulse ouvert pendant le LIVE."
    ],
    sources: [{ label: "Code source du module tiers · Balatro", url: "https://github.com/WarpWorld/CCPack-PC-Balatro" }, { label: "Documentation technique · Balatro", url: "https://crowdcontrol.live/guides/balatro/" }]
  },
  "blue-prince": {
    mode: "native",
    summary: "ShenPulse détecte Blue Prince Steam ou Xbox Game Pass, installe BepInEx et le module officiel, puis active les interactions au lancement.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Ferme Blue Prince puis clique sur Installer automatiquement.",
      "Associe les cadeaux et autres déclencheurs aux ressources, objets, déplacements et plans de pièces.",
      "Prépare les fiches d’interactions pour ton LIVE dans l’étape Overlays.",
      "Lance le jeu depuis ShenPulse, attends la préparation du premier lancement puis charge une partie et teste un effet."
    ],
    notes: [
      "Le premier lancement peut durer plus longtemps pendant la préparation des composants du mod.",
      "Les changements de plans nécessitent la sélection de pièces ; les objets et ressources dépendent de la progression et de l’état du joueur.",
      "Les changements de vitesse sont temporaires. La durée est configurable dans les interactions.",
      "L’entrée « Forcer les coups de pied » est conservée mais verrouillée : le module officiel ne contient aucune action pour cet effet.",
      "Garde ShenPulse ouvert pendant le LIVE."
    ],
    sources: [{ label: "Documentation technique · Blue Prince", url: "https://crowdcontrol.live/guides/blueprince/" }]
  },
  "crash-bandicoot-n-sane-trilogy": {
    mode: "native",
    summary: "ShenPulse installe son pont autonome et pilote 26 interactions dans Crash Bandicoot N. Sane Trilogy sur Steam.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Installez Crash Bandicoot N. Sane Trilogy depuis Steam et ouvrez-le une première fois.",
      "Dans Installation, laissez ShenPulse détecter le dossier Steam et installer son pont local.",
      "Associez vos cadeaux aux interactions et choisissez les quantités ou durées souhaitées.",
      "Lancez le jeu depuis ShenPulse, Steam ouvert, puis chargez un niveau jouable. Si le jeu est déjà ouvert, le lancement depuis ShenPulse y connecte le pont."
    ],
    notes: [
      "La version Windows Steam 2964270 est prise en charge. Un exécutable différent est refusé avant toute interaction.",
      "Le pont fonctionne sur ce PC et ne modifie pas l’exécutable du jeu sur disque. Aucun autre logiciel d’interactions n’est requis.",
      "Le lancement passe par Steam et attend la fenêtre du jeu ainsi que sa connexion à ShenPulse. Les éventuelles demandes de Steam doivent être validées pour poursuivre.",
      "Les interactions demandent un personnage contrôlable, hors pause, chargement, cinématique et salle de téléportation.",
      "Les effets temporaires sont restaurés pendant les pauses et reprennent au retour en jeu. Leur durée avance uniquement dans une phase jouable. Une déconnexion de ShenPulse les arrête et les restaure.",
      "Deux envois du même effet prolongent sa durée. Pour les variantes incompatibles (saut, vitesse, lumière, caméra, taille), le dernier effet prend le relais en conservant le temps restant, dans la limite d’une heure.",
      "Les compteurs respectent les limites du jeu : vies 0–99, fruits 0–255, caisses jusqu’au total du niveau. Une variation impossible est refusée ; les variations acceptées peuvent être sauvegardées par le jeu."
    ],
    sources: []
  },
  unturned: {
    mode: "native",
    summary: "ShenPulse installe son module autonome et pilote directement 27 interactions dans une partie solo Unturned.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Installez gratuitement Unturned depuis Steam, lancez-le une fois, puis fermez le jeu.",
      "Dans Installation, laissez ShenPulse détecter le dossier Steam et installer son module. Les fichiers remplacés sont sauvegardés.",
      "Associez les cadeaux ou autres déclencheurs aux interactions souhaitées. Les 27 interactions attendent vos associations.",
      "Lancez Unturned depuis ShenPulse, sans BattlEye, puis chargez une partie solo et vérifiez la connexion avant le LIVE."
    ],
    notes: [
      "Le module fonctionne en partie solo sur ce PC. Les serveurs multijoueurs et dédiés ne sont pas pris en charge.",
      "Si vous lancez le jeu depuis Steam, choisissez le lancement sans BattlEye : les modules du client sont désactivés lorsque l’anti-triche est actif.",
      "Les zombies apparaissent et poursuivent le joueur aussi hors des villes. Hors des zones de navigation, ils se déplacent au sol avec les collisions du jeu ; les murs et obstacles peuvent les bloquer. La carte doit contenir des modèles de zombies.",
      "Le largage aérien vise la position du joueur. Une cargaison de largage doit être définie sur la carte.",
      "L’ID 0 choisit un objet, animal ou véhicule aléatoire parmi les ressources chargées. Vous pouvez préciser un ID du jeu ou d’un mod installé.",
      "Le mélange d’inventaire conserve les objets : ceux qui ne rentrent plus sont déposés au sol. L’explosion préserve les bâtiments et conteneurs.",
      "Les apparitions sont limitées à 50 par commande. Testez les interactions dans une sauvegarde dédiée avant votre LIVE."
    ],
    sources: []
  },
  "the-mortuary-assistant": {
    mode: "native",
    summary: "Jeu complet Steam requis. ShenPulse installe le mod local et pilote directement les 22 interactions depuis ce PC.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Installez le jeu complet The Mortuary Assistant depuis Steam, puis fermez-le.",
      "Dans Installation, laissez ShenPulse détecter le dossier du jeu et installer le mod ainsi que ses prérequis. Les fichiers remplacés sont sauvegardés.",
      "Associez vos cadeaux ou autres déclencheurs aux interactions souhaitées, puis configurez vos overlays.",
      "Lancez le jeu depuis ShenPulse et chargez une partie. Attendez la connexion locale, puis testez les interactions avant le LIVE."
    ],
    notes: [
      "Le jeu et ShenPulse doivent rester ouverts sur le même PC. Le premier lancement du mod peut prendre plusieurs minutes pour préparer les fichiers du jeu.",
      "Les interactions démoniaques nécessitent que le démon soit éveillé : elles sont indisponibles pendant le tutoriel d’ouverture.",
      "Revenez dans la partie pour les interactions : le jeu doit être au premier plan, hors pause, menus, chargements et cinématiques. Certaines actions demandent un corps, une étape d’embaumement ou une place libre dans l’inventaire.",
      "F8 affiche ou masque l’indicateur ShenPulse. F9 relance la connexion locale.",
      "L’intégration cible le jeu complet Steam sous Windows. La démo n’est pas prise en charge."
    ],
    sources: []
  },
  "find-the-needle-demo": {
    mode: "native",
    summary: "Démo Steam V62 / build 25867630, mod S2E Find The Needle 1.2.7 fourni séparément. ShenPulse pilote ses 37 commandes sur ce PC, sans service supplémentaire.",
    journey: ["installation", "interactions", "launch"],
    steps: [
      "Installez Find The Needle Demo depuis Steam (application 5165210), puis fermez le jeu.",
      "Dans Installation, sélectionnez le ZIP du mod téléchargé ; ShenPulse conserve les réglages existants et sauvegarde les fichiers remplacés.",
      "Personnalisez les 37 interactions : seules quatre associations du modèle sont préconfigurées, les autres attendent votre déclencheur.",
      "Lancez la démo et chargez une partie. Vérifiez la connexion locale, puis testez les effets dans une sauvegarde dédiée avant le LIVE."
    ],
    notes: [
      "Le jeu et ShenPulse doivent rester ouverts sur le même PC. Le mod écoute uniquement sur 127.0.0.1:55001 ; F8 affiche son panneau d’effets.",
      "Par défaut, les effets temporisés attendent lorsque le jeu est en pause ou hors du premier plan : revenez dans la partie pour les voir avancer.",
      "L’argent, le foin, les bâtiments et technologies peuvent être sauvegardés par le jeu. Effacer les effets ne restaure pas ces changements.",
      "Les identifiants des technologies et bâtiments sont fournis par /technologies et /buildings ; random choisit une cible éligible. Certaines cibles sont indisponibles dans la démo.",
      "Le mod tiers n’est pas redistribué par ShenPulse. Cette intégration est pour l’instant réservée au compte propriétaire."
    ],
    sources: [
      { label: "Démo officielle sur Steam", url: "https://store.steampowered.com/app/5165210/" },
      { label: "Fiche StreamToEarn", url: "https://streamtoearn.io/games/findtheneedledemo" }
    ]
  },
  thiercelieux: integratedGuide(
    "La régie sociale est intégrée à ShenPulse avec des illustrations originales et sans contenu graphique officiel non autorisé.",
    [
      "Configurez le cadeau d’entrée et constituez la file LIVE.",
      "Installez jusqu’à huit joueurs, choisissez les extensions et le format portrait ou paysage.",
      "Distribuez les personnages en privé puis suivez le guide dynamique du maître du jeu."
    ]
  ),
  "coin-pusher": integratedGuide(
    "Le jeu est intégré à ShenPulse : aucune installation externe n’est nécessaire.",
    ["Configure les cadeaux et les valeurs des pièces.", "Teste le Plinko et le poussoir.", "Lance la fenêtre de jeu avant le LIVE."]
  ),
  "connect-four": integratedGuide(
    "Le jeu est intégré à ShenPulse : la grille et les équipes se configurent dans l’application.",
    ["Choisis la taille de grille et la condition de victoire.", "Associe les cadeaux aux équipes.", "Teste une manche avant le LIVE."]
  ),
  "deal-or-no-deal": integratedGuide(
    "Le plateau, le banquier et les boîtes sont inclus dans ShenPulse.",
    ["Règle les valeurs et le prix d’entrée.", "Configure les demandes du banquier.", "Ouvre la fenêtre hôte et teste une boîte."]
  ),
  "diamond-bridge": integratedGuide(
    "Le Pont des Diamants est inclus et ne modifie aucun autre jeu.",
    ["Règle le cadeau d’entrée.", "Configure l’aide et la file des joueurs.", "Teste les commandes du pont."]
  ),
  "diamond-drop": integratedGuide(
    "Diamond Drop Live s’exécute directement dans ShenPulse.",
    ["Configure les coûts et multiplicateurs.", "Associe les interactions TikTok.", "Lance une partie de test."]
  ),
  "color-strike": {
    mode: "native",
    summary:
      "La version autonome ShenPulse de Color Strike expose ses interactions uniquement en local sur le port 7444.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, lance le téléchargement et l’installation automatiques depuis ShenPulse.",
      "Vérifie ou personnalise les cadeaux déjà associés aux interactions Color Strike.",
      "Clique sur Lancer puis commence une partie dans Color Strike.",
      "Vérifie la connexion locale avant d’activer la session LIVE."
    ],
    notes: [
      "Le jeu ne demande ni ticket, ni launcher externe, ni connexion aux anciennes API.",
      "ShenPulse communique uniquement avec 127.0.0.1:7444 ; le jeu et ShenPulse doivent rester ouverts.",
      "Les cadeaux, likes, follows, partages et la commande !spin de la configuration par défaut sont actifs dès l’initialisation."
    ],
    sources: []
  },
  "tiklive-climb": {
    mode: "native",
    summary:
      "La version autonome ShenPulse de Climb expose ses interactions uniquement en local sur le port 7777.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, lance le téléchargement et l’installation automatiques depuis ShenPulse.",
      "Vérifie ou personnalise les cadeaux déjà associés aux interactions Climb.",
      "Clique sur Lancer puis commence une ascension dans Climb.",
      "Vérifie la connexion locale avant d’activer la session LIVE."
    ],
    notes: [
      "Le jeu ne demande ni ticket, ni launcher externe, ni connexion aux anciennes API.",
      "ShenPulse communique uniquement avec 127.0.0.1:7777 ; le jeu et ShenPulse doivent rester ouverts.",
      "Les cadeaux, likes, follows, partages et la commande !spin de la configuration par défaut sont actifs dès l’initialisation."
    ],
    sources: []
  },
  "tiklive-cube-wars": {
    mode: "native",
    summary:
      "La version autonome ShenPulse de Cube Wars expose ses interactions uniquement en local sur le port 7811.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, lance le téléchargement et l’installation automatiques depuis ShenPulse.",
      "Vérifie ou personnalise les cadeaux associés aux camps Hommes et Femmes.",
      "Clique sur Lancer, démarre une manche, puis les viewers choisissent H ou F dans le chat.",
      "Vérifie la connexion locale avant d’activer la session LIVE."
    ],
    notes: [
      "Le jeu ne demande ni ticket, ni launcher externe, ni connexion aux anciennes API.",
      "ShenPulse communique uniquement avec 127.0.0.1:7811 ; le jeu et ShenPulse doivent rester ouverts.",
      "Les cadeaux, likes, follows, partages, les commandes H/F et !spin de la configuration par défaut sont actifs dès l’initialisation."
    ],
    sources: []
  },
  "tiklive-stack-tower": {
    mode: "native",
    summary:
      "La version autonome ShenPulse de Stack Tower expose ses interactions uniquement en local sur le port 7817.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, lance le téléchargement et l’installation automatiques depuis ShenPulse.",
      "Vérifie ou personnalise les cadeaux déjà associés aux aides, sabotages et WINS de Stack Tower.",
      "Clique sur Lancer, commence la construction et tente d’atteindre les 500 étages.",
      "Vérifie la connexion locale avant d’activer la session LIVE."
    ],
    notes: [
      "Le jeu ne demande ni ticket, ni launcher externe, ni connexion aux anciennes API.",
      "ShenPulse communique uniquement avec 127.0.0.1:7817 ; le jeu et ShenPulse doivent rester ouverts.",
      "Les 31 cadeaux TikLive, le tap-tap, le follow, le partage et la commande !spin sont préconfigurés dès l’initialisation."
    ],
    sources: []
  },
  "clash-of-live": {
    mode: "native",
    summary:
      "La version autonome Clash Of ShenPulse expose ses interactions uniquement en local sur le port 4244.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Dans Installation, lance le téléchargement et l’installation automatiques depuis ShenPulse.",
      "Vérifie ou personnalise les cadeaux déjà associés aux renforts rouges et bleus.",
      "Clique sur Lancer puis démarre une partie dans Clash Of ShenPulse.",
      "Vérifie la connexion locale avant d’activer la session LIVE."
    ],
    notes: [
      "Le jeu ne demande ni licence, ni launcher externe, ni connexion aux anciennes API.",
      "ShenPulse communique uniquement avec 127.0.0.1:4244 ; le jeu et ShenPulse doivent rester ouverts.",
      "Les cadeaux, likes, follows, partages et la commande !spin de la configuration par défaut sont actifs dès l’initialisation."
    ],
    sources: []
  },
  "pokemon-red-blue": {
    mode: "emulator",
    summary: "ShenPulse installe BizHawk, Pokémon Rouge et le pack d’interactions dans un environnement prêt à jouer.",
    steps: [
      "Clique sur Installer : BizHawk, Pokémon Rouge et le module local ShenPulse sont téléchargés automatiquement.",
      "ShenPulse vérifie la ROM et applique automatiquement le correctif d’interactions.",
      "Configure les interactions TikTok que tu souhaites utiliser.",
      "Clique sur Lancer pour ouvrir directement la ROM dans BizHawk avec le connecteur actif."
    ],
    notes: [
      "Aucun fichier supplémentaire n’est demandé à l’utilisateur.",
      "Garde BizHawk et ShenPulse ouverts pendant le LIVE. Le module local est géré automatiquement et fonctionne sans compte ni logiciel d’interactions tiers."
    ],
    sources: [
      {
        label: "Documentation technique · Pokémon Rouge/Bleu",
        url: "https://crowdcontrol.live/guides/pokemonredblue"
      }
    ]
  },
  "super-mario-kart": {
    mode: "emulator",
    summary:
      "ShenPulse installe BizHawk, Super Mario Kart et le pack de 87 interactions dans un environnement prêt à jouer.",
    steps: [
      "Clique sur Installer : BizHawk, Super Mario Kart et le module local ShenPulse sont téléchargés automatiquement.",
      "ShenPulse vérifie l’empreinte de la ROM USA incluse.",
      "Configure les interactions TikTok que tu souhaites utiliser.",
      "Clique sur Lancer pour ouvrir directement la ROM dans BizHawk avec le connecteur actif."
    ],
    notes: [
      "Aucun fichier supplémentaire n’est demandé à l’utilisateur.",
      "Garde BizHawk et ShenPulse ouverts pendant le LIVE. Le module local est géré automatiquement et fonctionne sans compte ni logiciel d’interactions tiers."
    ],
    sources: [
      {
        label: "Documentation technique · Super Mario Kart",
        url: "https://crowdcontrol.live/guides/supermariokart"
      }
    ]
  },
  fortnite: {
    mode: "input",
    summary:
      "Aucun mod n’est installé : ShenPulse envoie ses interactions clavier directement à la fenêtre Fortnite.",
    steps: [
      "Lance Fortnite sur PC et charge une partie jouable.",
      "Configure les touches du jeu indiquées par ShenPulse dans le tableau ci-dessous.",
      "Configure les interactions puis teste-les pendant que Fortnite est ouvert.",
      "Active la session de jeu avant le LIVE."
    ],
    notes: [
      "ShenPulse refuse l’envoi si le processus Fortnite exact n’est pas ouvert.",
      "Les effets ciblent uniquement FortniteClient-Win64-Shipping.exe et ne modifient aucun fichier du jeu.",
      "Les commandes dépendent des touches standard du pack : ZQSD/WASD, Maj, Espace, Ctrl, R, B, M et 1 à 5."
    ],
    sources: [
      {
        label: "Référence technique · Fortnite",
        url: "https://crowdcontrol.live/game/fortnite/"
      },
      {
        label: "Guide officiel des Input Disrupts",
        url: "https://crowdcontrol.live/guides/disrupts"
      }
    ]
  },
  "rocket-league": {
    mode: "input",
    summary:
      "Aucun mod n’est installé : ShenPulse envoie les commandes clavier et souris directement à la fenêtre Rocket League.",
    steps: [
      "Lance Rocket League sur PC et entre dans une partie jouable.",
      "Choisis la disposition WASD ou ZQSD et conserve les touches indiquées par ShenPulse.",
      "Démarre la session, puis ajoute les interactions TikTok souhaitées.",
      "Teste chaque interaction pendant que la fenêtre Rocket League est ouverte."
    ],
    notes: [
      "Aucun fichier du jeu n’est téléchargé ni modifié.",
      "Les commandes ciblent uniquement RocketLeague.exe et s’arrêtent si cette fenêtre n’est plus disponible.",
      "Les touches attendues sont : WASD ou ZQSD pour conduire, Ctrl pour déraper, Espace pour la caméra ballon, Tab pour le score, clic gauche pour le turbo et clic droit pour sauter.",
      "Le mode plein écran sans bordure ou fenêtré facilite le retour au premier plan pendant les tests."
    ],
    sources: []
  },
  demonologist: {
    mode: "input",
    summary:
      "Aucun mod n’est requis : ShenPulse envoie ses interactions clavier et souris directement à la fenêtre Demonologist.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Lance Demonologist depuis Steam et charge une partie.",
      "Choisis le clavier WASD ou ZQSD puis vérifie que ShenPulse détecte la fenêtre du jeu.",
      "Configure les cadeaux TikTok sur les 31 interactions disponibles.",
      "Active la session ShenPulse en gardant Demonologist au premier plan."
    ],
    notes: [
      "Aucun fichier du jeu n’est téléchargé ni modifié.",
      "Les commandes sont envoyées uniquement à la fenêtre de jeu Demonologist (Shivers-Win64-Shipping.exe) et s’arrêtent si elle ne peut plus être ciblée.",
      "La Démo Steam n’expose qu’une partie des commandes dans ses réglages. ShenPulse conserve néanmoins les 31 interactions pour les utilisateurs de la version complète.",
      "Le pack officiel recommande le plein écran sans bordure ou le mode fenêtré."
    ],
    sources: [
      {
        label: "Documentation technique des commandes",
        url: "https://crowdcontrol.live/guides/disrupts"
      },
      {
        label: "Catalogue officiel Demonologist",
        url: "https://crowdcontrol.live/games/demonologist"
      }
    ]
  },
  "euro-truck-simulator-2": {
    mode: "crowd-control-mod",
    summary:
      "Le module local Euro Truck Simulator 2 se connecte automatiquement à ShenPulse et reçoit les interactions LIVE configurées, sans autre logiciel d’interactions.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Ferme Euro Truck Simulator 2, puis laisse ShenPulse détecter le dossier de l’édition que tu utilises et installer automatiquement les interactions.",
      "Configure les cadeaux dans ShenPulse. Aucun autre logiciel d’interactions n’est nécessaire.",
      "Prépare si besoin la fiche d’interactions pour ton overlay LIVE.",
      "Lance le jeu avec le bouton Démarrer de ShenPulse, confirme le message du SDK avancé si le jeu l’affiche, puis charge une partie. ShenPulse vérifie la connexion du module avant de confirmer le lancement."
    ],
    notes: [
      "Le pack officiel a été testé avec la version Steam du jeu.",
      "Le jeu doit être fermé pendant l’installation ou la réparation du module. Relance-le ensuite depuis ShenPulse pour charger les fichiers mis à jour.",
      "Si le jeu demande d’autoriser les fonctionnalités avancées du SDK, confirme ce message pour permettre le chargement du module. Ferme les menus avant de tester les interactions.",
      "Le mode Convoy n’est pas officiellement validé et certains effets peuvent ne pas fonctionner en multijoueur.",
      "Teste toujours quelques interactions dans une sauvegarde chargée avant le LIVE."
    ],
    sources: [
      {
        label: "Documentation technique · Euro Truck Simulator 2",
        url: "https://crowdcontrol.live/guides/eurotrucksimulator2"
      },
      {
        label: "Catalogue officiel des interactions",
        url: "https://crowdcontrol.live/games/eurotrucksimulator2"
      }
    ]
  },
  "resident-evil-3": {
    mode: "native",
    summary:
      "ShenPulse détecte Resident Evil 3, installe automatiquement REFramework et son module local, puis reçoit les interactions LIVE sans autre logiciel d’interactions.",
    journey: ["installation", "interactions", "overlays", "launch"],
    steps: [
      "Ferme Resident Evil 3, puis laisse ShenPulse détecter son dossier Steam et installer le mod officiel recommandé.",
      "Associe les cadeaux TikTok aux interactions souhaitées dans ShenPulse.",
      "Prépare si besoin la fiche d’interactions destinée à ton overlay LIVE.",
      "Lance Resident Evil 3 depuis ShenPulse, charge une sauvegarde jouable puis teste un effet."
    ],
    notes: [
      "L’installation recommandée cible la version actuelle de Resident Evil 3 ; l’ancienne branche dx11_non-rt n’est pas sélectionnée automatiquement.",
      "Le bouton Installation ajoute automatiquement le runtime Bureau .NET 8 officiel s’il manque.",
      "Le module utilise une connexion locale dédiée. Conserve ShenPulse ouvert pendant la partie ; aucun autre logiciel d’interactions n’est nécessaire.",
      "Un test manuel remet automatiquement Resident Evil 3 au premier plan avant d’envoyer l’effet. Le jeu doit néanmoins être dans une partie jouable, hors menu, cinématique et chargement.",
      "Certains effets dépendent du personnage, de l’inventaire, des ennemis présents ou de la progression. Ils peuvent être temporairement indisponibles dans un menu, une cinématique ou un chargement.",
      "La touche Inser ouvre le menu REFramework dans le jeu si un diagnostic est nécessaire."
    ],
    sources: [
      {
        label: "Documentation technique · Resident Evil 3",
        url: "https://crowdcontrol.live/guides/residentevil3?pack=ResidentEvil3"
      },
      {
        label: "Catalogue officiel Resident Evil 3",
        url: "https://crowdcontrol.live/games/residentevil3"
      }
    ]
  },
  "gtav-hiking-enhanced": {
    mode:"native", summary:"Suivez trente points de contrôle en montagne avec vos viewers. Installation et connexion locales ShenPulse.",
    requirements:["GTA V Enhanced installé (Steam, Epic Games ou Rockstar Games), en mode Histoire.","ShenPulse installe une sauvegarde Histoire préparée pour accéder au parcours sans refaire le prologue.","Installez le pack sur cette fiche, jeu fermé, puis lancez GTA depuis cette même fiche.","Les autres modes GTA exigent de fermer le jeu avant de changer de mode. Le mode Online n’est pas pris en charge."],
    steps:["Cliquez sur Installer automatiquement et choisissez le dossier GTA V Enhanced détecté. La sauvegarde préparée est téléchargée avec le module.","Configurez les cadeaux, la durée de randonnée et les sources de votre studio.","Cliquez sur Lancer le jeu puis chargez le mode Histoire. Si GTA reprend le prologue ou une autre partie, chargez la sauvegarde préparée depuis Jeu → Charger partie. Hiking vous emmène ensuite au départ de la randonnée dès sa connexion.","Suivez les trente points dans l’ordre pour gagner. Une mort ou un TIME OUT retire une win.","F10 ouvre les réglages : véhicules autorisés, compteur, téléportations et création d’un parcours personnel."],
    notes:["La sauvegarde est ajoutée au profil Rockstar récemment utilisé, dans un emplacement libre en priorité. Si tous les emplacements sont occupés, celui remplacé est copié en sécurité avant l’installation.","Les interactions sont natives et communiquent seulement avec ShenPulse sur ce PC.","Les durées temporaires sont réglables sur chaque interaction.","Pour Adversaires embrasés, faites d’abord apparaître au moins un adversaire.","Un nouveau parcours F10 exige un départ et au moins deux points ; terminez-le pour le sauvegarder."]
  },
  "gtav-koth-enhanced": {
    mode:"native",
    summary:"Gravissez la rampe KOTH pendant que vos viewers font dévaler véhicules et obstacles. Installation et connexion locales ShenPulse.",
    steps:[
      "Fermez GTA V. Cliquez sur Installer automatiquement et choisissez le dossier contenant GTA5_Enhanced.exe. Le module et la sauvegarde Histoire préparée sont téléchargés ensemble.",
      "Choisissez les cadeaux et les interactions, puis installez votre scène dans le studio.",
      "Cliquez sur Lancer le jeu depuis cette page KOTH : ShenPulse sélectionne ce mode avant le démarrage.",
      "Chargez le mode Histoire et attendez la création automatique de la rampe. Si GTA reprend le prologue ou une autre partie, choisissez la sauvegarde préparée dans Jeu → Charger partie. F10 ouvre les réglages ; les flèches choisissent l’angle, la longueur et le design, puis Entrée recrée la rampe.",
      "Réglez la durée de la partie dans ShenPulse (15 minutes par défaut). Tenez dix secondes dans le cercle avant la fin pour gagner. Mort, chute ou temps écoulé retirent une seule WIN ; la protection automatique ne s’applique que sur la rampe."
    ],
    requirements:["GTA V Enhanced sur PC uniquement. GTA Online n’est pas pris en charge.","Utilisez le mode Histoire avec BattlEye désactivé dans les paramètres du Rockstar Games Launcher.","La version de ScriptHookV doit prendre en charge la version installée de GTA V Enhanced.","Gardez ShenPulse ouvert. Fermez GTA avant de passer de KOTH au Mont Chiliad."],
    notes:["Jusqu’à 256 obstacles ; ils restent présents jusqu’à leur chute complète hors de la rampe.","Un modèle de véhicule absent de votre version GTA est refusé avec un message explicite.","La sauvegarde préparée est ajoutée au profil Rockstar récemment utilisé, dans un emplacement libre en priorité. Si tous les emplacements sont occupés, celui remplacé est copié en sécurité avant l’installation.","Désactivez dans GTA la pause lorsque la fenêtre devient inactive pour permettre les essais et les effets en arrière-plan."],
    sources:[]
  },
  "gtav-montchiliad": {
    mode: "native",
    summary: "ShenPulse installe, prépare et lance GTA V Mont Chiliad avec un parcours simple en quatre étapes.",
    steps: [
      "Fermez GTA V avant de commencer.",
      "Laissez ShenPulse détecter et préparer automatiquement le jeu.",
      "Choisissez les interactions et les overlays souhaités.",
      "Lancez le jeu puis chargez votre partie."
    ],
    notes: [
      "ShenPulse conserve automatiquement une copie de sécurité.",
      "Si le jeu n’est pas trouvé, choisissez simplement son dossier."
    ],
    sources: []
  },
  "minecraft-bedrock-box": managedMinecraftGuide(
    "Installe le serveur local et le monde Bedrock Box, puis rejoins 127.0.0.1."
  ),
  "minecraft-sandbox-3": managedMinecraftGuide(
    "Installe le serveur local SandBox 3 et ses plugins, puis rejoins 127.0.0.1."
  ),
  "minecraft-survival-plugin": managedMinecraftGuide(
    "Installe automatiquement PaperMC, Java 21 et le plugin Survival, puis rejoins 127.0.0.1 en mode survie.",
    [
      {
        label: "Catalogue officiel StreamToEarn · Survival",
        url: "https://streamtoearn.io/plugins/s2e-survival-plugin"
      }
    ]
  ),
  "cult-of-the-lamb": modGuide(
    "ShenPulse détecte Cult of the Lamb, installe BepInEx et son pont local, puis charge les interactions historiques du pack."
  ),
  "stardew-valley": {
    mode: "native",
    summary: "Installation automatique des interactions ShenPulse sur Stardew Valley Steam ou Xbox / Game Pass.",
    steps: [
      "Installez Stardew Valley 1.6.14 ou une version ultérieure sur Steam ou Xbox / Game Pass et lancez-le une première fois.",
      "Cliquez sur Installer automatiquement. Si les deux éditions sont présentes, choisissez celle que vous utiliserez ; ShenPulse installe SMAPI et conserve le lanceur Xbox original.",
      "Choisissez les cadeaux puis utilisez Lancer le jeu dans ShenPulse : seule l’édition enregistrée est lancée, avec SMAPI.",
      "Chargez une partie solo, fermez les menus et les dialogues, puis testez les effets avant le LIVE."
    ],
    notes: [
      "Gardez ShenPulse ouvert pendant la partie. Les interactions sont locales et ne demandent aucun raccourci clavier.",
      "Les interactions s’appliquent hors menus, festival et cinématique, dans une partie solo.",
      "Conservez l’outil concerné dans l’inventaire. Un outil déjà au minimum ou au maximum ne peut pas dépasser sa limite.",
      "Libérez de la place pour recevoir des objets et placez le joueur dans une zone dégagée pour les apparitions.",
      "Les effets temporaires se terminent après leur durée même si la fenêtre du jeu passe en arrière-plan.",
      "Après une mise à jour Xbox du jeu, réinstallez les interactions pour réactiver SMAPI sur cette édition."
    ],
    sources: []
  },
  terraria: {
    mode: "native",
    summary: "Interactions locales ShenPulse pour Terraria avec tModLoader stable.",
    steps: [
      "Installez Terraria dans Steam, puis fermez le jeu. tModLoader n’a pas besoin d’être installé séparément.",
      "Utilisez Installer automatiquement dans ShenPulse : tModLoader stable, son runtime et les interactions sont téléchargés depuis Backblaze et installés ensemble dans un sous-dossier du jeu original.",
      "Choisissez vos cadeaux, puis utilisez Lancer le jeu dans ShenPulse. Son lanceur officiel utilise le profil ShenPulse, y compris avec une copie Steam familiale.",
      "Chargez un personnage et un monde d’essai en solo, fermez l’inventaire et les dialogues, puis testez les effets avant le LIVE."
    ],
    notes: [
      "Gardez Steam et ShenPulse ouverts. Lancez tModLoader, pas le Terraria original sans mods.",
      "Vos personnages et mondes tModLoader existants restent à leur emplacement habituel et sont accessibles depuis le profil ShenPulse. Ils sont distincts de ceux du Terraria original. Conservez vos sauvegardes avant les effets destructeurs.",
      "Les interactions s’appliquent en solo, hors menu, pause, inventaire, dialogue et écran de mort.",
      "Prévoyez de la place dans l’inventaire et autour du personnage. Terminez le boss en cours avant d’en invoquer un autre.",
      "Les soins ne dépassent pas la santé maximale. Les boss disponibles dépendent de la progression, du biome et de l’heure du monde.",
      "La méthode familiale officielle ne prend pas en charge le multijoueur Steam. Les interactions ShenPulse de ce pack sont prévues pour une partie solo."
    ],
    sources: [{label:"Installation officielle tModLoader et partage familial",url:"https://github.com/tModLoader/tModLoader/wiki/tModLoader-guide-for-players"}]
  }
});

function integratedGuide(summary, steps) {
  return {
    mode: "integrated",
    summary,
    steps,
    notes: ["Aucun fichier n’est copié dans un jeu tiers."],
    sources: []
  };
}

function minecraftGuide(summary) {
  return {
    mode: "server",
    summary,
    steps: [
      "Installe Java 17 ou une version compatible avec le serveur.",
      "Prépare le monde, server.properties et les plugins du pack.",
      "Démarre le serveur local et rejoins 127.0.0.1 dans Minecraft.",
      "Vérifie la passerelle, active les interactions et teste un effet."
    ],
    notes: [
      "Conserve ShenPulse et le serveur ouverts pendant le LIVE.",
      "Le port du serveur et celui de la passerelle doivent rester disponibles."
    ],
    sources: []
  };
}

function managedMinecraftGuide(summary, sources = []) {
  return {
    mode: "server",
    summary,
    steps: [
      "Clique sur Installer et accepte le CLUF Minecraft.",
      "Laisse ShenPulse installer Java 21, PaperMC, le monde et les plugins.",
      "Attends que le serveur local soit prêt sur 127.0.0.1.",
      "Ouvre Minecraft, rejoins 127.0.0.1 et active les interactions."
    ],
    notes: [
      "Aucun dossier serveur ni Java déjà installé n’est nécessaire.",
      "Conserve ShenPulse ouvert pendant le LIVE."
    ],
    sources
  };
}

function modGuide(summary) {
  return {
    mode: "native",
    summary,
    steps: [
      "Ferme le jeu avant de modifier son dossier.",
      "Sélectionne ou détecte le dossier d’installation.",
      "Installe le mod et sa passerelle locale en conservant une sauvegarde.",
      "Lance le jeu, charge une partie et teste un effet."
    ],
    notes: [
      "La version du mod doit correspondre à la version installée du jeu.",
      "Retire les autres mods pour le premier test si un conflit apparaît."
    ],
    sources: []
  };
}

function buildGameGuide(entry, effects) {
  if(entry.ownerPreparation && entry.guide)return structuredClone(entry.guide);
  if(entry.connector?.type==="shen-native")return {mode:"native",summary:"Jeu autonome ShenPulse. Aucun autre logiciel n’est nécessaire pour recevoir les interactions.",steps:["Cliquez sur Installer automatiquement : ShenPulse télécharge le jeu et prépare sa connexion locale.","Choisissez les cadeaux et les effets, puis installez la scène dans votre studio.","Cliquez sur Lancer le jeu, puis sur Jouer dans son menu. Gardez ShenPulse ouvert pendant le LIVE."],notes:["Les actions s’appliquent pendant une manche. Les personnages portent le nom du viewer qui déclenche leur arrivée.","Les réglages, sauvegardes et clés locales restent propres à votre installation ShenPulse."]};
  const specialized = GAME_GUIDES[entry.id];
  if (specialized) return structuredClone(specialized);
  const sources = (EXTERNAL_GUIDE_URLS[entry.id] || []).map((url) => ({
    label: url.includes("streamtoearn.io")
      ? "Référence de compatibilité StreamToEarn"
      : "Documentation technique du pack",
    url
  }));
  const native = effects.some((effect) => effect.available);
  const compatibilityNotes = {
    "hollow-knight": "Le patch actuel peut être incompatible : utilise la branche historique prise en charge.",
    "supermarket-simulator": "La mise à jour coopérative actuelle peut nécessiter une ancienne version prise en charge.",
    hades: "La version Microsoft Store/Game Pass peut limiter les mods : valide le pack localement.",
    "vampire-survivors": "Cette intégration cible une ancienne version du jeu.",
  };
  return {
    mode: native ? "native" : "reference",
    summary: native
      ? `ShenPulse pilote le pack local de ${entry.name} par la passerelle de jeu.`
      : `La fiche reprend les interactions référencées pour ${entry.name} ; les éléments visuels restent signalés tant qu’aucun pack local exécutable n’est installé.`,
    steps: native ? [
      "Installe le jeu depuis sa boutique officielle et lance-le une première fois.",
      "Ouvre ShenPulse, sélectionne le jeu puis configure ou détecte sa passerelle locale.",
      "Installe le module ShenPulse compatible avec la version exacte du jeu.",
      "Charge une sauvegarde jouable et teste plusieurs interactions avant le LIVE."
    ] : [
      "Cette fiche permet de consulter les interactions de référence.",
      "Le module autonome ShenPulse de ce jeu n’est pas encore disponible.",
      "Les interactions restent désactivées jusqu’à la disponibilité de cette intégration."
    ],
    notes: [
      compatibilityNotes[entry.id] ||
        "Désactive les autres mods pour le premier test et conserve une sauvegarde des fichiers remplacés.",
      native
        ? "Les interactions marquées Natif peuvent être envoyées à la passerelle locale."
        : "Les interactions marquées Référence ne déclenchent aucun code tant qu’un pack natif n’est pas disponible."
    ],
    sources
  };
}

module.exports = { EXTERNAL_GUIDE_URLS, GAME_GUIDES, integratedGuide, minecraftGuide, managedMinecraftGuide, modGuide, buildGameGuide };

