"use strict";

const GAME_ID = "cult-of-the-lamb";
const IMAGE_ROOT = `../../resources/game-interactions/${GAME_ID}`;

const RAW_EFFECTS = [
  effect("cult-add-hp", "heal", "Ajouter de la vie", "Agneau", "Restaure de la vie à l’agneau.", "add-hp"),
  effect("cult-take-hp", "damage", "Retirer de la vie", "Agneau", "Retire de la vie à l’agneau sans contourner les règles du jeu.", "take-hp"),
  timedEffect("cult-invincible", "invincible", "Rendre invincible", "Agneau", "Protège l’agneau de tous les dégâts pendant la durée choisie.", "invincible", 10),
  effect("cult-add-follower", "addfollower", "Ajouter un fidèle", "Culte", "Ajoute un nouveau fidèle lorsque le village du culte est chargé.", "add-follower"),
  effect("cult-kill-all-enemies", "killenemies", "Éliminer tous les ennemis", "Combat", "Élimine les ennemis actifs de la salle de croisade.", "kill-all-enemies"),
  timedEffect("cult-freeze-enemies", "freezeenemies", "Geler les ennemis", "Combat", "Immobilise temporairement les ennemis actifs.", "freeze-enemies", 10),
  timedEffect("cult-speed-up", "speedup", "Accélérer le jeu ×2", "Temps", "Double temporairement la vitesse du jeu.", "speed-up", 10),
  timedEffect("cult-slow-down", "slowdown", "Ralentir le jeu ×0,5", "Temps", "Divise temporairement la vitesse du jeu par deux.", "slow-down", 10),
  {
    ...effect("cult-set-weapon", "weapon_0", "Changer l’arme", "Combat", "Équipe l’arme et le niveau choisis pendant une croisade.", "set-weapon"),
    codeByParameter: {
      parameter: "weapon",
      values: {
        1: "weapon_0",
        2: "weapon_300",
        3: "weapon_100",
        4: "weapon_200",
        5: "weapon_450"
      }
    },
    parameters: [
      parameter("weapon", "Arme (1 épée, 2 dague, 3 hache, 4 marteau, 5 tromblon)", 1, 5, 1),
      parameter("level", "Niveau de l’arme", 1, 10, 3)
    ]
  },
  effect("cult-give-item", "wood_5", "Donner du bois", "Ressources", "Ajoute cinq unités de bois aux ressources du culte.", "give-item"),
  effect("cult-wipe-resources", "wiperesources", "Vider les ressources", "Ressources", "Met à zéro les principales ressources du culte.", "wipe-resources"),
  effect("cult-kill", "kill", "Éliminer l’agneau", "Agneau", "Élimine immédiatement l’agneau.", "kill"),
  effect("cult-spell-goop", "castprojectile", "Lancer le sort projectile", "Sorts", "Lance le projectile de zone dans la direction regardée.", "spell-goop"),
  effect("cult-spell-mega-slash", "castslash", "Lancer la méga entaille", "Sorts", "Déclenche la méga entaille dans la salle actuelle.", "spell-mega-slash"),
  effect("cult-spell-fireball", "castfireball", "Lancer une boule de feu", "Sorts", "Déclenche le sort boule de feu.", "spell-fireball"),
  effect("cult-spell-tentacles", "casttentacle", "Lancer les tentacules", "Sorts", "Déclenche le sort tentacules.", "spell-tentacles"),
  effect("cult-spell-teleport", "castteleport", "Lancer la téléportation", "Sorts", "Déclenche le sort de téléportation pendant une croisade.", "spell-teleport"),
  timedEffect("cult-spell-barrier", "castbarrier", "Lancer la barrière", "Sorts", "Active temporairement la barrière protectrice.", "spell-barrier", 10),
  {
    ...effect("cult-custom-hearts", "giveblue", "Donner un cœur spécial", "Agneau", "Ajoute le type de cœur choisi.", "custom-hearts"),
    codeByParameter: {
      parameter: "heart",
      values: {
        1: "giveblue",
        2: "giveblack",
        3: "givespirit",
        4: "givespirit",
        5: "healall"
      }
    },
    parameters: [
      parameter("heart", "Cœur (1 bleu, 2 noir, 3 esprit, 4 feu, 5 permanent)", 1, 5, 1)
    ]
  },
  effect("cult-move-up-room", "teleup", "Monter d’une salle", "Déplacement", "Déplace l’agneau vers la salle située au-dessus.", "move-up-room"),
  effect("cult-move-down-room", "teledown", "Descendre d’une salle", "Déplacement", "Déplace l’agneau vers la salle située en dessous.", "move-down-room"),
  effect("cult-move-left-room", "teleleft", "Aller à la salle de gauche", "Déplacement", "Déplace l’agneau vers la salle située à gauche.", "move-left-room"),
  effect("cult-move-right-room", "teleright", "Aller à la salle de droite", "Déplacement", "Déplace l’agneau vers la salle située à droite.", "move-right-room"),
  {
    ...effect("cult-take-custom-heart", "takeblue", "Retirer un cœur spécial", "Agneau", "Retire le type de cœur choisi.", "take-custom-heart"),
    codeByParameter: {
      parameter: "heart",
      values: {
        1: "takeblue",
        2: "takeblack",
        3: "takespirit",
        4: "takespirit",
        5: "takehearts"
      }
    },
    parameters: [
      parameter("heart", "Cœur (1 bleu, 2 noir, 3 esprit, 4 feu, 5 permanent)", 1, 5, 1)
    ]
  },
  effect("cult-cc-break-building", "break", "Détruire un bâtiment", "Culte", "Détruit un bâtiment compatible dans le culte.", "cc-break-building"),
  effect("cult-cc-give-tarot", "givetarot", "Donner une carte de tarot", "Combat", "Donne une carte de tarot pendant une croisade.", "cc-give-tarot"),
  timedEffect("cult-cc-poison-lamb", "poison", "Empoisonner l’agneau", "Agneau", "Empoisonne temporairement l’agneau.", "cc-poison-lamb", 15),
  {
    ...effect("cult-cc-spawn-enemies", "spawn", "Faire apparaître des ennemis", "Combat", "Fait apparaître plusieurs ennemis à proximité pendant un combat.", "cc-spawn-enemies"),
    parameters: [
      parameter("count", "Nombre d’ennemis", 1, 20, 3)
    ]
  },
  {
    ...effect("cult-cc-increase-faith", "faithup", "Augmenter la foi", "Culte", "Augmente la jauge de foi du montant choisi.", "cc-increase-faith"),
    parameters: [
      parameter("amount", "Points de foi", 1, 100, 10)
    ]
  },
  {
    ...effect("cult-cc-lose-faith", "faithdown", "Retirer de la foi", "Culte", "Diminue la jauge de foi du montant choisi.", "cc-lose-faith"),
    parameters: [
      parameter("amount", "Points de foi", 1, 100, 10)
    ]
  },
  effect("cult-cc-resurrect-follower", "revivefollower", "Ressusciter un fidèle", "Culte", "Ressuscite un fidèle mort lorsqu’un candidat est disponible.", "cc-resurrect-follower"),
  effect("cult-cc-return-base", "telebase", "Retourner au culte", "Déplacement", "Ramène l’agneau à la base du culte.", "cc-return-base")
];

