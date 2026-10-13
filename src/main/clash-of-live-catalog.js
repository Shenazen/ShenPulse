"use strict";

const { tikLiveDefaultGift } = require("./tiklive-default-gifts");

const GAME_ID = "clash-of-live";
const CLASH_OF_LIVE_CONNECTOR = Object.freeze({
  type: "clash-of-live-http",
  url: "http://127.0.0.1:4244",
  timeoutMs: 5000
});

const UNIT_DEFINITIONS = Object.freeze([
  ["squelette", "Squelettes", "Invoque des squelettes dans le camp choisi.", "♟", 3, 1, 20],
  ["chevalier", "Chevalier", "Invoque un chevalier dans le camp choisi.", "♞", 1, 1, 10],
  ["barbare", "Barbare", "Invoque un barbare dans le camp choisi.", "⚔", 1, 1, 10],
  ["geant", "Géant", "Invoque un géant dans le camp choisi.", "◆", 1, 1, 5],
  ["dragon", "Dragon", "Invoque un dragon dans le camp choisi.", "♨", 1, 1, 5],
  ["soin", "Soin des tours", "Rend leurs points de vie aux tours du camp choisi.", "♥", 1, 1, 1]
]);

const CAMP_DEFINITIONS = Object.freeze([
  ["rouge", "Rouge", "#ff315f"],
  ["bleu", "Bleu", "#1db8ff"]
]);

const CLASH_OF_LIVE_EFFECTS = Object.freeze([
  ...CAMP_DEFINITIONS.flatMap(([camp, campLabel, color]) =>
    UNIT_DEFINITIONS.map(
      ([unit, name, description, icon, quantity, min, max]) =>
        Object.freeze({
          id: `${GAME_ID}-${camp}-${unit}`,
          code: `${camp}/${unit}`,
          sourceEffectId: `${camp}/${unit}`,
          name: `${name} · ${campLabel}`,
          category: campLabel,
          description,
          icon,
          color,
          available: true,
          quantity,
          ...(min === max
            ? {}
            : {
                quantityParameter: "amount",
                parameters: [
                  Object.freeze({
                    id: "amount",
                    label: "Nombre d’invocations",
                    min,
                    max,
                    step: 1,
                    defaultValue: quantity
                  })
                ]
              })
        })
    )
  ),
  Object.freeze({
    id: `${GAME_ID}-roue`,
    code: "roue",
    sourceEffectId: "roue",
    name: "Roue native · camp automatique",
    category: "Chance",
    description:
      "Lance la roue 3D intégrée et choisit le camp du viewer ou le camp le moins fourni.",
    icon: "✺",
    available: true,
    quantity: 1
  }),
  Object.freeze({
    id: `${GAME_ID}-rouge-roue`,
    code: "rouge/roue",
    sourceEffectId: "rouge/roue",
    name: "Roue native · Rouge",
    category: "Chance",
    description: "Lance la roue 3D intégrée pour le camp rouge.",
    icon: "✺",
    color: "#ff315f",
    available: true,
    quantity: 1
  }),
  Object.freeze({
    id: `${GAME_ID}-bleu-roue`,
    code: "bleu/roue",
    sourceEffectId: "bleu/roue",
    name: "Roue native · Bleu",
    category: "Chance",
    description: "Lance la roue 3D intégrée pour le camp bleu.",
    icon: "✺",
    color: "#1db8ff",
    available: true,
    quantity: 1
  })
]);

const CLASH_OF_LIVE_DEPRECATED_DEFAULT_MAPPING_IDS = Object.freeze([
  ...CLASH_OF_LIVE_EFFECTS.map((effect) => effect.id),
  `${GAME_ID}-rouge-roue-native`,
  `${GAME_ID}-bleu-roue-native`
]);

