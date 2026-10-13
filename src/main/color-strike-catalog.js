"use strict";

const { tikLiveDefaultGift } = require("./tiklive-default-gifts");

const GAME_ID = "color-strike";
const COLOR_STRIKE_CONNECTOR = Object.freeze({
  type: "color-strike-http",
  url: "http://127.0.0.1:7444",
  timeoutMs: 5000
});

const EFFECT_DEFINITIONS = [
  ["bombe", "Bombe rouge", "Attaque rouge", "Dépose des bombes rouges sur le terrain adverse.", "💣", 5, 1, 20, "Nombre de bombes"],
  ["pluie", "Pluie rouge", "Attaque rouge", "Déclenche une pluie de peinture rouge.", "☂", 110, 20, 300, "Intensité"],
  ["tourelle", "Tourelle rouge", "Attaque rouge", "Fait apparaître des tourelles pour l’équipe rouge.", "⌖", 1, 1, 12, "Nombre de tourelles"],
  ["brouillard", "Brouillard", "Handicap", "Recouvre temporairement l’arène d’un brouillard gênant.", "☁", 8, 3, 8, "Durée (secondes)"],
  ["inverse", "Commandes inversées", "Handicap", "Inverse temporairement les commandes du joueur.", "⇄", 5, 2, 5, "Durée (secondes)"],
  ["gel", "Gel", "Handicap", "Immobilise brièvement le joueur ciblé.", "❄", 4, 1, 4, "Durée (secondes)"],
  ["pistolet", "Pistolet rouge", "Attaque rouge", "Donne temporairement le pistolet à peinture rouge.", "▰", 6, 3, 6, "Durée (secondes)"],
  ["bombebleue", "Bombe bleue", "Bonus bleu", "Dépose des bombes bleues sur le terrain.", "💣", 1, 1, 8, "Nombre de bombes"],
  ["rafale", "Rafale bleue", "Bonus bleu", "Déclenche une rafale de peinture bleue.", "➶", 60, 12, 140, "Intensité"],
  ["boost", "Boost", "Bonus bleu", "Accorde un boost temporaire au joueur bleu.", "⚡", 25, 5, 120, "Durée (secondes)"],
  ["seau", "Seau de peinture", "Bonus bleu", "Lance des seaux de peinture bleue.", "▱", 1, 1, 8, "Nombre de seaux"],
  ["drone", "Drone", "Bonus bleu", "Active un drone de soutien pour le joueur bleu.", "✦", 35, 10, 120, "Durée (secondes)"],
  ["pluiebleue", "Pluie bleue", "Bonus bleu", "Déclenche une pluie de peinture bleue.", "☂", 110, 20, 300, "Intensité"],
  ["bazooka", "Bazooka", "Bonus bleu", "Accorde temporairement le bazooka à peinture.", "➤", 30, 10, 120, "Durée (secondes)"],
  ["eclabousse", "Éclaboussure bleue", "Peinture", "Projette une éclaboussure de peinture bleue.", "●", 1, 1, 20, "Nombre d’éclaboussures"],
  ["eclabousserouge", "Éclaboussure rouge", "Peinture", "Projette une éclaboussure de peinture rouge.", "●", 1, 1, 20, "Nombre d’éclaboussures"],
  ["nuke", "Nuke", "Chaos", "Déclenche l’attaque nucléaire de Color Strike.", "☢", 1, 1, 1, "Puissance"],
  ["blackout", "Blackout", "Handicap", "Plonge temporairement l’arène dans le noir.", "◼", 8, 4, 8, "Durée (secondes)"],
  ["vol", "Vol", "Handicap", "Vole temporairement l’avantage du joueur adverse.", "↝", 10, 5, 15, "Durée (secondes)"],
  ["boss", "Boss", "Chaos", "Fait apparaître le boss de Color Strike.", "♛", 40, 20, 60, "Durée (secondes)"],
  ["map", "Changer de carte", "Partie", "Change la carte de la partie.", "▦", 1, 1, 1, "Valeur"],
  ["arme", "Changer d’arme", "Partie", "Change l’arme active.", "⌁", 1, 1, 1, "Valeur"],
  ["win", "Ajouter une victoire", "Score", "Ajoute des victoires au compteur.", "+", 1, 1, 50, "Victoires ajoutées"],
  ["winmoins", "Retirer une victoire", "Score", "Retire des victoires du compteur.", "−", 1, 1, 50, "Victoires retirées"],
  ["winreset", "Réinitialiser les victoires", "Score", "Remet le compteur de victoires à zéro.", "↺", 1, 1, 1, "Valeur"],
  ["bombegeante", "Bombe géante", "Attaque rouge", "Déclenche une bombe rouge géante.", "✹", 1, 1, 1, "Valeur"],
  ["nausee", "Nausée", "Handicap", "Perturbe temporairement la caméra du joueur.", "≈", 6, 2, 8, "Durée (secondes)"],
  ["aveugle", "Aveuglement", "Handicap", "Aveugle temporairement le joueur.", "◉", 6, 2, 8, "Durée (secondes)"],
  ["rouleau", "Rouleau", "Bonus bleu", "Accorde temporairement le rouleau à peinture.", "▰", 20, 5, 60, "Durée (secondes)"],
  ["superpistolet", "Super pistolet", "Bonus bleu", "Accorde temporairement le super pistolet.", "✧", 20, 5, 60, "Durée (secondes)"],
  ["grenades", "Grenades", "Bonus bleu", "Ajoute des grenades de peinture bleue.", "◌", 3, 1, 10, "Nombre de grenades"],
  ["bombepetite", "Petite bombe rouge", "Attaque rouge", "Dépose de petites bombes rouges.", "•", 1, 1, 30, "Nombre de bombes"],
  ["bombemoyenne", "Bombe rouge moyenne", "Attaque rouge", "Dépose des bombes rouges moyennes.", "●", 5, 1, 15, "Nombre de bombes"],
  ["bombegrosse", "Grosse bombe rouge", "Attaque rouge", "Dépose de grosses bombes rouges.", "⬤", 7, 1, 10, "Nombre de bombes"],
  ["bombebleuepetite", "Petite bombe bleue", "Bonus bleu", "Dépose de petites bombes bleues.", "•", 1, 1, 30, "Nombre de bombes"],
  ["bombebleuemoyenne", "Bombe bleue moyenne", "Bonus bleu", "Dépose des bombes bleues moyennes.", "●", 5, 1, 15, "Nombre de bombes"],
  ["bombebleuegrosse", "Grosse bombe bleue", "Bonus bleu", "Dépose de grosses bombes bleues.", "⬤", 7, 1, 10, "Nombre de bombes"],
  ["remplir", "Remplir en bleu", "Bonus bleu", "Remplit une partie de la carte de peinture bleue.", "▥", 25, 5, 60, "Pourcentage"],
  ["resetmap", "Réinitialiser la carte", "Partie", "Nettoie et réinitialise la carte active.", "↻", 1, 1, 1, "Valeur"],
  ["random", "Effet aléatoire", "Chaos", "Déclenche un effet Color Strike aléatoire.", "?", 1, 1, 1, "Valeur"],
  ["multi", "Mode multijoueur", "Partie", "Déclenche l’action multijoueur prévue par le jeu.", "⚔", 1, 1, 1, "Valeur"]
];

