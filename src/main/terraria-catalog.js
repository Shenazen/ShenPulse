"use strict";

const GAME_ID = "terraria";
const IMAGE_ROOT = `../../resources/game-interactions/${GAME_ID}`;

const RAW_EFFECTS = [
  effect("terraria-random-slime", "golden_slime_rain", "Pluie de slimes dorés", "Apparitions", "Déclenche une pluie de slimes dorés.", "random-slime"),
  effect("terraria-all-bosses", "random_boss", "Boss aléatoire", "Boss et événements", "Invoque un boss compatible avec la progression du monde.", "all-bosses"),
  effect("terraria-dynamite", "explode_player", "Dynamite", "Pièges", "Déclenche une explosion de dynamite sur le joueur.", "dynamite"),
  effect("terraria-web-trap", "cobweb_trap", "Piège de toiles", "Pièges", "Enferme temporairement le joueur dans des toiles.", "web-trap"),
  effect("terraria-sand-trap", "sand_trap", "Piège de sable", "Pièges", "Enferme le joueur dans une masse de sable.", "sand-trap"),
  effect("terraria-random-teleport", "random_teleport", "Téléportation aléatoire", "Déplacement", "Téléporte le joueur à un emplacement aléatoire sûr.", "random-teleport"),
  effect("terraria-spawn-random-npc", "spawn_town_npc", "Faire apparaître un PNJ", "Apparitions", "Fait apparaître un PNJ de ville aléatoire.", "spawn-random-npc"),
  effect("terraria-spawn-friendly-bees", "not_the_bees", "Essaim d’abeilles", "Apparitions", "Déclenche un essaim d’abeilles autour du joueur.", "spawn-friendly-bees"),
  effect("terraria-boss-run", "random_boss", "BOSS RUN", "Boss et événements", "Lance un combat de boss aléatoire compatible avec le monde.", "boss-run"),
  parameterEffect("terraria-decrease-hp", "damage_player", "Retirer de la vie", "Joueur", "Inflige le nombre de dégâts choisi au joueur.", "decrease-hp", "amount", "Dégâts", 10, 500, 50, 5),
  parameterEffect("terraria-increase-hp", "heal_player", "Ajouter de la vie", "Joueur", "Soigne le joueur du nombre de points choisi.", "increase-hp", "amount", "Points de vie", 10, 500, 50, 5),
  timedEffect("terraria-bombs-rain", "shoot_bombs", "Pluie de bombes", "Pièges", "Fait tomber ou tirer des bombes pendant la durée choisie.", "bombs-rain", 10, 120),
  timedEffect("terraria-blind", "buff_blind", "Aveugler", "Effets temporaires", "Réduit fortement la vision du joueur.", "blind", 20, 300),
  timedEffect("terraria-confuse", "buff_confuse", "Confusion", "Effets temporaires", "Inverse temporairement les contrôles du joueur.", "confuse", 20, 300),
  timedEffect("terraria-freeze", "buff_freeze", "Geler", "Effets temporaires", "Immobilise temporairement le joueur.", "freeze", 10, 120),
  timedEffect("terraria-gravitation", "buff_levitate", "Gravitation", "Effets temporaires", "Applique temporairement un effet de lévitation.", "gravitation", 20, 300),
  timedEffect("terraria-spelunker", "buff_treasure", "Spéléologue", "Aide", "Révèle temporairement les trésors et minerais proches.", "spelunker", 30, 600),
  timedEffect("terraria-shimmer", "buff_shimmer", "Scintillement", "Effets temporaires", "Applique temporairement l’effet de scintillement.", "shimmer", 20, 300),
  timedEffect("terraria-ghost", "buff_invisible", "Fantôme", "Effets temporaires", "Rend temporairement le joueur invisible.", "ghost", 20, 300),
  timedEffect("terraria-rainbow", "rainbow_feet", "Arc-en-ciel", "Effets temporaires", "Ajoute temporairement un effet arc-en-ciel au joueur.", "rainbow", 20, 300),
  timedEffect("terraria-shake-screen", "screen_shake", "Secouer l’écran", "Contrôle", "Secoue l’écran pendant la durée choisie.", "shake-screen", 5, 60),
  effect("terraria-spawn-boss", "random_boss", "Invoquer un boss", "Boss et événements", "Invoque un boss aléatoire compatible avec le monde.", "spawn-boss"),
  quantityEffect("terraria-spawn-entity", "spawn_critters", "Faire apparaître des créatures", "Apparitions", "Fait apparaître le nombre choisi de créatures autour du joueur.", "spawn-entity", "count", "Nombre de créatures", 1, 50, 1),
  effect("terraria-summon-event", "weather_rain", "Déclencher un événement", "Boss et événements", "Déclenche un événement météorologique dans le monde.", "summon-event"),
  quantityEffect("terraria-give-item", "give_sword", "Donner un objet", "Aide", "Donne au joueur le nombre choisi d’épées.", "give-item", "count", "Quantité", 1, 99, 1)
];

const TERRARIA_EFFECTS = Object.freeze(
  RAW_EFFECTS.map((entry, index) => ({
    ...entry,
    available: true,
    service: "native",
    sortOrder: index
  }))
);

