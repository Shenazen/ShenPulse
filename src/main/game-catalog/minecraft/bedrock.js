"use strict";

/** Données et règles du domaine Minecraft « bedrock » ; identifiants publics inchangés. */
const { parameter, effect, titled, winEffect } = require("./builders");

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

module.exports = { BEDROCK_EFFECTS };

