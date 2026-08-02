"use strict";

const IMAGE_ROOT = "../../resources/game-interactions/minecraft";
const CATALOG_VERSION = 1;

const SANDBOX_COLORS = Object.freeze([
  ["white", "white", "blanc"],
  ["orange", "orange", "orange"],
  ["magenta", "magenta", "magenta"],
  ["light-blue", "light_blue", "bleu clair"],
  ["yellow", "yellow", "jaune"],
  ["lime", "lime", "vert lime"],
  ["pink", "pink", "rose"],
  ["gray-gravel", "gray_gravel", "gravier gris"],
  ["random", "random", "aléatoire"],
  ["gray", "gray", "gris"],
  ["light-gray", "light_gray", "gris clair"],
  ["cyan", "cyan", "cyan"],
  ["purple", "purple", "violet"],
  ["blue", "blue", "bleu"],
  ["brown", "brown", "marron"],
  ["green", "green", "vert"],
  ["red", "red", "rouge"],
  ["black", "black", "noir"],
  ["red-sand", "red_sand", "rouge naturel"]
]);

function parameter(id, label, defaultValue, min, max, step = 1) {
  return Object.freeze({ id, label, defaultValue, min, max, step });
}

function effect({
  id,
  name,
  description,
  category,
  commands,
  image,
  parameters = [],
  duration = 0,
  quantity = 1
}) {
  const commandList = Array.isArray(commands) ? commands : [commands];
  return Object.freeze({
    id,
    code: commandList[0],
    command: commandList[0],
    commands: commandList,
    name,
    description,
    category,
    duration,
    quantity,
    parameters,
    icon: "◆",
    image: `${IMAGE_ROOT}/${image}`,
    available: true,
    service: "native"
  });
}

function titled(command, title) {
  return [
    command,
    `/title @a title "${title}"`,
    '/title @a subtitle "{{viewer}}"'
  ];
}

function winEffect(id, name, description, image, amount, operation) {
  return Object.freeze({
    id,
    code: id,
    name,
    description,
    category: "WINS",
    duration: operation === "multiplier" ? 60 : 0,
    quantity: 1,
    icon: "★",
    image: `${IMAGE_ROOT}/${image}`,
    available: true,
    service: "overlay",
    actionType: "overlay.win-counter",
    winCounter: Object.freeze({ amount, operation })
  });
}

