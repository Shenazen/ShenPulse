"use strict";

const { tikLiveDefaultGift } = require("./tiklive-default-gifts");

const GAME_ID = "tiklive-stack-tower";
const TIKLIVE_STACK_TOWER_CONNECTOR = Object.freeze({
  type: "tiklive-stack-tower-http",
  url: "http://127.0.0.1:7817",
  timeoutMs: 5000
});

const EFFECT_DEFINITIONS = [
  ["plus1", "+1 étage", "Construction", "Ajoute un étage à la tour.", "+1", 1, 1, 1, "Étages"],
  ["plus10", "+10 étages", "Construction", "Ajoute dix étages à la tour.", "+10", 1, 1, 1, "Cascades"],
  ["plus50", "+50 étages", "Construction", "Ajoute cinquante étages à la tour.", "+50", 1, 1, 1, "Cascades"],
  ["stabilise", "Stabilisateur", "Aide", "Empêche temporairement la tour de bouger.", "◇", 15, 1, 60, "Durée (secondes)"],
  ["ralenti", "Grue lente", "Aide", "Ralentit temporairement la grue.", "◷", 12, 1, 60, "Durée (secondes)"],
  ["aimant", "Aimant", "Aide", "Accorde des lâchers parfaits automatiques.", "⊕", 1, 1, 10, "Lâchers parfaits"],
  ["bouclier", "Bouclier", "Aide", "Bloque le prochain sabotage de la tour.", "⬡", 1, 1, 10, "Boucliers"],
  ["fondations", "Béton armé", "Aide", "Empêche les effondrements pendant la durée choisie.", "▰", 20, 1, 60, "Durée (secondes)"],
  ["moins1", "−1 étage", "Sabotage", "Détruit un étage de la tour.", "−1", 1, 1, 1, "Attaques"],
  ["moins10", "−10 étages", "Sabotage", "Détruit dix étages de la tour.", "−10", 1, 1, 1, "Attaques"],
  ["moins50", "−50 étages", "Sabotage", "Détruit cinquante étages de la tour.", "−50", 1, 1, 1, "Attaques"],
  ["vent", "Coup de vent", "Sabotage", "Fait fortement balancer la grue.", "≋", 8, 1, 60, "Durée (secondes)"],
  ["seisme", "Séisme", "Sabotage", "Fait trembler la tour.", "⌁", 5, 1, 60, "Durée (secondes)"],
  ["oiseau", "Oiseau", "Sabotage", "Un oiseau percute l’étage en cours.", "◆", 1, 1, 10, "Oiseaux"],
  ["avion", "Avion", "Sabotage", "Un avion traverse le chantier.", "✈", 1, 1, 10, "Avions"],
  ["accelere", "Grue folle", "Sabotage", "Accélère temporairement la grue.", "⚡", 8, 1, 60, "Durée (secondes)"],
  ["glissant", "Étage glissant", "Sabotage", "Le prochain étage devient glissant.", "▱", 1, 1, 10, "Étages"],
  ["brouillard", "Brouillard", "Sabotage", "Réduit temporairement la visibilité.", "☁", 8, 1, 60, "Durée (secondes)"],
  ["geant", "Étage géant", "Chaos", "Transforme le prochain étage en étage géant.", "⬆", 1, 1, 10, "Étages"],
  ["mini", "Étage mini", "Chaos", "Transforme le prochain étage en mini étage.", "⬇", 1, 1, 10, "Étages"],
  ["random", "Roue native", "Chance", "Lance la roue intégrée de Stack Tower.", "✺", 1, 1, 10, "Tours"],
  ["multi", "Multiplicateur ×2", "Bonus", "Double les interactions du LIVE pendant cinq minutes.", "×2", 1, 1, 10, "Niveau"],
  ["fete", "Fête", "Chaos", "Déclenche la fête native de Stack Tower.", "★", 1, 1, 1, "Valeur"],
  ["win", "Ajouter une victoire", "Score", "Ajoute des victoires au compteur.", "+", 1, 1, 50, "Victoires ajoutées"],
  ["winmoins", "Retirer une victoire", "Score", "Retire des victoires du compteur.", "−", 1, 1, 50, "Victoires retirées"],
  ["winreset", "Réinitialiser les victoires", "Partie", "Remet les victoires à zéro.", "↶", 1, 1, 1, "Valeur"],
  ["reset", "Réinitialiser la partie", "Partie", "Recommence la construction de la tour.", "↻", 1, 1, 1, "Valeur"],
  ["roue", "Roue de la chance", "Chance", "Lance la roue native de Stack Tower.", "✺", 1, 1, 1, "Valeur"]
];