const COLOR_STRIKE_EFFECTS = Object.freeze(
  EFFECT_DEFINITIONS.map(
    ([code, name, category, description, icon, defaultValue, min, max, label]) =>
      Object.freeze({
        id: `color-strike-${code}`,
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

const COLOR_STRIKE_DEPRECATED_DEFAULT_MAPPING_IDS = Object.freeze(
  COLOR_STRIKE_EFFECTS.map((effect) => effect.id)
);

const EFFECTS_BY_CODE = new Map(
  COLOR_STRIKE_EFFECTS.map((effect) => [effect.code, effect])
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
  if (!effect) throw new Error(`Effet Color Strike inconnu : ${effectCode}`);
  const quantity = Number(amount ?? effect.quantity ?? 1);
  return Object.freeze({
    id: `color-strike-${id}`,
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

const COLOR_STRIKE_DEFAULT_MAPPINGS = Object.freeze([
  defaultMapping("red-small-1", "bombepetite", "Petites bombes ×1", {
    ...tikLiveDefaultGift("rose"),
    amount: 1
  }),
  defaultMapping("nausea-6", "nausee", "Nausée · 6 s", {
    ...tikLiveDefaultGift("fingerHeart"),
    amount: 6
  }),
  defaultMapping("red-small-15", "bombepetite", "Petites bombes ×15", {
    ...tikLiveDefaultGift("rosa"),
    amount: 15
  }),
  defaultMapping("red-medium-5", "bombemoyenne", "Bombes moyennes ×5", {
    ...tikLiveDefaultGift("donut"),
    amount: 5
  }),
  defaultMapping("blind-6", "aveugle", "Aveugle · 6 s", {
    ...tikLiveDefaultGift("tomatoThrow"),
    amount: 6
  }),
  defaultMapping("red-large-7", "bombegrosse", "Grosses bombes ×7", {
    ...tikLiveDefaultGift("handsHeart"),
    amount: 7
  }),
  defaultMapping("red-giant", "bombegeante", "Bombe géante", {
    ...tikLiveDefaultGift("gemGun"),
    amount: 1
  }),

  defaultMapping("blue-small-1", "bombebleuepetite", "Petites bombes bleues ×1", {
    ...tikLiveDefaultGift("gg"),
    amount: 1
  }),
  defaultMapping("blue-small-15", "bombebleuepetite", "Petites bombes bleues ×15", {
    ...tikLiveDefaultGift("communityHeart"),
    amount: 15
  }),
  defaultMapping("roller-15", "rouleau", "Rouleau de peinture · 15 s", {
    ...tikLiveDefaultGift("helloBear"),
    amount: 15
  }),
  defaultMapping("super-gun-15", "superpistolet", "Super pistolet · 15 s", {
    ...tikLiveDefaultGift("goldenBoxingGloves"),
    amount: 15
  }),
  defaultMapping("grenades-3", "grenades", "Grenades ×3", {
    ...tikLiveDefaultGift("luckyPig"),
    amount: 3
  }),
  defaultMapping("blue-medium-5", "bombebleuemoyenne", "Bombes bleues moyennes ×5", {
    ...tikLiveDefaultGift("capybara"),
    amount: 5
  }),
  defaultMapping("blue-large-7", "bombebleuegrosse", "Grosses bombes bleues ×7", {
    ...tikLiveDefaultGift("heartKiss"),
    amount: 7
  }),
  defaultMapping("fill-25", "remplir", "Remplir · +25 %", {
    ...tikLiveDefaultGift("corgi"),
    amount: 25
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
  defaultMapping("reset-map", "resetmap", "Reset de la map", {
    ...tikLiveDefaultGift("boxingGloves")
  }),
  defaultMapping("reset-wins", "winreset", "Reset win", {
    ...tikLiveDefaultGift("sportsCar")
  }),

  defaultMapping("random", "random", "Roue · Random", {
    ...tikLiveDefaultGift("tiktok")
  }),
  defaultMapping("multiplier", "multi", "Multiplicateur", {
    ...tikLiveDefaultGift("maxPower")
  }),
  defaultMapping("spin-chat", "random", "Roue de la chance · !spin", {
    triggerType: "chat",
    conditions: [
      {
        field: "data.message",
        operator: "matches",
        value: "^\\s*!spin\\s*$"
      }
    ],
    actionType: "wheel.spin",
    actionConfig: { wheelId: "wheel_color_strike" }
  }),

  defaultMapping("territory-steal-10", "vol", "Vol de territoire · +10 %", {
    ...tikLiveDefaultGift("goldMine"),
    amount: 10
  }),
  defaultMapping("blackout-8", "blackout", "Blackout · 8 s", {
    ...tikLiveDefaultGift("stargazing"),
    amount: 8
  }),
  defaultMapping("nuke", "nuke", "Nuke", {
    ...tikLiveDefaultGift("meteorShower")
  }),
  defaultMapping("boss-40", "boss", "Boss de peinture · 40 s", {
    ...tikLiveDefaultGift("giant"),
    amount: 40
  }),

  defaultMapping("likes-10", "eclabousse", "Tap-tap · tous les 10", {
    triggerType: "like",
    threshold: 10,
    amount: 1
  }),
  defaultMapping("follow", "eclabousse", "Follow", {
    triggerType: "follow",
    amount: 4
  }),
  defaultMapping("share", "eclabousserouge", "Partage", {
    triggerType: "share",
    amount: 1
  })
]);

const WHEEL_ACTION_PREFIX = "action_color-strike_color-strike-";
const wheelSegment = (id, label, color, mappingId) =>
  Object.freeze({
    id: `segment_color_strike_${id}`,
    label,
    color,
    action: "action",
    actionId: `${WHEEL_ACTION_PREFIX}${mappingId}`
  });

const COLOR_STRIKE_WHEEL_PRESETS = Object.freeze([
  Object.freeze({
    id: "wheel_color_strike",
    name: "Color Strike · Roue de la chance",
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
      wheelSegment("blue_15", "Bombes bleues ×15", "#20d982", "blue-small-15"),
      wheelSegment("roller", "Rouleau 15 s", "#00bfa6", "roller-15"),
      wheelSegment("super_gun", "Super pistolet", "#16a6ff", "super-gun-15"),
      wheelSegment("grenades", "Grenades ×3", "#875cff", "grenades-3"),
      wheelSegment("fill", "Remplir +25 %", "#17c964", "fill-25"),
      wheelSegment("red_15", "Bombes rouges ×15", "#ff315f", "red-small-15"),
      wheelSegment("red_medium", "Bombes moyennes ×5", "#ff5e45", "red-medium-5"),
      wheelSegment("blind", "Aveugle 6 s", "#e43f8d", "blind-6"),
      wheelSegment("nuke", "Nuke", "#ff8a00", "nuke"),
      wheelSegment("boss", "Boss 40 s", "#f7b731", "boss-40"),
      wheelSegment("win_plus", "+5 WIN", "#ffd23f", "win-plus-5"),
      wheelSegment("win_minus", "−5 WIN", "#b72cff", "win-minus-5")
    ])
  })
]);

const COLOR_STRIKE_INTERACTION_CATALOG_VERSION = 2026101301;

module.exports = {
  COLOR_STRIKE_CONNECTOR,
  COLOR_STRIKE_DEPRECATED_DEFAULT_MAPPING_IDS,
  COLOR_STRIKE_DEFAULT_MAPPINGS,
  COLOR_STRIKE_EFFECTS,
  COLOR_STRIKE_INTERACTION_CATALOG_VERSION,
  COLOR_STRIKE_WHEEL_PRESETS,
  GAME_ID
};
