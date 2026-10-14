"use strict";

/** Données et règles du domaine Minecraft « survival » ; identifiants publics inchangés. */
const { parameter, effect } = require("./builders");

function survivalEffect({
  id,
  name,
  description,
  category,
  command,
  image = "bedrock-enderman.webp",
  parameters = []
}) {
  return effect({
    id: `survival-${id}`,
    name,
    description,
    category,
    commands: command,
    image,
    parameters
  });
}

// Catalogue relevé sur la documentation officielle StreamToEarn du plugin
// S2E Survival (version publique 1.1.1) le 7 octobre 2026. Les commandes à
// variantes textuelles sont dépliées afin que chaque option reste testable
// directement depuis ShenPulse sans champ de commande libre.
const SURVIVAL_EFFECTS = [
  survivalEffect({
    id: "hide-banner",
    name: "Masquer la bannière",
    description: "Masque la bannière de don affichée par le plugin Survival.",
    category: "Réglages",
    command: "/survival hidebanner",
    image: "bedrock-auto-replace-ai.png"
  }),
  survivalEffect({
    id: "goal-timer",
    name: "Objectif survie chronométré",
    description: "Lance un objectif de survie pendant le nombre de minutes choisi.",
    category: "Objectifs",
    command: "/survival start timer {{minutes}}",
    image: "bedrock-timer-ai.png",
    parameters: [parameter("minutes", "Durée (minutes)", 10, 1, 240)]
  }),
  survivalEffect({
    id: "goal-zombies",
    name: "Objectif éliminer des zombies",
    description: "Lance un objectif consistant à éliminer le nombre de zombies choisi.",
    category: "Objectifs",
    command: "/survival start zombie {{count}}",
    parameters: [parameter("count", "Nombre de zombies", 50, 1, 1000)]
  }),
  survivalEffect({
    id: "goal-red-sheep",
    name: "Objectif moutons rouges",
    description: "Lance l’objectif de recherche et d’élimination des moutons rouges.",
    category: "Objectifs",
    command: "/survival start sheep {{count}}",
    image: "bedrock-fill-ai.png",
    parameters: [parameter("count", "Nombre de moutons", 10, 1, 500)]
  }),
  ...[
    ["death", "Réinitialiser les morts", "Réinitialise le compteur de morts."],
    ["kills", "Réinitialiser les éliminations", "Réinitialise le compteur d’éliminations."],
    ["timer", "Réinitialiser le chronomètre", "Réinitialise le chronomètre de l’objectif."]
  ].map(([counter, name, description]) => survivalEffect({
    id: `reset-${counter}`,
    name,
    description,
    category: "Objectifs",
    command: `/survival reset ${counter}`,
    image: "bedrock-reset-ai.png"
  })),
  survivalEffect({
    id: "stop-goal",
    name: "Arrêter l’objectif",
    description: "Arrête l’objectif Survival et réinitialise ses compteurs.",
    category: "Objectifs",
    command: "/survival stop",
    image: "bedrock-clear-ai.png"
  }),
  survivalEffect({
    id: "chest",
    name: "Coffre standard",
    description: "Fait apparaître un coffre avec du butin standard.",
    category: "Coffres",
    command: "/survival chest",
    image: "bedrock-fill-block-ai.png"
  }),
  survivalEffect({
    id: "super-chest",
    name: "Super coffre",
    description: "Fait apparaître un coffre contenant du butin rare et puissant.",
    category: "Coffres",
    command: "/survival chest_super",
    image: "bedrock-diamond-ai.png"
  }),
  survivalEffect({
    id: "chest-effect",
    name: "Effet d’apparition des coffres",
    description: "Active ou désactive les effets visuels d’apparition des coffres.",
    category: "Réglages",
    command: "/survival chest-effect",
    image: "bedrock-fireworks-ai.png"
  }),
  survivalEffect({
    id: "random-hostile-mob",
    name: "Créature hostile aléatoire",
    description: "Fait apparaître une créature hostile aléatoire dans le rayon choisi.",
    category: "Créatures",
    command: "/survival armob {{radius}} {{viewer}}",
    parameters: [parameter("radius", "Rayon d’apparition", 5, 1, 100)]
  }),
  survivalEffect({
    id: "random-mob",
    name: "Créature aléatoire sans boss",
    description: "Fait apparaître une créature aléatoire sans boss dans le rayon choisi.",
    category: "Créatures",
    command: "/survival rmob {{radius}} {{viewer}}",
    parameters: [parameter("radius", "Rayon d’apparition", 5, 1, 100)]
  }),
  ...[
    ["speed", "Vitesse", "Augmente la vitesse de déplacement du joueur."],
    ["strength", "Force", "Augmente les dégâts d’attaque du joueur."],
    ["regeneration", "Régénération", "Régénère progressivement la santé du joueur."],
    ["jump_boost", "Super saut", "Augmente la hauteur de saut du joueur."]
  ].map(([command, name, description]) => survivalEffect({
    id: command.replaceAll("_", "-"),
    name,
    description,
    category: "Bonus",
    command: `/survival ${command} {{seconds}}${command === "jump_boost" ? " {{viewer}}" : ""}`,
    image: command === "jump_boost" ? "bedrock-height-up-ai.png" : "bedrock-longhands-ai.png",
    parameters: [parameter("seconds", "Durée (secondes)", 10, 1, 600)]
  })),
  survivalEffect({
    id: "skeleton-trap",
    name: "Piège de cavaliers squelettes",
    description: "Fait apparaître des cavaliers squelettes près du joueur.",
    category: "Créatures",
    command: "/survival skeleton_trap"
  }),
  ...[
    ["apple_enchanted", "Pomme dorée enchantée", "Donne une pomme dorée enchantée."],
    ["bow", "Arc Infinité", "Donne un arc avec l’enchantement Infinité."],
    ["random_sword", "Épée aléatoire", "Donne une épée aléatoire avec Tranchant III."],
    ["totem", "Totem d’immortalité", "Donne un Totem d’immortalité."],
    ["random_armor", "Armure aléatoire", "Donne une armure aléatoire avec Protection III."],
    ["tools", "Outils en Netherite", "Donne un ensemble d’outils en Netherite."],
    ["random_food", "Nourriture aléatoire", "Donne dix viandes cuites aléatoires."],
    ["enderpearls", "Perles de l’End", "Donne seize perles de l’End."]
  ].map(([command, name, description]) => survivalEffect({
    id: command.replaceAll("_", "-"),
    name,
    description,
    category: "Équipement",
    command: `/survival ${command} {{viewer}}`,
    image: command === "totem" || command === "apple_enchanted"
      ? "bedrock-diamond-ai.png"
      : "bedrock-fill-block-ai.png"
  })),
  ...[
    ["creeper", "Creeper"],
    ["evoker", "Évocateur"],
    ["ghast", "Ghast"],
    ["creeper_charged", "Creeper chargé"],
    ["random_boss", "Boss aléatoire"],
    ["skeleton", "Squelette"],
    ["witch", "Sorcière"],
    ["bee", "Abeille"],
    ["blaze", "Blaze"],
    ["ravager", "Ravageur"],
    ["piglin", "Piglin"],
    ["spider", "Araignée"],
    ["zombiegiant", "Zombie géant ciblé"],
    ["wither", "Wither"],
    ["warden", "Warden"]
  ].map(([command, name]) => survivalEffect({
    id: command.replaceAll("_", "-"),
    name,
    description: `Fait apparaître ${name.toLocaleLowerCase("fr-FR")} en ciblant le joueur.`,
    category: command === "wither" || command === "warden" || command === "random_boss" ? "Boss" : "Créatures",
    command: `/survival ${command} {{viewer}}`
  })),
  ...[
    ["null", "sans armure"],
    ["leather", "en cuir"],
    ["gold", "en or"],
    ["chainmail", "en mailles"],
    ["iron", "en fer"],
    ["diamond", "en diamant"],
    ["netherite", "en Netherite"]
  ].map(([armor, label]) => survivalEffect({
    id: `zombie-${armor}`,
    name: `Zombie ${label}`,
    description: `Fait apparaître un zombie ${label} qui cible le joueur.`,
    category: "Zombies",
    command: `/survival zombie ${armor} {{viewer}}`
  })),
  survivalEffect({
    id: "pit",
    name: "Fosse",
    description: "Creuse une fosse sous le joueur avec les dimensions choisies.",
    category: "Pièges",
    command: "/survival pit {{width}} {{height}} {{viewer}}",
    image: "bedrock-clear-ai.png",
    parameters: [
      parameter("width", "Largeur", 3, 1, 25),
      parameter("height", "Profondeur", 5, 1, 100)
    ]
  }),
  ...[
    ["clear_inventory", "Vider l’inventaire", "Vide l’inventaire de tous les joueurs du serveur."],
    ["trap", "Piège de toiles", "Enferme le joueur dans une structure de toiles 4 × 4."],
    ["kill", "Éliminer le joueur", "Élimine tous les joueurs du serveur."],
    ["lightning", "Foudre", "Frappe tous les joueurs avec la foudre."],
    ["raid", "Raid", "Déclenche un raid complet à l’emplacement du joueur."],
    ["tntbox", "Boîte de TNT", "Enferme le joueur dans une boîte de TNT avec des Creepers."],
    ["water_drop", "Chute MLG", "Donne un seau d’eau puis téléporte le joueur 200 blocs plus haut."],
    ["bee_cage", "Cage d’abeilles", "Enferme le joueur dans une cage de miel remplie d’abeilles."],
    ["obsidian_box", "Boîte d’obsidienne", "Enferme le joueur dans une boîte d’obsidienne."],
    ["stopmove", "Immobiliser", "Immobilise le joueur pendant dix secondes."],
    ["lavapit", "Fosse de lave", "Crée une fosse de lave sous le joueur."]
  ].map(([command, name, description]) => survivalEffect({
    id: command.replaceAll("_", "-"),
    name,
    description,
    category: "Pièges",
    command: `/survival ${command} {{viewer}}`,
    image: command.includes("tnt")
      ? "bedrock-tnt-ai.png"
      : command === "lightning"
        ? "bedrock-comets.webp"
        : "bedrock-glass-prison-ai.png"
  })),
  survivalEffect({
    id: "tnt",
    name: "TNT paramétrable",
    description: "Fait apparaître de la TNT près du joueur avec délai, puissance et rayon configurables.",
    category: "Pièges",
    command: "/survival tnt {{timer}} {{power}} {{radius}} {{viewer}}",
    image: "bedrock-super-tnt-ai.png",
    parameters: [
      parameter("timer", "Délai avant explosion", 10, 1, 120),
      parameter("power", "Puissance", 5, 1, 50),
      parameter("radius", "Rayon d’apparition", 5, 1, 100)
    ]
  }),
  survivalEffect({
    id: "dog",
    name: "Chien allié",
    description: "Fait apparaître un chien apprivoisé pour le joueur.",
    category: "Aide",
    command: "/survival dog {{viewer}}"
  }),
  survivalEffect({
    id: "starter-set",
    name: "Équipement de départ",
    description: "Donne au joueur l’armure et l’épée de départ du plugin Survival.",
    category: "Équipement",
    command: "/survival set",
    image: "bedrock-fill-block-ai.png"
  }),
  survivalEffect({
    id: "big-zombie",
    name: "Zombie géant",
    description: "Fait apparaître le zombie géant du plugin Survival.",
    category: "Zombies",
    command: "/survival bigzombie {{viewer}}"
  }),
  survivalEffect({
    id: "villager",
    name: "Villageois du viewer",
    description: "Fait apparaître un villageois portant le nom du viewer.",
    category: "Aide",
    command: "/survival villager {{viewer}}",
    image: "bedrock-fill-block-ai.png"
  })
];

module.exports = { survivalEffect, SURVIVAL_EFFECTS };

