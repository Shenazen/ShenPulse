"use strict";

/** Catalogue de jeux : domaine « internal-games », données et identifiants conservés. */
const { GTAV_MONT_CHILIAD_DEFAULT_MAPPINGS, GTAV_MONT_CHILIAD_EFFECTS, GTAV_MONT_CHILIAD_INTERACTION_CATALOG_VERSION } = require("../gtav-mont-chiliad-catalog");
const { CULT_OF_THE_LAMB_DEFAULT_MAPPINGS, CULT_OF_THE_LAMB_EFFECTS, CULT_OF_THE_LAMB_INTERACTION_CATALOG_VERSION } = require("../cult-of-the-lamb-catalog");
const { STARDEW_VALLEY_DEFAULT_MAPPINGS, STARDEW_VALLEY_EFFECTS, STARDEW_VALLEY_INTERACTION_CATALOG_VERSION } = require("../stardew-valley-catalog");
const { TERRARIA_DEFAULT_MAPPINGS, TERRARIA_EFFECTS, TERRARIA_INTERACTION_CATALOG_VERSION } = require("../terraria-catalog");
const { MINECRAFT_BEDROCK_DEFAULT_MAPPINGS, MINECRAFT_BEDROCK_EFFECTS, MINECRAFT_BEDROCK_INTERACTION_CATALOG_VERSION, MINECRAFT_SANDBOX_DEFAULT_MAPPINGS, MINECRAFT_SANDBOX_EFFECTS, MINECRAFT_SANDBOX_INTERACTION_CATALOG_VERSION, MINECRAFT_SURVIVAL_DEFAULT_MAPPINGS, MINECRAFT_SURVIVAL_EFFECTS, MINECRAFT_SURVIVAL_INTERACTION_CATALOG_VERSION } = require("../minecraft-game-catalog");
const { FORTNITE_DEFAULT_MAPPINGS, FORTNITE_EFFECTS, FORTNITE_INTERACTION_CATALOG_VERSION } = require("../fortnite-catalog");
const { ROCKET_LEAGUE_DEFAULT_MAPPINGS, ROCKET_LEAGUE_EFFECTS, ROCKET_LEAGUE_INTERACTION_CATALOG_VERSION } = require("../rocket-league-catalog");
const { COLOR_STRIKE_CONNECTOR, COLOR_STRIKE_DEPRECATED_DEFAULT_MAPPING_IDS, COLOR_STRIKE_DEFAULT_MAPPINGS, COLOR_STRIKE_EFFECTS, COLOR_STRIKE_INTERACTION_CATALOG_VERSION, COLOR_STRIKE_WHEEL_PRESETS } = require("../color-strike-catalog");
const { TIKLIVE_CLIMB_CONNECTOR, TIKLIVE_CLIMB_DEPRECATED_DEFAULT_MAPPING_IDS, TIKLIVE_CLIMB_DEFAULT_MAPPINGS, TIKLIVE_CLIMB_EFFECTS, TIKLIVE_CLIMB_INTERACTION_CATALOG_VERSION, TIKLIVE_CLIMB_WHEEL_PRESETS } = require("../tiklive-climb-catalog");
const { TIKLIVE_CUBE_WARS_CONNECTOR, TIKLIVE_CUBE_WARS_DEPRECATED_DEFAULT_MAPPING_IDS, TIKLIVE_CUBE_WARS_DEFAULT_MAPPINGS, TIKLIVE_CUBE_WARS_EFFECTS, TIKLIVE_CUBE_WARS_INTERACTION_CATALOG_VERSION, TIKLIVE_CUBE_WARS_WHEEL_PRESETS } = require("../tiklive-cube-wars-catalog");
const { TIKLIVE_STACK_TOWER_CONNECTOR, TIKLIVE_STACK_TOWER_DEPRECATED_DEFAULT_MAPPING_IDS, TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS, TIKLIVE_STACK_TOWER_EFFECTS, TIKLIVE_STACK_TOWER_INTERACTION_CATALOG_VERSION, TIKLIVE_STACK_TOWER_WHEEL_PRESETS } = require("../tiklive-stack-tower-catalog");
const { CLASH_OF_LIVE_CONNECTOR, CLASH_OF_LIVE_DEPRECATED_DEFAULT_MAPPING_IDS, CLASH_OF_LIVE_DEFAULT_MAPPINGS, CLASH_OF_LIVE_EFFECTS, CLASH_OF_LIVE_INTERACTION_CATALOG_VERSION, CLASH_OF_LIVE_WHEEL_PRESETS } = require("../clash-of-live-catalog");
const { DEMONOLOGIST_DEFAULT_MAPPINGS, DEMONOLOGIST_EFFECTS, DEMONOLOGIST_INTERACTION_CATALOG_VERSION } = require("../demonologist-catalog");
const { EURO_TRUCK_SIMULATOR_2_DEFAULT_MAPPINGS, EURO_TRUCK_SIMULATOR_2_EFFECTS, EURO_TRUCK_SIMULATOR_2_INTERACTION_CATALOG_VERSION } = require("../euro-truck-simulator-2-catalog");
const { RESIDENT_EVIL_3_DEFAULT_MAPPINGS, RESIDENT_EVIL_3_EFFECTS, RESIDENT_EVIL_3_INTERACTION_CATALOG_VERSION } = require("../resident-evil-3-catalog");
const { POKEMON_RED_BLUE_DEFAULT_MAPPINGS, POKEMON_RED_BLUE_EFFECTS, POKEMON_RED_BLUE_INTERACTION_CATALOG_VERSION } = require("../pokemon-red-blue-catalog");
const { SUPER_MARIO_KART_DEFAULT_MAPPINGS, SUPER_MARIO_KART_EFFECTS, SUPER_MARIO_KART_INTERACTION_CATALOG_VERSION } = require("../super-mario-kart-catalog");
const { THIERCELIEUX_EXTENSION_PRODUCTS } = require("../../shared/thiercelieux-products");
const { GTA_LOCAL_BRIDGE, CULT_OF_THE_LAMB_BRIDGE, STARDEW_VALLEY_BRIDGE, TERRARIA_BRIDGE, EURO_TRUCK_SIMULATOR_2_BRIDGE, RESIDENT_EVIL_3_BRIDGE } = require("./connectors");
const { COIN_PUSHER_EFFECTS, COIN_PUSHER_DEFAULT_MAPPINGS } = require("./coin-pusher");
const { game } = require("./builders");
const { FIND_THE_NEEDLE_CONNECTOR, FIND_THE_NEEDLE_EFFECTS, FIND_THE_NEEDLE_DEFAULT_MAPPINGS, FIND_THE_NEEDLE_INTERACTION_CATALOG_VERSION } = require("../find-the-needle-catalog");
const { THE_MORTUARY_ASSISTANT_BRIDGE } = require("./connectors");
const { THE_MORTUARY_ASSISTANT_EFFECTS, THE_MORTUARY_ASSISTANT_DEFAULT_MAPPINGS, THE_MORTUARY_ASSISTANT_INTERACTION_CATALOG_VERSION } = require("../the-mortuary-assistant-catalog");
const { UNTURNED_BRIDGE } = require("./connectors");
const { UNTURNED_EFFECTS, UNTURNED_DEFAULT_MAPPINGS, UNTURNED_INTERACTION_CATALOG_VERSION } = require("../unturned-catalog");
const { CRASH_BANDICOOT_EFFECTS, CRASH_BANDICOOT_DEFAULT_MAPPINGS, CRASH_BANDICOOT_INTERACTION_CATALOG_VERSION } = require("../crash-bandicoot-catalog");