const BEDROCK_EFFECTS = [
  effect({
    id: "bedrock-tnt",
    name: "TNT",
    description: "Fait tomber la quantité de TNT choisie sur la box.",
    category: "TNT",
    commands: titled(
      "/bedrock tnt {{count}} {{viewer}}",
      "{{count}}x TNT"
    ),
    image: "bedrock-tnt-ai.png",
    parameters: [parameter("count", "Quantité de TNT", 1, 1, 1000)]
  }),
  effect({
    id: "bedrock-random-tnt",
    name: "TNT aléatoire",
    description: "Déclenche de la TNT avec une puissance aléatoire.",
    category: "TNT",
    commands: titled(
      "/bedrock randomtnt {{count}} {{viewer}}",
      "{{count}}x TNT hasard"
    ),
    image: "bedrock-random-tnt-ai.png",
    parameters: [parameter("count", "Quantité de TNT", 1, 1, 1000)]
  }),
  effect({
    id: "bedrock-super-tnt",
    name: "Super TNT",
    description: "Fait apparaître plusieurs TNT puissantes avec la force choisie.",
    category: "TNT",
    commands: titled(
      "/bedrock supertnt {{count}} {{power}} {{viewer}}",
      "{{count}}x Super TNT"
    ),
    image: "bedrock-super-tnt-ai.png",
    parameters: [
      parameter("count", "Quantité de TNT", 1, 1, 200),
      parameter("power", "Puissance", 2, 2, 20)
    ]
  }),
  effect({
    id: "bedrock-weak-tnt",
    name: "Weak TNT",
    description: "Déclenche la TNT faible ShenPulse avec le viewer cible.",
    category: "TNT",
    commands: titled(
      "/bedrock weaktnt {{count}} {{viewer}}",
      "{{count}}x Weak TNT"
    ),
    image: "bedrock-weak-tnt-ai.png",
    parameters: [parameter("count", "Quantité de TNT", 1, 1, 1000)]
  }),
  effect({
    id: "bedrock-fake-tnt",
    name: "Fake TNT",
    description: "Fait apparaître plusieurs TNT qui disparaissent sans exploser ni infliger de dégâts.",
    category: "TNT",
    commands: titled(
      "/bedrock faketnt {{count}} {{viewer}}",
      "{{count}}x Fake TNT"
    ),
    image: "bedrock-fake-tnt-ai.png",
    parameters: [parameter("count", "Quantité de TNT", 1, 1, 1000)]
  }),
  effect({
    id: "bedrock-tnt-rocket",
    name: "TNT Rocket",
    description: "Lance le nombre de fusées TNT choisi.",
    category: "TNT",
    commands: titled("/bedrock tntrocket {{count}}", "{{count}}x TNT Rocket"),
    image: "bedrock-tnt-rocket-ai.png",
    parameters: [parameter("count", "Nombre de fusées", 1, 1, 1000)]
  }),
  effect({
    id: "bedrock-tnt-step",
    name: "TNT Step",
    description: "Déclenche des TNT par étapes selon la quantité choisie.",
    category: "TNT",
    commands: titled("/bedrock tntstep {{count}}", "{{count}}x TNT Step"),
    image: "bedrock-tnt-step-ai.png",
    parameters: [parameter("count", "Quantité de TNT", 1, 1, 1000)]
  }),
  effect({
    id: "bedrock-zeus-tnt",
    name: "Zeus TNT",
    description: "Déclenche l’effet Zeus TNT du plugin Bedrock Box.",
    category: "TNT",
    commands: titled("/bedrock zeustnt", "Zeus TNT"),
    image: "bedrock-zeus-tnt.webp"
  }),
  effect({
    id: "bedrock-tnt-ring",
    name: "Anneau TNT",
    description: "Déclenche un anneau de TNT autour de la box.",
    category: "TNT",
    commands: titled("/bedrock tntring", "Anneau TNT"),
    image: "bedrock-tnt-ring-ai.png"
  }),
  effect({
    id: "bedrock-enderman",
    name: "Enderman",
    description: "Fait apparaître des Endermen pour le viewer cible.",
    category: "Entités",
    commands: titled(
      "/bedrock enderman {{count}} {{viewer}}",
      "{{count}}x Enderman"
    ),
    image: "bedrock-enderman.webp",
    parameters: [parameter("count", "Nombre d’Endermen", 1, 1, 100)]
  }),
  effect({
    id: "bedrock-blackhole",
    name: "Trou noir",
    description: "Affiche un grand trou noir au-dessus de la box et attire fortement joueurs, créatures et objets.",
    category: "Chaos",
    commands: titled(
      "/bedrock blackhole {{seconds}}",
      "{{seconds}}s Trou noir"
    ),
    image: "bedrock-blackhole.webp",
    parameters: [parameter("seconds", "Durée (secondes)", 10, 1, 300)]
  }),
  effect({
    id: "bedrock-meteor",
    name: "Météorite",
    description: "Fait tomber une météorite visible sur la box, puis déclenche son impact.",
    category: "Chaos",
    commands: titled("/bedrock meteor", "Météorite"),
    image: "bedrock-meteor.webp"
  }),
  effect({
    id: "bedrock-comets",
    name: "Comètes",
    description: "Fait tomber plusieurs comètes visibles pendant la durée et à l’intervalle choisis.",
    category: "Chaos",
    commands: titled(
      "/bedrock comets {{duration}} {{interval}}",
      "Comètes"
    ),
    image: "bedrock-comets.webp",
    parameters: [
      parameter("duration", "Durée (secondes)", 10, 1, 300),
      parameter("interval", "Intervalle (secondes)", 2, 1, 60)
    ]
  }),
  effect({
    id: "bedrock-longhands",
    name: "Long Hands",
    description: "Augmente réellement la portée des mains jusqu’à 12 blocs pendant la durée choisie.",
    category: "Joueur",
    commands: titled(
      "/bedrock longhands {{seconds}}",
      "{{seconds}}s Long Hands"
    ),
    image: "bedrock-longhands-ai.png",
    parameters: [parameter("seconds", "Durée (secondes)", 10, 1, 300)]
  }),
  effect({
    id: "bedrock-fill",
    name: "Remplir la box",
    description: "Remplit toute la box avec des blocs.",
    category: "Box",
    commands: titled("/bedrock fill", "Tout remplir"),
    image: "bedrock-fill-ai.png"
  }),
  effect({
    id: "bedrock-fill-rows",
    name: "Remplir des rangées",
    description: "Ajoute le nombre de rangées choisi dans la box.",
    category: "Box",
    commands: titled(
      "/bedrock fill {{rows}}",
      "{{rows}} rangées"
    ),
    image: "bedrock-fill-rows-ai.png",
    parameters: [parameter("rows", "Nombre de rangées", 1, 1, 20)]
  }),
  effect({
    id: "bedrock-fill-block",
    name: "Ajouter des blocs",
    description: "Ajoute exactement la quantité de blocs choisie.",
    category: "Box",
    commands: titled(
      "/bedrock fillblock {{count}}",
      "+{{count}} blocs"
    ),
    image: "bedrock-fill-block-ai.png",
    parameters: [parameter("count", "Nombre de blocs", 1, 1, 1000)]
  }),
  effect({
    id: "bedrock-clear",
    name: "Vider la box",
    description: "Retire les blocs posés dans la box.",
    category: "Box",
    commands: titled("/bedrock clear", "Tout vider"),
    image: "bedrock-clear-ai.png"
  }),
  effect({
    id: "bedrock-reset",
    name: "Reset box",
    description: "Vide, remet le verre et replace le joueur sur la box.",
    category: "Box",
    commands: [
      "/bedrock clear",
      "delay 250",
      "/bedrock glass",
      "delay 250",
      "/bedrock tp",
      '/title @a title "Reset"',
      '/title @a subtitle "{{viewer}}"'
    ],
    image: "bedrock-reset-ai.png"
  }),
  effect({
    id: "bedrock-reset-one",
    name: "Reset 1",
    description: "Déclenche le reset 1 natif du plugin Bedrock Box.",
    category: "Box",
    commands: titled("/bedrock reset 1", "Reset 1"),
    image: "bedrock-reset-ai.png"
  }),
  effect({
    id: "bedrock-reset-two",
    name: "Reset 2",
    description: "Déclenche le reset 2 natif du plugin Bedrock Box.",
    category: "Box",
    commands: titled("/bedrock reset 2", "Reset 2"),
    image: "bedrock-reset-ai.png"
  }),
  effect({
    id: "bedrock-glass",
    name: "Box en verre",
    description: "Remplace les murs et le sol par du verre.",
    category: "Box",
    commands: titled("/bedrock glass", "Verre"),
    image: "bedrock-glass-ai.png"
  }),
  effect({
    id: "bedrock-rock",
    name: "Box bedrock",
    description: "Remet les murs et le sol en bedrock.",
    category: "Box",
    commands: titled("/bedrock rock", "Bedrock"),
    image: "bedrock-rock-ai.png"
  }),
  effect({
    id: "bedrock-wood",
    name: "Box en bois",
    description: "Remplace les murs et le sol par du bois.",
    category: "Box",
    commands: titled("/bedrock wood", "Bois"),
    image: "bedrock-wood-ai.png"
  }),
  effect({
    id: "bedrock-glass-prison",
    name: "Prison de verre",
    description: "Bloque le joueur dans une prison de verre pendant la durée choisie.",
    category: "Joueur",
    commands: titled(
      "/bedrock glass_prison {{seconds}}",
      "{{seconds}}s Prison"
    ),
    image: "bedrock-glass-prison-ai.png",
    parameters: [parameter("seconds", "Durée (secondes)", 10, 1, 300)]
  }),
  effect({
    id: "bedrock-win-one",
    name: "WIN 1 Bedrock",
    description: "Déclenche la commande /bedrock win 1 du plugin.",
    category: "Partie",
    commands: titled("/bedrock win 1", "Bedrock WIN 1"),
    image: "bedrock-win-bedrock-ai.png"
  }),
  effect({
    id: "bedrock-win-two",
    name: "WIN 2 Bedrock",
    description: "Déclenche la commande /bedrock win 2 du plugin.",
    category: "Partie",
    commands: titled("/bedrock win 2", "Bedrock WIN 2"),
    image: "bedrock-win-bedrock-ai.png"
  }),
  effect({
    id: "bedrock-timer",
    name: "Timer WIN",
    description: "Change la durée du timer WIN Minecraft.",
    category: "Partie",
    commands: titled(
      "/bedrock timer {{seconds}}",
      "{{seconds}}s Timer"
    ),
    image: "bedrock-timer-ai.png",
    parameters: [parameter("seconds", "Durée (secondes)", 10, 1, 3600)]
  }),
  effect({
    id: "bedrock-tp",
    name: "Téléportation box",
    description: "Téléporte visiblement tous les joueurs connectés juste au-dessus de la box.",
    category: "Joueur",
    commands: titled("/bedrock tp", "TP Box"),
    image: "bedrock-tp-ai.png"
  }),
  effect({
    id: "bedrock-top-lock",
    name: "Blocage du haut",
    description: "Affiche son état puis active ou désactive le refus des blocs placés au-dessus de la limite.",
    category: "Box",
    commands: titled("/bedrock toplock", "Top Lock"),
    image: "bedrock-top-lock-ai.png"
  }),
  effect({
    id: "bedrock-auto-replace",
    name: "Auto replace",
    description: "Active ou désactive la conversion automatique des blocs placés vers le matériau attendu par la box.",
    category: "Box",
    commands: titled("/bedrock autoreplace", "Auto Replace"),
    image: "bedrock-auto-replace-ai.png"
  }),
  effect({
    id: "bedrock-fireworks",
    name: "Feux d’artifice",
    description: "Active ou désactive les feux d’artifice lors des explosions.",
    category: "Chaos",
    commands: titled("/bedrock fireworks", "Feux d’artifice"),
    image: "bedrock-fireworks-ai.png"
  }),
  effect({
    id: "bedrock-height-up",
    name: "Hauteur +",
    description: "Augmente la hauteur de la box.",
    category: "Dimensions",
    commands: titled(
      "/bedrock heightup {{count}}",
      "Hauteur +{{count}}"
    ),
    image: "bedrock-height-up-ai.png",
    parameters: [parameter("count", "Niveaux ajoutés", 1, 1, 10)]
  }),
  effect({
    id: "bedrock-height-down",
    name: "Hauteur -",
    description: "Diminue la hauteur de la box.",
    category: "Dimensions",
    commands: titled(
      "/bedrock heightdown {{count}}",
      "Hauteur -{{count}}"
    ),
    image: "bedrock-height-down-ai.png",
    parameters: [parameter("count", "Niveaux retirés", 1, 1, 10)]
  }),
  effect({
    id: "bedrock-radius-up",
    name: "Rayon +",
    description: "Agrandit le rayon de la box.",
    category: "Dimensions",
    commands: titled(
      "/bedrock radiusup {{count}}",
      "Rayon +{{count}}"
    ),
    image: "bedrock-radius-up-ai.png",
    parameters: [parameter("count", "Niveaux ajoutés", 1, 1, 10)]
  }),
  effect({
    id: "bedrock-radius-down",
    name: "Rayon -",
    description: "Réduit le rayon de la box.",
    category: "Dimensions",
    commands: titled(
      "/bedrock radiusdown {{count}}",
      "Rayon -{{count}}"
    ),
    image: "bedrock-radius-down-ai.png",
    parameters: [parameter("count", "Niveaux retirés", 1, 1, 10)]
  }),
  effect({
    id: "bedrock-diamond",
    name: "Diamant",
    description: "Ajoute un gros bonus de 250 blocs dans la box.",
    category: "Box",
    commands: titled("/bedrock fillblock 250", "Diamant"),
    image: "bedrock-diamond-ai.png"
  }),
  winEffect(
    "win-add",
    "Ajouter des WINS",
    "Ajoute la quantité choisie au compteur WINS.",
    "bedrock-win-add-ai.png",
    1,
    "adjust"
  ),
  winEffect(
    "win-remove",
    "Retirer des WINS",
    "Retire la quantité choisie du compteur WINS.",
    "bedrock-win-remove-ai.png",
    -1,
    "adjust"
  ),
  winEffect(
    "win-random",
    "WINS aléatoires",
    "Ajoute ou retire au hasard la quantité choisie.",
    "bedrock-win-random-ai.png",
    200,
    "random"
  ),
  winEffect(
    "win-x2",
    "X2 WINS",
    "Double temporairement les WINS gagnées ou perdues.",
    "bedrock-win-x2-ai.png",
    2,
    "multiplier"
  )
];

