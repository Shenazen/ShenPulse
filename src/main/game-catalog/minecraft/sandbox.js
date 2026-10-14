"use strict";

/** Données et règles du domaine Minecraft « sandbox » ; identifiants publics inchangés. */
const { SANDBOX_COLORS, parameter, effect, titled, winEffect } = require("./builders");

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

module.exports = { sandboxColorEffects, SANDBOX_EFFECTS };