const TIKLIVE_STACK_TOWER_EFFECTS = Object.freeze(
  EFFECT_DEFINITIONS.map(
    ([code, name, category, description, icon, defaultValue, min, max, label]) =>
      Object.freeze({
        id: `${GAME_ID}-${code}`,
        code,
        sourceEffectId: code,
        name,
        category,
        description,
        icon,
        available: true,
        quantity: defaultValue,
        ...(min === max
          ? {}
          : {
              quantityParameter: "amount",
              parameters: [
                Object.freeze({
                  id: "amount",
                  label,
                  min,
                  max,
                  step: 1,
                  defaultValue
                })
              ]
            })
      })
  )
);

const TIKLIVE_STACK_TOWER_DEPRECATED_DEFAULT_MAPPING_IDS = Object.freeze(
  TIKLIVE_STACK_TOWER_EFFECTS.map((effect) => effect.id)
);

const EFFECTS_BY_CODE = new Map(
  TIKLIVE_STACK_TOWER_EFFECTS.map((effect) => [effect.code, effect])
);

function defaultMapping(
  id,
  effectCode,
  title,
  {
    giftCost = 0,
    giftFamily = "",
    giftId = "",
    giftIds = [],
    giftName = "",
    triggerType = "gift",
    triggerEnabled = true,
    threshold = 1,
    amount,
    conditions,
    actionType = "",
    actionConfig
  } = {}
) {
  const effect = EFFECTS_BY_CODE.get(effectCode);
  if (!effect) throw new Error(`Effet Stack Tower inconnu : ${effectCode}`);
  const quantity = Number(amount ?? effect.quantity ?? 1);
  return Object.freeze({
    id: `${GAME_ID}-${id}`,
    effectId: effect.id,
    title,
    triggerType,
    triggerEnabled,
    threshold,
    cooldownSeconds: 0,
    quantity,
    ...(effect.quantityParameter
      ? { parameters: { [effect.quantityParameter]: quantity } }
      : {}),
    ...(giftName ? { giftName } : {}),
    ...(giftId ? { giftId } : {}),
    ...(giftIds.length ? { giftIds } : {}),
    ...(giftCost ? { giftCost } : {}),
    ...(giftFamily ? { giftFamily } : {}),
    ...(Array.isArray(conditions) ? { conditions } : {}),
    ...(actionType ? { actionType } : {}),
    ...(actionConfig ? { actionConfig } : {}),
    enabled: true
  });
}

const giftMapping = (id, effectCode, title, giftKey, options = {}) =>
  defaultMapping(id, effectCode, title, {
    ...tikLiveDefaultGift(giftKey),
    ...options
  });

const TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS = Object.freeze([
  giftMapping("plus-1", "plus1", "+1 étage", "gg"),
  giftMapping("plus-10", "plus10", "+10 étages", "fingerHeart"),
  giftMapping("plus-50", "plus50", "+50 étages", "capybara"),
  giftMapping("stabilise-15", "stabilise", "Stabilisateur · 15 s", "iceCreamCone", { amount: 15 }),
  giftMapping("ralenti-12", "ralenti", "Grue lente · 12 s", "coffee", { amount: 12 }),
  giftMapping("aimant", "aimant", "Aimant", "communityHeart"),
  giftMapping("bouclier", "bouclier", "Bouclier", "helloBear"),
  giftMapping("fondations-20", "fondations", "Béton armé · 20 s", "goldenBoxingGloves", { amount: 20 }),
  giftMapping("moins-1", "moins1", "−1 étage", "rose"),
  giftMapping("moins-10", "moins10", "−10 étages", "rosa"),
  giftMapping("moins-50", "moins50", "−50 étages", "donut"),
  giftMapping("vent-8", "vent", "Coup de vent · 8 s", "windmill", { amount: 8 }),
  giftMapping("seisme-5", "seisme", "Séisme · 5 s", "thunderHammer", { amount: 5 }),
  giftMapping("oiseau", "oiseau", "Oiseau", "fairyWings"),
  giftMapping("avion", "avion", "Avion", "friendshipNecklace"),
  giftMapping("accelere-8", "accelere", "Grue folle · 8 s", "lightning", { amount: 8 }),
  giftMapping("glissant", "glissant", "Étage glissant", "perfume"),
  giftMapping("brouillard-8", "brouillard", "Brouillard · 8 s", "luckyPig", { amount: 8 }),
  giftMapping("geant", "geant", "Étage géant", "tinyDino"),
  giftMapping("mini", "mini", "Étage mini", "cuteCat"),
  giftMapping("random", "random", "Roue native · Random", "tiktok"),
  giftMapping("multi", "multi", "Multiplicateur ×2", "maxPower"),
  giftMapping("win-plus-1", "win", "+1 WIN", "silverPistol", { amount: 1 }),
  giftMapping("win-plus-5", "win", "+5 WIN", "galaxy", { amount: 5 }),
  giftMapping("win-plus-20", "win", "+20 WIN", "privateJet", { amount: 20 }),
  giftMapping("win-plus-50", "win", "+50 WIN", "sunsetHighway", { amount: 50 }),
  giftMapping("win-minus-1", "winmoins", "−1 WIN", "lionMane", { amount: 1 }),
  giftMapping("win-minus-5", "winmoins", "−5 WIN", "giraffe", { amount: 5 }),
  giftMapping("win-minus-20", "winmoins", "−20 WIN", "leonKitten", { amount: 20 }),
  giftMapping("win-minus-50", "winmoins", "−50 WIN", "octopus", { amount: 50 }),
  giftMapping("reset-wins", "winreset", "Reset WIN", "sportsCar"),

  defaultMapping("aimant-wheel-3", "aimant", "Aimant ×3 · roue", {
    triggerType: "manual",
    triggerEnabled: false,
    amount: 3
  }),
  defaultMapping("spin-chat", "roue", "Roue de la chance · !spin", {
    triggerType: "chat",
    conditions: [
      { field: "data.message", operator: "matches", value: "^\\s*!spin\\s*$" }
    ],
    actionType: "wheel.spin",
    actionConfig: { wheelId: "wheel_tiklive_stack_tower" }
  }),
  defaultMapping("likes-100", "plus1", "Tap-tap · tous les 100", {
    triggerType: "like",
    threshold: 100
  }),
  defaultMapping("follow", "plus1", "Follow", { triggerType: "follow" }),
  defaultMapping("share", "bouclier", "Partage", { triggerType: "share" })
]);