function sandboxColorEffects() {
  return SANDBOX_COLORS.flatMap(([id, commandColor, label]) => [
    effect({
      id: `sandbox-sand-${id}`,
      name: `Sable ${label}`,
      description: `Ajoute la quantité choisie de sable ${label} sur la plateforme SandBox.`,
      category: "Sable",
      commands: titled(
        `/sandbox sand ${commandColor} {{count}}`,
        "{{count}}x Sable"
      ),
      image: "bedrock-fill-ai.png",
      parameters: [parameter("count", "Quantité de sable", 1, 1, 1000)]
    }),
    effect({
      id: `sandbox-sand-row-${id}`,
      name: `Ligne sable ${label}`,
      description: `Ajoute le nombre de lignes de sable ${label} choisi dans SandBox.`,
      category: "Lignes de sable",
      commands: titled(
        `/sandbox sandrow ${commandColor} {{rows}}`,
        "{{rows}}x Ligne sable"
      ),
      image: "bedrock-fill-rows-ai.png",
      parameters: [parameter("rows", "Nombre de lignes", 1, 1, 20)]
    }),
    effect({
      id: `sandbox-fill-row-${id}`,
      name: `Remplir ligne ${label}`,
      description: `Vide la plateforme puis ajoute le nombre de lignes de sable ${label} choisi.`,
      category: "Remplissage",
      commands: titled(
        `/sandbox fillrow ${commandColor} {{rows}}`,
        "{{rows}}x Remplir ligne"
      ),
      image: "bedrock-fill-rows-ai.png",
      parameters: [parameter("rows", "Nombre de lignes", 1, 1, 20)]
    }),
    effect({
      id: `sandbox-set-default-sand-${id}`,
      name: `Sable initial ${label}`,
      description: `Définit le sable initial de victoire en ${label}.`,
      category: "Sable initial",
      commands: titled(
        `/sandbox setdefaultsand ${commandColor}`,
        `Sable initial ${label}`
      ),
      image: "bedrock-fill-ai.png"
    })
  ]);
}

