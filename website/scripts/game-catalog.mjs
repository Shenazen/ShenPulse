import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = path.resolve(websiteRoot, '..')
const { loadShenazenGameCatalog } = require(path.join(projectRoot, 'src/main/game-catalog.js'))

const MINECRAFT_MODE_IDS = [
  'minecraft-bedrock-box',
  'minecraft-lavarise',
  'minecraft-sandbox-3',
  'minecraft-survival-plugin'
]

const PUBLIC_GAME_GUIDES = {
  "gtav-koth-enhanced": {"description":"Un parcours vertical dans le mode Histoire de GTA V Enhanced : atteignez le cercle au sommet avant la fin du chrono et résistez aux obstacles lancés par les spectateurs. Les victoires, défaites et réglages de la rampe sont gérés depuis ShenPulse.","interactions":"Le public déclenche des véhicules, des obstacles, des événements et des changements du personnage. Les cadeaux de wins restent séparés des effets de jeu et disposent de leurs propres sources de diffusion."},
  "gtav-hiking-enhanced": {"description":"Une randonnée interactive dans le mode Histoire de GTA V Enhanced, avec trente points de contrôle sur le Mont Chiliad. Préparez le parcours puis laissez votre communauté faciliter la progression ou compliquer l’ascension.","interactions":"Les effets agissent sur les déplacements, le personnage, les véhicules et les événements du parcours. Les réglages et les associations de cadeaux sont conservés séparément des autres modes GTA."},
  "hogwarts-legacy": {"description":"Une aventure Hogwarts Legacy rendue interactive : vos spectateurs influencent la magie, les ressources et les rencontres pendant une sauvegarde jouable. L’installation guidée permet de choisir l’édition compatible présente sur le PC.","interactions":"Les effets couvrent les ressources, les sorts, la météo, les créatures, les ennemis et plusieurs modifications temporaires. Les prérequis et les limites de chaque effet sont présentés dans la fiche du jeu."},
  "tcg-card-shop-simulator": {"description":"Transformez votre boutique TCG Card Shop Simulator en expérience participative : la communauté peut attirer des clients, aider les finances ou provoquer des imprévus. ShenPulse installe le module et prépare la connexion locale.","interactions":"Les interactions portent sur les clients, leurs noms de viewers, les employés, l’argent, les rayons, les cartons, la caméra et les effets temporaires. Les cadeaux et les sons se règlent depuis la fiche du jeu."},
  "shift-at-midnight": {"description":"Un service de nuit dans Shift At Midnight rythmé par les réactions du LIVE. Les spectateurs peuvent faire venir des clients, modifier les ressources ou provoquer des surprises pendant que le joueur garde le contrôle de sa partie.","interactions":"Les effets concernent les clients humains et leurs sosies, les créatures, les ressources et plusieurs événements de la nuit. ShenPulse conserve les associations et transmet les demandes à son module local."},
  "shenfarm": {"description":"Une ferme interactive dans laquelle la communauté protège les cultures ou provoque des événements imprévus. ShenFarm s’installe et se lance depuis ShenPulse, avec des réglages de cadeaux adaptés au profil du créateur.","interactions":"Les effets font intervenir des lutins, des animaux, la météo et différents événements de la ferme. Choisissez les aides, les pièges et les sons avant de démarrer la session de jeu."},
  "shenpaint": {"description":"Une expérience de peinture interactive dans laquelle les spectateurs peuvent transformer le décor et influencer la partie. ShenPaint dispose de son installation et de sa connexion propres à ShenPulse.","interactions":"Les interactions font intervenir les artistes, les créatures, les armes de peinture et les événements colorés. La fiche conserve les cadeaux choisis et les paramètres de chaque effet pour votre session."},
  "splash-bombes": {"description":"Une arène de bombes et de peinture à jouer en solo contre le robot ou à deux sur le même écran. Splash Bombes est installé et lancé depuis ShenPulse pour permettre à la communauté de participer aux événements de la partie.","interactions":"Les cadeaux déclenchent des événements dans l’arène et modifient les conditions de jeu. Les effets disponibles, leurs paramètres et les associations de cadeaux sont regroupés dans la fiche ShenPulse."},
  "shenkite": {"description":"Une bataille de cerfs-volants dans laquelle les spectateurs rejoignent les pilotes et influencent le déroulement du combat. ShenKite se prépare depuis sa fiche ShenPulse, avec ses réglages et ses interactions propres.","interactions":"Les effets ajoutent des participants et interviennent sur les conditions de la bataille. Préparez les cadeaux et les aides ou pièges souhaités avant de lancer votre session interactive."},
  unturned: {
    description: 'Transformez votre survie Unturned en partie interactive : les spectateurs influencent les zombies, animaux, véhicules, objets, statistiques de survie et météo. ShenPulse installe son module autonome pour le mode solo sans BattlEye.',
    interactions: 'Les 27 interactions couvrent les apparitions, les cadeaux d’objets, la vie, la nourriture, l’eau, l’immunité, l’endurance, l’oxygène, l’expérience, les largages aériens, l’inventaire, les projections et les explosions.'
  },
  'the-mortuary-assistant': {
    description: 'Transformez le service de nuit de Rebecca en expérience interactive : vos spectateurs influencent l’embaumement, les hantises et la possession. ShenPulse installe le mod et communique directement avec le jeu sur votre PC. Jeu complet Steam requis.',
    interactions: 'Les 22 interactions permettent notamment de révéler les indices du démon, préparer le mélange, modifier la vitesse de déplacement, inverser les commandes, éteindre les lumières et contrôler la progression de la possession.'
  },
  thiercelieux: {
    description: 'Un jeu social de rôles cachés pour 3 à 8 participants, pensé pour faire entrer les spectateurs dans une partie animée en direct. ShenPulse gère la file d’attente, la distribution privée des rôles, les phases de jeu et les pronostics.',
    interactions: 'Le public peut ouvrir ou fermer les inscriptions, prolonger une phase et déclencher un hurlement. Le maître du jeu conserve la main sur le rythme, les rôles et la progression de la partie.'
  },
  'coin-pusher': {
    description: 'Une machine à pièces virtuelle conçue pour les lives : chaque participation peut ajouter des pièces, provoquer une poussée ou modifier temporairement le plateau. Les gains et multiplicateurs donnent un objectif immédiatement lisible aux spectateurs.',
    interactions: 'Les six interactions couvrent la pluie de pièces, le poussoir, les lots mystère, les multiplicateurs, le ralentissement et la remise à zéro d’une manche.'
  },
  'connect-four': {
    description: 'Une version interactive du Puissance 4 dans laquelle les spectateurs rejoignent une équipe et influencent directement la grille. La taille du plateau et la condition de victoire sont configurables avant la partie.',
    interactions: 'Les cadeaux peuvent déposer un jeton rouge ou jaune, viser une colonne aléatoire, bloquer une colonne, retirer un jeton ou relancer une manche.'
  },
  'deal-or-no-deal': {
    description: 'Un jeu de boîtes et de négociation animé depuis ShenPulse. Le créateur règle les valeurs, le prix d’entrée et le comportement du banquier avant d’ouvrir la fenêtre de jeu destinée au direct.',
    interactions: 'Les spectateurs peuvent ouvrir une boîte, provoquer une offre, accepter ou refuser la proposition du banquier et déclencher une boîte premium.'
  },
  'diamond-bridge': {
    description: 'Un défi de progression sur un pont où les participants avancent, reculent et collectent des diamants sous l’influence du live. La file des joueurs et le cadeau d’entrée sont pilotés dans ShenPulse.',
    interactions: 'Les cinq commandes permettent d’avancer, de reculer, d’ajouter ou retirer un diamant et de poser un piège sur le parcours.'
  },
  'diamond-drop': {
    description: 'Un jeu d’adresse vertical où des diamants traversent un plateau rempli d’obstacles avant d’atteindre les zones de gain. Les multiplicateurs et les événements spéciaux renouvellent chaque manche.',
    interactions: 'Le public peut lâcher un diamant, lancer une pluie de diamants, poser une bombe, activer un multiplicateur ou nettoyer le plateau.'
  },
  'color-strike': {
    description: 'Un jeu d’action coloré installé et lancé directement par ShenPulse. Les spectateurs peuvent soutenir ou perturber la partie pendant que le joueur affronte les vagues et change d’arme ou de carte.',
    interactions: 'Les 41 effets couvrent les bombes, tourelles, armes, boosts, changements de carte, contraintes visuelles, boss et compteurs de victoires.'
  },
  'tiklive-climb': {
    description: 'Un jeu d’ascension interactif où chaque réaction du live peut faciliter la progression ou rendre le parcours plus instable. ShenPulse installe le jeu, le lance et relie sa passerelle locale.',
    interactions: 'Les 18 effets ajoutent des obstacles et des aides, modifient la gravité ou les commandes, pilotent les victoires et déclenchent la roue native.'
  },
  'tiklive-cube-wars': {
    description: 'Une bataille en arène opposant les camps Hommes et Femmes, auxquels les spectateurs peuvent se rallier depuis le chat. ShenPulse gère l’installation, le lancement et les événements de la manche.',
    interactions: 'Les 18 effets permettent de choisir un camp, pousser les cubes, lancer des vagues, bombes, tornades ou météores, puis suivre les victoires.'
  },
  'tiklive-stack-tower': {
    description: 'Un défi de construction où le joueur tente d’empiler jusqu’à 500 étages pendant que le live stabilise ou sabote la tour. Le jeu autonome est installé et lancé depuis ShenPulse.',
    interactions: 'Les 28 effets ajoutent ou retirent des étages, modifient la grue et la physique, déclenchent des événements et pilotent la roue ou les victoires.'
  },
  'clash-of-live': {
    description: 'Un affrontement autonome entre une armée rouge et une armée bleue, conçu pour être animé directement par les spectateurs. ShenPulse installe le jeu et transmet les renforts à sa passerelle locale.',
    interactions: 'Les 15 effets invoquent squelettes, chevaliers, barbares, géants ou dragons, soignent les tours et lancent une roue pour le camp choisi.'
  },
  'rocket-league': {
    description: 'Un profil d’interactions ciblées pour Rocket League qui agit uniquement sur la fenêtre du jeu sans modifier ses fichiers. Les commandes sont adaptées aux dispositions WASD et ZQSD.',
    interactions: 'Les 21 effets couvrent l’accélération, le freinage, les sauts, le turbo, les rotations, les dérapages, la caméra ballon et plusieurs enchaînements de conduite.'
  },
  'pokemon-red-blue': {
    description: 'Une aventure Pokémon Rouge/Bleu préparée automatiquement dans BizHawk, avec une passerelle locale qui transforme les événements du live en changements immédiats dans la partie. L’installation, la vérification et le lancement sont guidés par ShenPulse.',
    interactions: 'Les 313 effets couvrent notamment les PV, les statuts, l’équipe, les rencontres, les objets, les combats, l’évolution et de nombreux paramètres de progression.'
  },
  'super-mario-kart': {
    description: 'La version Super Nintendo de Super Mario Kart exécutée dans BizHawk avec son pack interactif configuré par ShenPulse. Une course peut évoluer en direct sans quitter l’application ni préparer manuellement la passerelle.',
    interactions: 'Les 87 effets modifient les tours, la musique, les objets, la vitesse, les commandes, le pilote et différentes conditions de course.'
  },
  demonologist: {
    description: 'Un profil d’interactions pour Demonologist qui agit sur la fenêtre du jeu au moyen de commandes clavier et souris ciblées. Il est adapté aux séquences de tension où le public perturbe les déplacements et les réflexes du joueur.',
    interactions: 'Les 31 effets simulent des mouvements, des interactions, des changements d’équipement, des ouvertures de journal et plusieurs enchaînements destinés à désorienter le joueur.'
  },
  'euro-truck-simulator-2': {
    description: 'Une intégration locale pour Euro Truck Simulator 2 qui permet au live de modifier le camion et les conditions de conduite. ShenPulse installe le plugin nécessaire, prépare le port local et envoie les effets pendant que le jeu reste ouvert.',
    interactions: 'Les 30 effets agissent sur l’éclairage, les commandes du camion, la boîte de vitesses, le régulateur, les freins, l’heure et divers incidents de conduite.'
  },
  'resident-evil-3': {
    description: 'Une intégration pour Resident Evil 3 qui applique les événements du live à la partie en cours grâce à une passerelle locale. L’installation guidée prépare les composants requis et conserve une sauvegarde des fichiers remplacés.',
    interactions: 'Les 67 effets peuvent modifier la santé du joueur ou des ennemis, donner des objets, agir sur l’inventaire et provoquer plusieurs événements de survie.'
  },
  'gtav-montchiliad': {
    description: 'Un scénario interactif pour GTA V centré sur le Mont Chiliad et les situations imprévisibles provoquées par le public. ShenPulse prépare les fichiers, lance le jeu et transmet les effets à la partie locale.',
    interactions: 'Les 66 effets couvrent les téléportations, le niveau de recherche, les véhicules, les explosions, les armes, l’heure, l’invincibilité et les comportements des passants.'
  },
  minecraft: {
    description: 'Quatre expériences Minecraft réunies dans une seule fiche : Bedrock Box, Lava Rise, SandBox 3 et Survival. ShenPulse prépare le Java portable adapté, le serveur PaperMC, le monde et les plugins nécessaires au mode choisi.',
    interactions: 'Chaque mode possède ses interactions autour des blocs, des créatures, des objectifs et des compteurs. Dans Lava Rise, le public influence aussi la lave, les plateformes, les déplacements et les effets temporaires pendant l’ascension.'
  },
  'cult-of-the-lamb': {
    description: 'Une partie de Cult of the Lamb reliée à ShenPulse par un mod local. Les réactions du live peuvent aider le joueur, compliquer un combat ou faire évoluer les ressources et les fidèles du culte.',
    interactions: 'Les 32 effets touchent la vie, l’invincibilité, les ennemis, la vitesse du jeu, les armes, les ressources et l’arrivée de nouveaux fidèles.'
  },
  'stardew-valley': {
    description: 'Une ferme Stardew Valley rendue interactive grâce à une passerelle locale installée par ShenPulse. Les événements peuvent bouleverser une journée de jeu, aider le fermier ou ajouter des contraintes inattendues.',
    interactions: 'Les 28 effets couvrent les monstres, les objets, la téléportation, les états temporaires, la santé et plusieurs modifications de l’environnement.'
  },
  terraria: {
    description: 'Une partie Terraria enrichie par un mod local et pilotée depuis ShenPulse. Le public peut transformer l’exploration ou un combat en déclenchant des créatures, des pièges et des événements spéciaux.',
    interactions: 'Les 25 effets comprennent des boss, des pièges, des téléportations, des apparitions de personnages, des essaims et des changements de santé.'
  },
  'blue-prince': {
    description: 'Une fiche interactive pour Blue Prince qui agit sur les ressources et les paramètres de l’exploration en cours. Elle est conçue pour faire varier les choix du joueur au fil de la construction du manoir.',
    interactions: 'Les 69 effets modifient notamment les pièces, les dés, les gemmes, les ressources et différents états liés à la progression.'
  },
  'hollow-knight-silksong': {
    description: 'Une intégration locale pour Hollow Knight: Silksong qui permet au live d’influencer l’exploration et les combats. Les effets sont envoyés à la passerelle du jeu pendant une sauvegarde jouable.',
    interactions: 'Les 56 effets portent sur la santé, les ressources, les états du personnage, les ennemis et plusieurs contraintes de déplacement ou de combat.'
  },
  'hollow-knight': {
    description: 'Une intégration pour Hollow Knight destinée à transformer les réactions du public en dangers, aides et événements dans Hallownest. Elle s’utilise sur une sauvegarde chargée avec la passerelle locale active.',
    interactions: 'Les 27 effets font apparaître des ennemis ou des obstacles, modifient des ressources et déclenchent plusieurs événements liés aux boss et à l’exploration.'
  },
  'supermarket-simulator': {
    description: 'Une fiche interactive pour Supermarket Simulator qui laisse le public intervenir dans la gestion quotidienne du magasin. Les effets peuvent soutenir l’activité ou perturber le fonctionnement de la boutique.',
    interactions: 'Les 36 effets agissent sur l’argent, les horaires d’ouverture, l’éclairage, les stocks et différents paramètres de gestion.'
  },
  'egging-on': {
    description: 'Une intégration pour Egging On qui modifie la physique et les capacités de l’œuf pendant sa progression. Elle convient aux défis où chaque réaction du live peut sauver ou compromettre une tentative.',
    interactions: 'Les 37 effets changent la vitesse, la taille, l’état de l’œuf, les réparations et plusieurs paramètres utiles au parcours.'
  },
  balatro: {
    description: 'Un jeu de stratégie inspiré du poker où les jokers, les améliorations et les multiplicateurs permettent de construire des scores de plus en plus élevés. La fiche publique décrit les familles d’interactions envisagées pour une partie en direct.',
    interactions: 'Les catégories documentées concernent l’aide, le chaos, le contrôle, la progression, le sabotage et les fonctions utilitaires. Elles restent informatives tant qu’aucun pack local exécutable n’est installé.'
  },
  celeste: {
    description: 'Un jeu de plateforme exigeant centré sur l’ascension de la montagne Celeste, avec des mouvements précis et des écrans courts à maîtriser. La fiche présente les possibilités d’interaction associées au jeu.',
    interactions: 'Les catégories documentées couvrent l’assistance, les perturbations, le contrôle, la progression et les événements de parcours. Elles ne déclenchent pas encore d’effet depuis ShenPulse.'
  },
  'dead-by-daylight': {
    description: 'Un jeu multijoueur asymétrique opposant un tueur à quatre survivants dans des parties de poursuite et de coopération. La fiche publique rassemble les familles d’interactions compatibles recensées pour le direct.',
    interactions: 'Les catégories décrivent des aides, handicaps, événements de poursuite et modifications de progression. Elles sont affichées comme référence et ne sont pas exécutées par ShenPulse.'
  },
  'deep-rock-galactic': {
    description: 'Un jeu coopératif d’exploration minière où une équipe de nains affronte des vagues de créatures dans des grottes procédurales. La fiche décrit les types d’événements interactifs associés aux missions.',
    interactions: 'Les catégories référencées portent sur les ennemis, les ressources, l’équipement, les états de l’équipe et les événements de mission. Aucun effet local n’est encore actif.'
  },
  dredge: {
    description: 'Une aventure de pêche et d’exploration maritime où le temps, l’état du bateau et la santé mentale influencent chaque sortie. Le live peut intervenir dans la navigation et la survie du joueur.',
    interactions: 'Les 53 effets agissent sur la coque, la santé mentale, l’argent, le temps, l’inventaire, la pêche et plusieurs dangers rencontrés en mer.'
  },
  'fallout-4': {
    description: 'Un jeu de rôle en monde ouvert situé dans un Commonwealth post-apocalyptique, mêlant exploration, combats, équipement et construction. La fiche présente les familles d’interactions recensées pour le jeu.',
    interactions: 'Les catégories documentées concernent le joueur, les ressources, les ennemis, l’équipement et le monde. Elles restent des références tant qu’aucune passerelle locale compatible n’est installée.'
  },
  hades: {
    description: 'Un jeu d’action où Zagreus tente de s’échapper des Enfers au fil de combats rapides et de tentatives successives. Les réactions du live peuvent modifier les ressources, les combats et le déroulement d’une fuite.',
    interactions: 'Les 36 effets touchent la santé, la jauge divine, les compagnons, les récompenses, les ennemis et plusieurs événements de salle.'
  },
  inscryption: {
    description: 'Un jeu de cartes narratif mêlant construction de deck, sacrifices, énigmes et affrontements. L’intégration permet au public de peser sur les ressources et l’équilibre d’une partie.',
    interactions: 'Les 52 effets modifient les points de vie, la balance, les os, les cartes, les ressources et différentes conditions de victoire ou de défaite.'
  },
  'no-mans-sky': {
    description: 'Un jeu d’exploration spatiale dans lequel le joueur voyage entre planètes, collecte des ressources et améliore son équipement. La fiche publique décrit les interactions recensées pour les sessions en direct.',
    interactions: 'Les catégories documentées concernent la survie, les ressources, les alertes, le vaisseau et l’environnement planétaire. Elles ne sont pas encore exécutables depuis ShenPulse.'
  },
  palworld: {
    description: 'Un jeu de survie et de collection de créatures dans un monde ouvert, avec exploration, construction et combats. Les interactions permettent au public d’altérer directement le personnage et certains événements de la partie.',
    interactions: 'Les 74 effets modifient la vitesse, la taille, les états, les apparitions, les ressources et plusieurs paramètres de survie.'
  },
  'resident-evil-7-biohazard': {
    description: 'Un jeu de survie horrifique en vue subjective où les ressources et la santé doivent être gérées avec prudence. Le live peut intervenir sur le joueur, les ennemis et l’inventaire pendant une partie jouable.',
    interactions: 'Les 31 effets agissent sur les points de vie, les ennemis, les soins, les objets, les armes et différents états de survie.'
  },
  'vampire-survivors': {
    description: 'Un jeu d’action automatique fondé sur des vagues d’ennemis, la montée en puissance du personnage et des parties courtes. La fiche décrit les familles d’événements interactifs associées au jeu.',
    interactions: 'Les catégories référencées portent sur les ennemis, les statistiques, les objets, l’expérience et le rythme des vagues. Elles sont informatives et non exécutables dans l’état actuel.'
  },
  'ark-survival-ascended': {
    description: 'Un jeu de survie en monde ouvert où le joueur récolte, construit et apprivoise des créatures préhistoriques. La fiche publique rassemble les possibilités d’interaction recensées pour une session en direct.',
    interactions: 'Les catégories documentées couvrent les dinosaures, les ressources, la météo, les besoins du personnage et les événements du monde. Elles restent des références.'
  },
  'cities-skylines': {
    description: 'Un jeu de gestion urbaine consacré à la construction, aux services publics, à l’économie et aux besoins des habitants. La fiche présente les familles d’interactions pouvant influencer une ville en direct.',
    interactions: 'Les catégories référencées concernent l’argent, les services, la circulation, les citoyens, les catastrophes et la progression. Aucun effet n’est encore exécuté par ShenPulse.'
  },
  'crash-bandicoot-n-sane-trilogy': {
    description: 'Une compilation de jeux de plateforme où Crash traverse des niveaux remplis de caisses, de pièges et de passages chronométrés. ShenPulse installe automatiquement son pont local pour la version Steam Windows.',
    interactions: '26 interactions exécutables : vies, fruits Wumpa, caisses, sauts, vitesse, lumière, caméra, couleurs et taille du personnage. Les effets temporaires sont restaurés à expiration et à la déconnexion.'
  },
  'kingdom-come-deliverance-2': {
    description: 'Un jeu de rôle historique en monde ouvert où la santé, l’énergie, la nourriture, l’argent et la réputation structurent la progression. La passerelle locale permet au live de modifier ces paramètres pendant la partie.',
    interactions: 'Les 63 effets agissent sur la santé, l’endurance, la satiété, les groschen, les états du personnage et plusieurs éléments de progression.'
  },
  'deep-rock-galactic-survivor': {
    description: 'Un jeu d’action et de survie en solo où le joueur mine, améliore son équipement et résiste à des vagues de créatures. La fiche publique présente les interactions recensées pour influencer une mission.',
    interactions: 'Les 31 interactions de référence couvrent les apparitions d’ennemis, les objets, l’expérience, les dégâts, les ressources et plusieurs événements de combat.'
  },
  'hades-ii': {
    description: 'Un jeu d’action mythologique construit autour de tentatives successives, de pouvoirs divins et de combats rapides. La fiche publique décrit les interactions recensées pour agir sur une fuite.',
    interactions: 'Les 18 interactions de référence portent sur la santé, la magie, l’argent, les ennemis, les transformations et différents événements de combat.'
  },
  'wobbly-life': {
    description: 'Un jeu bac à sable ouvert centré sur les activités, les véhicules, les petits métiers et l’exploration. La fiche présente les événements interactifs recensés pour animer une session avec le public.',
    interactions: 'Les 21 interactions de référence concernent les animaux, les véhicules, l’argent, la météo, la gravité, les missions, l’apparence et le cycle jour-nuit.'
  }
}

