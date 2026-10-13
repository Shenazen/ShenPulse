"use strict";

const { tikLiveDefaultGift } = require("./tiklive-default-gifts");

const GAME_ID = "tiklive-climb";
const TIKLIVE_CLIMB_CONNECTOR = Object.freeze({
  type: "tiklive-climb-http",
  url: "http://127.0.0.1:7777",
  timeoutMs: 5000
});

const EFFECT_DEFINITIONS = [
  ["souffle", "Souffle du nuage", "Attaque", "Projette le grimpeur et peut le faire chuter.", "↝", 1, 1, 1, "Puissance"],
  ["poing", "Coup de poing", "Attaque", "Frappe directement le grimpeur.", "✊", 1, 1, 1, "Puissance"],
  ["seisme", "Séisme", "Attaque", "Secoue la tour et déstabilise le grimpeur.", "⌁", 1, 1, 1, "Puissance"],
  ["glace", "Sol gelé", "Handicap", "Gèle temporairement les surfaces.", "❄", 8, 2, 30, "Durée (secondes)"],
  ["lourd", "Gravité lourde", "Handicap", "Alourdit temporairement le grimpeur.", "●", 8, 2, 30, "Durée (secondes)"],
  ["inverse", "Commandes inversées", "Handicap", "Inverse temporairement les commandes.", "⇄", 6, 2, 30, "Durée (secondes)"],
  ["brouillard", "Brouillard", "Handicap", "Réduit temporairement la visibilité.", "☁", 8, 2, 30, "Durée (secondes)"],
  ["mob", "Un mob débarque", "Attaque", "Fait apparaître un adversaire sur la tour.", "♟", 1, 1, 10, "Nombre de mobs"],
  ["bond", "Super bond", "Aide", "Prépare un saut renforcé.", "⇈", 1, 1, 1, "Puissance"],
  ["ballon", "Ballon", "Aide", "Fait monter le grimpeur de plusieurs mètres.", "◉", 10, 1, 100, "Altitude gagnée (mètres)"],
  ["drapeau", "Drapeau", "Aide", "Pose un point de rattrapage temporaire.", "⚑", 30, 5, 120, "Durée (secondes)"],
  ["bouclier", "Bouclier", "Aide", "Protège temporairement le grimpeur d’une attaque.", "◇", 15, 5, 120, "Durée (secondes)"],
  ["plume", "Plume", "Aide", "Allège temporairement le grimpeur.", "⌁", 10, 3, 120, "Durée (secondes)"],
  ["win", "Ajouter une victoire", "Score", "Ajoute des victoires au compteur.", "+", 1, 1, 50, "Victoires ajoutées"],
  ["winmoins", "Retirer une victoire", "Score", "Retire des victoires du compteur.", "−", 1, 1, 50, "Victoires retirées"],
  ["winreset", "Réinitialiser les victoires", "Partie", "Remet les victoires à zéro.", "↺", 1, 1, 1, "Valeur"],
  ["reset", "Réinitialiser la partie", "Partie", "Recommence l’ascension et remet les victoires à zéro.", "↻", 1, 1, 1, "Valeur"],
  ["roue", "Roue native", "Chance", "Lance la roue intégrée de Climb.", "✺", 1, 1, 1, "Valeur"]
];