const SANDBOX_EFFECTS = [
  ...sandboxColorEffects(),
  effect({
    id: "sandbox-block-break-speed",
    name: "Vitesse de casse",
    description: "Change durablement la vitesse de minage du sable.",
    category: "Joueur",
    commands: titled(
      "/sandbox set block_break_speed {{breakSpeed}}",
      "Vitesse de casse {{breakSpeed}}"
    ),
    image: "bedrock-timer-ai.png",
    parameters: [parameter("breakSpeed", "Vitesse de casse", 1, 1, 100)]
  }),
  effect({
    id: "sandbox-block-interaction-range",
    name: "Portée de minage",
    description: "Change durablement la portée de minage du sable.",
    category: "Joueur",
    commands: titled(
      "/sandbox set block_interaction_range {{range}}",
      "Portée {{range}}"
    ),
    image: "bedrock-radius-up-ai.png",
    parameters: [parameter("range", "Portée en blocs", 6, 1, 100)]
  }),
  effect({
    id: "sandbox-clear",
    name: "Vider le sable",
    description: "Retire tout le sable de la plateforme.",
    category: "Plateforme",
    commands: titled("/sandbox clear", "Vider SandBox"),
    image: "bedrock-clear-ai.png"
  }),
  effect({
    id: "sandbox-create",
    name: "Créer plateforme",
    description: "Crée la plateforme SandBox avec la taille et la hauteur choisies.",
    category: "Plateforme",
    commands: titled(
      "/sandbox create {{size}} {{height}}",
      "Créer {{size}}x{{size}}"
    ),
    image: "bedrock-fill-ai.png",
    parameters: [
      parameter("size", "Largeur de la plateforme", 11, 3, 99, 2),
      parameter("height", "Hauteur de la plateforme", 8, 1, 50)
    ]
  }),
  effect({
    id: "sandbox-delete",
    name: "Supprimer plateforme",
    description: "Supprime la plateforme et arrête le suivi du timer.",
    category: "Plateforme",
    commands: titled("/sandbox delete", "Supprimer SandBox"),
    image: "bedrock-clear-ai.png"
  }),
  effect({
    id: "sandbox-delete-row",
    name: "Retirer des lignes",
    description: "Retire le nombre de lignes de sable choisi en partant du bas.",
    category: "Plateforme",
    commands: titled(
      "/sandbox deleterow {{rows}}",
      "-{{rows}} lignes"
    ),
    image: "bedrock-clear-ai.png",
    parameters: [parameter("rows", "Nombre de lignes", 1, 1, 20)]
  }),
  effect({
    id: "sandbox-edit",
    name: "Édition plateforme",
    description: "Active ou désactive le mode édition des blocs de plateforme.",
    category: "Plateforme",
    commands: titled("/sandbox edit", "Édition plateforme"),
    image: "bedrock-auto-replace-ai.png"
  }),
  effect({
    id: "sandbox-fill",
    name: "Remplir plateforme",
    description: "Remplit toute la plateforme avec le sable configuré.",
    category: "Plateforme",
    commands: titled("/sandbox fill", "Remplir SandBox"),
    image: "bedrock-fill-ai.png"
  }),
  effect({
    id: "sandbox-glass",
    name: "Sol en verre",
    description: "Remplace le sol de la plateforme par du verre.",
    category: "Plateforme",
    commands: titled("/sandbox glass", "Sol en verre"),
    image: "bedrock-glass-ai.png"
  }),
  effect({
    id: "sandbox-lightning",
    name: "Éclairs",
    description: "Déclenche le nombre d’éclairs explosifs choisi dans SandBox.",
    category: "Chaos",
    commands: titled(
      "/sandbox lightning {{count}}",
      "{{count}}x Éclairs"
    ),
    image: "bedrock-fireworks-ai.png",
    parameters: [parameter("count", "Nombre d’éclairs", 3, 1, 100)]
  }),
  effect({
    id: "sandbox-prison",
    name: "Prison SandBox",
    description: "Bloque le joueur dans la prison SandBox pendant la durée choisie.",
    category: "Joueur",
    commands: titled(
      "/sandbox prison {{seconds}}",
      "{{seconds}}s Prison"
    ),
    image: "bedrock-glass-prison-ai.png",
    parameters: [parameter("seconds", "Durée (secondes)", 10, 1, 300)]
  }),
  effect({
    id: "sandbox-random-row",
    name: "Ligne aléatoire",
    description: "Ajoute le nombre de lignes aléatoires choisi.",
    category: "Lignes de sable",
    commands: titled(
      "/sandbox randomrow {{rows}}",
      "{{rows}}x Ligne aléatoire"
    ),
    image: "bedrock-fill-rows-ai.png",
    parameters: [parameter("rows", "Nombre de lignes", 1, 1, 20)]
  }),
  effect({
    id: "sandbox-rock",
    name: "Centre bedrock",
    description: "Change le centre de la plateforme en bedrock.",
    category: "Plateforme",
    commands: titled("/sandbox rock", "Centre bedrock"),
    image: "bedrock-rock-ai.png"
  }),
  effect({
    id: "sandbox-shovel",
    name: "Pelle enchantée",
    description: "Donne une pelle obsidienne enchantée au joueur.",
    category: "Joueur",
    commands: titled("/sandbox shovel", "Pelle enchantée"),
    image: "bedrock-diamond-ai.png"
  }),
  effect({
    id: "sandbox-speed",
    name: "Vitesse du sable",
    description: "Change la vitesse de minage du sable.",
    category: "Joueur",
    commands: titled(
      "/sandbox speed {{speed}}",
      "Vitesse du sable {{speed}}"
    ),
    image: "bedrock-timer-ai.png",
    parameters: [parameter("speed", "Vitesse", 1, 1, 100)]
  }),
  effect({
    id: "sandbox-stop",
    name: "Stop timer",
    description: "Arrête le timer SandBox.",
    category: "Partie",
    commands: titled("/sandbox stop", "Stop timer"),
    image: "bedrock-timer-ai.png"
  }),
  effect({
    id: "sandbox-timer",
    name: "Timer SandBox",
    description: "Définit une nouvelle durée pour le timer de victoire.",
    category: "Partie",
    commands: titled(
      "/sandbox timer {{seconds}}",
      "{{seconds}}s Timer"
    ),
    image: "bedrock-timer-ai.png",
    parameters: [parameter("seconds", "Durée (secondes)", 60, 1, 3600)]
  }),
  effect({
    id: "sandbox-tnt",
    name: "TNT SandBox",
    description: "Déclenche la quantité de TNT choisie sur le joueur.",
    category: "TNT",
    commands: titled(
      "/sandbox tnt {{count}} {{viewer}}",
      "{{count}}x TNT"
    ),
    image: "bedrock-tnt-ai.png",
    parameters: [parameter("count", "Quantité de TNT", 1, 1, 1000)]
  }),
  effect({
    id: "sandbox-tnt-near",
    name: "TNT proche",
    description: "Déclenche la quantité de TNT choisie près du joueur.",
    category: "TNT",
    commands: titled(
      "/sandbox tntnear {{count}}",
      "{{count}}x TNT proche"
    ),
    image: "bedrock-random-tnt-ai.png",
    parameters: [parameter("count", "Quantité de TNT", 1, 1, 1000)]
  }),
  effect({
    id: "sandbox-tp",
    name: "Téléportation plateforme",
    description: "Téléporte le joueur principal sur la plateforme SandBox.",
    category: "Joueur",
    commands: titled("/sandbox tp", "TP SandBox"),
    image: "bedrock-tp-ai.png"
  }),
  effect({
    id: "sandbox-wood",
    name: "Sol en bois",
    description: "Remplace le sol de la plateforme par du bois.",
    category: "Plateforme",
    commands: titled("/sandbox wood", "Sol en bois"),
    image: "bedrock-wood-ai.png"
  }),
  winEffect(
    "win-add",
    "Ajouter des WINS",
    "Ajoute la quantité choisie au compteur WINS.",
    "bedrock-win-add-ai.png",
    1,
    "adjust"
  ),
  winEffect(
    "win-remove",
    "Retirer des WINS",
    "Retire la quantité choisie du compteur WINS.",
    "bedrock-win-remove-ai.png",
    -1,
    "adjust"
  ),
  winEffect(
    "win-random",
    "WINS aléatoires",
    "Ajoute ou retire au hasard la quantité choisie.",
    "bedrock-win-random-ai.png",
    200,
    "random"
  ),
  winEffect(
    "win-x2",
    "X2 WINS",
    "Double temporairement les WINS gagnées ou perdues.",
    "bedrock-win-x2-ai.png",
    2,
    "multiplier"
  )
];