const HIDDEN_PROVIDER_PATTERN = new RegExp(`${'crowd'}\\s*${'control'}`, 'gi')

export function currentPublicGames() {
  const packs = loadShenazenGameCatalog(path.join(projectRoot, 'resources'))
  return buildPublicGames(packs)
}

export function buildPublicGames(packs = []) {
  const visible = packs.filter((pack) => pack?.id && pack.ownerOnly !== true)
  const minecraftModes = visible.filter((pack) => MINECRAFT_MODE_IDS.includes(pack.id))
  const firstMinecraftIndex = visible.findIndex((pack) => MINECRAFT_MODE_IDS.includes(pack.id))

  return visible.flatMap((pack, index) => {
    if (!MINECRAFT_MODE_IDS.includes(pack.id)) return [publicGame(pack)]
    if (index !== firstMinecraftIndex) return []
    return [publicMinecraftGame(minecraftModes)]
  })
}

export function serializePublicGames(games) {
  return `export const GAMES = ${JSON.stringify(games, null, 2)}\n`
}

function publicMinecraftGame(modes) {
  const interactions = modes.reduce(
    (total, pack) => total + (Array.isArray(pack.effects) ? pack.effects.length : 0),
    0
  )
  const executableInteractions = modes.reduce(
    (total, pack) => total + executableEffectCount(pack),
    0
  )

  const guide = publicGuide('minecraft')
  return {
    id: 'minecraft',
    name: 'Minecraft',
    type: `Serveur géré · ${modes.length} modes`,
    interactions,
    executableInteractions,
    status: executableInteractions > 0 ? 'Exécutable' : 'Référence',
    description: guide.description,
    interactionGuide: guide.interactions,
    requirements: 'Minecraft Java est requis : version 1.21 pour Bedrock Box, SandBox 3 et Survival, et 26.1.2 pour Lava Rise. ShenPulse installe le Java portable adapté, PaperMC, le monde et les plugins du mode choisi.',
    steps: [
      'Choisir Bedrock Box, Lava Rise, SandBox 3 ou Survival dans la fiche Minecraft.',
      'Cliquer sur Installer, puis accepter le CLUF Minecraft.',
      'Laisser ShenPulse préparer le Java portable adapté, PaperMC, le monde et les plugins du mode choisi.',
      'Ouvrir la version Minecraft Java indiquée, rejoindre le serveur local du mode choisi, puis tester les interactions.'
    ],
    note: modes
      .map((pack) => `${pack.name} : ${pack.effects.length} interactions`)
      .join(' · ')
  }
}

