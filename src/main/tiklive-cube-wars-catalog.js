"use strict";

const GAME_ID = "tiklive-cube-wars";
const TIKLIVE_CUBE_WARS_CONNECTOR = Object.freeze({
  type: "tiklive-cube-wars-http",
  url: "http://127.0.0.1:7811",
  timeoutMs: 5000
});

const EFFECT_DEFINITIONS = [
  ["pousse", "Poussée du viewer", "Combat", "Pousse le cube pour le camp choisi par le viewer.", "↔", 1, 1, 50, "Force de poussée"],
  ["pousseh", "Poussée · Hommes", "Hommes", "Pousse le cube en faveur du camp Hommes.", "H", 1, 1, 50, "Force de poussée"],
  ["poussef", "Poussée · Femmes", "Femmes", "Pousse le cube en faveur du camp Femmes.", "F", 1, 1, 50, "Force de poussée"],
  ["vague", "Vague", "Combat", "Déclenche une vague pour le camp du viewer.", "≋", 8, 1, 40, "Puissance"],
  ["geant", "Géant", "Combat", "Transforme temporairement un combattant en géant.", "⬆", 8, 1, 30, "Durée (secondes)"],
  ["bombe", "Bombe", "Combat", "Lance une bombe sur le camp adverse.", "●", 1, 1, 10, "Nombre de bombes"],
  ["bouclier", "Bouclier", "Défense", "Protège temporairement le camp du viewer.", "◇", 1, 1, 10, "Puissance"],
  ["glissade", "Savon", "Handicap", "Rend le terrain adverse glissant.", "⌁", 6, 1, 30, "Durée (secondes)"],
  ["tornade", "Tornade", "Combat", "Déclenche une tornade sur le camp adverse.", "◌", 1, 1, 10, "Puissance"],
  ["meteore", "Météore", "Combat", "Fait tomber un météore sur le camp adverse.", "☄", 1, 1, 10, "Puissance"],
  ["multi", "Multiplicateur ×2", "Bonus", "Double temporairement les interactions du LIVE.", "×2", 1, 1, 10, "Niveau"],
  ["win", "Ajouter une victoire", "Score", "Ajoute des victoires au compteur.", "+", 1, 1, 50, "Victoires ajoutées"],
  ["winmoins", "Retirer une victoire", "Score", "Retire des victoires du compteur.", "−", 1, 1, 50, "Victoires retirées"],
  ["winreset", "Réinitialiser les victoires", "Partie", "Remet les victoires à zéro.", "↶", 1, 1, 1, "Valeur"],
  ["reset", "Réinitialiser la partie", "Partie", "Recommence la manche et remet le plateau à zéro.", "↻", 1, 1, 1, "Valeur"],
  ["roue", "Roue native", "Chance", "Lance la roue intégrée de Cube Wars.", "✺", 1, 1, 1, "Valeur"],
  ["camp-homme", "Choisir le camp Hommes", "Équipe", "Inscrit le viewer dans le camp Hommes via la commande native H.", "H", 1, 1, 1, "Valeur"],
  ["camp-femme", "Choisir le camp Femmes", "Équipe", "Inscrit le viewer dans le camp Femmes via la commande native F.", "F", 1, 1, 1, "Valeur"]
];

const TIKLIVE_CUBE_WARS_EFFECTS = Object.freeze(
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

const TIKLIVE_CUBE_WARS_DEPRECATED_DEFAULT_MAPPING_IDS = Object.freeze(
  TIKLIVE_CUBE_WARS_EFFECTS.map((effect) => effect.id)
);

const EFFECTS_BY_CODE = new Map(
  TIKLIVE_CUBE_WARS_EFFECTS.map((effect) => [effect.code, effect])
);

function defaultMapping(
  id,
  effectCode,
  title,
  {
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
  if (!effect) throw new Error(`Effet Cube Wars inconnu : ${effectCode}`);
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
    ...(giftName ? { giftName } : {}),
    ...(Array.isArray(conditions) ? { conditions } : {}),
    ...(actionType ? { actionType } : {}),
    ...(actionConfig ? { actionConfig } : {}),
    enabled: true,
    triggerEnabled: true
  });
}