function mapping(id, effectId, title, options = {}) {
  return Object.freeze({
    id,
    effectId,
    title,
    triggerType: options.triggerType || "gift",
    threshold: Number(options.threshold || 1),
    giftName: options.giftName || "",
    cooldownSeconds: Number(options.cooldownSeconds || 0),
    parameters: Object.freeze({ ...(options.parameters || {}) }),
    amount: options.amount,
    operation: options.operation,
    duration: options.duration,
    enabled: options.enabled !== false
  });
}

const BEDROCK_DEFAULT_MAPPINGS = [
  mapping("bedrock-follow-tnt-1", "bedrock-tnt", "1x TNT", {
    triggerType: "follow",
    parameters: { count: 1 }
  }),
  mapping("bedrock-likes-150-tnt-1", "bedrock-tnt", "1x TNT", {
    triggerType: "like",
    threshold: 150,
    parameters: { count: 1 }
  }),
  mapping("bedrock-rose-tnt", "bedrock-tnt", "1x TNT", {
    giftName: "Rose",
    parameters: { count: 1 }
  }),
  mapping("bedrock-finger-heart-tnt-3", "bedrock-tnt", "3x TNT", {
    giftName: "Finger Heart",
    parameters: { count: 3 }
  }),
  mapping("bedrock-doughnut-tnt-20", "bedrock-tnt", "20x TNT", {
    giftName: "Doughnut",
    parameters: { count: 20 }
  }),
  mapping("bedrock-cap-tnt-80", "bedrock-tnt", "80x TNT", {
    giftName: "Cap",
    parameters: { count: 80 }
  }),
  mapping("bedrock-forever-rosa-tnt-1000", "bedrock-tnt", "1000x TNT", {
    giftName: "Forever Rosa",
    parameters: { count: 1000 }
  }),
  mapping("bedrock-heart-me-fillblock-5", "bedrock-fill-block", "+5 blocs", {
    giftName: "Heart Me",
    parameters: { count: 5 }
  }),
  mapping("bedrock-tofu-fillblock-30", "bedrock-fill-block", "+30 blocs", {
    giftName: "Tofu",
    parameters: { count: 30 }
  }),
  mapping("bedrock-perfume-fillblock-100", "bedrock-fill-block", "+100 blocs", {
    giftName: "Perfume",
    parameters: { count: 100 }
  }),
  mapping("bedrock-boxing-gloves-reset", "bedrock-reset", "Reset", {
    giftName: "Boxing Gloves"
  }),
  mapping("bedrock-elephant-trunk-fill", "bedrock-fill", "Tout remplir", {
    giftName: "Elephant Trunk"
  }),
  mapping("bedrock-corgi-win-x2", "win-x2", "X2 WIN", {
    giftName: "Corgi",
    amount: 2,
    operation: "multiplier",
    duration: 60
  }),
  mapping("bedrock-money-gun-win-minus-1", "win-remove", "-1 WIN", {
    giftName: "Money Gun",
    amount: -1,
    operation: "adjust"
  }),
  mapping("bedrock-youre-amazing-win-plus-1", "win-add", "+1 WIN", {
    giftName: "You’re Amazing",
    amount: 1,
    operation: "adjust"
  }),
  mapping("bedrock-ellie-elephant-win-plus-20", "win-add", "+20 WINS", {
    giftName: "Ellie the Elephant",
    amount: 20,
    operation: "adjust"
  }),
  mapping("bedrock-girafa-win-minus-3", "win-remove", "-3 WINS", {
    giftName: "Girafa",
    amount: -3,
    operation: "adjust"
  }),
  mapping("bedrock-leon-kitten-win-minus-20", "win-remove", "-20 WINS", {
    giftName: "Leon the Kitten",
    amount: -20,
    operation: "adjust"
  }),
  mapping("bedrock-voiture-course-win-minus-50", "win-remove", "-50 WINS", {
    giftName: "Voiture de course",
    amount: -50,
    operation: "adjust"
  }),
  mapping("bedrock-lion-win-random-200", "win-random", "+/- 200 WINS", {
    giftName: "Lion",
    amount: 200,
    operation: "random"
  }),
  mapping("bedrock-galaxy-win-plus-3", "win-add", "+3 WINS", {
    giftName: "Galaxy",
    amount: 3,
    operation: "adjust"
  }),
  mapping("bedrock-interstellar-win-plus-45", "win-add", "+45 WINS", {
    giftName: "Interstellar",
    amount: 45,
    operation: "adjust"
  }),
  mapping("bedrock-gg-fillblock-5", "bedrock-fill-block", "+5 blocs", {
    giftName: "GG",
    parameters: { count: 5 }
  }),
  mapping("bedrock-cote-a-cote-blackhole", "bedrock-blackhole", "Trou noir", {
    giftName: "Côte à Côte",
    parameters: { seconds: 10 }
  }),
  mapping("bedrock-urso-misha-tnt-ring", "bedrock-tnt-ring", "Anneau TNT", {
    giftName: "Urso Misha"
  }),
  mapping("bedrock-panda-escalador-zeus-tnt", "bedrock-zeus-tnt", "Zeus TNT", {
    giftName: "Panda Escalador"
  }),
  mapping("bedrock-go-popular-enderman", "bedrock-enderman", "Enderman", {
    giftName: "Go Popular",
    parameters: { count: 1 }
  }),
  mapping("bedrock-family-fireworks", "bedrock-fireworks", "Feux d’artifice", {
    giftName: "Family"
  })
];