function publicGame(pack) {
  const interactions = Array.isArray(pack.effects) ? pack.effects.length : 0
  const executableInteractions = executableEffectCount(pack)
  const notes = Array.isArray(pack.guide?.notes) ? pack.guide.notes : []
  const status = executableInteractions > 0 ? 'Exécutable' : 'Référence'
  const guide = publicGuide(pack.id)

  return {
    id: String(pack.id),
    name: publicText(pack.name),
    type: publicGameType(pack),
    interactions,
    executableInteractions,
    status,
    description: guide.description,
    interactionGuide: guide.interactions,
    requirements: publicRequirements(pack, status),
    steps: Array.isArray(pack.guide?.steps) ? pack.guide.steps.map(publicText) : [],
    note: notes.map(publicText).join(' ')
  }
}

function publicGuide(id) {
  const guide = PUBLIC_GAME_GUIDES[id]
  if (!guide?.description || !guide?.interactions) {
    throw new Error(`Description publique manquante pour le jeu ${id}`)
  }
  return guide
}

function publicRequirements(pack, status) {
  if (status === 'Référence') {
    return 'Cette fiche est visible pour documenter la compatibilité recensée. Aucun effet n’est exécuté tant qu’une passerelle locale compatible n’est pas disponible dans ShenPulse.'
  }

  const mode = pack.guide?.mode
  if (mode === 'integrated') {
    return 'Le jeu est inclus dans ShenPulse : aucun logiciel, mod ou serveur tiers n’est nécessaire.'
  }
  if (mode === 'emulator') {
    return 'ShenPulse prépare BizHawk, vérifie les fichiers du jeu et démarre la passerelle locale. Garde l’émulateur et ShenPulse ouverts pendant le live.'
  }
  if (mode === 'input') {
    return 'Le jeu doit être lancé dans sa fenêtre avec les commandes attendues. ShenPulse cible uniquement cette fenêtre pour envoyer les séquences configurées.'
  }
  if (mode === 'server') {
    return 'Le serveur local doit être installé et démarré depuis ShenPulse avant de rejoindre l’adresse indiquée dans la fiche du jeu.'
  }
  if (String(mode || '').endsWith('-mod')) {
    return 'Le jeu doit être installé et fermé pendant la préparation du plugin. Lance ensuite le jeu normalement et conserve la passerelle locale active.'
  }
  if (mode === 'native') {
    return pack.installerVersion
      ? 'Le jeu doit être installé et fermé pendant la préparation. ShenPulse sauvegarde les fichiers concernés puis installe la passerelle compatible.'
      : 'Le jeu et son pack compatible doivent être installés. Charge une sauvegarde jouable avant de démarrer la passerelle et de tester les effets.'
  }
  return 'Le jeu doit être installé et ouvert sur une partie jouable avec sa passerelle locale active.'
}

function publicText(value) {
  return String(value || '')
    .replace(HIDDEN_PROVIDER_PATTERN, 'le connecteur local')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function executableEffectCount(pack) {
  return (Array.isArray(pack.effects) ? pack.effects : []).filter(
    (effect) => effect?.available !== false
  ).length
}

function publicGameType(pack) {
  const types = {
    integrated: 'Intégré',
    emulator: 'Émulation gérée',
    input: 'Contrôles ciblés',
    server: 'Serveur géré',
    reference: 'Référence documentée'
  }
  if (types[pack.guide?.mode]) return types[pack.guide.mode]
  if (String(pack.guide?.mode || '').endsWith('-mod')) return 'Mod géré'
  if (pack.guide?.mode === 'native') {
    return pack.installerVersion ? 'Installation gérée' : 'Passerelle locale'
  }
  return pack.connector?.type === 'demo' ? 'Référence documentée' : 'Passerelle locale'
}