const INTERNAL_GAMES = [
  game("crash-bandicoot-n-sane-trilogy", "Crash Bandicoot N. Sane Trilogy", {
    included: true,
    artwork: "catalog/crash-bandicoot-n-sane-trilogy.jpg",
    source: "ShenPulse · pont local",
    description: "26 interactions locales : vies, fruits Wumpa, caisses, sauts, vitesse, caméra et transformations visuelles.",
    tags: ["inclus", "Steam", "plateforme", "pont local"],
    connector: { type: "tcp-server", host: "127.0.0.1", port: 58436, timeoutMs: 12000, expectResponse: true, launchConnectionTimeoutMs: 30000, focusProcessOnManualTrigger: "CrashBandicootNSaneTrilogy" },
    effects: CRASH_BANDICOOT_EFFECTS,
    defaultMappings: CRASH_BANDICOOT_DEFAULT_MAPPINGS,
    interactionCatalogVersion: CRASH_BANDICOOT_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.0.1"
  }),
  game("unturned", "Unturned", {
    included: true,
    artwork: "catalog/unturned.jpg",
    source: "ShenPulse · module local",
    description: "27 interactions locales pour la survie, les apparitions, l’inventaire et la météo. Jeu Steam gratuit, partie solo sans BattlEye.",
    tags: ["inclus", "Steam", "survie", "solo", "module local"],
    connector: UNTURNED_BRIDGE,
    effects: UNTURNED_EFFECTS,
    defaultMappings: UNTURNED_DEFAULT_MAPPINGS,
    interactionCatalogVersion: UNTURNED_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.0.1"
  }),
  game("the-mortuary-assistant", "The Mortuary Assistant", {
    included: true,
    requiresPro: true,
    artwork: "catalog/the-mortuary-assistant.jpg",
    source: "ShenPulse · mod local",
    description: "22 interactions locales pour influencer l’embaumement, les hantises et la possession de Rebecca. Jeu complet Steam requis.",
    tags: ["inclus", "Steam", "horreur", "mod local"],
    connector: THE_MORTUARY_ASSISTANT_BRIDGE,
    effects: THE_MORTUARY_ASSISTANT_EFFECTS,
    defaultMappings: THE_MORTUARY_ASSISTANT_DEFAULT_MAPPINGS,
    interactionCatalogVersion: THE_MORTUARY_ASSISTANT_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.0.0"
  }),
  game("find-the-needle-demo", "Find The Needle Demo", {
    included: true,
    ownerOnly: true,
    artwork: "catalog/find-the-needle-demo.jpg",
    source: "Steam · FindTheNeedleDev / HayPassionates · mod local StreamToEarn",
    description: "Les 37 interactions de la démo V62, pilotées localement depuis ShenPulse. Démo Steam gratuite et mod compatible fourni séparément nécessaires.",
    tags: ["inclus", "Steam", "démo gratuite", "privé", "mod local"],
    connector: FIND_THE_NEEDLE_CONNECTOR,
    effects: FIND_THE_NEEDLE_EFFECTS,
    defaultMappings: FIND_THE_NEEDLE_DEFAULT_MAPPINGS,
    interactionCatalogVersion: FIND_THE_NEEDLE_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.1.0"
  }),
  game("thiercelieux", "Les Loups-Garous de Thiercelieux", {
    artwork: "catalog/thiercelieux-landscape.png",
    price: 4.99,
    requiresPro: true,
    source: "ShenPulse · orchestration originale",
    description:
      "Mode social complet pour 3 à 8 joueurs : composition adaptative, file LIVE par cadeau, rôles privés, guide dynamique, caméra facultative, pronostics et sauvegarde continue.",
    tags: [
      "abonnement requis",
      "achat unique",
      "jeu local",
      "rôles cachés",
      "portrait ou paysage"
    ],
    addOns: THIERCELIEUX_EXTENSION_PRODUCTS,
    effects: [
      "Ouvrir inscriptions",
      "Fermer inscriptions",
      "Ajouter temps",
      "Hurlement"
    ]
  }),
  game("coin-pusher", "Coin Pusher Live", {
    artwork: "catalog/coin-pusher.webp",
    price: 4.99,
    requiresPro: true,
    effects: COIN_PUSHER_EFFECTS,
    defaultMappings: COIN_PUSHER_DEFAULT_MAPPINGS,
    interactionCatalogVersion: 20260806
  }),
  game("connect-four", "Puissance 4 Arena", {
    artwork: "catalog/connect-four.png",
    price: 4.99,
    requiresPro: true,
    effects: ["Jeton rouge", "Jeton jaune", "Colonne aléatoire", "Bloquer une colonne", "Effacer un jeton", "Nouvelle manche"]
  }),
  game("deal-or-no-deal", "DealOrNoDeal", {
    artwork: "catalog/deal-or-no-deal.png",
    price: 4.99,
    requiresPro: true,
    effects: ["Ouvrir une boîte", "Offre du banquier", "Refuser l'offre", "Accepter l'offre", "Boîte premium"]
  }),
  game("diamond-bridge", "Le Pont des Diamants", {
    artwork: "catalog/diamond-bridge.svg",
    included: true,
    requiresPro: true,
    effects: ["Avancer", "Reculer", "Ajouter un diamant", "Retirer un diamant", "Piège du pont"]
  }),
  game("diamond-drop", "Diamond Drop Live", {
    artwork: "catalog/diamond-drop.png",
    price: 4.99,
    requiresPro: true,
    effects: ["Lâcher un diamant", "Pluie de diamants", "Bombe", "Multiplicateur", "Nettoyer le plateau"]
  }),
  game("color-strike", "Color Strike", {
    artwork: "catalog/shenpulse-color-strike.jpg",
    coverArtwork: "covers/color-strike.webp",
    price: 19.99,
    requiresPro: true,
    source: "ShenPulse · Color Strike autonome",
    description:
      "Pilote les 41 interactions natives de Color Strike depuis ShenPulse par une passerelle HTTP strictement locale.",
    tags: [
      "abonnement requis",
      "achat unique",
      "jeu autonome",
      "solo",
      "multijoueur"
    ],
    connector: COLOR_STRIKE_CONNECTOR,
    effects: COLOR_STRIKE_EFFECTS,
    deprecatedDefaultMappingIds:
      COLOR_STRIKE_DEPRECATED_DEFAULT_MAPPING_IDS,
    defaultMappings: COLOR_STRIKE_DEFAULT_MAPPINGS,
    wheelPresets: COLOR_STRIKE_WHEEL_PRESETS,
    interactionCatalogVersion:
      COLOR_STRIKE_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.0.9-shenpulse2"
  }),
  game("tiklive-climb", "Climb", {
    artwork: "catalog/shenpulse-climb.jpg",
    coverArtwork: "covers/tiklive-climb.webp",
    price: 9.99,
    requiresPro: true,
    source: "ShenPulse · Climb autonome",
    description:
      "Pilote les 18 interactions natives de Climb depuis ShenPulse par une passerelle HTTP strictement locale.",
    tags: [
      "abonnement requis",
      "achat unique",
      "jeu autonome",
      "escalade",
      "roue interactive"
    ],
    connector: TIKLIVE_CLIMB_CONNECTOR,
    effects: TIKLIVE_CLIMB_EFFECTS,
    deprecatedDefaultMappingIds:
      TIKLIVE_CLIMB_DEPRECATED_DEFAULT_MAPPING_IDS,
    defaultMappings: TIKLIVE_CLIMB_DEFAULT_MAPPINGS,
    wheelPresets: TIKLIVE_CLIMB_WHEEL_PRESETS,
    interactionCatalogVersion:
      TIKLIVE_CLIMB_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.0.0-shenpulse1"
  }),
  game("tiklive-cube-wars", "ShenPulse Cube Wars", {
    artwork: "catalog/shenpulse-cube-wars.png",
    coverArtwork: "covers/tiklive-cube-wars.webp",
    price: 9.99,
    requiresPro: true,
    source: "ShenPulse · Cube Wars autonome",
    description:
      "Hommes contre Femmes : les viewers choisissent leur camp puis pilotent les 18 interactions natives de Cube Wars par une passerelle HTTP strictement locale.",
    tags: [
      "abonnement requis",
      "achat unique",
      "jeu autonome",
      "équipes",
      "roue interactive"
    ],
    connector: TIKLIVE_CUBE_WARS_CONNECTOR,
    effects: TIKLIVE_CUBE_WARS_EFFECTS,
    deprecatedDefaultMappingIds:
      TIKLIVE_CUBE_WARS_DEPRECATED_DEFAULT_MAPPING_IDS,
    defaultMappings: TIKLIVE_CUBE_WARS_DEFAULT_MAPPINGS,
    wheelPresets: TIKLIVE_CUBE_WARS_WHEEL_PRESETS,
    interactionCatalogVersion:
      TIKLIVE_CUBE_WARS_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.0.0-shenpulse1"
  }),
  game("tiklive-stack-tower", "ShenPulse Stack Tower", {
    artwork: "catalog/shenpulse-stack-tower.png",
    coverArtwork: "covers/tiklive-stack-tower.webp",
    price: 9.99,
    requiresPro: true,
    source: "ShenPulse · Stack Tower autonome",
    description:
      "Montez jusqu’à 500 étages pendant que les viewers aident ou sabotent la tour grâce aux 28 interactions natives de Stack Tower.",
    tags: [
      "abonnement requis",
      "achat unique",
      "jeu autonome",
      "construction",
      "roue interactive"
    ],
    connector: TIKLIVE_STACK_TOWER_CONNECTOR,
    effects: TIKLIVE_STACK_TOWER_EFFECTS,
    deprecatedDefaultMappingIds:
      TIKLIVE_STACK_TOWER_DEPRECATED_DEFAULT_MAPPING_IDS,
    defaultMappings: TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS,
    wheelPresets: TIKLIVE_STACK_TOWER_WHEEL_PRESETS,
    interactionCatalogVersion:
      TIKLIVE_STACK_TOWER_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.0.0-shenpulse1"
  }),
  game("clash-of-live", "Clash Of ShenPulse", {
    artwork: "catalog/clash-of-shenpulse.jpg",
    coverArtwork: "covers/clash-of-live.webp",
    price: 12.99,
    requiresPro: true,
    source: "ShenPulse · Clash Of ShenPulse autonome",
    description:
      "Pilote les 15 interactions natives de Clash Of ShenPulse depuis ShenPulse par une passerelle HTTP strictement locale.",
    tags: [
      "abonnement requis",
      "achat unique",
      "jeu autonome",
      "affrontement",
      "roue interactive"
    ],
    connector: CLASH_OF_LIVE_CONNECTOR,
    effects: CLASH_OF_LIVE_EFFECTS,
    deprecatedDefaultMappingIds:
      CLASH_OF_LIVE_DEPRECATED_DEFAULT_MAPPING_IDS,
    defaultMappings: CLASH_OF_LIVE_DEFAULT_MAPPINGS,
    wheelPresets: CLASH_OF_LIVE_WHEEL_PRESETS,
    interactionCatalogVersion:
      CLASH_OF_LIVE_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.0.0-shenpulse1"
  }),
  game("pokemon-red-blue", "Pokémon Rouge/Bleu", {
    artwork: "catalog/pokemon-red-blue.png",
    included: true,
    requiresPro: true,
    source: "Crowd Control · Pokémon Rouge/Bleu",
    connector: { type: "pokemon-runtime" },
    effects: POKEMON_RED_BLUE_EFFECTS,
    defaultMappings: POKEMON_RED_BLUE_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      POKEMON_RED_BLUE_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.1.0"
  }),
  game("super-mario-kart", "Super Mario Kart", {
    artworkUrl:
      "https://resources.crowdcontrol.live/images/SuperMarioKart/box.jpg",
    included: true,
    requiresPro: true,
    source: "Crowd Control · Super Mario Kart",
    connector: { type: "super-mario-kart-runtime" },
    effects: SUPER_MARIO_KART_EFFECTS,
    defaultMappings: SUPER_MARIO_KART_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      SUPER_MARIO_KART_INTERACTION_CATALOG_VERSION,
    installerVersion: "1.1.0"
  }),
  game("fortnite", "Fortnite", {
    artworkUrl:
      "https://resources.crowdcontrol.live/images/Fortnite/box.jpg",
    included: true,
    ownerOnly: true,
    source: "Crowd Control · Fortnite Input Disrupts",
    tags: [
      "abonnement requis",
      "inclus",
      "Crowd Control",
      "clavier PC"
    ],
    connector: {
      type: "windows-input",
      processName: "FortniteClient-Win64-Shipping.exe",
      keyLayout: "azerty"
    },
    effects: FORTNITE_EFFECTS,
    defaultMappings: FORTNITE_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      FORTNITE_INTERACTION_CATALOG_VERSION
  }),
  game("rocket-league", "Rocket League", {
    artworkUrl:
      "https://resources.crowdcontrol.live/images/RocketLeague/box.jpg",
    included: true,
    requiresPro: true,
    source: "ShenPulse · Interactions Rocket League",
    description:
      "Transforme les cadeaux TikTok LIVE en commandes de conduite, sauts, turbo, caméra et actions chaotiques ciblées sur Rocket League.",
    tags: [
      "abonnement requis",
      "inclus",
      "clavier et souris",
      "Epic Games",
      "Steam"
    ],
    connector: {
      type: "windows-input",
      processName: "RocketLeague.exe",
      keyLayout: "azerty"
    },
    effects: ROCKET_LEAGUE_EFFECTS,
    defaultMappings: ROCKET_LEAGUE_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      ROCKET_LEAGUE_INTERACTION_CATALOG_VERSION
  }),
  game("demonologist", "Demonologist", {
    artworkUrl:
      "https://resources.crowdcontrol.live/images/Demonologist/box.jpg",
    included: true,
    requiresPro: true,
    source: "Crowd Control · Demonologist Input Disrupts",
    description:
      "Transforme les cadeaux TikTok LIVE en commandes ciblées : déplacements, équipements, journal, lampe, outils, caméra et communication.",
    tags: [
      "abonnement requis",
      "inclus",
      "Crowd Control",
      "clavier et souris",
      "Steam"
    ],
    installerVersion: "1.0.0",
    connector: {
      type: "windows-input",
      processName: "Shivers-Win64-Shipping.exe",
      keyLayout: "azerty"
    },
    effects: DEMONOLOGIST_EFFECTS,
    defaultMappings: DEMONOLOGIST_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      DEMONOLOGIST_INTERACTION_CATALOG_VERSION
  }),
  game("euro-truck-simulator-2", "Euro Truck Simulator 2", {
    artworkUrl:
      "https://resources.crowdcontrol.live/images/EuroTruckSimulator2/box.jpg",
    included: true,
    requiresPro: true,
    source: "Crowd Control · Euro Truck Simulator 2",
    description:
      "Transforme les cadeaux TikTok LIVE en événements de conduite : météo, freinage, direction, éclairage, cabine, klaxons et transmission.",
    tags: [
      "abonnement requis",
      "inclus",
      "Crowd Control",
      "mod PC",
      "Steam"
    ],
    installerVersion: "1.0.5",
    connector: EURO_TRUCK_SIMULATOR_2_BRIDGE,
    effects: EURO_TRUCK_SIMULATOR_2_EFFECTS,
    defaultMappings: EURO_TRUCK_SIMULATOR_2_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      EURO_TRUCK_SIMULATOR_2_INTERACTION_CATALOG_VERSION
  }),
  game("resident-evil-3", "Resident Evil 3", {
    artworkUrl:
      "https://resources.crowdcontrol.live/images/ResidentEvil3/box.jpg",
    included: true,
    requiresPro: true,
    source: "Crowd Control · Resident Evil 3 (2020)",
    description:
      "Transforme les cadeaux TikTok LIVE en soins, dégâts, armes, munitions, effets temporaires et apparitions d’ennemis dans Resident Evil 3.",
    tags: [
      "abonnement requis",
      "inclus",
      "Crowd Control",
      "mod PC",
      "Steam"
    ],
    installerVersion: "2.1.4",
    connector: RESIDENT_EVIL_3_BRIDGE,
    effects: RESIDENT_EVIL_3_EFFECTS,
    defaultMappings: RESIDENT_EVIL_3_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      RESIDENT_EVIL_3_INTERACTION_CATALOG_VERSION
  }),
  require("./gtav-koth").GTAV_KOTH,
  require("./gtav-hiking").GTAV_HIKING,
  game("gtav-montchiliad", "GTA V Mont Chiliad", {
    artwork: "catalog/gtav-montchiliad.png",
    coverArtwork: "covers/gtav-montchiliad.png",
    included: true,
    requiresPro: true,
    installerVersion: "1.0.15",
    connector: GTA_LOCAL_BRIDGE,
    effects: GTAV_MONT_CHILIAD_EFFECTS,
    defaultMappings: GTAV_MONT_CHILIAD_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      GTAV_MONT_CHILIAD_INTERACTION_CATALOG_VERSION
  }),
  game("minecraft-lavarise", "Minecraft Lava Rise", {
    coverArtwork: "covers/minecraft-lavarise-v2.png", artwork: "covers/minecraft-lavarise-v2.png",
    serverAddress: "127.0.0.1:25585", minecraftVersion: "26.1.2",
    included: true, requiresPro: true, installerVersion: "1.0.0",
    connector: { type: "minecraft-runtime" },
    description: "Grimpez dans une tour de plateformes pendant que la lave monte. Vos viewers vous aident ou vous piègent ; tenez au sommet pour gagner.",
    effects: require("./minecraft/lavarise").LAVARISE_EFFECTS,
    defaultMappings: require("./minecraft/lavarise").LAVARISE_DEFAULT_MAPPINGS,
    interactionCatalogVersion: 2026102901
  }),
  game("minecraft-bedrock-box", "Minecraft Bedrock Box", {
    minecraftVersion: "1.21",
    coverArtwork: "covers/minecraft-bedrock-box.png",
    artwork: "catalog/minecraft-bedrock-box.jpg",
    included: true,
    requiresPro: true,
    installerVersion: "1.1.4",
    connector: { type: "minecraft-runtime" },
    effects: MINECRAFT_BEDROCK_EFFECTS,
    defaultMappings: MINECRAFT_BEDROCK_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      MINECRAFT_BEDROCK_INTERACTION_CATALOG_VERSION
  }),
  game("minecraft-sandbox-3", "Minecraft SandBox 3", {
    minecraftVersion: "1.21",
    coverArtwork: "covers/minecraft-sandbox-3.png",
    artwork: "catalog/minecraft-sandbox-3.jpg",
    included: true,
    requiresPro: true,
    installerVersion: "1.1.1",
    connector: { type: "minecraft-runtime" },
    effects: MINECRAFT_SANDBOX_EFFECTS,
    defaultMappings: MINECRAFT_SANDBOX_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      MINECRAFT_SANDBOX_INTERACTION_CATALOG_VERSION
  }),
  game("minecraft-survival-plugin", "Minecraft Survival", {
    minecraftVersion: "1.21",
    coverArtwork: "covers/minecraft-survival-plugin.png",
    artwork: "catalog/minecraft-survival-plugin.svg",
    included: true,
    requiresPro: true,
    installerVersion: "1.1.1",
    connector: { type: "minecraft-runtime" },
    description:
      "Mode survie Minecraft complet : objectifs, coffres, équipements, créatures, boss, pièges et événements déclenchés par les cadeaux TikTok LIVE.",
    effects: MINECRAFT_SURVIVAL_EFFECTS,
    defaultMappings: MINECRAFT_SURVIVAL_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      MINECRAFT_SURVIVAL_INTERACTION_CATALOG_VERSION
  }),
  game("cult-of-the-lamb", "Cult of the Lamb", {
    artwork: "catalog/cult-of-the-lamb.png",
    included: true,
    requiresPro: true,
    installerVersion: "1.0.2",
    connector: CULT_OF_THE_LAMB_BRIDGE,
    effects: CULT_OF_THE_LAMB_EFFECTS,
    defaultMappings: CULT_OF_THE_LAMB_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      CULT_OF_THE_LAMB_INTERACTION_CATALOG_VERSION
  }),
  game("stardew-valley", "Stardew Valley", {
    artwork: "catalog/stardew-valley.png",
    included: true,
    requiresPro: true,
    installerVersion: "1.1.0",
    connector: STARDEW_VALLEY_BRIDGE,
    effects: STARDEW_VALLEY_EFFECTS,
    defaultMappings: STARDEW_VALLEY_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      STARDEW_VALLEY_INTERACTION_CATALOG_VERSION
  }),
  game("terraria", "Terraria", {
    artwork: "catalog/terraria.png",
    included: true,
    requiresPro: true,
    installerVersion: "1.1.0",
    connector: TERRARIA_BRIDGE,
    effects: TERRARIA_EFFECTS,
    defaultMappings: TERRARIA_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      TERRARIA_INTERACTION_CATALOG_VERSION
  })
];

module.exports = { INTERNAL_GAMES };

