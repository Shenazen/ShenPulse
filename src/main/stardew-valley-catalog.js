"use strict";

const GAME_ID = "stardew-valley";
const IMAGE_ROOT = `../../resources/game-interactions/${GAME_ID}`;

const RAW_EFFECTS = [
  quantityEffect(
    "stardew-spawn-mob",
    "spawn_slime",
    "Faire apparaître des monstres",
    "Apparitions",
    "Fait apparaître des slimes hostiles près du joueur.",
    "spawn-mob",
    "count",
    "Nombre de monstres",
    1,
    20,
    1
  ),
  quantityEffect(
    "stardew-give-item",
    "give_diamond",
    "Donner un objet",
    "Ressources",
    "Ajoute des diamants dans l’inventaire du joueur.",
    "give-item",
    "count",
    "Quantité",
    1,
    99,
    1
  ),
  effect(
    "stardew-warp",
    "warp_farm",
    "Téléportation",
    "Déplacement",
    "Téléporte le joueur à la ferme.",
    "warp"
  ),
  timedEffect(
    "stardew-adrenaline-rush",
    "give_buff_adrenaline",
    "Poussée d’adrénaline",
    "Effets temporaires",
    "Augmente temporairement la vitesse du joueur.",
    "adrenaline-rush",
    20,
    300
  ),
  timedEffect(
    "stardew-darkness",
    "give_buff_darkness",
    "Obscurité",
    "Effets temporaires",
    "Assombrit fortement l’écran pendant la durée choisie.",
    "darkness",
    20,
    300
  ),
  timedEffect(
    "stardew-frozen",
    "give_buff_frozen",
    "Gelé",
    "Effets temporaires",
    "Ralentit fortement le joueur pendant la durée choisie.",
    "frozen",
    10,
    120
  ),
  timedEffect(
    "stardew-nauseous",
    "give_buff_nauseous",
    "Nausée",
    "Effets temporaires",
    "Empêche temporairement le joueur de manger ou de boire.",
    "nauseous",
    20,
    300
  ),
  timedEffect(
    "stardew-tipsy",
    "give_buff_tipsy",
    "Éméché",
    "Effets temporaires",
    "Applique temporairement l’effet éméché au joueur.",
    "tipsy",
    20,
    300
  ),
  timedEffect(
    "stardew-slimed",
    "give_buff_slime",
    "Englué",
    "Effets temporaires",
    "Applique temporairement l’effet de slime au joueur.",
    "slimed",
    20,
    300
  ),
  effect(
    "stardew-heal",
    "heal_full",
    "Soigner complètement",
    "Joueur",
    "Restaure complètement la santé du joueur.",
    "heal"
  ),
  variantEffect(
    "stardew-hurt",
    "hurt_25",
    "Blesser",
    "Joueur",
    "Inflige le nombre de points de dégâts choisi.",
    "hurt",
    "amount",
    "Dégâts",
    10,
    50,
    25,
    { 10: "hurt_10", 25: "hurt_25", 50: "hurt_50" }
  ),
  variantEffect(
    "stardew-energy-restore",
    "energize_50",
    "Restaurer l’énergie",
    "Joueur",
    "Restaure une partie ou toute l’énergie du joueur.",
    "energy-restore",
    "amount",
    "Énergie restaurée",
    10,
    100,
    50,
    {
      10: "energize_10",
      25: "energize_25",
      50: "energize_50",
      100: "energize_full"
    }
  ),
  variantEffect(
    "stardew-energy-drain",
    "tire_50",
    "Retirer de l’énergie",
    "Joueur",
    "Retire la quantité d’énergie choisie au joueur.",
    "energy-drain",
    "amount",
    "Énergie retirée",
    10,
    50,
    50,
    { 10: "tire_10", 25: "tire_25", 50: "tire_50" }
  ),
  variantEffect(
    "stardew-give-money",
    "give_money_1000",
    "Donner de l’argent",
    "Ressources",
    "Ajoute la somme choisie au portefeuille du joueur.",
    "give-money",
    "amount",
    "Somme donnée",
    100,
    10000,
    1000,
    {
      100: "give_money_100",
      1000: "give_money_1000",
      10000: "give_money_10000"
    }
  ),
  variantEffect(
    "stardew-take-money",
    "remove_money_1000",
    "Retirer de l’argent",
    "Ressources",
    "Retire la somme choisie au portefeuille du joueur.",
    "take-money",
    "amount",
    "Somme retirée",
    100,
    10000,
    1000,
    {
      100: "remove_money_100",
      1000: "remove_money_1000",
      10000: "remove_money_10000"
    }
  ),
  timedEffect(
    "stardew-immortality",
    "give_buff_invincibility",
    "Invincibilité",
    "Effets temporaires",
    "Protège temporairement le joueur contre les dégâts.",
    "immortality",
    20,
    300
  ),
  effect(
    "stardew-instant-kill",
    "kill",
    "Mort instantanée",
    "Joueur",
    "Met immédiatement le joueur K.-O.",
    "instant-kill"
  ),
  effect(
    "stardew-random-hair-style",
    "hair_style",
    "Coiffure aléatoire",
    "Personnalisation",
    "Change aléatoirement la coiffure du joueur.",
    "random-hair-style"
  ),
  toolEffect("stardew-axe-upgrade", "upgrade_axe", "Améliorer la hache", "Améliore la hache d’un niveau.", "axe-upgrade"),
  toolEffect("stardew-axe-downgrade", "downgrade_axe", "Rétrograder la hache", "Rétrograde la hache d’un niveau.", "axe-downgrade"),
  toolEffect("stardew-pickaxe-upgrade", "upgrade_pickaxe", "Améliorer la pioche", "Améliore la pioche d’un niveau.", "pickaxe-upgrade"),
  toolEffect("stardew-pickaxe-downgrade", "downgrade_pickaxe", "Rétrograder la pioche", "Rétrograde la pioche d’un niveau.", "pickaxe-downgrade"),
  toolEffect("stardew-hoe-upgrade", "upgrade_hoe", "Améliorer la houe", "Améliore la houe d’un niveau.", "hoe-upgrade"),
  toolEffect("stardew-hoe-downgrade", "downgrade_hoe", "Rétrograder la houe", "Rétrograde la houe d’un niveau.", "hoe-downgrade"),
  toolEffect("stardew-watering-can-upgrade", "upgrade_wateringcan", "Améliorer l’arrosoir", "Améliore l’arrosoir d’un niveau.", "watering-can-upgrade"),
  toolEffect("stardew-watering-can-downgrade", "downgrade_wateringcan", "Rétrograder l’arrosoir", "Rétrograde l’arrosoir d’un niveau.", "watering-can-downgrade"),
  toolEffect("stardew-fishing-rod-upgrade", "upgrade_fishingrod", "Améliorer la canne à pêche", "Améliore la canne à pêche d’un niveau.", "fishing-rod-upgrade"),
  toolEffect("stardew-fishing-rod-downgrade", "downgrade_fishingrod", "Rétrograder la canne à pêche", "Rétrograde la canne à pêche d’un niveau.", "fishing-rod-downgrade")
];