const TIKLIVE_CLIMB_EFFECTS = Object.freeze(
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

const TIKLIVE_CLIMB_DEPRECATED_DEFAULT_MAPPING_IDS = Object.freeze([
  ...TIKLIVE_CLIMB_EFFECTS.map((effect) => effect.id),
  `${GAME_ID}-glace-8`,
  `${GAME_ID}-lourd-8`,
  `${GAME_ID}-inverse-6`,
  `${GAME_ID}-brouillard-8`,
  `${GAME_ID}-reset-run`,
  `${GAME_ID}-native-wheel`
]);

const EFFECTS_BY_CODE = new Map(
  TIKLIVE_CLIMB_EFFECTS.map((effect) => [effect.code, effect])
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
    threshold = 1,
    amount,
    conditions,
    actionType = "",
    actionConfig
  } = {}
) {
  const effect = EFFECTS_BY_CODE.get(effectCode);
  if (!effect) throw new Error(`Effet Climb inconnu : ${effectCode}`);
  const quantity = Number(amount ?? effect.quantity ?? 1);
  return Object.freeze({
    id: `${GAME_ID}-${id}`,
    effectId: effect.id,
    title,
    triggerType,
    threshold,
    cooldownSeconds: 0,
    quantity,
    ...(effect.quantityParameter
      ? { parameters: { [effect.quantityParameter]: quantity } }
      : {}),
    ...(giftName
      ? {
          giftCost,
          giftFamily,
          giftId,
          giftIds: [...giftIds],
          giftName
        }
      : {}),
    ...(Array.isArray(conditions) ? { conditions } : {}),
    ...(actionType ? { actionType } : {}),
    ...(actionConfig ? { actionConfig } : {}),
    enabled: true,
    triggerEnabled: true
  });
}

const TIKLIVE_CLIMB_DEFAULT_MAPPINGS = Object.freeze([
  defaultMapping("souffle", "souffle", "Souffle du nuage", {
    ...tikLiveDefaultGift("rose")
  }),
  defaultMapping("seisme", "seisme", "Séisme", {
    ...tikLiveDefaultGift("fingerHeart")
  }),
  defaultMapping("inverse-8", "inverse", "Commandes inversées · 8 s", {
    ...tikLiveDefaultGift("friendshipNecklace"),
    amount: 8
  }),
  defaultMapping("lourd-10", "lourd", "Gravité lourde · 10 s", {
    ...tikLiveDefaultGift("rosa"),
    amount: 10
  }),
  defaultMapping("brouillard-15", "brouillard", "Brouillard · 15 s", {
    ...tikLiveDefaultGift("donut"),
    amount: 15
  }),
  defaultMapping("glace-10", "glace", "Sol gelé · 10 s", {
    ...tikLiveDefaultGift("cap"),
    amount: 10
  }),
  defaultMapping("mob", "mob", "Un mob débarque", {
    ...tikLiveDefaultGift("gameController")
  }),
  defaultMapping("poing", "poing", "Coup de poing", {
    ...tikLiveDefaultGift("boxingGloves")
  }),

  defaultMapping("bond", "bond", "Super bond", {
    ...tikLiveDefaultGift("tiktok")
  }),
  defaultMapping("ballon-10", "ballon", "Ballon · +10 m", {
    ...tikLiveDefaultGift("sunglasses"),
    amount: 10
  }),
  defaultMapping("drapeau-30", "drapeau", "Drapeau · 30 s", {
    ...tikLiveDefaultGift("perfume"),
    amount: 30
  }),
  defaultMapping("bouclier-15", "bouclier", "Bouclier · 15 s", {
    ...tikLiveDefaultGift("signLanguageLove"),
    amount: 15
  }),
  defaultMapping("plume-10", "plume", "Plume · 10 s", {
    ...tikLiveDefaultGift("goldenBoxingGloves"),
    amount: 10
  }),

  defaultMapping("win-plus-1", "win", "+1 WIN", {
    ...tikLiveDefaultGift("silverPistol"),
    amount: 1
  }),
  defaultMapping("win-plus-5", "win", "+5 WIN", {
    ...tikLiveDefaultGift("galaxy"),
    amount: 5
  }),
  defaultMapping("win-plus-20", "win", "+20 WIN", {
    ...tikLiveDefaultGift("privateJet"),
    amount: 20
  }),
  defaultMapping("win-plus-50", "win", "+50 WIN", {
    ...tikLiveDefaultGift("sunsetHighway"),
    amount: 50
  }),
  defaultMapping("win-minus-1", "winmoins", "−1 WIN", {
    ...tikLiveDefaultGift("lionMane"),
    amount: 1
  }),
  defaultMapping("win-minus-5", "winmoins", "−5 WIN", {
    ...tikLiveDefaultGift("giraffe"),
    amount: 5
  }),
  defaultMapping("win-minus-20", "winmoins", "−20 WIN", {
    ...tikLiveDefaultGift("leonKitten"),
    amount: 20
  }),
  defaultMapping("win-minus-50", "winmoins", "−50 WIN", {
    ...tikLiveDefaultGift("octopus"),
    amount: 50
  }),
  defaultMapping("reset-wins", "winreset", "Reset win", {
    ...tikLiveDefaultGift("sportsCar")
  }),
  defaultMapping("spin-chat", "roue", "Roue de la chance · !spin", {
    triggerType: "chat",
    conditions: [
      {
        field: "data.message",
        operator: "matches",
        value: "^\\s*!spin\\s*$"
      }
    ],
    actionType: "wheel.spin",
    actionConfig: { wheelId: "wheel_tiklive_climb" }
  }),

  defaultMapping("likes-10", "ballon", "Tap-tap · tous les 10", {
    triggerType: "like",
    threshold: 10,
    amount: 1
  }),
  defaultMapping("follow", "bond", "Follow", {
    triggerType: "follow"
  }),
  defaultMapping("share", "souffle", "Partage", {
    triggerType: "share"
  })
]);