const DEFAULT_EFFECT_IDS = new Set([
  "terraria-spawn-friendly-bees",
  "terraria-increase-hp",
  "terraria-random-slime",
  "terraria-decrease-hp",
  "terraria-random-teleport",
  "terraria-freeze",
  "terraria-dynamite",
  "terraria-web-trap",
  "terraria-sand-trap",
  "terraria-boss-run"
]);

const TERRARIA_DEFAULT_MAPPINGS = Object.freeze([
  mapping("terraria-follow-spawn-friendly-bees", "terraria-spawn-friendly-bees", "Essaim d’abeilles", {
    triggerType: "follow",
    enabled: false
  }),
  mapping("terraria-likes-increase-hp", "terraria-increase-hp", "Ajouter de la vie", {
    triggerType: "like",
    threshold: 100,
    enabled: false,
    parameters: { amount: 50 }
  }),
  gift("terraria-rose-random-slime", "terraria-random-slime", "Pluie de slimes dorés", "Rose"),
  gift("terraria-finger-heart-decrease-hp", "terraria-decrease-hp", "Retirer de la vie", "Finger Heart", {
    parameters: { amount: 50 }
  }),
  gift("terraria-tiktok-random-teleport", "terraria-random-teleport", "Téléportation aléatoire", "TikTok"),
  gift("terraria-perfume-freeze", "terraria-freeze", "Geler", "Perfume", {
    duration: 10,
    parameters: { seconds: 10 }
  }),
  gift("terraria-gg-dynamite", "terraria-dynamite", "Dynamite", "GG"),
  gift("terraria-cap-web-trap", "terraria-web-trap", "Piège de toiles", "Cap"),
  gift("terraria-heart-me-sand-trap", "terraria-sand-trap", "Piège de sable", "Heart Me", {
    enabled: false
  }),
  gift("terraria-galaxy-boss-run", "terraria-boss-run", "BOSS RUN", "Galaxy"),
  ...TERRARIA_EFFECTS
    .filter((entry) => !DEFAULT_EFFECT_IDS.has(entry.id))
    .map((entry) =>
      mapping(`catalog-${entry.id}`, entry.id, entry.name, {
        enabled: false,
        triggerEnabled: false,
        parameters: defaultParameters(entry)
      })
    )
]);

function effect(id, code, name, category, description, imageName) {
  return {
    id,
    code,
    name,
    category,
    description,
    image: `${IMAGE_ROOT}/${imageName}.png`,
    icon: iconForCategory(category),
    quantity: 1,
    duration: 0
  };
}

function parameterEffect(
  id,
  code,
  name,
  category,
  description,
  imageName,
  parameterId,
  label,
  min,
  max,
  defaultValue,
  step = 1
) {
  return {
    ...effect(id, code, name, category, description, imageName),
    parameters: [
      parameter(parameterId, label, min, max, defaultValue, step)
    ]
  };
}

function quantityEffect(
  id,
  code,
  name,
  category,
  description,
  imageName,
  parameterId,
  label,
  min,
  max,
  defaultValue
) {
  return {
    ...parameterEffect(
      id,
      code,
      name,
      category,
      description,
      imageName,
      parameterId,
      label,
      min,
      max,
      defaultValue
    ),
    quantityParameter: parameterId
  };
}

function timedEffect(
  id,
  code,
  name,
  category,
  description,
  imageName,
  seconds,
  maxSeconds
) {
  return {
    ...effect(id, code, name, category, description, imageName),
    duration: seconds,
    durationParameter: "seconds",
    parameters: [
      parameter("seconds", "Durée (secondes)", 1, maxSeconds, seconds)
    ]
  };
}

function parameter(id, label, min, max, defaultValue, step = 1) {
  return { id, label, min, max, defaultValue, step };
}

function defaultParameters(entry) {
  return Object.fromEntries(
    (entry.parameters || []).map((item) => [
      item.id,
      item.defaultValue
    ])
  );
}

function gift(id, effectId, title, giftName, options = {}) {
  return mapping(id, effectId, title, {
    ...options,
    triggerType: "gift",
    giftName
  });
}

function mapping(id, effectId, title, options = {}) {
  return {
    id,
    effectId,
    title,
    triggerType: options.triggerType || "gift",
    giftName: options.giftName || "",
    threshold: Math.max(1, Number(options.threshold || 1)),
    cooldownSeconds: Math.max(0, Number(options.cooldownSeconds || 0)),
    duration: Math.max(0, Number(options.duration || 0)),
    enabled: options.enabled !== false,
    triggerEnabled: options.triggerEnabled !== false,
    parameters: { ...(options.parameters || {}) }
  };
}

function iconForCategory(category) {
  return {
    Aide: "✚",
    Apparitions: "♟",
    "Boss et événements": "♛",
    Contrôle: "⌁",
    Déplacement: "⌁",
    "Effets temporaires": "✦",
    Joueur: "♥",
    Pièges: "⚠"
  }[category] || "◇";
}

module.exports = {
  TERRARIA_DEFAULT_MAPPINGS,
  TERRARIA_EFFECTS,
  TERRARIA_GAME_ID: GAME_ID,
  TERRARIA_INTERACTION_CATALOG_VERSION: 1
};