const WHEEL_ACTION_PREFIX =
  "action_tiklive-stack-tower_tiklive-stack-tower-";
const wheelSegment = (id, label, color, mappingId) =>
  Object.freeze({
    id: `segment_tiklive_stack_tower_${id}`,
    label,
    color,
    action: "action",
    actionId: `${WHEEL_ACTION_PREFIX}${mappingId}`
  });

const TIKLIVE_STACK_TOWER_WHEEL_PRESETS = Object.freeze([
  Object.freeze({
    id: "wheel_tiklive_stack_tower",
    name: "Stack Tower · Roue de la chance",
    enabled: true,
    trigger: "!spin",
    giftValueFilter: null,
    design: "classic",
    settings: Object.freeze({
      font: "Inter",
      fontSize: 17,
      textOrientation: "radial",
      textColor: "#ffffff",
      textShadowColor: "#000000",
      textShadowStrength: 10,
      textRadius: 34,
      textSegmentOffset: 0,
      textBoxWidth: 108,
      textBoxHeight: 42,
      textAngleOffset: 0,
      textAlign: "center",
      textClamp: true,
      textMaxLines: 2,
      lineSpacing: 1,
      letterSpacing: 0,
      showBase: true,
      soundActive: true,
      announceDuration: 0,
      spinDuration: 6,
      waitDuration: 1,
      scale: 100,
      glow: 80,
      showWinner: true,
      pointerPosition: "top",
      alwaysVisible: true,
      entranceAnimation: "zoom",
      exitAnimation: "fade",
      resultDuration: 4
    }),
    segments: Object.freeze([
      wheelSegment("plus-1", "+1 étage", "#20d982", "plus-1"),
      wheelSegment("plus-10", "+10 étages", "#ffd23f", "plus-10"),
      wheelSegment("shield", "Bouclier", "#16a6ff", "bouclier"),
      wheelSegment("magnet", "Aimant ×3", "#00d9df", "aimant-wheel-3"),
      wheelSegment("stabilizer", "Stabilisateur", "#48c6ff", "stabilise-15"),
      wheelSegment("foundation", "Béton armé", "#875cff", "fondations-20"),
      wheelSegment("minus-1", "−1 étage", "#ff315f", "moins-1"),
      wheelSegment("minus-10", "−10 étages", "#ff8a00", "moins-10"),
      wheelSegment("earthquake", "Séisme", "#e43f8d", "seisme-5"),
      wheelSegment("wind", "Coup de vent", "#b72cff", "vent-8"),
      wheelSegment("fast", "Grue folle", "#ff5e45", "accelere-8"),
      wheelSegment("bird", "Oiseau", "#ff315f", "oiseau"),
      wheelSegment("multi", "Multiplicateur ×2", "#ffd23f", "multi"),
      wheelSegment("plus-50", "+50 étages", "#20d982", "plus-50"),
      wheelSegment("minus-50", "−50 étages", "#ff315f", "moins-50")
    ])
  })
]);

const TIKLIVE_STACK_TOWER_INTERACTION_CATALOG_VERSION = 2026101301;

module.exports = {
  GAME_ID,
  TIKLIVE_STACK_TOWER_CONNECTOR,
  TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS,
  TIKLIVE_STACK_TOWER_DEPRECATED_DEFAULT_MAPPING_IDS,
  TIKLIVE_STACK_TOWER_EFFECTS,
  TIKLIVE_STACK_TOWER_INTERACTION_CATALOG_VERSION,
  TIKLIVE_STACK_TOWER_WHEEL_PRESETS
};