const CULT_OF_THE_LAMB_EFFECTS = Object.freeze(
  RAW_EFFECTS.map((entry, index) => ({
    ...entry,
    available: true,
    service: "native",
    sortOrder: index
  }))
);

const DISABLED_CATALOG_EFFECT_IDS = new Set([
  "cult-add-follower",
  "cult-give-item",
  "cult-wipe-resources",
  "cult-kill",
  "cult-spell-goop",
  "cult-spell-mega-slash",
  "cult-spell-tentacles",
  "cult-spell-teleport",
  "cult-spell-barrier",
  "cult-move-up-room",
  "cult-move-down-room",
  "cult-move-left-room",
  "cult-move-right-room",
  "cult-take-custom-heart",
  "cult-cc-break-building",
  "cult-cc-give-tarot",
  "cult-cc-poison-lamb",
  "cult-cc-spawn-enemies",
  "cult-cc-increase-faith",
  "cult-cc-lose-faith",
  "cult-cc-resurrect-follower",
  "cult-cc-return-base"
]);

const CULT_OF_THE_LAMB_DEFAULT_MAPPINGS = Object.freeze([
  mapping("cult-follow-add-follower", "cult-add-follower", "Ajouter un fidèle", {
    triggerType: "follow",
    enabled: false
  }),
  mapping("cult-likes-add-hp", "cult-add-hp", "Ajouter de la vie", {
    triggerType: "like",
    threshold: 100,
    enabled: false
  }),
  gift("cult-rose-add-hp", "cult-add-hp", "Ajouter de la vie", "Rose"),
  gift("cult-finger-heart-take-hp", "cult-take-hp", "Retirer de la vie", "Finger Heart"),
  gift("cult-tiktok-invincible", "cult-invincible", "Invincible (10 s)", "TikTok", {
    duration: 10,
    parameters: { seconds: 10 }
  }),
  gift("cult-perfume-freeze-enemies", "cult-freeze-enemies", "Geler les ennemis", "Perfume", {
    duration: 10,
    parameters: { seconds: 10 }
  }),
  gift("cult-gg-kill-all-enemies", "cult-kill-all-enemies", "Éliminer tous les ennemis", "GG"),
  gift("cult-cap-speed-up", "cult-speed-up", "Accélérer le jeu ×2", "Cap", {
    duration: 10,
    parameters: { seconds: 10 }
  }),
  gift("cult-heart-me-slow-down", "cult-slow-down", "Ralentir le jeu ×0,5", "Heart Me", {
    duration: 10,
    enabled: false,
    parameters: { seconds: 10 }
  }),
  gift("cult-galaxy-spell-fireball", "cult-spell-fireball", "Lancer une boule de feu", "Galaxy"),
  gift("cult-money-gun-set-weapon", "cult-set-weapon", "Changer l’arme", "Money Gun", {
    enabled: false,
    parameters: { weapon: 1, level: 3 }
  }),
  gift("cult-love-you-custom-hearts", "cult-custom-hearts", "Donner un cœur spécial", "Love You", {
    enabled: false,
    parameters: { heart: 1 }
  }),
  ...CULT_OF_THE_LAMB_EFFECTS
    .filter((entry) => DISABLED_CATALOG_EFFECT_IDS.has(entry.id))
    .map((entry) =>
    mapping(`catalog-${entry.id}`, entry.id, entry.name, {
      enabled: false,
      triggerEnabled: false,
      parameters: Object.fromEntries(
        (entry.parameters || []).map((item) => [
          item.id,
          item.defaultValue
        ])
      )
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

function timedEffect(id, code, name, category, description, imageName, seconds) {
  return {
    ...effect(id, code, name, category, description, imageName),
    duration: seconds,
    durationParameter: "seconds",
    parameters: [
      parameter("seconds", "Durée (secondes)", 1, 120, seconds)
    ]
  };
}

function parameter(id, label, min, max, defaultValue, step = 1) {
  return {
    id,
    label,
    min,
    max,
    defaultValue,
    step
  };
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
    Agneau: "♥",
    Combat: "⚔",
    Culte: "♛",
    Déplacement: "⌁",
    Ressources: "◆",
    Sorts: "✦",
    Temps: "◷"
  }[category] || "◇";
}

module.exports = {
  CULT_OF_THE_LAMB_DEFAULT_MAPPINGS,
  CULT_OF_THE_LAMB_EFFECTS,
  CULT_OF_THE_LAMB_GAME_ID: GAME_ID,
  CULT_OF_THE_LAMB_INTERACTION_CATALOG_VERSION: 1
};