const SANDBOX_DEFAULT_MAPPINGS = [
  mapping("sandbox-follow-tnt-1", "sandbox-tnt", "1x TNT", {
    triggerType: "follow",
    parameters: { count: 1 }
  }),
  mapping("sandbox-likes-150-tnt-1", "sandbox-tnt", "1x TNT", {
    triggerType: "like",
    threshold: 150,
    parameters: { count: 1 }
  }),
  mapping("sandbox-rose-red-sand", "sandbox-sand-red", "1x Sable rouge", {
    giftName: "Rose",
    parameters: { count: 1 }
  }),
  mapping("sandbox-tiktok-blue-row", "sandbox-sand-row-blue", "Ligne bleue", {
    giftName: "TikTok",
    parameters: { rows: 1 }
  }),
  mapping("sandbox-gg-random-row", "sandbox-random-row", "Ligne hasard", {
    giftName: "GG",
    parameters: { rows: 1 }
  }),
  mapping("sandbox-finger-heart-tnt", "sandbox-tnt", "1x TNT", {
    giftName: "Finger Heart",
    parameters: { count: 1 },
    cooldownSeconds: 2
  }),
  mapping("sandbox-heart-me-fillrow", "sandbox-fill-row-magenta", "2x Fill row", {
    giftName: "Heart Me",
    parameters: { rows: 2 },
    cooldownSeconds: 3
  }),
  mapping("sandbox-perfume-tntnear", "sandbox-tnt-near", "3x TNT proche", {
    giftName: "Perfume",
    parameters: { count: 3 },
    cooldownSeconds: 4
  }),
  mapping("sandbox-cap-prison", "sandbox-prison", "Prison", {
    giftName: "Cap",
    parameters: { seconds: 10 },
    cooldownSeconds: 5
  }),
  mapping("sandbox-fireworks-lightning", "sandbox-lightning", "Éclairs", {
    giftName: "Fireworks",
    parameters: { count: 3 },
    cooldownSeconds: 5
  }),
  mapping("sandbox-corgi-win-x2", "win-x2", "X2 WIN", {
    giftName: "Corgi",
    amount: 2,
    operation: "multiplier",
    duration: 60
  }),
  mapping("sandbox-money-gun-win-minus-1", "win-remove", "-1 WIN", {
    giftName: "Money Gun",
    amount: -1,
    operation: "adjust"
  }),
  mapping("sandbox-youre-amazing-win-plus-1", "win-add", "+1 WIN", {
    giftName: "You’re Amazing",
    amount: 1,
    operation: "adjust"
  }),
  mapping("sandbox-ellie-elephant-win-plus-20", "win-add", "+20 WINS", {
    giftName: "Ellie the Elephant",
    amount: 20,
    operation: "adjust"
  }),
  mapping("sandbox-girafa-win-minus-3", "win-remove", "-3 WINS", {
    giftName: "Girafa",
    amount: -3,
    operation: "adjust"
  }),
  mapping("sandbox-leon-kitten-win-minus-20", "win-remove", "-20 WINS", {
    giftName: "Leon the Kitten",
    amount: -20,
    operation: "adjust"
  }),
  mapping("sandbox-voiture-course-win-minus-55", "win-remove", "-55 WINS", {
    giftName: "Voiture de course",
    amount: -55,
    operation: "adjust"
  }),
  mapping("sandbox-lion-win-random-200", "win-random", "+/- 200 WINS", {
    giftName: "Lion",
    amount: 200,
    operation: "random"
  })
];

function withSortOrder(effects) {
  return Object.freeze(
    effects.map((entry, index) =>
      Object.freeze({ ...entry, sortOrder: index })
    )
  );
}

const MINECRAFT_BEDROCK_EFFECTS = withSortOrder(BEDROCK_EFFECTS);
const MINECRAFT_SANDBOX_EFFECTS = withSortOrder(SANDBOX_EFFECTS);

module.exports = {
  MINECRAFT_BEDROCK_DEFAULT_MAPPINGS: Object.freeze(
    BEDROCK_DEFAULT_MAPPINGS
  ),
  MINECRAFT_BEDROCK_EFFECTS,
  MINECRAFT_BEDROCK_INTERACTION_CATALOG_VERSION: CATALOG_VERSION,
  MINECRAFT_SANDBOX_DEFAULT_MAPPINGS: Object.freeze(
    SANDBOX_DEFAULT_MAPPINGS
  ),
  MINECRAFT_SANDBOX_EFFECTS,
  MINECRAFT_SANDBOX_INTERACTION_CATALOG_VERSION: CATALOG_VERSION,
  SANDBOX_COLORS
};