const STARDEW_VALLEY_EFFECTS = Object.freeze(
  RAW_EFFECTS.map((entry, index) => ({
    ...entry,
    available: true,
    service: "native",
    sortOrder: index
  }))
);

const DEFAULT_EFFECT_IDS = new Set([
  "stardew-spawn-mob",
  "stardew-heal",
  "stardew-give-item",
  "stardew-hurt",
  "stardew-energy-restore",
  "stardew-frozen",
  "stardew-warp",
  "stardew-give-money",
  "stardew-energy-drain",
  "stardew-instant-kill"
]);

const STARDEW_VALLEY_DEFAULT_MAPPINGS = Object.freeze([
  mapping("stardew-follow-spawn-mob", "stardew-spawn-mob", "Faire apparaître des monstres", {
    triggerType: "follow",
    enabled: false,
    parameters: { count: 1 }
  }),
  mapping("stardew-likes-heal", "stardew-heal", "Soigner complètement", {
    triggerType: "like",
    threshold: 100,
    enabled: false
  }),
  gift("stardew-rose-give-item", "stardew-give-item", "Donner un objet", "Rose", {
    parameters: { count: 1 }
  }),
  gift("stardew-finger-heart-hurt", "stardew-hurt", "Blesser", "Finger Heart", {
    parameters: { amount: 25 }
  }),
  gift("stardew-tiktok-energy-restore", "stardew-energy-restore", "Restaurer l’énergie", "TikTok", {
    parameters: { amount: 50 }
  }),
  gift("stardew-perfume-frozen", "stardew-frozen", "Geler le joueur", "Perfume", {
    duration: 10,
    parameters: { seconds: 10 }
  }),
  gift("stardew-gg-warp", "stardew-warp", "Téléporter à la ferme", "GG"),
  gift("stardew-cap-give-money", "stardew-give-money", "Donner de l’argent", "Cap", {
    parameters: { amount: 1000 }
  }),
  gift("stardew-heart-me-energy-drain", "stardew-energy-drain", "Retirer de l’énergie", "Heart Me", {
    enabled: false,
    parameters: { amount: 50 }
  }),
  gift("stardew-galaxy-instant-kill", "stardew-instant-kill", "Mort instantanée", "Galaxy"),
  ...STARDEW_VALLEY_EFFECTS
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
    ...effect(id, code, name, category, description, imageName),
    quantityParameter: parameterId,
    parameters: [
      parameter(parameterId, label, min, max, defaultValue)
    ]
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

function variantEffect(
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
  values
) {
  return {
    ...effect(id, code, name, category, description, imageName),
    codeByParameter: {
      parameter: parameterId,
      mode: "nearest",
      values
    },
    parameters: [
      parameter(parameterId, label, min, max, defaultValue)
    ]
  };
}

function toolEffect(id, code, name, description, imageName) {
  return effect(id, code, name, "Outils", description, imageName);
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
    Apparitions: "♟",
    Déplacement: "⌁",
    "Effets temporaires": "✦",
    Joueur: "♥",
    Outils: "⚒",
    Personnalisation: "✂",
    Ressources: "◆"
  }[category] || "◇";
}

module.exports = {
  STARDEW_VALLEY_DEFAULT_MAPPINGS,
  STARDEW_VALLEY_EFFECTS,
  STARDEW_VALLEY_GAME_ID: GAME_ID,
  STARDEW_VALLEY_INTERACTION_CATALOG_VERSION: 1
};
