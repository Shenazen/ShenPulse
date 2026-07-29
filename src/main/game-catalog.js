"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  GTAV_MONT_CHILIAD_DEFAULT_MAPPINGS,
  GTAV_MONT_CHILIAD_EFFECTS,
  GTAV_MONT_CHILIAD_INTERACTION_CATALOG_VERSION
} = require("./gtav-mont-chiliad-catalog");
const {
  MINECRAFT_BEDROCK_DEFAULT_MAPPINGS,
  MINECRAFT_BEDROCK_EFFECTS,
  MINECRAFT_BEDROCK_INTERACTION_CATALOG_VERSION,
  MINECRAFT_SANDBOX_DEFAULT_MAPPINGS,
  MINECRAFT_SANDBOX_EFFECTS,
  MINECRAFT_SANDBOX_INTERACTION_CATALOG_VERSION
} = require("./minecraft-game-catalog");

const LOCAL_BRIDGE = Object.freeze({
  type: "tcp",
  host: "127.0.0.1",
  port: 28380,
  timeoutMs: 5000,
  expectResponse: true
});

const GTA_LOCAL_BRIDGE = Object.freeze({
  type: "tcp-server",
  host: "127.0.0.1",
  port: 58430,
  timeoutMs: 12000,
  expectResponse: true
});

const INTERNAL_GAMES = [
  game("coin-pusher", "Coin Pusher Live", {
    artwork: "catalog/coin-pusher.webp",
    included: true,
    requiresPro: true,
    effects: ["Pluie de pièces", "Pousser le plateau", "Pièce mystère", "Bonus multiplicateur", "Ralentir le poussoir", "Réinitialiser la manche"]
  }),
  game("connect-four", "Puissance 4 Arena", {
    artwork: "catalog/connect-four.png",
    price: 9.99,
    requiresPro: true,
    effects: ["Jeton rouge", "Jeton jaune", "Colonne aléatoire", "Bloquer une colonne", "Effacer un jeton", "Nouvelle manche"]
  }),
  game("deal-or-no-deal", "DealOrNoDeal", {
    artwork: "catalog/deal-or-no-deal.png",
    price: 24.99,
    requiresPro: true,
    effects: ["Ouvrir une boîte", "Offre du banquier", "Refuser l'offre", "Accepter l'offre", "Boîte premium"]
  }),
  game("diamond-bridge", "Le Pont des Diamants", {
    artwork: "catalog/diamond-bridge.svg",
    price: 19.99,
    requiresPro: true,
    effects: ["Avancer", "Reculer", "Ajouter un diamant", "Retirer un diamant", "Piège du pont"]
  }),
  game("diamond-drop", "Diamond Drop Live", {
    artwork: "catalog/diamond-drop.png",
    price: 19.99,
    requiresPro: true,
    effects: ["Lâcher un diamant", "Pluie de diamants", "Bombe", "Multiplicateur", "Nettoyer le plateau"]
  }),
  game("pokemon-red-blue", "Pokémon Rouge/Bleu", {
    artwork: "catalog/pokemon-red-blue.png",
    included: true,
    requiresPro: true,
    effects: ["Soigner l'équipe", "Empoisonner", "Rencontre aléatoire", "Donner un objet", "Retirer un objet", "Téléportation", "Changer de Pokémon", "Combat surprise"]
  }),
  game("gtav-montchiliad", "GTA V Mont Chiliad", {
    artwork: "catalog/gtav-montchiliad.png",
    price: 30,
    requiresPro: true,
    installerVersion: "1.0.3",
    connector: GTA_LOCAL_BRIDGE,
    effects: GTAV_MONT_CHILIAD_EFFECTS,
    defaultMappings: GTAV_MONT_CHILIAD_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      GTAV_MONT_CHILIAD_INTERACTION_CATALOG_VERSION
  }),
  game("minecraft-bedrock-box", "Minecraft Bedrock Box", {
    artwork: "catalog/minecraft-bedrock-box.jpg",
    included: true,
    requiresPro: true,
    installerVersion: "1.1.0",
    connector: { type: "minecraft-runtime" },
    effects: MINECRAFT_BEDROCK_EFFECTS,
    defaultMappings: MINECRAFT_BEDROCK_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      MINECRAFT_BEDROCK_INTERACTION_CATALOG_VERSION
  }),
  game("minecraft-sandbox-3", "Minecraft SandBox 3", {
    artwork: "catalog/minecraft-sandbox-3.jpg",
    included: true,
    requiresPro: true,
    installerVersion: "1.1.0",
    connector: { type: "minecraft-runtime" },
    effects: MINECRAFT_SANDBOX_EFFECTS,
    defaultMappings: MINECRAFT_SANDBOX_DEFAULT_MAPPINGS,
    interactionCatalogVersion:
      MINECRAFT_SANDBOX_INTERACTION_CATALOG_VERSION
  }),
  game("minecraft-survival-plugin", "Minecraft Survival Plugin", {
    artwork: "catalog/minecraft-survival-plugin.svg",
    included: true,
    requiresPro: true,
    connector: { type: "rcon", host: "127.0.0.1", port: 25575 },
    effects: ["Soigner", "Faim", "Foudre", "Spawn aléatoire", "Donner un objet", "Téléportation"]
  }),
  game("cult-of-the-lamb", "Cult of the Lamb", {
    artwork: "catalog/cult-of-the-lamb.png",
    included: true,
    requiresPro: true,
    connector: LOCAL_BRIDGE,
    effects: ["Ajouter un fidèle", "Ressusciter", "Rendre malade", "Donner de la foi", "Retirer de la foi", "Lancer un rituel"]
  }),
  game("stardew-valley", "Stardew Valley", {
    artwork: "catalog/stardew-valley.png",
    included: true,
    requiresPro: true,
    connector: LOCAL_BRIDGE,
    effects: ["Donner de l'or", "Changer la météo", "Ajouter de l'énergie", "Retirer de l'énergie", "Donner un objet", "Passer une heure"]
  }),
  game("terraria", "Terraria", {
    artwork: "catalog/terraria.png",
    included: true,
    requiresPro: true,
    connector: LOCAL_BRIDGE,
    effects: ["Soigner", "Faire apparaître un ennemi", "Invoquer un boss", "Donner un objet", "Changer l'heure", "Changer la météo"]
  })
];