const WHEEL_ACTION_PREFIX = "action_tiklive-climb_tiklive-climb-";
const wheelSegment = (id, label, color, mappingId) =>
  Object.freeze({
    id: `segment_tiklive_climb_${id}`,
    label,
    color,
    action: "action",
    actionId: `${WHEEL_ACTION_PREFIX}${mappingId}`
  });

const TIKLIVE_CLIMB_WHEEL_PRESETS = Object.freeze([
  Object.freeze({
    id: "wheel_tiklive_climb",
    name: "Climb · Roue de la chance",
    enabled: true,
    trigger: "!spin",
    giftValueFilter: null,
    design: "classic",
    settings: Object.freeze({
      font: "Inter",
      fontSize: 18,
      textOrientation: "radial",
      textColor: "#ffffff",
      textShadowColor: "#000000",
      textShadowStrength: 10,
      textRadius: 34,
      textSegmentOffset: 0,
      textBoxWidth: 112,
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
      wheelSegment("ballon", "Ballon +10 m", "#20d982", "ballon-10"),
      wheelSegment("bond", "Super bond", "#00bfa6", "bond"),
      wheelSegment("flag", "Drapeau 30 s", "#16a6ff", "drapeau-30"),
      wheelSegment("shield", "Bouclier 15 s", "#875cff", "bouclier-15"),
      wheelSegment("feather", "Plume 10 s", "#17c964", "plume-10"),
      wheelSegment("wind", "Souffle", "#ff315f", "souffle"),
      wheelSegment("punch", "Coup de poing", "#ff5e45", "poing"),
      wheelSegment("ice", "Sol gelé 8 s", "#48c6ff", "glace-8"),
      wheelSegment("inverse", "Commandes inversées", "#e43f8d", "inverse-6"),
      wheelSegment("mob", "Un mob débarque", "#ff8a00", "mob"),
      wheelSegment("win_plus", "+5 WIN", "#ffd23f", "win-plus-5"),
      wheelSegment("win_minus", "−5 WIN", "#b72cff", "win-minus-5")
    ])
  })
]);

const TIKLIVE_CLIMB_INTERACTION_CATALOG_VERSION = 2026101301;

module.exports = {
  GAME_ID,
  TIKLIVE_CLIMB_CONNECTOR,
  TIKLIVE_CLIMB_DEPRECATED_DEFAULT_MAPPING_IDS,
  TIKLIVE_CLIMB_DEFAULT_MAPPINGS,
  TIKLIVE_CLIMB_EFFECTS,
  TIKLIVE_CLIMB_INTERACTION_CATALOG_VERSION,
  TIKLIVE_CLIMB_WHEEL_PRESETS
};