const EFFECTS_BY_CODE = new Map(
  CLASH_OF_LIVE_EFFECTS.map((effect) => [effect.code, effect])
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
  if (!effect) {
    throw new Error(`Effet Clash Of ShenPulse inconnu : ${effectCode}`);
  }
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

const CLASH_OF_LIVE_DEFAULT_MAPPINGS = Object.freeze([
  defaultMapping("rouge-squelettes-3", "rouge/squelette", "3 squelettes · Rouge", {
    ...tikLiveDefaultGift("rose"),
    amount: 3
  }),
  defaultMapping("rouge-chevalier", "rouge/chevalier", "Chevalier · Rouge", {
    ...tikLiveDefaultGift("fingerHeart")
  }),
  defaultMapping("rouge-barbare", "rouge/barbare", "Barbare · Rouge", {
    ...tikLiveDefaultGift("rosa")
  }),
  defaultMapping("rouge-geant", "rouge/geant", "Géant · Rouge", {
    ...tikLiveDefaultGift("gameController")
  }),
  defaultMapping("rouge-dragon", "rouge/dragon", "Dragon · Rouge", {
    ...tikLiveDefaultGift("elephantTrunk")
  }),
  defaultMapping("rouge-soin", "rouge/soin", "Soin des tours · Rouge", {
    ...tikLiveDefaultGift("lionMane")
  }),

  defaultMapping("bleu-squelettes-3", "bleu/squelette", "3 squelettes · Bleu", {
    ...tikLiveDefaultGift("gg"),
    amount: 3
  }),
  defaultMapping("bleu-chevalier", "bleu/chevalier", "Chevalier · Bleu", {
    ...tikLiveDefaultGift("tofu")
  }),
  defaultMapping("bleu-barbare", "bleu/barbare", "Barbare · Bleu", {
    ...tikLiveDefaultGift("goldenBoxingGloves")
  }),
  defaultMapping("bleu-geant", "bleu/geant", "Géant · Bleu", {
    ...tikLiveDefaultGift("cap")
  }),
  defaultMapping("bleu-dragon", "bleu/dragon", "Dragon · Bleu", {
    ...tikLiveDefaultGift("corgi")
  }),
  defaultMapping("bleu-soin", "bleu/soin", "Soin des tours · Bleu", {
    ...tikLiveDefaultGift("silverPistol")
  }),

  defaultMapping("roue-native", "roue", "Roue native · camp automatique", {
    ...tikLiveDefaultGift("heartInHands")
  }),

  defaultMapping("spin-chat", "roue", "Roue de l’overlay · !spin", {
    triggerType: "chat",
    conditions: [
      {
        field: "data.message",
        operator: "matches",
        value: "^\\s*!spin\\s*$"
      }
    ],
    actionType: "wheel.spin",
    actionConfig: { wheelId: "wheel_clash_of_live" }
  }),
  defaultMapping("likes-10", "bleu/squelette", "Tap-tap · tous les 10", {
    triggerType: "like",
    threshold: 10,
    amount: 1
  }),
  defaultMapping("follow", "bleu/chevalier", "Follow", {
    triggerType: "follow"
  }),
  defaultMapping("share", "rouge/squelette", "Partage", {
    triggerType: "share",
    amount: 1
  })
]);

const WHEEL_ACTION_PREFIX = "action_clash-of-live_clash-of-live-";
const wheelSegment = (id, label, color, mappingId) =>
  Object.freeze({
    id: `segment_clash_of_live_${id}`,
    label,
    color,
    action: "action",
    actionId: `${WHEEL_ACTION_PREFIX}${mappingId}`
  });

const CLASH_OF_LIVE_WHEEL_PRESETS = Object.freeze([
  Object.freeze({
    id: "wheel_clash_of_live",
    name: "Clash Of ShenPulse · Roue de la chance",
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
      wheelSegment("red_skeleton", "3 squelettes rouges", "#ff315f", "rouge-squelettes-3"),
      wheelSegment("blue_skeleton", "3 squelettes bleus", "#1db8ff", "bleu-squelettes-3"),
      wheelSegment("red_knight", "Chevalier rouge", "#ff5e45", "rouge-chevalier"),
      wheelSegment("blue_knight", "Chevalier bleu", "#16a6ff", "bleu-chevalier"),
      wheelSegment("red_barbarian", "Barbare rouge", "#e43f8d", "rouge-barbare"),
      wheelSegment("blue_barbarian", "Barbare bleu", "#48c6ff", "bleu-barbare"),
      wheelSegment("red_giant", "Géant rouge", "#b72cff", "rouge-geant"),
      wheelSegment("blue_giant", "Géant bleu", "#875cff", "bleu-geant"),
      wheelSegment("red_dragon", "Dragon rouge", "#ff8a00", "rouge-dragon"),
      wheelSegment("blue_dragon", "Dragon bleu", "#00bfa6", "bleu-dragon"),
      wheelSegment("red_heal", "Soin rouge", "#ff6b8a", "rouge-soin"),
      wheelSegment("blue_heal", "Soin bleu", "#20d982", "bleu-soin")
    ])
  })
]);

const CLASH_OF_LIVE_INTERACTION_CATALOG_VERSION = 2026101301;

module.exports = {
  CLASH_OF_LIVE_CONNECTOR,
  CLASH_OF_LIVE_DEFAULT_MAPPINGS,
  CLASH_OF_LIVE_DEPRECATED_DEFAULT_MAPPING_IDS,
  CLASH_OF_LIVE_EFFECTS,
  CLASH_OF_LIVE_INTERACTION_CATALOG_VERSION,
  CLASH_OF_LIVE_WHEEL_PRESETS,
  GAME_ID
};