const EXTERNAL_GAMES = [
  external("blue-prince", "Blue Prince", "https://resources.crowdcontrol.live/images/BluePrince/box.jpg", "Crowd Control"),
  external("hollow-knight-silksong", "Hollow Knight: Silksong", "https://resources.crowdcontrol.live/images/HollowKnightSilksong/box.jpg", "Crowd Control + StreamToEarn"),
  external("hollow-knight", "Hollow Knight", "https://resources.crowdcontrol.live/images/HollowKnight/box.jpg", "Crowd Control + StreamToEarn"),
  external("supermarket-simulator", "Supermarket Simulator", "https://resources.crowdcontrol.live/images/SupermarketSimulator/box.jpg", "Crowd Control + StreamToEarn"),
  external("egging-on", "Egging On", "https://resources.crowdcontrol.live/images/EggingOn/box.jpg", "Crowd Control + StreamToEarn"),
  external("balatro", "Balatro", "https://resources.crowdcontrol.live/images/Balatro/box.jpg", "Crowd Control"),
  external("celeste", "Celeste", "https://resources.crowdcontrol.live/images/Celeste/box.jpg", "Crowd Control"),
  external("dead-by-daylight", "Dead by Daylight", "https://resources.crowdcontrol.live/images/DeadbyDaylight/box.jpg", "Crowd Control"),
  external("deep-rock-galactic", "Deep Rock Galactic", "https://resources.crowdcontrol.live/images/DeepRockGalactic/box.jpg", "Crowd Control"),
  external("dredge", "DREDGE", "https://resources.crowdcontrol.live/images/Dredge/box.jpg", "Crowd Control"),
  external("fallout-4", "Fallout 4", "https://resources.crowdcontrol.live/images/Fallout4/box.jpg", "Crowd Control"),
  external("hades", "Hades", "https://resources.crowdcontrol.live/images/Hades/box.jpg", "Crowd Control"),
  external("inscryption", "Inscryption", "https://resources.crowdcontrol.live/images/Inscryption/box.jpg", "Crowd Control"),
  external("no-mans-sky", "No Man's Sky", "https://resources.crowdcontrol.live/images/NoMansSky/box.jpg", "Crowd Control"),
  external("palworld", "Palworld", "https://resources.crowdcontrol.live/images/Palworld/box.jpg", "Crowd Control"),
  external("resident-evil-7-biohazard", "Resident Evil 7 Biohazard", "https://resources.crowdcontrol.live/images/ResidentEvil7/box.jpg", "Crowd Control"),
  external("vampire-survivors", "Vampire Survivors", "https://resources.crowdcontrol.live/images/VampireSurvivors/box.jpg", "Crowd Control"),
  external("ark-survival-ascended", "ARK: Survival Ascended", "https://resources.crowdcontrol.live/images/ARKSurvivalAscended/box.jpg", "Crowd Control"),
  external("cities-skylines", "Cities Skylines", "https://resources.crowdcontrol.live/images/CitiesSkylines/box.jpg", "Crowd Control"),
  external("crash-bandicoot-n-sane-trilogy", "Crash Bandicoot N. Sane Trilogy", "https://resources.crowdcontrol.live/images/CrashBandicootNSaneTrilogy/box.jpg", "Crowd Control"),
  external("kingdom-come-deliverance-2", "Kingdom Come: Deliverance II", "https://resources.crowdcontrol.live/images/KingdomComeDeliverance2/box.jpg", "Crowd Control"),
  external("deep-rock-galactic-survivor", "Deep Rock Galactic: Survivor", "https://d1jl7r3beoolrj.cloudfront.net/public/images/1750320384724_Deep%20Rock%20Galactic%20Survivor.png", "StreamToEarn"),
  external("hades-ii", "Hades II", "https://d1jl7r3beoolrj.cloudfront.net/public/images/1761054320515_Hades2_v2_.png", "StreamToEarn"),
  external("wobbly-life", "Wobbly Life", "https://d1jl7r3beoolrj.cloudfront.net/public/images/1747850530522_WobblyLife_poster.png", "StreamToEarn")
];

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
  palworld: ["https://crowdcontrol.live/guides/palworld/"],
  "resident-evil-7-biohazard": ["https://crowdcontrol.live/guides/residentevil7/"],
  "vampire-survivors": ["https://crowdcontrol.live/guides/vampiresurvivors/"],
  "ark-survival-ascended": ["https://crowdcontrol.live/game/ark-survival-ascended/"],
  "cities-skylines": ["https://crowdcontrol.live/guides/citiesskylines/"],
  "crash-bandicoot-n-sane-trilogy": [
    "https://crowdcontrol.live/guides/crashbandicootnsanetrilogy/"
  ],
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
  "pokemon-red-blue": {
    mode: "emulator",
    summary: "Le parcours utilise BizHawk, le pack Pokémon Rouge/Bleu et la passerelle locale.",
    steps: [
      "Prépare une copie légale de Pokémon Rouge ou Bleu.",
      "Installe ou sélectionne BizHawk puis charge la ROM.",
      "Charge le pack d’interactions Pokémon dans la passerelle.",
      "Démarre le client local, puis teste un effet avant le LIVE."
    ],
    notes: [
      "La ROM n’est pas distribuée dans le package Microsoft Store.",
      "Garde BizHawk, le client local et ShenPulse ouverts pendant le LIVE."
    ],
    sources: []
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
  "minecraft-survival-plugin": minecraftGuide(
    "Installe le plugin Survival dans un serveur compatible et vérifie son port local."
  ),
  "cult-of-the-lamb": modGuide(
    "Ferme le jeu, sélectionne son dossier et installe le pont Cult of the Lamb."
  ),
  "stardew-valley": modGuide(
    "Installe SMAPI, ajoute le mod d’interactions puis lance Stardew Valley via SMAPI."
  ),
  terraria: modGuide(
    "Installe tModLoader, ajoute le mod d’interactions et démarre une partie locale."
  )
});