const TIKLIVE_CUBE_WARS_DEFAULT_MAPPINGS = Object.freeze([
  defaultMapping("pousse", "pousse", "Poussée du viewer", { giftName: "Rose" }),
  defaultMapping("vague-8", "vague", "Vague · puissance 8", { giftName: "Cœur avec les doigts", amount: 8 }),
  defaultMapping("geant-8", "geant", "Géant · 8 s", { giftName: "Rosa", amount: 8 }),
  defaultMapping("bombe", "bombe", "Bombe", { giftName: "Donut" }),
  defaultMapping("bouclier", "bouclier", "Bouclier", { giftName: "Jet de tomates" }),
  defaultMapping("glissade-6", "glissade", "Savon · 6 s", { giftName: "Cœur avec les mains", amount: 6 }),
  defaultMapping("tornade", "tornade", "Tornade", { giftName: "Pistolet à gemmes" }),
  defaultMapping("meteore", "meteore", "Météore", { giftName: "Pluie de météorites" }),
  defaultMapping("pousse-hommes", "pousseh", "Poussée · Hommes", { giftName: "GG" }),
  defaultMapping("pousse-femmes", "poussef", "Poussée · Femmes", {
    giftName: "Cœur sur moi",
    conditions: [
      {
        field: "data.giftName",
        operator: "equals",
        value: "Cœur sur moi",
        giftFamily: "community-heart"
      }
    ]
  }),
  defaultMapping("pousse-15", "pousse", "Poussée · ×15", { giftName: "Salut Ours", amount: 15 }),
  defaultMapping("pousse-5", "pousse", "Poussée · ×5", { giftName: "Capybara", amount: 5 }),
  defaultMapping("vague-20", "vague", "Méga vague · puissance 20", { giftName: "Gants de boxe dorés", amount: 20 }),
  defaultMapping("multi", "multi", "Multiplicateur ×2", { giftName: "Puissance Max" }),
  defaultMapping("native-wheel", "roue", "Roue native · Random", { giftName: "TikTok" }),

  defaultMapping("win-plus-1", "win", "+1 WIN", { giftName: "Pistolet à argent", amount: 1 }),
  defaultMapping("win-plus-5", "win", "+5 WIN", { giftName: "Galaxy", amount: 5 }),
  defaultMapping("win-plus-20", "win", "+20 WIN", { giftName: "Jet privé", amount: 20 }),
  defaultMapping("win-plus-50", "win", "+50 WIN", { giftName: "Autoroute au coucher de soleil", amount: 50 }),
  defaultMapping("win-minus-1", "winmoins", "−1 WIN", { giftName: "Crinière de lion", amount: 1 }),
  defaultMapping("win-minus-5", "winmoins", "−5 WIN", { giftName: "Girafe", amount: 5 }),
  defaultMapping("win-minus-20", "winmoins", "−20 WIN", { giftName: "Léon le chaton", amount: 20 }),
  defaultMapping("win-minus-50", "winmoins", "−50 WIN", { giftName: "Pieuvre", amount: 50 }),
  defaultMapping("reset-game", "reset", "Reset de la partie", { giftName: "Gants de boxe" }),
  defaultMapping("reset-wins", "winreset", "Reset win", { giftName: "Voiture de sport" }),

  defaultMapping("choose-men", "camp-homme", "Chat H · camp Hommes", {
    triggerType: "chat",
    conditions: [
      { field: "data.message", operator: "matches", value: "^\\s*(?:h|homme|hommes)\\s*$" }
    ]
  }),
  defaultMapping("choose-women", "camp-femme", "Chat F · camp Femmes", {
    triggerType: "chat",
    conditions: [
      { field: "data.message", operator: "matches", value: "^\\s*(?:f|femme|femmes)\\s*$" }
    ]
  }),
  defaultMapping("spin-chat", "roue", "Roue de la chance · !spin", {
    triggerType: "chat",
    conditions: [
      { field: "data.message", operator: "matches", value: "^\\s*!spin\\s*$" }
    ],
    actionType: "wheel.spin",
    actionConfig: { wheelId: "wheel_tiklive_cube_wars" }
  }),
  defaultMapping("likes-10", "pousse", "Tap-tap · tous les 10", {
    triggerType: "like",
    threshold: 10,
    amount: 1
  }),
  defaultMapping("follow", "vague", "Follow", { triggerType: "follow", amount: 4 }),
  defaultMapping("share", "bombe", "Partage", { triggerType: "share" })
]);

const WHEEL_ACTION_PREFIX =
  "action_tiklive-cube-wars_tiklive-cube-wars-";
const wheelSegment = (id, label, color, mappingId) =>
  Object.freeze({
    id: `segment_tiklive_cube_wars_${id}`,
    label,
    color,
    action: "action",
    actionId: `${WHEEL_ACTION_PREFIX}${mappingId}`
  });

const TIKLIVE_CUBE_WARS_WHEEL_PRESETS = Object.freeze([
  Object.freeze({
    id: "wheel_tiklive_cube_wars",
    name: "Cube Wars · Roue de la chance",
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
      wheelSegment("push", "Poussée ×5", "#00d9df", "pousse-5"),
      wheelSegment("wave", "Vague ×8", "#16a6ff", "vague-8"),
      wheelSegment("giant", "Géant 8 s", "#875cff", "geant-8"),
      wheelSegment("bomb", "Bombe", "#ff315f", "bombe"),
      wheelSegment("shield", "Bouclier", "#20d982", "bouclier"),
      wheelSegment("soap", "Savon 6 s", "#48c6ff", "glissade-6"),
      wheelSegment("tornado", "Tornade", "#b72cff", "tornade"),
      wheelSegment("meteor", "Météore", "#ff8a00", "meteore"),
      wheelSegment("multi", "Multiplicateur ×2", "#ffd23f", "multi"),
      wheelSegment("mega-wave", "Méga vague ×20", "#e43f8d", "vague-20")
    ])
  })
]);

const TIKLIVE_CUBE_WARS_INTERACTION_CATALOG_VERSION = 20261012;

module.exports = {
  GAME_ID,
  TIKLIVE_CUBE_WARS_CONNECTOR,
  TIKLIVE_CUBE_WARS_DEFAULT_MAPPINGS,
  TIKLIVE_CUBE_WARS_DEPRECATED_DEFAULT_MAPPING_IDS,
  TIKLIVE_CUBE_WARS_EFFECTS,
  TIKLIVE_CUBE_WARS_INTERACTION_CATALOG_VERSION,
  TIKLIVE_CUBE_WARS_WHEEL_PRESETS
};