function loadShenazenGameCatalog(resourcesDirectory) {
  const interactionsDirectory = path.join(resourcesDirectory, "game-interactions");
  const external = EXTERNAL_GAMES.map((entry) => {
    const effects = interactionEffects(interactionsDirectory, entry.id);
    const hasNativeEffects = effects.some((effect) => effect.available);
    return {
      ...entry,
      connector: hasNativeEffects ? { ...LOCAL_BRIDGE } : { type: "demo" },
      effects,
      guide: buildGameGuide(entry, effects)
    };
  });
  return [
    ...INTERNAL_GAMES.map((entry) => ({
      ...entry,
      guide: buildGameGuide(entry, entry.effects)
    })),
    ...external
  ].map((entry) => structuredClone(entry));
}

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

function managedMinecraftGuide(summary) {
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
    sources: []
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
  const specialized = GAME_GUIDES[entry.id];
  if (specialized) return structuredClone(specialized);
  const sources = (EXTERNAL_GUIDE_URLS[entry.id] || []).map((url) => ({
    label: url.includes("streamtoearn.io")
      ? "Référence de compatibilité StreamToEarn"
      : "Guide du pack Crowd Control",
    url
  }));
  const native = effects.some((effect) => effect.available);
  const compatibilityNotes = {
    "hollow-knight": "Le patch actuel peut être incompatible : utilise la branche historique prise en charge.",
    "supermarket-simulator": "La mise à jour coopérative actuelle peut nécessiter une ancienne version prise en charge.",
    hades: "La version Microsoft Store/Game Pass peut limiter les mods : valide le pack localement.",
    "vampire-survivors": "Cette intégration cible une ancienne version du jeu.",
    "crash-bandicoot-n-sane-trilogy": "La compatibilité du mod est partielle et doit être validée localement."
  };
  return {
    mode: native ? "native" : "reference",
    summary: native
      ? `ShenPulse pilote le pack local de ${entry.name} par la passerelle de jeu.`
      : `La fiche reprend les interactions référencées pour ${entry.name} ; les éléments visuels restent signalés tant qu’aucun pack local exécutable n’est installé.`,
    steps: [
      "Installe le jeu depuis sa boutique officielle et lance-le une première fois.",
      "Ouvre ShenPulse, sélectionne le jeu puis configure ou détecte sa passerelle locale.",
      "Installe le pack compatible avec la version exacte du jeu en suivant le guide lié.",
      "Charge une sauvegarde jouable et teste plusieurs interactions avant le LIVE."
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

function game(id, name, options = {}) {
  const included = options.included === true;
  return {
    schemaVersion: 1,
    id,
    name,
    publisher: "ShenPulse",
    version: "1.0.0",
    description: options.description || `Interactions TikTok LIVE configurables pour ${name}.`,
    platform: "Windows",
    tags: [
      "abonnement requis",
      included ? "inclus" : "achat unique",
      "shenazenoverlay"
    ],
    artwork: options.artwork || "",
    artworkUrl: options.artworkUrl || "",
    accessMode: included ? "included" : "purchase",
    included,
    requiresPro: true,
    price: included ? 0 : Number(options.price || 19.99),
    currency: "EUR",
    source: options.source || "ShenazenOverlay",
    connector: { ...(options.connector || { type: "demo" }) },
    effects: (options.effects || []).map((effect, index) =>
      typeof effect === "string"
        ? effectFromTitle(effect, index)
        : structuredClone(effect)
    ),
    defaultMappings: structuredClone(options.defaultMappings || []),
    interactionCatalogVersion: Number(
      options.interactionCatalogVersion || 0
    ),
    installerVersion: String(options.installerVersion || "")
  };
}

function liveGame(id, name, effects) {
  return game(id, name, {
    included: true,
    requiresPro: true,
    source: "LiveInteractive Studio",
    effects
  });
}

function external(id, name, artworkUrl, source) {
  return game(id, name, {
    included: true,
    artworkUrl,
    source,
    description: `Fiche Game Pass issue de ${source}. Les effets natifs sont pilotés par la passerelle locale ShenPulse ; les références visuelles restent signalées comme non exécutables.`,
    effects: []
  });
}

function interactionEffects(baseDirectory, gameId) {
  const directory = path.join(baseDirectory, gameId);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.toLowerCase().endsWith(".webp"))
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
    .map((file, index) => {
      const stem = path.basename(file, path.extname(file));
      const match = stem.match(/-(native|s2e|cc)-(\d+)-(.+)$/i);
      const service = match?.[1]?.toLowerCase() || "visual";
      const code = match?.[3] || stem;
      return {
        id: stem,
        code,
        name: readableCode(code),
        description:
          service === "native"
            ? "Interaction locale ShenPulse prête à être envoyée au pack du jeu."
            : "Interaction de référence répertoriée ; aucun pack ShenPulse natif n’est encore exécutable.",
        category: inferCategory(code),
        icon: iconForCategory(inferCategory(code)),
        image: `../../resources/game-interactions/${gameId}/${file}`,
        available: service === "native",
        service,
        sortOrder: index
      };
    });
}

function effectFromTitle(title, index) {
  const code = slug(title);
  const category = inferCategory(code);
  return {
    id: code || `effect-${index + 1}`,
    code: code || `effect-${index + 1}`,
    name: title,
    description: `Déclenche « ${title} » dans la session de jeu active.`,
    category,
    icon: iconForCategory(category),
    available: true,
    service: "native",
    sortOrder: index
  };
}

function readableCode(value) {
  return String(value || "")
    .replace(/[-_.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferCategory(value) {
  const text = String(value || "").toLowerCase();
  if (/heal|give|add|money|xp|boon|item|win|bonus/.test(text)) return "Aide";
  if (/spawn|enemy|mob|boss|vehicle|pet|customer/.test(text)) return "Apparition";
  if (/kill|damage|hurt|take|remove|bomb|explode|lose|poison/.test(text)) return "Sabotage";
  if (/weather|time|teleport|speed|gravity|camera|control|move/.test(text)) return "Contrôle";
  return "Chaos";
}

function iconForCategory(category) {
  return {
    Aide: "✚",
    Apparition: "◇",
    Sabotage: "⚠",
    Contrôle: "⌁",
    Chaos: "✦"
  }[category] || "◇";
}

module.exports = {
  loadShenazenGameCatalog
};
